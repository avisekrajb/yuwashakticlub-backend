"use strict";

const Blog = require("../models/Blog");
const Comment = require("../models/Comment");
const ApiError = require("../utils/ApiError");
const serialize = require("../utils/serialize");
const emitter = require("../sockets/emitter");
const notificationService = require("./notificationService");
const slugify = require("../utils/slugify");

async function list({ limit = 100 } = {}) {
  const docs = await Blog.find({}).sort({ createdAt: -1 }).limit(Math.min(Number(limit) || 100, 200)).lean();
  return docs.map((d) => serialize.content("blogs", d));
}

async function get(blogId) {
  const doc = await Blog.findById(blogId).lean();
  if (!doc) throw ApiError.notFound("Blog not found");
  return serialize.content("blogs", doc);
}

async function create(data, user) {
  const doc = await Blog.create({
    title: data.title,
    text: data.text,
    tag: data.tag,
    date: data.date,
    photos: data.photos || [],
    slug: slugify(data.title),
    author: user ? user._id : null,
  });
  const payload = serialize.content("blogs", doc);
  emitter.emitAll("blog:new", { blog: payload });
  notificationService
    .notifyAll({
      actor: user ? user._id : null,
      type: "post",
      text: `New blog: ${payload.title}`,
      ref: String(doc._id),
      refType: "blog",
    })
    .catch(() => {});
  return payload;
}

async function update(blogId, data) {
  const doc = await Blog.findByIdAndUpdate(
    blogId,
    {
      $set: {
        ...(data.title !== undefined ? { title: String(data.title), slug: slugify(data.title) } : {}),
        ...(data.text !== undefined ? { text: String(data.text) } : {}),
        ...(data.tag !== undefined ? { tag: String(data.tag) } : {}),
        ...(data.date !== undefined ? { date: String(data.date).slice(0, 10) } : {}),
        ...(data.photos !== undefined ? { photos: data.photos } : {}),
      },
    },
    { new: true, runValidators: true }
  ).lean();
  if (!doc) throw ApiError.notFound("Blog not found");
  const payload = serialize.content("blogs", doc);
  emitter.emitAll("blog:updated", { blog: payload });
  return payload;
}

async function remove(blogId) {
  const doc = await Blog.findByIdAndDelete(blogId).lean();
  if (!doc) throw ApiError.notFound("Blog not found");
  await Comment.deleteMany({ targetType: "blog", targetId: blogId });
  emitter.emitAll("blog:deleted", { blogId: String(blogId) });
  return true;
}

module.exports = { list, get, create, update, remove };
