import type { Request, Response, NextFunction } from "express";
import rateLimit, { ipKeyGenerator, type Options } from "express-rate-limit";

// 1. Login attempts (per IP + identifier, so one IP can't lock out another user's account by spamming it, and vice versa)
export const loginLimiter = rateLimit({
  windowMs: 60 * 1000, // time window: 1 minute (60,000 milliseconds)
  limit: 3, // max requests allowed per key within the window before the client gets blocked
  message: {
    message:
      "Too many login attempts from this IP, please try again after a minute",
  },
  handler(req: Request, res: Response, next: NextFunction, options: Options) {
    // runs once the limit is hit instead of the default response
    // sends the appropriate status code (429 Too Many Requests) and the custom message
    res.status(options.statusCode).json(options.message);
  },
  // these control which rate-limit headers express sends back to the client
  standardHeaders: true, // send RateLimit-* headers (current standard)
  legacyHeaders: false, // don't send the older X-RateLimit-* headers
  keyGenerator: (req: Request) => {
    // build a key that's specific to *this* login attempt, not just the IP,
    // so the limiter tracks "this IP trying this account" rather than
    // treating every login attempt from an IP as the same bucket
    const identifier =
      req.body?.email?.toLowerCase() ||
      req.body?.phone ||
      req.body?.providerId ||
      "unknown";
    // ipKeyGenerator() normalizes/truncates IPv6 addresses correctly before
    // using them as part of the key — using req.ip directly would let an
    // IPv6 client bypass the limit by requesting from different addresses
    // within the same /64 block 
    return `${ipKeyGenerator(req.ip ?? "unknown")}:${identifier}`;
  },
});

// 2. General API (most normal routes) — used for account-recovery-style flows
export const accountRecoveryLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  limit: 3, // 3 requests per IP per day
  message: { success: false, message: "Too many requests, slow down" },
  standardHeaders: true,
  legacyHeaders: false,
  // no custom keyGenerator, so this defaults to express-rate-limit's built-in
  // IP-based key (already IPv6-safe)
});

// 3. Sensitive / expensive actions (send message, create post, upload...)
export const strictLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  limit: 10, // 10 requests per IP per minute
  message: { success: false, message: "You're doing that too fast" },
  standardHeaders: true,
  legacyHeaders: false,
});

// 4. Very expensive actions (password reset, send email, AI generation...)
export const heavyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  limit: 5, // 5 requests per IP per hour
  message: { success: false, message: "Limit reached, try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});