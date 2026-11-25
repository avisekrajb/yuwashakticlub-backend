"use strict";

function create(body) {
  const text = String(body.text ?? "").trim();
  if (!text) return { error: "Write a comment first." };
  if (text.length > 2000) return { error: "Comment is too long (max 2000 characters)." };
  return { value: { text, parent: body.parent || null } };
}

module.exports = { create };
