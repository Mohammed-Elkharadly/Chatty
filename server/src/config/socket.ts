import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { Types } from "mongoose";
import type { Server as HttpServer } from "node:http";
import jwt from "jsonwebtoken";
import { ENV } from "./env.js";
import { GroupMember } from "../models/GroupMember.js";
import redisClient from "./redis.js";
import type { Redis } from "ioredis";

const parseCookieHeader = (header: string): Record<string, string> => {
  const result: Record<string, string> = {};
  header.split(";").forEach((pair) => {
    const [key, ...valueParts] = pair.trim().split("=");
    if (!key) return;
    result[key] = decodeURIComponent(valueParts.join("="));
  });
  return result;
};

const ALLOWED_ORIGINS = [ENV.CLIENT_URL, ENV.SERVER_URL];

const presenceKey = (userId: string) => `presence:${userId}`;
const ONLINE_USER_IDS_KEY = "online_user_ids";

export const getSocketsForUser = async (userId: string): Promise<string[]> =>
  redisClient.smembers(presenceKey(userId));

const addPresence = async (
  userId: string,
  socketId: string,
): Promise<string[]> => {
  const key = presenceKey(userId);
  const PRESENCE_TTL_SEC = 60 * 60 * 24;
  await redisClient.sadd(key, socketId);
  await redisClient.sadd(ONLINE_USER_IDS_KEY, userId);
  await redisClient.expire(key, PRESENCE_TTL_SEC);
  await redisClient.expire(ONLINE_USER_IDS_KEY, PRESENCE_TTL_SEC);
  return redisClient.smembers(ONLINE_USER_IDS_KEY);
};

const removePresence = async (userId: string, socketId: string) => {
  await redisClient.srem(presenceKey(userId), socketId);
  const remaining = await redisClient.scard(presenceKey(userId));
  if (remaining === 0) {
    await redisClient.srem(ONLINE_USER_IDS_KEY, userId);
    return {
      wentOffline: true,
      onlineUserIds: await redisClient.smembers(ONLINE_USER_IDS_KEY),
    };
  }
  return { wentOffline: false, onlineUserIds: null };
};

export let io: Server | null = null;
export let subClient: Redis | null = null;

export const initSocketServer = (
  httpServer: HttpServer,
): { io: Server; subClient: Redis } => {
  const localIo = new Server(httpServer, {
    cors: {
      origin: ALLOWED_ORIGINS,
      credentials: true,
    },
  });

  const pubClient = redisClient.duplicate();
  const localSubClient = redisClient.duplicate();

  pubClient.on("error", (err) => console.error("Redis pubClient error:", err));

  localSubClient.on("error", (err) =>
    console.error("Redis subClient error:", err),
  );

  localIo.adapter(createAdapter(pubClient, localSubClient));

  localIo.use((socket, next) => {
    try {
      const rawCookies = socket.handshake.headers.cookie;
      if (!rawCookies) return next(new Error("Unauthorized"));
      const parsed = parseCookieHeader(rawCookies);
      const accessToken = parsed.accessToken;
      if (!accessToken) return next(new Error("Unauthorized"));
      const decoded = jwt.verify(accessToken, ENV.JWT_SECRET_KEY) as {
        userId: string;
      };
      socket.data.userId = decoded.userId;
      next();
    } catch (error) {
      next(new Error("Unauthorized"));
    }
  });

  localIo.on("connection", (socket) => {
    const userId = socket.data.userId as string;

    addPresence(userId, socket.id)
      .then((onlineUserIds) => {
        localIo.emit("users:online", onlineUserIds);
      })
      .catch((error) => console.error("addPresence failed:", error));

    socket.on("group:join", async (groupId: string) => {
      try {
        if (!Types.ObjectId.isValid(groupId)) return;
        const isMember = await GroupMember.exists({ groupId, userId });
        if (!isMember) return;
        socket.join(`group:${groupId}`);
      } catch (error) {
        console.error("group:join failed:", error);
      }
    });

    socket.on("group:leave", (groupId: string) => {
      socket.leave(`group:${groupId}`);
    });

    socket.on("disconnect", () => {
      removePresence(userId, socket.id)
        .then(({ wentOffline, onlineUserIds }) => {
          if (wentOffline) {
            localIo.emit("users:online", onlineUserIds);
          }
        })
        .catch((error) => console.error("failed to remove presence", error));
    });
  });

  // Assign to exports only after successful setup
  io = localIo;
  subClient = localSubClient;

  return { io: localIo, subClient: localSubClient };
};
