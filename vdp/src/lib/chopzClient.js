// VDP's real, thin client for CHOPZ's own separate API -- same posture
// as every other `-embed` client (`vagoClient.js`, `voidClient.js`,
// etc.): no video logic here, every real video record and every real
// linked-product verification comes back from CHOPZ's own server.

import { sessionHeaders } from "./shieldAuth.js";

const CHOPZ_API_URL = import.meta.env?.VITE_CHOPZ_API_URL || "http://localhost:8800";

async function requestJson(path, options) {
  const res = await fetch(`${CHOPZ_API_URL}${path}`, options);
  if (!res.ok) {
    const text = await res.text();
    let message = `${path} failed (${res.status})`;
    try { message = JSON.parse(text).error || message; } catch { /* not JSON */ }
    throw new Error(message);
  }
  return res.json();
}

function postJson(path, payload) {
  return requestJson(path, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...sessionHeaders() },
    body: JSON.stringify(payload),
  });
}

export async function createVideo({ creatorId, mediaUrl, linkedProductId }) {
  return postJson("/chopz/videos", { creatorId, mediaUrl, linkedProductId });
}

export async function verifyLinkedProduct(videoId) {
  return postJson(`/chopz/videos/${videoId}/verify-linked-product`, {});
}
