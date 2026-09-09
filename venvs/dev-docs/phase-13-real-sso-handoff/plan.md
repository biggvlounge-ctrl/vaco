# Plan — Phase 13: real cross-origin SSO handoff (direct-visit case)

## Goal
Same real gap, same fix, as `../vdp/dev-docs/phase-8-real-sso-handoff/`
— `vaco-shell` already sends a real Shield token on every tile link;
this app never read it. See that doc for the full design rationale
(identical mechanism, applied here to VENVS's own separate origin).

## Design
`src/lib/shieldAuth.js` gains `adoptToken(token)`; `src/App.jsx`'s
mount effect reads `?shieldToken=`, adopts it, scrubs the URL, falls
back to the existing stored-session/`demo-user` flow otherwise.

## Explicitly NOT in this task
The VDP↔VENVS embedded-iframe SSO case — a different, still-open code
path (the iframe's `src` carries no token).

## Verification approach
Same live Playwright pass as VDP's, run against both apps together in
one script: a real Shield session for `real-handoff-user-1`, navigated
to `http://localhost:5173/?shieldToken=<real token>`, confirmed signed
in as the real user with the token scrubbed from the URL, plus an
isolated-context regression check that the no-token path is unchanged.

## Done when
Same bar as VDP's: a real Shield session minted elsewhere lands
correctly with no manual login, confirmed in an actual browser.
