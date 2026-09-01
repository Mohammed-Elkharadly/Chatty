import type { Request, Response } from "express";
import mongoose, { Types } from "mongoose";
import { StatusCodes } from "http-status-codes";
import { Group } from "../models/Group.js";
import { GroupMember } from "../models/GroupMember.js";
import { CustomError } from "../utils/customError.js";
import { User } from "../models/User.js";
import { io, getSocketsForUser } from "../config/socket.js";
import { GroupMessage } from "../models/GroupMessage.js";

// handles: POST /api/groups — creates a new group and adds the creator as its first member + admin
export const createGroup = async (req: Request, res: Response) => {
  // the creator's _id (from verifyJwt middleware) — they become the group's admin
  const adminId = req.user?._id;
  // pull the group details from the request body
  const { name, description } = req.body;

  // no authenticated user → reject
  if (!adminId) {
    throw new CustomError("Unauthorized", StatusCodes.UNAUTHORIZED);
  }

  // name is required and must be at least 2 chars after trimming
  if (!name || typeof name !== "string" || name.trim().length < 2) {
    throw new CustomError(
      "Group name must be at least 2 characters",
      StatusCodes.BAD_REQUEST,
    );
  }

  // start a MongoDB session (required for transactions)
  const session = await mongoose.startSession();

  try {
    // withTransaction: runs the callback atomically — if anything throws, ALL writes roll back
    const group = await session.withTransaction(async () => {
      // build the group document in memory (not yet saved)
      const createdGroup = new Group({
        name: name.trim(),
        description,
        adminId,
      });
      // write it to the DB within this session (tied to the transaction)
      await createdGroup.save({ session });

      // build the membership doc (creator is the first member)
      const member = new GroupMember({
        groupId: createdGroup._id, // reference the group we just saved
        userId: adminId,
      });
      // write it to the DB within the same session
      await member.save({ session });

      // return the group so it's available outside the transaction
      return createdGroup;
    });

    // transaction committed successfully → send the response
    res.status(StatusCodes.CREATED).json({ group });
  } finally {
    // always release the session (even if the transaction threw / rolled back)
    // without this, the session stays open and consumes a DB connection
    session.endSession();
  }
};

// handles: GET /api/groups/my — lists every group the logged-in user is a member of
export const getMyGroups = async (req: Request, res: Response) => {
  // get the logged-in user's _id (from verifyJwt middleware)
  const userId = req.user?._id;
  // no authenticated user → reject
  if (!userId) {
    throw new CustomError("Unauthorized", StatusCodes.UNAUTHORIZED);
  }

  // find all membership records for this user → array of { groupId }
  const memberships = await GroupMember.find({ userId }).select("groupId");

  // extract just the group IDs (e.g. [ObjectId("..."), ObjectId("...")])
  const groupIds = memberships.map((m) => m.groupId);

  // fetch the actual group documents for all those IDs in one query
  const groups = await Group.find({ _id: { $in: groupIds } });

  // return the list (empty array if the user isn't in any groups)
  res.status(StatusCodes.OK).json({ groups });
};

// handles: GET /api/groups/:id/members — lists all members of a group (only members can view)
export const getGroupMembers = async (req: Request, res: Response) => {
  // get the logged-in user's _id (from verifyJwt middleware)
  const userId = req.user?._id;
  // the group to look up (from the URL param)
  const { id: groupId } = req.params;

  // no authenticated user → reject
  if (!userId) {
    throw new CustomError("Unauthorized", StatusCodes.UNAUTHORIZED);
  }
  // make sure the groupId param is a valid MongoDB ObjectId
  if (typeof groupId !== "string" || !Types.ObjectId.isValid(groupId)) {
    throw new CustomError("Invalid group ID", StatusCodes.BAD_REQUEST);
  }

  // check if the requesting user is actually a member of this group
  const isMember = await GroupMember.exists({ groupId, userId });
  // not a member → 403 (they exist, but don't have permission to see this group)
  if (!isMember) {
    throw new CustomError("Not a member of this group", StatusCodes.FORBIDDEN);
  }

  // get all membership records for this group → array of { userId, createdAt }
  // (createdAt = when they joined, useful for showing "joined on..." in the UI)
  const members = await GroupMember.find({ groupId })
    .select("userId createdAt")
    .populate("userId", "name email avatar");

  // extract just the user IDs
  const userIds = members.map((m) => m.userId);

  // fetch the actual user documents (only public fields — no password, tokens, etc.)
  const users = await User.find({ _id: { $in: userIds } }).select(
    "name email avatar",
  );

  // return the member list
  res.status(StatusCodes.OK).json({ members: users });
};

