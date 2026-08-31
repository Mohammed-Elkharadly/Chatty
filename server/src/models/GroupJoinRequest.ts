import { Schema, model, Types, type HydratedDocument } from "mongoose";

interface IGroupJoinRequest {
  groupId: Types.ObjectId;
  userId: Types.ObjectId; // the person being invited, or requesting to join
  type: "invite" | "request"; // invite = admin-initiated; request = user-initiated
  status: "pending" | "accepted" | "rejected";
  initiatedBy: Types.ObjectId; // admin (for invite) or userId itself (for request)
}

export type GroupJoinRequestDocument = HydratedDocument<IGroupJoinRequest>;

const groupJoinRequestSchema = new Schema<IGroupJoinRequest>(
  {
    groupId: { type: Types.ObjectId, ref: "Group", required: true },
    userId: { type: Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: ["invite", "request"], required: true },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "pending",
    },
    initiatedBy: { type: Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

// only one PENDING invite/request per user per group at a time —
// once resolved (accepted/rejected), a new one can be created later
groupJoinRequestSchema.index(
  { groupId: 1, userId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: "pending" },
  },
);

groupJoinRequestSchema.index({ userId: 1, status: 1 }); // "my pending invites"

export const GroupJoinRequest = model<IGroupJoinRequest>(
  "GroupJoinRequest",
  groupJoinRequestSchema,
);
