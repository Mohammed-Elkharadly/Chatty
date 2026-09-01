import { Schema, model, Model, type HydratedDocument } from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { ENV } from "../config/env.js";

// the type you get when Mongoose returns a user (includes .save(), .toObject(), + all custom methods)
export type UserDocument = HydratedDocument<IUser, IUserMethods>;

// who can be in the system
export enum UserRole {
  USER = "user", // normal user
  ADMIN = "admin", // can access admin routes
}

// how the user signed up
export enum AuthProvider {
  LOCAL = "local", // email + password
  GOOGLE = "google", // Google OAuth
  FACEBOOK = "facebook", // Facebook OAuth (future)
  PHONE = "phone", // phone + OTP (future)
}

// the shape of a user document in MongoDB
export interface IUser {
  name: string;
  email?: string | undefined; // optional (phone-only users won't have one)
  phone?: string | undefined; // optional (email-only users won't have one)
  password?: string | undefined; // hashed; undefined for OAuth-only users
  avatar?: string | undefined; // Cloudinary URL
  avatarPublicId?: string | undefined; // Cloudinary ID (needed for deletion)

  // OAuth: which provider + their unique ID for this user
  provider: AuthProvider;
  providerId?: string; // e.g. Google's `sub` claim

  // OTP: one-time code stored as SHA-256 hash + when it expires
  otp?: string | undefined;
  otpExpire?: Date | undefined;

  // Email verification: token + expiry (cleared once verified)
  isVerified: boolean;
  verificationToken?: string | undefined;
  verificationTokenExpire?: Date | undefined;

  // Password reset: one-time token + expiry (cleared after use)
  resetPasswordToken?: string | undefined;
  resetPasswordExpire?: Date | undefined;

  // Security: tracks login attempts for brute-force protection
  lastLogin: Date;
  loginAttempts: number; // consecutive failed attempts (resets on success)
  lockUntil?: Date | undefined; // if set, account is locked until this time
  refreshToken?: string | undefined; // stored for rotation (invalidates old sessions)

  // Account status
  isActive: boolean; // false = deactivated/banned
  deletedAt?: Date | undefined; // soft-delete timestamp (for future "restore account")
  role: UserRole;
}

// custom methods attached to every user document
interface IUserMethods {
  // --- authentication ---
  createJwt(): string; // signs a short-lived access token with the user's _id
  comparePassword(candidate: string): Promise<boolean>; // bcrypt.compare(candidate, this.password)
  createRefreshToken(): Promise<string>; // generates, stores, and returns a long-lived refresh token
  invalidateRefreshToken(): Promise<void>; // clears the stored refresh token (logs out everywhere)

  // --- token generation ---
  generateVerificationToken(): Promise<string>; // creates a one-time email verification token
  generateResetPasswordToken(): Promise<string>; // creates a one-time password reset token
  generateOTP(): Promise<string>; // creates a one-time code (hashed before storing)

  // --- account management ---
  isAccountLocked(): boolean; // true if lockUntil is in the future
  incrementLoginAttempts(): Promise<void>; // +1 failed attempt, locks account if threshold hit
  resetLoginAttempts(): Promise<void>; // sets loginAttempts = 0, clears lockUntil
  updateLastLogin(): Promise<void>; // sets lastLogin = now
  lockAccount(minutes: number): Promise<void>; // sets lockUntil = now + minutes
  unlockAccount(): Promise<void>; // clears lockUntil

  // --- password management ---
  changePassword(password: string, newPassword: string): Promise<void>; // verifies old, sets new
}

// static methods on the Model (called as User.findByEmail(...), not user.findByEmail(...))
interface IUserModel extends Model<IUser, {}, IUserMethods> {
  // find a user by their email (case-insensitive, active only)
  findByEmail(email: string): Promise<UserDocument | null>;
  // find a user by their phone number
  findByPhone(phone: string): Promise<UserDocument | null>;
  // find a user by their OAuth provider + provider-specific ID
  findByProvider(
    provider: AuthProvider,
    providerId: string,
  ): Promise<UserDocument | null>;

