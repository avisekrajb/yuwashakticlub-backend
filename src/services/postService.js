"use strict";

const Post = require("../models/Post");
const Comment = require("../models/Comment");
const User = require("../models/User");
const ApiError = require("../utils/ApiError");
const serialize = require("../utils/serialize");
const emitter = require("../sockets/emitter");
const notificationService = require("./notificationService");
const uploadService = require("./uploadService");
const { REACTIONS, LIMITS } = require("../config/constants");

const MAX_MEDIA = LIMITS.maxPostMedia;

function normalizeMedia(input) {
  if (!Array.isArray(input)) return [];
  return input.slice(0, MAX_MEDIA).map((m) => {
    const url = String(m.url || "").trim();
    if (!/^https?:\/\//i.test(url)) throw ApiError.badRequest("Invalid media URL");
    const type = ["image", "video", "audio", "file"].includes(m.type) ? m.type : "image";
    const duration = Number(m.duration) || 0;
    if (type === "video" && duration > LIMITS.postVideoSeconds + 2) {
      throw ApiError.badRequest(`Videos can be at most ${Math.floor(LIMITS.postVideoSeconds / 60)} minutes long`);
    }
    return {
      url,
      publicId: String(m.publicId || ""),
      type,
      poster: String(m.poster || ""),
      name: String(m.name || "").slice(0, 200),
      size: Number(m.size) || 0,
      duration,
      width: Number(m.width) || 0,
      height: Number(m.height) || 0,
    };
  });
}

async function create({ user, text = "", media = [], category = "General" }) {
  const cleanText = String(text || "").trim();
  if (!cleanText && !(media || []).length) throw ApiError.badRequest("Write something or attach a photo/video");
  if (cleanText.length > LIMITS.maxPostLength) throw ApiError.badRequest("Post is too long");

  const doc = await Post.create({
    author: user._id,
    text: cleanText,
    media: normalizeMedia(media),
    category: String(category || "General").slice(0, 40),
  });

  const populated = await Post.findById(doc._id).populate("author", "name photo role email bio active").lean();
  const payload = serialize.post(populated, user._id);
  emitter.emitAll("post:new", { post: payload });

  notificationService
    .notifyAll({
      actor: user._id,
      type: "post",
      text: `${user.name} shared a new post${cleanText ? `: “${cleanText.slice(0, 70)}”` : ""}`,
      ref: String(doc._id),
      refType: "post",
    })
    .catch(() => {});

  return payload;
}

async function feed({ cursor, limit = 20, authorId, viewerId } = {}) {
  const query = {};
  if (cursor) query.createdAt = { $lt: new Date(cursor) };
  if (authorId) query.author = authorId;
  const take = Math.min(Number(limit) || 20, 50);
  const docs = await Post.find(query)
    .sort({ createdAt: -1 })
    .limit(take + 1)
    .populate("author", "name photo role email bio active")
    .lean();
  const hasMore = docs.length > take;
  const page = docs.slice(0, take);
  return {
    posts: page.map((p) => serialize.post(p, viewerId)),
    nextCursor: hasMore ? page[page.length - 1].createdAt.toISOString() : null,
    hasMore,
  };
}

async function get(postId, viewerId) {
  const doc = await Post.findById(postId).populate("author", "name photo role email bio active").lean();
  if (!doc) throw ApiError.notFound("Post not found", "POST_NOT_FOUND");
  return serialize.post(doc, viewerId);
}

async function react(postId, userId, type = "like") {
  if (!REACTIONS.includes(type)) throw ApiError.badRequest("Invalid reaction");
  const post = await Post.findById(postId);
  if (!post) throw ApiError.notFound("Post not found");

  const existing = post.reactions.find((r) => String(r.user) === String(userId));
  let action;
  if (existing && existing.type === type) {
    post.reactions = post.reactions.filter((r) => String(r.user) !== String(userId));
    action = "removed";
  } else if (existing) {
    existing.type = type;
    action = "changed";
  } else {
    post.reactions.push({ user: userId, type });
    action = "added";
  }
  await post.save();

  const populated = await Post.findById(post._id).populate("author", "name photo role email bio active").lean();
  const payload = serialize.post(populated, userId);
  emitter.emitAll("post:updated", { post: { ...payload, mineFor: null } });

  if (action !== "removed" && String(post.author) !== String(userId)) {
    const user = await User.findById(userId).select("name").lean();
    notificationService
      .notify({
        userId: post.author,
        actor: userId,
        type: "reaction",
        text: `${user?.name || "Someone"} reacted ${type} to your post`,
        ref: String(post._id),
        refType: "post",
      })
      .catch(() => {});
  }
  return payload;
}

async function share(postId, userId) {
  const post = await Post.findById(postId);
  if (!post) throw ApiError.notFound("Post not found");
  const already = post.shares.some((s) => String(s.user) === String(userId));
  if (!already) {
    post.shares.push({ user: userId });
    await post.save();
    if (String(post.author) !== String(userId)) {
      const user = await User.findById(userId).select("name").lean();
      notificationService
        .notify({
          userId: post.author,
          actor: userId,
          type: "share",
          text: `${user?.name || "Someone"} shared your post`,
          ref: String(post._id),
          refType: "post",
        })
        .catch(() => {});
    }
  }
  const populated = await Post.findById(post._id).populate("author", "name photo role email bio active").lean();
  const payload = serialize.post(populated, userId);
  emitter.emitAll("post:updated", { post: payload });
  return { post: payload, already, count: payload.sharesCount };
}

async function view(postId) {
  await Post.updateOne({ _id: postId }, { $inc: { views: 1 } });
  return true;
}

async function remove(postId, user, isAdmin = false) {
  const post = await Post.findById(postId);
  if (!post) throw ApiError.notFound("Post not found");
  if (String(post.author) !== String(user._id) && !isAdmin) {
    throw ApiError.forbidden("You can only delete your own posts");
  }
  await Comment.deleteMany({ targetType: "post", targetId: post._id });
  await post.deleteOne();
  uploadService.deleteMany((post.media || []).map((m) => ({ publicId: m.publicId, type: m.type }))).catch(() => {});
  emitter.emitAll("post:deleted", { postId: String(post._id) });
  return true;
}

async function update(postId, user, { text, category }, isAdmin = false) {
  const post = await Post.findById(postId);
  if (!post) throw ApiError.notFound("Post not found");
  if (String(post.author) !== String(user._id) && !isAdmin) throw ApiError.forbidden("Not your post");
  if (text !== undefined) post.text = String(text).slice(0, LIMITS.maxPostLength);
  if (category !== undefined) post.category = String(category).slice(0, 40);
  await post.save();
  const populated = await Post.findById(post._id).populate("author", "name photo role email bio active").lean();
  const payload = serialize.post(populated, user._id);
  emitter.emitAll("post:updated", { post: payload });
  return payload;
}

module.exports = { create, feed, get, react, share, view, remove, update };
