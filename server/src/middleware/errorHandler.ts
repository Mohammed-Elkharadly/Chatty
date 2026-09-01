import type { Request, Response, NextFunction } from "express";
import { CustomError } from "../utils/customError.js";
import { MulterError } from "multer";

// maps Multer's internal error codes to human-readable messages
const MULTER_ERROR_MESSAGES: Record<string, string> = {
  LIMIT_FILE_SIZE: "File is too large (max 25MB)",
  LIMIT_UNEXPECTED_FILE: "Unexpected file field",
  LIMIT_FILE_COUNT: "Too many files",
};

// catches ALL errors thrown in any route/middleware and sends a JSON response
// must have exactly 4 params — Express uses param count to identify error middleware
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction, // not used, but required by Express to mark this as an error handler
) => {
  // fallback values if we don't recognize the error type
  let statusCode = 500;
  let message = "Internal Server Error";

  // case 1: we threw a CustomError ourselves (e.g. new CustomError("Not found", 404))
  if (err instanceof CustomError) {
    // use the status code and message we set when we threw it
    statusCode = err.statusCode;
    message = err.message;
  }
  // case 2: Multer rejected the upload before our controller even ran
  else if (err instanceof MulterError) {
    statusCode = 400;
    // look up a friendly message; fall back to generic if code is unknown
    message = MULTER_ERROR_MESSAGES[err.code] ?? "File upload error";
  }
  // case 3: something unexpected (DB crash, bug, etc.)
  else {
    // log the full stack trace so you can debug; don't send it to the client
    console.log(err);
  }

  // send the response — this ends the request, so no next() needed here
  res.status(statusCode).json({ message, success: false });
};
