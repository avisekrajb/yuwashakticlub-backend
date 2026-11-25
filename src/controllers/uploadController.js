"use strict";

const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const uploadService = require("../services/uploadService");
const User = require("../models/User");
const serialize = require("../utils/serialize");

function requireFile(req) {
  if (!req.file) throw ApiError.badRequest("Choose a file to upload", "NO_FILE");
  return req.file;
}

const image = asyncHandler(async (req, res) => {
  const result = await uploadService.uploadFile(requireFile(req), "image");
  return ApiResponse.created(res, result, "Image uploaded");
});

const video = asyncHandler(async (req, res) => {
  const result = await uploadService.uploadFile(requireFile(req), "video");
  return ApiResponse.created(res, result, "Video uploaded");
});

const audio = asyncHandler(async (req, res) => {
  const result = await uploadService.uploadFile(requireFile(req), "audio");
  return ApiResponse.created(res, result, "Audio uploaded");
});

const media = asyncHandler(async (req, res) => {
  const kind = ["avatar", "image", "video", "audio", "post", "story", "chat", "live"].includes(req.body.kind)
    ? req.body.kind
    : "general";
  const result = await uploadService.uploadFile(requireFile(req), kind);
  return ApiResponse.created(res, result, "Uploaded");
});

const avatar = asyncHandler(async (req, res) => {
  const file = requireFile(req);
  const oldUser = await User.findById(req.user._id).select("photoPublicId").lean();
  const result = await uploadService.uploadFile(file, "avatar");
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { $set: { photo: result.url, photoPublicId: result.publicId } },
    { new: true }
  ).lean();
  if (oldUser?.photoPublicId) uploadService.deleteAsset(oldUser.photoPublicId, "image").catch(() => {});
  return ApiResponse.ok(res, { ...result, user: serialize.user(user) }, "Profile photo updated");
});

module.exports = { image, video, audio, media, avatar };
