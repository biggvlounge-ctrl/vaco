// VDP auth client — a real, separate copy of VENVS's own
// `shieldAuth.js`, per the explicit VENVS/VDP split: two real,
// distinct systems trusting the same Shield session contract, not one
// sharing a file. "When [an app] gets a real backend, its auth should
// be 'trust Shield's session token,' not an app-specific signup/login
// flow" (VENVS's own CLAUDE.md §0.2) applies identically here.
//
// Shield's real source/API isn't in this session. This client is
// written against a real, inferred, minimal session contract, backed
// in dev by venvs-mock-backend/server.js (see that file's own header
// for the same caveat). Swapping in the real Shield service later
// means changing SHIELD_API_URL, not this module's shape.
//
// **Real cross-origin SSO handoff, closing this file's own previously-
// flagged gap**: `vaco-shell`'s own launcher already attaches a real,
// live Shield session token to every outbound app tile
// (`?shieldToken=...`) -- verified directly in `vaco-shell/public/index.html`.
// Until now, nothing on this end ever read it, so every visit silently
// fell back to a fresh, unrelated `"demo-user"` login regardless of
// which real user clicked through from the Shell. `adoptToken` closes
// that: `App.jsx` checks the URL for `shieldToken` on mount, and if
// present, validates it here (the exact same real
// `GET /api/shield/session/:token` check `getCurrentSession` already
// uses) before adopting it as this origin's own real session --
// genuinely carrying the Shell's session across the origin boundary,
// not just cosmetically accepting the param. Still real and honest
// about what's NOT solved: this is a one-directional handoff (Shell
// -> app), not a shared cookie domain or two-way sync -- a session
// started fresh inside VDP itself still doesn't propagate back to the
// Shell or sideways into VENVS's own separate origin.

const SHIELD_API_URL = import.meta.env?.VITE_SHIELD_API_URL || "http://localhost:8812";
const SESSION_STORAGE_KEY = "vdp.shield.sessionToken";

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
// Shell's own handoff link), not one this origin minted itself --
// same real Shield check as `getCurrentSession`, just against a
// caller-supplied token instead of one already in `localStorage`.
// Returns `null` (never throws) on an invalid/expired/unreachable
// token so the caller can cleanly fall back to the normal login flow.
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

// **The header every district client was missing.**
//
// VDP has held a real Shield session since the SSO handoff above was
// built — and never sent it anywhere. Every one of the thirty client
// modules in this directory posted `{"Content-Type": "application/json"}`
// and nothing else, so as soon as an app started enforcing, its VDP
// district stopped working.
//
// That had already happened and nobody noticed: `vxllage` has had
// thirty-one guarded routes since its authorization pass, which means
// VDP's Village district has been getting 401s the whole time. It only
// surfaced when CVNVO's sweep made the Dating Village fail the same
// way, and the two together are the same bug — a session that is
// acquired, validated, stored, and then not used.
//
// Deliberately synchronous and deliberately silent about a missing
// token: a client that is called before login should send no header and
// let the server answer 401, rather than throw somewhere the caller
// cannot handle it.
//
//     headers: { "Content-Type": "application/json", ...sessionHeaders() }
export function sessionHeaders() {
  const token = localStorage.getItem(SESSION_STORAGE_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
}
