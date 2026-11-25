"use strict";

class ApiError extends Error {
  constructor(statusCode, message, code = "ERROR", details = undefined) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace?.(this, this.constructor);
  }

  static badRequest(message = "Bad request", code = "BAD_REQUEST", details) {
    return new ApiError(400, message, code, details);
  }

  static unauthorized(message = "Please log in to continue", code = "UNAUTHORIZED") {
    return new ApiError(401, message, code);
  }

  static forbidden(message = "You do not have permission to do that", code = "FORBIDDEN") {
    return new ApiError(403, message, code);
  }

  static notFound(message = "Not found", code = "NOT_FOUND") {
    return new ApiError(404, message, code);
  }

  static conflict(message = "Already exists", code = "CONFLICT") {
    return new ApiError(409, message, code);
  }

  static tooLarge(message = "File is too large", code = "TOO_LARGE") {
    return new ApiError(413, message, code);
  }

  static tooMany(message = "Too many requests, please slow down", code = "RATE_LIMITED") {
    return new ApiError(429, message, code);
  }

  static internal(message = "Something went wrong", code = "INTERNAL") {
    return new ApiError(500, message, code);
  }
}

module.exports = ApiError;
