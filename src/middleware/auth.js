"use strict";

const User = require("../models/User");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { verifyToken } = require("../utils/generateToken");

function readToken(req) {
  const header = req.headers.authorization || "";
  if (header.startsWith("Bearer ")) return header.slice(7).trim();
  if (req.query && typeof req.query.token === "string") return req.query.token;
  return null;
}

const auth = asyncHandler(async (req, _res, next) => {
  const token = readToken(req);
  if (!token) throw ApiError.unauthorized();

  let payload;
  try {
    payload = verifyToken(token);
  } catch (_err) {
    throw ApiError.unauthorized("Your session expired. Please log in again.", "TOKEN_INVALID");
  }

  const user = await User.findById(payload.sub);
  if (!user) throw ApiError.unauthorized("Account no longer exists.", "USER_GONE");
  if (!user.active) throw ApiError.forbidden("This account is deactivated.", "ACCOUNT_DISABLED");

  req.user = user;
  req.userId = String(user._id);
  req.token = token;
  next();
});

const optionalAuth = asyncHandler(async (req, _res, next) => {
  const token = readToken(req);
  if (!token) return next();
  try {
    const payload = verifyToken(token);
    const user = await User.findById(payload.sub);
    if (user && user.active) {
      req.user = user;
      req.userId = String(user._id);
      req.token = token;
    }
  } catch (_err) {
    /* ignore invalid tokens for public endpoints */
  }
  next();
});

module.exports = auth;
module.exports.auth = auth;
module.exports.optionalAuth = optionalAuth;
module.exports.required = auth;
module.exports.readToken = readToken;
