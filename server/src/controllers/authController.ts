import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { Validator } from "../utils/validator.js";
import { CustomError } from "../utils/customError.js";
import {
  safeUserData,
  User,
  isUserActive,
  AuthProvider,
} from "../models/User.js";
import {
  welcomeEmail,
  verificationEmail,
  forgotPasswordEmail,
  sendOtpEmail,
} from "../email/emailHandler.js";
import { ENV } from "../config/env.js";
import { TokenHandler } from "../utils/tokenHandler.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { verifyWithProvider } from "../utils/verifyWithProvider.js";

// requires: 8+ chars, 1 lowercase, 1 uppercase, 1 digit, 1 special char
const passRegEx = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).{8,}$/;

// handles: POST /api/auth/signup
export const signup = async (req: Request, res: Response) => {
  // pull the fields the client sent
  const { name, email, password, phone } = req.body;

  // run validation (format checks, password strength, etc.) — throws if invalid
  Validator.validateSignup(name, email, password, phone);

  // if email was provided, make sure no other user already has it
  if (email) {
    const duplicateEmail = await User.findByEmail(email);
    if (duplicateEmail) {
      throw new CustomError("choose a valid email", StatusCodes.BAD_REQUEST);
    }
  }

  // if phone was provided, make sure no other user already has it
  if (phone) {
    const duplicatePhone = await User.findByPhone(phone);
    if (duplicatePhone) {
      throw new CustomError(
        "choose a valid phone number",
        StatusCodes.BAD_REQUEST,
      );
    }
  }

  // create + save the user in MongoDB (password gets hashed by the model's pre-save hook)
  const user = await User.create({ name, email, password, phone });

  // generate a one-time token the user will use to verify their email
  const verificationToken = await user.generateVerificationToken();

  // send welcome + verification link emails (non-blocking: if email fails, signup still succeeds)
  if (user.email) {
    try {
      await welcomeEmail(user.name, user.email, ENV.CLIENT_URL);
      await verificationEmail(
        user.name,
        user.email,
        verificationToken,
        ENV.SERVER_URL,
      );
    } catch (error) {
      // email service down → log it, don't fail the signup
      console.log(error);
    }
  }

  // create a short-lived JWT for this user (contains their _id)
  const accessToken = user.createJwt();

  // set the accessToken as an httpOnly cookie on the response
  TokenHandler.attachAccessToken(res, accessToken);

  // respond with 201 + the user's public data (no password, no tokens)
  res.status(StatusCodes.CREATED).json({
    message: "User created successfully",
    data: {
      user: safeUserData(user), // strips sensitive fields before sending to client
    },
  });
};

// handles: POST /api/auth/login
export const login = async (req: Request, res: Response) => {
  // pull credentials from the request body
  const { email, password } = req.body;

  // find the user by email who is active; select "+password" to include the hashed password (normally excluded)
  const user = await User.findOne({ email, isActive: true }).select(
    "+password",
  );

  // validates that password exists and user exists — throws 401 if either is missing
  await Validator.validateLogin(password, user);

  // if the user hit the max failed attempts, block them temporarily
  if (user?.isAccountLocked()) {
    throw new CustomError(
      "account temporarily locked, try again later",
      StatusCodes.UNAUTHORIZED,
    );
  }

  // final safety check: user must exist and be active (covers edge cases)
  if (!isUserActive(user)) {
    throw new CustomError("invalid credentials", StatusCodes.UNAUTHORIZED);
  }

  // password is correct → reset the failed-attempt counter to 0
  await user.resetLoginAttempts();

  // update the lastLogin timestamp in the DB
  await user.updateLastLogin();

  // create a short-lived JWT (sent as httpOnly cookie, used for API requests)
  const accessToken = user.createJwt();

  // create a long-lived refresh token (stored in DB, used to get new access tokens)
  const refreshToken = await user.createRefreshToken();

  // set both as httpOnly cookies on the response
  TokenHandler.attachAccessToken(res, accessToken);
  TokenHandler.attachRefreshToken(res, refreshToken);

  // respond with 200 + the user's public data
  res.status(StatusCodes.OK).json({
    message: "user logged in successfully",
    data: {
      user: safeUserData(user), // strips password, tokens, and other sensitive fields
    },
  });
};

