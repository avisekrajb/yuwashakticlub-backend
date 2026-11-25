"use strict";

function updateProfile(body) {
  const value = {};
  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (name.length < 2 || name.length > 80) return { error: "Name must be 2-80 characters." };
    value.name = name;
  }
  if (body.bio !== undefined) {
    const bio = String(body.bio).trim();
    if (bio.length > 300) return { error: "Bio is too long (max 300 characters)." };
    value.bio = bio;
  }
  if (body.photo !== undefined) value.photo = String(body.photo).trim();
  if (body.photoPublicId !== undefined) value.photoPublicId = String(body.photoPublicId).trim();
  if (!Object.keys(value).length) return { error: "Nothing to update." };
  return { value };
}

function updateSettings(body) {
  const value = {};
  const keys = ["notifyChat", "notifyPosts", "notifyCalls", "noiseCancellation", "speakerDefault"];
  keys.forEach((k) => {
    if (body[k] !== undefined) value[`settings.${k}`] = Boolean(body[k]);
  });
  if (body.theme !== undefined) {
    if (!["light", "dark"].includes(body.theme)) return { error: "Invalid theme." };
    value["settings.theme"] = body.theme;
  }
  if (!Object.keys(value).length) return { error: "Nothing to update." };
  return { value };
}

module.exports = { updateProfile, updateSettings };
