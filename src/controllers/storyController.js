"use strict";

const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const storyService = require("../services/storyService");

const list = asyncHandler(async (req, res) => {
  const stories = await storyService.listActive(req.user?._id);
  return ApiResponse.ok(res, stories);
});

const create = asyncHandler(async (req, res) => {
  const story = await storyService.create({
    user: req.user,
    kind: req.body.kind,
    url: req.body.url,
    publicId: req.body.publicId,
    poster: req.body.poster,
    caption: req.body.caption,
    duration: req.body.duration,
    sound: req.body.sound,
  });
  return ApiResponse.created(res, story, "Story posted");
});

const view = asyncHandler(async (req, res) => {
  const result = await storyService.view(req.params.id, req.user._id);
  return ApiResponse.ok(res, result);
});

const remove = asyncHandler(async (req, res) => {
  await storyService.remove(req.params.id, req.user, req.user.role === "admin");
  return ApiResponse.ok(res, { deleted: true }, "Story deleted");
});

module.exports = { list, create, view, remove };
