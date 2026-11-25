"use strict";

const mongoose = require("mongoose");
const env = require("./env");
const logger = require("../utils/logger");

mongoose.set("strictQuery", true);

async function connectDB() {
  if (!env.mongoUri) throw new Error("MONGODB_URI is not configured");
  if (mongoose.connection.readyState === 1) return mongoose.connection;

  mongoose.connection.on("connected", () => logger.info("MongoDB connected"));
  mongoose.connection.on("error", (err) => logger.error("MongoDB error", err.message));
  mongoose.connection.on("disconnected", () => logger.warn("MongoDB disconnected"));

  await mongoose.connect(env.mongoUri, {
    dbName: env.mongoDb,
    serverSelectionTimeoutMS: 15000,
    maxPoolSize: 20,
    minPoolSize: 2,
    autoIndex: true,
  });

  return mongoose.connection;
}

async function disconnectDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

module.exports = { connectDB, disconnectDB };