// handles: POST /api/auth/refresh — exchanges a valid refresh token for a new access + refresh token pair
export const refreshToken = async (req: Request, res: Response) => {
  // grab the refresh token from the httpOnly cookie
  const refreshToken = req.cookies?.refreshToken;

  // no cookie → user isn't logged in or cookie expired
  if (!refreshToken) {
    throw new CustomError(
      "no refresh token provided",
      StatusCodes.UNAUTHORIZED,
    );
  }

  // the secret we signed refresh tokens with (separate from access token secret)
  const secret = ENV.JWT_REFRESH_SECRET_KEY;

  // if the secret isn't set in .env → server is misconfigured, fail fast
  if (!secret) {
    throw new CustomError(
      "server misconfiguration",
      StatusCodes.INTERNAL_SERVER_ERROR,
    );
  }

  let decoded: { userId: string };

  // verify the token's signature + expiry
  try {
    // if valid, returns the payload; if expired/tampered, throws
    decoded = jwt.verify(refreshToken, secret) as { userId: string };
  } catch (error) {
    // token is invalid or expired → 401
    throw new CustomError(
      "Invalid or expired refresh token",
      StatusCodes.UNAUTHORIZED,
    );
  }

  // fetch the user from DB, include the stored refreshToken field (normally excluded)
  const user = await User.findById(decoded.userId).select("+refreshToken");

  // token rotation check: the token in the cookie MUST match what's stored in the DB
  // if it doesn't → someone is replaying a stolen/revoked token
  if (!user || user.refreshToken !== refreshToken) {
    throw new CustomError("Invalid refresh token", StatusCodes.UNAUTHORIZED);
  }

  // make sure the account hasn't been deactivated/banned since the token was issued
  if (!isUserActive(user)) {
    throw new CustomError("account inactive", StatusCodes.UNAUTHORIZED);
  }

  // issue a brand-new access token (short-lived, for API requests)
  const newAccessToken = user.createJwt();

  // issue a brand-new refresh token (old one is now invalid — this is "rotation")
  const newRefreshToken = await user.createRefreshToken();

  // overwrite both cookies with the new values
  TokenHandler.attachAccessToken(res, newAccessToken);
  TokenHandler.attachRefreshToken(res, newRefreshToken);

  // respond with 200 + the user's public data
  res.status(StatusCodes.OK).json({
    message: "token refreshed successfully",
    data: { user: safeUserData(user) },
  });
};

// handles: GET/POST /api/auth/verify-email — confirms the user's email is real
export const verifyEmail = async (req: Request, res: Response) => {
  // token can come from URL param (link click) or request body (API call)
  const token = req.params.token || req.body.token;

  // if the user clicked the link in their email (GET), we'll redirect them to the frontend
  // if it's an API call (POST), we'll return JSON
  const isLinkClick = req.method === "GET";

  // find the user whose stored verificationToken matches and hasn't expired
  const user = await User.findWithVerificationToken(token);

  // no matching user → token is invalid or expired
  if (!user) {
    // if they clicked a link → redirect to an error page on the frontend
    if (isLinkClick) {
      return res.redirect(`${ENV.CLIENT_URL}/verify-email/error`);
    }
    // if it's an API call → return a JSON error
    throw new CustomError(
      !token || typeof token !== "string"
        ? "Verification token required" // no token was sent at all
        : "invalid or expired token", // token was sent but doesn't match / expired
      StatusCodes.BAD_REQUEST,
    );
  }

  // mark the user as verified
  user.isVerified = true;
  // clear the token fields (no longer needed, saves space)
  user.verificationToken = undefined;
  user.verificationTokenExpire = undefined;
  // persist the changes to MongoDB
  await user.save();

  // if they clicked the link → redirect to a success page on the frontend
  if (isLinkClick) {
    return res.redirect(`${ENV.CLIENT_URL}/verify-email/success`);
  }

  // if it's an API call → return JSON success
  res.status(StatusCodes.OK).json({ message: "email verified successfully" });
};

