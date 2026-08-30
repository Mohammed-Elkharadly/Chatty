import express from "express";
import asyncHandler from "express-async-handler";
import { verifyJwt } from "../middleware/verifyJwt.js";
import { upload } from "../middleware/upload.js";
import { strictLimiter, heavyLimiter } from "../middleware/limiters.js";
import {
  logout,
  checkAuth,
  updateProfile,
  changePassword,
  deleteAccount,
} from "../controllers/userController.js";

const router = express.Router();

// Everything below this line requires a valid JWT
router.use(verifyJwt);

router.get("/check-auth", asyncHandler(checkAuth));
router.post("/logout", asyncHandler(logout));
router.patch(
  "/update-profile",
  upload.single("avatar"),
  strictLimiter,
  asyncHandler(updateProfile),
);
router.post("/change-password", heavyLimiter, asyncHandler(changePassword));
router.delete("/delete-account", asyncHandler(deleteAccount));

export default router;
