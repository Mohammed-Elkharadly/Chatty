import { Schema, model, Types, type HydratedDocument } from "mongoose";

// shape of a join request/invite record
interface IGroupJoinRequest {
  groupId: Types.ObjectId;   // which group
  userId: Types.ObjectId;    // the person being invited or requesting to join
  type: "invite" | "request"; // "invite" = admin sent it; "request" = user asked to join
  status: "pending" | "accepted" | "rejected"; // current state
  initiatedBy: Types.ObjectId; // who created this (admin for invite, the user themselves for request)
}

// the type Mongoose gives you when you query a join request
export type GroupJoinRequestDocument = HydratedDocument<IGroupJoinRequest>;

const groupJoinRequestSchema = new Schema<IGroupJoinRequest>(
  {
    // which group this request/invite is for
    groupId: { type: Types.ObjectId, ref: "Group", required: true },
    // the target user (the one who needs to accept/reject)
    userId: { type: Types.ObjectId, ref: "User", required: true },
    // "invite" = an admin invited them; "request" = they asked to join
    type: { type: String, enum: ["invite", "request"], required: true },
    // current state — starts as "pending", becomes "accepted" or "rejected"
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "pending",
    },
    // who initiated this (admin's _id for invites, the user's own _id for requests)
    initiatedBy: { type: Types.ObjectId, ref: "User", required: true },
  },
  {
    // auto-adds createdAt + updatedAt (createdAt = when the invite/request was sent)
    timestamps: true,
  },
);

// allows only ONE pending invite/request per user per group
// once accepted/rejected, the unique constraint no longer applies → a new one can be created
groupJoinRequestSchema.index(
  { groupId: 1, userId: 1 },
  {
    unique: true,
    // only enforce uniqueness on docs where status is still "pending"
    partialFilterExpression: { status: "pending" },
  },
);

// speeds up "show me all my pending invites/requests" → find({ userId: me, status: "pending" })
groupJoinRequestSchema.index({ userId: 1, status: 1 });

// registers the model
export const GroupJoinRequest = model<IGroupJoinRequest>(
  "GroupJoinRequest",
  groupJoinRequestSchema,
);   