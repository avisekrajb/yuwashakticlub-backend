"use strict";

const mongoose = require("mongoose");

const mediaSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, default: "" },
    type: { type: String, enum: ["image", "video", "audio", "file"], default: "image" },
    poster: { type: String, default: "" },
    name: { type: String, default: "" },
    size: { type: Number, default: 0 },
    duration: { type: Number, default: 0 },
    width: { type: Number, default: 0 },
    height: { type: Number, default: 0 },
  },
  { _id: false }
);

const postSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    text: { type: String, default: "", maxlength: 5000, trim: true },
    category: { type: String, default: "General", maxlength: 40 },
    media: { type: [mediaSchema], default: [] },
    tags: { type: [String], default: [] },
    visibility: { type: String, enum: ["public", "members"], default: "public" },
    reactions: {
      type: [
        {
          _id: false,
          user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
          type: {
            type: String,
            enum: ["like", "love", "haha", "wow", "sad", "angry"],
            default: "like",
          },
        },
      ],
      default: [],
    },
    shares: {
      type: [
        {
          _id: false,
          user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
          createdAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
    commentsCount: { type: Number, default: 0 },
    views: { type: Number, default: 0 },
    commentsDisabled: { type: Boolean, default: false },
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

postSchema.index({ createdAt: -1 });
postSchema.index({ author: 1, createdAt: -1 });

module.exports = mongoose.model("Post", postSchema);
