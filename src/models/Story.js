"use strict";

const mongoose = require("mongoose");
const env = require("../config/env");

const storySchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    kind: { type: String, enum: ["photo", "video", "audio"], required: true },
    url: { type: String, required: true },
    publicId: { type: String, default: "" },
    poster: { type: String, default: "" },
    caption: { type: String, default: "", maxlength: 300 },
    duration: { type: Number, default: 0, max: env.limits.storySeconds },
    sound: {
      type: {
        _id: false,
        name: { type: String, default: "" },
        url: { type: String, default: "" },
        publicId: { type: String, default: "" },
        duration: { type: Number, default: 0 },
      },
      default: null,
    },
    viewers: { type: [mongoose.Schema.Types.ObjectId], ref: "User", default: [] },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 24 * 60 * 60 * 1000),
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

storySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
storySchema.index({ author: 1, createdAt: -1 });

module.exports = mongoose.model("Story", storySchema);
