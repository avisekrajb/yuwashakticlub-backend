"use strict";

function send(body) {
  const text = String(body.text ?? "").trim();
  const attachments = Array.isArray(body.attachments) ? body.attachments.slice(0, 10) : [];
  if (!text && !attachments.length) return { error: "Write a message or attach a file." };
  if (text.length > 4000) return { error: "Message is too long (max 4000 characters)." };
  const cleanAttachments = attachments.map((a) => ({
    url: String(a.url || ""),
    publicId: String(a.publicId || ""),
    type: ["image", "video", "audio", "file"].includes(a.type) ? a.type : "file",
    poster: String(a.poster || ""),
    name: String(a.name || ""),
    size: Number(a.size) || 0,
    duration: Number(a.duration) || 0,
  }));
  if (cleanAttachments.some((a) => !a.url)) return { error: "Invalid attachment." };
  return {
    value: {
      text,
      attachments: cleanAttachments,
      replyTo: body.replyTo || null,
      clientId: body.clientId ? String(body.clientId).slice(0, 80) : null,
    },
  };
}

function edit(body) {
  const text = String(body.text ?? "").trim();
  if (!text) return { error: "Message cannot be empty." };
  if (text.length > 4000) return { error: "Message is too long." };
  return { value: { text } };
}

module.exports = { send, edit };
