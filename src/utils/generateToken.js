"use strict";

const jwt = require("jsonwebtoken");
const env = require("../config/env");

function generateToken(user) {
  return jwt.sign(
    { sub: String(user._id || user.id), role: user.role || "user" },
    env.jwtSecret,
    { expiresIn: env.jwtTtl, issuer: "syc-api", audience: "syc-app" }
  );
}

function verifyToken(token) {
  return jwt.verify(token, env.jwtSecret, {
    issuer: "syc-api",
    audience: "syc-app",
  });
}

module.exports = { generateToken, verifyToken };
