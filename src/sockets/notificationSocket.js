"use strict";

const notificationService = require("../services/notificationService");

module.exports = function registerNotifications(_io, socket) {
  const userId = socket.userId;

  socket.on("notifications:read", async (payload = {}, ack) => {
    try {
      if (payload.id) await notificationService.markRead(userId, payload.id);
      else await notificationService.markAllRead(userId);
      if (typeof ack === "function") ack({ ok: true });
    } catch (err) {
      if (typeof ack === "function") ack({ ok: false, error: err.message });
    }
  });

  socket.on("notifications:clear", async (_payload, ack) => {
    try {
      const deleted = await notificationService.clear(userId);
      if (typeof ack === "function") ack({ ok: true, deleted });
    } catch (err) {
      if (typeof ack === "function") ack({ ok: false, error: err.message });
    }
  });
};
