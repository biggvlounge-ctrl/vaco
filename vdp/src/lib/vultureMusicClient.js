// VDP's real, thin client for Vvltvre Music's own separate API -- same
// posture as `voidClient.js`/`hvntzClient.js`: no release logic here,
// every real distribution fee and every real streaming-revenue payout
// comes back from Vvltvre Music's own server.

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

export async function submitRelease({ artistId, title, format, targetPlatforms }) {
  return postJson("/api/releases", {
    artistId, title, format, targetPlatforms,
  });
}

export async function markDistributing(releaseId) {
  return postJson(`/api/releases/${releaseId}/distributing`, {});
}

export async function markLive(releaseId) {
  return postJson(`/api/releases/${releaseId}/live`, {});
}

export async function reportStreamingRevenue({ releaseId, amount, source }) {
  return postJson(`/api/releases/${releaseId}/revenue`, { amount, source });
}

export async function getArtistSummary(artistId) {
  return requestJson(`/api/artists/${artistId}/summary`);
}