  // find a user whose verificationToken matches and hasn't expired
  findWithVerificationToken(token: string): Promise<UserDocument | null>;
  // find a user whose resetPasswordToken matches and hasn't expired
  findWithResetToken(token: string): Promise<UserDocument | null>;
  // deletes all expired tokens (called by the hourly cron job in server.ts)
  cleanupExpiredToken(): Promise<void>;
}

// Iuser => Document shape (fields)
// Model<Iuser, {}, IuserMethods>, => Model type
// IuserMethods => Instance methods

// the main schema — defines every field, its type, and validation rules
const userSchema = new Schema<IUser, IUserModel, IUserMethods>(
  {
    // display name, required, strips whitespace on save
    name: {
      type: String,
      required: true,
      trim: true,
    },
    // stored lowercase so "User@Gmail.com" and "user@gmail.com" are the same
    email: {
      type: String,
      lowercase: true,
      trim: true,
    },
    // optional (email-only users won't have one)
    phone: {
      type: String,
      trim: true,
    },
    // hashed with bcrypt before saving; select: false means it's excluded from queries by default
    // (you must explicitly .select("+password") to get it, e.g. during login)
    password: {
      type: String,
      minlength: [8, "Password must be at least 8 characters"],
      select: false,
    },
    // Cloudinary URL for the avatar (public, shown in UI)
    avatar: {
      type: String,
    },
    // Cloudinary's internal ID (needed to delete the file; hidden from queries by default)
    avatarPublicId: {
      type: String,
      select: false,
    },

    // --- Auth provider ---
    // how this user signed up (local, google, etc.)
    provider: {
      type: String,
      enum: Object.values(AuthProvider), // only allows "local" | "google" | "facebook" | "phone"
      default: AuthProvider.LOCAL,
    },
    // the provider's unique ID for this user (e.g. Google's `sub`); hidden by default
    providerId: {
      type: String,
      select: false,
    },

    // --- OTP ---
    // SHA-256 hash of the one-time code (never store the raw code); hidden by default
    otp: {
      type: String,
      select: false,
    },
    // when the OTP expires (e.g. now + 5 min); hidden by default
    otpExpire: {
      type: Date,
      select: false,
    },

    // --- Email verification ---
    // has the user confirmed their email?
    isVerified: {
      type: Boolean,
      default: false,
    },
    // one-time token sent in the verification email; hidden by default
    verificationToken: {
      type: String,
      select: false,
    },
    // when the verification token expires; hidden by default
    verificationTokenExpire: {
      type: Date,
      select: false,
    },

    // --- Password reset ---
    // one-time token sent in the reset email; hidden by default
    resetPasswordToken: {
      type: String,
      select: false,
    },
    // when the reset token expires; hidden by default
    resetPasswordExpire: {
      type: Date,
      select: false,
    },

    // --- Security ---
    // when the user last logged in
    lastLogin: Date,
    // consecutive failed login attempts (resets to 0 on success)
    loginAttempts: {
      type: Number,
      default: 0,
    },
    // if set, the account is locked until this timestamp (brute-force protection)
    lockUntil: Date,
    // stored refresh token for rotation; hidden by default
    refreshToken: {
      type: String,
      select: false,
    },

    // --- Account status ---
    // permission level (user or admin)
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.USER,
    },
    // false = deactivated/banned (soft-delete alternative)
    isActive: {
      type: Boolean,
      default: true,
    },
    // if set, the account is "deleted" (soft-delete); the doc stays in DB but is excluded from indexes
    deletedAt: Date,
  },
  {
    // auto-adds createdAt + updatedAt to every document
    timestamps: true,
  },
);

// --- INDEXES ---

// unique email, but ONLY for docs that actually have an email AND aren't soft-deleted
// (phone-only users skip this index; deleted users free up their email for reuse)
userSchema.index(
  { email: 1 },
  {
    unique: true,
    partialFilterExpression: {
      email: { $type: "string" }, // only index docs where email exists
      deletedAt: { $exists: false }, // skip soft-deleted docs
    },
  },
);

