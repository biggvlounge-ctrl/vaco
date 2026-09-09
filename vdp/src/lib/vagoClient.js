// VDP's real, thin client for VAGO's own separate API -- same posture
// as `vokenClient.js`/`cvnvoClient.js`/`vxllageClient.js`: no game
// logic lives here, every real mutation (session stake, mine reveal,
// cash-out) and every real number comes back from VAGO's own server.
// Used by `VagoView.jsx`, VDP's new district for VAGO's Originals
// (Mines) casino game -- see world.js's own header for the new
// district entry.

import { sessionHeaders } from "./shieldAuth.js";

const VAGO_API_URL = import.meta.env?.VITE_VAGO_API_URL || "http://localhost:8795";

async function requestJson(path, options) {
  const res = await fetch(`${VAGO_API_URL}${path}`, options);
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

export async function startCasinoSession({ userId, stakeAmount }) {
  return postJson("/api/casino/sessions", {
    userId, gameType: "originals", currency: "vcoin", stakeAmount, amoeEntryUsed: false,
  });
}

export async function startMinesRound({ sessionId, clientSeed, minesCount }) {
  return postJson("/api/casino/mines/start", { sessionId, clientSeed, minesCount });
}

export async function revealMinesTile({ roundId, tileIndex }) {
  return postJson(`/api/casino/mines/${roundId}/reveal`, { tileIndex });
}

export async function cashOutMines({ roundId }) {
  return postJson(`/api/casino/mines/${roundId}/cash-out`, {});
}
