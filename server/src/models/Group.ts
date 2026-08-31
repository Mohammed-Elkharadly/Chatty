import { Schema, model, Types, type HydratedDocument } from "mongoose";

interface IGroup {
  name: string;
  description?: string;
  avatar?: string;
  adminId: Types.ObjectId; // creator, fixed single admin
}

export type GroupDocument = HydratedDocument<IGroup>;

const groupSchema = new Schema<IGroup>(
  {
    name: { type: String, required: true, trim: true, maxLength: 100 },
    description: { type: String, trim: true, maxLength: 500 },
    avatar: { type: String },
    adminId: { type: Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

groupSchema.index({ adminId: 1 });

export const Group = model<IGroup>("Group", groupSchema);
