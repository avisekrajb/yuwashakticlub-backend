"use strict";

const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const commentService = require("../services/commentService");

const list = asyncHandler(async (req, res) => {
  const targetType = req.query.targetType === "post" ? "post" : "blog";
  const targetId = req.query.targetId;
  const comments = await commentService.list(targetType, targetId, { limit: req.query.limit });
  return ApiResponse.ok(res, comments);
});

const create = asyncHandler(async (req, res) => {
  const comment = await commentService.create({
    targetType: req.body.targetType === "post" ? "post" : "blog",
    targetId: req.body.targetId,
    user: req.user,
    text: req.body.text,
    parent: req.body.parent,
  });
  return ApiResponse.created(res, comment, "Comment added");
});

const remove = asyncHandler(async (req, res) => {
  const result = await commentService.remove(req.params.id, req.user, req.user.role === "admin");
  return ApiResponse.ok(res, result, "Comment deleted");
});

module.exports = { list, create, remove };
