"use strict";

const mongoose = require("mongoose");

const bannerSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, maxlength: 160 },
    sub: { type: String, default: "", maxlength: 200 },
    url: { type: String, default: "" },
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

module.exports = mongoose.model("Banner", bannerSchema);
