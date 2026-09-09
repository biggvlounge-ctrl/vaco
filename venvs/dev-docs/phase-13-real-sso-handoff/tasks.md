# Tasks — Phase 13: real cross-origin SSO handoff (direct-visit case)

- [x] `src/lib/shieldAuth.js` — add `adoptToken(token)`.
- [x] `src/App.jsx` — mount effect reads `?shieldToken=`, adopts it,
      scrubs the URL, falls back to the existing flow otherwise.
- [x] Real Playwright pass (shared script with VDP's own phase-8):
      handoff URL lands signed in as the real user, URL cleaned, zero
      page errors.
- [x] Real Playwright regression pass: no-token load unchanged.
- [x] Update `venvs/README.md` — precise language distinguishing the
      now-closed direct-visit case from the still-open embedded-iframe
      case; corrected a stale claim about `venvs-mock-backend` still
      being the default (it isn't — this app was cut over earlier).
- [x] Write this plan/tasks pair.

## Next
The embedded-iframe SSO case is still real, open work.
