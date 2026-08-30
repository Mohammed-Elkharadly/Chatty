import { Schema, model, Model, type HydratedDocument } from "mongoose";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { ENV } from "../config/env.js";

export type UserDocument = HydratedDocument<IUser, IUserMethods>;

export enum UserRole {
  USER = "user",
  ADMIN = "admin",
}

export enum AuthProvider {
  LOCAL = "local",
  GOOGLE = "google",
  FACEBOOK = "facebook",
  PHONE = "phone",
}

export interface IUser {
  name: string;
  email?: string | undefined;
  phone?: string | undefined;
  password?: string | undefined;
  avatar?: string | undefined;
  avatarPublicId?: string | undefined;

  // 0Auth
  provider: AuthProvider;
  providerId?: string;

  // OTP
  otp?: string | undefined;
  otpExpire?: Date | undefined;

  // Email verification
  isVerified: boolean;
  verificationToken?: string | undefined;
  verificationTokenExpire?: Date | undefined;

  // Password reset
  resetPasswordToken?: string | undefined;
  resetPasswordExpire?: Date | undefined;

  // Security
  lastLogin: Date;
  loginAttempts: number;
  lockUntil?: Date | undefined;
  refreshToken?: string | undefined;

  // Account status
  isActive: boolean;
  deletedAt?: Date | undefined;
  role: UserRole;
}

interface IUserMethods {
  // authentiction methods
  createJwt(): string;
  comparePassword(candidate: string): Promise<boolean>;
  createRefreshToken(): Promise<string>;
  invalidateRefreshToken(): Promise<void>;

  // token generation methods
  generateVerificationToken(): Promise<string>;
  generateResetPasswordToken(): Promise<string>;
  generateOTP(): Promise<string>;

  // account management methods
  isAccountLocked(): boolean;
  incrementLoginAttempts(): Promise<void>;
  resetLoginAttempts(): Promise<void>;
  updateLastLogin(): Promise<void>;
  lockAccount(minutes: number): Promise<void>;
  unlockAccount(): Promise<void>;

  // password management
  changePassword(password: string, newPassword: string): Promise<void>;
}

interface IUserModel extends Model<IUser, {}, IUserMethods> {
  // basic finder
  findByEmail(email: string): Promise<UserDocument | null>;
  findByPhone(phone: string): Promise<UserDocument | null>;
  findByProvider(
    provider: AuthProvider,
    providerId: string,
  ): Promise<UserDocument | null>;

  // token finder
  findWithVerificationToken(token: string): Promise<UserDocument | null>;
  findWithResetToken(token: string): Promise<UserDocument | null>;
  cleanupExpiredToken(): Promise<void>;
}

// Iuser => Document shape (fields)
// Model<Iuser, {}, IuserMethods>, => Model type
// IuserMethods => Instance methods

const userSchema = new Schema<IUser, IUserModel, IUserMethods>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      unique: true,
      sparse: true, // allows multiple nulls
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
    },
    password: {
      type: String,
      minlength: [8, "Password must be at least 8 characters"],
      select: false,
    },
    avatar: {
      type: String,
    },
    avatarPublicId: {
      type: String,
      select: false,
    },

    // Auth provider
    provider: {
      type: String,
      enum: Object.values(AuthProvider),
      default: AuthProvider.LOCAL,
    },
    providerId: {
      type: String,
      select: false,
    },

    // OTP
    otp: {
      type: String,
      select: false,
    },
    otpExpire: {
      type: Date,
      select: false,
    },

    // Email verification
    isVerified: {
      type: Boolean,
      default: false,
    },
    verificationToken: {
      type: String,
      select: false,
    },
    verificationTokenExpire: {
      type: Date,
      select: false,
    },

    // Password reset
    resetPasswordToken: {
      type: String,
      select: false,
    },
    resetPasswordExpire: {
      type: Date,
      select: false,
    },

    // Security
    lastLogin: Date,
    loginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: Date,
    refreshToken: {
      type: String,
      select: false,
    },

    // Account status
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.USER,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    deletedAt: Date,
  },
  {
    timestamps: true,
  },
);

// indexes - only for fields not already indexed via `unique: true`
userSchema.index(
  { provider: 1, providerId: 1 },
  { unique: true, partialFilterExpression: { providerId: { $exists: true } } },
);
userSchema.index({ verificationToken: 1 });
userSchema.index({ resetPasswordToken: 1 });
userSchema.index({ role: 1, isActive: 1 });

// ============ middleware / pre hooks =====================

// auto-hash runs everytime we save a user, "before"
userSchema.pre("save", async function (this: UserDocument) {
  if (!this.password || !this.isModified("password")) return;
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  } catch (error) {
    throw error;
  }
});

// ============ instance methods =====================

userSchema.methods.comparePassword = async function (
  this: UserDocument,
  candidate: string,
): Promise<boolean> {
  if (!this.password) return false;
  return await bcrypt.compare(candidate, this.password);
};

userSchema.methods.createJwt = function (this: UserDocument): string {
  const secret = ENV.JWT_SECRET_KEY;
  if (!secret) {
    throw new Error("JWT_SECRET_KEY is not defined");
  }

  if (isNaN(Number(ENV.JWT_EXPIRES_IN))) {
    throw new Error("JWT_EXPIRES_IN must be a number");
  }

  return jwt.sign({ userId: this._id.toString() }, secret, {
    expiresIn: `${Number(ENV.JWT_EXPIRES_IN)}d`,
  });
};

