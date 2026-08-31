import type { Request, Response } from "express";
import { Types } from "mongoose";
import { StatusCodes } from "http-status-codes";
import { Group } from "../models/Group.js";
import { GroupMember } from "../models/GroupMember.js";
import { GroupJoinRequest } from "../models/GroupJoinRequest.js";
import { User } from "../models/User.js";
import { CustomError } from "../utils/customError.js";

// Admin invites a specific user to the group. The invited user must
// accept before joining.
export const inviteToGroup = async (req: Request, res: Response) => {
  const adminId = req.user?._id;
  const { id: groupId } = req.params;
  const { userId } = req.body;

  if (!adminId) {
    throw new CustomError("Unauthorized", StatusCodes.UNAUTHORIZED);
  }
  if (typeof groupId !== "string" || !Types.ObjectId.isValid(groupId)) {
    throw new CustomError("Invalid group ID", StatusCodes.BAD_REQUEST);
  }
  if (!userId || !Types.ObjectId.isValid(userId)) {
    throw new CustomError("Invalid user ID", StatusCodes.BAD_REQUEST);
  }

  const group = await Group.findById(groupId);
  if (!group) {
    throw new CustomError("Group not found", StatusCodes.NOT_FOUND);
  }
  if (!group.adminId.equals(adminId)) {
    throw new CustomError(
      "Only the admin can invite members",
      StatusCodes.FORBIDDEN,
    );
  }

  const alreadyMember = await GroupMember.exists({ groupId, userId });
  if (alreadyMember) {
    throw new CustomError("User is already a member", StatusCodes.BAD_REQUEST);
  }

  const targetExists = await User.exists({ _id: userId });
  if (!targetExists) {
    throw new CustomError("User not found", StatusCodes.NOT_FOUND);
  }

  try {
    await GroupJoinRequest.create({
      groupId,
      userId,
      type: "invite",
      initiatedBy: adminId,
    });
  } catch (error: any) {
    if (error?.code === 11000) {
      throw new CustomError(
        "A pending invite or request already exists for this user",
        StatusCodes.BAD_REQUEST,
      );
    }
    throw error;
  }

  res.status(StatusCodes.CREATED).json({ message: "Invite sent" });
};

// User requests to join a group. Admin must accept before joining.
export const requestToJoin = async (req: Request, res: Response) => {
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

  const alreadyMember = await GroupMember.exists({ groupId, userId });
  if (alreadyMember) {
    throw new CustomError("Already a member", StatusCodes.BAD_REQUEST);
  }

  try {
    await GroupJoinRequest.create({
      groupId,
      userId,
      type: "request",
      initiatedBy: userId,
    });
  } catch (error: any) {
    if (error?.code === 11000) {
      throw new CustomError(
        "A pending invite or request already exists",
        StatusCodes.BAD_REQUEST,
      );
    }
    throw error;
  }

  res.status(StatusCodes.CREATED).json({ message: "Join request sent" });
};

// Resolves a pending invite or request (accept/reject). Authorization
// differs by type: an INVITE is resolved by the invited user themself;
// a REQUEST is resolved by the group's admin.
export const respondToJoinRequest = async (req: Request, res: Response) => {
  const responderId = req.user?._id;
  const { id: requestId } = req.params;
  const { action } = req.body; // 'accept' | 'reject'

  if (!responderId) {
    throw new CustomError("Unauthorized", StatusCodes.UNAUTHORIZED);
  }
  if (typeof requestId !== "string" || !Types.ObjectId.isValid(requestId)) {
    throw new CustomError("Invalid request ID", StatusCodes.BAD_REQUEST);
  }
  if (action !== "accept" && action !== "reject") {
    throw new CustomError(
      "action must be 'accept' or 'reject'",
      StatusCodes.BAD_REQUEST,
    );
  }

  const joinRequest = await GroupJoinRequest.findById(requestId);
  if (!joinRequest || joinRequest.status !== "pending") {
    throw new CustomError(
      "Request not found or already resolved",
      StatusCodes.NOT_FOUND,
    );
  }

  const group = await Group.findById(joinRequest.groupId);
  if (!group) {
    throw new CustomError("Group not found", StatusCodes.NOT_FOUND);
  }

  if (joinRequest.type === "invite") {
    // only the invited user can accept/reject their own invite
    if (!joinRequest.userId.equals(responderId)) {
      throw new CustomError(
        "Only the invited user can respond to this invite",
        StatusCodes.FORBIDDEN,
      );
    }
  } else {
    // type === 'request' — only the group admin can accept/reject
    if (!group.adminId.equals(responderId)) {
      throw new CustomError(
        "Only the group admin can respond to join requests",
        StatusCodes.FORBIDDEN,
      );
    }
  }

  joinRequest.status = action === "accept" ? "accepted" : "rejected";
  await joinRequest.save();

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
  }

  res.status(StatusCodes.OK).json({ message: `Request ${joinRequest.status}` });
};

// Lists the logged-in user's own pending invites/requests (things
// waiting on THEM to resolve, or that THEY sent and are still pending).
export const getMyJoinRequests = async (req: Request, res: Response) => {
  const userId = req.user?._id;
  if (!userId) {
    throw new CustomError("Unauthorized", StatusCodes.UNAUTHORIZED);
  }

  // invites sent TO me (I need to accept/reject)
  const invitesReceived = await GroupJoinRequest.find({
    userId,
    type: "invite",
    status: "pending",
  }).populate("groupId", "name avatar");

  // requests I sent (waiting on an admin)
  const requestsSent = await GroupJoinRequest.find({
    userId,
    type: "request",
    status: "pending",
  }).populate("groupId", "name avatar");

  res.status(StatusCodes.OK).json({ invitesReceived, requestsSent });
};

// Admin-only: lists pending join REQUESTS for a group they administer
// (i.e. the ones waiting on the admin to decide).
export const getPendingRequestsForGroup = async (
  req: Request,
  res: Response,
) => {
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
      "Only the admin can view this",
      StatusCodes.FORBIDDEN,
    );
  }

  const requests = await GroupJoinRequest.find({
    groupId,
    type: "request",
    status: "pending",
  }).populate("userId", "name email avatar");

  res.status(StatusCodes.OK).json({ requests });
};
