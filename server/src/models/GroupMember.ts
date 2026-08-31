import { Schema, model, Types, type HydratedDocument } from "mongoose";

interface IGroupMember {
  groupId: Types.ObjectId;
  userId: Types.ObjectId;
}

export type GroupMemberDocument = HydratedDocument<IGroupMember>;

const groupMemberSchema = new Schema<IGroupMember>(
  {
    groupId: { type: Types.ObjectId, ref: "Group", required: true },
    userId: { type: Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true }, // createdAt doubles as "joinedAt"
);

groupMemberSchema.index({ groupId: 1, userId: 1 }, { unique: true });
groupMemberSchema.index({ userId: 1 }); // fast "all groups this user is in"

export const GroupMember = model<IGroupMember>(
  "GroupMember",
  groupMemberSchema,
);
