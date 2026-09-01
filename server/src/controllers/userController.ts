import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { CustomError } from "../utils/customError.js";
import { safeUserData, User, AuthProvider } from "../models/User.js";
import { TokenHandler } from "../utils/tokenHandler.js";
import { isValidObjectId } from "mongoose";
import {
  uploadBufferToCloudinary,
  deleteFromCloudinary,
} from "../utils/cloudinaryUpload.js";

const passRegEx = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).{8,}$/;

// handles: POST /api/auth/logout — invalidates the session and clears cookies
export const logout = async (req: Request, res: Response) => {
  // if the user is authenticated (verifyJwt middleware ran and attached req.user)
  if (req.user) {
    // remove the stored refresh token from the DB → all future refresh attempts will fail
    await req.user.invalidateRefreshToken();
  }
  // clear both accessToken + refreshToken cookies from the browser
  TokenHandler.clearCookie(res);

  // respond with 200
  res.status(StatusCodes.OK).json({ message: "user logged out successfully" });
};

// handles: GET /api/auth/check — confirms the current user is logged in and returns their profile
export const checkAuth = async (req: Request, res: Response) => {
  // get the userId that verifyJwt middleware attached to req.user
  const id = req.user?._id;

  // if verifyJwt didn't run (route is public) or something went wrong
  if (!id) {
    throw new CustomError("Not authenticated", StatusCodes.UNAUTHORIZED);
  }

  // re-fetch the user fresh from DB (req.user might be stale if another tab changed their profile)
  const user = await User.findById(id).select("-password");

  // user was deleted or deactivated after the token was issued
  if (!user) {
    throw new CustomError("User not found", StatusCodes.NOT_FOUND);
  }

  // return the sanitized user object (toJSON strips sensitive fields)
  res.status(StatusCodes.OK).json({ data: { user: safeUserData(user) } });
};

