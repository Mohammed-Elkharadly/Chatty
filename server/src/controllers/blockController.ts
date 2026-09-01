import type { Request, Response } from "express";
import { Types } from "mongoose";
import { Block } from "../models/Block.js";
import { StatusCodes } from "http-status-codes";
import { CustomError } from "../utils/customError.js";

// handles: POST /api/user/block/:id — blocks a user (prevents them from messaging you)
export const blockUser = async (req: Request, res: Response) => {
  // the user doing the blocking (from verifyJwt middleware)
  const blockerId = req.user?._id;
  // the user being blocked (from the URL param)
  const { id: blockedId } = req.params;

  // no authenticated user → reject
  if (!blockerId) {
    throw new CustomError("unauthorized", StatusCodes.UNAUTHORIZED);
  }

  if (typeof blockedId !== "string" || !Types.ObjectId.isValid(blockedId)) {
    throw new CustomError("invalid user id", StatusCodes.BAD_REQUEST);
  }

  // convert the string param to a proper ObjectId
  const blockedObjectId = new Types.ObjectId(blockedId);

  // can't block yourself
  if (blockerId.equals(blockedId)) {
    throw new CustomError("you cannot block yourself", StatusCodes.BAD_REQUEST);
  }

  // upsert: insert if not exists, do nothing if already blocked (no error on duplicate)
  // $setOnInsert only applies on the initial insert, not on subsequent no-ops
  await Block.updateOne(
    { blockerId, blockedId: blockedObjectId },
    { $setOnInsert: { blockerId, blockedId: blockedObjectId } },
    { upsert: true },
  );

  res.status(StatusCodes.OK).json({ message: "user blocked" });
};

// handles: DELETE /api/user/unblock/:id — removes a block (allows them to message you again)
export const unblockUser = async (req: Request, res: Response) => {
  const blockerId = req.user?._id;
  const { id: blockedId } = req.params;

  if (!blockerId) {
    throw new CustomError("unauthorized", StatusCodes.UNAUTHORIZED);
  }

  if (typeof blockedId !== "string" || !Types.ObjectId.isValid(blockedId)) {
    throw new CustomError("invalid user id", StatusCodes.BAD_REQUEST);
  }

  // delete the block record (no-op if it doesn't exist)
  await Block.deleteOne({
    blockerId,
    blockedId: new Types.ObjectId(blockedId),
  });

  res.status(StatusCodes.OK).json({ message: "user unblocked" });
};

// handles: GET /api/user/blocked — returns the list of users I've blocked
export const getBlockedUsers = async (req: Request, res: Response) => {
  const blockerId = req.user?._id;

  if (!blockerId) {
    throw new CustomError("unauthorized", StatusCodes.UNAUTHORIZED);
  }

  // get all block records where I'm the blocker → array of blockedId ObjectIds
  const blocks = await Block.find({ blockerId }).select("blockedId");
  const blockedIds = blocks.map((b) => b.blockedId);

  const blockedUsers = await Block.find({ _id: { $in: blockedIds } }).select(
    "name email avatar",
  );

  res.status(StatusCodes.OK).json({ users: blockedUsers });
};   
