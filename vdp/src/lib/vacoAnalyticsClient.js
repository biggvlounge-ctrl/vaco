// VDP's real, thin client for VACO Analytics' own separate API -- same
// posture as every other district client: no metrics logic here,
// every real number comes back from VACO Analytics' own server.

const VACO_ANALYTICS_API_URL = import.meta.env?.VITE_VACO_ANALYTICS_API_URL || "http://localhost:8790";

async function requestJson(path, options) {
  const res = await fetch(`${VACO_ANALYTICS_API_URL}${path}`, options);
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.error || `${path} failed (${res.status})`);
  }
  return body;
}

export async function getDashboard() {
  const body = await requestJson("/api/dashboard");
  return body.apps;
}
