import { Schema, model, Types, type HydratedDocument } from "mongoose";

interface IAttachment {
  url: string;
  publicId: string;
  type: "image" | "video" | "audio" | "pdf" | "document";
  mimeType: string;
  fileName: string;
  fileSize: number;
}

interface IReaction {
  userId: Types.ObjectId;
  emoji: string;
}

interface IReadReceipt {
  userId: Types.ObjectId;
  readAt: Date;
}

interface IGroupMessage {
  groupId: Types.ObjectId;
  senderId: Types.ObjectId;
  content?: string;
  attachment?: IAttachment;
  reactions?: IReaction[];
  readBy?: IReadReceipt[]; // per-recipient read tracking — a group has many
  // readers, so a single status field (like 1:1 Message) doesn't work here
}

export type GroupMessageDocument = HydratedDocument<IGroupMessage>;

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
  { _id: false },
);

const reactionSchema = new Schema<IReaction>(
  {
    userId: { type: Types.ObjectId, ref: "User", required: true },
    emoji: { type: String, required: true, maxLength: 8 },
  },
  { _id: false },
);

const readReceiptSchema = new Schema<IReadReceipt>(
  {
    userId: { type: Types.ObjectId, ref: "User", required: true },
    readAt: { type: Date, required: true },
  },
  { _id: false },
);

const groupMessageSchema = new Schema<IGroupMessage>(
  {
    groupId: { type: Types.ObjectId, ref: "Group", required: true },
    senderId: { type: Types.ObjectId, ref: "User", required: true },
    content: { type: String, maxLength: 2000 },
    attachment: { type: attachmentSchema, required: false },
    reactions: { type: [reactionSchema], default: [] },
    readBy: { type: [readReceiptSchema], default: [] },
  },
  { timestamps: true },
);

groupMessageSchema.index({ groupId: 1, createdAt: 1 }); // paginate a group's history

export const GroupMessage = model<IGroupMessage>(
  "GroupMessage",
  groupMessageSchema,
);
