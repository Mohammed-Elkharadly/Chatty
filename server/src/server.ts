import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import type { Application, Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import authRoutes from "./routes/auth.route.js";
import userRoutes from "./routes/user.route.js"
import messageRoutes from "./routes/message.route.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { ENV } from "./config/env.js";
import { connectDB } from "./config/db.js";
import cron from "node-cron";
import helmet from "helmet";
import morgan from "morgan";
import { User } from "./models/User.js";

// ESM module URL → filesystem path
// __filename → current file, __dirname → current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Express app → handles HTTP requests and middleware
const app: Application = express();

// raw node http server wrapping express, needed so socket.io can attach to the same port
const httpServer = createServer(app);

const PORT: number = ENV.PORT;

// Shared CORS origins used by both socket.io and express so they never drift apart
const ALLOWED_ORIGINS = [ENV.CLIENT_URL, ENV.SERVER_URL];

// httpServer → Socket.IO server
// Same PORT → Express + Socket.IO
export const io = new Server(httpServer, {
  cors: {
    origin: ALLOWED_ORIGINS, // only allow these frontend origins to open a socket connection
    credentials: true, // allow cookies/auth headers to be sent with the socket handshake
  },
});

// userId → socketId
// userId comes from the client; socket.id comes from Socket.IO
const onlineUsers = new Map<string, string>();

// "connection" → Socket.IO event → runs when a client connects
io.on("connection", (socket) => {
  // "users:online" → event sent by the client
  // userId → argument received from that event
  // socket.id → ID created by Socket.IO for this connection
  socket.on("users:online", (userId: string) => {
    // register/refresh this user's active socket id
    onlineUsers.set(userId, socket.id);
    // broadcast the updated online-user list to everyone connected
    io.emit("users:online", Array.from(onlineUsers.keys()));
  });

  // "disconnect" → Socket.IO event → runs when this connection closes
  socket.on("disconnect", () => {
    // "disconnect" → Socket.IO event → runs when this connection closes
    for (const [userId, socketId] of onlineUsers.entries()) {
      // onlineUsers → existing userId/socketId pairs
      if (socketId === socket.id) {
        // Remove the user → no longer online
        onlineUsers.delete(userId);
        break; // No need to continue searching after finding the user.
      }
    }
    // Updated Map keys → new online-user list → send to everyone
    io.emit("users:online", Array.from(onlineUsers.keys()));
  });
});

// export so message controller can use it (e.g. to check if a recipient is
// online, or to get their socket id for a direct emit)
export { onlineUsers };

// Express middleware
app.use(express.json({ limit: "10mb" })); // parse JSON request bodies
app.use(cookieParser()); // parse cookies into req.cookies (needed for reading the auth/JWT cookie)
app.use(
  cors({
    origin: ALLOWED_ORIGINS, // ALLOWED_ORIGINS → allowed browser origins
    credentials: true, // allow cookies to be sent cross-origin (needed for cookie-based auth)
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.use(express.urlencoded({ extended: true, limit: "10mb" })); // Form request body → req.body
// First proxy → trusted by Express
// Needed when deployed behind Render/Vercel/etc.
app.set("trust proxy", 1);
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"], // Default → only this application
        // Images → app + base64 + Cloudinary
        imgSrc: ["'self'", "data:", "https://res.cloudinary.com"],
        // Browser connections → app + client + server
        connectSrc: ["'self'", ENV.CLIENT_URL, ENV.SERVER_URL],
      },
    },
  }),
);
app.use(morgan(ENV.NODE_ENV === "production" ? "combined" : "dev"));

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/messages", messageRoutes);

// Serve the built React frontend (Vite build output)
app.use(express.static(path.join(__dirname, "..", "..", "client", "dist")));

// SPA fallback: send index.html for any route that isn't an API call or a
// real static file, so React Router can handle client-side routes on refresh
app.get(/.*/, (req: Request, res: Response) => {
  // unknown API route -> 404 JSON, don't fall through to the SPA
  if (req.originalUrl.startsWith("/api")) {
    return res.status(404).json({ message: "Api routes not found" });
  }
  // request for a missing static file (has a file extension, e.g. .css/.png)
  // -> plain 404, don't serve index.html for it
  if (req.originalUrl.includes(".")) {
    return res.status(404).end();
  }
  // everything else is a client-side route -> let React Router handle it
  res.sendFile(
    path.join(__dirname, "..", "..", "client", "dist", "index.html"),
  );
});

// Must be registered last → catches errors from above
app.use(errorHandler);

// startServer() → connects DB → starts jobs → starts HTTP server
const startServer = async (): Promise<void> => {
  try {
    // connect to MongoDB before accepting traffic
    await connectDB(ENV.MONGO_URI);
    // "0 * * * *" → every hour at minute 0
    cron.schedule("0 * * * *", async () => {
      try {
        // Cron job → remove expired authentication tokens
        await User.cleanupExpiredToken();
      } catch (error) {
        console.error("cleanupExpiredToken failed", error);
      }
    });
    httpServer.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error(error);
  }
};

startServer();
