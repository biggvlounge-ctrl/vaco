# Tasks — Phase 8: real cross-origin SSO handoff (direct-visit case)

- [x] `src/lib/shieldAuth.js` — add `adoptToken(token)`.
- [x] `src/App.jsx` — mount effect reads `?shieldToken=`, adopts it via
      `adoptToken`, scrubs the URL on success, falls back to the
      existing stored-session check otherwise.
- [x] Start Shield + V3 + both Vite dev servers for real.
- [x] Mint a real Shield session for a non-demo userId.
- [x] Real Playwright pass: handoff URL lands signed in as the real
      user, URL cleaned, zero page errors.
- [x] Real Playwright regression pass (isolated browser context):
      no-token load still shows a real login control.
- [x] Shut down all test servers.
- [x] Update `vdp/README.md` and `venvs/README.md` — precise language
      distinguishing the now-closed direct-visit case from the still-
      open embedded-iframe case; corrected a stale claim about
      `venvs-mock-backend` still being the default.
- [x] Update `vaco-shell/README.md` to reflect the receiving end is
      now real.
- [x] Write this plan/tasks pair.

## Next
The embedded-iframe SSO case (VDP showing VENVS inline) is still real,
open work — not attempted here.
