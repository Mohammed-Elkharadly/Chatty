import express from "express";
import { createServer } from "node:http";
import type { Application, Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import authRoutes from "./routes/auth.route.js";
import userRoutes from "./routes/user.route.js";
import messageRoutes from "./routes/message.route.js";
import groupRoutes from "./routes/group.route.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { ENV } from "./config/env.js";
import { connectDB } from "./config/db.js";
import { initSocketServer } from "./config/socket.js";
import cron from "node-cron";
import helmet from "helmet";
import morgan from "morgan";
import { User } from "./models/User.js";

// Resolve current file path (ESM has no __dirname)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app: Application = express();
const httpServer = createServer(app);
const PORT: number = ENV.PORT;

// Domains allowed to make cross-origin requests
const ALLOWED_ORIGINS = [ENV.CLIENT_URL, ENV.SERVER_URL];

// Attach Socket.IO to the HTTP server (auth, presence, rooms)
initSocketServer(httpServer);

// Parse JSON bodies, cap at 10mb (media uploads)
app.use(express.json({ limit: "10mb" }));
// Parse cookie-based tokens (refresh token)
app.use(cookieParser());
// Restrict CORS to your own client + server, allow cookies
app.use(
  cors({
    origin: ALLOWED_ORIGINS,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
// Parse form-urlencoded bodies (login form fallback)
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
// Trust 1 proxy hop (behind Nginx/Cloudflare) so req.ip is correct
app.set("trust proxy", 1);
// Security headers + CSP allowing Cloudinary images and your own origins
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https://res.cloudinary.com"],
        connectSrc: ["'self'", ENV.CLIENT_URL, ENV.SERVER_URL],
      },
    },
  }),
);
// Request logging (verbose in dev, concise in prod)
app.use(morgan(ENV.NODE_ENV === "production" ? "combined" : "dev"));

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/groups", groupRoutes);

// Serve static assets (JS, CSS, images) from Vite build output
app.use(express.static(path.join(__dirname, "..", "..", "client", "dist")));

// Catch-all: SPA fallback (send index.html for non-API, non-file routes)
app.get(/.*/, (req: Request, res: Response) => {
  // API 404 — return JSON error
  if (req.originalUrl.startsWith("/api")) {
    return res.status(404).json({ message: "Api routes not found" });
  }
  // File request (has extension) that static didn't serve → 404
  if (req.originalUrl.includes(".")) {
    return res.status(404).end();
  }
  // Everything else → React SPA entry point
  res.sendFile(
    path.join(__dirname, "..", "..", "client", "dist", "index.html"),
  );
});

// Central error handler (must be last)
app.use(errorHandler);

// Boot: connect DB, start cron, listen
const startServer = async (): Promise<void> => {
  try {
    await connectDB(ENV.MONGO_URI);

    // Hourly: purge expired OTP/refresh tokens from DB
    cron.schedule("0 * * * *", async () => {
      try {
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

// graceful shutdown: stop accepting new connections, finish in-flight requests, then exit
process.on("SIGTERM", () => {
  httpServer.close(() => {
    console.log("Server closed");
    process.exit(0);
  });
});
