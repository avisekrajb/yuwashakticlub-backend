"use strict";

const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const toInt = (value, fallback) => {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : fallback;
};

/**
 * Parse a duration such as "6h", "45m", "30d" or "120s" into seconds.
 * Plain numbers are treated as seconds.
 */
function parseDurationSeconds(value, fallbackSeconds) {
  if (value === undefined || value === null || value === "") return fallbackSeconds;
  const raw = String(value).trim().toLowerCase();
  const match = raw.match(/^(\d+(?:\.\d+)?)\s*(s|m|h|d)?$/);
  if (!match) return fallbackSeconds;
  const amount = Number.parseFloat(match[1]);
  const unit = match[2] || "s";
  const factor = { s: 1, m: 60, h: 3600, d: 86400 }[unit];
  return Math.max(1, Math.round(amount * factor));
}

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  isProd: (process.env.NODE_ENV || "development") === "production",
  port: toInt(process.env.PORT, 5000),
  apiPrefix: process.env.API_PREFIX || "/api",
  clientOrigins: (process.env.CLIENT_ORIGINS || "http://localhost:3000")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  seedOnStart: String(process.env.SEED_ON_START || "true") === "true",

  jwtSecret: process.env.JWT_SECRET || "",
  jwtTtl: process.env.JWT_TTL || "30d",
  bcryptRounds: toInt(process.env.BCRYPT_ROUNDS, 10),

  mongoUri: process.env.MONGODB_URI || "",
  mongoDb: process.env.MONGODB_DB || "clubdb",

  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || "",
    apiKey: process.env.CLOUDINARY_API_KEY || "",
    apiSecret: process.env.CLOUDINARY_API_SECRET || "",
  },

  livekit: {
    url: process.env.LIVEKIT_URL || "",
    apiKey: process.env.LIVEKIT_API_KEY || "",
    apiSecret: process.env.LIVEKIT_API_SECRET || "",
    tokenTtlSeconds: parseDurationSeconds(process.env.LIVEKIT_TOKEN_TTL, 6 * 3600),
  },

  limits: {
    maxVideoMb: toInt(process.env.MAX_VIDEO_MB, 200),
    maxImageMb: toInt(process.env.MAX_IMAGE_MB, 25),
    maxAudioMb: toInt(process.env.MAX_AUDIO_MB, 20),
    postVideoSeconds: toInt(process.env.POST_VIDEO_SECONDS, 300),
    storySeconds: toInt(process.env.STORY_SECONDS, 15),
    liveSeconds: toInt(process.env.LIVE_SECONDS, 600),
    callRingSeconds: toInt(process.env.CALL_RING_SECONDS, 45),
    notificationDays: toInt(process.env.NOTIFICATION_DAYS, 30),
  },
};

const missing = [];
if (!env.mongoUri) missing.push("MONGODB_URI");
if (!env.jwtSecret) missing.push("JWT_SECRET");
if (!env.cloudinary.cloudName || !env.cloudinary.apiKey || !env.cloudinary.apiSecret) {
  missing.push("CLOUDINARY_*");
}
if (!env.livekit.url || !env.livekit.apiKey || !env.livekit.apiSecret) {
  missing.push("LIVEKIT_*");
}
if (missing.length && env.isProd) {
  throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
}
if (missing.length) {
  // eslint-disable-next-line no-console
  console.warn(`[env] Missing ${missing.join(", ")}. Some features will be disabled.`);
}

env.limits.maxVideoBytes = env.limits.maxVideoMb * 1024 * 1024;
env.limits.maxImageBytes = env.limits.maxImageMb * 1024 * 1024;
env.limits.maxAudioBytes = env.limits.maxAudioMb * 1024 * 1024;
env.notificationTtlSeconds = env.limits.notificationDays * 86400;

module.exports = env;
module.exports.parseDurationSeconds = parseDurationSeconds;