// same logic for phone — unique only among active, phone-having users
userSchema.index(
  { phone: 1 },
  {
    unique: true,
    partialFilterExpression: {
      phone: { $type: "string" },
      deletedAt: { $exists: false },
    },
  },
);

// unique (provider + providerId) pair — prevents the same Google account from linking twice
// only applies to docs that actually have a providerId (local users skip this)
userSchema.index(
  { provider: 1, providerId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      providerId: { $exists: true },
      deletedAt: { $exists: false },
    },
  },
);

// speeds up "find user by verification token" (used in verifyEmail)
userSchema.index({ verificationToken: 1 });

// speeds up "find user by reset token" (used in resetPassword)
userSchema.index({ resetPasswordToken: 1 });

// speeds up admin queries like "find all active users" or "find all admins"
userSchema.index({ role: 1, isActive: 1 });

// ============ middleware / pre hooks ============

// runs automatically before every .save() — hashes the password if it was changed
userSchema.pre("save", async function (this: UserDocument) {
  // if no password (OAuth user) OR password wasn't modified → skip
  if (!this.password || !this.isModified("password")) return;
  try {
    // generate a random salt (10 rounds)
    const salt = await bcrypt.genSalt(10);
    // replace the plain password with its bcrypt hash
    this.password = await bcrypt.hash(this.password, salt);
  } catch (error) {
    throw error;
  }
});

// ============ instance methods ============

// compares a plain-text candidate password against the stored hash
userSchema.methods.comparePassword = async function (
  this: UserDocument,
  candidate: string, // the plain-text password the user typed
): Promise<boolean> {
  // no stored hash (OAuth user) → can't compare
  if (!this.password) return false;
  // bcrypt.compare handles the salt internally (it's embedded in the hash)
  return await bcrypt.compare(candidate, this.password);
};

// signs a short-lived JWT containing the user's _id
userSchema.methods.createJwt = function (this: UserDocument): string {
  // the secret used to sign access tokens
  const secret = ENV.JWT_SECRET_KEY;
  // fail fast if the secret isn't configured
  if (!secret) {
    throw new Error("JWT_SECRET_KEY is not defined");
  }

  // make sure the expiry value is actually a number (not "abc" or empty)
  if (isNaN(Number(ENV.JWT_EXPIRES_IN))) {
    throw new Error("JWT_EXPIRES_IN must be a number");
  }

  // sign the token: payload = { userId }, expires after N days
  return jwt.sign({ userId: this._id.toString() }, secret, {
    expiresIn: `${Number(ENV.JWT_EXPIRES_IN)}d`,
  });
};

// generates a long-lived refresh token, stores it in the DB, and returns it
userSchema.methods.createRefreshToken = async function (
  this: UserDocument,
): Promise<string> {
  // separate secret for refresh tokens (so a leaked access token secret doesn't compromise refresh)
  const secret = ENV.JWT_REFRESH_SECRET_KEY;

  if (!secret) {
    throw new Error("JWT_REFRESH_SECRET_KEY is not defined");
  }

  if (isNaN(Number(ENV.JWT_REFRESH_EXPIRES_IN))) {
    throw new Error("JWT_REFRESH_EXPIRES_IN must be a number");
  }

  // sign the refresh token (same payload, different secret + longer expiry)
  const refreshToken = jwt.sign({ userId: this._id.toString() }, secret, {
    expiresIn: `${Number(ENV.JWT_REFRESH_EXPIRES_IN)}d`,
  });
  // store it in the DB (this is what makes rotation work — old token becomes invalid)
  this.refreshToken = refreshToken;
  await this.save();
  return refreshToken;
};

// removes the stored refresh token (logs the user out on all devices)
userSchema.methods.invalidateRefreshToken = async function (
  this: UserDocument,
): Promise<void> {
  // $unset removes the field from the document entirely (sets it to missing, not null)
  await this.updateOne({ $unset: { refreshToken: 1 } });
};

