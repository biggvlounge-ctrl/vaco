// VDP's real, thin client for VXLLAGE's own separate API -- same
// posture as `vavltStvdiosClient.js`: no village/room/channel logic
// lives here, every real mutation and every real number comes back
// from VXLLAGE's own server. Two real, separate apps/processes/origins.

import { sessionHeaders } from "./shieldAuth.js";

const VXLLAGE_API_URL = import.meta.env?.VITE_VXLLAGE_API_URL || "http://localhost:8796";

async function requestJson(path, options) {
  const res = await fetch(`${VXLLAGE_API_URL}${path}`, options);
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.error || `${path} failed (${res.status})`);
  }
  return body;
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
