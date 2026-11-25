"use strict";

const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const callService = require("../services/callService");

const start = asyncHandler(async (req, res) => {
  const call = await callService.start({
    caller: req.user,
    toUserId: req.body.toUserId,
    conversationId: req.body.conversationId,
    kind: req.body.kind,
  });
  return ApiResponse.created(res, call, "Calling…");
});

const token = asyncHandler(async (req, res) => {
  const result = await callService.token(req.params.id, req.user);
  return ApiResponse.ok(res, result);
});

const accept = asyncHandler(async (req, res) => {
  const result = await callService.accept(req.params.id, req.user);
  return ApiResponse.ok(res, result, "Call accepted");
});

const join = asyncHandler(async (req, res) => {
  const result = await callService.join(req.params.id, req.user);
  return ApiResponse.ok(res, result);
});

const reject = asyncHandler(async (req, res) => {
  await callService.reject(req.params.id, req.user);
  return ApiResponse.ok(res, { rejected: true });
});

const end = asyncHandler(async (req, res) => {
  await callService.end(req.params.id, req.user, req.user.role === "admin", req.body.reason || "hangup");
  return ApiResponse.ok(res, { ended: true });
});

const control = asyncHandler(async (req, res) => {
  const state = await callService.control(req.params.id, req.user, req.body);
  return ApiResponse.ok(res, state);
});

const get = asyncHandler(async (req, res) => {
  const call = await callService.get(req.params.id, req.user, req.user.role === "admin");
  return ApiResponse.ok(res, call);
});

const history = asyncHandler(async (req, res) => {
  const calls = await callService.history(req.user, req.query.limit);
  return ApiResponse.ok(res, calls);
});

module.exports = { start, token, accept, join, reject, end, control, get, history };
