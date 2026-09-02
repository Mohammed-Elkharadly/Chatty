import { getSocketsForUser, io, onlineUsers } from "../config/socket.js";
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

// searches for users by name, email, or phone (excludes self, max 10 results)
export const searchUsers = async (req: Request, res: Response) => {
  // my _id (set by auth middleware)
  const loggedInUserId = req.user?._id;
  // the search term the client sent (e.g. "john", "+123")
  const query = req.query.query as string;

  // no user logged in → reject
  if (!loggedInUserId) {
    throw new CustomError(
      "Unauthorized: User not logged in",
      StatusCodes.UNAUTHORIZED,
    );
  }

  // no search term sent → return empty (not an error, just nothing to search)
  if (!query || typeof query !== "string") {
    res.status(StatusCodes.OK).json({ contacts: [] });
    return;
  }

  // find users matching the query on name, email, or phone (case-insensitive)
  // excludes me, caps at 10 results, hides password
  const filteredUsers = await User.find({
    _id: { $ne: loggedInUserId },
    $or: [
      { name: { $regex: query, $options: "i" } },
      { email: { $regex: query, $options: "i" } },
      { phone: { $regex: query, $options: "i" } },
    ],
  })
    .select("-password")
    .limit(10);

  // no matches → return empty array early
  if (filteredUsers?.length === 0) {
    res.status(StatusCodes.OK).json({ contacts: [] });
    return;
  }
  // remove anyone you've blocked or who blocked you
  const [blockedByMe, blockedMe] = await Promise.all([
    Block.find({ blockerId: loggedInUserId }).select("blockedId"),
    Block.find({ blockedId: loggedInUserId }).select("blockerId"),
  ]);
  const excludedIds = [
    ...blockedByMe.map((b) => b.blockedId),
    ...blockedMe.map((b) => b.blockerId),
  ];
  const visibleContacts = filteredUsers.filter(
    (u) => !excludedIds.some((id) => id.equals(u._id)),
  );
  // send the matched users back to the client
  res.status(StatusCodes.OK).json({ contacts: visibleContacts });
};

// gets all messages between me and another user (the 1:1 conversation history)
export const getMessageByUserId = async (req: Request, res: Response) => {
  // my _id (set by auth middleware)
  const loggedInUserId = req.user?._id;
  if (!loggedInUserId) {
    throw new CustomError(
      "Unauthorized: User not logged in",
      StatusCodes.UNAUTHORIZED,
    );
  }

  // the other person's _id (from URL param)
  const { id: otherUserId } = req.params;

  // make sure it's a real ObjectId before querying
  if (typeof otherUserId !== "string" || !Types.ObjectId.isValid(otherUserId)) {
    throw new CustomError("Invalid user ID format", StatusCodes.BAD_REQUEST);
  }

  // convert both string IDs to ObjectId for the query
  const senderObjectId = new Types.ObjectId(loggedInUserId);
  const receiverObjectId = new Types.ObjectId(otherUserId);

  // match messages in EITHER direction (I sent to them OR they sent to me)
  const filter: QueryFilter<MessageDocument> = {
    $or: [
      { senderId: senderObjectId, receiverId: receiverObjectId },
      { senderId: receiverObjectId, receiverId: senderObjectId },
    ],
  };

  // fetch all messages in this conversation, oldest first (chronological order)
  const messages = await Message.find(filter).sort({ createdAt: 1 });

  // no messages yet → return empty (not an error, just a new conversation)
  if (messages?.length === 0) {
    res.status(StatusCodes.OK).json({ messages: [] });
    return;
  }

  // send the conversation back to the client
  res.status(StatusCodes.OK).json({ messages });
};

