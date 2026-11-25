"use strict";

const sid = (value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (value._id) return String(value._id);
  if (value.id) return String(value.id);
  return String(value);
};

const ms = (value) => (value ? new Date(value).getTime() : null);

function user(doc, opts = {}) {
  if (!doc) return null;
  if (typeof doc !== "object") return { id: String(doc), name: "Former member", photo: "", role: "user", active: false };
  return {
    id: sid(doc),
    name: doc.name || "Former member",
    email: opts.includeEmail === false ? undefined : doc.email,
    role: doc.role || "user",
    active: doc.active !== false,
    bio: doc.bio || "",
    photo: doc.photo || "",
    settings: doc.settings || undefined,
    lastSeen: doc.lastSeen || null,
    online: Boolean(opts.online),
    createdAt: doc.createdAt || null,
  };
}

function media(item) {
  if (!item) return null;
  return {
    url: item.url || "",
    publicId: item.publicId || "",
    type: item.type || "image",
    poster: item.poster || "",
    name: item.name || "",
    size: item.size || 0,
    duration: item.duration || 0,
    width: item.width || 0,
    height: item.height || 0,
  };
}

function post(doc, viewerId) {
  if (!doc) return null;
  const reactions = doc.reactions || [];
  const counts = { like: 0, love: 0, haha: 0, wow: 0, sad: 0, angry: 0 };
  let mine = null;
  reactions.forEach((r) => {
    counts[r.type] = (counts[r.type] || 0) + 1;
    if (viewerId && sid(r.user) === String(viewerId)) mine = r.type;
  });
  return {
    id: sid(doc),
    text: doc.text || "",
    category: doc.category || "General",
    media: (doc.media || []).map(media),
    author: user(doc.author),
    reactions: { counts, total: reactions.length, mine },
    sharesCount: (doc.shares || []).length,
    sharedByMe: viewerId ? (doc.shares || []).some((s) => sid(s.user) === String(viewerId)) : false,
    commentsCount: doc.commentsCount || 0,
    views: doc.views || 0,
    mine: Boolean(viewerId && sid(doc.author) === String(viewerId)),
    createdAt: doc.createdAt,
    t: ms(doc.createdAt),
  };
}

function comment(doc, viewerId) {
  if (!doc) return null;
  const reactions = doc.reactions || [];
  return {
    id: sid(doc),
    postId: doc.targetType === "post" ? sid(doc.targetId) : null,
    blogId: doc.targetType === "blog" ? sid(doc.targetId) : null,
    targetType: doc.targetType,
    targetId: sid(doc.targetId),
    userId: sid(doc.user),
    name: doc.authorName || (doc.user && doc.user.name) || "Former member",
    photo: (doc.user && doc.user.photo) || "",
    text: doc.text,
    parent: sid(doc.parent),
    reactionsCount: reactions.length,
    mine: Boolean(viewerId && sid(doc.user) === String(viewerId)),
    t: ms(doc.createdAt),
    createdAt: doc.createdAt,
  };
}

function message(doc, viewerId) {
  if (!doc) return null;
  const deleted = doc.deletedForEveryone;
  return {
    id: sid(doc),
    conversationId: sid(doc.conversation),
    from: sid(doc.sender),
    sender: user(doc.sender, { includeEmail: false }),
    text: deleted ? "This message was deleted" : doc.text || "",
    attachments: deleted ? [] : (doc.attachments || []).map(media),
    replyTo: doc.replyTo
      ? {
          id: sid(doc.replyTo),
          text: doc.replyTo.text || "",
          from: sid(doc.replyTo.sender),
        }
      : null,
    reactions: (doc.reactions || []).map((r) => ({ user: sid(r.user), emoji: r.emoji })),
    readBy: (doc.readBy || []).map(sid),
    deliveredTo: (doc.deliveredTo || []).map(sid),
    editedAt: doc.editedAt || null,
    deleted,
    system: Boolean(doc.system),
    clientId: doc.clientId || null,
    mine: Boolean(viewerId && sid(doc.sender) === String(viewerId)),
    t: ms(doc.createdAt),
    createdAt: doc.createdAt,
  };
}

function notification(doc) {
  if (!doc) return null;
  return {
    id: sid(doc),
    type: doc.type || "system",
    text: doc.text,
    for: sid(doc.user),
    by: sid(doc.actor),
    ref: doc.ref ? String(doc.ref) : null,
    refType: doc.refType || null,
    read: Boolean(doc.readAt),
    t: ms(doc.createdAt),
    createdAt: doc.createdAt,
    expiresAt: doc.expiresAt || null,
  };
}

