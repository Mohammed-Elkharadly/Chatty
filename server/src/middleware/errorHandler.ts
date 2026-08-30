import type { Request, Response, NextFunction } from 'express';
import { CustomError } from '../utils/customError.js';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // default values
  let statusCode = 500;
  let message = 'Internal Server Error';
  // if it's our CustomError
  if (err instanceof CustomError) {
    statusCode = err.statusCode;
    message = err.message;
  } else {
    // for unexpected Error
    console.log(err);
  }
  // send the response to client. finish of the request,
  // no need for next(). but we must call it in error middleware
  // Express checks the function length (4 params) to know it's an error handler.
  res.status(statusCode).json({ message, success: false });
};
