"use strict";

const { AccessToken, RoomServiceClient } = require("livekit-server-sdk");
const env = require("../config/env");
const logger = require("../utils/logger");

function httpUrl() {
  return String(env.livekit.url || "")
    .replace(/^wss:/i, "https:")
    .replace(/^ws:/i, "http:");
}

let roomClient = null;
function client() {
  if (!roomClient) {
    roomClient = new RoomServiceClient(httpUrl(), env.livekit.apiKey, env.livekit.apiSecret);
  }
  return roomClient;
}

async function createRoom(name, options = {}) {
  try {
    return await client().createRoom({
      name,
      emptyTimeout: options.emptyTimeout || 120,
      maxParticipants: options.maxParticipants || 50,
      metadata: options.metadata || "",
    });
  } catch (err) {
    // "already exists" is harmless
    if (!/already exists/i.test(err.message || "")) logger.warn("LiveKit createRoom:", err.message);
    return null;
  }
}

async function deleteRoom(name) {
  try {
    await client().deleteRoom(name);
  } catch (err) {
    if (!/not found|does not exist/i.test(err.message || "")) {
      logger.warn("LiveKit deleteRoom:", err.message);
    }
  }
}

async function listParticipants(room) {
  try {
    return await client().listParticipants(room);
  } catch (_err) {
    return [];
  }
}

/**
 * Create an access token for a LiveKit room.
 * `ttl` is in seconds; defaults to LIVEKIT_TOKEN_TTL.
 */
async function createToken({ identity, name, room, canPublish = true, canSubscribe = true, metadata, ttl }) {
  if (!env.livekit.apiKey || !env.livekit.apiSecret) {
    throw new Error("LiveKit is not configured");
  }
  const token = new AccessToken(env.livekit.apiKey, env.livekit.apiSecret, {
    identity: String(identity),
    name: name || String(identity),
    ttl: ttl || env.livekit.tokenTtlSeconds,
    metadata: metadata ? JSON.stringify(metadata) : undefined,
  });
  token.addGrant({
    roomJoin: true,
    room,
    canPublish,
    canSubscribe,
    canPublishData: true,
    canUpdateOwnMetadata: true,
  });
  const jwt = await token.toJwt();
  return {
    token: jwt,
    url: env.livekit.url,
    room,
    identity: String(identity),
  };
}

module.exports = {
  createRoom,
  deleteRoom,
  createToken,
  listParticipants,
  httpUrl,
};
