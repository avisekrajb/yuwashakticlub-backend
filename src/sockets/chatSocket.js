"use strict";

const Conversation = require("../models/Conversation");
const messageService = require("../services/messageService");
const messageValidator = require("../validators/messageValidator");
const logger = require("../utils/logger");

const ackError = (ack, err) => {
  if (typeof ack === "function") ack({ ok: false, error: err.message || "Something went wrong" });
};

async function isMember(conversationId, userId) {
  const conv = await Conversation.findById(conversationId).select("members").lean();
  return Boolean(conv && (conv.members || []).some((m) => String(m) === String(userId)));
}

module.exports = function registerChat(io, socket) {
  const userId = socket.userId;

  socket.on("chat:join", async (payload = {}, ack) => {
    try {
      if (!(await isMember(payload.conversationId, userId))) throw new Error("Not a member of this conversation");
      socket.join(`conv:${payload.conversationId}`);
      await messageService.markDelivered(payload.conversationId, userId);
      if (typeof ack === "function") ack({ ok: true });
    } catch (err) {
      ackError(ack, err);
    }
  });

  socket.on("chat:leave", (payload = {}) => {
    if (payload.conversationId) socket.leave(`conv:${payload.conversationId}`);
  });

  socket.on("chat:send", async (payload = {}, ack) => {
    try {
      const { value, error } = messageValidator.send(payload);
      if (error) throw new Error(error);
      if (!(await isMember(payload.conversationId, userId))) throw new Error("Not a member of this conversation");

      const message = await messageService.sendMessage({
        conversationId: payload.conversationId,
        senderId: userId,
        text: value.text,
        attachments: value.attachments,
        replyTo: value.replyTo,
        clientId: value.clientId,
      });
      socket.join(`conv:${payload.conversationId}`);
      if (typeof ack === "function") ack({ ok: true, message });
    } catch (err) {
      logger.warn("chat:send", err.message);
      ackError(ack, err);
    }
  });

  socket.on("chat:typing", async (payload = {}) => {
    try {
      const conversationId = payload.conversationId;
      if (!conversationId) return;
      socket.to(`conv:${conversationId}`).emit("chat:typing", {
        conversationId: String(conversationId),
        user: { id: userId, name: socket.user.name },
        typing: Boolean(payload.typing),
        at: Date.now(),
      });
    } catch (_err) {
      /* ignore typing errors */
    }
  });

  socket.on("chat:read", async (payload = {}, ack) => {
    try {
      await messageService.markRead(payload.conversationId, userId);
      if (typeof ack === "function") ack({ ok: true });
    } catch (err) {
      ackError(ack, err);
    }
  });

  socket.on("chat:delivered", async (payload = {}, ack) => {
    try {
      await messageService.markDelivered(payload.conversationId, userId);
      if (typeof ack === "function") ack({ ok: true });
    } catch (err) {
      ackError(ack, err);
    }
  });

  socket.on("chat:react", async (payload = {}, ack) => {
    try {
      const result = await messageService.toggleReaction(payload.messageId, userId, payload.emoji || "❤️");
      if (typeof ack === "function") ack({ ok: true, ...result });
    } catch (err) {
      ackError(ack, err);
    }
  });

  socket.on("chat:edit", async (payload = {}, ack) => {
    try {
      const { value, error } = messageValidator.edit(payload);
      if (error) throw new Error(error);
      const result = await messageService.editMessage(payload.messageId, userId, value.text);
      if (typeof ack === "function") ack({ ok: true, ...result });
    } catch (err) {
      ackError(ack, err);
    }
  });

  socket.on("chat:delete", async (payload = {}, ack) => {
    try {
      const result = await messageService.deleteMessage(
        payload.messageId,
        userId,
        Boolean(payload.forEveryone),
        socket.user.role === "admin"
      );
      if (typeof ack === "function") ack({ ok: true, ...result });
    } catch (err) {
      ackError(ack, err);
    }
  });

  socket.on("chat:open", async (payload = {}, ack) => {
    try {
      if (!(await isMember(payload.conversationId, userId))) throw new Error("Not a member");
      socket.join(`conv:${payload.conversationId}`);
      await messageService.markRead(payload.conversationId, userId);
      if (typeof ack === "function") ack({ ok: true });
    } catch (err) {
      ackError(ack, err);
    }
  });

  socket.on("chat:call", (payload = {}, ack) => {
    if (typeof ack === "function") ack({ ok: false, error: "Use call:start" });
  });
};
