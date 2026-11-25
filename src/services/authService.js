"use strict";

const User = require("../models/User");
const Post = require("../models/Post");
const Story = require("../models/Story");
const Comment = require("../models/Comment");
const Message = require("../models/Message");
const Conversation = require("../models/Conversation");
const Notification = require("../models/Notification");
const Call = require("../models/Call");
const ApiError = require("../utils/ApiError");
const { hashPassword, comparePassword } = require("../utils/hashPassword");
const { generateToken } = require("../utils/generateToken");
const serialize = require("../utils/serialize");
const notificationService = require("./notificationService");
const uploadService = require("./uploadService");
const emitter = require("../sockets/emitter");
const logger = require("../utils/logger");

async function register({ name, email, password }) {
  const existing = await User.findOne({ email }).lean();
  if (existing) throw ApiError.conflict("This email is already registered. Log in instead.", "EMAIL_TAKEN");

  const passwordHash = await hashPassword(password);
  const user = await User.create({ name, email, passwordHash, role: "user", active: true });

  // New members automatically join the club's public group chats.
  await Conversation.updateMany({ type: "group" }, { $addToSet: { members: user._id } });

  const token = generateToken(user);

  notificationService
    .notify({
      userId: user._id,
      type: "welcome",
      text: `Welcome to the club, ${user.name.split(" ")[0]}! 🎉`,
      force: true,
    })
    .catch((err) => logger.warn("welcome notification:", err.message));

  return { user: serialize.user(user), token };
}

async function login({ email, password }) {
  const user = await User.findOne({ email }).select("+passwordHash");
  if (!user) throw ApiError.unauthorized("Wrong email or password.", "BAD_CREDENTIALS");
  const ok = await comparePassword(password, user.passwordHash);
  if (!ok) throw ApiError.unauthorized("Wrong email or password.", "BAD_CREDENTIALS");
  if (!user.active) throw ApiError.forbidden("This account is deactivated. Ask a club admin to reactivate it.", "ACCOUNT_DISABLED");

  user.lastSeen = new Date();
  await user.save();
  const token = generateToken(user);
  return { user: serialize.user(user), token };
}

async function me(userId) {
  const user = await User.findById(userId).lean();
  if (!user) throw ApiError.notFound("Account not found");
  return serialize.user(user);
}

async function changePassword(userId, { currentPassword, newPassword }) {
  const user = await User.findById(userId).select("+passwordHash");
  if (!user) throw ApiError.notFound("Account not found");
  const ok = await comparePassword(currentPassword, user.passwordHash);
  if (!ok) throw ApiError.badRequest("Current password is wrong.", "BAD_PASSWORD");
  user.passwordHash = await hashPassword(newPassword);
  await user.save();
  return true;
}

async function updateProfile(userId, updates) {
  const user = await User.findByIdAndUpdate(userId, { $set: updates }, { new: true, runValidators: true }).lean();
  if (!user) throw ApiError.notFound("Account not found");
  return serialize.user(user);
}

async function updateSettings(userId, updates) {
  const user = await User.findByIdAndUpdate(userId, { $set: updates }, { new: true, runValidators: true }).lean();
  if (!user) throw ApiError.notFound("Account not found");
  return serialize.user(user);
}

/**
 * Permanently delete an account and all of its personal content.
 * Uploaded Cloudinary assets are removed asynchronously.
 */
async function deleteAccount(userId, password) {
  const user = await User.findById(userId).select("+passwordHash");
  if (!user) throw ApiError.notFound("Account not found");
  const ok = await comparePassword(password, user.passwordHash);
  if (!ok) throw ApiError.badRequest("Password is wrong. Account was not deleted.", "BAD_PASSWORD");

  const uid = user._id;
  const assets = [];
  if (user.photoPublicId) assets.push({ publicId: user.photoPublicId, type: "image" });

  const posts = await Post.find({ author: uid }).lean();
  posts.forEach((p) => (p.media || []).forEach((m) => assets.push({ publicId: m.publicId, type: m.type })));
  const stories = await Story.find({ author: uid }).lean();
  stories.forEach((s) => {
    assets.push({ publicId: s.publicId, type: s.kind });
    if (s.sound && s.sound.publicId) assets.push({ publicId: s.sound.publicId, type: "audio" });
  });
  const messages = await Message.find({ sender: uid }).lean();
  messages.forEach((m) => (m.attachments || []).forEach((a) => assets.push({ publicId: a.publicId, type: a.type })));

  // Remove personal content
  await Promise.all([
    Post.deleteMany({ author: uid }),
    Story.deleteMany({ author: uid }),
    Comment.deleteMany({ user: uid }),
    Message.deleteMany({ sender: uid }),
    Notification.deleteMany({ $or: [{ user: uid }, { actor: uid }] }),
    Call.deleteMany({ $or: [{ caller: uid }, { callee: uid }, { participants: uid }] }),
  ]);

  // Handle conversations
  const conversations = await Conversation.find({ members: uid });
  for (const conv of conversations) {
    if (conv.type === "direct") {
      await Message.deleteMany({ conversation: conv._id });
      await conv.deleteOne();
      continue;
    }
    conv.members = conv.members.filter((m) => String(m) !== String(uid));
    conv.admins = conv.admins.filter((m) => String(m) !== String(uid));
    if (!conv.members.length) {
      await Message.deleteMany({ conversation: conv._id });
      await conv.deleteOne();
    } else {
      if (!conv.admins.length) conv.admins = [conv.members[0]];
      await conv.save();
    }
  }

  await user.deleteOne();

  emitter.emitToUser(userId, "account:deleted", { message: "Your account has been deleted." });
  emitter.emitAll("presence:list", { users: [] });

  uploadService.deleteMany(assets).catch((err) => logger.warn("account asset cleanup:", err.message));

  return true;
}

async function listUsers({ q, includeInactive = false } = {}) {
  const query = {};
  if (!includeInactive) query.active = true;
  if (q) {
    const safe = String(q).slice(0, 80).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    query.$or = [{ name: new RegExp(safe, "i") }, { email: new RegExp(safe, "i") }];
  }
  const users = await User.find(query).sort({ role: 1, name: 1 }).limit(300).lean();
  return users.map((u) => serialize.user(u));
}

module.exports = {
  register,
  login,
  me,
  changePassword,
  updateProfile,
  updateSettings,
  deleteAccount,
  listUsers,
};
