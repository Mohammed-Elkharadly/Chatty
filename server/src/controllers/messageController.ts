import { io, onlineUsers } from "../config/socket.js";
import type { Request, Response } from "express";
import { type QueryFilter, Types } from "mongoose";
import type { MessageDocument } from "../models/Message.js";
import { Message } from "../models/Message.js";
import { User } from "../models/User.js";
import { CustomError } from "../utils/customError.js";
import { StatusCodes } from "http-status-codes";
import {
  uploadBufferToCloudinary,
  deleteFromCloudinary,
} from "../utils/cloudinaryUpload.js";
import { getAttachmentType } from "../middleware/upload.js";
import { Block } from "../models/Block.js";

export const searchUsers = async (req: Request, res: Response) => {
  // get the logged in user id from the request object (set by the authentication middleware)
  const loggedInUserId = req.user?._id;
  const query = req.query.query as string;

  if (!loggedInUserId) {
    throw new CustomError(
      "Unauthorized: User not logged in",
      StatusCodes.UNAUTHORIZED,
    );
  }

  if (!query || typeof query !== "string") {
    res.status(StatusCodes.OK).json({ users: [] });
    return;
  }
  // find all users except the logged in user and exclude the password field
  const filteredUsers = await User.find({
    _id: { $ne: loggedInUserId }, // exclude the logged in user from the results
    $or: [
      { name: { $regex: query, $options: "i" } },
      { email: { $regex: query, $options: "i" } },
    ],
  })
    .select("-password")
    .limit(10);

  // if no contacts are found, return an empty array
  if (filteredUsers?.length === 0) {
    res.status(StatusCodes.OK).json({ contacts: [] });
    return;
  }
  // return the filtered users as contacts
  res.status(StatusCodes.OK).json({ users: filteredUsers });
};

export const getMessageByUserId = async (req: Request, res: Response) => {
  // get the logged in user id from the request object (set by the authentication middleware)
  const loggedInUserId = req.user?._id;
  if (!loggedInUserId) {
    throw new CustomError(
      "Unauthorized: User not logged in",
      StatusCodes.UNAUTHORIZED,
    );
  }
  // get the user id from the request parameters
  const { id: otherUserId } = req.params;
  // Validate first: check if it's a string and valid ObjectId format
  if (typeof otherUserId !== "string" || !Types.ObjectId.isValid(otherUserId)) {
    throw new CustomError("Invalid user ID format", StatusCodes.BAD_REQUEST);
  }
  // convert the user id to a mongoose ObjectId
  const senderObjectId = new Types.ObjectId(loggedInUserId);
  const receiverObjectId = new Types.ObjectId(otherUserId);

  // QueryFilter is a type that represents the filter object used in Mongoose queries
  const filter: QueryFilter<MessageDocument> = {
    // $or means either of the conditions can be true
    $or: [
      { senderId: senderObjectId, receiverId: receiverObjectId },
      { senderId: receiverObjectId, receiverId: senderObjectId },
    ],
  };
  // find all messages between the logged in user and the other user, sorted by creation date
  const messages = await Message.find(filter).sort({ createdAt: 1 });

  if (messages?.length === 0) {
    // Return empty array if no conversation exists yet between the users
    res.status(StatusCodes.OK).json({ messages: [] });
    return;
  }
  // return the messages as a response
  res.status(StatusCodes.OK).json({ messages });
};

