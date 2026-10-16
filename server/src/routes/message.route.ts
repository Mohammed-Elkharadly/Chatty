import express from "express";
import { verifyJwt } from "../middleware/verifyJwt.js";
import { upload } from "../middleware/upload.js";
import asyncHandler from "express-async-handler";
import { messageLimiter } from "../middleware/limiters.js";
import {
  searchForUsers,
  getChatsHistory,
  getMessageByUserId,
  sendMessage,
  markAsRead,
  updateMessage,
  deleteMessage,
  reactToMessage,
  searchInMessages
} from "../controllers/messageController.js";
const router = express.Router();

router.use(verifyJwt);

router.get("/search", asyncHandler(searchForUsers));
router.get("/chats", asyncHandler(getChatsHistory));
router.get("/search/:id", asyncHandler(searchInMessages));
router.get("/:id", asyncHandler(getMessageByUserId));

// upload.single('attachment') parses multipart/form-data, populates
// req.file (the attachment) and req.body (any other text fields, e.g. content)
router.post("/send/:id", messageLimiter, upload.single('attachment'), asyncHandler(sendMessage));
router.patch("/read/:id", asyncHandler(markAsRead));
router.patch("/:id", upload.single('attachment'), asyncHandler(updateMessage));
router.delete("/:id", asyncHandler(deleteMessage));
router.patch('/:id/react', asyncHandler(reactToMessage));

export default router;
