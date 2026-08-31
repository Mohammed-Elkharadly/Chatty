import express from "express";
import asyncHandler from "express-async-handler";
import { verifyJwt } from "../middleware/verifyJwt.js";
import { upload } from '../middleware/upload.js';

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

router.post("/", asyncHandler(createGroup));
router.get("/", asyncHandler(getMyGroups));
router.get("/:id/members", asyncHandler(getGroupMembers));
router.delete("/:id/members/:memberId", asyncHandler(removeMember));
router.post("/:id/leave", asyncHandler(leaveGroup));
router.delete("/:id", asyncHandler(deleteGroup));

router.post("/:id/invite", asyncHandler(inviteToGroup)); // admin invites a user
router.post("/:id/request", asyncHandler(requestToJoin)); // user requests to join
router.get("/:id/requests", asyncHandler(getPendingRequestsForGroup)); // admin views pending requests
router.get("/join-requests/mine", asyncHandler(getMyJoinRequests)); // my own invites/requests
router.patch("/join-requests/:id", asyncHandler(respondToJoinRequest)); // accept/reject

router.post('/:id/messages', upload.single('attachment'), asyncHandler(sendGroupMessage));
router.get('/:id/messages', asyncHandler(getGroupMessages));
router.patch('/:id/messages/read', asyncHandler(markGroupMessagesRead));
router.patch('/:id/messages/:messageId/react', asyncHandler(reactToGroupMessage));
router.delete('/:id/messages/:messageId', asyncHandler(deleteGroupMessage));

export default router;
