"use strict";

const mongoose = require("mongoose");

const liveSchema = new mongoose.Schema(
  {
    host: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, maxlength: 120, trim: true },
    room: { type: String, required: true, unique: true },
    status: { type: String, enum: ["live", "ended"], default: "live", index: true },
    maxDurationSec: { type: Number, default: 600 },
    viewers: { type: [mongoose.Schema.Types.ObjectId], ref: "User", default: [] },
    peakViewers: { type: Number, default: 0 },
    comments: {
      type: [
        {
          user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
          text: { type: String, maxlength: 500 },
          at: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
    reactions: {
      type: [
        {
          _id: false,
          user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
          emoji: { type: String, default: "❤️" },
          at: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },
    startedAt: { type: Date, default: Date.now },
    endedAt: { type: Date, default: null },
    endReason: { type: String, default: null },
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

liveSchema.index({ status: 1, startedAt: -1 });

module.exports = mongoose.model("Live", liveSchema);
