"use strict";

const User = require("../models/User");
const Post = require("../models/Post");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const serialize = require("../utils/serialize");
const authService = require("../services/authService");
const emitter = require("../sockets/emitter");

const list = asyncHandler(async (req, res) => {
  const users = await authService.listUsers({
    q: req.query.q,
    includeInactive: req.query.includeInactive === "true" && req.user?.role === "admin",
  });
  return ApiResponse.ok(res, users);
});

const get = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).lean();
  if (!user) throw ApiError.notFound("Member not found");
  const posts = await Post.countDocuments({ author: user._id });
  return ApiResponse.ok(res, { ...serialize.user(user), postsCount: posts });
});

const updateMe = asyncHandler(async (req, res) => {
  const user = await authService.updateProfile(req.user._id, req.body);
  emitter.emitAll("user:updated", { user });
  return ApiResponse.ok(res, user, "Profile updated");
});

const updateSettings = asyncHandler(async (req, res) => {
  const user = await authService.updateSettings(req.user._id, req.body);
  return ApiResponse.ok(res, user, "Settings saved");
});

const adminUpdate = asyncHandler(async (req, res) => {
  const updates = {};
  if (req.body.role !== undefined) {
    if (!["user", "admin"].includes(req.body.role)) throw ApiError.badRequest("Invalid role");
    updates.role = req.body.role;
  }
  if (req.body.active !== undefined) updates.active = Boolean(req.body.active);
  if (req.body.name !== undefined) updates.name = String(req.body.name).slice(0, 80);
  if (req.body.bio !== undefined) updates.bio = String(req.body.bio).slice(0, 300);
  const user = await User.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true, runValidators: true }).lean();
  if (!user) throw ApiError.notFound("Member not found");
  const payload = serialize.user(user);
  emitter.emitAll("user:updated", { user: payload });
  if (updates.active === false) emitter.emitToUser(user._id, "account:disabled", {});
  return ApiResponse.ok(res, payload, "Member updated");
});

const adminRemove = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.id, { $set: { active: false } }, { new: true }).lean();
  if (!user) throw ApiError.notFound("Member not found");
  emitter.emitToUser(user._id, "account:disabled", {});
  return ApiResponse.ok(res, serialize.user(user), "Member deactivated");
});

const directory = asyncHandler(async (req, res) => {
  const q = String(req.query.q || "").trim();
  const query = { active: true };
  if (q) {
    const safe = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    query.$or = [{ name: new RegExp(safe, "i") }, { email: new RegExp(safe, "i") }];
  }
  const users = await User.find(query).sort({ name: 1 }).limit(100).lean();
  return ApiResponse.ok(res, users.map((u) => serialize.user(u, { includeEmail: false })));
});

module.exports = { list, get, updateMe, updateSettings, adminUpdate, adminRemove, directory };
