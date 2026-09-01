import type { Request, Response } from "express";
import { Types } from "mongoose";
import { StatusCodes } from "http-status-codes";
import { Group } from "../models/Group.js";
import { GroupMember } from "../models/GroupMember.js";
import { GroupJoinRequest } from "../models/GroupJoinRequest.js";
import { User } from "../models/User.js";
import { CustomError } from "../utils/customError.js";
import { io, getSocketsForUser } from "../config/socket.js";

// handles: POST /api/groups/:id/invite — admin invites a specific user to the group
// (the invited user must accept before actually joining)
export const inviteToGroup = async (req: Request, res: Response) => {
  // the admin sending the invite (from verifyJwt middleware)
  const adminId = req.user?._id;
  // the group to invite to (from URL param)
  const { id: groupId } = req.params;
  // the user being invited (from request body)
  const { userId } = req.body;

  // no authenticated user → reject
  if (!adminId) {
    throw new CustomError("Unauthorized", StatusCodes.UNAUTHORIZED);
  }
  // validate the group ID is a real ObjectId
  if (typeof groupId !== "string" || !Types.ObjectId.isValid(groupId)) {
    throw new CustomError("Invalid group ID", StatusCodes.BAD_REQUEST);
  }
  // validate the target user ID is a real ObjectId
  if (!userId || !Types.ObjectId.isValid(userId)) {
    throw new CustomError("Invalid user ID", StatusCodes.BAD_REQUEST);
  }

  // fetch the group to verify the caller is the admin
  const group = await Group.findById(groupId);
  // group doesn't exist
  if (!group) {
    throw new CustomError("Group not found", StatusCodes.NOT_FOUND);
  }
  // only the group's admin can invite
  if (!group.adminId.equals(adminId)) {
    throw new CustomError(
      "Only the admin can invite members",
      StatusCodes.FORBIDDEN,
    );
  }

  // can't invite someone who's already in the group
  const alreadyMember = await GroupMember.exists({ groupId, userId });
  if (alreadyMember) {
    throw new CustomError("User is already a member", StatusCodes.BAD_REQUEST);
  }

  // make sure the target user actually exists (don't create invites for ghost users)
  const targetExists = await User.exists({ _id: userId });
  if (!targetExists) {
    throw new CustomError("User not found", StatusCodes.NOT_FOUND);
  }

  // create the pending invite record
  // the partial unique index on { groupId, userId } where status="pending" prevents duplicates
  try {
    await GroupJoinRequest.create({
      groupId,
      userId,
      type: "invite", // admin-initiated (vs "request" which is user-initiated)
      initiatedBy: adminId, // who sent the invite
    });
  } catch (error: any) {
    // MongoDB error code 11000 = duplicate key → a pending invite/request already exists
    if (error?.code === 11000) {
      throw new CustomError(
        "A pending invite or request already exists for this user",
        StatusCodes.BAD_REQUEST,
      );
    }
    // any other DB error → rethrow (handled by errorHandler)
    throw error;
  }

  // if the invited user is online, notify them in real-time
  const socketIds = getSocketsForUser(userId);
  socketIds.forEach((id) => io.to(id).emit("group:invite:new", { groupId }));

  // respond with 201
  res.status(StatusCodes.CREATED).json({ message: "Invite sent" });
};

