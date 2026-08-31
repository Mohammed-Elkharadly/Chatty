import { Server } from "socket.io";
import type { Server as HttpServer } from "node:http";
import jwt from "jsonwebtoken";
import { ENV } from "./env.js";
import { GroupMember } from "../models/GroupMember.js";

const parseCookieHeader = (header: string): Record<string, string> => {
  const result: Record<string, string> = {};
  header.split(';').forEach((pair) => {
    const [key, ...valueParts] = pair.trim().split('=');
    if (!key) return;
    result[key] = decodeURIComponent(valueParts.join('='));
  });
  return result;
};

const ALLOWED_ORIGINS = [ENV.CLIENT_URL, ENV.SERVER_URL];

// userId -> socketId, tracks who's currently online. Exported so
// controllers (message/group message) can look up a recipient's socket.
export const onlineUsers = new Map<string, string>();

// created by initSocketServer() below — exported so controllers can
// import `io` directly instead of reaching into server.ts
export let io: Server;

export const initSocketServer = (httpServer: HttpServer): Server => {
  io = new Server(httpServer, {
    cors: {
      origin: ALLOWED_ORIGINS,
      credentials: true,
    },
  });

  // runs once per new connection, before 'connection' fires — verifies
  // the accessToken cookie so every socket has a trustworthy userId
  io.use((socket, next) => {
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

  io.on("connection", (socket) => {
    const userId = socket.data.userId as string;

    onlineUsers.set(userId, socket.id);
    io.emit("users:online", Array.from(onlineUsers.keys()));

    // client asks to join a group's room — verify membership before
    // allowing it, so a socket can't listen to a group it's not in
    socket.on("group:join", async (groupId: string) => {
      try {
        const isMember = await GroupMember.exists({ groupId, userId });
        if (!isMember) return; // silently ignore
        socket.join(`group:${groupId}`);
      } catch (error) {
        console.error("group:join failed:", error);
      }
    });

    socket.on("group:leave", (groupId: string) => {
      socket.leave(`group:${groupId}`);
    });

    socket.on("disconnect", () => {
      onlineUsers.delete(userId);
      io.emit("users:online", Array.from(onlineUsers.keys()));
    });
  });

  return io;
};
