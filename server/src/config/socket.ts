import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { Types } from "mongoose";
import type { Server as HttpServer } from "node:http";
import jwt from "jsonwebtoken";
import { ENV } from "./env.js";
import { GroupMember } from "../models/GroupMember.js";
import redisClient from "./redis.js";

// takes the raw cookie string from the browser, splits it, returns a clean { key: value } object
const parseCookieHeader = (header: string): Record<string, string> => {
  const result: Record<string, string> = {};
  // split by ';' to get each cookie pair
  header.split(";").forEach((pair) => {
    // split each pair by '=' → first part is key, rest is value
    const [key, ...valueParts] = pair.trim().split("=");
    // if no key (malformed), skip this pair
    if (!key) return;
    // decode the value (browser encodes special chars)
    result[key] = decodeURIComponent(valueParts.join("="));
  });
  return result;
};

// only these two domains can connect to this socket server
const ALLOWED_ORIGINS = [ENV.CLIENT_URL, ENV.SERVER_URL];

// Redis key holding every socketId for a given user (their open tabs/devices)
const presenceKey = (userId: string) => `presence:${userId}`;
// Redis key holding the set of ALL userIds currently online, across every server instance
const ONLINE_USER_IDS_KEY = "online_user_ids";

// helper: gives you an array of socketIds for a user, or [] if they're offline
// now async since it reads from Redis instead of local memory — shared truth across all instances
export const getSocketsForUser = async (userId: string): Promise<string[]> =>
  redisClient.smembers(presenceKey(userId));

// helper: registers a socket as belonging to userId, returns the full cross-instance online list
const addPresence = async (
  userId: string,
  socketId: string,
): Promise<string[]> => {
  // add this socket to the user's own set
  await redisClient.sadd(presenceKey(userId), socketId);
  // mark this user as online globally (no-op if already present)
  await redisClient.sadd(ONLINE_USER_IDS_KEY, userId);
  // return the current full online list, seen by every instance, not just this one
  return redisClient.smembers(ONLINE_USER_IDS_KEY);
};

// helper: removes a socket, and drops the user from the online set if that was their last one
const removePresence = async (
  userId: string,
  socketId: string,
): Promise<string[]> => {
  // remove this specific socket from the user's set
  await redisClient.srem(presenceKey(userId), socketId);
  // check how many sockets this user has left (other tabs/devices, possibly on other instances)
  const remaining = await redisClient.scard(presenceKey(userId));
  // no sockets left anywhere → fully offline, remove from the global online set
  if (remaining === 0) {
    await redisClient.srem(ONLINE_USER_IDS_KEY, userId);
  }
  // return the current full online list
  return redisClient.smembers(ONLINE_USER_IDS_KEY);
};

// the socket server instance, set inside initSocketServer
export let io: Server;

// main setup: creates the socket server and wires all logic
export const initSocketServer = (httpServer: HttpServer): Server => {
  // create the server, only allow our own domains to connect
  io = new Server(httpServer, {
    cors: {
      origin: ALLOWED_ORIGINS,
      credentials: true, // lets the browser send the cookie with the socket handshake
    },
  });

  // subscriber must be a separate connection — a client in subscribe mode can't run other commands
  const pubClient = redisClient;
  const subClient = redisClient.duplicate();
  // duplicate() doesn't inherit the original client's error listener — attach one or it crashes on error
  subClient.on("error", (err) => {
    console.error("Redis subClient error:", err);
  });
  // lets multiple server instances broadcast to sockets connected on OTHER instances
  io.adapter(createAdapter(pubClient, subClient));

  // runs before every connection is accepted — checks if the user is logged in
  io.use((socket, next) => {
    try {
      // grab the raw cookie string from the handshake headers
      const rawCookies = socket.handshake.headers.cookie;
      // if no cookie at all → reject
      if (!rawCookies) return next(new Error("Unauthorized"));

      // turn the raw string into { accessToken: "...", ... }
      const parsed = parseCookieHeader(rawCookies);
      const accessToken = parsed.accessToken;
      // cookie exists but no accessToken in it → reject
      if (!accessToken) return next(new Error("Unauthorized"));

      // verify the token is real and not expired, get the userId out of it
      const decoded = jwt.verify(accessToken, ENV.JWT_SECRET_KEY) as {
        userId: string;
      };
      // attach userId to the socket so we can use it later in handlers
      socket.data.userId = decoded.userId;
      // token is valid → allow the connection
      next();
    } catch (error) {
      // token expired or tampered → reject
      next(new Error("Unauthorized"));
    }
  });

  // fires once the connection is accepted (user is authenticated)
  io.on("connection", (socket) => {
    // get the userId we attached during auth
    const userId = socket.data.userId as string;

    // register this socket in Redis, get back the TRUE cross-instance online list
    addPresence(userId, socket.id)
      .then((onlineUserIds) => {
        // tell everyone (on every instance, via the adapter) the online list changed
        io.emit("users:online", onlineUserIds);
      })
      .catch((error) => console.error("addPresence failed:", error));

    // client says "I want to listen to this group's messages"
    socket.on("group:join", async (groupId: string) => {
      try {
        //  THIS IS THE ONLY NEW LINE — reject garbage strings before hitting the DB
        if (!Types.ObjectId.isValid(groupId)) return;

        // check if this user is actually a member of that group
        const isMember = await GroupMember.exists({ groupId, userId });
        // if not a member, do nothing (silently ignore)
        if (!isMember) return;
        // join the room → now this socket will receive messages sent to `group:${groupId}`
        socket.join(`group:${groupId}`);
      } catch (error) {
        console.error("group:join failed:", error);
      }
    });

    // client says "I'm leaving this group" (e.g. navigated away)
    socket.on("group:leave", (groupId: string) => {
      // stop receiving messages for that group
      socket.leave(`group:${groupId}`);
    });

    // user disconnected (closed tab, lost wifi, etc.)
    socket.on("disconnect", () => {
      // remove this socket from Redis, get back the TRUE cross-instance online list
      removePresence(userId, socket.id)
        .then((onlineUserIds) => {
          // tell everyone the online list changed
          io.emit("users:online", onlineUserIds);
        })
        .catch((error) => console.error("removePresence failed:", error));
    });
  });

  return io;
};
