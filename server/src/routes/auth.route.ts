import express from "express";
import asyncHandler from "express-async-handler";
import {
  loginLimiter,
  strictLimiter,
  heavyLimiter,
  accountRecoveryLimiter,
} from "../middleware/limiters.js";
import {
  signup,
  login,
  refreshToken,
  verifyEmail,
  resendVerification,
  forgotPassword,
  resetPassword,
  sendOtp,
  verifyOtp,
  oAuthLogin,
} from "../controllers/authController.js";

const router = express.Router();

// Authentication attempts (public)
router.post("/signup", asyncHandler(signup));
router.post("/login", loginLimiter, asyncHandler(login));
router.post("/oauth/login", loginLimiter, asyncHandler(oAuthLogin));

// Token refresh (public — the refresh token itself is the credential)
router.post("/refresh-token", asyncHandler(refreshToken));

// Email verification (public)
router.get("/verify-email/:token", strictLimiter, asyncHandler(verifyEmail));
router.post("/verify-email", strictLimiter, asyncHandler(verifyEmail));
router.post(
  "/resend-verification",
  accountRecoveryLimiter,
  asyncHandler(resendVerification),
);

// Password reset flow (public)
router.post(
  "/forgot-password",
  accountRecoveryLimiter,
  asyncHandler(forgotPassword),
);

// GET → redirects browser to frontend form page
// POST → performs the actual reset (called by frontend form)
router.get("/reset-password/:token", heavyLimiter, asyncHandler(resetPassword));
router.post("/reset-password", heavyLimiter, asyncHandler(resetPassword));

// OTP flow (public)
router.post("/otp/send", heavyLimiter, asyncHandler(sendOtp));
router.post("/otp/verify", strictLimiter, asyncHandler(verifyOtp));

export default router;