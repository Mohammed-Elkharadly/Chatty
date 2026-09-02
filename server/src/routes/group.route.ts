import express from "express";
import asyncHandler from "express-async-handler";
import { verifyJwt } from "../middleware/verifyJwt.js";
import { upload } from '../middleware/upload.js';
import { strictLimiter } from "../middleware/limiters.js";
import {
  createGroup,
  getMyGroups,
  getGroupMembers,
  removeMember,
  leaveGroup,
  deleteGroup,
} from "../controllers/groupController.js";

import {
  inviteToGroup,
  requestToJoin,
  respondToJoinRequest,
  getMyJoinRequests,
  getPendingRequestsForGroup,
} from "../controllers/groupJoinController.js";

import {
  sendGroupMessage,
  getGroupMessages,
  markGroupMessagesRead,
  reactToGroupMessage,
  deleteGroupMessage,
} from '../controllers/groupMessageController.js';

const router = express.Router();
router.use(verifyJwt); // every group route requires auth

// group
router.get("/join-requests/mine", asyncHandler(getMyJoinRequests));
router.patch("/join-requests/:id", asyncHandler(respondToJoinRequest)); 

// group CRUD
router.post("/", strictLimiter, asyncHandler(createGroup));
router.get("/", asyncHandler(getMyGroups));
router.get("/:id/members", asyncHandler(getGroupMembers));
router.delete("/:id/members/:memberId", asyncHandler(removeMember));
router.post("/:id/leave", asyncHandler(leaveGroup));
router.delete("/:id", asyncHandler(deleteGroup));

// join flow
router.post("/:id/invite", strictLimiter, asyncHandler(inviteToGroup)); 
router.post("/:id/join", asyncHandler(requestToJoin));
router.get("/:id/pending-requests", asyncHandler(getPendingRequestsForGroup));

// messages
router.post("/:id/messages", upload.single("attachment"), asyncHandler(sendGroupMessage));
router.get("/:id/messages", asyncHandler(getGroupMessages));
router.patch("/:id/messages/read", asyncHandler(markGroupMessagesRead));
router.patch("/:id/messages/:messageId/react", asyncHandler(reactToGroupMessage));
router.delete("/:id/messages/:messageId", asyncHandler(deleteGroupMessage));

export default router;
