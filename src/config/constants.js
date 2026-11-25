"use strict";

const env = require("./env");

const REACTIONS = ["like", "love", "haha", "wow", "sad", "angry"];
const MEDIA_TYPES = ["image", "video", "audio", "file"];
const CALL_KINDS = ["audio", "video"];
const CALL_STATUS = ["ringing", "active", "ended", "rejected", "missed", "cancelled"];
const NOTIFICATION_TYPES = [
  "welcome",
  "post",
  "story",
  "live",
  "comment",
  "reaction",
  "share",
  "message",
  "call",
  "system",
];

const FOLDERS = {
  avatar: "shree-yuwa-shakti/avatars",
  post: "shree-yuwa-shakti/posts",
  story: "shree-yuwa-shakti/stories",
  chat: "shree-yuwa-shakti/chat",
  live: "shree-yuwa-shakti/live",
  general: "shree-yuwa-shakti/uploads",
};

module.exports = {
  REACTIONS,
  MEDIA_TYPES,
  CALL_KINDS,
  CALL_STATUS,
  NOTIFICATION_TYPES,
  FOLDERS,
  LIMITS: {
    maxVideoBytes: env.limits.maxVideoBytes,
    maxImageBytes: env.limits.maxImageBytes,
    maxAudioBytes: env.limits.maxAudioBytes,
    postVideoSeconds: env.limits.postVideoSeconds,
    storySeconds: env.limits.storySeconds,
    liveSeconds: env.limits.liveSeconds,
    callRingSeconds: env.limits.callRingSeconds,
    notificationTtlSeconds: env.notificationTtlSeconds,
    maxPostMedia: 10,
    maxMessageLength: 4000,
    maxPostLength: 5000,
    maxStorySeconds: env.limits.storySeconds,
    maxLiveSeconds: env.limits.liveSeconds,
  },
  ROOMS: {
    user: (id) => `user:${id}`,
    conversation: (id) => `conv:${id}`,
    live: (id) => `live:${id}`,
    call: (id) => `call:${id}`,
  },
};
