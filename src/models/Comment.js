"use strict";

const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema(
  {
    targetType: { type: String, enum: ["post", "blog"], required: true, index: true },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    authorName: { type: String, default: "Former member" },
    text: { type: String, required: true, maxlength: 2000, trim: true },
    parent: { type: mongoose.Schema.Types.ObjectId, ref: "Comment", default: null },
    reactions: {
      type: [
        {
          _id: false,
          user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
          type: { type: String, default: "like" },
        },
      ],
      default: [],
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

commentSchema.index({ targetType: 1, targetId: 1, createdAt: 1 });

module.exports = mongoose.model("Comment", commentSchema);
