"use strict";

const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const blogService = require("../services/blogService");
const commentService = require("../services/commentService");

const list = asyncHandler(async (req, res) => ApiResponse.ok(res, await blogService.list({ limit: req.query.limit })));
const get = asyncHandler(async (req, res) => ApiResponse.ok(res, await blogService.get(req.params.id)));

const create = asyncHandler(async (req, res) => {
  const blog = await blogService.create(req.body, req.user);
  return ApiResponse.created(res, blog, "Blog published");
});

const update = asyncHandler(async (req, res) => {
  const blog = await blogService.update(req.params.id, req.body);
  return ApiResponse.ok(res, blog, "Blog updated");
});

const remove = asyncHandler(async (req, res) => {
  await blogService.remove(req.params.id);
  return ApiResponse.ok(res, { deleted: true }, "Blog deleted");
});

const comments = asyncHandler(async (req, res) => {
  const list = await commentService.list("blog", req.params.id, { limit: req.query.limit });
  return ApiResponse.ok(res, list);
});

const addComment = asyncHandler(async (req, res) => {
  const comment = await commentService.create({
    targetType: "blog",
    targetId: req.params.id,
    user: req.user,
    text: req.body.text,
    parent: req.body.parent,
  });
  return ApiResponse.created(res, comment, "Comment added");
});

module.exports = { list, get, create, update, remove, comments, addComment };
