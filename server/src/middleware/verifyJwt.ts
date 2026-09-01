import jwt from "jsonwebtoken";
import { isValidObjectId } from "mongoose";
import { User } from "../models/User.js";
import { ENV } from "../config/env.js";
import { CustomError } from "../utils/customError.js";
import { StatusCodes } from "http-status-codes";
import type { Request, Response, NextFunction } from "express";
import { isUserActive } from "../models/User.js";

// the shape we expect inside our JWT
interface jwtPayload {
  userId: string; // the MongoDB _id of the logged-in user
}

// middleware: runs before protected routes, confirms the user is authenticated + active
export const verifyJwt = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    // grab the accessToken cookie the browser sent
    const { accessToken } = req.cookies;
    // no cookie → not logged in
    if (!accessToken) {
      throw new CustomError(
        "Unauthorized - No token provided",
        StatusCodes.UNAUTHORIZED,
      );
    }

    let decoded: jwtPayload;

    // verify the token's signature + expiry against our secret
    try {
      // if valid, returns the payload; if expired/tampered, throws
      decoded = jwt.verify(accessToken, ENV.JWT_SECRET_KEY) as jwtPayload;
    } catch (error) {
      // token is invalid or expired → 401
      throw new CustomError(
        "Unauthorized - invalid token",
        StatusCodes.UNAUTHORIZED,
      );
    }

    // double-check the payload actually has a userId (defensive)
    // make sure the userId is a valid MongoDB ObjectId (24 hex chars)
    // prevents malformed queries hitting the DB
    if (!decoded.userId || !isValidObjectId(decoded.userId)) {
      throw new CustomError(
        "Unauthorized - invalid token",
        StatusCodes.UNAUTHORIZED,
      );
    }

    // fetch the user from DB (exclude password field)
    const user = await User.findById(decoded.userId).select("-password");

    // user doesn't exist or account is deactivated/banned
    if (!isUserActive(user)) {
      throw new CustomError(
        "unauthorized - account not active",
        StatusCodes.UNAUTHORIZED,
      );
    }

    // attach the user object to req so downstream controllers can use req.user
    req.user = user;

    // everything passed → continue to the next middleware/route handler
    next();
  } catch (error) {
    // if we already threw a CustomError, just forward it (don't log it as "unexpected")
    if (error instanceof CustomError) {
      return next(error);
    }
    // truly unexpected error (DB down, etc.) → log it, then forward
    console.error("Auth middleware error:", error);
    next(error);
  }
};
