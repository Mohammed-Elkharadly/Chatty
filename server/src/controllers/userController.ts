import type { Request, Response } from "express";
import { StatusCodes } from "http-status-codes";
import { CustomError } from "../utils/customError.js";
import { safeUserData, User, AuthProvider } from "../models/User.js";
import { TokenHandler } from "../utils/tokenHandler.js";
import { isValidObjectId } from "mongoose";
import { uploadBufferToCloudinary } from "../utils/cloudinaryUpload.js";

const passRegEx = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).{8,}$/;


export const logout = async (req: Request, res: Response) => {
  if (req.user) {
    await req.user.invalidateRefreshToken();
  }
  TokenHandler.clearCookie(res);
  res.status(StatusCodes.OK).json({ message: "user logged out successfully" });
};

export const checkAuth = async (req: Request, res: Response) => {
  const id = req.user?._id;

  if (!id) {
    throw new CustomError("Not authenticated", StatusCodes.UNAUTHORIZED);
  }

  const user = await User.findById(id).select("-password");

  if (!user) {
    throw new CustomError("User not found", StatusCodes.NOT_FOUND);
  }

  res.status(StatusCodes.OK).json({ data: { user: safeUserData(user) } });
};

export const updateProfile = async (req: Request, res: Response) => {
  const { name, phone } = req.body;
  const file = req.file; // avatar, via upload.single('avatar')

  if (!file && !name && !phone) {
    throw new CustomError(
      "at least one field required",
      StatusCodes.BAD_REQUEST,
    );
  }

  // Validate userId
  const userId = req.user?._id;
  if (!userId || !isValidObjectId(userId)) {
    throw new CustomError("Unauthorized", StatusCodes.UNAUTHORIZED);
  }

  const updatedData: {
    avatar?: string;
    avatarPublicId?: string;
    name?: string;
    phone?: string;
  } = {};

  let previousAvatarPublicId: string | undefined;

  if (file) {
    if (!file.mimetype.startsWith("image/")) {
      throw new CustomError(
        "Avatar must be an image file",
        StatusCodes.BAD_REQUEST,
      );
    }
    // fetch the current avatarPublicId so we can delete it AFTER the new
    // upload succeeds (select:false, so it's not on req.user already)
    const currentUser = await User.findById(userId).select("+avatarPublicId");
    previousAvatarPublicId = currentUser?.avatarPublicId;

    try {
      const uploadResponse = await uploadBufferToCloudinary(file.buffer, {
        folder: "avatars",
        resourceType: "image",
      });
      updatedData.avatar = uploadResponse.secure_url;
      updatedData.avatarPublicId = uploadResponse.public_id;
    } catch (error) {
      throw new CustomError("Failed to upload avatar", StatusCodes.BAD_REQUEST);
    }
  }

  if (name !== undefined) {
    if (typeof name !== "string" || name.trim().length < 4) {
      throw new CustomError(
        "Name must be at least 4 characters",
        StatusCodes.BAD_REQUEST,
      );
    }
    // update name before save
    updatedData.name = name.trim();
  }

  if (phone !== undefined) {
    if (typeof phone !== "string" || phone.trim().length < 10) {
      throw new CustomError(
        "phone must be at least 10 numbers",
        StatusCodes.BAD_REQUEST,
      );
    }

    const normalizedPhone = phone.trim();

    // check if another user already owns this phone
    const existingUser = await User.findOne({
      phone: normalizedPhone,
      _id: { $ne: userId },
    });

    if (existingUser) {
      throw new CustomError(
        "this phone already exist",
        StatusCodes.BAD_REQUEST,
      );
    }
    // update name before save
    updatedData.phone = normalizedPhone;
  }

  // Update user in database
  const updatedUser = await User.findByIdAndUpdate(userId, updatedData, {
    new: true,
    runValidators: true,
  }).select("-password");

  if (!updatedUser) {
    throw new CustomError("User not found", StatusCodes.NOT_FOUND);
  }

  res
    .status(StatusCodes.OK)
    .json({ success: true, data: { user: safeUserData(updatedUser) } });
};

export const deleteAccount = async (req: Request, res: Response) => {
  const userId = req.user?._id;
  if (!userId || !isValidObjectId(userId)) {
    throw new CustomError("Unauthorized", StatusCodes.UNAUTHORIZED);
  }

  const user = await User.findById(userId).select("+password");
  if (!user) {
    throw new CustomError("user not found", StatusCodes.UNAUTHORIZED);
  }

  if (user.provider === AuthProvider.LOCAL) {
    const { password } = req.body;
    if (!password) {
      throw new CustomError(
        "password confirmation required to delete account",
        StatusCodes.BAD_REQUEST,
      );
    }
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw new CustomError("incorrect password", StatusCodes.UNAUTHORIZED);
    }
  }

  user.isActive = false;
  user.deletedAt = new Date();
  await user.save();

  await user.invalidateRefreshToken();
  TokenHandler.clearCookie(res);

  res.status(StatusCodes.OK).json({ message: "account deleted successfully" });
};

export const changePassword = async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    throw new CustomError(
      "current password and new password are required",
      StatusCodes.BAD_REQUEST,
    );
  }

  if (!passRegEx.test(newPassword)) {
    throw new CustomError(
      "'Must contain uppercase, lowercase, number, and special character.",
      StatusCodes.BAD_REQUEST,
    );
  }

  const userId = req.user?._id;

  if (!userId || !isValidObjectId(userId)) {
    throw new CustomError("unauthorized", StatusCodes.UNAUTHORIZED);
  }

  const user = await User.findById(userId).select("+password");
  if (!user) {
    throw new CustomError("user not found", StatusCodes.UNAUTHORIZED);
  }

  await user.changePassword(currentPassword, newPassword);

  await user.invalidateRefreshToken();

  TokenHandler.clearCookie(res);

  res.status(StatusCodes.OK).json({
    message: "password changed successfully, please log in again",
  });
};
