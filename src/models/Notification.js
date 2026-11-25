"use strict";

const mongoose = require("mongoose");
const env = require("../config/env");

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    type: {
      type: String,
      enum: ["welcome", "post", "story", "live", "comment", "reaction", "share", "message", "call", "system"],
      default: "system",
    },
    text: { type: String, required: true, maxlength: 400 },
    ref: { type: String, default: null },
    refType: { type: String, default: null },
    readAt: { type: Date, default: null },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + env.notificationTtlSeconds * 1000),
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        ret.id = String(ret._id);
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Notifications are automatically removed 30 days after they are created (per user).
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ user: 1, readAt: 1 });

module.exports = mongoose.model("Notification", notificationSchema);