export const sendMessage = async (req: Request, res: Response) => {
  // extract content and image from the request body 'destructuring'
  const { content } = req.body;
  const file = req.file; // populated by Multer if a file was sent

  if (!content && !file) {
    throw new CustomError(
      "Message must contain a content or an image",
      StatusCodes.BAD_REQUEST,
    );
  }

  // extract receiverId from the request parameters
  const { id } = req.params;

  // Type guard: ensure it's a string
  if (!id || Array.isArray(id)) {
    throw new CustomError("Receiver ID is required", StatusCodes.BAD_REQUEST);
  }

  if (!Types.ObjectId.isValid(id)) {
    throw new CustomError(
      "Invalid receiver ID format",
      StatusCodes.BAD_REQUEST,
    );
  }

  // convert to ObjectId
  const receiverId = new Types.ObjectId(id);

  // get the logged in user id from the request object (set by the authentication middleware)
  const senderId = req.user?._id;

  if (!senderId) {
    throw new CustomError(
      "Unauthorized: User not logged in",
      StatusCodes.UNAUTHORIZED,
    );
  }

  if (senderId.equals(receiverId)) {
    throw new CustomError(
      "Cannot send message to yourself",
      StatusCodes.BAD_REQUEST,
    );
  }

  // verify reveiver exist
  const receiverExists = await User.exists({ _id: receiverId });
  if (!receiverExists) {
    throw new CustomError("Receiver not found", StatusCodes.NOT_FOUND);
  }

  const isBlocked = await Block.exists({
    $or: [
      { blockerId: senderId, blockedId: receiverId },
      { blockerId: receiverId, blockedId: senderId },
    ],
  });

  if (isBlocked) {
    throw new CustomError(
      "unable to send a message to this user",
      StatusCodes.FORBIDDEN,
    );
  }

  let attachment: MessageDocument["attachment"];

  if (file) {
    const attachmentType = getAttachmentType(file.mimetype);
    // fileFilter in Multer should already block this, but double-check
    if (!attachmentType) {
      throw new CustomError("Unsupported file type", StatusCodes.BAD_REQUEST);
    }

    try {
      const uploadResult = await uploadBufferToCloudinary(file.buffer, {
        folder: `Chatty/messages/${attachment}`,
        resourceType: "auto",
      });

      attachment = {
        url: uploadResult.url,
        publicId: uploadResult.public_id,
        type: attachmentType,
        mimeType: file.mimetype,
        fileName: file.originalname,
        fileSize: file.size,
      };
    } catch (error) {
      throw new CustomError(
        "Failed to upload attachment",
        StatusCodes.BAD_REQUEST,
      );
    }
  }

  // create a new message document in the DB
  const newMessage = new Message({
    senderId,
    receiverId,
    status: "sent",
    content,
    attachment,
  });
  await newMessage.save();

  const populateMessage = await Message.populate(newMessage, [
    {
      path: "senderId", // The field name in the message
      select: "_id name email avatar", // only return the specified feilds
    },
    {
      path: "receiverId", // The field name in the message
      select: "_id name email avatar", // only return the specified feilds
    },
  ]);

  // emit to receiver if online
  const receiverSocketId = onlineUsers.get(receiverId.toString());
  if (receiverSocketId) {
    io.to(receiverSocketId).emit("message:new", populateMessage);
  }
  // return the created message as a response
  res.status(StatusCodes.CREATED).json({ message: populateMessage });
};

export const getAllChats = async (req: Request, res: Response) => {
  // get the logged in user id from the request object (set by the authentication middleware)
  const loggedInUserId = req.user?._id;
  if (!loggedInUserId) {
    throw new CustomError(
      "Unauthorized: User not logged in",
      StatusCodes.UNAUTHORIZED,
    );
  }

  // Use aggregation to get unique chat partner IDs efficiently
  const chatPartners = await Message.aggregate([
    {
      $match: {
        $or: [{ senderId: loggedInUserId }, { receiverId: loggedInUserId }],
      },
    },
    {
      $project: {
        chatPartnerId: {
          $cond: {
            if: { $eq: ["$senderId", loggedInUserId] },
            then: "$receiverId",
            else: "$senderId",
          },
        },
      },
    },
    { $group: { _id: "$chatPartnerId" } },
  ]);

  const uniqueChatUserIds = chatPartners.map((p) => p._id);

  const chats = await User.find({ _id: { $in: uniqueChatUserIds } }).select(
    "-password",
  );
  res.status(StatusCodes.OK).json(chats);
};

export const markAsRead = async (req: Request, res: Response) => {
  const loggedInUserId = req.user?._id;
  const { id: senderId } = req.params;

  if (!loggedInUserId) {
    throw new CustomError("Unauthorized", StatusCodes.UNAUTHORIZED);
  }

  if (typeof senderId !== "string" || !Types.ObjectId.isValid(senderId)) {
    throw new CustomError("Invalid user ID", StatusCodes.BAD_REQUEST);
  }

  const senderObjectId = new Types.ObjectId(senderId);

  // mark all messages from senderId to loggedInUserId as read
  await Message.updateMany(
    {
      senderId: senderObjectId,
      receiverId: loggedInUserId,
      status: { $ne: "seen" },
    },
    { status: "seen" },
  );

  // emit to sender that their message were read
  const senderSocketId = onlineUsers.get(senderObjectId.toString());
  if (senderSocketId) {
    io.to(senderSocketId).emit("messages:read", { by: loggedInUserId });
  }
  res.status(StatusCodes.OK).json({ message: "message marked as read" });
};

export const deleteMessage = async (req: Request, res: Response) => {
  const loggedInUserId = req.user?._id;
  const { id: messageId } = req.params;

  if (!loggedInUserId) {
    throw new CustomError("Unauthorized", StatusCodes.UNAUTHORIZED);
  }

  if (typeof messageId !== "string" || !Types.ObjectId.isValid(messageId)) {
    throw new CustomError("Invalid message ID", StatusCodes.BAD_REQUEST);
  }

  const messageObjectId = new Types.ObjectId(messageId);

  const message = await Message.findById(messageObjectId);

  if (!message?.senderId.equals(loggedInUserId)) {
    throw new CustomError(
      "Unauthorized to delete this message",
      StatusCodes.UNAUTHORIZED,
    );
  }

  if (message.attachment) {
    const resourceType =
      message.attachment.type === "image"
        ? "image"
        : message.attachment.type === "video" ||
            message.attachment.type === "audio"
          ? "video" // Cloudinary treats audio under the "video" resource type
          : "raw"; // pdf
    try {
      await deleteFromCloudinary(message.attachment.publicId, resourceType);
    } catch (error) {
      console.error("Failed to delete attachment from Cloudinary", error);
    }
  }

  await message.deleteOne();

  // notify receiver if online
  const receiverSocketId = onlineUsers.get(message.receiverId.toString());
  if (receiverSocketId) {
    io.to(receiverSocketId).emit("message:delete", { messageId });
  }
  res.status(StatusCodes.OK).json({ message: "Message Deleted successfully" });
};

