// VDP's real, thin client for CVNVO's own separate API -- same
// posture as `vavltStvdiosClient.js`/`vxllageClient.js`: no dating
// logic lives here, every real mutation and every real number comes
// back from CVNVO's own server.

import { sessionHeaders } from "./shieldAuth.js";

const CVNVO_API_URL = import.meta.env?.VITE_CVNVO_API_URL || "http://localhost:8798";

async function requestJson(path, options) {
  const res = await fetch(`${CVNVO_API_URL}${path}`, options);
  if (!res.ok) {
    const text = await res.text();
    let message = `${path} failed (${res.status})`;
    try { message = JSON.parse(text).error || message; } catch { /* not JSON */ }
    throw new Error(message);
  }
  return res.json();
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

// Snap Map / location privacy -- CVNVO's own real three-tier model
// (ghost-mode/my-friends/select-friends), not a plain on/off toggle.
export async function setLocationSharingPreference(userId, tier, selectedUserIds = []) {
  return requestJson("/api/location/sharing-preference", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...sessionHeaders() },
    body: JSON.stringify({ userId, tier, selectedUserIds }),
  });
}

export async function shareLocation(userId, lat, lng) {
  return requestJson("/api/location/share", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...sessionHeaders() },
    body: JSON.stringify({ userId, lat, lng }),
  });
}

export async function getVisibleLocations(viewerId) {
  const body = await requestJson(`/api/location/visible/${encodeURIComponent(viewerId)}`);
  return body.visibleLocations;
}
