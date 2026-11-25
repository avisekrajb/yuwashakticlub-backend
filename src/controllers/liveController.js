"use strict";

const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const liveService = require("../services/liveService");

const list = asyncHandler(async (req, res) => ApiResponse.ok(res, await liveService.listActive(req.user?._id)));

const history = asyncHandler(async (req, res) => ApiResponse.ok(res, await liveService.history(req.query.limit)));

const get = asyncHandler(async (req, res) => ApiResponse.ok(res, await liveService.get(req.params.id, req.user?._id)));

const start = asyncHandler(async (req, res) => {
  const result = await liveService.start(req.user, req.body.title);
  return ApiResponse.created(res, result, "You are live now");
});

const token = asyncHandler(async (req, res) => {
  const result = await liveService.token(req.params.id, req.user);
  return ApiResponse.ok(res, result);
});

const end = asyncHandler(async (req, res) => {
  await liveService.end(req.params.id, req.user, req.user.role === "admin", req.body.reason || "host_ended");
  return ApiResponse.ok(res, { ended: true }, "Live video ended");
});

const comment = asyncHandler(async (req, res) => {
  const result = await liveService.comment(req.params.id, req.user, req.body.text);
  return ApiResponse.created(res, result);
});

const reaction = asyncHandler(async (req, res) => {
  const result = await liveService.reaction(req.params.id, req.user, req.body.emoji);
  return ApiResponse.ok(res, result);
});

const leave = asyncHandler(async (req, res) => {
  const result = await liveService.leave(req.params.id, req.user);
  return ApiResponse.ok(res, result);
});

module.exports = { list, history, get, start, token, end, comment, reaction, leave };
