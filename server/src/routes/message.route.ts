import express from "express";
import { verifyJwt } from "../middleware/verifyJwt.js";
import { upload } from "../middleware/upload.js";
import asyncHandler from "express-async-handler";
import {
  searchUsers,
  getAllChats,
  getMessageByUserId,
  sendMessage,
  markAsRead,
  updateMessage,
  deleteMessage,
} from "../controllers/messageController.js";
const router = express.Router();

router.use(verifyJwt);

router.get("/search", asyncHandler(searchUsers));
router.get("/chats", asyncHandler(getAllChats));
router.get("/:id", asyncHandler(getMessageByUserId));

// upload.single('attachment') parses multipart/form-data, populates
// req.file (the attachment) and req.body (any other text fields, e.g. content)
router.post("/send/:id", upload.single('attachment'), asyncHandler(sendMessage));
router.patch("/read/:id", asyncHandler(markAsRead));
router.patch("/:id", upload.single('attachment'), asyncHandler(updateMessage));
router.delete("/:id", asyncHandler(deleteMessage));

export default router;
