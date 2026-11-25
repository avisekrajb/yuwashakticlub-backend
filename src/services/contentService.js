"use strict";

const mongoose = require("mongoose");
const About = require("../models/About");
const Blog = require("../models/Blog");
const Banner = require("../models/Banner");
const Gallery = require("../models/Gallery");
const TeamMember = require("../models/TeamMember");
const Conversation = require("../models/Conversation");
const Comment = require("../models/Comment");
const Message = require("../models/Message");
const Post = require("../models/Post");
const Story = require("../models/Story");
const Live = require("../models/Live");
const User = require("../models/User");
const ApiError = require("../utils/ApiError");
const serialize = require("../utils/serialize");
const env = require("../config/env");
const { LIMITS } = require("../config/constants");
const notificationService = require("./notificationService");
const emitter = require("../sockets/emitter");

const MODELS = {
  about: About,
  blogs: Blog,
  gallery: Gallery,
  banners: Banner,
  team: TeamMember,
  groups: Conversation,
  comments: Comment,
};

const FIELDS = {
  about: ["emoji", "title", "text", "order"],
  blogs: ["title", "tag", "date", "text", "photos"],
  gallery: ["title", "url", "type", "thumb", "publicId", "slide", "order"],
  banners: ["title", "sub", "url", "order"],
  team: ["name", "role", "url", "order"],
};

const ALLOWED_COLLECTIONS = Object.keys(MODELS);

function cleanContent(name, item) {
  const out = {};
  (FIELDS[name] || []).forEach((key) => {
    if (item[key] !== undefined) out[key] = item[key];
  });
  if (name === "blogs") {
    if (out.photos && !Array.isArray(out.photos)) out.photos = [];
    if (out.photos) out.photos = out.photos.filter((p) => typeof p === "string").slice(0, 12);
  }
  if (name === "gallery" && out.type && !["photo", "video"].includes(out.type)) out.type = "photo";
  return out;
}

async function listCollection(name) {
  if (!ALLOWED_COLLECTIONS.includes(name)) throw ApiError.badRequest("Unknown collection");
  if (name === "groups") {
    const docs = await Conversation.find({ type: "group" }).sort({ createdAt: 1 }).lean();
    return docs.map((d) => serialize.conversation(d, null));
  }
  if (name === "comments") {
    const docs = await Comment.find({ targetType: "blog" }).sort({ createdAt: 1 }).limit(1000).populate("user", "name photo").lean();
    return docs.map((d) => serialize.comment(d, null));
  }
  const docs = await MODELS[name].find({}).sort({ order: 1, createdAt: 1 }).lean();
  return docs.map((d) => serialize.content(name, d));
}

async function createItem(name, item, user) {
  if (!FIELDS[name]) throw ApiError.badRequest("This collection does not support creating items here");
  const data = cleanContent(name, item);
  const count = await MODELS[name].countDocuments();
  data.order = data.order !== undefined ? data.order : count;
  if (name === "blogs") data.author = user ? user._id : null;
  const doc = await MODELS[name].create(data);
  const payload = serialize.content(name, doc);
  emitter.emitAll(`${name}:changed`, { action: "create", item: payload });
  return payload;
}

async function updateItem(name, id, item) {
  if (!FIELDS[name]) throw ApiError.badRequest("This collection does not support editing items here");
  const doc = await MODELS[name].findByIdAndUpdate(id, { $set: cleanContent(name, item) }, { new: true, runValidators: true }).lean();
  if (!doc) throw ApiError.notFound("Item not found");
  const payload = serialize.content(name, doc);
  emitter.emitAll(`${name}:changed`, { action: "update", item: payload });
  return payload;
}

async function deleteItem(name, id) {
  if (!ALLOWED_COLLECTIONS.includes(name)) throw ApiError.badRequest("Unknown collection");
  if (name === "groups") {
    await Message.deleteMany({ conversation: id });
    await Conversation.deleteOne({ _id: id, type: "group" });
  } else if (name === "comments") {
    await Comment.deleteMany({ _id: id });
  } else {
    await MODELS[name].deleteOne({ _id: id });
  }
  emitter.emitAll(`${name}:changed`, { action: "delete", id: String(id) });
  return true;
}

