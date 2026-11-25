"use strict";

const cloudinary = require("cloudinary").v2;
const env = require("../config/env");
const ApiError = require("../utils/ApiError");
const { FOLDERS } = require("../config/constants");
const logger = require("../utils/logger");

cloudinary.config({
  cloud_name: env.cloudinary.cloudName,
  api_key: env.cloudinary.apiKey,
  api_secret: env.cloudinary.apiSecret,
  secure: true,
});

function configured() {
  return Boolean(env.cloudinary.cloudName && env.cloudinary.apiKey && env.cloudinary.apiSecret);
}

function validateSize(legacy, mimetype) {
  const size = legacy.buffer?.length || 0;
  if (/^image\//i.test(mimetype) && size > env.limits.maxImageBytes) {
    throw ApiError.tooLarge(`Image is too large (max ${env.limits.maxImageMb} MB)`);
  }
  if (/^video\//i.test(mimetype) && size > env.limits.maxVideoBytes) {
    throw ApiError.tooLarge(`Video is too large (max ${env.limits.maxVideoMb} MB)`);
  }
  if (/^audio\//i.test(mimetype) && size > env.limits.maxAudioBytes) {
    throw ApiError.tooLarge(`Audio is too large (max ${env.limits.maxAudioMb} MB)`);
  }
}

function resourceTypeFor(legacy, kind) {
  if (kind === "avatar" || kind === "image") return "image";
  if (kind === "video") return "video";
  if (kind === "audio") return "video";
  const mime = legacy.mimetype || "";
  if (/^image\//.test(mime)) return "image";
  if (/^(video|audio)\//.test(mime)) return "video";
  return "auto";
}

function detectType(legacy, kind) {
  if (kind === "avatar" || kind === "image") return "image";
  if (kind === "video") return "video";
  if (kind === "audio") return "audio";
  const mime = legacy.mimetype || "";
  if (/^image\//.test(mime)) return "image";
  if (/^video\//.test(mime)) return "video";
  if (/^audio\//.test(mime)) return "audio";
  return "file";
}

function posterFor(publicId, type) {
  if (type !== "video" || !publicId) return "";
  return `https://res.cloudinary.com/${env.cloudinary.cloudName}/video/upload/so_0,w_900,c_limit/${publicId}.jpg`;
}

/**
 * Upload a multer memory file to Cloudinary.
 * kind: avatar | image | video | audio | post | story | chat | live
 */
async function uploadFile(file, kind = "general", options = {}) {
  if (!file || !file.buffer) throw ApiError.badRequest("No file received", "NO_FILE");
  if (!configured()) {
    throw ApiError.internal("Cloudinary is not configured on the server", "CLOUDINARY_NOT_CONFIGURED");
  }
  validateSize(file, file.mimetype);

  const type = detectType(file, kind);
  const resourceType = resourceTypeFor(file, kind);
  const folderMap = {
    avatar: FOLDERS.avatar,
    image: FOLDERS.post,
    video: FOLDERS.post,
    audio: FOLDERS.post,
    post: FOLDERS.post,
    story: FOLDERS.story,
    chat: FOLDERS.chat,
    live: FOLDERS.live,
  };
  const folder = options.folder || folderMap[kind] || FOLDERS.general;

  const uploadOptions = {
    folder,
    resource_type: resourceType,
    use_filename: true,
    unique_filename: true,
    overwrite: false,
    timeout: 120000,
  };
  if (type === "image") {
    uploadOptions.transformation = [{ width: 1800, height: 1800, crop: "limit", quality: "auto:good" }];
  }
  if (type === "video") {
    uploadOptions.eager = [{ streaming_profile: "hd", format: "m3u8" }];
    uploadOptions.eager_async = true;
  }

  const result = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(uploadOptions, (error, uploaded) => {
      if (error) return reject(error);
      resolve(uploaded);
    });
    stream.end(file.buffer);
  });

  return {
    url: result.secure_url,
    publicId: result.public_id,
    type,
    poster: posterFor(result.public_id, type),
    name: file.originalname || "",
    size: result.bytes || file.size || 0,
    duration: Number(result.duration) || Number(options.duration) || 0,
    width: result.width || 0,
    height: result.height || 0,
    mimetype: file.mimetype || "",
  };
}

async function deleteAsset(publicId, resourceType = "image") {
  if (!publicId || !configured()) return false;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType, invalidate: true });
    return true;
  } catch (err) {
    logger.warn("Cloudinary delete failed:", publicId, err.message);
    return false;
  }
}

async function deleteMany(items = []) {
  await Promise.allSettled(
    items
      .filter((i) => i && i.publicId)
      .map((i) => deleteAsset(i.publicId, i.type === "image" ? "image" : "video"))
  );
}

module.exports = {
  cloudinary,
  configured,
  uploadFile,
  deleteAsset,
  deleteMany,
  posterFor,
};
