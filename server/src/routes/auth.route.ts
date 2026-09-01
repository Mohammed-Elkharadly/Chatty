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

// --- Authentication (public) ---
//  added strictLimiter to prevent account spam
router.post("/signup", strictLimiter, asyncHandler(signup));
router.post("/login", loginLimiter, asyncHandler(login));
router.post("/oauth/login", loginLimiter, asyncHandler(oAuthLogin));

// --- Token refresh (public — the refresh token cookie is the credential) ---
//  added strictLimiter to prevent rotation spam
router.post("/refresh-token", strictLimiter, asyncHandler(refreshToken));

// --- Email verification (public) ---
router.get("/verify-email/:token", strictLimiter, asyncHandler(verifyEmail));
router.post("/verify-email", strictLimiter, asyncHandler(verifyEmail));
router.post(
  "/resend-verification",
  accountRecoveryLimiter,
  asyncHandler(resendVerification),
);

// --- Password reset flow (public) ---
router.post(
  "/forgot-password",
  accountRecoveryLimiter,
  asyncHandler(forgotPassword),
);

// GET → redirects browser to frontend form page (no sensitive action, limiter optional)
router.get("/reset-password/:token", asyncHandler(resetPassword));
// POST → performs the actual reset
router.post("/reset-password", heavyLimiter, asyncHandler(resetPassword));

// --- OTP flow (public) ---
router.post("/otp/send", heavyLimiter, asyncHandler(sendOtp));
router.post("/otp/verify", strictLimiter, asyncHandler(verifyOtp));

export default router;
