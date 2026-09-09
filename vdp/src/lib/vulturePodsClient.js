// VDP's real, thin client for Vvltvre Pods' own separate API -- same
// posture as `vultureMusicClient.js`: no show/episode logic here,
// every real subscription payout and every real listen event comes
// back from Vvltvre Pods' own server. Publishing an episode is a real
// cross-app call on Vvltvre Pods' own end into Vvltvre Music (both
// services need to be running).

import { sessionHeaders } from "./shieldAuth.js";

const VULTURE_PODS_API_URL = import.meta.env?.VITE_VULTURE_PODS_API_URL || "http://localhost:8810";

async function requestJson(path, options) {
  const res = await fetch(`${VULTURE_PODS_API_URL}${path}`, options);
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

export async function createShow({
  creatorId, title, description, category, subscriptionTiers,
}) {
  return postJson("/api/shows", {
    creatorId, title, description, category, subscriptionTiers,
  });
}

export async function createEpisode({
  showId, title, episodeNumber, durationSeconds,
}) {
  return postJson("/api/episodes", {
    showId, title, episodeNumber, durationSeconds, requiresSubscription: false,
  });
}

export async function publishEpisode(episodeId) {
  return postJson(`/api/episodes/${episodeId}/publish`, {});
}

export async function listen({ episodeId, userId }) {
  return postJson(`/api/episodes/${episodeId}/listen`, { userId });
}

export async function subscribeToShow({ userId, showId, tierId }) {
  return postJson(`/api/shows/${showId}/subscribe`, { userId, tierId });
}
