// VDP's real, thin client for VOKEN's own separate API -- same
// posture as `cvnvoClient.js`/`vxllageClient.js`/`vavltStvdiosClient.js`:
// no trading/auction logic lives here, every real mutation and every
// real number comes back from VOKEN's own server. Used by
// `vexMarket.js`/`vadoMarket.js`, which replace VDP's earlier
// iframe-into-VENVS embed for these two districts (see world.js's own
// header for why).
//
// VEX's own broker-account/order/compliance-gate calls moved out to
// `vexClient.js` when VEX was extracted into its own standalone app
// (see `../../../vex/README.md`) -- this client keeps only what's
// still genuinely VOKEN's: Cvltvre Card browsing, brand info, and
// VADO's auctions/fractional-ownership compliance gate.

import { sessionHeaders } from "./shieldAuth.js";

const VOKEN_API_URL = import.meta.env?.VITE_VOKEN_API_URL || "http://localhost:8794";

async function requestJson(path, options) {
  const res = await fetch(`${VOKEN_API_URL}${path}`, options);
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.error || `${path} failed (${res.status})`);
  }
  return body;
}

export async function getBrandInfo() {
  return requestJson("/api/brand");
}

export async function getComplianceGateStatus(gateName) {
  const body = await requestJson(`/api/compliance-gate/${encodeURIComponent(gateName)}`);
  return body.cleared;
}

export async function listCardsByCategory(category) {
  const body = await requestJson(`/api/cards/category/${encodeURIComponent(category)}`);
  return body.cards;
}

export async function getOpenAuctions() {
  const body = await requestJson("/api/auctions/open");
  return body.auctions;
}

export async function getAuction(auctionId) {
  return requestJson(`/api/auction/${auctionId}`);
}

export async function getCurrentDutchPrice(auctionId) {
  const body = await requestJson(`/api/auction/${auctionId}/dutch-price`);
  return body.currentPrice;
}

export async function placeBid({ auctionId, bidderId, bidAmount }) {
  return requestJson(`/api/auction/${auctionId}/bid`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...sessionHeaders() },
    body: JSON.stringify({ bidderId, bidAmount }),
  });
}
