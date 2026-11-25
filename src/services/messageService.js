"use strict";

const mongoose = require("mongoose");
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const User = require("../models/User");
const ApiError = require("../utils/ApiError");
const serialize = require("../utils/serialize");
const emitter = require("../sockets/emitter");
const presence = require("../sockets/presence");
const notificationService = require("./notificationService");
const uploadService = require("./uploadService");

const directKey = (a, b) => [String(a), String(b)].sort().join("_");

function assertMember(conv, userId) {
  if (!conv) throw ApiError.notFound("Conversation not found", "CONVERSATION_NOT_FOUND");
  const ok = (conv.members || []).some((m) => String(m) === String(userId));
  if (!ok) throw ApiError.forbidden("You are not part of this conversation", "NOT_MEMBER");
  return true;
}

async function getOrCreateDirect(userId, otherId) {
  if (String(userId) === String(otherId)) throw ApiError.badRequest("You cannot message yourself");
  const other = await User.findById(otherId);
  if (!other || !other.active) throw ApiError.notFound("Member not found");

  const key = directKey(userId, otherId);
  let conv = await Conversation.findOne({ key });
  if (!conv) {
    conv = await Conversation.create({
      key,
      type: "direct",
      name: "",
      members: [userId, otherId],
      createdBy: userId,
      lastAt: new Date(),
    });
  }
  return conv;
}

async function listConversations(userId) {
  const convs = await Conversation.find({ members: userId })
    .sort({ lastAt: -1, updatedAt: -1 })
    .limit(200)
    .lean();

  const results = await Promise.all(
    convs.map(async (conv) => {
      const unread = await Message.countDocuments({
        conversation: conv._id,
        sender: { $ne: userId },
        deletedForEveryone: { $ne: true },
        deletedFor: { $ne: userId },
        readBy: { $ne: userId },
      });
      const last = await Message.findOne({
        conversation: conv._id,
        deletedForEveryone: { $ne: true },
        deletedFor: { $ne: userId },
      })
        .sort({ createdAt: -1 })
        .populate("sender", "name photo")
        .lean();
      return serialize.conversation(
        { ...conv, unread, lastMessage: last ? serialize.message(last, userId) : conv.lastMessage },
        userId
      );
    })
  );
  return results;
}

async function getMessages(conversationId, userId, { before, limit = 40, search } = {}) {
  const conv = await Conversation.findById(conversationId);
  assertMember(conv, userId);

  const query = {
    conversation: conv._id,
    deletedForEveryone: { $ne: true },
    deletedFor: { $ne: userId },
  };
  if (before) query.createdAt = { $lt: new Date(before) };
  if (search) {
    const safe = String(search).slice(0, 80).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    query.text = new RegExp(safe, "i");
  }

  const take = Math.min(Number(limit) || 40, 100);
  const docs = await Message.find(query)
    .sort({ createdAt: -1 })
    .limit(take + 1)
    .populate("sender", "name photo")
    .populate({ path: "replyTo", select: "text sender" })
    .lean();

  const hasMore = docs.length > take;
  const page = docs.slice(0, take).reverse();
  return { conversation: serialize.conversation(conv, userId), messages: page.map((m) => serialize.message(m, userId)), hasMore };
}

async function sendMessage({ conversationId, senderId, text = "", attachments = [], replyTo = null, clientId = null }) {
  const conv = await Conversation.findById(conversationId);
  assertMember(conv, senderId);

  if (replyTo) {
    const parent = await Message.findOne({ _id: replyTo, conversation: conv._id }).lean();
    if (!parent) throw ApiError.badRequest("The replied message no longer exists");
  }

  const online = presence.onlineIds().filter((id) => (conv.members || []).some((m) => String(m) === id));

  const message = await Message.create({
    conversation: conv._id,
    sender: senderId,
    text,
    attachments,
    replyTo: replyTo || null,
    clientId,
    readBy: [senderId],
    deliveredTo: [...new Set([String(senderId), ...online])],
  });

  const preview = text || (attachments.length ? `📎 ${attachments[0].type}` : "Message");
  conv.lastMessage = { text: preview.slice(0, 160), sender: senderId, at: message.createdAt };
  conv.lastAt = message.createdAt;
  await conv.save();

  const populated = await Message.findById(message._id)
    .populate("sender", "name photo")
    .populate({ path: "replyTo", select: "text sender" })
    .lean();

  const payload = serialize.message(populated, senderId);
  emitter.emitToConversation(conv._id, conv.members, "chat:message", {
    conversationId: String(conv._id),
    key: conv.key,
    message: payload,
  });
  emitter.emitToConversation(conv._id, conv.members, "conversation:update", {
    conversationId: String(conv._id),
    key: conv.key,
    lastMessage: { text: preview.slice(0, 160), sender: senderId, at: message.createdAt },
  });

  // Notifications: direct messages always; groups only mention-like notifications are skipped.
  if (conv.type === "direct") {
    const other = conv.members.find((m) => String(m) !== String(senderId));
    if (other) {
      const sender = await User.findById(senderId).select("name").lean();
      notificationService
        .notify({
          userId: other,
          actor: senderId,
          type: "message",
          text: `💬 ${sender?.name || "Someone"}: ${preview.slice(0, 100)}`,
          ref: String(conv._id),
          refType: "conversation",
        })
        .catch(() => {});
    }
  }

  return serialize.message(populated, senderId);
}

