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

const passRegEx = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).{8,}$/;

export const signup = async (req: Request, res: Response) => {
  // destruct credentials from req.body
  const { name, email, password, phone } = req.body;
  // validate using Validator class
  Validator.validateSignup(name, email, password, phone);
  // check if email is exist
  if (email) {
    const duplicateEmail = await User.findByEmail(email);
    if (duplicateEmail) {
      throw new CustomError("choose a valid email", StatusCodes.BAD_REQUEST);
    }
  }
  // check if phone exist
  if (phone) {
    const duplicatePhone = await User.findByPhone(phone);
    if (duplicatePhone) {
      throw new CustomError(
        "choose a valid phone number",
        StatusCodes.BAD_REQUEST,
      );
    }
  }
  // create user
  const user = await User.create({ name, email, password, phone });
  // generate verivicationToken
  const verificationToken = await user.generateVerificationToken();
  // send welcome email to the user
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
      console.log(error);
    }
  }
  // create json web token
  const accessToken = user.createJwt();
  // custom token handler for cookie
  TokenHandler.attachAccessToken(res, accessToken);
  // send the response
  res.status(StatusCodes.CREATED).json({
    message: "User created successfully",
    data: {
      user: safeUserData(user),
    },
  });
};

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email, isActive: true }).select(
    "+password",
  );

  await Validator.validateLogin(password, user);

  // Check if account is locked
  if (user?.isAccountLocked()) {
    throw new CustomError(
      "account temporarily locked, try again later",
      StatusCodes.UNAUTHORIZED,
    );
  }

  if (!isUserActive(user)) {
    throw new CustomError("invalid credentials", StatusCodes.UNAUTHORIZED);
  }

  await user.resetLoginAttempts();

  await user.updateLastLogin();

  const accessToken = user.createJwt();
  const refreshToken = await user.createRefreshToken();

  TokenHandler.attachAccessToken(res, accessToken);
  TokenHandler.attachRefreshToken(res, refreshToken);

  res.status(StatusCodes.OK).json({
    message: "user logged in successfully",
    data: {
      user: safeUserData(user),
    },
  });
};

export const refreshToken = async (req: Request, res: Response) => {
  const refreshToken = req.cookies?.refreshToken;

  if (!refreshToken) {
    throw new CustomError(
      "no refresh token provided",
      StatusCodes.UNAUTHORIZED,
    );
  }

  const secret = ENV.JWT_REFRESH_SECRET_KEY;

  if (!secret) {
    throw new CustomError(
      "server misconfiguration",
      StatusCodes.INTERNAL_SERVER_ERROR,
    );
  }

  let decoded: { userId: string };

  try {
    decoded = jwt.verify(refreshToken, secret) as { userId: string };
  } catch (error) {
    throw new CustomError(
      "Invalid or expired refresh token",
      StatusCodes.UNAUTHORIZED,
    );
  }

  const user = await User.findById(decoded.userId).select("+refreshToken");

  if (!user || user.refreshToken !== refreshToken) {
    throw new CustomError("Invalid refresh token", StatusCodes.UNAUTHORIZED);
  }

  if (!isUserActive(user)) {
    throw new CustomError("account inactive", StatusCodes.UNAUTHORIZED);
  }

  const newAccessToken = user.createJwt();
  const newRefreshToken = await user.createRefreshToken();

  TokenHandler.attachAccessToken(res, newAccessToken);
  TokenHandler.attachRefreshToken(res, newRefreshToken);

  res.status(StatusCodes.OK).json({
    message: "token refreshed successfully",
    data: { user: safeUserData(user) },
  });
};

export const verifyEmail = async (req: Request, res: Response) => {
  const token = req.params.token || req.body.token;
  const isLinkClick = req.method === "GET";

  const user = await User.findWithVerificationToken(token);

  if (!user) {
    if (isLinkClick) {
      return res.redirect(`${ENV.CLIENT_URL}/verify-email/error`);
    }
    throw new CustomError(
      !token || typeof token !== "string"
        ? "Verification token required"
        : "invalid or expired token",
      StatusCodes.BAD_REQUEST,
    );
  }

  user.isVerified = true;
  user.verificationToken = undefined;
  user.verificationTokenExpire = undefined;
  await user.save();

  if (isLinkClick) {
    return res.redirect(`${ENV.CLIENT_URL}/verify-email/success`);
  }

  res.status(StatusCodes.OK).json({ message: "email verified successfully" });
};

export const resendVerification = async (req: Request, res: Response) => {
  const { email } = req.body;

  if (!email) {
    throw new CustomError(
      "email is required to send another verification token",
      StatusCodes.BAD_REQUEST,
    );
  }

  const user = await User.findByEmail(email);

  if (!user || user.isVerified) {
    res.status(StatusCodes.OK).json({
      message: "If an account exists, a verification email has been sent!",
    });
    return;
  }

  const verificationToken = await user.generateVerificationToken();

  if (!user.email) {
    throw new CustomError(
      "email is required to send another verification token",
      StatusCodes.BAD_REQUEST,
    );
  }

  try {
    await verificationEmail(
      user.name,
      user.email,
      verificationToken,
      ENV.SERVER_URL,
    );
  } catch (error) {
    console.error("failed to send verification token", error);
  }

  res.status(StatusCodes.OK).json({
    message: "If an account exists, a verification email has been sent",
  });
};

