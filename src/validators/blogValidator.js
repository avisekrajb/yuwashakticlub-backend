"use strict";

function create(body) {
  const title = String(body.title ?? "").trim();
  const text = String(body.text ?? "").trim();
  if (title.length < 2 || title.length > 200) return { error: "Title must be 2-200 characters." };
  if (!text) return { error: "Content is required." };
  if (text.length > 20000) return { error: "Content is too long." };
  return {
    value: {
      title,
      text,
      tag: String(body.tag || "News").trim().slice(0, 40) || "News",
      date: body.date ? String(body.date).slice(0, 10) : new Date().toISOString().slice(0, 10),
      photos: Array.isArray(body.photos) ? body.photos.filter((p) => typeof p === "string").slice(0, 12) : [],
    },
  };
}

module.exports = { create };
