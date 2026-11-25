"use strict";

const mongoose = require("mongoose");

const blogSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, maxlength: 200, trim: true },
    slug: { type: String, default: "", index: true },
    tag: { type: String, default: "News", maxlength: 40 },
    date: { type: String, default: () => new Date().toISOString().slice(0, 10) },
    text: { type: String, required: true, maxlength: 20000 },
    photos: { type: [String], default: [] },
    author: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
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

module.exports = mongoose.model("Blog", blogSchema);
