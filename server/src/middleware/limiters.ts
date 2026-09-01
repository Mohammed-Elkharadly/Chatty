import type { Request, Response, NextFunction } from "express";
import rateLimit, { ipKeyGenerator, type Options } from "express-rate-limit";

// limits login attempts so one IP can't brute-force another user's account
export const loginLimiter = rateLimit({
  // how long the counter resets: 1 minute
  windowMs: 60 * 1000,
  // max tries per key before blocking
  limit: 3,
  // response body sent when the limit is hit
  message: {
    message:
      "Too many login attempts from this IP, please try again after a minute",
  },
  // custom handler: runs when limit is exceeded, sends 429 + our message
  handler(req: Request, res: Response, next: NextFunction, options: Options) {
    res.status(options.statusCode).json(options.message);
  },
  // send modern RateLimit-* headers to the client
  standardHeaders: true,
  // skip the old X-RateLimit-* headers
  legacyHeaders: false,
  // builds the tracking key: "ip:identifier" so each account is tracked separately
  keyGenerator: (req: Request) => {
    // figure out WHO is being targeted (email, phone, or provider id)
    const identifier =
      req.body?.email?.toLowerCase() ||
      req.body?.phone ||
      req.body?.providerId ||
      "unknown";
    // ipKeyGenerator() handles IPv6 correctly (truncates /128 to /64)
    // so an attacker can't bypass by rotating within the same /64 block
    return `${ipKeyGenerator(req.ip ?? "unknown")}:${identifier}`;
  },
});

// for account-recovery flows (forgot password, verify email, etc.) — 3 per IP per day
export const accountRecoveryLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  limit: 3,
  message: { success: false, message: "Too many requests, slow down" },
  standardHeaders: true,
  legacyHeaders: false,
  // no custom keyGenerator → defaults to IP-based (already IPv6-safe)
});

// for normal actions (send message, create post, upload) — 10 per IP per minute
export const strictLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  message: { success: false, message: "You're doing that too fast" },
  standardHeaders: true,
  legacyHeaders: false,
});

// for expensive actions (password reset, send email, AI) — 5 per IP per hour
export const heavyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  message: { success: false, message: "Limit reached, try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});
