"use strict";

const multer = require("multer");
const env = require("../config/env");
const ApiError = require("../utils/ApiError");

const ALLOWED = /^(image\/(jpeg|png|webp|gif|avif|heic|heif)|video\/(mp4|webm|quicktime|x-matroska|3gpp|ogg)|audio\/(mpeg|mp4|webm|ogg|wav|x-m4a|aac|3gpp))$/i;

const storage = multer.memoryStorage();

const fileFilter = (_req, file, cb) => {
  if (ALLOWED.test(file.mimetype || "")) return cb(null, true);
  cb(ApiError.badRequest(`Unsupported file type: ${file.mimetype || "unknown"}`, "FILE_TYPE"));
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: env.limits.maxVideoBytes,
    files: 1,
    fields: 20,
  },
});

module.exports = upload;