// handles: POST /api/auth/resend-verification — sends a new verification email to an unverified account
export const resendVerification = async (req: Request, res: Response) => {
  // pull the email from the request body
  const { email } = req.body;

  // no email sent → can't look anyone up
  if (!email) {
    throw new CustomError(
      "email is required to send another verification token",
      StatusCodes.BAD_REQUEST,
    );
  }

  // find the user by email
  const user = await User.findByEmail(email);

  // user doesn't exist OR is already verified → don't reveal which, just return a generic success
  // (prevents attackers from probing which emails are registered)
  if (!user || user.isVerified) {
    res.status(StatusCodes.OK).json({
      message: "If an account exists, a verification email has been sent!",
    });
    return;
  }

  // generate a fresh verification token (overwrites the old one, resets expiry)
  const verificationToken = await user.generateVerificationToken();

  // defensive check: user exists but somehow has no email (shouldn't happen since we looked up by email)
  if (!user.email) {
    throw new CustomError(
      "email is required to send another verification token",
      StatusCodes.BAD_REQUEST,
    );
  }

  // send the verification email (non-blocking: if email service fails, still return success)
  try {
    await verificationEmail(
      user.name,
      user.email,
      verificationToken,
      ENV.SERVER_URL,
    );
  } catch (error) {
    // email service down → log it, don't crash the request
    console.error("failed to send verification token", error);
  }

  // always return the same generic message (don't confirm whether the account exists)
  res.status(StatusCodes.OK).json({
    message: "If an account exists, a verification email has been sent",
  });
};

// handles: POST /api/auth/forgot-password — sends a password reset link to the user's email
export const forgotPassword = async (req: Request, res: Response) => {
  // pull the email from the request body
  const { email } = req.body;

  // no email → can't look anyone up
  if (!email) {
    throw new CustomError("email is required", StatusCodes.BAD_REQUEST);
  }

  // find the user by email
  const user = await User.findByEmail(email);

  // only allow reset for users who have a local password (not OAuth-only accounts like Google)
  // if they signed up with Google, they reset via Google, not here
  const canResetPassword =
    user?.provider === AuthProvider.LOCAL || !!user?.password;

  // user doesn't exist, has no email, or is an OAuth-only account → return generic success
  // (don't reveal whether the account exists or which provider they used)
  if (!user || !user.email || !canResetPassword) {
    res.status(StatusCodes.OK).json({
      message: "if an account exist, the reset link has been sent!",
    });
    return;
  }

  // generate a one-time reset token (stored in DB with an expiry)
  const resetPasswordToken = await user.generateResetPasswordToken();

  // send the reset email with a link containing the token (non-blocking)
  try {
    await forgotPasswordEmail(
      user.name,
      user.email,
      resetPasswordToken,
      ENV.CLIENT_URL,
    );
  } catch (error) {
    // email service down → log it, still return success to the client
    console.error("reset password failed", error);
  }

  // always return the same generic message regardless of outcome
  res.status(StatusCodes.OK).json({
    message: "if an account exist, the reset link has been sent",
  });
};