// sends a 1:1 message (text and/or attachment) to another user
export const sendMessage = async (req: Request, res: Response) => {
  // the text body (optional if there's an attachment)
  const { content } = req.body;
  // the uploaded file (set by Multer's upload.single middleware)
  const file = req.file;

  // must have either text or a file (or both)
  if (!content && !file) {
    throw new CustomError(
      "Message must contain a content or an image",
      StatusCodes.BAD_REQUEST,
    );
  }

  // the recipient's _id (from URL param)
  const { id } = req.params;

  // validate it's a real string (Express can sometimes give arrays for repeated params)
  if (!id || Array.isArray(id)) {
    throw new CustomError("Receiver ID is required", StatusCodes.BAD_REQUEST);
  }
  // validate it's a valid ObjectId format
  if (!Types.ObjectId.isValid(id)) {
    throw new CustomError(
      "Invalid receiver ID format",
      StatusCodes.BAD_REQUEST,
    );
  }
  // convert string → ObjectId for the query
  const receiverId = new Types.ObjectId(id);

  // my _id (set by auth middleware)
  const senderId = req.user?._id;
  if (!senderId) {
    throw new CustomError(
      "Unauthorized: User not logged in",
      StatusCodes.UNAUTHORIZED,
    );
  }

  // can't message yourself
  if (senderId.equals(receiverId)) {
    throw new CustomError(
      "Cannot send message to yourself",
      StatusCodes.BAD_REQUEST,
    );
  }

  // make sure the recipient actually exists
  const receiverExists = await User.exists({ _id: receiverId });
  if (!receiverExists) {
    throw new CustomError("Receiver not found", StatusCodes.NOT_FOUND);
  }

  // check if either user has blocked the other → refuse to send
  const isBlocked = await Block.exists({
    $or: [
      { blockerId: senderId, blockedId: receiverId }, // I blocked them
      { blockerId: receiverId, blockedId: senderId }, // they blocked me
    ],
  });
  if (isBlocked) {
    throw new CustomError(
      "unable to send a message to this user",
      StatusCodes.FORBIDDEN,
    );
  }

  // will hold the attachment metadata if a file was uploaded
  let attachment: MessageDocument["attachment"];

  if (file) {
    // check the MIME type is in our whitelist
    const attachmentType = getAttachmentType(file.mimetype);
    if (!attachmentType) {
      throw new CustomError("Unsupported file type", StatusCodes.BAD_REQUEST);
    }

    try {
      const uploadResult = await uploadBufferToCloudinary(file.buffer, {
        folder: `Chatty/messages/${attachmentType}`,
        resourceType: "auto",
      });
      attachment = {
        url: uploadResult.secure_url,
        publicId: uploadResult.public_id,
        type: attachmentType,
        mimeType: file.mimetype,
        fileName: file.originalname,
        fileSize: file.size,
      };
    } catch (error) {
      throw new CustomError(
        "Failed to upload attachment",
        StatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // build + save the message document
  const newMessage = new Message({
    senderId,
    receiverId,
    status: "sent",
    content,
    attachment,
  });
  await newMessage.save();

  // populate both sender and receiver so the client gets names/avatars without extra requests
  const populateMessage = await Message.populate(newMessage, [
    { path: "senderId", select: "name email avatar" },
    { path: "receiverId", select: "name email avatar" },
  ]);

  // if the recipient is online, push the message to their open tabs in real-time
  // getSocketsForUser returns an array, not a single string
  const receiverSockets = getSocketsForUser(receiverId.toString());
  receiverSockets.forEach((socketId) =>
    io.to(socketId).emit("message:new", populateMessage),
  );

  // also return it in the HTTP response (the sender's tab gets it immediately)
  res.status(StatusCodes.CREATED).json({ message: populateMessage });
};

// gets the list of users I've chatted with + when the last message was (for sorting)
export const getAllChats = async (req: Request, res: Response) => {
  // my _id (set by auth middleware)
  const loggedInUserId = req.user?._id;
  if (!loggedInUserId) {
    throw new CustomError(
      "Unauthorized: User not logged in",
      StatusCodes.UNAUTHORIZED,
    );
  }

  // aggregation: find unique chat partners + the timestamp of their most recent message
  const chatPartners = await Message.aggregate([
    // only messages where I'm involved
    {
      $match: {
        $or: [{ senderId: loggedInUserId }, { receiverId: loggedInUserId }],
      },
    },
    // figure out who the "other person" is for each message
    {
      $project: {
        chatPartnerId: {
          $cond: {
            if: { $eq: ["$senderId", loggedInUserId] },
            then: "$receiverId",
            else: "$senderId",
          },
        },
        createdAt: 1,
      },
    },
    // collapse to one entry per partner, keeping the most recent timestamp
    {
      $group: {
        _id: "$chatPartnerId",
        lastMessageAt: { $max: "$createdAt" }, // most recent message time with this person
      },
    },
  ]);

  // extract the partner IDs
  const uniqueChatUserIds = chatPartners.map((p) => p._id);

  // fetch the actual user docs
  const chats = await User.find({ _id: { $in: uniqueChatUserIds } }).select(
    "name email avatar",
  );

  // attach lastMessageAt to each user so the client can sort by most recent
  const result = chats.map((user) => ({
    ...user.toObject(),
    lastMessageAt: chatPartners.find((p) => p._id.equals(user._id))
      ?.lastMessageAt,
  }));

  // send back (client sorts by lastMessageAt descending)
  res.status(StatusCodes.OK).json({ chats: result });
};

// marks all messages from a specific user to me as "seen" (triggers the double-checkmark)
export const markAsRead = async (req: Request, res: Response) => {
  // my _id (set by auth middleware)
  const loggedInUserId = req.user?._id;
  // the other person's _id (from URL param — the one whose messages I'm marking as read)
  const { id: senderId } = req.params;

  if (!loggedInUserId) {
    throw new CustomError("Unauthorized", StatusCodes.UNAUTHORIZED);
  }

  // validate it's a real ObjectId
  if (typeof senderId !== "string" || !Types.ObjectId.isValid(senderId)) {
    throw new CustomError("Invalid user ID", StatusCodes.BAD_REQUEST);
  }
  const senderObjectId = new Types.ObjectId(senderId);

  // update all messages they sent me that aren't already "seen" → set status to "seen"
  // $set is required — without it, updateMany replaces the entire document
  await Message.updateMany(
    {
      senderId: senderObjectId,
      receiverId: loggedInUserId,
      status: { $ne: "seen" }, // only target messages not already marked
    },
    { $set: { status: "seen" } },
  );

  // tell the sender's open tabs that their messages were read (so they see the double checkmark)
  // getSocketsForUser returns an array, not a single string
  const senderSockets = getSocketsForUser(senderObjectId.toString());
  senderSockets.forEach((socketId) =>
    io.to(socketId).emit("messages:read", { by: loggedInUserId }),
  );

  res.status(StatusCodes.OK).json({ message: "message marked as read" });
};

// deletes a 1:1 message (only the sender can delete their own)
export const deleteMessage = async (req: Request, res: Response) => {
  // my _id (set by auth middleware)
  const loggedInUserId = req.user?._id;
  // the message to delete (from URL param)
  const { id: messageId } = req.params;

  if (!loggedInUserId) {
    throw new CustomError("Unauthorized", StatusCodes.UNAUTHORIZED);
  }

  // validate it's a real ObjectId
  if (typeof messageId !== "string" || !Types.ObjectId.isValid(messageId)) {
    throw new CustomError("Invalid message ID", StatusCodes.BAD_REQUEST);
  }
  const messageObjectId = new Types.ObjectId(messageId);

  // fetch the message
  const message = await Message.findById(messageObjectId);

  // only the original sender can delete
  if (!message?.senderId.equals(loggedInUserId)) {
    throw new CustomError(
      "Unauthorized to delete this message",
      StatusCodes.UNAUTHORIZED,
    );
  }

  // if there's an attachment, delete the file from Cloudinary too
  if (message.attachment) {
    // map our type to Cloudinary's resource_type (must match what was used at upload)
    const resourceType =
      message.attachment.type === "image"
        ? "image"
        : message.attachment.type === "video"
          ? "video"
          : "raw"; // audio, pdf, document → all "raw"

    try {
      await deleteFromCloudinary(message.attachment.publicId, resourceType);
    } catch (error) {
      // don't fail the request if Cloudinary delete fails — just log it
      console.error("Failed to delete attachment from Cloudinary", error);
    }
  }

  // delete the message doc from MongoDB
  await message.deleteOne();

  // tell the receiver's open tabs to remove this message from their UI
  // getSocketsForUser returns an array
  const receiverSockets = getSocketsForUser(message.receiverId.toString());
  receiverSockets.forEach((socketId) =>
    io.to(socketId).emit("message:delete", { messageId }),
  );

  res.status(StatusCodes.OK).json({ message: "Message Deleted successfully" });
};

// edits a 1:1 message (text and/or replace attachment) — only the sender can edit
export const updateMessage = async (req: Request, res: Response) => {
  // my _id (set by auth middleware)
  const loggedInUserId = req.user?._id;
  // the message to edit (from URL param)
  const { id: messageId } = req.params;
  // new text content (optional — if not sent, keep the old text)
  const { content } = req.body;
  // new attachment file (optional — if not sent, keep the old attachment)
  const file = req.file;

  if (!loggedInUserId) {
    throw new CustomError("Unauthorized", StatusCodes.UNAUTHORIZED);
  }

  // validate it's a real ObjectId
  if (typeof messageId !== "string" || !Types.ObjectId.isValid(messageId)) {
    throw new CustomError("Invalid message ID", StatusCodes.BAD_REQUEST);
  }
  const messageObjectId = new Types.ObjectId(messageId);

  // fetch the message
  const message = await Message.findById(messageObjectId);

  // only the original sender can edit their own message
  if (!message?.senderId.equals(loggedInUserId)) {
    throw new CustomError(
      "Unauthorized to update this message",
      StatusCodes.UNAUTHORIZED,
    );
  }

  // save a reference to the old attachment (needed to delete it from Cloudinary later)
  const previousAttachment = message.attachment;

  // if a new file was sent, upload it and replace the attachment
  if (file) {
    // check the MIME type is in our whitelist
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
        url: uploadResult.secure_url,
        publicId: uploadResult.public_id,
        type: attachmentType,
        mimeType: file.mimetype,
        fileName: file.originalname,
        fileSize: file.size,
      };
    } catch (error) {
      throw new CustomError(
        "Failed to upload attachment",
        StatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // update the text (keep old text if no new content was sent)
  message.content = content ?? message.content;
  await message.save();

  // delete the old file from Cloudinary (only if we replaced it and it existed)
  // done AFTER save so the new file is safe before we remove the old one
  if (file && previousAttachment) {
    const resourceType =
      previousAttachment.type === "image"
        ? "image"
        : previousAttachment.type === "video"
          ? "video"
          : "raw"; // audio, pdf, document

    // fire-and-forget: don't block the response on the delete
    deleteFromCloudinary(previousAttachment.publicId, resourceType).catch(
      (error) => console.error("Failed to delete old attachment:", error),
    );
  }

  // tell the receiver's open tabs the message was edited
  // getSocketsForUser returns an array
  const receiverSockets = getSocketsForUser(message.receiverId.toString());
  receiverSockets.forEach((socketId) => {
    const data = {
      _id: message._id,
      content: message.content,
      attachment: message.attachment,
    };
    io.to(socketId).emit("message:update", data);
  });

  res.status(StatusCodes.OK).json(message);
};
// toggles a user's emoji reaction on a 1:1 message
export const reactToMessage = async (req: Request, res: Response) => {
  // who is reacting (set by auth middleware)
  const loggedInUserId = req.user?._id;
  // which message to react to (from URL)
  const { id: messageId } = req.params;
  // the emoji being sent (from body)
  const { emoji } = req.body;

  if (!loggedInUserId) {
    throw new CustomError("unauthorized", StatusCodes.UNAUTHORIZED);
  }

  // validate the messageId is a real ObjectId
  if (typeof messageId !== "string" || !Types.ObjectId.isValid(messageId)) {
    throw new CustomError("invalid message id", StatusCodes.BAD_REQUEST);
  }

  // emoji must be a non-empty string, max 8 chars
  if (!emoji || typeof emoji !== "string" || emoji.length > 8) {
    throw new CustomError("invalid emoji", StatusCodes.BAD_REQUEST);
  }

  // fetch the message
  const message = await Message.findById(messageId);
  if (!message) {
    throw new CustomError("message not found", StatusCodes.NOT_FOUND);
  }

  // only the sender or receiver can react
  const isParticipant =
    message.senderId.equals(loggedInUserId) ||
    message.receiverId.equals(loggedInUserId);
  if (!isParticipant) {
    throw new CustomError(
      "Not authorized to react to this message",
      StatusCodes.UNAUTHORIZED,
    );
  }

  // find if this user already has a reaction on this message
  const existingIndex = message.reactions?.findIndex((r) =>
    r.userId.equals(loggedInUserId),
  );

  // if they're reacting with the same emoji → toggle off
  const hasSameEmoji =
    existingIndex !== undefined &&
    existingIndex !== -1 &&
    message.reactions?.[existingIndex]?.emoji === emoji;

  // remove existing reaction (covers "replace" and "toggle off")
  if (existingIndex !== undefined && existingIndex !== -1) {
    message.reactions?.splice(existingIndex, 1);
  }

  // re-add if it wasn't a toggle-off (i.e. new emoji or first reaction)
  if (!hasSameEmoji) {
    message.reactions?.push({ userId: loggedInUserId, emoji });
  }

  await message.save();

  // notify the other participant in real-time
  const otherUserId = message.senderId.equals(loggedInUserId)
    ? message.receiverId
    : message.senderId;

  const otherSockets = getSocketsForUser(otherUserId.toString());
  otherSockets.forEach((id) =>
    io.to(id).emit("message:reaction", {
      messageId: message._id,
      reactions: message.reactions,
    }),
  );

  res.status(StatusCodes.OK).json({ reactions: message.reactions });
};
