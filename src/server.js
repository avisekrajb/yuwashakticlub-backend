"use strict";

const http = require("http");
const { Server } = require("socket.io");
const app = require("./app");
const env = require("./config/env");
const logger = require("./utils/logger");
const { connectDB, disconnectDB } = require("./config/db");
const sockets = require("./sockets");
const { startJobs } = require("./services/cleanupService");
const { seedDatabase } = require("./seed/seed");
const About = require("./models/About");
const User = require("./models/User");

const server = http.createServer(app);

const allowedOrigins = env.clientOrigins.includes("*") || !env.isProd ? true : env.clientOrigins;
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
    methods: ["GET", "POST"],
  },
  pingInterval: 25000,
  pingTimeout: 20000,
  maxHttpBufferSize: 2 * 1024 * 1024,
  transports: ["websocket", "polling"],
});

sockets.init(io);

let stopJobs = null;

async function start() {
  try {
    await connectDB();

    if (env.seedOnStart) {
      const hasContent = (await About.countDocuments()) > 0;
      const hasUsers = (await User.countDocuments()) > 0;
      if (!hasContent || !hasUsers) {
        await seedDatabase();
      }
    }

    stopJobs = startJobs();

    server.listen(env.port, () => {
      logger.info(`API listening on http://localhost:${env.port}${env.apiPrefix}`);
      logger.info(`Allowed web origins: ${env.clientOrigins.join(", ")}`);
      logger.info(`LiveKit: ${env.livekit.url || "not configured"}`);
    });
  } catch (err) {
    logger.error("Failed to start server:", err);
    process.exit(1);
  }
}

async function shutdown(signal) {
  logger.info(`${signal} received, shutting down…`);
  if (stopJobs) stopJobs();
  io.close();
  server.close(async () => {
    await disconnectDB();
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 8000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("unhandledRejection", (reason) => logger.error("Unhandled rejection:", reason));
process.on("uncaughtException", (err) => {
  logger.error("Uncaught exception:", err);
});

start();

module.exports = { server, io };
