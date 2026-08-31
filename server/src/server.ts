import express from "express";
import { createServer } from "node:http";
import type { Application, Request, Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import authRoutes from "./routes/auth.route.js";
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app: Application = express();
const httpServer = createServer(app);
const PORT: number = ENV.PORT;

const ALLOWED_ORIGINS = [ENV.CLIENT_URL, ENV.SERVER_URL];

// Socket.io setup (auth, presence, group rooms) now lives in config/socket.ts —
// server.ts just wires it to the httpServer instance it created
initSocketServer(httpServer);

app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());
app.use(
  cors({
    origin: ALLOWED_ORIGINS,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.set("trust proxy", 1);
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
app.use(morgan(ENV.NODE_ENV === "production" ? "combined" : "dev"));

// API routes
app.use("/api/auth", authRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/groups", groupRoutes);

// Serve the built React frontend (Vite build output)
app.use(express.static(path.join(__dirname, "..", "..", "client", "dist")));

app.get(/.*/, (req: Request, res: Response) => {
  if (req.originalUrl.startsWith("/api")) {
    return res.status(404).json({ message: "Api routes not found" });
  }
  if (req.originalUrl.includes(".")) {
    return res.status(404).end();
  }
  res.sendFile(
    path.join(__dirname, "..", "..", "client", "dist", "index.html"),
  );
});

app.use(errorHandler);

const startServer = async (): Promise<void> => {
  try {
    await connectDB(ENV.MONGO_URI);

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