export const forgotPassword = async (req: Request, res: Response) => {
  const { email } = req.body;

  if (!email) {
    throw new CustomError("email is required", StatusCodes.BAD_REQUEST);
  }

  const user = await User.findByEmail(email);

  const canResetPassword =
    user?.provider === AuthProvider.LOCAL || !!user?.password;

  if (!user || !user.email || !canResetPassword) {
    res.status(StatusCodes.OK).json({
      message: "if an account exist, the reset link has been sent!",
    });
    return;
  }

  const resetPasswordToken = await user.generateResetPasswordToken();

  try {
    await forgotPasswordEmail(
      user.name,
      user.email,
      resetPasswordToken,
      ENV.CLIENT_URL,
    );
  } catch (error) {
    console.error("reset password failed", error);
  }

  res.status(StatusCodes.OK).json({
    message: "if an account exist, the reset link has been sent",
  });
};

export const resetPassword = async (req: Request, res: Response) => {
  if (req.method === "GET" && req.params.token && !req.body.password) {
    return res.redirect(
      `${ENV.CLIENT_URL}/reset-password?token=${req.params.token}`,
    );
  }

  const { token, password } = req.body;
  const resetToken = req.params.token || token;

  if (!resetToken || !password) {
    throw new CustomError("password is required", StatusCodes.BAD_REQUEST);
  }

  if (!passRegEx.test(password)) {
    throw new CustomError(
      "'Must contain uppercase, lowercase, number, and special character.",
      StatusCodes.BAD_REQUEST,
    );
  }

  const user = await User.findWithResetToken(resetToken);

  if (!user) {
    throw new CustomError("invalid or expire token", StatusCodes.BAD_REQUEST);
  }

  user.password = password;
  user.isVerified = true;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpire = undefined;
  user.refreshToken = undefined;
  user.loginAttempts = 0;
  user.lockUntil = undefined;

  await user.save();

  res.status(StatusCodes.OK).json({
    message: "password reset successfully, please log in again",
  });
};


export const sendOtp = async (req: Request, res: Response) => {
  const { email } = req.body;

  if (!email) {
    throw new CustomError("email is required", StatusCodes.BAD_REQUEST);
  }

  const user = await User.findByEmail(email);

  if (!user) {
    res
      .status(StatusCodes.OK)
      .json({ message: "OTP code has been sent successfully!!" });
    return;
  }

  const otp = await user.generateOTP();

  try {
    await sendOtpEmail(user.name, email, otp);
  } catch (error) {
    console.error("couldn't send OTP, try again", error);
    throw new CustomError(
      "failed to send OTP",
      StatusCodes.INTERNAL_SERVER_ERROR,
    );
  }

  res
    .status(StatusCodes.OK)
    .json({ message: "OTP code has been sent successfully" });
};

export const verifyOtp = async (req: Request, res: Response) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    throw new CustomError(
      "email and OTP are required",
      StatusCodes.BAD_REQUEST,
    );
  }

  const user = await User.findOne({ email, isActive: true }).select(
    "+otp +otpExpire",
  );

  if (!user) {
    throw new CustomError("user not found", StatusCodes.NOT_FOUND);
  }

  const hashedOtp = crypto.createHash("sha256").update(otp).digest("hex");

  if (
    !user.otp ||
    !user.otpExpire ||
    user.otp !== hashedOtp ||
    user.otpExpire < new Date()
  ) {
    throw new CustomError("invalid or expired OTP", StatusCodes.BAD_REQUEST);
  }

  user.otp = undefined;
  user.otpExpire = undefined;

  if (email && !user.isVerified) {
    user.isVerified = true;
  }

  await user.save();

  const accessToken = user.createJwt();
  const refreshToken = await user.createRefreshToken();

  TokenHandler.attachAccessToken(res, accessToken);
  TokenHandler.attachRefreshToken(res, refreshToken);

  res.status(StatusCodes.OK).json({
    message: "OTP verified successfully",
    data: { user: safeUserData(user) },
  });
};

export const oAuthLogin = async (req: Request, res: Response) => {
  const { provider, idToken } = req.body;

  if (!provider || !idToken) {
    throw new CustomError(
      "provider and idToken are required",
      StatusCodes.BAD_REQUEST,
    );
  }

  if (!Object.values(AuthProvider).includes(provider as AuthProvider)) {
    throw new CustomError("invalid provider", StatusCodes.BAD_REQUEST);
  }

  // ask the provider directly — this is the only source of truth for
  // who this token actually belongs to
  const verifiedProfile = await verifyWithProvider(
    provider as AuthProvider,
    idToken,
  );

  let user = await User.findByProvider(
    provider as AuthProvider,
    verifiedProfile.sub,
  );

  if (!user && verifiedProfile.email) {
    const existingUser = await User.findByEmail(verifiedProfile.email);
    if (existingUser) {
      existingUser.provider = provider as AuthProvider;
      existingUser.providerId = verifiedProfile.sub;
      if (verifiedProfile.picture && !existingUser.avatar) {
        existingUser.avatar = verifiedProfile.picture;
      }
      await existingUser.save();
      user = existingUser;
    }
  }

  if (!user) {
    if (!verifiedProfile.name) {
      throw new CustomError(
        "name required for new account",
        StatusCodes.BAD_REQUEST,
      );
    }
    user = await User.create({
      name: verifiedProfile.name,
      email: verifiedProfile.email || undefined,
      avatar: verifiedProfile.picture || undefined,
      provider: provider,
      providerId: verifiedProfile.sub,
      isVerified: true,
    });
  }

  const accessToken = user.createJwt();
  const refreshToken = await user.createRefreshToken();

  TokenHandler.attachAccessToken(res, accessToken);
  TokenHandler.attachRefreshToken(res, refreshToken);

  res.status(StatusCodes.OK).json({
    message: "oAuth logged in successfully",
    data: { user: safeUserData(user) },
  });
};
