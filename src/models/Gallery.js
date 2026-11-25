"use strict";

const mongoose = require("mongoose");

const gallerySchema = new mongoose.Schema(
  {
    title: { type: String, required: true, maxlength: 160 },
    url: { type: String, default: "" },
    type: { type: String, enum: ["photo", "video"], default: "photo" },
    thumb: { type: String, default: "" },
    publicId: { type: String, default: "" },
    slide: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
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

module.exports = mongoose.model("Gallery", gallerySchema);
