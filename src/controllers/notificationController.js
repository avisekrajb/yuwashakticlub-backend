"use strict";

const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const notificationService = require("../services/notificationService");
const env = require("../config/env");

const list = asyncHandler(async (req, res) => {
  const notifications = await notificationService.listForUser(req.user._id, {
    limit: req.query.limit,
    before: req.query.before,
  });
  return ApiResponse.ok(res, {
    notifications,
    retentionDays: env.limits.notificationDays,
  });
});

const unreadCount = asyncHandler(async (req, res) => {
  const count = await notificationService.unreadCount(req.user._id);
  return ApiResponse.ok(res, { unread: count });
});

const readOne = asyncHandler(async (req, res) => {
  await notificationService.markRead(req.user._id, req.params.id);
  return ApiResponse.ok(res, { read: true });
});

const readAll = asyncHandler(async (req, res) => {
  const count = await notificationService.markAllRead(req.user._id);
  return ApiResponse.ok(res, { updated: count }, "All notifications marked read");
});

const remove = asyncHandler(async (req, res) => {
  await notificationService.remove(req.user._id, req.params.id);
  return ApiResponse.ok(res, { deleted: true });
});

const clear = asyncHandler(async (req, res) => {
  const count = await notificationService.clear(req.user._id);
  return ApiResponse.ok(res, { deleted: count }, "Notifications cleared");
});

const broadcast = asyncHandler(async (req, res) => {
  const created = await notificationService.notifyAll({
    actor: req.user._id,
    type: req.body.type || "system",
    text: req.body.text,
    ref: req.body.ref || null,
    refType: req.body.refType || null,
  });
  return ApiResponse.created(res, { sent: created.length }, "Notification sent");
});

module.exports = { list, unreadCount, readOne, readAll, remove, clear, broadcast };