export const updateMessage = async (req: Request, res: Response) => {
  const loggedInUserId = req.user?._id;
  const { id: messageId } = req.params;
  const { content } = req.body;
  const file = req.file;

  if (!loggedInUserId) {
    throw new CustomError("Unauthorized", StatusCodes.UNAUTHORIZED);
  }

  if (typeof messageId !== "string" || !Types.ObjectId.isValid(messageId)) {
    throw new CustomError("Invalid message ID", StatusCodes.BAD_REQUEST);
  }

  const messageObjectId = new Types.ObjectId(messageId);

  const message = await Message.findById(messageObjectId);

  if (!message?.senderId.equals(loggedInUserId)) {
    throw new CustomError(
      "Unauthorized to update this message",
      StatusCodes.UNAUTHORIZED,
    );
  }

  const previousAttachment = message.attachment;

  if (file) {
    const attachmentType = getAttachmentType(file.mimetype);
    if (!attachmentType) {
      throw new CustomError("Unsupported file type", StatusCodes.BAD_REQUEST);
    }
    try {
      const uploadResult = await uploadBufferToCloudinary(file.buffer, {
        folder: `Chatty/messages/${attachmentType}`,
        resourceType: "auto",
      });
      message.attachment = {
        url: uploadResult.url,
        publicId: uploadResult.public_id,
        type: attachmentType,
        mimeType: file.mimetype,
        fileName: file.originalname,
        fileSize: file.size,
      };
    } catch (error) {
      throw new CustomError(
        "Failed to upload attachment",
        StatusCodes.BAD_REQUEST,
      );
    }
  }

  message.content = content ?? message.content;
  await message.save();

  // clean up the old file only after the new one is safely saved
  if (file && previousAttachment) {
    const resourceType =
      previousAttachment.type === "image"
        ? "image"
        : previousAttachment.type === "video" ||
            previousAttachment.type === "audio"
          ? "video"
          : "raw";
    deleteFromCloudinary(previousAttachment.publicId, resourceType).catch(
      (error) => console.error("Failed to delete old attachment:", error),
    );
  }

  const receiverSocketId = onlineUsers.get(message.receiverId.toString());
  if (receiverSocketId) {
    const data = {
      _id: message._id,
      content: message.content,
      attachment: message.attachment,
    };
    io.to(receiverSocketId).emit("message:update", data);
  }
  res.status(StatusCodes.OK).json(message);
};

export const reactToMessage = async (req: Request, res: Response) => {
  const loggedInUserId = req.user?._id;
  const { id: messageId } = req.params;
  const { emoji } = req.body;

  if (!loggedInUserId) {
    throw new CustomError("unauthorized", StatusCodes.UNAUTHORIZED);
  }

  if (typeof messageId !== "string" || Types.ObjectId.isValid(messageId)) {
    throw new CustomError("invalid message id", StatusCodes.BAD_REQUEST);
  }

  if (!emoji || typeof emoji !== "string" || emoji.length > 8) {
    throw new CustomError("invalid emoji", StatusCodes.BAD_REQUEST);
  }

  const message = await Message.findById(messageId);

  if (!message) {
    throw new CustomError("message not found", StatusCodes.NOT_FOUND);
  }

  const isParticipant =
    message.senderId.equals(loggedInUserId) ||
    message.receiverId.equals(loggedInUserId);

  if (!isParticipant) {
    throw new CustomError(
      "Not authorized to react to this message",
      StatusCodes.UNAUTHORIZED,
    );
  }

  const existingIndex = message.reactions?.findIndex((r) =>
    r.userId.equals(loggedInUserId),
  );

  const hasSameEmoji =
    existingIndex !== undefined &&
    existingIndex !== -1 &&
    message.reactions?.[existingIndex]?.emoji === "emoji";

  // remove any existing reaction from this user first (covers both the
  // "replace" and "toggle off" cases)
  if (existingIndex !== undefined && existingIndex !== -1) {
    message.reactions?.splice(existingIndex, 1);
  }

  // only add the new one back if it wasn't a toggle-off
  if (!hasSameEmoji) {
    message.reactions?.push({ userId: loggedInUserId, emoji });
  }

  await message.save();

  // notify whichever participant didn't perform this action
  const otherUserId = message.senderId.equals(loggedInUserId)
    ? message.receiverId
    : message.senderId;
  
  const otherSocketId = onlineUsers.get(otherUserId.toString());

  if(otherSocketId) {
    io.to(otherSocketId).emit("message:reaction", {
      messageId: message._id,
      reactions: message.reactions,
    })
  }

  res.status(StatusCodes.OK).json({ reactions: message.reactions });
};
