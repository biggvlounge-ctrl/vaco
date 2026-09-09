// VDP's real, thin client for VENVM's own separate API -- same
// posture as `vultureFlixClient.js`: no script-generation or
// production-pipeline logic here, every real completion call, every
// real reformat computation, and every real stage transition comes
// back from VENVM's own server.

import { sessionHeaders } from "./shieldAuth.js";

const VENVM_API_URL = import.meta.env?.VITE_VENVM_API_URL || "http://localhost:8813";

async function requestJson(path, options) {
  const res = await fetch(`${VENVM_API_URL}${path}`, options);
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

export async function reformat({ sourceDurationSeconds, sourceAspectRatio, platforms }) {
  const body = await postJson("/api/reformat", { sourceDurationSeconds, sourceAspectRatio, platforms });
  return body.reformats;
}

export function submitScriptRequest({ requesterApp, brief, platform }) {
  return postJson("/api/scripts", { requesterApp, brief, platform });
}

export function generateScript(requestId) {
  return postJson(`/api/scripts/${requestId}/generate`, {});
}

export function createProductionJob({ requesterApp, scriptRequestId, title }) {
  return postJson("/api/production-jobs", { requesterApp, scriptRequestId, title });
}

export function advanceToStoryboard(jobId, storyboard) {
  return postJson(`/api/production-jobs/${jobId}/storyboard`, { storyboard });
}

export function queueRender(jobId) {
  return postJson(`/api/production-jobs/${jobId}/queue-render`, {});
}

export function markRendered(jobId) {
  return postJson(`/api/production-jobs/${jobId}/mark-rendered`, {});
}
