"use strict";

// Vercel serverless entry point.
// Reuses the Express app from src/app.js and lazily connects to MongoDB
// (the connection is cached across invocations by mongoose).

const app = require("../src/app");
const { connectDB } = require("../src/config/db");

module.exports = async (req, res) => {
  await connectDB();
  return app(req, res);
};