async function markRead(conversationId, userId) {
  const conv = await Conversation.findById(conversationId).lean();
  assertMember(conv, userId);
  const now = new Date();
  await Message.updateMany(
    { conversation: conversationId, sender: { $ne: userId }, readBy: { $ne: userId } },
    { $addToSet: { readBy: userId, deliveredTo: userId }, $set: { readAt: now } }
  );
  emitter.emitToConversation(conversationId, conv.members, "chat:read", {
    conversationId: String(conversationId),
    userId: String(userId),
    at: now.getTime(),
  });
  return true;
}

async function markDelivered(conversationId, userId) {
  await Message.updateMany(
    { conversation: conversationId, sender: { $ne: userId }, deliveredTo: { $ne: userId } },
    { $addToSet: { deliveredTo: userId } }
  );
  return true;
}

async function toggleReaction(messageId, userId, emoji = "❤️") {
  const message = await Message.findById(messageId);
  if (!message) throw ApiError.notFound("Message not found");
  const conv = await Conversation.findById(message.conversation).lean();
  assertMember(conv, userId);

  const existing = message.reactions.find((r) => String(r.user) === String(userId));
  if (existing && existing.emoji === emoji) {
    message.reactions = message.reactions.filter((r) => String(r.user) !== String(userId));
  } else if (existing) {
    existing.emoji = emoji;
  } else {
    message.reactions.push({ user: userId, emoji });
  }
  await message.save();

  const payload = { messageId: String(message._id), conversationId: String(conv._id), reactions: message.reactions.map((r) => ({ user: String(r.user), emoji: r.emoji })) };
  emitter.emitToConversation(conv._id, conv.members, "chat:reaction", payload);
  return payload;
}

async function editMessage(messageId, userId, text) {
  const message = await Message.findById(messageId);
  if (!message) throw ApiError.notFound("Message not found");
  if (String(message.sender) !== String(userId)) throw ApiError.forbidden("You can only edit your own messages");
  if (message.deletedForEveryone) throw ApiError.badRequest("Deleted messages cannot be edited");
  message.text = text;
  message.editedAt = new Date();
  await message.save();

  const conv = await Conversation.findById(message.conversation).lean();
  const payload = { messageId: String(message._id), conversationId: String(conv._id), text, editedAt: message.editedAt.getTime() };
  emitter.emitToConversation(conv._id, conv.members, "chat:edited", payload);
  return payload;
}

async function deleteMessage(messageId, userId, forEveryone = false, isAdmin = false) {
  const message = await Message.findById(messageId);
  if (!message) throw ApiError.notFound("Message not found");
  const conv = await Conversation.findById(message.conversation).lean();
  assertMember(conv, userId);

  const isOwner = String(message.sender) === String(userId);
  if (!isOwner && !isAdmin) throw ApiError.forbidden("You can only delete your own messages");

  if (forEveryone && (isOwner || isAdmin)) {
    if (!message.deletedForEveryone) {
      const assets = (message.attachments || []).map((a) => ({ publicId: a.publicId, type: a.type }));
      message.deletedForEveryone = true;
      message.text = "";
      message.attachments = [];
      await message.save();
      uploadService.deleteMany(assets).catch(() => {});
    }
    emitter.emitToConversation(conv._id, conv.members, "chat:deleted", {
      messageId: String(message._id),
      conversationId: String(conv._id),
      forEveryone: true,
    });
    return { forEveryone: true };
  }

  await Message.updateOne({ _id: messageId }, { $addToSet: { deletedFor: userId } });
  emitter.emitToUser(userId, "chat:hidden", { messageId: String(messageId), conversationId: String(conv._id) });
  return { forEveryone: false };
}

async function deleteConversation(conversationId, userId, isAdmin = false) {
  const conv = await Conversation.findById(conversationId);
  if (!conv) throw ApiError.notFound("Conversation not found");
  const isGroupAdmin = (conv.admins || []).some((a) => String(a) === String(userId));
  if (conv.type === "group" && !isGroupAdmin && !isAdmin) {
    throw ApiError.forbidden("Only group admins can delete this group");
  }
  assertMember(conv, userId);
  const messages = await Message.find({ conversation: conv._id }).lean();
  const assets = [];
  messages.forEach((m) => (m.attachments || []).forEach((a) => assets.push(a)));
  await Message.deleteMany({ conversation: conv._id });
  await conv.deleteOne();
  uploadService.deleteMany(assets).catch(() => {});
  emitter.emitToUsers(conv.members, "conversation:deleted", { conversationId: String(conv._id) });
  return true;
}

async function ensureMembers() {
  // Kept for completeness: groups are seeded, direct chats are created on demand.
  return true;
}

async function totalUnread(userId) {
  const convs = await Conversation.find({ members: userId }).select("_id").lean();
  if (!convs.length) return 0;
  return Message.countDocuments({
    conversation: { $in: convs.map((c) => c._id) },
    sender: { $ne: userId },
    readBy: { $ne: userId },
    deletedForEveryone: { $ne: true },
    deletedFor: { $ne: userId },
  });
}

module.exports = {
  directKey,
  getOrCreateDirect,
  listConversations,
  getMessages,
  sendMessage,
  markRead,
  markDelivered,
  toggleReaction,
  editMessage,
  deleteMessage,
  deleteConversation,
  totalUnread,
  ensureMembers,
};
