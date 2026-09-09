// VDP's real, thin client for HVNTZ's own separate API -- same posture
// as `vagoClient.js`/`vacayClient.js`: no hunt logic lives here, every
// real business/location/hunt/checkpoint and every real bounty payout
// comes back from HVNTZ's own server. Used by `HvntzView.jsx`, VDP's
// new district for HVNTZ's original core mechanic -- a real scavenger
// hunt with real VCoin bounties.

import { sessionHeaders } from "./shieldAuth.js";

const HVNTZ_API_URL = import.meta.env?.VITE_HVNTZ_API_URL || "http://localhost:8792";

async function requestJson(path, options) {
  const res = await fetch(`${HVNTZ_API_URL}${path}`, options);
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

export async function registerBusiness({ name, ownerId }) {
  return postJson("/api/business", { name, ownerId });
}

export async function registerLocation({
  businessId, locationType, address, lat, lng,
}) {
  return postJson("/api/location", {
    businessId, locationType, address, lat, lng,
  });
}

export async function createHunt({
  title, sponsorId, totalBudget, intensityLevel,
}) {
  return postJson("/api/hunt", {
    title, sponsorId, totalBudget, intensityLevel,
  });
}

export async function addCheckpoint({
  huntId, businessId, locationId, bountyAmount, hostFee, clue,
}) {
  return postJson(`/api/hunt/${huntId}/checkpoint`, {
    businessId, locationId, bountyAmount, hostFee, clue,
  });
}

export async function checkInAtCheckpoint({ huntId, checkpointId, userId }) {
  return postJson(`/api/hunt/${huntId}/checkin`, { checkpointId, userId });
}

export async function getHunt(huntId) {
  return requestJson(`/api/hunt/${huntId}`);
}
