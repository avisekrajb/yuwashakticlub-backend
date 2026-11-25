"use strict";

const Notification = require("../models/Notification");
const User = require("../models/User");
const serialize = require("../utils/serialize");
const emitter = require("../sockets/emitter");
const env = require("../config/env");

const SETTING_FOR_TYPE = {
  post: "notifyPosts",
  story: "notifyPosts",
  live: "notifyPosts",
  message: "notifyChat",
  call: "notifyCalls",
};

function expiresAt() {
  return new Date(Date.now() + env.notificationTtlSeconds * 1000);
}

/**
 * Create one notification for a user (respecting their preferences) and push it live.
 */
async function notify({ userId, actor = null, type = "system", text, ref = null, refType = null, force = false }) {
  if (!userId || !text) return null;
  if (actor && String(actor) === String(userId)) return null;

  const user = await User.findById(userId).select("active settings").lean();
  if (!user || user.active === false) return null;

  const setting = SETTING_FOR_TYPE[type];
  if (!force && setting && user.settings && user.settings[setting] === false) return null;

  const doc = await Notification.create({
    user: userId,
    actor: actor || null,
    type,
    text: String(text).slice(0, 400),
    ref: ref ? String(ref) : null,
    refType,
    expiresAt: expiresAt(),
  });

  const payload = serialize.notification(doc);
  emitter.emitToUser(userId, "notification:new", payload);
  return payload;
}

/**
 * Notify several users at once. One query for preferences, one insertMany.
 */
async function notifyMany({ userIds = [], actor = null, type = "system", text, ref = null, refType = null, force = false }) {
  const ids = [...new Set(userIds.map(String))].filter((id) => id && id !== String(actor || ""));
  if (!ids.length) return [];

  const users = await User.find({ _id: { $in: ids }, active: true }).select("settings").lean();
  const setting = SETTING_FOR_TYPE[type];
  const allowed = users
    .filter((u) => force || !setting || !u.settings || u.settings[setting] !== false)
    .map((u) => u._id);

  if (!allowed.length) return [];

  const docs = await Notification.insertMany(
    allowed.map((user) => ({
      user,
      actor: actor || null,
      type,
      text: String(text).slice(0, 400),
      ref: ref ? String(ref) : null,
      refType,
      expiresAt: expiresAt(),
    })),
    { ordered: false }
  );

  const payloads = docs.map((doc) => serialize.notification(doc));
  docs.forEach((doc) => {
    emitter.emitToUser(doc.user, "notification:new", serialize.notification(doc));
  });
  return payloads;
}

/**
 * Broadcast to every active member (admins/system use). `exclude` avoids notifying the actor.
 */
async function notifyAll({ actor = null, exclude = [], type = "system", text, ref = null, refType = null }) {
  const users = await User.find({ active: true }).select("_id").lean();
  const excludeSet = new Set([String(actor || ""), ...exclude.map(String)].filter(Boolean));
  const userIds = users.map((u) => String(u._id)).filter((id) => !excludeSet.has(id));
  return notifyMany({ userIds, actor, type, text, ref, refType });
}

async function listForUser(userId, { limit = 60, before } = {}) {
  const query = { user: userId, expiresAt: { $gt: new Date() } };
  if (before) query.createdAt = { $lt: new Date(before) };
  const docs = await Notification.find(query)
    .sort({ createdAt: -1 })
    .limit(Math.min(Number(limit) || 60, 100))
    .lean();
  return docs.map((d) => serialize.notification(d));
}

async function unreadCount(userId) {
  return Notification.countDocuments({ user: userId, readAt: null, expiresAt: { $gt: new Date() } });
}

async function markRead(userId, notificationId) {
  await Notification.updateOne({ _id: notificationId, user: userId }, { $set: { readAt: new Date() } });
}

async function markAllRead(userId) {
  const result = await Notification.updateMany(
    { user: userId, readAt: null },
    { $set: { readAt: new Date() } }
  );
  return result.modifiedCount || 0;
}

async function remove(userId, notificationId) {
  await Notification.deleteOne({ _id: notificationId, user: userId });
}

async function clear(userId) {
  const result = await Notification.deleteMany({ user: userId });
  return result.deletedCount || 0;
}

module.exports = {
  notify,
  notifyMany,
  notifyAll,
  listForUser,
  unreadCount,
  markRead,
  markAllRead,
  remove,
  clear,
};