/// handles: POST /api/groups/:id/request-join — a user requests to join a group (admin must accept)
export const requestToJoin = async (req: Request, res: Response) => {
  // the user requesting to join (from verifyJwt middleware)
  const userId = req.user?._id;
  // the group they want to join (from URL param)
  const { id: groupId } = req.params;

  // no authenticated user → reject
  if (!userId) {
    throw new CustomError("Unauthorized", StatusCodes.UNAUTHORIZED);
  }
  // validate the group ID is a real ObjectId
  if (typeof groupId !== "string" || !Types.ObjectId.isValid(groupId)) {
    throw new CustomError("Invalid group ID", StatusCodes.BAD_REQUEST);
  }

  // fetch the group to confirm it exists
  const group = await Group.findById(groupId);
  // group doesn't exist
  if (!group) {
    throw new CustomError("Group not found", StatusCodes.NOT_FOUND);
  }

  // can't request to join a group you're already in
  const alreadyMember = await GroupMember.exists({ groupId, userId });
  if (alreadyMember) {
    throw new CustomError("Already a member", StatusCodes.BAD_REQUEST);
  }

  // create the pending request record
  // the partial unique index on { groupId, userId } where status="pending" prevents duplicates
  try {
    await GroupJoinRequest.create({
      groupId,
      userId,
      type: "request", // user-initiated (vs "invite" which is admin-initiated)
      initiatedBy: userId, // the user themselves sent the request
    });
  } catch (error: any) {
    // MongoDB error code 11000 = duplicate key → a pending invite/request already exists
    if (error?.code === 11000) {
      throw new CustomError(
        "A pending invite or request already exists",
        StatusCodes.BAD_REQUEST,
      );
    }
    // any other DB error → rethrow (handled by errorHandler)
    throw error;
  }

  // if the admin is online, notify them there's a new join request
  const adminSockets = getSocketsForUser(group.adminId.toString());
  adminSockets.forEach((id) =>
    io.to(id).emit("group:request:new", { groupId, requestedBy: userId }),
  );

  // respond with 201
  res.status(StatusCodes.CREATED).json({ message: "Join request sent" });
};

// handles: PATCH /api/groups/join-requests/:id — resolves a pending invite or request
// INVITE → the invited user accepts/rejects
// REQUEST → the group admin accepts/rejects
export const respondToJoinRequest = async (req: Request, res: Response) => {
  // the user responding (from verifyJwt middleware)
  const responderId = req.user?._id;
  // the join request/invite being resolved (from URL param)
  const { id: requestId } = req.params;
  // what they want to do: "accept" or "reject"
  const { action } = req.body;

  // no authenticated user → reject
  if (!responderId) {
    throw new CustomError("Unauthorized", StatusCodes.UNAUTHORIZED);
  }
  // validate the request ID is a real ObjectId
  if (typeof requestId !== "string" || !Types.ObjectId.isValid(requestId)) {
    throw new CustomError("Invalid request ID", StatusCodes.BAD_REQUEST);
  }
  // action must be exactly "accept" or "reject"
  if (action !== "accept" && action !== "reject") {
    throw new CustomError(
      "action must be 'accept' or 'reject'",
      StatusCodes.BAD_REQUEST,
    );
  }

  // fetch the join request document
  const joinRequest = await GroupJoinRequest.findById(requestId);
  // doesn't exist OR was already resolved → 404
  if (!joinRequest || joinRequest.status !== "pending") {
    throw new CustomError(
      "Request not found or already resolved",
      StatusCodes.NOT_FOUND,
    );
  }

  // fetch the group (needed for admin check + admin notification)
  const group = await Group.findById(joinRequest.groupId);
  // group was deleted after the invite/request was created
  if (!group) {
    throw new CustomError("Group not found", StatusCodes.NOT_FOUND);
  }

  // --- AUTHORIZATION (differs by type) ---
  if (joinRequest.type === "invite") {
    // an INVITE was sent TO this user → only THEY can accept/reject
    if (!joinRequest.userId.equals(responderId)) {
      throw new CustomError(
        "Only the invited user can respond to this invite",
        StatusCodes.FORBIDDEN,
      );
    }
  } else {
    // a REQUEST was sent BY a user → only the GROUP ADMIN can accept/reject
    if (!group.adminId.equals(responderId)) {
      throw new CustomError(
        "Only the group admin can respond to join requests",
        StatusCodes.FORBIDDEN,
      );
    }
  }

  // update the status
  joinRequest.status = action === "accept" ? "accepted" : "rejected";
  await joinRequest.save();

  // if accepted → add the user to the group as a member
  if (action === "accept") {
    await GroupMember.updateOne(
      { groupId: joinRequest.groupId, userId: joinRequest.userId },
      {
        $setOnInsert: {
          groupId: joinRequest.groupId,
          userId: joinRequest.userId,
        },
      },
      { upsert: true },
    );

    // tell the newly-joined user's open tabs they're now in the group
    const userSockets = getSocketsForUser(joinRequest.userId.toString());
    userSockets.forEach((id) =>
      io.to(id).emit("group:joined", { groupId: joinRequest.groupId }),
    );

    // tell existing members in the room that someone new joined
    io.to(`group:${joinRequest.groupId}`).emit("group:member:joined", {
      userId: joinRequest.userId,
    });
  } else {
    // notify the affected user
    const userSockets = getSocketsForUser(joinRequest.userId.toString());
    if (joinRequest.type === "invite") {
      // tell the invited user their invite was rejected
      userSockets.forEach((id) =>
        io
          .to(id)
          .emit("group:invite:rejected", { groupId: joinRequest.groupId }),
      );
      // also tell the admin their invite was rejected
      const adminSockets = getSocketsForUser(group.adminId.toString());
      adminSockets.forEach((id) =>
        io.to(id).emit("group:invite:rejected:byUser", {
          groupId: joinRequest.groupId,
          userId: joinRequest.userId,
        }),
      );
    }
    if (joinRequest.type === "request") {
      // tell the requester their request was rejected
      userSockets.forEach((id) =>
        io
          .to(id)
          .emit("group:request:rejected", { groupId: joinRequest.groupId }),
      );
    }
  }

  // respond with 200 + the new status
  res.status(StatusCodes.OK).json({ message: `Request ${joinRequest.status}` });
};

