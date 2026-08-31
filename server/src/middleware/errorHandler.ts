import type { Request, Response, NextFunction } from "express";
import { CustomError } from "../utils/customError.js";
import { MulterError } from "multer";

const MULTER_ERROR_MESSAGES: Record<string, string> = {
  LIMIT_FILE_SIZE: "File is too large (max 25MB)",
  LIMIT_UNEXPECTED_FILE: "Unexpected file field",
  LIMIT_FILE_COUNT: "Too many files",
};

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // default values
  let statusCode = 500;
  let message = "Internal Server Error";
  // if it's our CustomError
  if (err instanceof CustomError) {
    statusCode = err.statusCode;
    message = err.message;
  } else if (err instanceof MulterError) {
    // thrown by Multer itself (e.g. file too large) — happens before our
    // own fileFilter/controller code ever runs, so it's not a CustomError
    statusCode = 400;
    message = MULTER_ERROR_MESSAGES[err.code] ?? "File upload error";
  } else {
    // for unexpected Error
    console.log(err);
  }
  // send the response to client. finish of the request,
  // no need for next(). but we must call it in error middleware
  // Express checks the function length (4 params) to know it's an error handler.
  res.status(statusCode).json({ message, success: false });
};
