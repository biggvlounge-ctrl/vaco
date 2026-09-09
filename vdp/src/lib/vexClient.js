// VDP's real, thin client for the standalone VEX app (extracted from
// VOKEN — see `../../../vex/README.md`). Same posture as
// `vokenClient.js`: no brokerage logic lives here, every real mutation
// and every real number comes back from VEX's own server. Card
// browsing and brand info stay on `vokenClient.js` — VOKEN still owns
// Cvltvre Cards themselves; only the broker account/order/compliance-
// gate calls moved here.

import { sessionHeaders } from "./shieldAuth.js";

const VEX_API_URL = import.meta.env?.VITE_VEX_API_URL || "http://localhost:8816";

async function requestJson(path, options) {
  const res = await fetch(`${VEX_API_URL}${path}`, options);
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.error || `${path} failed (${res.status})`);
  }
  return body;
}

export async function getVexComplianceGateStatus() {
  const body = await requestJson("/api/compliance-gate/vex-brokerage");
  return body.cleared;
}

export async function openBrokerAccount(userId) {
  return requestJson("/api/account", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...sessionHeaders() },
    body: JSON.stringify({ userId }),
  });
}

export async function placeVexOrder({ accountId, cardId, orderType, quantity, pricePerUnit }) {
  return requestJson("/api/order", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...sessionHeaders() },
    body: JSON.stringify({
      accountId, cardId, orderType, quantity, pricePerUnit,
    }),
  });
}
