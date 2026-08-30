import { OAuth2Client } from "google-auth-library";
import { AuthProvider } from "../models/User.js";
import { ENV } from "../config/env.js";
import { CustomError } from "./customError.js";
import { StatusCodes } from "http-status-codes";

const googleClient = new OAuth2Client(ENV.GOOGLE_CLIENT_ID);

interface VerifiedProfile {
  sub: string; // Google's stable, unique user id — this is the real providerId
  email?: string | undefined;
  name?: string | undefined;
  picture?: string | undefined;
  email_verified?: boolean | undefined;
}

export const verifyWithProvider = async (
  provider: AuthProvider,
  idToken: string,
): Promise<VerifiedProfile> => {
  if (provider === AuthProvider.GOOGLE) {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: ENV.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload || !payload.sub) {
      throw new CustomError("invalid google token", StatusCodes.UNAUTHORIZED);
    }
    return {
      sub: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
      email_verified: payload.email_verified,
    };
  }
  throw new CustomError("unsupported provider", StatusCodes.BAD_REQUEST);
};
