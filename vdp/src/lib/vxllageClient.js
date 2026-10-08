// VDP's real, thin client for VXLLAGE's own separate API -- same
// posture as `vavltStvdiosClient.js`: no village/room/channel logic
// lives here, every real mutation and every real number comes back
// from VXLLAGE's own server. Two real, separate apps/processes/origins.

import { sessionHeaders } from "./shieldAuth.js";

const VXLLAGE_API_URL = import.meta.env?.VITE_VXLLAGE_API_URL || "http://localhost:8796";

async function requestJson(path, options) {
  const res = await fetch(`${VXLLAGE_API_URL}${path}`, options);
  if (!res.ok) {
    const text = await res.text();
    let message = `${path} failed (${res.status})`;
    try { message = JSON.parse(text).error || message; } catch { /* not JSON */ }
    throw new Error(message);
  }
  return res.json();
}

export async function listVillages() {
  const body = await requestJson("/api/villages");
  return body.villages;
}

export async function createVillage({ name, ownerId }) {
  return requestJson("/api/villages", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...sessionHeaders() },
    body: JSON.stringify({ name, ownerId }),
  });
}

export async function joinVillage(villageId, userId) {
  return requestJson(`/api/villages/${villageId}/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...sessionHeaders() },
    body: JSON.stringify({ userId }),
  });
}

export async function createVillageRoom({ villageId, roomType, ownerId, scheduledRecurrence = null }) {
  return requestJson("/api/village-rooms", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...sessionHeaders() },
    body: JSON.stringify({ villageId, roomType, ownerId, scheduledRecurrence }),
  });
}

export async function listVillageRooms(villageId) {
  const body = await requestJson(`/api/villages/${villageId}/rooms`);
  return body.rooms;
}

export async function joinRoom(roomId, userId) {
  return requestJson(`/api/village-rooms/${roomId}/join`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...sessionHeaders() },
    body: JSON.stringify({ userId }),
  });
}

export async function leaveRoom(roomId, userId) {
  return requestJson(`/api/village-rooms/${roomId}/leave`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...sessionHeaders() },
    body: JSON.stringify({ userId }),
  });
}

export async function createChannel({ villageId, name }) {
  return requestJson("/api/channels", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...sessionHeaders() },
    body: JSON.stringify({ villageId, name }),
  });
}

export async function listChannels(villageId) {
  const body = await requestJson(`/api/villages/${villageId}/channels`);
  return body.channels;
}

export async function getMessages(channelId) {
  const body = await requestJson(`/api/channels/${channelId}/messages`);
  return body.messages;
}

export async function postMessage(channelId, userId, text) {
  return requestJson(`/api/channels/${channelId}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...sessionHeaders() },
    body: JSON.stringify({ userId, text }),
  });
}

// -- Village Shop: boost + the cross-village avatar cosmetic shop --
// VXLLAGE's own real endpoints (`server.js`'s "Village Shop: boost +
// cosmetics" section) -- closes VDP's own README gap ("Village boost/
// cosmetics purchases... aren't exposed inside this district's own
// UI"), the same real-number-not-invented discipline every other
// client function in this file already follows: every price/level
// threshold below comes back from VXLLAGE's own response, never
// guessed at here.

export async function boostVillage(villageId, boosterId, amountVCoin) {
  return requestJson(`/api/villages/${villageId}/boost`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...sessionHeaders() },
    body: JSON.stringify({ boosterId, amountVCoin }),
  });
}

export async function getBoostStatus(villageId) {
  return requestJson(`/api/villages/${villageId}/boost`);
}

export async function getAvatarCosmeticCatalog() {
  const body = await requestJson("/api/avatar-cosmetics/catalog");
  return body.catalog;
}

export async function purchaseAvatarCosmetic(userId, itemId) {
  return requestJson("/api/avatar-cosmetics/purchase", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...sessionHeaders() },
    body: JSON.stringify({ userId, itemId }),
  });
}

export async function equipAvatarCosmetic(userId, itemId) {
  return requestJson("/api/avatar-cosmetics/equip", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...sessionHeaders() },
    body: JSON.stringify({ userId, itemId }),
  });
}

export async function unequipAvatarCosmetic(userId) {
  return requestJson("/api/avatar-cosmetics/unequip", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...sessionHeaders() },
    body: JSON.stringify({ userId }),
  });
}

export async function getAvatarProfile(userId) {
  return requestJson(`/api/users/${encodeURIComponent(userId)}/avatar-profile`);
}
