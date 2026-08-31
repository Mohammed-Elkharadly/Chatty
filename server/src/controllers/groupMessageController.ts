import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { StatusCodes } from 'http-status-codes';
import { io } from '../config/socket.js';
import { GroupMessage } from '../models/GroupMessage.js';
import { GroupMember } from '../models/GroupMember.js';
import { CustomError } from '../utils/customError.js';
import { getAttachmentType } from '../middleware/upload.js';
import { uploadBufferToCloudinary, deleteFromCloudinary } from '../utils/cloudinaryUpload.js';

const groupRoom = (groupId: string) => `group:${groupId}`;

// small shared helper — every group message action needs this check
const assertIsMember = async (groupId: string, userId: Types.ObjectId) => {
  const isMember = await GroupMember.exists({ groupId, userId });
  if (!isMember) {
    throw new CustomError('Not a member of this group', StatusCodes.FORBIDDEN);
  }
};

export const sendGroupMessage = async (req: Request, res: Response) => {
  const senderId = req.user?._id;
  const { id: groupId } = req.params;
  const { content } = req.body;
  const file = req.file;

  if (!senderId) {
    throw new CustomError('Unauthorized', StatusCodes.UNAUTHORIZED);
  }
  if (typeof groupId !== 'string' || !Types.ObjectId.isValid(groupId)) {
    throw new CustomError('Invalid group ID', StatusCodes.BAD_REQUEST);
  }
  if (!content && !file) {
    throw new CustomError(
      'Message must contain content or an attachment',
      StatusCodes.BAD_REQUEST,
    );
  }

  await assertIsMember(groupId, senderId);

  let attachment: InstanceType<typeof GroupMessage>['attachment'];
  if (file) {
    const attachmentType = getAttachmentType(file.mimetype);
    if (!attachmentType) {
      throw new CustomError('Unsupported file type', StatusCodes.BAD_REQUEST);
    }
    try {
      const uploadResult = await uploadBufferToCloudinary(file.buffer, {
        folder: `chat-app/group-messages/${attachmentType}`,
        resourceType: 'auto',
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
      throw new CustomError('Failed to upload attachment', StatusCodes.BAD_REQUEST);
    }
  }

  const message = new GroupMessage({
    groupId,
    senderId,
    content,
    attachment,
    readBy: [{ userId: senderId, readAt: new Date() }], // sender has implicitly "read" their own message
  });

  const populated = await message.populate('senderId', '_id name email avatar');

  await message.save();

  // one emit reaches every online member in the room — no manual loop
  // over onlineUsers needed, this is what scales as groups grow
  io.to(groupRoom(groupId)).emit('group:message:new', populated);

  res.status(StatusCodes.CREATED).json({ message: populated });
};

export const getGroupMessages = async (req: Request, res: Response) => {
  const userId = req.user?._id;
  const { id: groupId } = req.params;

  if (!userId) {
    throw new CustomError('Unauthorized', StatusCodes.UNAUTHORIZED);
  }
  if (typeof groupId !== 'string' || !Types.ObjectId.isValid(groupId)) {
    throw new CustomError('Invalid group ID', StatusCodes.BAD_REQUEST);
  }

  await assertIsMember(groupId, userId);

  const messages = await GroupMessage.find({ groupId })
    .sort({ createdAt: 1 })
    .populate('senderId', '_id name email avatar');

  res.status(StatusCodes.OK).json({ messages });
};

// Marks every not-yet-read message in the group as read by the caller.
export const markGroupMessagesRead = async (req: Request, res: Response) => {
  const userId = req.user?._id;
  const { id: groupId } = req.params;

  if (!userId) {
    throw new CustomError('Unauthorized', StatusCodes.UNAUTHORIZED);
  }
  if (typeof groupId !== 'string' || !Types.ObjectId.isValid(groupId)) {
    throw new CustomError('Invalid group ID', StatusCodes.BAD_REQUEST);
  }

  await assertIsMember(groupId, userId);

  await GroupMessage.updateMany(
    { groupId, 'readBy.userId': { $ne: userId } },
    { $push: { readBy: { userId, readAt: new Date() } } },
  );

  io.to(groupRoom(groupId)).emit('group:messages:read', { groupId, by: userId });

  res.status(StatusCodes.OK).json({ message: 'Marked as read' });
};

export const reactToGroupMessage = async (req: Request, res: Response) => {
  const userId = req.user?._id;
  const { id: groupId, messageId } = req.params;
  const { emoji } = req.body;

  if (!userId) {
    throw new CustomError('Unauthorized', StatusCodes.UNAUTHORIZED);
  }
  if (typeof messageId !== 'string' || !Types.ObjectId.isValid(messageId)) {
    throw new CustomError('Invalid message ID', StatusCodes.BAD_REQUEST);
  }
  if (!emoji || typeof emoji !== 'string' || emoji.length > 8) {
    throw new CustomError('Invalid emoji', StatusCodes.BAD_REQUEST);
  }
  if (typeof groupId !== 'string' || !Types.ObjectId.isValid(groupId)) {
    throw new CustomError('Invalid group ID', StatusCodes.BAD_REQUEST);
  }

  await assertIsMember(groupId, userId);

  const message = await GroupMessage.findOne({ _id: messageId, groupId });
  if (!message) {
    throw new CustomError('Message not found', StatusCodes.NOT_FOUND);
  }

  const existingIndex = message.reactions?.findIndex((r) => r.userId.equals(userId));
  const hadSameEmoji =
    existingIndex !== undefined &&
    existingIndex !== -1 &&
    message.reactions?.[existingIndex]?.emoji === emoji;

  if (existingIndex !== undefined && existingIndex !== -1) {
    message.reactions?.splice(existingIndex, 1);
  }
  if (!hadSameEmoji) {
    message.reactions?.push({ userId, emoji });
  }

  await message.save();

  io.to(groupRoom(groupId)).emit('group:message:reaction', {
    messageId: message._id,
    reactions: message.reactions,
  });

  res.status(StatusCodes.OK).json({ reactions: message.reactions });
};

export const deleteGroupMessage = async (req: Request, res: Response) => {
  const userId = req.user?._id;
  const { id: groupId, messageId } = req.params;

  if (!userId) {
    throw new CustomError('Unauthorized', StatusCodes.UNAUTHORIZED);
  }

  if (typeof messageId !== 'string' || !Types.ObjectId.isValid(messageId)) {
    throw new CustomError('Invalid message ID', StatusCodes.BAD_REQUEST);
  }

  if (typeof groupId !== 'string' || !Types.ObjectId.isValid(groupId)) {
    throw new CustomError('Invalid message ID', StatusCodes.BAD_REQUEST);
  }

  const message = await GroupMessage.findOne({ _id: messageId, groupId });

  if (!message?.senderId.equals(userId)) {
    throw new CustomError(
      'Unauthorized to delete this message',
      StatusCodes.UNAUTHORIZED,
    );
  }

  if (message.attachment) {
    const resourceType =
      message.attachment.type === 'image'
        ? 'image'
        : message.attachment.type === 'video' || message.attachment.type === 'audio'
          ? 'video'
          : 'raw';
    try {
      await deleteFromCloudinary(message.attachment.publicId, resourceType);
    } catch (error) {
      console.error('Failed to delete attachment from Cloudinary:', error);
    }
  }

  await message.deleteOne();

  io.to(groupRoom(String(groupId))).emit('group:message:delete', { messageId });

  res.status(StatusCodes.OK).json({ message: 'Message deleted' });
};