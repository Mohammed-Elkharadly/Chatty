import jwt from "jsonwebtoken";
import { isValidObjectId } from "mongoose";
import { User } from "../models/User.js";
import { ENV } from "../config/env.js";
import { CustomError } from "../utils/customError.js";
import { StatusCodes } from "http-status-codes";
import type { Request, Response, NextFunction } from "express";
import { isUserActive } from "../models/User.js";

// define jwt structure
interface jwtPayload {
  userId: string;
}

export const verifyJwt = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { accessToken } = req.cookies;
    if (!accessToken) {
      throw new CustomError(
        "Unauthorized - No token provided",
        StatusCodes.UNAUTHORIZED,
      );
    }

    let decoded: jwtPayload;
    // Inner try-catch specifically for JWT verification
    try {
      decoded = jwt.verify(accessToken, ENV.JWT_SECRET_KEY) as jwtPayload;
    } catch (error) {
      // Convert JWT errors to proper 401 responses
      throw new CustomError(
        "Unauthorized - invalid token",
        StatusCodes.UNAUTHORIZED,
      );
    }
    // // Validate payload
    if (!decoded.userId) {
      throw new CustomError(
        "Unauthorized - invalid token",
        StatusCodes.UNAUTHORIZED,
      );
    }
    // Validate MongoDB ObjectId format BEFORE querying
    if (!decoded.userId || !isValidObjectId(decoded.userId)) {
      throw new CustomError(
        "Unauthorized - invalid token",
        StatusCodes.UNAUTHORIZED,
      );
    }
    // Find user by id
    const user = await User.findById(decoded.userId).select("-password");

    if (!isUserActive(user)) {
      throw new CustomError("unauthorized - account not active", StatusCodes.UNAUTHORIZED);
    }

    // attach user to client protected requests
    req.user = user;

    next();
  } catch (error) {
    if(error instanceof CustomError) {
      return next(error)
    }
    console.error("Auth middleware error:", error);
    next(error);
  }
};
