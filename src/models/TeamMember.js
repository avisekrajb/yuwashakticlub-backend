"use strict";

const mongoose = require("mongoose");

const teamMemberSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, maxlength: 100 },
    role: { type: String, default: "Member", maxlength: 100 },
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

module.exports = mongoose.model("TeamMember", teamMemberSchema);
