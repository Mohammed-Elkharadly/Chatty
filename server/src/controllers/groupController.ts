import type { Request, Response } from "express";
import { Types } from "mongoose";
import { StatusCodes } from "http-status-codes";
import { Group } from "../models/Group.js";
import { GroupMember } from "../models/GroupMember.js";
import { CustomError } from "../utils/customError.js";
import { User } from "../models/User.js";

// Creates a group and adds the creator as its only initial member + admin.
export const createGroup = async (req: Request, res: Response) => {
  const adminId = req.user?._id;
  const { name, description } = req.body;

  if (!adminId) {
    throw new CustomError("Unauthorized", StatusCodes.UNAUTHORIZED);
  }

  if (!name || typeof name !== "string" || name.trim().length < 2) {
    throw new CustomError(
      "Group name must be at least 2 characters",
      StatusCodes.BAD_REQUEST,
    );
  }

  const group = await Group.create({
    name: name.trim(),
    description,
    adminId,
  });

  await GroupMember.create({ groupId: group._id, userId: adminId });

  res.status(StatusCodes.CREATED).json({ group });
};

// Lists every group the logged-in user is a member of.
export const getMyGroups = async (req: Request, res: Response) => {
  const userId = req.user?._id;
  if (!userId) {
    throw new CustomError("Unauthorized", StatusCodes.UNAUTHORIZED);
  }

  const memberships = await GroupMember.find({ userId }).select("groupId");
  const groupIds = memberships.map((m) => m.groupId);

  const groups = await Group.find({ _id: { $in: groupIds } });

  res.status(StatusCodes.OK).json({ groups });
};

// Lists the members of a specific group (must be a member to view).
export const getGroupMembers = async (req: Request, res: Response) => {
  const userId = req.user?._id;
  const { id: groupId } = req.params;

  if (!userId) {
    throw new CustomError("Unauthorized", StatusCodes.UNAUTHORIZED);
  }
  if (typeof groupId !== "string" || !Types.ObjectId.isValid(groupId)) {
    throw new CustomError("Invalid group ID", StatusCodes.BAD_REQUEST);
  }

  const isMember = await GroupMember.exists({ groupId, userId });
  if (!isMember) {
    throw new CustomError("Not a member of this group", StatusCodes.FORBIDDEN);
  }

  const members = await GroupMember.find({ groupId }).select(
    "userId createdAt",
  );
  const userIds = members.map((m) => m.userId);
  const users = await User.find({ _id: { $in: userIds } }).select(
    "_id name email avatar",
  );

  res.status(StatusCodes.OK).json({ members: users });
};

// Admin removes a member from the group. Admin can't remove themselves
// this way — use deleteGroup or a future "transfer ownership" for that.
export const removeMember = async (req: Request, res: Response) => {
  const adminId = req.user?._id;
  const { id: groupId, memberId } = req.params;

  if (!adminId) {
    throw new CustomError("Unauthorized", StatusCodes.UNAUTHORIZED);
  }
  if (typeof groupId !== "string" || !Types.ObjectId.isValid(groupId)) {
    throw new CustomError("Invalid group ID", StatusCodes.BAD_REQUEST);
  }
  if (typeof memberId !== "string" || !Types.ObjectId.isValid(memberId)) {
    throw new CustomError("Invalid member ID", StatusCodes.BAD_REQUEST);
  }

  const group = await Group.findById(groupId);
  if (!group) {
    throw new CustomError("Group not found", StatusCodes.NOT_FOUND);
  }
  if (!group.adminId.equals(adminId)) {
    throw new CustomError(
      "Only the admin can remove members",
      StatusCodes.FORBIDDEN,
    );
  }
  if (group.adminId.equals(memberId)) {
    throw new CustomError(
      "Admin cannot remove themselves",
      StatusCodes.BAD_REQUEST,
    );
  }

  await GroupMember.deleteOne({ groupId, userId: memberId });

  res.status(StatusCodes.OK).json({ message: "Member removed" });
};

// Any member (including the admin, with caveats below) can leave.
export const leaveGroup = async (req: Request, res: Response) => {
  const userId = req.user?._id;
  const { id: groupId } = req.params;

  if (!userId) {
    throw new CustomError("Unauthorized", StatusCodes.UNAUTHORIZED);
  }
  if (typeof groupId !== "string" || !Types.ObjectId.isValid(groupId)) {
    throw new CustomError("Invalid group ID", StatusCodes.BAD_REQUEST);
  }

  const group = await Group.findById(groupId);
  if (!group) {
    throw new CustomError("Group not found", StatusCodes.NOT_FOUND);
  }

  if (group.adminId.equals(userId)) {
    throw new CustomError(
      "Admin must delete the group instead of leaving",
      StatusCodes.BAD_REQUEST,
    );
  }

  await GroupMember.deleteOne({ groupId, userId });

  res.status(StatusCodes.OK).json({ message: "Left the group" });
};

// Admin-only: deletes the group and all its memberships.
export const deleteGroup = async (req: Request, res: Response) => {
  const adminId = req.user?._id;
  const { id: groupId } = req.params;

  if (!adminId) {
    throw new CustomError("Unauthorized", StatusCodes.UNAUTHORIZED);
  }
  if (typeof groupId !== "string" || !Types.ObjectId.isValid(groupId)) {
    throw new CustomError("Invalid group ID", StatusCodes.BAD_REQUEST);
  }

  const group = await Group.findById(groupId);
  if (!group) {
    throw new CustomError("Group not found", StatusCodes.NOT_FOUND);
  }
  if (!group.adminId.equals(adminId)) {
    throw new CustomError(
      "Only the admin can delete this group",
      StatusCodes.FORBIDDEN,
    );
  }

  await GroupMember.deleteMany({ groupId });
  await group.deleteOne();
  // note: existing GroupMessages are intentionally left in place for now —
  // see the messaging phase for how history is handled

  res.status(StatusCodes.OK).json({ message: "Group deleted" });
};
