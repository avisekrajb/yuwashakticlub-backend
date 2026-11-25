"use strict";

const Notification = require("../models/Notification");
const Story = require("../models/Story");
const liveService = require("./liveService");
const callService = require("./callService");
const uploadService = require("./uploadService");
const logger = require("../utils/logger");

async function cleanupRealtime() {
  const [lives, calls] = await Promise.all([liveService.autoEndExpired(), callService.cleanup()]);
  if (lives || calls) logger.info(`cleanup: ended ${lives} live(s), ${calls} stale call(s)`);
  return { lives, calls };
}

async function cleanupExpired() {
  const now = new Date();
  const expiredNotifications = await Notification.deleteMany({ expiresAt: { $lte: now } });
  const expiredStories = await Story.find({ expiresAt: { $lte: now } }).lean();
  if (expiredStories.length) {
    const assets = [];
    expiredStories.forEach((s) => {
      assets.push({ publicId: s.publicId, type: s.kind });
      if (s.sound && s.sound.publicId) assets.push({ publicId: s.sound.publicId, type: "audio" });
    });
    await Story.deleteMany({ _id: { $in: expiredStories.map((s) => s._id) } });
    uploadService.deleteMany(assets).catch(() => {});
  }
  if (expiredNotifications.deletedCount || expiredStories.length) {
    logger.info(
      `cleanup: removed ${expiredNotifications.deletedCount} notification(s) and ${expiredStories.length} expired story/stories`
    );
  }
  return { notifications: expiredNotifications.deletedCount || 0, stories: expiredStories.length };
}

function startJobs() {
  const realtimeTimer = setInterval(() => {
    cleanupRealtime().catch((err) => logger.warn("cleanup realtime:", err.message));
  }, 15 * 1000);

  const expiryTimer = setInterval(() => {
    cleanupExpired().catch((err) => logger.warn("cleanup expiry:", err.message));
  }, 5 * 60 * 1000);

  realtimeTimer.unref?.();
  expiryTimer.unref?.();
  logger.info("background cleanup jobs started (live/calls every 15s, notifications/stories every 5m)");
  return () => {
    clearInterval(realtimeTimer);
    clearInterval(expiryTimer);
  };
}

module.exports = { cleanupRealtime, cleanupExpired, startJobs };
