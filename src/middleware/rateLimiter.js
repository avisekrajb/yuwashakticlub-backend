"use strict";

const rateLimit = require("express-rate-limit");

const handler = (_req, res) =>
  res.status(429).json({
    success: false,
    code: "RATE_LIMITED",
    message: "Too many requests. Please slow down and try again shortly.",
  });

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 600,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler,
});

const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 40,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler,
});

const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  handler,
});

module.exports = { apiLimiter, authLimiter, uploadLimiter, writeLimiter };
