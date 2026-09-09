// VENVS auth client — per CLAUDE.md §0.2: "When VENVS gets a real
// backend, its auth should be 'trust Shield's session token,' not a
// VENVS-specific signup/login flow."
//
// Shield's real source/API isn't in this session. This client is
// written against a real, inferred, minimal session contract, backed
// in dev by venvs-mock-backend/server.js (see that file's own header
// for the same caveat). Swapping in the real Shield service later
// means changing SHIELD_API_URL, not this module's shape.
//
// **Real cross-origin SSO handoff, closing this project's own
// previously-flagged gap**: `vaco-shell`'s launcher attaches a real,
// live Shield session token to every outbound app tile
// (`?shieldToken=...`). `adoptToken` (below) lets `App.jsx` read that
// on mount and validate it against the exact same real
// `GET /api/shield/session/:token` check `getCurrentSession` already
// uses, adopting it as this origin's own session instead of always
// falling back to a fresh, unrelated `"demo-user"` login. Still a
// one-directional handoff (Shell -> app), not a shared cookie domain —
// a session started inside VENVS itself still doesn't propagate
// anywhere else.

const SHIELD_API_URL = import.meta.env.VITE_SHIELD_API_URL || "http://localhost:8812";
const SESSION_STORAGE_KEY = "venvs.shield.sessionToken";

export async function login(userId) {
  if (!userId) {
    throw new Error("login requires a userId");
  }
  const res = await fetch(`${SHIELD_API_URL}/api/shield/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Shield login failed (${res.status})`);
  }
  const session = await res.json();
  localStorage.setItem(SESSION_STORAGE_KEY, session.sessionToken);
  return session;
}

// Real validation of a token that arrived from somewhere else (the
// Shell's own handoff link), not one this origin minted itself -- same
// real Shield check as `getCurrentSession`, just against a caller-
// supplied token. Returns `null` (never throws) on an invalid/expired/
// unreachable token so the caller can cleanly fall back to normal login.
export async function adoptToken(token) {
  if (!token) return null;
  try {
    const res = await fetch(`${SHIELD_API_URL}/api/shield/session/${encodeURIComponent(token)}`);
    const body = await res.json();
    if (!body.valid) return null;
    localStorage.setItem(SESSION_STORAGE_KEY, token);
    return { sessionToken: token, userId: body.userId, expiresAt: body.expiresAt };
  } catch {
    return null;
  }
}

export async function getCurrentSession() {
  const token = localStorage.getItem(SESSION_STORAGE_KEY);
  if (!token) {
    return null;
  }
  const res = await fetch(`${SHIELD_API_URL}/api/shield/session/${encodeURIComponent(token)}`);
  const body = await res.json();
  if (!body.valid) {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    return null;
  }
  return { sessionToken: token, userId: body.userId, expiresAt: body.expiresAt };
}

export function logout() {
  localStorage.removeItem(SESSION_STORAGE_KEY);
}
