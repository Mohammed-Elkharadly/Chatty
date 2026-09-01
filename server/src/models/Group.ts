import { Schema, model, Types, type HydratedDocument } from "mongoose";

// shape of a group document in MongoDB
interface IGroup {
  name: string;              // display name of the group
  description?: string;      // optional description shown in group info
  avatar?: string;           // Cloudinary URL for the group avatar
  adminId: Types.ObjectId;   // the creator — fixed single admin (can't transfer ownership)
}

// the type Mongoose gives you when you query a group
export type GroupDocument = HydratedDocument<IGroup>;

const groupSchema = new Schema<IGroup>(
  {
    // group name, required, strips whitespace, max 100 chars
    name: { type: String, required: true, trim: true, maxLength: 100 },
    // optional description, max 500 chars
    description: { type: String, trim: true, maxLength: 500 },
    // Cloudinary URL for the group avatar (null if not set)
    avatar: { type: String },
    // who created the group (pointer to User); this is the permanent admin
    adminId: { type: Types.ObjectId, ref: "User", required: true },
  },
  {
    // auto-adds createdAt + updatedAt (createdAt = when the group was created)
    timestamps: true,
  },
);

// speeds up "get all groups I created" → Group.find({ adminId: me })
groupSchema.index({ adminId: 1 });

// registers the model
export const Group = model<IGroup>("Group", groupSchema);   