// handles: PATCH /api/user/profile — updates name, phone, and/or avatar
export const updateProfile = async (req: Request, res: Response) => {
  // pull the fields the client sent (at least one must be present)
  const { name, phone } = req.body;
  // the uploaded avatar file (from upload.single("avatar") middleware)
  const file = req.file;

  // if nothing was sent → reject
  if (!file && !name && !phone) {
    throw new CustomError(
      "at least one field required",
      StatusCodes.BAD_REQUEST,
    );
  }

  // get the logged-in user's _id (attached by verifyJwt middleware)
  const userId = req.user?._id;
  // safety check: id must exist and be a valid ObjectId
  if (!userId || !isValidObjectId(userId)) {
    throw new CustomError("Unauthorized", StatusCodes.UNAUTHORIZED);
  }

  // object that will hold only the fields being updated (avoids overwriting others)
  const updatedData: {
    avatar?: string;
    avatarPublicId?: string;
    name?: string;
    phone?: string;
  } = {};

  // stores the old avatar's Cloudinary ID so we can delete it after the new one uploads
  let previousAvatarPublicId: string | undefined;

  // --- AVATAR ---
  if (file) {
    // double-check it's actually an image (upload middleware already filters, but belt-and-suspenders)
    if (!file.mimetype.startsWith("image/")) {
      throw new CustomError(
        "Avatar must be an image file",
        StatusCodes.BAD_REQUEST,
      );
    }

    // fetch the current avatarPublicId (it's select:false, so it's not on req.user)
    // we need it to delete the old file from Cloudinary after the new upload succeeds
    const currentUser = await User.findById(userId).select("+avatarPublicId");
    previousAvatarPublicId = currentUser?.avatarPublicId;

    // upload the new avatar to Cloudinary
    try {
      const uploadResponse = await uploadBufferToCloudinary(file.buffer, {
        folder: "avatars",
        resourceType: "image",
      });
      // store the new URL + public ID for the DB update
      updatedData.avatar = uploadResponse.secure_url;
      updatedData.avatarPublicId = uploadResponse.public_id;
    } catch (error) {
      // Cloudinary is down or rejected the file
      throw new CustomError(
        "Failed to upload avatar",
        StatusCodes.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // --- NAME ---
  if (name !== undefined) {
    // must be a string with at least 4 chars after trimming
    if (typeof name !== "string" || name.trim().length < 4) {
      throw new CustomError(
        "Name must be at least 4 characters",
        StatusCodes.BAD_REQUEST,
      );
    }
    updatedData.name = name.trim();
  }

  // --- PHONE ---
  if (phone !== undefined) {
    // must be a string with at least 10 digits
    if (typeof phone !== "string" || phone.trim().length < 10) {
      throw new CustomError(
        "phone must be at least 10 numbers",
        StatusCodes.BAD_REQUEST,
      );
    }

    const normalizedPhone = phone.trim();

    // make sure no OTHER user already has this phone number
    const existingUser = await User.findOne({
      phone: normalizedPhone,
      _id: { $ne: userId }, // exclude self (updating to your own number is fine)
    });

    if (existingUser) {
      throw new CustomError(
        "this phone already exist",
        StatusCodes.BAD_REQUEST,
      );
    }

    updatedData.phone = normalizedPhone;
  }

  // write the changes to the DB
  // new: true → return the updated document (not the old one)
  // runValidators: true → schema validators (minlength, enum, etc.) still apply
  const updatedUser = await User.findByIdAndUpdate(userId, updatedData, {
    new: true,
    runValidators: true,
  }).select("-password");

  // user was deleted between the check and the update (race condition)
  if (!updatedUser) {
    throw new CustomError("User not found", StatusCodes.NOT_FOUND);
  }

  // delete the old avatar from Cloudinary now that the new one is saved
  if (previousAvatarPublicId && file) {
    try {
      await deleteFromCloudinary(previousAvatarPublicId, "image");
    } catch (error) {
      // don't fail the whole request if the old file deletion fails
      console.error("Failed to delete old avatar:", error);
    }
  }

  // return the sanitized user object
  res
    .status(StatusCodes.OK)
    .json({ success: true, data: { user: safeUserData(updatedUser) } });
};

// handles: DELETE /api/user/account — soft-deletes the user's account (sets isActive=false, deletedAt=now)
export const deleteAccount = async (req: Request, res: Response) => {
  // get the logged-in user's _id (attached by verifyJwt middleware)
  const userId = req.user?._id;
  // safety check: id must exist and be a valid ObjectId
  if (!userId || !isValidObjectId(userId)) {
    throw new CustomError("Unauthorized", StatusCodes.UNAUTHORIZED);
  }

  // fetch the user with password included (needed for the confirmation step below)
  const user = await User.findById(userId).select("+password");
  // user doesn't exist (race: deleted between middleware and here)
  if (!user) {
    throw new CustomError("user not found", StatusCodes.UNAUTHORIZED);
  }

  // if the user signed up with email+password, require them to confirm it before deletion
  // (OAuth users skip this — they'd need to re-authenticate with Google instead)
  if (user.provider === AuthProvider.LOCAL) {
    const { password } = req.body;
    // no password sent → can't confirm identity
    if (!password) {
      throw new CustomError("password confirmation required to delete account", StatusCodes.BAD_REQUEST);
    }
    // compare the submitted password against the stored bcrypt hash
    const isMatch = await user.comparePassword(password);
    // wrong password → reject
    if (!isMatch) {
      throw new CustomError("incorrect password", StatusCodes.UNAUTHORIZED);
    }
  }

  // mark the account as inactive (excluded from all queries that filter by isActive: true)
  user.isActive = false;
  // set the soft-delete timestamp (frees up email/phone/providerId in partial indexes)
  user.deletedAt = new Date();
  await user.save();

  // invalidate the refresh token → all other sessions/devices are logged out
  await user.invalidateRefreshToken();
  // clear the cookies from this browser
  TokenHandler.clearCookie(res);

  // respond with 200
  res.status(StatusCodes.OK).json({ message: "account deleted successfully" });
};   

// handles: PUT /api/user/password — lets the user change their password (requires current password)
export const changePassword = async (req: Request, res: Response) => {
  // pull the old + new password from the request body
  const { currentPassword, newPassword } = req.body;

  // both are required to proceed
  if (!currentPassword || !newPassword) {
    throw new CustomError("current password and new password are required", StatusCodes.BAD_REQUEST);
  }

  // enforce password strength on the new password (8+ chars, upper, lower, digit, special)
  if (!passRegEx.test(newPassword)) {
    throw new CustomError("'Must contain uppercase, lowercase, number, and special character.", StatusCodes.BAD_REQUEST);
  }

  // get the logged-in user's _id (attached by verifyJwt middleware)
  const userId = req.user?._id;
  // safety check: id must exist and be a valid ObjectId
  if (!userId || !isValidObjectId(userId)) {
    throw new CustomError("unauthorized", StatusCodes.UNAUTHORIZED);
  }

  // fetch the user with password included (needed to verify the current password)
  const user = await User.findById(userId).select("+password");
  // user doesn't exist (race: deleted between middleware and here)
  if (!user) {
    throw new CustomError("user not found", StatusCodes.UNAUTHORIZED);
  }

  // verifies currentPassword matches, then sets newPassword (pre-save hook hashes it)
  // throws "Current password incorrect" if the old one doesn't match
  await user.changePassword(currentPassword, newPassword);

  // invalidate the refresh token → all other sessions/devices are logged out
  // (security: if someone knew your old password, their sessions are now dead)
  await user.invalidateRefreshToken();
  // clear the cookies from this browser too
  TokenHandler.clearCookie(res);

  // tell the client to go back to the login page
  res.status(StatusCodes.OK).json({
    message: "password changed successfully, please log in again",
  });
};   