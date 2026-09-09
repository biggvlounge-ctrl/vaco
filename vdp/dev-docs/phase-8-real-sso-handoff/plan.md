# Plan — Phase 8: real cross-origin SSO handoff (direct-visit case)

## Goal
Close the real, verified gap from the ecosystem status audit: `vaco-shell`
already attaches a real Shield session token to every outbound tile
link (`?shieldToken=...`), but neither VDP nor VENVS ever read it —
every visit silently logged in as a fresh, unrelated `demo-user`
instead of the real user who clicked through.

## Design
`shieldAuth.js` gains `adoptToken(token)`: validates a caller-supplied
token against Shield's own real `GET /api/shield/session/:token` (the
same check `getCurrentSession` already does against a stored token),
and on success stores it and returns the session. `App.jsx`'s mount
effect now checks `?shieldToken=` first; if present and valid, adopts
it and scrubs the token from the visible URL via
`history.replaceState`. Falls back to the existing stored-session
check, then the manual `demo-user` login button, exactly as before.

## Explicitly NOT in this task
The VDP↔VENVS **embedded iframe** case — that's a different code path
(the iframe's own `src` carries no token) and stays a real, separate,
still-open gap. A shared cookie domain or postMessage-based handoff
for true silent SSO also isn't attempted.

## Verification approach
A real, live browser pass (Playwright against Chromium), not a
plain-Node unit test, since this is React UI behavior: Shield, V3, and
both Vite dev servers started for real; a real Shield session minted
for `real-handoff-user-1` (not `demo-user`); navigated to
`http://localhost:5174/?shieldToken=<real token>`; confirmed the page
renders "Signed in as real-handoff-user-1", never mentions `demo-user`,
and the URL no longer contains the token. A separate regression pass
in a fresh, isolated browser context (no shared localStorage) confirmed
the no-token path still shows a real login control, unchanged.

## Done when
A real Shield session minted elsewhere lands correctly in VDP with no
manual login step, confirmed in an actual browser against actual
running servers, and the corresponding README gaps are corrected.
