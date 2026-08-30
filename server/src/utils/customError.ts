export class CustomError extends Error {
  public statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    // 'this' is an instance from custom error like when we throw new CustomError(message, statusCode).
    Object.setPrototypeOf(this, CustomError.prototype);
  }
}