/// handles: GET /api/groups/join-requests/my — lists the logged-in user's pending invites/requests
// (things waiting on THEM to resolve, or that THEY sent and are still pending)
export const getMyJoinRequests = async (req: Request, res: Response) => {
  // the logged-in user's _id (from verifyJwt middleware)
  const userId = req.user?._id;
  // no authenticated user → reject
  if (!userId) {
    throw new CustomError("Unauthorized", StatusCodes.UNAUTHORIZED);
  }

  // invites sent TO me by an admin (I need to accept/reject)
  // populate groupId so the client gets the group name + avatar without a separate request
  const invitesReceived = await GroupJoinRequest.find({
    userId,
    type: "invite",
    status: "pending",
  }).populate("groupId", "name avatar");

  // join requests I sent (waiting on the group admin to accept/reject)
  const requestsSent = await GroupJoinRequest.find({
    userId,
    type: "request",
    status: "pending",
  }).populate("groupId", "name avatar");

  // return both lists (empty arrays if nothing is pending)
  res.status(StatusCodes.OK).json({ invitesReceived, requestsSent });
};

// handles: GET /api/groups/:id/pending-requests — admin-only: lists pending join requests for a group they administer
export const getPendingRequestsForGroup = async (
  req: Request,
  res: Response,
) => {
  // the admin viewing the list (from verifyJwt middleware)
  const adminId = req.user?._id;
  // the group to check (from URL param)
  const { id: groupId } = req.params;

  // no authenticated user → reject
  if (!adminId) {
    throw new CustomError("Unauthorized", StatusCodes.UNAUTHORIZED);
  }
  // validate the group ID is a real ObjectId
  if (typeof groupId !== "string" || !Types.ObjectId.isValid(groupId)) {
    throw new CustomError("Invalid group ID", StatusCodes.BAD_REQUEST);
  }

  // fetch the group to verify the caller is the admin
  const group = await Group.findById(groupId);
  // group doesn't exist
  if (!group) {
    throw new CustomError("Group not found", StatusCodes.NOT_FOUND);
  }
  // only the group's admin can see pending requests
  if (!group.adminId.equals(adminId)) {
    throw new CustomError(
      "Only the admin can view this",
      StatusCodes.FORBIDDEN,
    );
  }

  // find all pending join requests (user-initiated) for this group
  // populate userId so the admin sees who's requesting (name + avatar) without a separate call
  const requests = await GroupJoinRequest.find({
    groupId,
    type: "request", // only user-initiated requests (not admin invites)
    status: "pending", // only unresolved ones
  }).populate("userId", "name email avatar");

  // return the list (empty array if no one is waiting)
  res.status(StatusCodes.OK).json({ requests });
};
