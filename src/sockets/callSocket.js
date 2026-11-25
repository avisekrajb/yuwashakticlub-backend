"use strict";

const callService = require("../services/callService");
const logger = require("../utils/logger");

const ackError = (ack, err) => {
  if (typeof ack === "function") ack({ ok: false, error: err.message || "Call failed" });
};

module.exports = function registerCall(io, socket) {
  const userId = socket.userId;

  socket.on("call:start", async (payload = {}, ack) => {
    try {
      const call = await callService.start({
        caller: { _id: userId, name: socket.user.name },
        toUserId: payload.toUserId,
        conversationId: payload.conversationId,
        kind: payload.kind || "audio",
      });
      if (typeof ack === "function") ack({ ok: true, call });
    } catch (err) {
      logger.warn("call:start", err.message);
      ackError(ack, err);
    }
  });

  socket.on("call:accept", async (payload = {}, ack) => {
    try {
      const result = await callService.accept(payload.callId, { _id: userId, name: socket.user.name });
      socket.join(`call:${payload.callId}`);
      socket.join(`user:${userId}`);
      if (typeof ack === "function") ack({ ok: true, ...result });
      io.to(`call:${payload.callId}`).emit("call:participant-joined", {
        callId: String(payload.callId),
        userId,
        name: socket.user.name,
      });
    } catch (err) {
      ackError(ack, err);
    }
  });

  socket.on("call:join", async (payload = {}, ack) => {
    try {
      const result = await callService.join(payload.callId, { _id: userId, name: socket.user.name });
      socket.join(`call:${payload.callId}`);
      if (typeof ack === "function") ack({ ok: true, ...result });
      io.to(`call:${payload.callId}`).emit("call:participant-joined", {
        callId: String(payload.callId),
        userId,
        name: socket.user.name,
      });
    } catch (err) {
      ackError(ack, err);
    }
  });

  socket.on("call:reject", async (payload = {}, ack) => {
    try {
      await callService.reject(payload.callId, { _id: userId, name: socket.user.name });
      if (typeof ack === "function") ack({ ok: true });
    } catch (err) {
      ackError(ack, err);
    }
  });

  socket.on("call:end", async (payload = {}, ack) => {
    try {
      await callService.end(
        payload.callId,
        { _id: userId, name: socket.user.name },
        socket.user.role === "admin",
        payload.reason || "hangup"
      );
      socket.leave(`call:${payload.callId}`);
      if (typeof ack === "function") ack({ ok: true });
    } catch (err) {
      ackError(ack, err);
    }
  });

  socket.on("call:token", async (payload = {}, ack) => {
    try {
      const result = await callService.token(payload.callId, { _id: userId, name: socket.user.name });
      socket.join(`call:${payload.callId}`);
      if (typeof ack === "function") ack({ ok: true, ...result });
    } catch (err) {
      ackError(ack, err);
    }
  });

  socket.on("call:control", async (payload = {}, ack) => {
    try {
      const state = await callService.control(
        payload.callId,
        { _id: userId, name: socket.user.name },
        {
          muted: payload.muted,
          cameraOff: payload.cameraOff,
          speaker: payload.speaker,
          noiseCancellation: payload.noiseCancellation,
        }
      );
      if (typeof ack === "function") ack({ ok: true, state });
    } catch (err) {
      ackError(ack, err);
    }
  });

  socket.on("call:leave", (payload = {}) => {
    if (payload.callId) socket.leave(`call:${payload.callId}`);
  });
};
