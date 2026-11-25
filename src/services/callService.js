"use strict";

const Call = require("../models/Call");
const User = require("../models/User");
const Conversation = require("../models/Conversation");
const ApiError = require("../utils/ApiError");
const serialize = require("../utils/serialize");
const emitter = require("../sockets/emitter");
const presence = require("../sockets/presence");
const notificationService = require("./notificationService");
const livekit = require("./livekitService");
const { LIMITS, CALL_KINDS } = require("../config/constants");

const ringTimers = new Map();

function clearTimer(callId) {
  const t = ringTimers.get(String(callId));
  if (t) clearTimeout(t);
  ringTimers.delete(String(callId));
}

function populate(callId) {
  return Call.findById(callId)
    .populate("caller", "name photo role email bio active")
    .populate("callee", "name photo role email bio active")
    .lean();
}

function emitToParticipants(call, event, extra = {}) {
  const ids = new Set([String(call.caller), ...(call.participants || []).map(String), call.callee ? String(call.callee) : ""].filter(Boolean));
  ids.forEach((id) => {
    emitter.emitToUser(id, event, { call: serialize.call(call, id), ...extra });
  });
}

function isParticipant(call, userId) {
  return (
    String(call.caller) === String(userId) ||
    String(call.callee || "") === String(userId) ||
    (call.participants || []).some((p) => String(p) === String(userId))
  );
}

async function start({ caller, toUserId, conversationId, kind = "audio" }) {
  if (!CALL_KINDS.includes(kind)) throw ApiError.badRequest("Invalid call type");

  let conversation = null;
  let recipients = [];
  let callee = null;
  let group = false;

  if (conversationId) {
    conversation = await Conversation.findById(conversationId).lean();
    if (!conversation) throw ApiError.notFound("Conversation not found");
    if (!(conversation.members || []).some((m) => String(m) === String(caller._id))) {
      throw ApiError.forbidden("You are not part of this conversation");
    }
    group = conversation.type === "group";
    recipients = conversation.members.map(String).filter((id) => id !== String(caller._id));
    if (!group) callee = recipients[0];
  } else {
    if (!toUserId) throw ApiError.badRequest("Choose who to call");
    if (String(toUserId) === String(caller._id)) throw ApiError.badRequest("You cannot call yourself");
    const target = await User.findById(toUserId).lean();
    if (!target || !target.active) throw ApiError.notFound("Member not found");
    callee = target._id;
    recipients = [String(target._id)];
  }

  if (!recipients.length) throw ApiError.badRequest("This conversation has no other members");

  const stale = await Call.findOne({
    caller: caller._id,
    status: "ringing",
    startedAt: { $gt: new Date(Date.now() - LIMITS.callRingSeconds * 1000) },
  });
  if (stale) throw ApiError.conflict("You already have a call ringing. End it first.", "CALL_IN_PROGRESS");

  const room = `call_${caller._id}_${Date.now().toString(36)}`;
  await livekit.createRoom(room, {
    maxParticipants: group ? 50 : 2,
    emptyTimeout: 60,
    metadata: JSON.stringify({ kind }),
  });

  const call = await Call.create({
    room,
    kind,
    status: "ringing",
    caller: caller._id,
    callee: callee || null,
    participants: [caller._id, ...recipients],
    conversation: conversation ? conversation._id : null,
    group,
    startedAt: new Date(),
    controlState: {
      muted: false,
      cameraOff: kind === "audio",
      speaker: true,
      noiseCancellation: true,
    },
  });

  const populated = await populate(call._id);
  const serialized = serialize.call(populated, caller._id);

  recipients.forEach((id) => {
    emitter.emitToUser(id, "call:incoming", { call: serialize.call(populated, id) });
  });
  emitter.emitToUser(caller._id, "call:ringing", { call: serialized });

  const timer = setTimeout(() => missCall(call._id).catch(() => {}), LIMITS.callRingSeconds * 1000);
  ringTimers.set(String(call._id), timer);

  return serialized;
}

