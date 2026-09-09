// VDP local persistence — a real, separate copy of VENVS's own
// `persistence.js`, explicitly NOT for wallet or auth state. VCoin/
// VASH balances go through v3Client.js and session state goes through
// shieldAuth.js. This module is for whatever genuinely stays
// client-local (UI preferences, last-selected district, camera
// position, etc.) — nothing money- or identity-related belongs here.

const PREFIX = "vdp.local.";

export function getLocalState(key, fallback = null) {
  const raw = localStorage.getItem(PREFIX + key);
  if (raw === null) {
    return fallback;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function setLocalState(key, value) {
  localStorage.setItem(PREFIX + key, JSON.stringify(value));
}

export function clearLocalState(key) {
  localStorage.removeItem(PREFIX + key);
}