function story(doc, viewerId) {
  if (!doc) return null;
  const viewers = doc.viewers || [];
  return {
    id: sid(doc),
    author: user(doc.author),
    kind: doc.kind || "photo",
    url: doc.url,
    publicId: doc.publicId || "",
    poster: doc.poster || "",
    caption: doc.caption || "",
    duration: doc.duration || 0,
    sound: doc.sound || null,
    views: viewers.length,
    seen: viewerId ? viewers.some((v) => sid(v) === String(viewerId)) : false,
    mine: Boolean(viewerId && sid(doc.author) === String(viewerId)),
    t: ms(doc.createdAt),
    createdAt: doc.createdAt,
    expiresAt: doc.expiresAt,
  };
}

function live(doc, viewerId) {
  if (!doc) return null;
  const viewers = doc.viewers || [];
  return {
    id: sid(doc),
    host: user(doc.host),
    title: doc.title || "Live",
    room: doc.room,
    status: doc.status,
    viewers: doc.peakViewers || viewers.length,
    viewerCount: viewers.length,
    mine: Boolean(viewerId && sid(doc.host) === String(viewerId)),
    startedAt: doc.startedAt,
    endedAt: doc.endedAt || null,
    maxDurationSec: doc.maxDurationSec || 600,
    t: ms(doc.startedAt || doc.createdAt),
    commentsCount: (doc.comments || []).length,
  };
}

function liveComment(doc) {
  if (!doc) return null;
  return {
    id: sid(doc._id) || sid(doc.id),
    userId: sid(doc.user),
    user: user(doc.user, { includeEmail: false }),
    text: doc.text,
    t: ms(doc.at || doc.createdAt),
  };
}

function call(doc, viewerId) {
  if (!doc) return null;
  return {
    id: sid(doc),
    room: doc.room,
    kind: doc.kind,
    status: doc.status,
    caller: user(doc.caller, { includeEmail: false }),
    callee: user(doc.callee, { includeEmail: false }),
    participants: (doc.participants || []).map((p) => sid(p)),
    conversationId: sid(doc.conversation),
    direction: viewerId
      ? sid(doc.caller) === String(viewerId)
        ? "outgoing"
        : "incoming"
      : null,
    startedAt: doc.startedAt,
    answeredAt: doc.answeredAt || null,
    endedAt: doc.endedAt || null,
    durationSec: doc.durationSec || 0,
    endReason: doc.endReason || null,
    t: ms(doc.startedAt || doc.createdAt),
  };
}

function conversation(doc, viewerId) {
  if (!doc) return null;
  return {
    id: sid(doc),
    key: doc.key,
    type: doc.type,
    name: doc.name || "Chat",
    desc: doc.desc || "",
    avatar: doc.avatar || "",
    members: (doc.members || []).map((m) => sid(m)),
    admins: (doc.admins || []).map((a) => sid(a)),
    lastMessage: doc.lastMessage || null,
    lastAt: doc.lastAt || null,
    unread: doc.unread || 0,
    mine: Boolean(viewerId && (doc.members || []).some((m) => sid(m) === String(viewerId))),
    t: ms(doc.lastAt || doc.createdAt),
    createdAt: doc.createdAt,
  };
}

function content(type, doc) {
  if (!doc) return null;
  const base = { id: sid(doc) };
  if (type === "about") {
    return { ...base, emoji: doc.emoji || "", title: doc.title || "", text: doc.text || "" };
  }
  if (type === "blogs") {
    return {
      ...base,
      title: doc.title || "",
      tag: doc.tag || "News",
      date: doc.date || (doc.createdAt ? new Date(doc.createdAt).toISOString().slice(0, 10) : ""),
      text: doc.text || "",
      photos: doc.photos || [],
    };
  }
  if (type === "gallery") {
    return {
      ...base,
      title: doc.title || "",
      url: doc.url || "",
      type: doc.type === "video" ? "video" : "photo",
      thumb: doc.thumb || "",
      slide: Boolean(doc.slide),
    };
  }
  if (type === "banners") {
    return { ...base, title: doc.title || "", sub: doc.sub || "", url: doc.url || "" };
  }
  if (type === "team") {
    return { ...base, name: doc.name || "", role: doc.role || "", url: doc.url || "" };
  }
  return { ...base, ...doc };
}

module.exports = {
  sid,
  ms,
  user,
  media,
  post,
  comment,
  message,
  notification,
  story,
  live,
  liveComment,
  call,
  conversation,
  content,
};
