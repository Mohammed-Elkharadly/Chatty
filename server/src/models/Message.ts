import { Schema, model, Types, type HydratedDocument } from "mongoose";

// shape of a file attachment (image, video, audio, pdf, doc)
interface IAttachment {
  url: string; // Cloudinary URL (what the client loads)
  publicId: string; // Cloudinary ID (needed to delete the file)
  type: "image" | "video" | "audio" | "pdf" | "document";
  mimeType: string; // original MIME type (e.g. "image/png")
  fileName: string; // original filename the user uploaded
  fileSize: number; // size in bytes
}

// shape of a single reaction on a message
interface IReactions {
  userId: Types.ObjectId; // who reacted
  emoji: string; // the emoji
}

// the shape of a message document in MongoDB
interface IMessage {
  senderId: Types.ObjectId; // who sent it
  receiverId: Types.ObjectId; // who received it
  status: "sent" | "delivered" | "seen"; // delivery state
  content?: string; // text body (optional if there's an attachment)
  attachment?: IAttachment; // embedded file info (optional if it's a text message)
  reactions: IReactions[]; // list of who reacted with what
}

// the type Mongoose gives you when you query a message
export type MessageDocument = HydratedDocument<IMessage>;

// sub-schema for the attachment field (embedded, not a separate collection)
const attachmentSchema = new Schema<IAttachment>(
  {
    // Cloudinary URL the client uses to load/display the file
    url: { type: String, required: true },
    // Cloudinary's internal ID (used to delete the file from Cloudinary)
    publicId: { type: String, required: true },
    // which category this file belongs to
    type: {
      type: String,
      enum: ["image", "video", "audio", "pdf", "document"],
      required: true,
    },
    // original MIME type (helps the client decide how to render it)
    mimeType: { type: String, required: true },
    // original filename (shown in the UI)
    fileName: { type: String, required: true },
    // file size in bytes (shown in the UI, used for download progress)
    fileSize: { type: Number, required: true },
  },
  { _id: false }, // embedded subdoc doesn't need its own _id (saves space)
);

// sub-schema for a single reaction (embedded in the reactions array)
const reactionSchema = new Schema<IReactions>(
  {
    // which user reacted (pointer to User collection)
    userId: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
    },
    // the emoji string (max 8 chars covers most emoji including ZWJ sequences)
    emoji: {
      type: String,
      required: true,
      maxLength: 8,
    },
  },
  { _id: false },
);

// the main message schema
const messageSchema = new Schema<IMessage>(
  {
    // who sent the message
    senderId: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
    },
    // who received the message
    receiverId: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
    },
    // delivery state: "sent" → "delivered" → "seen"
    status: {
      type: String,
      enum: ["sent", "delivered", "seen"],
      default: "sent",
    },
    // text content (max 2000 chars)
    content: {
      type: String,
      maxLength: 2000,
    },
    // optional embedded attachment (null for text-only messages)
    attachment: {
      type: attachmentSchema,
      required: false,
    },
    // array of reactions (empty by default)
    reactions: {
      type: [reactionSchema],
      default: [],
    },
  },
  {
    // auto-adds createdAt + updatedAt
    timestamps: true,
  },
);

// compound index: speeds up "get all messages between A and B, newest first"
messageSchema.index({ senderId: 1, receiverId: 1, createdAt: -1 });

// registers the model
export const Message = model<IMessage>("Message", messageSchema);
