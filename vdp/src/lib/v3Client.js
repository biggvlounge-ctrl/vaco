// VDP wallet client — a real, separate copy of VENVS's own
// `v3Client.js`, per the explicit VENVS/VDP split: two real, distinct
// systems, one shared V3 ledger, not one shared file. Same real
// contract as VENVS's own copy: no VCoin/net-worth math happens in
// this module or anywhere in VDP -- every number comes from the
// ledger service. This is the actual point of a shared wallet across
// two separate apps: the same `userId`'s balance is genuinely the
// same number in both VENVS and VDP, because both are real clients of
// the same V3 service, not because they share code.
//
// V3's real source and its exact API surface ("see V3's CLAUDE.md")
// aren't available in this session. This client is written against a
// real, inferred, minimal ledger contract, backed in dev by
// venvs-mock-backend/server.js.

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
