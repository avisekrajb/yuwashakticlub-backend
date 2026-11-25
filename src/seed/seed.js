"use strict";

const { connectDB, disconnectDB } = require("../config/db");
const env = require("../config/env");
const logger = require("../utils/logger");
const { hashPassword } = require("../utils/hashPassword");
const User = require("../models/User");
const About = require("../models/About");
const Blog = require("../models/Blog");
const Gallery = require("../models/Gallery");
const Banner = require("../models/Banner");
const TeamMember = require("../models/TeamMember");
const Conversation = require("../models/Conversation");
const Comment = require("../models/Comment");
const Post = require("../models/Post");
const Notification = require("../models/Notification");
const data = require("./data");

async function seedUsers() {
  const users = [];
  for (const item of data.users) {
    let user = await User.findOne({ email: item.email });
    if (!user) {
      user = await User.create({
        name: item.name,
        email: item.email,
        passwordHash: await hashPassword(item.password),
        role: item.role,
        bio: item.bio || "",
        active: true,
      });
      logger.info(`seed: created user ${item.email}`);
    }
    users.push(user);
  }
  return users;
}

async function seedContent() {
  if ((await About.countDocuments()) === 0) await About.insertMany(data.about.map((a, i) => ({ ...a, order: i })));
  if ((await Banner.countDocuments()) === 0) await Banner.insertMany(data.banners.map((b, i) => ({ ...b, order: i })));
  if ((await Gallery.countDocuments()) === 0) await Gallery.insertMany(data.gallery.map((g, i) => ({ ...g, order: i })));
  if ((await TeamMember.countDocuments()) === 0) await TeamMember.insertMany(data.team.map((t, i) => ({ ...t, order: i })));

  let blogs = await Blog.find({}).sort({ createdAt: 1 });
  if (!blogs.length) {
    await Blog.insertMany(
      data.blogs.map((b) => ({
        ...b,
        photos: [],
        slug: b.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 90),
      }))
    );
    blogs = await Blog.find({}).sort({ createdAt: 1 });
  }
  return blogs;
}

async function seedGroups(users) {
  const memberIds = users.map((u) => u._id);
  const admin = users.find((u) => u.role === "admin") || users[0];
  const groups = [];
  for (const item of data.groups) {
    let conv = await Conversation.findOne({ type: "group", name: item.name });
    if (!conv) {
      conv = await Conversation.create({
        key: `group-tmp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        type: "group",
        name: item.name,
        desc: item.desc,
        members: memberIds,
        admins: admin ? [admin._id] : [],
        createdBy: admin ? admin._id : null,
      });
      conv.key = String(conv._id);
      await conv.save();
      logger.info(`seed: created group ${item.name}`);
    } else {
      await Conversation.updateOne({ _id: conv._id }, { $addToSet: { members: { $each: memberIds } } });
    }
    groups.push(conv);
  }
  return groups;
}

async function seedComments(blogs, users) {
  if ((await Comment.countDocuments()) > 0) return;
  const rows = [];
  for (const item of data.comments) {
    const blog = blogs[item.blogIndex];
    const user = users.find((u) => u.email === item.userEmail);
    if (!blog || !user) continue;
    rows.push({
      targetType: "blog",
      targetId: blog._id,
      user: user._id,
      authorName: user.name,
      text: item.text,
    });
  }
  if (rows.length) await Comment.insertMany(rows);
}

async function seedPosts(users) {
  if ((await Post.countDocuments()) > 0) return;
  const rows = data.posts
    .map((item) => {
      const author = users.find((u) => u.email === item.authorEmail);
      if (!author) return null;
      return { author: author._id, text: item.text, category: item.category || "General" };
    })
    .filter(Boolean);
  if (rows.length) await Post.insertMany(rows);
}

async function seedNotifications(users) {
  for (const user of users) {
    const count = await Notification.countDocuments({ user: user._id, type: "welcome" });
    if (!count) {
      await Notification.create({
        user: user._id,
        type: "welcome",
        text: `Welcome to Shree Yuwa Shakti Club, ${user.name.split(" ")[0]}! 🎉`,
        force: true,
      });
    }
  }
}

async function seedDatabase({ force = false } = {}) {
  if (force) {
    await Promise.all([
      Notification.deleteMany({}),
      Comment.deleteMany({}),
      Post.deleteMany({}),
      Conversation.deleteMany({}),
      Gallery.deleteMany({}),
      Banner.deleteMany({}),
      TeamMember.deleteMany({}),
      About.deleteMany({}),
      Blog.deleteMany({}),
    ]);
    logger.info("seed: cleared content collections");
  }

  const users = await seedUsers();
  const blogs = await seedContent();
  await seedGroups(users);
  await seedComments(blogs, users);
  await seedPosts(users);
  await seedNotifications(users);

  logger.info(`seed: complete (${users.length} demo members)`);
  return { users: users.length, blogs: blogs.length };
}

if (require.main === module) {
  (async () => {
    try {
      await connectDB();
      await seedDatabase({ force: process.argv.includes("--force") });
    } catch (err) {
      logger.error("seed failed", err);
      process.exitCode = 1;
    } finally {
      await disconnectDB();
    }
  })();
}

module.exports = { seedDatabase };
