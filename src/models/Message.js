"use strict";

const mongoose = require("mongoose");

const attachmentSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, default: "" },
    type: { type: String, enum: ["image", "video", "audio", "file"], default: "image" },
    poster: { type: String, default: "" },
    name: { type: String, default: "" },
    size: { type: Number, default: 0 },
    duration: { type: Number, default: 0 },
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
    conversation: { type: mongoose.Schema.Types.ObjectId, ref: "Conversation", required: true, index: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    text: { type: String, default: "", maxlength: 4000, trim: true },
    attachments: { type: [attachmentSchema], default: [] },
    replyTo: { type: mongoose.Schema.Types.ObjectId, ref: "Message", default: null },
    reactions: {
      type: [
        {
          _id: false,
          user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
          emoji: { type: String, default: "❤️" },
        },
      ],
      default: [],
    },
    readBy: { type: [mongoose.Schema.Types.ObjectId], ref: "User", default: [] },
    deliveredTo: { type: [mongoose.Schema.Types.ObjectId], ref: "User", default: [] },
    deletedForEveryone: { type: Boolean, default: false },
    deletedFor: { type: [mongoose.Schema.Types.ObjectId], ref: "User", default: [] },
    editedAt: { type: Date, default: null },
    system: { type: Boolean, default: false },
    clientId: { type: String, default: null },
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

messageSchema.index({ conversation: 1, createdAt: -1 });

module.exports = mongoose.model("Message", messageSchema);
