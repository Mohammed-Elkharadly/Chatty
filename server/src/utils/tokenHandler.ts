import type { Response } from "express";
import { ENV } from "../config/env.js";

export class TokenHandler {
  private static readonly oneDay = 1000 * 60 * 60 * 24;
  // we make it static so we don't 'new' it every time
  static attachAccessToken(res: Response, token: string): void {
    res.cookie("accessToken", token, {
      // Flags the cookie to be accessible only by the web server.
      httpOnly: true,
      // Marks the cookie to be used with HTTPS only
      secure: ENV.NODE_ENV === "production",
      // CSRF 'Cross-Site Request Forgery' attacks
      sameSite: "strict",
      //  expiry time relative to the current time in milliseconds
      maxAge: Number(ENV.JWT_EXPIRES_IN) * this.oneDay,
    });
  }
  static attachRefreshToken(res: Response, token: string): void {
    res.cookie("refreshToken", token, {
      httpOnly: true,
      secure: ENV.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: Number(ENV.JWT_REFRESH_EXPIRES_IN) * this.oneDay,
    });
  }
  static clearCookie(res: Response): void {
    res.clearCookie("accessToken", {
      httpOnly: true,
      secure: ENV.NODE_ENV === "production",
      sameSite: "strict",
      expires: new Date(0), // sets expiration to the past 'deletes it'
    });

    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: ENV.NODE_ENV === "production",
      sameSite: "strict",
      expires: new Date(0),
    });
  }
}
