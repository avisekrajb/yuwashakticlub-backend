"use strict";

const ApiError = require("../utils/ApiError");

/**
 * Usage: router.post("/", validate(validator.register), handler)
 * A validator returns { error, value }.
 */
module.exports = function validate(validator) {
  return (req, _res, next) => {
    const result = validator(req.body || {});
    if (!result || result.error) {
      return next(ApiError.badRequest(result?.error || "Invalid request body", "VALIDATION"));
    }
    req.body = result.value || {};
    next();
  };
};
