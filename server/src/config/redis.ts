import { Redis } from "ioredis";
import { ENV } from "./env.js";

// single shared client instance — reused across rate limiter, socket adapter, presence, etc.
export const redisClient = new Redis(ENV.REDIS_URL, {
  maxRetriesPerRequest: null, 
  connectTimeout: 10000,
});

redisClient.on("connect", () => {
  console.log("Redis connected");
});

redisClient.on("error", (err) => {
  console.error("Redis connection error:", err);
});

export default redisClient;
