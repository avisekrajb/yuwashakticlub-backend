"use strict";

const liveService = require("../services/liveService");
const Live = require("../models/Live");
const logger = require("../utils/logger");

const ackError = (ack, err) => {
  if (typeof ack === "function") ack({ ok: false, error: err.message || "Live action failed" });
};

module.exports = function registerLive(io, socket) {
  const userId = socket.userId;

  socket.on("live:join", async (payload = {}, ack) => {
    try {
      const live = await Live.findById(payload.liveId).select("status room").lean();
      if (!live) throw new Error("Live video not found");
      if (live.status !== "live") throw new Error("This live video has ended");
      socket.join(`live:${payload.liveId}`);
      const count = await Live.countDocuments({ _id: payload.liveId, viewers: userId });
      if (!count) {
        await Live.updateOne({ _id: payload.liveId }, { $addToSet: { viewers: userId } });
      }
      const updated = await Live.findById(payload.liveId).select("viewers peakViewers").lean();
      const viewers = (updated?.viewers || []).length;
      if (viewers > (updated?.peakViewers || 0)) {
        await Live.updateOne({ _id: payload.liveId }, { $set: { peakViewers: viewers } });
      }
      io.to(`live:${payload.liveId}`).emit("live:viewers", { liveId: String(payload.liveId), viewers });
      if (typeof ack === "function") ack({ ok: true, viewers });
    } catch (err) {
      ackError(ack, err);
    }
  });

  socket.on("live:leave", async (payload = {}, ack) => {
    try {
      socket.leave(`live:${payload.liveId}`);
      const result = await liveService.leave(payload.liveId, { _id: userId });
      if (typeof ack === "function") ack({ ok: true, ...result });
    } catch (err) {
      ackError(ack, err);
    }
  });

  socket.on("live:comment", async (payload = {}, ack) => {
    try {
      const comment = await liveService.comment(payload.liveId, { _id: userId, name: socket.user.name }, payload.text);
      if (typeof ack === "function") ack({ ok: true, comment });
    } catch (err) {
      logger.warn("live:comment", err.message);
      ackError(ack, err);
    }
  });

  socket.on("live:reaction", async (payload = {}, ack) => {
    try {
      const result = await liveService.reaction(payload.liveId, { _id: userId, name: socket.user.name }, payload.emoji);
      if (typeof ack === "function") ack({ ok: true, ...result });
    } catch (err) {
      ackError(ack, err);
    }
  });

  socket.on("live:end", async (payload = {}, ack) => {
    try {
      await liveService.end(payload.liveId, { _id: userId }, socket.user.role === "admin", "host_ended");
      if (typeof ack === "function") ack({ ok: true });
    } catch (err) {
      ackError(ack, err);
    }
  });
};