async function missCall(callId) {
  const call = await Call.findById(callId);
  if (!call || call.status !== "ringing") return null;
  call.status = "missed";
  call.endReason = "no_answer";
  call.endedAt = new Date();
  await call.save();
  clearTimer(callId);

  const populated = await populate(call._id);
  emitToParticipants(populated, "call:ended", { reason: "missed" });

  const caller = await User.findById(call.caller).select("name").lean();
  const targets = call.callee ? [call.callee] : (call.participants || []).filter((p) => String(p) !== String(call.caller));
  notificationService
    .notifyMany({
      userIds: targets,
      actor: call.caller,
      type: "call",
      text: `📞 Missed ${call.kind} call from ${caller?.name || "someone"}`,
      ref: String(call._id),
      refType: "call",
    })
    .catch(() => {});
  return true;
}

async function token(callId, user) {
  const call = await Call.findById(callId);
  if (!call) throw ApiError.notFound("Call not found");
  if (!isParticipant(call, user._id)) throw ApiError.forbidden("Not part of this call");
  if (["ended", "rejected", "missed", "cancelled"].includes(call.status)) {
    throw ApiError.badRequest("This call has ended");
  }
  return livekit.createToken({
    identity: `${user._id}_${Date.now().toString(36)}`,
    name: user.name,
    room: call.room,
    canPublish: true,
    canSubscribe: true,
    metadata: { callId: String(call._id), kind: call.kind },
  });
}

async function accept(callId, user) {
  const call = await Call.findById(callId);
  if (!call) throw ApiError.notFound("Call not found");
  if (!isParticipant(call, user._id)) throw ApiError.forbidden("Not part of this call");
  if (String(call.caller) === String(user._id) && call.status === "ringing") {
    throw ApiError.badRequest("The caller cannot accept their own call");
  }
  if (["ended", "rejected", "missed", "cancelled"].includes(call.status)) {
    throw ApiError.badRequest("This call has ended");
  }

  if (call.status === "ringing") {
    call.status = "active";
    call.answeredAt = new Date();
    await call.save();
    clearTimer(callId);
    const populated = await populate(call._id);
    emitToParticipants(populated, "call:accepted", { answeredBy: String(user._id) });
    notificationService
      .notify({
        userId: call.caller,
        actor: user._id,
        type: "call",
        text: `${user.name} accepted your ${call.kind} call`,
        ref: String(call._id),
        refType: "call",
      })
      .catch(() => {});
  }

  const updated = await populate(callId);
  return { call: serialize.call(updated, user._id), ...(await token(callId, user)) };
}

async function join(callId, user) {
  const call = await Call.findById(callId);
  if (!call) throw ApiError.notFound("Call not found");
  if (!isParticipant(call, user._id)) throw ApiError.forbidden("Not part of this call");
  if (call.status !== "active") throw ApiError.badRequest("This call is not active");
  return { call: serialize.call(await populate(callId), user._id), ...(await token(callId, user)) };
}

async function reject(callId, user) {
  const call = await Call.findById(callId);
  if (!call) throw ApiError.notFound("Call not found");
  if (!isParticipant(call, user._id)) throw ApiError.forbidden("Not part of this call");
  if (call.status !== "ringing") throw ApiError.badRequest("This call is no longer ringing");
  if (String(call.caller) === String(user._id)) throw ApiError.badRequest("Caller cannot reject");

  call.status = "rejected";
  call.endedAt = new Date();
  call.endReason = "rejected";
  await call.save();
  clearTimer(callId);

  const populated = await populate(callId);
  emitToParticipants(populated, "call:rejected", { by: String(user._id) });
  emitter.emitToUser(call.caller, "call:ended", { call: serialize.call(populated, call.caller), reason: "rejected" });
  return true;
}

