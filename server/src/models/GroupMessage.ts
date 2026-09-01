import { Schema, model, Types, type HydratedDocument } from "mongoose";

// shape of a file attachment (same as in Message model)
interface IAttachment {
  url: string;         // Cloudinary URL
  publicId: string;    // Cloudinary ID (for deletion)
  type: "image" | "video" | "audio" | "pdf" | "document";
  mimeType: string;    // original MIME type
  fileName: string;    // original filename
  fileSize: number;    // bytes
}

// shape of a single reaction (who + which emoji)
interface IReaction {
  userId: Types.ObjectId; // who reacted
  emoji: string;          // the emoji 
}

// shape of a single read receipt (who read it + when)
interface IReadReceipt {
  userId: Types.ObjectId; // which member read the message
  readAt: Date;           // when they read it
}

// the shape of a group message document
interface IGroupMessage {
  groupId: Types.ObjectId;   // which group this message belongs to
  senderId: Types.ObjectId;  // who sent it
  content?: string;          // text body (optional if attachment-only)
  attachment?: IAttachment;  // embedded file info (optional)
  reactions?: IReaction[];   // who reacted with what
  readBy?: IReadReceipt[];   // per-member read tracking (a group has many readers)
}

// the type Mongoose gives you when you query a group message
export type GroupMessageDocument = HydratedDocument<IGroupMessage>;

// sub-schema for the attachment field (embedded, no own _id)
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

// sub-schema for a single reaction
const reactionSchema = new Schema<IReaction>(
  {
    userId: { type: Types.ObjectId, ref: "User", required: true },
    emoji: { type: String, required: true, maxLength: 8 },
  },
  { _id: false },
);

// sub-schema for a single read receipt (one per member who read the message)
const readReceiptSchema = new Schema<IReadReceipt>(
  {
    userId: { type: Types.ObjectId, ref: "User", required: true },
    readAt: { type: Date, required: true },
  },
  { _id: false },
);

// the main group message schema
const groupMessageSchema = new Schema<IGroupMessage>(
  {
    // which group this message belongs to
    groupId: { type: Types.ObjectId, ref: "Group", required: true },
    // who sent it
    senderId: { type: Types.ObjectId, ref: "User", required: true },
    // text body (max 2000 chars)
    content: { type: String, maxLength: 2000 },
    // optional embedded attachment
    attachment: { type: attachmentSchema, required: false },
    // array of reactions (empty by default)
    reactions: { type: [reactionSchema], default: [] },
    // array of read receipts — each member who opens the chat adds their entry here
    readBy: { type: [readReceiptSchema], default: [] },
  },
  {
    // auto-adds createdAt + updatedAt
    timestamps: true,
  },
);

// speeds up "get all messages in this group, newest first"
groupMessageSchema.index({ groupId: 1, createdAt: -1 });

// registers the model
export const GroupMessage = model<IGroupMessage>(
  "GroupMessage",
  groupMessageSchema,
);   