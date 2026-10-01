// VDP's real, thin client for VACO Analytics' own separate API -- same
// posture as every other district client: no metrics logic here,
// every real number comes back from VACO Analytics' own server.

const VACO_ANALYTICS_API_URL = import.meta.env?.VITE_VACO_ANALYTICS_API_URL || "http://localhost:8790";

async function requestJson(path, options) {
  const res = await fetch(`${VACO_ANALYTICS_API_URL}${path}`, options);
  if (!res.ok) {
    const text = await res.text();
    let message = `${path} failed (${res.status})`;
    try { message = JSON.parse(text).error || message; } catch { /* not JSON */ }
    throw new Error(message);
  }
  return res.json();
}

export async function getDashboard() {
  const body = await requestJson("/api/dashboard");
  return body.apps;
}
