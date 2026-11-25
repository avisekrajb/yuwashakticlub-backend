"use strict";

const mongoose = require("mongoose");

const callSchema = new mongoose.Schema(
  {
    room: { type: String, required: true, unique: true },
    kind: { type: String, enum: ["audio", "video"], default: "audio" },
    status: {
      type: String,
      enum: ["ringing", "active", "ended", "rejected", "missed", "cancelled"],
      default: "ringing",
      index: true,
    },
    caller: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    callee: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    participants: { type: [mongoose.Schema.Types.ObjectId], ref: "User", default: [] },
    conversation: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation", default: null },
    group: { type: Boolean, default: false },
    startedAt: { type: Date, default: Date.now },
    answeredAt: { type: Date, default: null },
    endedAt: { type: Date, default: null },
    durationSec: { type: Number, default: 0 },
    endReason: { type: String, default: null },
    controlState: {
      type: {
        _id: false,
        muted: { type: Boolean, default: false },
        cameraOff: { type: Boolean, default: false },
        speaker: { type: Boolean, default: true },
        noiseCancellation: { type: Boolean, default: true },
      },
      default: {},
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

callSchema.index({ caller: 1, startedAt: -1 });
callSchema.index({ startedAt: -1 });

module.exports = mongoose.model("Call", callSchema);
