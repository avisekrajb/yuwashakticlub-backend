"use strict";

const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const contentService = require("../services/contentService");

const list = asyncHandler(async (_req, res) => ApiResponse.ok(res, await contentService.listCollection("team")));

const create = asyncHandler(async (req, res) => {
  const item = await contentService.createItem("team", req.body, req.user);
  return ApiResponse.created(res, item, "Added");
});

const update = asyncHandler(async (req, res) => {
  const item = await contentService.updateItem("team", req.params.id, req.body);
  return ApiResponse.ok(res, item, "Saved");
});

const remove = asyncHandler(async (req, res) => {
  await contentService.deleteItem("team", req.params.id);
  return ApiResponse.ok(res, { deleted: true }, "Deleted");
});

module.exports = { list, create, update, remove };
