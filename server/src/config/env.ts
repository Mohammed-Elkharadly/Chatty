import "dotenv/config";

function requireEnvString(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}
function requireEnvNumber(key: string): number {
  const raw = process.env[key];
  if (!raw || raw.trim() === "") {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  const value = Number(raw);
  if (isNaN(value)) {
    throw new Error(`Environment variable ${key} must be a valid number`);
  }
  return value;
}

interface EnvConfig {
  PORT: number;
  NODE_ENV: string;
  MONGO_URI: string;
  JWT_SECRET_KEY: string;
  JWT_EXPIRES_IN: number;
  JWT_REFRESH_SECRET_KEY: string;
  JWT_REFRESH_EXPIRES_IN: number;
  SESSION_SECRET: string;
  RESEND_API_KEY: string;
  RESEND_FROM: string;
  RESEND_EMAIL: string;
  CLIENT_URL: string;
  SERVER_URL: string;
  CUSTOM_DNS_SERVERS?: string[];
  CLOUDINARY_CLOUD_NAME: string;
  CLOUDINARY_API_KEY: string;
  CLOUDINARY_API_SECRET: string;
  GOOGLE_CLIENT_ID: string;
}

export const ENV: EnvConfig = {
  PORT: Number(process.env.PORT) || 5000,
  NODE_ENV: requireEnvString("NODE_ENV"),
  MONGO_URI: requireEnvString("MONGO_URI"),
  JWT_SECRET_KEY: requireEnvString("JWT_SECRET_KEY"),
  JWT_EXPIRES_IN: requireEnvNumber("JWT_EXPIRES_IN"),
  JWT_REFRESH_SECRET_KEY: requireEnvString("JWT_REFRESH_SECRET_KEY"),
  JWT_REFRESH_EXPIRES_IN: Number(requireEnvNumber("JWT_REFRESH_EXPIRES_IN")),
  SESSION_SECRET: requireEnvString("SESSION_SECRET"),
  RESEND_API_KEY: requireEnvString("RESEND_API_KEY"),
  RESEND_FROM: requireEnvString("RESEND_FROM"),
  RESEND_EMAIL: requireEnvString("RESEND_EMAIL"),
  CLIENT_URL: requireEnvString("CLIENT_URL"),
  SERVER_URL: requireEnvString("SERVER_URL"),
  CLOUDINARY_CLOUD_NAME: requireEnvString("CLOUDINARY_CLOUD_NAME"),
  CLOUDINARY_API_KEY: String(requireEnvString("CLOUDINARY_API_KEY")),
  CLOUDINARY_API_SECRET: requireEnvString("CLOUDINARY_API_SECRET"),
  GOOGLE_CLIENT_ID: requireEnvString("GOOGLE_CLIENT_ID"),
};
