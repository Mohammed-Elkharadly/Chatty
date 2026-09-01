import { Server } from "socket.io";
import { Types } from "mongoose";
import type { Server as HttpServer } from "node:http";
import jwt from "jsonwebtoken";
import { ENV } from "./env.js";
import { GroupMember } from "../models/GroupMember.js";

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

// tracks who is online: userId → all their open socketIds (tabs/devices)
export const onlineUsers = new Map<string, Set<string>>();

// helper: gives you an array of socketIds for a user, or [] if they're offline
export const getSocketsForUser = (userId: string): string[] =>
  Array.from(onlineUsers.get(userId) ?? []);

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

    // if this user has no entry yet, create a new Set for them
    if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
    // add this socket's id to their set
    onlineUsers.get(userId)!.add(socket.id);
    // tell everyone the online list changed
    io.emit("users:online", Array.from(onlineUsers.keys()));

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
      // get all sockets for this user
      const sockets = onlineUsers.get(userId);
      // if the entry exists (it should, but safety check)
      if (sockets) {
        // remove this specific socket from their set
        sockets.delete(socket.id);
        // if no sockets left → they're fully offline, remove the entry
        if (sockets.size === 0) onlineUsers.delete(userId);
      }
      // tell everyone the online list changed
      io.emit("users:online", Array.from(onlineUsers.keys()));
    });
  });

  return io;
};