userSchema.methods.createRefreshToken = async function (
  this: UserDocument,
): Promise<string> {
  const secret = ENV.JWT_REFRESH_SECRET_KEY;

  if (!secret) {
    throw new Error("JWT_REFRESH_SECRET_KEY is not defined");
  }

  if (isNaN(Number(ENV.JWT_REFRESH_EXPIRES_IN))) {
    throw new Error("JWT_REFRESH_EXPIRES_IN must be a number");
  }
  const refreshToken = jwt.sign({ userId: this._id.toString() }, secret, {
    expiresIn: `${Number(ENV.JWT_REFRESH_EXPIRES_IN)}d`,
  });
  this.refreshToken = refreshToken;
  await this.save();
  return refreshToken;
};

userSchema.methods.invalidateRefreshToken = async function (
  this: UserDocument,
): Promise<void> {
  await this.updateOne({ $unset: { refreshToken: 1 } });
};

userSchema.methods.generateVerificationToken = async function (
  this: UserDocument,
): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  this.verificationToken = crypto
    .createHash("sha256")
    .update(token)
    .digest("hex");

  this.verificationTokenExpire = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
  await this.save();
  return token;
};

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

userSchema.methods.generateOTP = async function (
  this: UserDocument,
): Promise<string> {
  // 6-digit OPT
  const otp = String(crypto.randomInt(100000, 999999));
  this.otp = crypto.createHash("sha256").update(otp).digest("hex");
  this.otpExpire = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
  await this.save();
  return otp;
};

userSchema.methods.isAccountLocked = function (this: UserDocument): boolean {
  return !!this.lockUntil && this.lockUntil > new Date();
};

userSchema.methods.incrementLoginAttempts = async function (
  this: UserDocument,
): Promise<void> {
  this.loginAttempts += 1;
  if (this.loginAttempts >= 5) {
    await this.lockAccount(15);
    return;
  }
  await this.save();
};

userSchema.methods.resetLoginAttempts = async function (
  this: UserDocument,
): Promise<void> {
  await this.unlockAccount();
};

userSchema.methods.updateLastLogin = async function (
  this: UserDocument,
): Promise<void> {
  this.lastLogin = new Date();
  await this.save();
};

userSchema.methods.changePassword = async function (
  this: UserDocument,
  password: string,
  newPassword: string,
): Promise<void> {
  const isMatch = await this.comparePassword(password);
  if (!isMatch) {
    throw new Error("Current password incorrect");
  }
  this.password = newPassword; // pre-save hook will hash it
  await this.save();
};

userSchema.methods.lockAccount = async function (
  this: UserDocument,
  minutes: number,
): Promise<void> {
  this.lockUntil = new Date(Date.now() + minutes * 60 * 1000);
  await this.save();
};

userSchema.methods.unlockAccount = async function (
  this: UserDocument,
): Promise<void> {
  this.lockUntil = undefined;
  this.loginAttempts = 0;
  await this.save();
};

// ==================== STATIC METHODS ====================

userSchema.statics.findByEmail = async function (
  this: IUserModel,
  email: string,
): Promise<UserDocument | null> {
  return await this.findOne({ email, isActive: true });
};

userSchema.statics.findByPhone = async function (
  this: IUserModel,
  phone: string,
): Promise<UserDocument | null> {
  return await this.findOne({ phone, isActive: true });
};

userSchema.statics.findByProvider = async function (
  this: IUserModel,
  provider: AuthProvider,
  providerId: string,
): Promise<UserDocument | null> {
  return await this.findOne({ provider, providerId, isActive: true });
};

userSchema.statics.findWithVerificationToken = async function (
  this: IUserModel,
  token: string,
): Promise<UserDocument | null> {
  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
  const verifyToken = await this.findOne({
    verificationToken: hashedToken,
    verificationTokenExpire: { $gt: new Date() },
    isActive: true,
  }).select("+verificationToken +verificationTokenExpire");
  return verifyToken;
};

userSchema.statics.findWithResetToken = async function (
  this: IUserModel,
  token: string,
): Promise<UserDocument | null> {
  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");
  const resetToken = await this.findOne({
    resetPasswordToken: hashedToken,
    resetPasswordExpire: { $gt: new Date() },
    isActive: true,
  }).select("+resetPasswordToken +resetPasswordExpire +refreshToken");
  return resetToken;
};

userSchema.statics.cleanupExpiredToken = async function (
  this: IUserModel,
): Promise<void> {
  await this.updateMany(
    { verificationTokenExpire: { $lt: new Date() } },
    { $unset: { verificationToken: 1, verificationTokenExpire: 1 } },
  );
  await this.updateMany(
    { resetPasswordExpire: { $lt: new Date() } },
    { $unset: { resetPasswordToken: 1, resetPasswordExpire: 1 } },
  );
  await this.updateMany(
    { otpExpire: { $lt: new Date() } },
    { $unset: { otp: 1, otpExpire: 1 } },
  );
};

// Never leak password hash in JSON responses
// .set("toJSON", options)
userSchema.set("toJSON", {
  virtuals: true,
  transform: (_doc, ret) => {
    const {
      password,
      refreshToken,
      verificationToken,
      resetPasswordToken,
      verificationTokenExpire,
      resetPasswordExpire,
      otp,
      otpExpire,
      loginAttempts,
      lockUntil,
      providerId,
      avatarPublicId,
      _id,
      __v,
      ...rest
    } = ret;
    return rest;
  },
});

// ==================== EXPORT ====================
// {}, // placeholder. means Static methods   -> none

export const User = model<IUser, IUserModel>("User", userSchema);

// ==================== HELPER FUNCTIONS ====================

// type guard
export const isUserActive = (
  user: UserDocument | null,
): user is UserDocument => {
  return !!user && user.isActive && !user.deletedAt;
};

export const safeUserData = (user: UserDocument) => {
  return user.toJSON();
};
