"use strict";

const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const User = require("../models/User");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const serialize = require("../utils/serialize");
const contentService = require("../services/contentService");
const emitter = require("../sockets/emitter");

const list = asyncHandler(async (req, res) => {
  const query = { type: "group" };
  if (req.user.role !== "admin") query.members = req.user._id;
  const docs = await Conversation.find(query).sort({ createdAt: 1 }).lean();
  return ApiResponse.ok(res, docs.map((d) => serialize.conversation(d, req.user._id)));
});

const create = asyncHandler(async (req, res) => {
  const name = String(req.body.name || "").trim();
  if (name.length < 2) throw ApiError.badRequest("Group name is required");
  const members = await User.find({ active: true }).select("_id").lean();
  const doc = await Conversation.create({
    key: `group-tmp-${Date.now().toString(36)}`,
    type: "group",
    name,
    desc: String(req.body.desc || "").slice(0, 200),
    members: members.map((m) => m._id),
    admins: [req.user._id],
    createdBy: req.user._id,
  });
  doc.key = String(doc._id);
  await doc.save();
  const payload = serialize.conversation(doc, req.user._id);
  emitter.emitAll("groups:changed", {});
  return ApiResponse.created(res, payload, "Group created");
});

const update = asyncHandler(async (req, res) => {
  const doc = await Conversation.findById(req.params.id);
  if (!doc || doc.type !== "group") throw ApiError.notFound("Group not found");
  if (req.body.name !== undefined) doc.name = String(req.body.name).trim().slice(0, 100) || doc.name;
  if (req.body.desc !== undefined) doc.desc = String(req.body.desc).slice(0, 200);
  await doc.save();
  const payload = serialize.conversation(doc, req.user._id);
  emitter.emitAll("groups:changed", {});
  return ApiResponse.ok(res, payload, "Group updated");
});

const remove = asyncHandler(async (req, res) => {
  const doc = await Conversation.findById(req.params.id);
  if (!doc || doc.type !== "group") throw ApiError.notFound("Group not found");
  await Message.deleteMany({ conversation: doc._id });
  await doc.deleteOne();
  emitter.emitAll("groups:changed", {});
  return ApiResponse.ok(res, { deleted: true }, "Group deleted");
});

const addMember = asyncHandler(async (req, res) => {
  const doc = await Conversation.findById(req.params.id);
  if (!doc) throw ApiError.notFound("Group not found");
  doc.members.addToSet(req.params.userId);
  await doc.save();
  return ApiResponse.ok(res, serialize.conversation(doc, req.user._id), "Member added");
});

const removeMember = asyncHandler(async (req, res) => {
  const doc = await Conversation.findById(req.params.id);
  if (!doc) throw ApiError.notFound("Group not found");
  doc.members = doc.members.filter((m) => String(m) !== String(req.params.userId));
  doc.admins = doc.admins.filter((m) => String(m) !== String(req.params.userId));
  await doc.save();
  return ApiResponse.ok(res, serialize.conversation(doc, req.user._id), "Member removed");
});

const reveal = asyncHandler(async (_req, res) => ApiResponse.ok(res, contentService.ALLOWED_COLLECTIONS));

module.exports = { list, create, update, remove, addMember, removeMember, reveal };