// handles: DELETE /api/groups/:id/members/:memberId — admin removes a member from the group
// (admin can't remove themselves this way — use deleteGroup or a future "transfer ownership")
export const removeMember = async (req: Request, res: Response) => {
  // the admin doing the removal (from verifyJwt middleware)
  const adminId = req.user?._id;
  // the group + the member being removed (from URL params)
  const { id: groupId, memberId } = req.params;

  // no authenticated user → reject
  if (!adminId) {
    throw new CustomError("Unauthorized", StatusCodes.UNAUTHORIZED);
  }
  // validate the group ID is a real ObjectId
  if (typeof groupId !== "string" || !Types.ObjectId.isValid(groupId)) {
    throw new CustomError("Invalid group ID", StatusCodes.BAD_REQUEST);
  }
  // validate the member ID is a real ObjectId
  if (typeof memberId !== "string" || !Types.ObjectId.isValid(memberId)) {
    throw new CustomError("Invalid member ID", StatusCodes.BAD_REQUEST);
  }

  // fetch the group to check who the admin is
  const group = await Group.findById(groupId);
  // group doesn't exist
  if (!group) {
    throw new CustomError("Group not found", StatusCodes.NOT_FOUND);
  }
  // only the group's admin can remove members
  if (!group.adminId.equals(adminId)) {
    throw new CustomError(
      "Only the admin can remove members",
      StatusCodes.FORBIDDEN,
    );
  }
  // prevent the admin from removing themselves (would orphan the group with no admin)
  if (group.adminId.equals(memberId)) {
    throw new CustomError(
      "Admin cannot remove themselves",
      StatusCodes.BAD_REQUEST,
    );
  }

  // delete the membership record (member loses access to the group immediately)
  await GroupMember.deleteOne({ groupId, userId: memberId });

  // notify the removed user's open tabs so they can leave the room + show a UI message
  const socketIds = getSocketsForUser(memberId);
  socketIds.forEach((id) => io.to(id).emit("group:removed", { groupId }));

  // respond with 200
  res.status(StatusCodes.OK).json({ message: "Member removed" });
};

// handles: DELETE /api/groups/:id/leave — any member can leave the group
// (admin cannot leave — they must delete the group or transfer ownership first)
export const leaveGroup = async (req: Request, res: Response) => {
  // the user leaving (from verifyJwt middleware)
  const userId = req.user?._id;
  // the group they want to leave (from URL param)
  const { id: groupId } = req.params;

  // no authenticated user → reject
  if (!userId) {
    throw new CustomError("Unauthorized", StatusCodes.UNAUTHORIZED);
  }
  // validate the group ID is a real ObjectId
  if (typeof groupId !== "string" || !Types.ObjectId.isValid(groupId)) {
    throw new CustomError("Invalid group ID", StatusCodes.BAD_REQUEST);
  }

  // fetch the group to check if the user is the admin
  const group = await Group.findById(groupId);
  // group doesn't exist
  if (!group) {
    throw new CustomError("Group not found", StatusCodes.NOT_FOUND);
  }

  // admin can't leave (would orphan the group with no owner)
  // they must either delete the group or (future) transfer admin to another member
  if (group.adminId.equals(userId)) {
    throw new CustomError(
      "Admin must delete the group instead of leaving",
      StatusCodes.BAD_REQUEST,
    );
  }

  // remove the membership record (user loses access immediately)
  await GroupMember.deleteOne({ groupId, userId });

  // tell this user's open tabs to leave the room
  const socketIds = getSocketsForUser(userId.toString());
  socketIds.forEach((id) => io.to(id).emit("group:left", { groupId }));

  // respond with 200
  res.status(StatusCodes.OK).json({ message: "Left the group" });
};

/// handles: DELETE /api/groups/:id — admin deletes the group and all its memberships
// (group messages are intentionally left in place — see messaging phase for history handling)
export const deleteGroup = async (req: Request, res: Response) => {
  // the admin deleting the group (from verifyJwt middleware)
  const adminId = req.user?._id;
  // the group to delete (from URL param)
  const { id: groupId } = req.params;

  // no authenticated user → reject
  if (!adminId) {
    throw new CustomError("Unauthorized", StatusCodes.UNAUTHORIZED);
  }
  // validate the group ID is a real ObjectId
  if (typeof groupId !== "string" || !Types.ObjectId.isValid(groupId)) {
    throw new CustomError("Invalid group ID", StatusCodes.BAD_REQUEST);
  }

  // fetch the group to verify ownership
  const group = await Group.findById(groupId);
  // group doesn't exist
  if (!group) {
    throw new CustomError("Group not found", StatusCodes.NOT_FOUND);
  }
  // only the group's admin can delete it
  if (!group.adminId.equals(adminId)) {
    throw new CustomError(
      "Only the admin can delete this group",
      StatusCodes.FORBIDDEN,
    );
  }

  // remove all messages in this group
  await GroupMessage.deleteMany({ groupId });

  // remove all membership records (members lose access immediately)
  await GroupMember.deleteMany({ groupId });

  // delete the group document itself
  await group.deleteOne();

  // note: GroupMessage docs with this groupId are left in place for now
  // (orphaned messages — you'll handle cleanup or archival in the messaging phase)

  // tell everyone still in the room that the group no longer exists
  io.to(`group:${groupId}`).emit("group:deleted", { groupId });
  // respond with 200
  res.status(StatusCodes.OK).json({ message: "Group deleted" });
};
