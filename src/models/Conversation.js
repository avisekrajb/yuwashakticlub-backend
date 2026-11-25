"use strict";

const mongoose = require("mongoose");

const conversationSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    type: { type: String, enum: ["group", "direct"], default: "group" },
    name: { type: String, default: "Chat", maxlength: 100 },
    desc: { type: String, default: "", maxlength: 200 },
    avatar: { type: String, default: "" },
    members: { type: [mongoose.Schema.Types.ObjectId], ref: "User", default: [], index: true },
    admins: { type: [mongoose.Schema.Types.ObjectId], ref: "User", default: [] },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    lastMessage: {
      type: {
        _id: false,
        text: { type: String, default: "" },
        sender: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        at: { type: Date },
      },
      default: null,
    },
    lastAt: { type: Date, default: Date.now, index: true },
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

module.exports = mongoose.model("Conversation", conversationSchema);