// generates a one-time email verification token, stores its hash, returns the raw token
userSchema.methods.generateVerificationToken = async function (
  this: UserDocument,
): Promise<string> {
  // 64-char random hex string (the raw token sent to the user's email)
  const token = crypto.randomBytes(32).toString("hex");
  // store only the SHA-256 hash (if the DB is leaked, attacker can't use the raw tokens)
  this.verificationToken = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");

  // token expires in 15 minutes
  this.verificationTokenExpire = new Date(Date.now() + 15 * 60 * 1000);
  await this.save();
  // return the raw token (goes into the email link)
  return token;
};

// same pattern as verification, but for password reset (10 min expiry)
userSchema.methods.generateResetPasswordToken = async function (
  this: UserDocument,
): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  this.resetPasswordToken = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");
  this.resetPasswordExpire = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
  await this.save();
  return token;
};

// generates a 6-digit one-time code, stores its hash, returns the raw code
userSchema.methods.generateOTP = async function (
  this: UserDocument,
): Promise<string> {
  // random integer between 100000 and 999999 (always 6 digits)
  const otp = String(crypto.randomInt(100000, 999999));
  // store only the hash
  this.otp = crypto.createHash("sha256").update(otp).digest("hex");
  this.otpExpire = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
  await this.save();
  // return the raw 6-digit code (goes into the email/SMS)
  return otp;
};

// checks if the account is currently locked (lockUntil is in the future)
userSchema.methods.isAccountLocked = function (this: UserDocument): boolean {
  return !!this.lockUntil && this.lockUntil > new Date();
};

// increments the failed-login counter; locks the account after 5 failures
userSchema.methods.incrementLoginAttempts = async function (
  this: UserDocument,
): Promise<void> {
  this.loginAttempts += 1;
  // 5th failed attempt → lock for 15 minutes
  if (this.loginAttempts >= 5) {
    await this.lockAccount(15);
    return;
  }
  await this.save();
};

// resets the counter + unlocks (called after a successful login)
userSchema.methods.resetLoginAttempts = async function (
  this: UserDocument,
): Promise<void> {
  await this.unlockAccount();
};

// sets lastLogin to now (called after successful login)
userSchema.methods.updateLastLogin = async function (
  this: UserDocument,
): Promise<void> {
  this.lastLogin = new Date();
  await this.save();
};

// verifies the old password, then sets the new one (pre-save hook hashes it)
userSchema.methods.changePassword = async function (
  this: UserDocument,
  password: string, // the current (old) password
  newPassword: string, // the new password to set
): Promise<void> {
  // check if the old password matches the stored hash
  const isMatch = await this.comparePassword(password);
  if (!isMatch) {
    throw new Error("Current password incorrect");
  }
  // assign the new plain password — the pre-save hook will hash it automatically
  this.password = newPassword;
  await this.save();
};

// sets lockUntil to now + N minutes (called by incrementLoginAttempts)
userSchema.methods.lockAccount = async function (
  this: UserDocument,
  minutes: number, // how long to lock (e.g. 15)
): Promise<void> {
  this.lockUntil = new Date(Date.now() + minutes * 60 * 1000);
  await this.save();
};

// clears the lock + resets the counter (called by resetLoginAttempts)
userSchema.methods.unlockAccount = async function (
  this: UserDocument,
): Promise<void> {
  this.lockUntil = undefined;
  this.loginAttempts = 0;
  await this.save();
};

// ==================== STATIC METHODS ====================
// called as User.findByEmail(...) — not on a document instance

// finds an active user by email (case-insensitive due to schema's lowercase: true)
userSchema.statics.findByEmail = async function (
  this: IUserModel,
  email: string,
): Promise<UserDocument | null> {
  return await this.findOne({ email, isActive: true });
};

// finds an active user by phone number
userSchema.statics.findByPhone = async function (
  this: IUserModel,
  phone: string,
): Promise<UserDocument | null> {
  return await this.findOne({ phone, isActive: true });
};

