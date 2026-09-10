// VENVS wallet client — per CLAUDE.md §0.1: "VENVS's entire wallet...
// currently lives in client-side localStorage with no backend at
// all... it's specifically 'VENVS's wallet needs to become a client
// of V3's ledger API,' not an independently designed backend. Don't
// build VENVS its own accounting system; build it as a consumer of
// V3's /api/vcoin/* and /api/vash/* routes."
//
// V3's real source and its exact API surface ("see V3's CLAUDE.md")
// aren't available in this session. This client is written against a
// real, inferred, minimal ledger contract, backed in dev by
// venvs-mock-backend/server.js. No VCoin/net-worth math happens in
// this module or in VENVS at all — every number comes from the
// ledger service, which is the entire point of §0.1.

import { sessionHeaders } from "./shieldAuth.js";

const V3_API_URL = import.meta.env?.VITE_V3_API_URL || "http://localhost:8811";

export async function getVCoinBalance(userId) {
  if (!userId) {
    throw new Error("getVCoinBalance requires a userId");
  }
  const res = await fetch(`${V3_API_URL}/api/vcoin/balance/${encodeURIComponent(userId)}`);
  if (!res.ok) {
    throw new Error(`getVCoinBalance failed (${res.status})`);
  }
  return res.json();
}

export async function transferVCoin({ fromUserId, toUserId, amount, reason }) {
  const res = await fetch(`${V3_API_URL}/api/vcoin/transfer`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...sessionHeaders() },
    body: JSON.stringify({ fromUserId, toUserId, amount, reason }),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.error || `transferVCoin failed (${res.status})`);
  }
  return body;
}

export async function getVCoinTransactions(userId) {
  if (!userId) {
    throw new Error("getVCoinTransactions requires a userId");
  }
  const res = await fetch(`${V3_API_URL}/api/vcoin/transactions/${encodeURIComponent(userId)}`);
  if (!res.ok) {
    throw new Error(`getVCoinTransactions failed (${res.status})`);
  }
  return res.json();
}

export async function cashOutToVash({ userId, vcoinAmount }) {
  const res = await fetch(`${V3_API_URL}/api/vash/cashout`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...sessionHeaders() },
    body: JSON.stringify({ userId, vcoinAmount }),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.error || `cashOutToVash failed (${res.status})`);
  }
  return body;
}

export async function getVashBalance(userId) {
  if (!userId) {
    throw new Error("getVashBalance requires a userId");
  }
  const res = await fetch(`${V3_API_URL}/api/vash/balance/${encodeURIComponent(userId)}`);
  if (!res.ok) {
    throw new Error(`getVashBalance failed (${res.status})`);
  }
  return res.json();
}