/**
 * Bulk replace used by the admin panel. Small club collections make this safe and simple.
 */
async function replaceCollection(name, items = [], user) {
  if (!ALLOWED_COLLECTIONS.includes(name)) throw ApiError.badRequest("Unknown collection");
  if (!Array.isArray(items)) throw ApiError.badRequest("items must be an array");

  if (name === "groups") {
    const keepIds = [];
    for (const item of items) {
      const cleanName = String(item.name || "").trim();
      if (!cleanName) continue;
      const desc = String(item.desc || "").slice(0, 200);
      const existing = mongoose.isValidObjectId(item.id) ? await Conversation.findById(item.id) : null;
      if (existing) {
        existing.name = cleanName;
        existing.desc = desc;
        await existing.save();
        keepIds.push(existing._id);
      } else {
        const members = await User.find({ active: true }).select("_id").lean();
        const created = await Conversation.create({
          key: `group-tmp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
          type: "group",
          name: cleanName,
          desc,
          members: members.map((m) => m._id),
          admins: user ? [user._id] : [],
          createdBy: user ? user._id : null,
        });
        created.key = String(created._id);
        await created.save();
        keepIds.push(created._id);
      }
    }
    const removed = await Conversation.find({ type: "group", _id: { $nin: keepIds } }).select("_id members").lean();
    for (const conv of removed) {
      await Message.deleteMany({ conversation: conv._id });
      await Conversation.deleteOne({ _id: conv._id });
    }
    emitter.emitAll("groups:changed", { items: await listCollection("groups") });
    return listCollection("groups");
  }

  if (name === "comments") {
    const keepIds = [];
    for (const item of items) {
      if (mongoose.isValidObjectId(item.id)) {
        const existing = await Comment.findById(item.id);
        if (existing) {
          if (item.text !== undefined) existing.text = String(item.text).slice(0, 2000);
          await existing.save();
          keepIds.push(existing._id);
          continue;
        }
      }
      if (mongoose.isValidObjectId(item.blogId)) {
        const created = await Comment.create({
          targetType: "blog",
          targetId: item.blogId,
          user: item.userId && mongoose.isValidObjectId(item.userId) ? item.userId : user?._id || null,
          authorName: String(item.name || user?.name || "Admin").slice(0, 80),
          text: String(item.text || "").slice(0, 2000),
        });
        keepIds.push(created._id);
      }
    }
    await Comment.deleteMany({ targetType: "blog", _id: { $nin: keepIds } });
    return listCollection("comments");
  }

  const Model = MODELS[name];
  const keepIds = [];
  let index = 0;
  for (const item of items) {
    const data = cleanContent(name, item);
    if (data.order === undefined) data.order = index;
    if (name === "blogs" && !data.tag) data.tag = "News";
    let doc = null;
    if (mongoose.isValidObjectId(item.id)) {
      doc = await Model.findByIdAndUpdate(item.id, { $set: data }, { new: true, runValidators: true });
    }
    if (!doc) {
      if (name === "blogs") data.author = user ? user._id : null;
      doc = await Model.create(data);
    }
    keepIds.push(doc._id);
    index += 1;
  }
  await Model.deleteMany({ _id: { $nin: keepIds } });
  emitter.emitAll(`${name}:changed`, {});
  return listCollection(name);
}

async function bootstrap(viewer) {
  const viewerId = viewer ? viewer._id : null;

  if (viewerId) {
    // Club groups are open to all logged-in members.
    await Conversation.updateMany(
      { type: "group", members: { $ne: viewerId } },
      { $addToSet: { members: viewerId } }
    );
  }

  const [
    users,
    about,
    blogs,
    gallery,
    banners,
    team,
    groupDocs,
    blogComments,
    posts,
    stories,
    lives,
    conversations,
    notifications,
    totalUsers,
    totalPosts,
    unreadCount,
  ] = await Promise.all([
    User.find({ active: true }).sort({ role: 1, name: 1 }).limit(400).lean(),
    About.find({}).sort({ order: 1, createdAt: 1 }).lean(),
    Blog.find({}).sort({ createdAt: -1 }).limit(200).lean(),
    Gallery.find({}).sort({ order: 1, createdAt: 1 }).lean(),
    Banner.find({}).sort({ order: 1, createdAt: 1 }).lean(),
    TeamMember.find({}).sort({ order: 1, createdAt: 1 }).lean(),
    Conversation.find({ type: "group" }).sort({ createdAt: 1 }).lean(),
    Comment.find({ targetType: "blog" }).sort({ createdAt: 1 }).limit(1000).populate("user", "name photo").lean(),
    Post.find({}).sort({ createdAt: -1 }).limit(30).populate("author", "name photo role email bio active").lean(),
    Story.find({ expiresAt: { $gt: new Date() } }).sort({ createdAt: -1 }).limit(200).populate("author", "name photo role email bio active").lean(),
    Live.find({ status: "live" }).sort({ startedAt: -1 }).limit(50).populate("host", "name photo role email bio active").lean(),
    viewerId ? Conversation.find({ members: viewerId }).lean() : Promise.resolve([]),
    viewerId ? notificationService.listForUser(viewerId, { limit: 80 }) : Promise.resolve([]),
    User.countDocuments({ active: true }),
    Post.countDocuments({}),
    viewerId ? Message.countDocuments({ readBy: { $ne: viewerId }, sender: { $ne: viewerId } }) : Promise.resolve(0),
  ]);

  const messages = {};
  if (viewerId) {
    await Promise.all(
      conversations.map(async (conv) => {
        const docs = await Message.find({
          conversation: conv._id,
          deletedForEveryone: { $ne: true },
          deletedFor: { $ne: viewerId },
        })
          .sort({ createdAt: -1 })
          .limit(50)
          .populate("sender", "name photo")
          .populate({ path: "replyTo", select: "text sender" })
          .lean();
        messages[conv.key] = docs.reverse().map((m) => serialize.message(m, viewerId));
      })
    );
  }

  return {
    users: users.map((u) => serialize.user(u)),
    about: about.map((d) => serialize.content("about", d)),
    blogs: blogs.map((d) => serialize.content("blogs", d)),
    gallery: gallery.map((d) => serialize.content("gallery", d)),
    banners: banners.map((d) => serialize.content("banners", d)),
    team: team.map((d) => serialize.content("team", d)),
    groups: groupDocs.map((d) => serialize.conversation(d, viewerId)),
    comments: blogComments.map((d) => serialize.comment(d, viewerId)),
    posts: posts.map((p) => serialize.post(p, viewerId)),
    stories: stories.map((s) => serialize.story(s, viewerId)),
    live: lives.map((l) => serialize.live(l, viewerId)),
    notifs: notifications,
    messages,
    conversations: conversations.map((c) => serialize.conversation(c, viewerId)),
    me: viewer ? serialize.user(viewer) : null,
    stats: { users: totalUsers, posts: totalPosts, unread: unreadCount },
    config: {
      livekitUrl: env.livekit.url,
      cloudinaryCloudName: env.cloudinary.cloudName,
      limits: {
        maxVideoMb: env.limits.maxVideoMb,
        maxImageMb: env.limits.maxImageMb,
        maxAudioMb: env.limits.maxAudioMb,
        postVideoSeconds: LIMITS.postVideoSeconds,
        storySeconds: LIMITS.storySeconds,
        liveSeconds: LIMITS.liveSeconds,
        callRingSeconds: LIMITS.callRingSeconds,
        notificationDays: env.limits.notificationDays,
      },
      now: Date.now(),
    },
  };
}

async function stats() {
  const [users, posts, stories, messages, live, calls, notifications, blogs] = await Promise.all([
    User.countDocuments({ active: true }),
    Post.countDocuments({}),
    Story.countDocuments({ expiresAt: { $gt: new Date() } }),
    Message.countDocuments({}),
    Live.countDocuments({ status: "live" }),
    Call.countDocuments({}),
    require("../models/Notification").countDocuments({}),
    Blog.countDocuments({}),
  ]);
  return { users, posts, stories, messages, live, calls, notifications, blogs };
}

module.exports = {
  ALLOWED_COLLECTIONS,
  MODELS,
  FIELDS,
  listCollection,
  createItem,
  updateItem,
  deleteItem,
  replaceCollection,
  bootstrap,
  stats,
};