// finds an active user by their OAuth provider + provider-specific ID
userSchema.statics.findByProvider = async function (
  this: IUserModel,
  provider: AuthProvider, // e.g. "google"
  providerId: string, // e.g. Google's `sub` claim
): Promise<UserDocument | null> {
  return await this.findOne({ provider, providerId, isActive: true });
};

// finds a user whose stored verification token matches the (hashed) one from the email link
userSchema.statics.findWithVerificationToken = async function (
  this: IUserModel,
  token: string, // the raw token from the email link (not hashed)
): Promise<UserDocument | null> {
  // hash it the same way we stored it, so we can compare against the DB value
  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
  // find the user where: hash matches, token hasn't expired, and account is active
  // .select("+...") re-includes the fields that are select: false by default
  const verifyToken = await this.findOne({
    verificationToken: hashedToken,
    verificationTokenExpire: { $gt: new Date() }, // only future dates (not expired)
    isActive: true,
  }).select("+verificationToken +verificationTokenExpire");
  return verifyToken;
};

// same pattern as above, but for password reset tokens
userSchema.statics.findWithResetToken = async function (
  this: IUserModel,
  token: string, // the raw token from the reset email link
): Promise<UserDocument | null> {
  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
  const resetToken = await this.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpire: { $gt: new Date() },
    isActive: true,
  }).select("+resetPasswordToken +resetPasswordExpire +refreshToken");
  // also includes refreshToken so resetPassword can invalidate old sessions
  return resetToken;
};

// called by the hourly cron in server.ts — removes expired tokens from the DB
// (frees up index space and keeps the collection clean)
userSchema.statics.cleanupExpiredToken = async function (
  this: IUserModel,
): Promise<void> {
  // remove expired verification tokens
  await this.updateMany(
    { verificationTokenExpire: { $lt: new Date() } }, // expiry is in the past
    { $unset: { verificationToken: 1, verificationTokenExpire: 1 } },
  );
  // remove expired password reset tokens
  await this.updateMany(
    { resetPasswordExpire: { $lt: new Date() } },
    { $unset: { resetPasswordToken: 1, resetPasswordExpire: 1 } },
  );
  // remove expired OTPs
  await this.updateMany(
    { otpExpire: { $lt: new Date() } },
    { $unset: { otp: 1, otpExpire: 1 } },
  );
};

// ==================== toJSON TRANSFORM ====================
// controls what gets returned when you call user.toJSON() (i.e. safeUserData)
// strips all sensitive fields so they never leak into API responses
userSchema.set("toJSON", {
  virtuals: true, // include virtual fields in the output
  transform: (_doc, ret) => {
    // destructure out everything we DON'T want to send to the client
    const {
      password, // bcrypt hash
      refreshToken, // session token
      verificationToken, // email verification
      resetPasswordToken, // password reset
      verificationTokenExpire,
      resetPasswordExpire,
      otp, // one-time code hash
      otpExpire,
      loginAttempts, // brute-force counter
      lockUntil, // lock timestamp
      providerId, // OAuth provider's internal ID
      avatarPublicId, // Cloudinary internal ID
      _id, // MongoDB internal ID (use `id` virtual instead)
      __v, // MongoDB version key (meaningless to the client)
      ...rest // everything else (name, email, avatar, isVerified, etc.)
    } = ret;
    // return only the safe fields
    return rest;
  },
});

// ==================== EXPORT ====================
// registers the model — the second type param (IUserModel) adds the static methods
export const User = model<IUser, IUserModel>("User", userSchema);

// ==================== HELPER FUNCTIONS ====================

// type guard: narrows `UserDocument | null` to `UserDocument`
// also checks the account is active AND not soft-deleted
export const isUserActive = (
  user: UserDocument | null,
): user is UserDocument => {
  return !!user && user.isActive && !user.deletedAt;
};

// returns the sanitized user object (strips all sensitive fields via the toJSON transform above)
export const safeUserData = (user: UserDocument) => {
  return user.toJSON();
};
