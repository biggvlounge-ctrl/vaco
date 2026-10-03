// VDP's real, thin client for DREAMS' own separate API -- same posture
// as `vagoClient.js`/`vxllageClient.js`: no screen/revenue logic lives
// here, every real number comes back from DREAMS' own server. DREAMS
// is the ecosystem's real ad/screen network (dreams/server.js) --
// real screen registration, a real self-serve advertiser flow, real
// per-screen revenue tracking. This is the "screen living spaces"
// city tier: a player-owned ad screen placed somewhere in VDP's
// world, not housing.

import { sessionHeaders } from "./shieldAuth.js";

const DREAMS_API_URL = import.meta.env?.VITE_DREAMS_API_URL || "http://localhost:8814";

async function requestJson(path, options) {
  const res = await fetch(`${DREAMS_API_URL}${path}`, options);
  if (!res.ok) {
    const text = await res.text();
    let message = `${path} failed (${res.status})`;
    try { message = JSON.parse(text).error || message; } catch { /* not JSON */ }
    throw new Error(message);
  }
  return res.json();
}

export async function registerScreen({ screenOwnerId, locationName, locationAddress }) {
  return requestJson("/api/screens", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...sessionHeaders() },
    body: JSON.stringify({ screenOwnerId, locationName, locationAddress }),
  });
}

export async function listScreens() {
  const body = await requestJson("/api/screens");
  return body.screens;
}

export async function getScreen(screenId) {
  return requestJson(`/api/screens/${screenId}`);
}

export async function getScreenRevenue(screenId) {
  return requestJson(`/api/screens/${screenId}/revenue`);
}
