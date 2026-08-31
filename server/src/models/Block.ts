import { Schema, model, Types, type HydratedDocument } from "mongoose";

interface IBlock {
  blockerId: Types.ObjectId;
  blockedId: Types.ObjectId;
}

export type BlockedDocument = HydratedDocument<IBlock>;

const blockSchema = new Schema<IBlock>(
  {
    blockerId: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
    },

    blockedId: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

blockSchema.index({ blockerId: 1, blockedId: 1 }, { unique: true });
blockSchema.index({ blockedId: 1 });

export const Block = model<IBlock>("Block", blockSchema);
