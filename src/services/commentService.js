"use strict";

const Comment = require("../models/Comment");
const Post = require("../models/Post");
const Blog = require("../models/Blog");
const User = require("../models/User");
const ApiError = require("../utils/ApiError");
const serialize = require("../utils/serialize");
const emitter = require("../sockets/emitter");
const notificationService = require("./notificationService");

async function resolveTarget(targetType, targetId) {
  if (targetType === "post") {
    const post = await Post.findById(targetId).lean();
    if (!post) throw ApiError.notFound("Post not found", "POST_NOT_FOUND");
    return { type: "post", doc: post, ownerId: post.author };
  }
  if (targetType === "blog") {
    const blog = await Blog.findById(targetId).lean();
    if (!blog) throw ApiError.notFound("Blog not found", "BLOG_NOT_FOUND");
    return { type: "blog", doc: blog, ownerId: blog.author || null };
  }
  throw ApiError.badRequest("Invalid comment target");
}

async function create({ targetType, targetId, user, text, parent = null }) {
  const target = await resolveTarget(targetType, targetId);
  if (target.type === "post" && target.doc.commentsDisabled) {
    throw ApiError.forbidden("Comments are disabled on this post");
  }
  if (parent) {
    const exists = await Comment.findOne({ _id: parent, targetType, targetId }).lean();
    if (!exists) throw ApiError.badRequest("The comment you replied to was removed");
  }

  const doc = await Comment.create({
    targetType,
    targetId,
    user: user._id,
    authorName: user.name,
    text,
    parent,
  });

  let commentsCount;
  if (targetType === "post") {
    const post = await Post.findByIdAndUpdate(targetId, { $inc: { commentsCount: 1 } }, { new: true }).lean();
    commentsCount = post?.commentsCount || 0;
    emitter.emitAll("post:comment", {
      postId: String(targetId),
      comment: serialize.comment(doc, null),
      commentsCount,
    });
  } else {
    commentsCount = await Comment.countDocuments({ targetType: "blog", targetId });
    emitter.emitAll("blog:comment", {
      blogId: String(targetId),
      comment: serialize.comment(doc, null),
      commentsCount,
    });
  }

  const ownerId = target.ownerId;
  if (ownerId && String(ownerId) !== String(user._id)) {
    notificationService
      .notify({
        userId: ownerId,
        actor: user._id,
        type: "comment",
        text: `${user.name} commented on your ${targetType === "post" ? "post" : "blog"}: “${text.slice(0, 80)}”`,
        ref: String(targetId),
        refType: targetType,
      })
      .catch(() => {});
  } else if (targetType === "blog" && !ownerId) {
    const admins = await User.find({ role: "admin", active: true }).select("_id").lean();
    notificationService
      .notifyMany({
        userIds: admins.map((a) => a._id),
        actor: user._id,
        type: "comment",
        text: `${user.name} commented on a blog: “${text.slice(0, 80)}”`,
        ref: String(targetId),
        refType: "blog",
      })
      .catch(() => {});
  }

  return serialize.comment({ ...doc.toObject(), user }, user._id);
}

async function list(targetType, targetId, { limit = 100 } = {}) {
  const docs = await Comment.find({ targetType, targetId })
    .sort({ createdAt: 1 })
    .limit(Math.min(Number(limit) || 100, 300))
    .populate("user", "name photo")
    .lean();
  return docs.map((d) => serialize.comment(d, null));
}

async function remove(commentId, user, isAdmin = false) {
  const comment = await Comment.findById(commentId).lean();
  if (!comment) throw ApiError.notFound("Comment not found");
  const owner = String(comment.user) === String(user._id);
  if (!owner && !isAdmin) throw ApiError.forbidden("You can only delete your own comments");

  await Comment.deleteOne({ _id: commentId });
  await Comment.deleteMany({ parent: commentId });

  let commentsCount = 0;
  if (comment.targetType === "post") {
    const post = await Post.findByIdAndUpdate(comment.targetId, { $inc: { commentsCount: -1 } }, { new: true }).lean();
    commentsCount = Math.max(0, post?.commentsCount || 0);
    emitter.emitAll("post:comment:deleted", {
      postId: String(comment.targetId),
      commentId: String(commentId),
      commentsCount,
    });
  } else {
    commentsCount = await Comment.countDocuments({ targetType: "blog", targetId: comment.targetId });
    emitter.emitAll("blog:comment:deleted", {
      blogId: String(comment.targetId),
      commentId: String(commentId),
      commentsCount,
    });
  }
  return { id: String(commentId), commentsCount };
}

async function countsByBlog(blogIds = []) {
  const rows = await Comment.aggregate([
    { $match: { targetType: "blog", targetId: { $in: blogIds } } },
    { $group: { _id: "$targetId", count: { $sum: 1 } } },
  ]);
  const map = {};
  rows.forEach((r) => (map[String(r._id)] = r.count));
  return map;
}

module.exports = { create, list, remove, countsByBlog, resolveTarget };
