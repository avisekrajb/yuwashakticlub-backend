"use strict";

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const morgan = require("morgan");
const env = require("./config/env");
const routes = require("./routes");
const notFound = require("./middleware/notFound");
const errorHandler = require("./middleware/errorHandler");
const { apiLimiter } = require("./middleware/rateLimiter");

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
    crossOriginEmbedderPolicy: false,
  })
);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (env.clientOrigins.includes("*") || env.clientOrigins.includes(origin)) return callback(null, true);
      if (!env.isProd) return callback(null, true);
      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(compression());
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));
if (env.nodeEnv !== "test") {
  app.use(morgan(env.isProd ? "combined" : "dev"));
}

app.get("/", (_req, res) => {
  res.json({
    success: true,
    name: "Shree Yuwa Shakti Club API",
    version: "1.0.0",
    api: env.apiPrefix,
    health: `${env.apiPrefix}/health`,
    realtime: "Socket.IO",
    calls: "LiveKit SFU",
    media: "Cloudinary",
    database: "MongoDB Atlas",
  });
});

app.use(env.apiPrefix, apiLimiter, routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
