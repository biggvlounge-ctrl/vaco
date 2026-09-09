// VEX -- a real, thin HTTP client into VOKEN's own running server.
// Same posture as every other real cross-app client in this ecosystem
// (vdp/src/lib/vokenClient.js, cvnvoClient.js, voidFetchFn, etc): VEX
// owns broker accounts, trade orders, and its own compliance gate,
// but Cvltvre Cards themselves stay VOKEN's real product -- VEX never
// keeps its own copy of card data, it calls VOKEN for it, live.

const VOKEN_API_URL = process.env.VOKEN_API_URL || 'http://localhost:8794';

async function getCultureCard(cardId) {
  const res = await fetch(`${VOKEN_API_URL}/api/card/${encodeURIComponent(cardId)}`);
  if (res.status === 404) return null;
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `getCultureCard failed (${res.status})`);
  return body;
}

async function mintAdditionalEdition({ cardId, format, ownerId }) {
  const res = await fetch(`${VOKEN_API_URL}/api/card/${encodeURIComponent(cardId)}/edition`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ format, ownerId }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `mintAdditionalEdition failed (${res.status})`);
  return body;
}

async function transferEditionOwnership({ cardId, editionNumber, format, fromOwnerId, toOwnerId }) {
  const res = await fetch(`${VOKEN_API_URL}/api/card/${encodeURIComponent(cardId)}/transfer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ editionNumber, format, fromOwnerId, toOwnerId }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `transferEditionOwnership failed (${res.status})`);
  return body;
}

async function listCardsByCategory(category) {
  const res = await fetch(`${VOKEN_API_URL}/api/cards/category/${encodeURIComponent(category)}`);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `listCardsByCategory failed (${res.status})`);
  return body.cards;
}

async function getBrandInfo() {
  const res = await fetch(`${VOKEN_API_URL}/api/brand`);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `getBrandInfo failed (${res.status})`);
  return body;
}

module.exports = {
  getCultureCard, mintAdditionalEdition, transferEditionOwnership, listCardsByCategory, getBrandInfo,
};
