"use strict";

const asyncHandler = require("../utils/asyncHandler");
const ApiResponse = require("../utils/ApiResponse");
const messageService = require("../services/messageService");

const conversations = asyncHandler(async (req, res) => {
  const list = await messageService.listConversations(req.user._id);
  return ApiResponse.ok(res, list);
});

const createDirect = asyncHandler(async (req, res) => {
  const conv = await messageService.getOrCreateDirect(req.user._id, req.body.userId);
  return ApiResponse.ok(res, { id: String(conv._id), key: conv.key, type: conv.type, members: conv.members.map(String) });
});

const messages = asyncHandler(async (req, res) => {
  const result = await messageService.getMessages(req.params.id, req.user._id, {
    before: req.query.before,
    limit: req.query.limit,
    search: req.query.q,
  });
  return ApiResponse.ok(res, result);
});

const send = asyncHandler(async (req, res) => {
  const message = await messageService.sendMessage({
    conversationId: req.params.id,
    senderId: req.user._id,
    text: req.body.text,
    attachments: req.body.attachments,
    replyTo: req.body.replyTo,
    clientId: req.body.clientId,
  });
  return ApiResponse.created(res, message, "Message sent");
});

const read = asyncHandler(async (req, res) => {
  await messageService.markRead(req.params.id, req.user._id);
  return ApiResponse.ok(res, { read: true });
});

const delivered = asyncHandler(async (req, res) => {
  await messageService.markDelivered(req.params.id, req.user._id);
  return ApiResponse.ok(res, { delivered: true });
});

const edit = asyncHandler(async (req, res) => {
  const result = await messageService.editMessage(req.params.id, req.user._id, req.body.text);
  return ApiResponse.ok(res, result, "Message edited");
});

const remove = asyncHandler(async (req, res) => {
  const forEveryone = req.query.forEveryone === "true" || req.body.forEveryone === true;
  const result = await messageService.deleteMessage(
    req.params.id,
    req.user._id,
    forEveryone,
    req.user.role === "admin"
  );
  return ApiResponse.ok(res, result, "Message deleted");
});

const react = asyncHandler(async (req, res) => {
  const result = await messageService.toggleReaction(req.params.id, req.user._id, req.body.emoji || "❤️");
  return ApiResponse.ok(res, result);
});

const removeConversation = asyncHandler(async (req, res) => {
  await messageService.deleteConversation(req.params.id, req.user._id, req.user.role === "admin");
  return ApiResponse.ok(res, { deleted: true }, "Conversation deleted");
});

const unreadTotal = asyncHandler(async (req, res) => {
  const count = await messageService.totalUnread(req.user._id);
  return ApiResponse.ok(res, { unread: count });
});

module.exports = {
  conversations,
  createDirect,
  messages,
  send,
  read,
  delivered,
  edit,
  remove,
  react,
  removeConversation,
  unreadTotal,
};
