// VDP's real, thin client for CVNVO's own separate API -- same
// posture as `vavltStvdiosClient.js`/`vxllageClient.js`: no dating
// logic lives here, every real mutation and every real number comes
// back from CVNVO's own server.

import { sessionHeaders } from "./shieldAuth.js";

const CVNVO_API_URL = import.meta.env?.VITE_CVNVO_API_URL || "http://localhost:8798";

async function requestJson(path, options) {
  const res = await fetch(`${CVNVO_API_URL}${path}`, options);
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.error || `${path} failed (${res.status})`);
  }
  return body;
}

export async function checkInAtVenue(userId, venueId, isVisibleToOthersAtVenue) {
  return requestJson("/api/barbuddy/check-in", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...sessionHeaders() },
    body: JSON.stringify({ userId, venueId, isVisibleToOthersAtVenue }),
  });
}

export async function checkOutOfVenue(userId, venueId) {
  return requestJson("/api/barbuddy/check-out", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...sessionHeaders() },
    body: JSON.stringify({ userId, venueId }),
  });
}

export async function getVisibleUsersAtVenue(venueId) {
  const body = await requestJson(`/api/barbuddy/venues/${encodeURIComponent(venueId)}`);
  return body.visibleUsers;
}

export async function recordProximityEvent({ userId, otherUserId, lat, lng, otherLat, otherLng }) {
  return requestJson("/api/proximity", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...sessionHeaders() },
    body: JSON.stringify({
      userId, otherUserId, lat, lng, otherLat, otherLng,
    }),
  });
}

export async function getProximityFeed(userId) {
  const body = await requestJson(`/api/proximity/${encodeURIComponent(userId)}`);
  return body.feed;
}

export async function sendFlashNote(senderId, recipientId, text) {
  return requestJson("/api/flash-notes", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...sessionHeaders() },
    body: JSON.stringify({ senderId, recipientId, text }),
  });
}
