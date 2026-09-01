import { Schema, model, Types, type HydratedDocument } from "mongoose";

// the shape of a "block" record in the DB
interface IBlock {
  blockerId: Types.ObjectId; // the user who initiated the block
  blockedId: Types.ObjectId; // the user who got blocked
}

// the type Mongoose gives you when you query (includes .save(), .toObject(), etc.)
export type BlockedDocument = HydratedDocument<IBlock>;

const blockSchema = new Schema<IBlock>(
  {
    // who did the blocking (ref: "User" means this is a pointer to the User collection)
    blockerId: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
    },
    // who got blocked
    blockedId: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    // auto-adds createdAt + updatedAt to every document
    timestamps: true,
  },
);

// prevents the same user from blocking the same person twice (one record per pair)
blockSchema.index({ blockerId: 1, blockedId: 1 }, { unique: true });

// speeds up queries like "who blocked me?" (find all blocks where I'm the blockedId)
blockSchema.index({ blockedId: 1 });

// registers the model so you can use Block.find(), Block.create(), etc.
export const Block = model<IBlock>("Block", blockSchema);   