// handles: GET/POST /api/auth/reset-password — lets a user set a new password using their reset token
export const resetPassword = async (req: Request, res: Response) => {
  // if it's a GET with a token but no password → user clicked the link in their email
  // redirect them to the frontend reset form, passing the token as a query param
  if (req.method === "GET" && req.params.token && !req.body.password) {
    return res.redirect(
      `${ENV.CLIENT_URL}/reset-password?token=${req.params.token}`,
    );
  }

  // pull token + new password from the request body (POST from the frontend form)
  const { token, password } = req.body;
  // token can come from URL params (GET) or body (POST) — use whichever is present
  const resetToken = req.params.token || token;

  // if either is missing → can't proceed
  if (!resetToken || !password) {
    throw new CustomError("password is required", StatusCodes.BAD_REQUEST);
  }

  // enforce password strength (8+ chars, upper, lower, digit, special)
  if (!passRegEx.test(password)) {
    throw new CustomError(
      "'Must contain uppercase, lowercase, number, and special character.",
      StatusCodes.BAD_REQUEST,
    );
  }

  // find the user whose stored resetPasswordToken matches and hasn't expired
  const user = await User.findWithResetToken(resetToken);

  // no match → token is invalid, expired, or already used
  if (!user) {
    throw new CustomError("invalid or expire token", StatusCodes.BAD_REQUEST);
  }

  // set the new password (model's pre-save hook will hash it)
  user.password = password;
  // mark as verified (reset implies they own the email)
  user.isVerified = true;
  // clear the reset token fields (one-time use)
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  // invalidate all existing sessions (forces re-login everywhere)
  user.refreshToken = undefined;
  // reset the failed-login counter + unlock the account
  user.loginAttempts = 0;
  user.lockUntil = undefined;

  // persist all changes to MongoDB
  await user.save();

  // tell the client to go back to the login page
  res.status(StatusCodes.OK).json({
    message: "password reset successfully, please log in again",
  });
};

// handles: POST /api/auth/send-otp — generates a one-time code and emails it to the user
export const sendOtp = async (req: Request, res: Response) => {
  // pull the email from the request body
  const { email } = req.body;

  // no email → can't look anyone up
  if (!email) {
    throw new CustomError("email is required", StatusCodes.BAD_REQUEST);
  }

  // find the user by email
  const user = await User.findByEmail(email);

  // user doesn't exist → return the same success message (don't reveal the account doesn't exist)
  if (!user) {
    res
      .status(StatusCodes.OK)
      .json({ message: "OTP code has been sent successfully!!" });
    return;
  }

  // generate a one-time code (stored in DB with an expiry, e.g. 5 min)
  const otp = await user.generateOTP();

  // send the OTP email — here we DO throw if it fails (unlike verification/resend which swallow errors)
  // because the whole point of this endpoint is to deliver the code, so failing silently is worse
  try {
    await sendOtpEmail(user.name, email, otp);
  } catch (error) {
    // email service is down → tell the client it failed so they can retry
    console.error("couldn't send OTP, try again", error);
    throw new CustomError(
      "failed to send OTP",
      StatusCodes.INTERNAL_SERVER_ERROR,
    );
  }

  // success → tell the client the code is on its way
  res
    .status(StatusCodes.OK)
    .json({ message: "OTP code has been sent successfully" });
};

// handles: POST /api/auth/verify-otp — checks the one-time code, verifies the email, and logs the user in
export const verifyOtp = async (req: Request, res: Response) => {
  // pull the email + code the client sent
  const { email, otp } = req.body;

  // both are required to look up and verify
  if (!email || !otp) {
    throw new CustomError(
      "email and OTP are required",
      StatusCodes.BAD_REQUEST,
    );
  }

  // find the active user by email; include the otp + otpExpire fields (normally excluded from queries)
  const user = await User.findOne({ email, isActive: true }).select(
    "+otp +otpExpire",
  );

  // no user with that email → 404
  if (!user) {
    throw new CustomError("user not found", StatusCodes.NOT_FOUND);
  }

  // hash the submitted code the same way we hashed it when generating it
  // (we never store the raw OTP, only its SHA-256 hash)
  const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");

  // reject if: no OTP stored, no expiry set, hash doesn't match, or the code has expired
  if (
    !user.otp ||
    !user.otpExpire ||
    user.otp !== hashedOtp ||
    user.otpExpire < new Date()
  ) {
    throw new CustomError("invalid or expired OTP", StatusCodes.BAD_REQUEST);
  }

  // clear the OTP fields (one-time use — can't be replayed)
  user.otp = undefined;
  user.otpExpire = undefined;

  // if the user hasn't verified their email yet, mark them as verified
  // (receiving + entering the OTP proves they own the inbox)
  if (email && !user.isVerified) {
    user.isVerified = true;
  }

  // persist changes to MongoDB
  await user.save();

  // create a short-lived access token (for API requests)
  const accessToken = user.createJwt();

  // create a long-lived refresh token (for future token refreshes)
  const refreshToken = await user.createRefreshToken();

  // set both as httpOnly cookies
  TokenHandler.attachAccessToken(res, accessToken);
  TokenHandler.attachRefreshToken(res, refreshToken);

  // respond with 200 + the user's public data
  res.status(StatusCodes.OK).json({
    message: "OTP verified successfully",
    data: { user: safeUserData(user) },
  });
};

