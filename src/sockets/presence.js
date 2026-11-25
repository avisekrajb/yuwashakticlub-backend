"use strict";

/** In-memory presence map: userId -> Set<socketId>. */
const connections = new Map();

function add(userId, socketId) {
  const id = String(userId);
  if (!connections.has(id)) connections.set(id, new Set());
  connections.get(id).add(socketId);
}

function remove(userId, socketId) {
  const id = String(userId);
  const set = connections.get(id);
  if (!set) return false;
  set.delete(socketId);
  if (!set.size) {
    connections.delete(id);
    return true; // user went fully offline
  }
  return false;
}

function removeSocket(socketId) {
  for (const [userId, set] of connections.entries()) {
    if (set.delete(socketId) && set.size === 0) {
      connections.delete(userId);
      return userId;
    }
  }
  return null;
}

const isOnline = (userId) => connections.has(String(userId));

const onlineIds = () => Array.from(connections.keys());

const socketsOf = (userId) => Array.from(connections.get(String(userId)) || []);

const count = () => connections.size;

module.exports = { add, remove, removeSocket, isOnline, onlineIds, socketsOf, count };
