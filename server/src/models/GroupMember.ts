import { Schema, model, Types, type HydratedDocument } from "mongoose";

// shape of a group membership record (links a user to a group)
interface IGroupMember {
  groupId: Types.ObjectId; // which group
  userId: Types.ObjectId; // which user
}

// the type Mongoose gives you when you query a group member
export type GroupMemberDocument = HydratedDocument<IGroupMember>;

const groupMemberSchema = new Schema<IGroupMember>(
  {
    // the group this membership belongs to (pointer to Group collection)
    groupId: { type: Types.ObjectId, ref: "Group", required: true },
    // the user who is a member (pointer to User collection)
    userId: { type: Types.ObjectId, ref: "User", required: true },
  },
  {
    // auto-adds createdAt + updatedAt; here createdAt doubles as "when they joined"
    timestamps: true,
  },
);

// prevents the same user from joining the same group twice
groupMemberSchema.index({ groupId: 1, userId: 1 }, { unique: true });

// speeds up "get all groups this user is in" → GroupMember.find({ userId: me })
groupMemberSchema.index({ userId: 1 });

// registers the model
export const GroupMember = model<IGroupMember>(
  "GroupMember",
  groupMemberSchema,
);