// handles: POST /api/auth/oauth-login — logs in (or registers) a user via a third-party OAuth provider (e.g. Google)
export const oAuthLogin = async (req: Request, res: Response) => {
  // pull the provider name and the ID token the frontend got from the OAuth popup
  const { provider, idToken } = req.body;

  // both are required to proceed
  if (!provider || !idToken) {
    throw new CustomError(
      "provider and idToken are required",
      StatusCodes.BAD_REQUEST,
    );
  }

  // make sure the provider is one we actually support (e.g. "google", not "facebook")
  if (!Object.values(AuthProvider).includes(provider as AuthProvider)) {
    throw new CustomError("invalid provider", StatusCodes.BAD_REQUEST);
  }

  // send the token to the provider (Google) and get back the verified user profile
  // this is the only source of truth — we never trust the frontend for identity
  const verifiedProfile = await verifyWithProvider(
    provider as AuthProvider,
    idToken,
  );

  // first: look for a user who already linked this provider + providerId
  let user = await User.findByProvider(
    provider as AuthProvider,
    verifiedProfile.sub,
  );

  // second: if no linked user, check if an email-based account already exists with the same email
  // if so, link the provider to that existing account (merge, don't create a duplicate)
  if (!user && verifiedProfile.email) {
    const existingUser = await User.findByEmail(verifiedProfile.email);
    if (existingUser) {
      // attach the provider info to the existing account
      existingUser.provider = provider as AuthProvider;
      existingUser.providerId = verifiedProfile.sub;
      // if the user has no avatar yet, grab it from the provider profile
      if (verifiedProfile.picture && !existingUser.avatar) {
        existingUser.avatar = verifiedProfile.picture;
      }
      await existingUser.save();
      user = existingUser;
    }
  }

  // third: no linked user AND no matching email → create a brand-new account
  if (!user) {
    // the provider didn't send a name → we can't create an account without one
    if (!verifiedProfile.name) {
      throw new CustomError(
        "name required for new account",
        StatusCodes.BAD_REQUEST,
      );
    }
    // create the user; isVerified = true because the provider already confirmed the email
    user = await User.create({
      name: verifiedProfile.name,
      email: verifiedProfile.email || undefined,
      avatar: verifiedProfile.picture || undefined,
      provider: provider,
      providerId: verifiedProfile.sub,
      isVerified: true,
    });
  }

  // at this point `user` is either found, linked, or newly created
  // create a short-lived access token
  const accessToken = user.createJwt();

  // create a long-lived refresh token
  const refreshToken = await user.createRefreshToken();

  // set both as httpOnly cookies
  TokenHandler.attachAccessToken(res, accessToken);
  TokenHandler.attachRefreshToken(res, refreshToken);

  // respond with 200 + the user's public data
  res.status(StatusCodes.OK).json({
    message: "oAuth logged in successfully",
    data: { user: safeUserData(user) },
  });
};
