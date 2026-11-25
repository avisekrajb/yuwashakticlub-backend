"use strict";

const Live = require("../models/Live");
const User = require("../models/User");
const ApiError = require("../utils/ApiError");
const serialize = require("../utils/serialize");
const emitter = require("../sockets/emitter");
const notificationService = require("./notificationService");
const livekit = require("./livekitService");
const { LIMITS } = require("../config/constants");

const MAX_STORED_COMMENTS = 300;
const MAX_STORED_REACTIONS = 200;

async function start(user, title) {
  const running = await Live.findOne({ host: user._id, status: "live" }).lean();
  if (running) throw ApiError.conflict("You already have a live video running.", "ALREADY_LIVE");

  const cleanTitle = String(title || "").trim();
  if (cleanTitle.length < 2) throw ApiError.badRequest("Give your live video a title");
  if (cleanTitle.length > 120) throw ApiError.badRequest("Title is too long");

  const room = `live_${user._id}_${Date.now().toString(36)}`;
  await livekit.createRoom(room, { maxParticipants: 100, emptyTimeout: 60, metadata: JSON.stringify({ host: String(user._id) }) });

  const doc = await Live.create({
    host: user._id,
    title: cleanTitle,
    room,
    status: "live",
    maxDurationSec: LIMITS.liveSeconds,
    startedAt: new Date(),
    viewers: [user._id],
  });

  const token = await livekit.createToken({
    identity: `${user._id}_host_${Date.now().toString(36)}`,
    name: user.name,
    room,
    canPublish: true,
    canSubscribe: true,
    metadata: { liveId: String(doc._id), role: "host" },
  });

  const populated = await Live.findById(doc._id).populate("host", "name photo role email bio active").lean();
  const payload = serialize.live(populated, user._id);

  emitter.emitAll("live:new", { live: payload });
  notificationService
    .notifyAll({
      actor: user._id,
      type: "live",
      text: `🔴 ${user.name} is live now: “${cleanTitle}”`,
      ref: String(doc._id),
      refType: "live",
    })
    .catch(() => {});

  return { live: payload, ...token, maxDurationSec: LIMITS.liveSeconds };
}

async function listActive(viewerId) {
  const docs = await Live.find({ status: "live" })
    .sort({ startedAt: -1 })
    .limit(50)
    .populate("host", "name photo role email bio active")
    .lean();
  return docs.map((d) => serialize.live(d, viewerId));
}

async function history(limit = 30) {
  const docs = await Live.find({ status: "ended" })
    .sort({ startedAt: -1 })
    .limit(Math.min(Number(limit) || 30, 100))
    .populate("host", "name photo role email bio active")
    .lean();
  return docs.map((d) => serialize.live(d, null));
}

async function get(liveId, viewerId) {
  const doc = await Live.findById(liveId).populate("host", "name photo role email bio active").lean();
  if (!doc) throw ApiError.notFound("Live video not found");
  return serialize.live(doc, viewerId);
}

async function token(liveId, user) {
  const live = await Live.findById(liveId);
  if (!live) throw ApiError.notFound("Live video not found");
  if (live.status !== "live") throw ApiError.badRequest("This live video has ended");

  // Anonymous visitors may watch a live video; only signed-in members are tracked as viewers.
  if (!user) {
    const guestIdentity = `guest_${Math.random().toString(36).slice(2, 10)}`;
    const result = await livekit.createToken({
      identity: guestIdentity,
      name: "Guest",
      room: live.room,
      canPublish: false,
      canSubscribe: true,
      metadata: { liveId: String(live._id), role: "guest" },
    });
    return { live: serialize.live(live.toObject ? live.toObject() : live, null), ...result, isHost: false };
  }

  const isHost = String(live.host) === String(user._id);
  if (!isHost) {
    await Live.updateOne({ _id: live._id }, { $addToSet: { viewers: user._id } });
    const updated = await Live.findById(live._id).lean();
    const count = (updated?.viewers || []).length;
    if (count > (updated?.peakViewers || 0)) {
      await Live.updateOne({ _id: live._id }, { $set: { peakViewers: count } });
    }
    emitter.emitToRoom(`live:${live._id}`, "live:viewers", { liveId: String(live._id), viewers: count });
    emitter.emitAll("live:viewers", { liveId: String(live._id), viewers: count });
  }

  const result = await livekit.createToken({
    identity: `${user._id}_${isHost ? "host" : "viewer"}_${Date.now().toString(36)}`,
    name: user.name,
    room: live.room,
    canPublish: isHost,
    canSubscribe: true,
    metadata: { liveId: String(live._id), role: isHost ? "host" : "viewer" },
  });
  const updatedLive = await Live.findById(live._id).populate("host", "name photo role email bio active").lean();
  return { live: serialize.live(updatedLive, user._id), ...result, isHost };
}

