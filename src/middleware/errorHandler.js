"use strict";

const ApiError = require("../utils/ApiError");
const logger = require("../utils/logger");

// eslint-disable-next-line no-unused-vars
module.exports = function errorHandler(err, req, res, _next) {
  let statusCode = err.statusCode || 500;
  let message = err.message || "Something went wrong";
  let code = err.code || "INTERNAL";

  if (err.name === "ValidationError") {
    statusCode = 400;
    code = "VALIDATION_ERROR";
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join(", ");
  } else if (err.name === "CastError") {
    statusCode = 400;
    code = "INVALID_ID";
    message = "Invalid identifier";
  } else if (err.code === 11000) {
    statusCode = 409;
    code = "DUPLICATE";
    const field = Object.keys(err.keyPattern || err.keyValue || {})[0] || "field";
    message = `This ${field} is already in use`;
  } else if (err.name === "MulterError") {
    statusCode = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    code = err.code;
    message =
      err.code === "LIMIT_FILE_SIZE"
        ? "That file is too large for this upload."
        : "Upload failed: " + err.message;
  } else if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
    statusCode = 401;
    code = "TOKEN_INVALID";
    message = "Your session expired. Please log in again.";
  } else if (err.type === "entity.too.large") {
    statusCode = 413;
    code = "BODY_TOO_LARGE";
    message = "Request body is too large";
  }

  if (statusCode >= 500) {
    logger.error(`${req.method} ${req.originalUrl}`, err);
  }

  const payload = {
    success: false,
    code,
    message,
  };
  if (!envIsProd()) payload.stack = err.stack;
  if (err.details) payload.details = err.details;

  res.status(statusCode).json(payload);
};

function envIsProd() {
  return process.env.NODE_ENV === "production";
}
