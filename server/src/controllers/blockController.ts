import type { Request, Response } from "express";
import { Types } from "mongoose";
import { Block } from "../models/Block.js";
import { User } from "../models/User.js";
import { StatusCodes } from "http-status-codes";
import { CustomError } from "../utils/customError.js";

export const blockUser = async (req: Request, res: Response) => {
  const blockerId = req.user?._id;
  const { id: blockedId } = req.params;

  if (!blockerId) {
    throw new CustomError("unauthorized", StatusCodes.UNAUTHORIZED);
  }

  if (typeof blockedId !== "string" || Types.ObjectId.isValid(blockedId)) {
    throw new CustomError("invalid user id", StatusCodes.BAD_REQUEST);
  }

  const blockedObjectId = new Types.ObjectId(blockedId);

  if (blockerId.equals(blockedId)) {
    throw new CustomError("you cannot block yourself", StatusCodes.BAD_REQUEST);
  }

  // upsert-style: ignore if already blocked, rather than erroring
  await Block.updateOne(
    { blockerId, blockedId: blockedObjectId },
    { $setOnInsert: { blockerId, blockedId: blockedObjectId } },
    { upsert: true },
  );

  res.status(StatusCodes.OK).json({ message: "user blocked" });
};

export const unblockUser = async (req: Request, res: Response) => {
  const blockerId = req.user?._id;
  const { id: blockedId } = req.params;

  if (!blockerId) {
    throw new CustomError("unauthorized", StatusCodes.UNAUTHORIZED);
  }

  if (typeof blockedId !== "string" || Types.ObjectId.isValid(blockedId)) {
    throw new CustomError("invalid user id", StatusCodes.BAD_REQUEST);
  }

  await Block.deleteOne({
    blockerId,
    blockedId: new Types.ObjectId(blockedId),
  });

  res.status(StatusCodes.OK).json({ message: "user unblocked" });
};

export const getBlockedUsers = async (req: Request, res: Response) => {
  const blockerId = req.user?._id;

  if (!blockerId) {
    throw new CustomError("unauthorized", StatusCodes.UNAUTHORIZED);
  }

  const blocks = await Block.find({ blockerId }).select("blockedId");
  const blockedIds = blocks.map((b) => b.blockedId);

  const blockedUsers = await Block.find({ _id: { $in: blockedIds } }).select(
    "_id name email avatar",
  );

  res.status(StatusCodes.OK).json({ users: blockedUsers });
};
