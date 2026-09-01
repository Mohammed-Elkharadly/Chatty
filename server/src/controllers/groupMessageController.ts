import type { Request, Response } from "express";
import { Types } from "mongoose";
import { StatusCodes } from "http-status-codes";
import { io } from "../config/socket.js";
import { GroupMessage } from "../models/GroupMessage.js";
import { GroupMember } from "../models/GroupMember.js";
import { CustomError } from "../utils/customError.js";
import { getAttachmentType } from "../middleware/upload.js";
import {
  uploadBufferToCloudinary,
  deleteFromCloudinary,
} from "../utils/cloudinaryUpload.js";

// builds the Socket.IO room name for a group (matches the room name used in config/socket.ts)
const groupRoom = (groupId: string) => `group:${groupId}`;

// shared guard: throws 403 if the user is NOT a member of the group
// used by every group message action (send, react, mark read, etc.)
const assertIsMember = async (groupId: string, userId: Types.ObjectId) => {
  // check if a membership record exists for this user in this group
  const isMember = await GroupMember.exists({ groupId, userId });
  // not a member → reject
  if (!isMember) {
    throw new CustomError("Not a member of this group", StatusCodes.FORBIDDEN);
  }
};

// handles: POST /api/groups/:id/messages — sends a text and/or attachment message to a group
export const sendGroupMessage = async (req: Request, res: Response) => {
  // the sender's _id (from verifyJwt middleware)
  const senderId = req.user?._id;
  // the target group (from URL param)
  const { id: groupId } = req.params;
  // optional text body
  const { content } = req.body;
  // optional uploaded file (from upload.single("file") middleware)
  const file = req.file;

  // no authenticated user → reject
  if (!senderId) {
    throw new CustomError("Unauthorized", StatusCodes.UNAUTHORIZED);
  }
  // validate the group ID is a real ObjectId
  if (typeof groupId !== "string" || !Types.ObjectId.isValid(groupId)) {
    throw new CustomError("Invalid group ID", StatusCodes.BAD_REQUEST);
  }
  // must have either text or a file (or both)
  if (!content && !file) {
    throw new CustomError(
      "Message must contain content or an attachment",
      StatusCodes.BAD_REQUEST,
    );
  }

  // confirm the sender is a member of this group (403 if not)
  await assertIsMember(groupId, senderId);

  // will hold the attachment metadata if a file was uploaded
  let attachment: InstanceType<typeof GroupMessage>["attachment"];

  // --- ATTACHMENT UPLOAD ---
  if (file) {
    // check the file's MIME type is in our whitelist (image, video, audio, pdf, document)
    const attachmentType = getAttachmentType(file.mimetype);
    // not a recognized type → reject
    if (!attachmentType) {
      throw new CustomError("Unsupported file type", StatusCodes.BAD_REQUEST);
    }
    // upload the file to Cloudinary
    try {
      const uploadResult = await uploadBufferToCloudinary(file.buffer, {
        folder: `chat-app/group-messages/${attachmentType}`, // organize by type in Cloudinary
        resourceType: "auto", // let Cloudinary detect image/video/raw
      });
      // store the metadata we need (URL for display, publicId for deletion, etc.)
      attachment = {
        url: uploadResult.secure_url,
        publicId: uploadResult.public_id,
        type: attachmentType,
        mimeType: file.mimetype,
        fileName: file.originalname,
        fileSize: file.size,
      };
    } catch (error) {
      // Cloudinary is down or rejected the file
      throw new CustomError(
        "Failed to upload attachment",
        StatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // build the message document in memory
  const message = new GroupMessage({
    groupId,
    senderId,
    content,
    attachment,
    // the sender has implicitly "read" their own message (so they don't see an unread badge)
    readBy: [{ userId: senderId, readAt: new Date() }],
  });

  // pre-populate the sender's public fields so the response + socket emit include name/avatar
  // without requiring the client to make a separate "get user" request
  const populated = await message.populate("senderId", "_id name email avatar");

  // write to MongoDB
  await message.save();

  // emit to the group's Socket.IO room — reaches every online member's open tabs in one call
  // (no manual loop over onlineUsers needed; Socket.IO handles fan-out)
  io.to(groupRoom(groupId)).emit("group:message:new", populated);

  // respond with 201 + the populated message (sender gets it immediately without waiting for socket)
  res.status(StatusCodes.CREATED).json({ message: populated });
};

// handles: GET /api/groups/:id/messages?before=<messageId>&limit=50
export const getGroupMessages = async (req: Request, res: Response) => {
  const userId = req.user?._id;
  const { id: groupId } = req.params;
  // optional: the _id of the oldest message the client already has (fetch older than this)
  const { before } = req.query;
  // max messages to return (default 50, cap at 100)
  const limit = Math.min(Number(req.query.limit) || 50, 100);

  if (!userId) {
    throw new CustomError("Unauthorized", StatusCodes.UNAUTHORIZED);
  }
  if (typeof groupId !== "string" || !Types.ObjectId.isValid(groupId)) {
    throw new CustomError("Invalid group ID", StatusCodes.BAD_REQUEST);
  }

  await assertIsMember(groupId, userId);

  // build the query: all messages in this group, optionally older than the cursor
  const query: Record<string, unknown> = { groupId };
  if (before && Types.ObjectId.isValid(before as string)) {
    query._id = { $lt: new Types.ObjectId(before as string) };
  }

  const messages = await GroupMessage.find(query)
    .sort({ _id: -1 }) // _id is time-ordered in Mongo — same as createdAt: -1 but indexed
    .limit(limit)
    .populate("senderId", "name email avatar");

  // hasMore = true if there might be older messages to fetch
  const hasMore = messages.length === limit;

  res.status(StatusCodes.OK).json({ messages, hasMore });
};

// handles: POST /api/groups/:id/messages/read — marks all unread messages in the group as read by the caller
export const markGroupMessagesRead = async (req: Request, res: Response) => {
  // the user marking messages as read (from verifyJwt middleware)
  const userId = req.user?._id;
  // the group they're reading (from URL param)
  const { id: groupId } = req.params;

  // no authenticated user → reject
  if (!userId) {
    throw new CustomError("Unauthorized", StatusCodes.UNAUTHORIZED);
  }
  // validate the group ID is a real ObjectId
  if (typeof groupId !== "string" || !Types.ObjectId.isValid(groupId)) {
    throw new CustomError("Invalid group ID", StatusCodes.BAD_REQUEST);
  }

  // confirm the user is a member of this group (403 if not)
  await assertIsMember(groupId, userId);

  //  update: for every message in this group where the user is NOT already in readBy,
  // push their read receipt onto the readBy array
  // "readBy.userId": { $ne: userId } → only targets messages they haven't read yet
  // $push appends { userId, readAt } to the readBy array (won't duplicate since we filtered)
  // only mark the last 200 messages as read (user is unlikely to read 10k messages at once)
  const recentMessages = await GroupMessage.find({
    groupId,
    "readBy.userId": { $ne: userId },
  })
    .sort({ createdAt: -1 })
    .limit(200)
    .select("_id");

  if (recentMessages.length) {
    await GroupMessage.updateMany(
      { _id: { $in: recentMessages.map((m) => m._id) } },
      { $push: { readBy: { userId, readAt: new Date() } } },
    );
  }

  // tell the other members in the room that this user has read their messages
  // (so they can update the "seen" checkmarks on their sent messages)
  io.to(groupRoom(groupId)).emit("group:messages:read", {
    groupId,
    by: userId, // which user just marked as read
  });

  // respond with 200
  res.status(StatusCodes.OK).json({ message: "Marked as read" });
};

// handles: POST /api/groups/:id/messages/:messageId/reaction — toggles a user's emoji reaction on a group message
// (same emoji = remove reaction, different emoji = switch reaction)
export const reactToGroupMessage = async (req: Request, res: Response) => {
  // the user reacting (from verifyJwt middleware)
  const userId = req.user?._id;
  // the group + the message being reacted to (from URL params)
  const { id: groupId, messageId } = req.params;
  // the emoji the user is reacting with
  const { emoji } = req.body;

  // no authenticated user → reject
  if (!userId) {
    throw new CustomError("Unauthorized", StatusCodes.UNAUTHORIZED);
  }
  // validate the message ID is a real ObjectId
  if (typeof messageId !== "string" || !Types.ObjectId.isValid(messageId)) {
    throw new CustomError("Invalid message ID", StatusCodes.BAD_REQUEST);
  }
  // emoji must be a non-empty string, max 8 chars (covers ZWJ sequences)
  if (!emoji || typeof emoji !== "string" || emoji.length > 8) {
    throw new CustomError("Invalid emoji", StatusCodes.BAD_REQUEST);
  }
  // validate the group ID is a real ObjectId
  if (typeof groupId !== "string" || !Types.ObjectId.isValid(groupId)) {
    throw new CustomError("Invalid group ID", StatusCodes.BAD_REQUEST);
  }

  // confirm the user is a member of this group (403 if not)
  await assertIsMember(groupId, userId);

  // fetch the message (must belong to this group — prevents cross-group reactions)
  const message = await GroupMessage.findOne({ _id: messageId, groupId });
  // message doesn't exist or doesn't belong to this group
  if (!message) {
    throw new CustomError("Message not found", StatusCodes.NOT_FOUND);
  }

  // find the index of this user's existing reaction (if any)
  const existingIndex = message.reactions?.findIndex((r) =>
    r.userId.equals(userId),
  );

  // check if they're reacting with the SAME emoji they already used (→ toggle off)
  const hadSameEmoji =
    existingIndex !== undefined &&
    existingIndex !== -1 &&
    message.reactions?.[existingIndex]?.emoji === emoji;

  // if they already have a reaction → remove it (we'll re-add below if it's a different emoji)
  if (existingIndex !== undefined && existingIndex !== -1) {
    message.reactions?.splice(existingIndex, 1);
  }

  // if it's NOT the same emoji (new reaction or switching emoji) → add it
  // if it IS the same emoji → skip (effectively "un-react")
  if (!hadSameEmoji) {
    message.reactions?.push({ userId, emoji });
  }

  // persist the change
  await message.save();

  // notify all members in the room so their UI updates in real-time
  io.to(groupRoom(groupId)).emit("group:message:reaction", {
    messageId: message._id,
    reactions: message.reactions, // full updated array (simpler for the client to replace)
  });

  // respond with 200 + the updated reactions array
  res.status(StatusCodes.OK).json({ reactions: message.reactions });
};

// handles: DELETE /api/groups/:id/messages/:messageId — deletes a group message (only the sender can delete their own)
export const deleteGroupMessage = async (req: Request, res: Response) => {
  // the user requesting deletion (from verifyJwt middleware)
  const userId = req.user?._id;
  // the group + the message to delete (from URL params)
  const { id: groupId, messageId } = req.params;

  // no authenticated user → reject
  if (!userId) {
    throw new CustomError("Unauthorized", StatusCodes.UNAUTHORIZED);
  }

  // validate the message ID is a real ObjectId
  if (typeof messageId !== "string" || !Types.ObjectId.isValid(messageId)) {
    throw new CustomError("Invalid message ID", StatusCodes.BAD_REQUEST);
  }

  // validate the group ID is a real ObjectId
  if (typeof groupId !== "string" || !Types.ObjectId.isValid(groupId)) {
    throw new CustomError("Invalid group ID", StatusCodes.BAD_REQUEST);
  }

  // fetch the message (must belong to this group — prevents cross-group deletion)
  const message = await GroupMessage.findOne({ _id: messageId, groupId });

  // only the original sender can delete their own message
  // (admin override is a future feature — for now, senders only)
  if (!message?.senderId.equals(userId)) {
    throw new CustomError(
      "Unauthorized to delete this message",
      StatusCodes.UNAUTHORIZED,
    );
  }

  // if the message has an attachment, delete the file from Cloudinary too
  if (message.attachment) {
    // map our attachment type to Cloudinary's resource_type (must match what was used at upload)
    // Cloudinary assigns "raw" to audio/pdf/document files uploaded with resourceType: "auto"
    const resourceType =
      message.attachment.type === "image"
        ? "image"
        : message.attachment.type === "video"
          ? "video"
          : "raw"; // audio, pdf, document → all "raw" in Cloudinary

    try {
      // remove the file from Cloudinary storage
      await deleteFromCloudinary(message.attachment.publicId, resourceType);
    } catch (error) {
      // don't fail the whole request if Cloudinary delete fails — just log it
      // (the message is still deleted from DB; the orphaned file can be cleaned up later)
      console.error("Failed to delete attachment from Cloudinary:", error);
    }
  }

  // delete the message document from MongoDB
  await message.deleteOne();

  // tell everyone in the group room that this message was deleted (so they remove it from their UI)
  io.to(groupRoom(String(groupId))).emit("group:message:delete", { messageId });

  // respond with 200
  res.status(StatusCodes.OK).json({ message: "Message deleted" });
};
