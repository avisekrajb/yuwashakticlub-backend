"use strict";

const Story = require("../models/Story");
const User = require("../models/User");
const ApiError = require("../utils/ApiError");
const serialize = require("../utils/serialize");
const emitter = require("../sockets/emitter");
const notificationService = require("./notificationService");
const uploadService = require("./uploadService");
const { LIMITS } = require("../config/constants");

async function create({ user, kind, url, publicId = "", poster = "", caption = "", duration = 0, sound = null }) {
  if (!["photo", "video", "audio"].includes(kind)) throw ApiError.badRequest("Story must be a photo, video or sound");
  if (!/^https?:\/\//i.test(String(url || ""))) throw ApiError.badRequest("Invalid story media");
  if (kind !== "photo" && Number(duration) > LIMITS.storySeconds + 1) {
    throw ApiError.badRequest(`Stories can be at most ${LIMITS.storySeconds} seconds`);
  }
  let cleanSound = null;
  if (sound && sound.url) {
    if (Number(sound.duration) > LIMITS.storySeconds + 1) {
      throw ApiError.badRequest(`Story sounds can be at most ${LIMITS.storySeconds} seconds`);
    }
    cleanSound = {
      name: String(sound.name || "").slice(0, 100),
      url: String(sound.url),
      publicId: String(sound.publicId || ""),
      duration: Number(sound.duration) || 0,
    };
  }

  const doc = await Story.create({
    author: user._id,
    kind,
    url,
    publicId,
    poster,
    caption: String(caption || "").slice(0, 300),
    duration: Math.min(Number(duration) || 0, LIMITS.storySeconds),
    sound: cleanSound,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  });

  const populated = await Story.findById(doc._id).populate("author", "name photo role email bio active").lean();
  const payload = serialize.story(populated, user._id);
  emitter.emitAll("story:new", { story: payload });

  notificationService
    .notifyAll({
      actor: user._id,
      type: "story",
      text: `${user.name} added a new story`,
      ref: String(doc._id),
      refType: "story",
    })
    .catch(() => {});

  return payload;
}

async function listActive(viewerId) {
  const docs = await Story.find({ expiresAt: { $gt: new Date() } })
    .sort({ createdAt: -1 })
    .limit(200)
    .populate("author", "name photo role email bio active")
    .lean();
  return docs.map((d) => serialize.story(d, viewerId));
}

async function view(storyId, userId) {
  const story = await Story.findByIdAndUpdate(
    storyId,
    { $addToSet: { viewers: userId } },
    { new: true }
  ).lean();
  if (!story) throw ApiError.notFound("Story no longer exists");
  emitter.emitAll("story:view", {
    storyId: String(storyId),
    views: (story.viewers || []).length,
    userId: String(userId),
  });
  return { views: (story.viewers || []).length };
}

async function remove(storyId, user, isAdmin = false) {
  const story = await Story.findById(storyId);
  if (!story) throw ApiError.notFound("Story not found");
  if (String(story.author) !== String(user._id) && !isAdmin) throw ApiError.forbidden("Not your story");
  await story.deleteOne();
  const assets = [{ publicId: story.publicId, type: story.kind }];
  if (story.sound && story.sound.publicId) assets.push({ publicId: story.sound.publicId, type: "audio" });
  uploadService.deleteMany(assets).catch(() => {});
  emitter.emitAll("story:deleted", { storyId: String(story._id) });
  return true;
}

module.exports = { create, listActive, view, remove };
