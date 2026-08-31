import { Schema, model, Types, type HydratedDocument } from "mongoose";
import { ref } from "node:process";

interface IAttachment {
  url: string;
  publicId: string;
  type: "image" | "video" | "audio" | "pdf" | "document";
  mimeType: string;
  fileName: string;
  fileSize: number; // bytes
}

interface IReactions {
  userId: Types.ObjectId;
  emoji: string;
}

interface IMessage {
  senderId: Types.ObjectId;
  receiverId: Types.ObjectId;
  status: "sent" | "delivered" | "seen";
  content?: string;
  attachment?: IAttachment;
  reactions: IReactions[];
}

export type MessageDocument = HydratedDocument<IMessage>;

const attachmentSchema = new Schema<IAttachment>(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    type: {
      type: String,
      enum: ["image", "video", "audio", "pdf", "document"],
      required: true,
    },
    mimeType: { type: String, required: true },
    fileName: { type: String, required: true },
    fileSize: { type: Number, required: true },
  },
  { _id: false }, // embedded subdocument, doesn't need its own _id
);

const reactionSchema = new Schema<IReactions>({
  userId: {
    type: Types.ObjectId,
    ref: "User",
    required: true,
  },
  emoji: {
    type: String,
    required: true,
    maxLength: 8,
  },
});

const messageSchema = new Schema<IMessage>(
  {
    senderId: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiverId: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["sent", "delivered", "seen"],
      default: "sent",
    },
    content: {
      type: String,
      maxLength: 2000,
    },
    attachment: {
      type: attachmentSchema,
      required: false,
    },
    reactions: {
      type: [reactionSchema],
      default: [],
    },
  },
  { timestamps: true },
);

messageSchema.index({ senderId: 1, receiverId: 1, createdAt: 1 });

export const Message = model<IMessage>("Message", messageSchema);
