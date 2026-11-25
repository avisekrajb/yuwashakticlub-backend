"use strict";

const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const postService = require("../services/postService");
const commentService = require("../services/commentService");

const list = asyncHandler(async (req, res) => {
  const result = await postService.feed({
    cursor: req.query.cursor,
    limit: req.query.limit,
    authorId: req.query.author,
    viewerId: req.user?._id,
  });
  return ApiResponse.ok(res, result);
});

const create = asyncHandler(async (req, res) => {
  const post = await postService.create({
    user: req.user,
    text: req.body.text,
    media: req.body.media,
    category: req.body.category,
  });
  return ApiResponse.created(res, post, "Posted");
});

const get = asyncHandler(async (req, res) => {
  const post = await postService.get(req.params.id, req.user?._id);
  return ApiResponse.ok(res, post);
});

const update = asyncHandler(async (req, res) => {
  const post = await postService.update(req.params.id, req.user, req.body, req.user.role === "admin");
  return ApiResponse.ok(res, post, "Post updated");
});

const remove = asyncHandler(async (req, res) => {
  await postService.remove(req.params.id, req.user, req.user.role === "admin");
  return ApiResponse.ok(res, { deleted: true }, "Post deleted");
});

const react = asyncHandler(async (req, res) => {
  const post = await postService.react(req.params.id, req.user._id, req.body.type || "like");
  return ApiResponse.ok(res, post);
});

const share = asyncHandler(async (req, res) => {
  const result = await postService.share(req.params.id, req.user._id);
  return ApiResponse.ok(res, result, result.already ? "You already shared this post" : "Post shared");
});

const view = asyncHandler(async (req, res) => {
  await postService.view(req.params.id);
  return ApiResponse.ok(res, { viewed: true });
});

const listComments = asyncHandler(async (req, res) => {
  const comments = await commentService.list("post", req.params.id, { limit: req.query.limit });
  return ApiResponse.ok(res, comments);
});

const addComment = asyncHandler(async (req, res) => {
  const comment = await commentService.create({
    targetType: "post",
    targetId: req.params.id,
    user: req.user,
    text: req.body.text,
    parent: req.body.parent,
  });
  return ApiResponse.created(res, comment, "Comment added");
});

const deleteComment = asyncHandler(async (req, res) => {
  const result = await commentService.remove(req.params.commentId, req.user, req.user.role === "admin");
  return ApiResponse.ok(res, result, "Comment deleted");
});

module.exports = { list, create, get, update, remove, react, share, view, listComments, addComment, deleteComment };
