"use strict";

const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 160,
      match: /^\S+@\S+\.\S+$/,
    },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ["user", "admin"], default: "user", index: true },
    active: { type: Boolean, default: true, index: true },
    bio: { type: String, default: "", maxlength: 300 },
    photo: { type: String, default: "" },
    photoPublicId: { type: String, default: "" },
    settings: {
      notifyChat: { type: Boolean, default: true },
      notifyPosts: { type: Boolean, default: true },
      notifyCalls: { type: Boolean, default: true },
      noiseCancellation: { type: Boolean, default: true },
      theme: { type: String, enum: ["light", "dark"], default: "light" },
      speakerDefault: { type: Boolean, default: true },
    },
    lastSeen: { type: Date, default: Date.now },
    deletedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        ret.id = String(ret._id);
        delete ret._id;
        delete ret.__v;
        delete ret.passwordHash;
        return ret;
      },
    },
  }
);

module.exports = mongoose.model("User", userSchema);
