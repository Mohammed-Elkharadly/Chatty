// extends Error → we get .message, .stack for free, but add our own .statusCode
export class CustomError extends Error {
  // every instance will have a statusCode (e.g. 400, 404, 500)
  public statusCode: number;

  // called when you do: new CustomError("Not found", 404)
  constructor(message: string, statusCode: number) {
    // pass message to the parent Error class (sets .message and .stack)
    super(message);
    // store the HTTP status code on this instance
    this.statusCode = statusCode;

    // Problem: TypeScript compiles `extends` in a way that breaks the
    // prototype chain. After `super()`, `this` points to a plain object,
    // NOT to an instance of CustomError. So `instanceof CustomError` returns false.
    //
    // What this does:
    //   Object.setPrototypeOf(this, CustomError.prototype)
    //
    //   - `this` = the current instance (the one you just created with `new`)
    //   - `CustomError.prototype` = the "blueprint" that says "this IS a CustomError"
    //
    //   It re-links them so that:
    //     - `err instanceof CustomError` → true 
    //     - `err instanceof Error` → true 
    //     - You can call any method you add to CustomError.prototype later
    //
    // Without this line, your errorHandler's `instanceof CustomError` check
    // would never match, and every error would fall through to a generic 500.
    Object.setPrototypeOf(this, CustomError.prototype);
  }
}   