"use strict";

const presence = require("./presence");

let io = null;

function setIO(instance) {
  io = instance;
}

function getIO() {
  return io;
}

function emitToUser(userId, event, payload) {
  if (!io || !userId) return;
  io.to(`user:${String(userId)}`).emit(event, payload);
}

function emitToUsers(userIds, event, payload) {
  (userIds || []).forEach((id) => emitToUser(id, event, payload));
}

function emitToRoom(room, event, payload) {
  if (!io) return;
  io.to(room).emit(event, payload);
}

/**
 * Emit to the conversation room and every member's personal room.
 * Socket.IO deduplicates sockets that are in multiple target rooms.
 */
function emitToConversation(conversationId, memberIds, event, payload) {
  if (!io) return;
  let target = io.to(`conv:${String(conversationId)}`);
  (memberIds || []).forEach((id) => {
    target = target.to(`user:${String(id)}`);
  });
  target.emit(event, payload);
}

function emitAll(event, payload) {
  if (!io) return;
  io.emit(event, payload);
}

function broadcastPresence(userId, online) {
  emitAll("presence:update", { userId: String(userId), online, at: Date.now() });
  emitAll("presence:list", { users: presence.onlineIds() });
}

module.exports = {
  setIO,
  getIO,
  emitToUser,
  emitToUsers,
  emitToRoom,
  emitToConversation,
  emitAll,
  broadcastPresence,
};