async function end(callId, user, isAdmin = false, reason = "hangup") {
  const call = await Call.findById(callId);
  if (!call) throw ApiError.notFound("Call not found");
  if (!isParticipant(call, user._id) && !isAdmin) throw ApiError.forbidden("Not part of this call");

  const wasRinging = call.status === "ringing";
  const wasActive = call.status === "active";
  if (!["ringing", "active"].includes(call.status)) return true;

  call.status = wasActive ? "ended" : "cancelled";
  call.endedAt = new Date();
  call.endReason = reason;
  if (call.answeredAt) {
    call.durationSec = Math.max(0, Math.round((call.endedAt.getTime() - new Date(call.answeredAt).getTime()) / 1000));
  }
  await call.save();
  clearTimer(callId);

  const populated = await populate(callId);
  emitToParticipants(populated, "call:ended", { reason });

  if (wasRinging && String(call.caller) === String(user._id)) {
    const caller = await User.findById(call.caller).select("name").lean();
    const targets = call.callee ? [call.callee] : (call.participants || []).filter((p) => String(p) !== String(call.caller));
    notificationService
      .notifyMany({
        userIds: targets,
        actor: call.caller,
        type: "call",
        text: `📞 Missed ${call.kind} call from ${caller?.name || "someone"}`,
        ref: String(call._id),
        refType: "call",
      })
      .catch(() => {});
  }

  setTimeout(() => livekit.deleteRoom(call.room).catch(() => {}), 3000);
  return true;
}

async function control(callId, user, control = {}) {
  const call = await Call.findById(callId);
  if (!call) throw ApiError.notFound("Call not found");
  if (!isParticipant(call, user._id)) throw ApiError.forbidden("Not part of this call");
  call.controlState = {
    muted: control.muted !== undefined ? Boolean(control.muted) : call.controlState?.muted || false,
    cameraOff: control.cameraOff !== undefined ? Boolean(control.cameraOff) : call.controlState?.cameraOff || false,
    speaker: control.speaker !== undefined ? Boolean(control.speaker) : call.controlState?.speaker !== false,
    noiseCancellation:
      control.noiseCancellation !== undefined
        ? Boolean(control.noiseCancellation)
        : call.controlState?.noiseCancellation !== false,
  };
  await call.save();
  const payload = { callId: String(call._id), by: String(user._id), state: call.controlState };
  emitter.emitToRoom(`call:${call._id}`, "call:state", payload);
  emitToParticipants(call, "call:state", { state: call.controlState, by: String(user._id) });
  return call.controlState;
}

async function get(callId, user, isAdmin = false) {
  const call = await populate(callId);
  if (!call) throw ApiError.notFound("Call not found");
  if (!isAdmin && !isParticipant(call, user._id)) throw ApiError.forbidden("Not part of this call");
  return serialize.call(call, user._id);
}

async function history(user, limit = 50) {
  const docs = await Call.find({
    $or: [{ caller: user._id }, { callee: user._id }, { participants: user._id }],
  })
    .sort({ startedAt: -1 })
    .limit(Math.min(Number(limit) || 50, 100))
    .populate("caller", "name photo role email bio active")
    .populate("callee", "name photo role email bio active")
    .lean();
  return docs.map((d) => serialize.call(d, user._id));
}

async function cleanup() {
  const ringLimit = new Date(Date.now() - (LIMITS.callRingSeconds + 15) * 1000);
  const ringing = await Call.find({ status: "ringing", startedAt: { $lt: ringLimit } }).lean();
  for (const call of ringing) await missCall(call._id);

  const staleLimit = new Date(Date.now() - 4 * 60 * 60 * 1000);
  const active = await Call.find({ status: "active", startedAt: { $lt: staleLimit } }).lean();
  for (const call of active) {
    await Call.updateOne(
      { _id: call._id },
      { $set: { status: "ended", endedAt: new Date(), endReason: "stale" } }
    );
    livekit.deleteRoom(call.room).catch(() => {});
    clearTimer(call._id);
  }
  return ringing.length + active.length;
}

module.exports = {
  start,
  token,
  accept,
  join,
  reject,
  end,
  control,
  get,
  history,
  cleanup,
  isParticipant,
  missCall,
};
