// VDP's real, thin client for Vvltvre Flix's own separate API -- same
// posture as `vulturePodsClient.js`: no title/subscription logic here,
// every real acquisition payout, subscription fee, and stream-limit
// check comes back from Vvltvre Flix's own server.

import { sessionHeaders } from "./shieldAuth.js";

const VULTURE_FLIX_API_URL = import.meta.env?.VITE_VULTURE_FLIX_API_URL || "http://localhost:8807";

async function requestJson(path, options) {
  const res = await fetch(`${VULTURE_FLIX_API_URL}${path}`, options);
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.error || `${path} failed (${res.status})`);
  }
  return body;
}

function postJson(path, payload) {
  return requestJson(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...sessionHeaders() },
    body: JSON.stringify(payload),
  });
}

export async function getCatalog() {
  const body = await requestJson("/api/catalog");
  return body.catalog;
}

export async function acquireTitle({ creatorId, title, type }) {
  return postJson("/api/titles", {
    creatorId, title, type, acquisitionFee: 40, exclusivityWindowDays: 90,
  });
}

export async function markStreaming(titleId) {
  return postJson(`/api/titles/${titleId}/streaming`, {});
}

export async function subscribe({ userId, tier }) {
  return postJson("/api/subscriptions", { userId, tier });
}

export async function watchTitle({ userId, titleId }) {
  return postJson(`/api/titles/${titleId}/watch`, { userId });
}

export async function startStream({ userId, titleId }) {
  return postJson(`/api/titles/${titleId}/stream`, { userId });
}

export async function endStream(sessionId) {
  return postJson(`/api/streams/${sessionId}/end`, {});
}
