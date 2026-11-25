"use strict";

const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const contentService = require("../services/contentService");
const env = require("../config/env");

const bootstrap = asyncHandler(async (req, res) => {
  const data = await contentService.bootstrap(req.user || null);
  return ApiResponse.ok(res, data);
});

const config = asyncHandler(async (_req, res) => {
  return ApiResponse.ok(res, {
    livekitUrl: env.livekit.url,
    cloudinaryCloudName: env.cloudinary.cloudName,
    limits: contentService.bootstrap
      ? {
          maxVideoMb: env.limits.maxVideoMb,
          maxImageMb: env.limits.maxImageMb,
          maxAudioMb: env.limits.maxAudioMb,
          postVideoSeconds: env.limits.postVideoSeconds,
          storySeconds: env.limits.storySeconds,
          liveSeconds: env.limits.liveSeconds,
          callRingSeconds: env.limits.callRingSeconds,
          notificationDays: env.limits.notificationDays,
        }
      : {},
  });
});

const replaceCollection = asyncHandler(async (req, res) => {
  const items = await contentService.replaceCollection(req.params.name, req.body.items, req.user);
  return ApiResponse.ok(res, items, "Saved");
});

const stats = asyncHandler(async (_req, res) => ApiResponse.ok(res, await contentService.stats()));

const list = asyncHandler(async (req, res) => {
  const items = await contentService.listCollection(req.params.name);
  return ApiResponse.ok(res, items);
});

const create = asyncHandler(async (req, res) => {
  const item = await contentService.createItem(req.params.name, req.body, req.user);
  return ApiResponse.created(res, item, "Added");
});

const update = asyncHandler(async (req, res) => {
  const item = await contentService.updateItem(req.params.name, req.params.id, req.body);
  return ApiResponse.ok(res, item, "Saved");
});

const remove = asyncHandler(async (req, res) => {
  await contentService.deleteItem(req.params.name, req.params.id);
  return ApiResponse.ok(res, { deleted: true }, "Deleted");
});

module.exports = { bootstrap, config, replaceCollection, stats, list, create, update, remove };
