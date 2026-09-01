import { OAuth2Client } from "google-auth-library";
import { AuthProvider } from "../models/User.js";
import { ENV } from "../config/env.js";
import { CustomError } from "./customError.js";
import { StatusCodes } from "http-status-codes";

// creates a Google OAuth client — used to verify ID tokens sent by the frontend
const googleClient = new OAuth2Client(ENV.GOOGLE_CLIENT_ID);

// the shape we return after successful verification
interface VerifiedProfile {
  sub: string; // Google's stable unique user id (use this as your providerId in the DB)
  email?: string | undefined;
  name?: string | undefined;
  picture?: string | undefined;
  email_verified?: boolean | undefined;
}

// takes a provider name + the ID token from the frontend, verifies it, returns the user's profile
export const verifyWithProvider = async (
  provider: AuthProvider, // which provider sent this token (currently only GOOGLE)
  idToken: string, // the JWT the frontend got from Google's OAuth popup
): Promise<VerifiedProfile> => {
  // only handle Google for now
  if (provider === AuthProvider.GOOGLE) {
    // ask Google's servers: "is this token real and not expired?"
    // returns a Ticket object if valid, throws if not
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: ENV.GOOGLE_CLIENT_ID, // confirms the token was issued to OUR app
    });
    // extract the claims (sub, email, name, etc.) from the verified token
    const payload = ticket.getPayload();
    // if no payload or no user id → the token is malformed
    if (!payload || !payload.sub) {
      throw new CustomError("invalid google token", StatusCodes.UNAUTHORIZED);
    }
    // return only the fields we actually need (ignore the rest of Google's claims)
    return {
      sub: payload.sub,
      email: payload.email,
      name: payload.name,
      picture: payload.picture,
      email_verified: payload.email_verified,
    };
  }
  // if someone passes a provider we don't support (e.g. "facebook" later)
  throw new CustomError("unsupported provider", StatusCodes.BAD_REQUEST);
};
