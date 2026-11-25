"use strict";

const { verifyToken } = require("../utils/generateToken");
const User = require("../models/User");
const logger = require("../utils/logger");
const presence = require("./presence");
const emitter = require("./emitter");
const registerChat = require("./chatSocket");
const registerCall = require("./callSocket");
const registerLive = require("./liveSocket");
const registerNotifications = require("./notificationSocket");
const liveService = require("../services/liveService");

function init(io) {
  emitter.setIO(io);

  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.query?.token ||
        (socket.handshake.headers?.authorization || "").replace(/^Bearer\s+/i, "");
      if (!token) return next(new Error("Unauthorized"));
      const payload = verifyToken(token);
      const user = await User.findById(payload.sub).select("name active role").lean();
      if (!user || user.active === false) return next(new Error("Unauthorized"));
      socket.user = { id: String(user._id), name: user.name, role: user.role };
      socket.userId = String(user._id);
      return next();
    } catch (_err) {
      return next(new Error("Unauthorized"));
    }
  });

  io.on("connection", async (socket) => {
    const userId = socket.userId;
    presence.add(userId, socket.id);
    socket.join(`user:${userId}`);
    await User.updateOne({ _id: userId }, { $set: { lastSeen: new Date() } }).catch(() => {});

    emitter.broadcastPresence(userId, true);
    socket.emit("presence:list", { users: presence.onlineIds(), self: userId });

    registerChat(io, socket);
    registerCall(io, socket);
    registerLive(io, socket);
    registerNotifications(io, socket);

    socket.on("presence:get", (ack) => {
      if (typeof ack === "function") ack({ users: presence.onlineIds() });
    });

    socket.on("disconnect", async (reason) => {
      const fullyOffline = presence.remove(userId, socket.id);
      await User.updateOne({ _id: userId }, { $set: { lastSeen: new Date() } }).catch(() => {});
      if (fullyOffline) {
        emitter.broadcastPresence(userId, false);
        liveService.endByHost(userId, "host_disconnected").catch((err) => logger.warn("live disconnect:", err.message));
      }
      logger.debug(`socket ${socket.id} disconnected (${reason})`);
    });

    socket.on("error", (err) => logger.warn("socket error:", err.message));
  });

  logger.info("Socket.IO realtime layer ready");
  return io;
}

module.exports = { init };
