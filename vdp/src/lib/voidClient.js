// VDP's real, thin client for VOID's own separate API -- same posture
// as `hvntzClient.js`/`vagoClient.js`: no marketplace logic here,
// every real job and every real dual payout (provider + platform fee)
// comes back from VOID's own server. Used by `VoidView.jsx`, VDP's
// new district for VOID's own real "request -> match -> accept ->
// complete -> pay -> rate" loop, the exact same loop every one of
// VOID's 18+ verticals runs through.

import { sessionHeaders } from "./shieldAuth.js";

const VOID_API_URL = import.meta.env?.VITE_VOID_API_URL || "http://localhost:8793";

async function requestJson(path, options) {
  const res = await fetch(`${VOID_API_URL}${path}`, options);
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

export async function requestJob({
  verticalId, customerId, quantity, unitPrice,
}) {
  return postJson("/api/job", {
    verticalId, customerId, quantity, unitPrice,
  });
}

export async function matchProvider({ jobId, providerId }) {
  return postJson(`/api/job/${jobId}/match`, { providerId });
}

export async function acceptJob(jobId) {
  return postJson(`/api/job/${jobId}/accept`, {});
}

export async function completeJob(jobId) {
  return postJson(`/api/job/${jobId}/complete`, {});
}

export async function rateJob({ jobId, rating }) {
  return postJson(`/api/job/${jobId}/rate`, { rating });
}
