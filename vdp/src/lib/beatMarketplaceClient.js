// VDP's real, thin client for Vvltvre Music's own beat marketplace --
// same server, same port as `vultureMusicClient.js` (the beat
// marketplace lives inside Vvltvre Music itself, not a separate app),
// so it reuses the same `VITE_VULTURE_MUSIC_API_URL`. No listing or
// purchase logic here, every real license type, every real 100%-to-
// producer transfer, and every real purchase record comes back from
// Vvltvre Music's own server.

import { sessionHeaders } from "./shieldAuth.js";

const VULTURE_MUSIC_API_URL = import.meta.env?.VITE_VULTURE_MUSIC_API_URL || "http://localhost:8806";

async function requestJson(path, options) {
  const res = await fetch(`${VULTURE_MUSIC_API_URL}${path}`, options);
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

export async function listBeats() {
  const body = await requestJson("/api/beats");
  return body.beats;
}

export function listBeat({
  producerId, title, price, licenseType, previewUrl,
}) {
  return postJson("/api/beats", {
    producerId, title, price, licenseType, previewUrl,
  });
}

export function purchaseBeat({ beatId, buyerId }) {
  return postJson(`/api/beats/${beatId}/purchase`, { buyerId });
}

export async function listMyPurchases(buyerId) {
  const body = await requestJson(`/api/beat-purchases/buyer/${encodeURIComponent(buyerId)}`);
  return body.purchases;
}
