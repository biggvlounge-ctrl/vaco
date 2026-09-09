// VDP's real, thin client for Vavlt Stvdios' own separate API — same
// posture as `v3Client.js`: no channel/session/chat/tip logic lives
// here, every real mutation and every real number comes back from
// Vavlt Stvdios' own server. VDP and Vavlt Stvdios are two genuinely
// separate apps/processes/origins (like the VDP/VENVS split), so this
// is a real HTTP client, not a shared store or a shared module.

import { sessionHeaders } from "./shieldAuth.js";

const VAVLT_STVDIOS_API_URL = import.meta.env?.VITE_VAVLT_STVDIOS_API_URL || "http://localhost:8808";

async function requestJson(path, options) {
  const res = await fetch(`${VAVLT_STVDIOS_API_URL}${path}`, options);
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.error || `${path} failed (${res.status})`);
  }
  return body;
}

export async function createChannel({ ownerId, groupingType, name, streamUrl }) {
  return requestJson("/api/channels", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...sessionHeaders() },
    body: JSON.stringify({ ownerId, groupingType, name, streamUrl }),
  });
}

export async function goLive(channelId) {
  return requestJson(`/api/channels/${channelId}/live`, { method: "POST" });
}

export async function createScreenSession({ sessionType, ownerId, channelIds }) {
  return requestJson("/api/screen-sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...sessionHeaders() },
    body: JSON.stringify({ sessionType, ownerId, channelIds }),
  });
}

export async function getScreenSessionWithChannels(sessionId) {
  return requestJson(`/api/screen-sessions/${sessionId}`);
}

export async function getOwnerScreenSessions(ownerId) {
  const body = await requestJson(`/api/owners/${encodeURIComponent(ownerId)}/screen-sessions`);
  return body.sessions;
}

export async function getMessages(channelId) {
  const body = await requestJson(`/api/channels/${channelId}/chat`);
  return body.messages;
}

export async function postMessage(channelId, { userId, text }) {
  return requestJson(`/api/channels/${channelId}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...sessionHeaders() },
    body: JSON.stringify({ userId, text }),
  });
}

export async function tipChannel(channelId, { tipperId, recipientPersonId, amountVCoin }) {
  return requestJson(`/api/channels/${channelId}/tips`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...sessionHeaders() },
    body: JSON.stringify({ tipperId, recipientPersonId, amountVCoin }),
  });
}
