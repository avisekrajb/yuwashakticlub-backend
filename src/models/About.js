"use strict";

const mongoose = require("mongoose");

const aboutSchema = new mongoose.Schema(
  {
    emoji: { type: String, default: "✨", maxlength: 8 },
    title: { type: String, required: true, maxlength: 120 },
    text: { type: String, required: true, maxlength: 4000 },
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

module.exports = mongoose.model("About", aboutSchema);
