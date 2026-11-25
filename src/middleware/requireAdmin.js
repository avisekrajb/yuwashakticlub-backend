"use strict";

const ApiError = require("../utils/ApiError");

module.exports = function requireAdmin(req, _res, next) {
  if (!req.user || req.user.role !== "admin") {
    return next(ApiError.forbidden("Admin access required", "ADMIN_ONLY"));
  }
  next();
};
