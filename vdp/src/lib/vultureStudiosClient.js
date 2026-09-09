// VDP's real, thin client for Vvltvre Studios' own separate API --
// same posture as `vultureMusicClient.js`/`vultureFlixClient.js`: no
// financing/production/distribution logic here, every real investor
// transfer, every real status transition, and every real cross-app
// distribution hand-off (into Vvltvre Flix for film/tv, into Vvltvre
// Music for music/podcast) comes back from Vvltvre Studios' own
// server.

import { sessionHeaders } from "./shieldAuth.js";

const VULTURE_STUDIOS_API_URL = import.meta.env?.VITE_VULTURE_STUDIOS_API_URL || "http://localhost:8815";

async function requestJson(path, options) {
  const res = await fetch(`${VULTURE_STUDIOS_API_URL}${path}`, options);
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
    body: JSON.stringify(payload || {}),
  });
}

export async function listProjects() {
  const body = await requestJson("/api/projects");
  return body.projects;
}

export function getProject(projectId) {
  return requestJson(`/api/projects/${projectId}`);
}

export function getProjectEquity(projectId) {
  return requestJson(`/api/projects/${projectId}/equity`);
}

export function greenlightProject({
  title, medium, synopsis, budgetRequested,
}) {
  return postJson("/api/projects", {
    title, medium, synopsis, budgetRequested,
  });
}

export function investInProject({ projectId, investorId, amount }) {
  return postJson(`/api/projects/${projectId}/invest`, { investorId, amount });
}

export function startProduction(projectId) {
  return postJson(`/api/projects/${projectId}/start-production`);
}

export function completeProject(projectId, finalAssetUrl) {
  return postJson(`/api/projects/${projectId}/complete`, { finalAssetUrl: finalAssetUrl || null });
}

export function distributeProject(projectId) {
  return postJson(`/api/projects/${projectId}/distribute`);
}

export function reportProjectRevenue(projectId, { amount, source }) {
  return postJson(`/api/projects/${projectId}/revenue`, { amount, source });
}