async function endInternal(live, reason = "ended") {
  if (!live || live.status !== "live") return null;
  const endedAt = new Date();
  live.status = "ended";
  live.endedAt = endedAt;
  live.endReason = reason;
  await live.save();
  livekit.deleteRoom(live.room).catch(() => {});

  emitter.emitToRoom(`live:${live._id}`, "live:ended", {
    liveId: String(live._id),
    reason,
    endedAt: endedAt.getTime(),
  });
  emitter.emitAll("live:ended", { liveId: String(live._id), reason, endedAt: endedAt.getTime() });
  return true;
}

async function end(liveId, user, isAdmin = false, reason = "host_ended") {
  const live = await Live.findById(liveId);
  if (!live) throw ApiError.notFound("Live video not found");
  if (String(live.host) !== String(user._id) && !isAdmin) {
    throw ApiError.forbidden("Only the host can end this live video");
  }
  await endInternal(live, reason);
  return true;
}

async function comment(liveId, user, text) {
  const clean = String(text || "").trim();
  if (!clean) throw ApiError.badRequest("Write a comment first");
  if (clean.length > 500) throw ApiError.badRequest("Comment is too long");
  const live = await Live.findById(liveId);
  if (!live || live.status !== "live") throw ApiError.badRequest("This live video has ended");

  live.comments.push({ user: user._id, text: clean, at: new Date() });
  if (live.comments.length > MAX_STORED_COMMENTS) live.comments = live.comments.slice(-MAX_STORED_COMMENTS);
  await live.save();

  const comment = live.comments[live.comments.length - 1];
  const payload = { id: String(comment._id), liveId: String(live._id), userId: String(user._id), user: serialize.user(user, { includeEmail: false }), text: clean, t: comment.at.getTime() };
  emitter.emitToRoom(`live:${live._id}`, "live:comment", payload);
  emitter.emitAll("live:comment", payload);
  return payload;
}

async function reaction(liveId, user, emoji = "❤️") {
  const live = await Live.findById(liveId);
  if (!live || live.status !== "live") throw ApiError.badRequest("This live video has ended");
  live.reactions.push({ user: user._id, emoji: String(emoji).slice(0, 8), at: new Date() });
  if (live.reactions.length > MAX_STORED_REACTIONS) live.reactions = live.reactions.slice(-MAX_STORED_REACTIONS);
  await live.save();
  const payload = { liveId: String(live._id), userId: String(user._id), emoji: String(emoji).slice(0, 8), t: Date.now() };
  emitter.emitToRoom(`live:${live._id}`, "live:reaction", payload);
  emitter.emitAll("live:reaction", payload);
  return payload;
}

async function leave(liveId, user) {
  await Live.updateOne({ _id: liveId }, { $pull: { viewers: user._id } });
  const live = await Live.findById(liveId).lean();
  const count = (live?.viewers || []).length;
  emitter.emitToRoom(`live:${liveId}`, "live:viewers", { liveId: String(liveId), viewers: count });
  emitter.emitAll("live:viewers", { liveId: String(liveId), viewers: count });
  return { viewers: count };
}

async function autoEndExpired() {
  const lives = await Live.find({ status: "live" }).lean();
  const now = Date.now();
  let ended = 0;
  for (const live of lives) {
    const elapsed = now - new Date(live.startedAt).getTime();
    if (elapsed >= (live.maxDurationSec || LIMITS.liveSeconds) * 1000) {
      const doc = await Live.findById(live._id);
      if (doc) {
        await endInternal(doc, "time_limit");
        ended += 1;
      }
    }
  }
  return ended;
}

async function endByHost(userId, reason = "host_disconnected") {
  const lives = await Live.find({ host: userId, status: "live" });
  for (const live of lives) await endInternal(live, reason);
}

module.exports = { start, listActive, history, get, token, end, comment, reaction, leave, autoEndExpired, endByHost };
