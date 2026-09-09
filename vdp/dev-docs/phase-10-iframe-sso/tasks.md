# Tasks — Phase 10: close the embedded-iframe SSO gap

- [x] Confirmed VENVS's `adoptToken()` reads from `window.location.search`
      generically -- no iframe-specific handling needed on that side.
- [x] Appended `&shieldToken=${session.sessionToken}` to `WorldView.jsx`'s
      Publisher iframe `src`.
- [x] Updated the file's own header comment (previously described this
      as an open limitation).
- [x] Live-verified with a real before/after: no token -> zero Buy
      buttons render; real token -> Buy button appears and a real
      purchase completes through V3.
- [x] Live-verified the actual in-app flow: VDP login -> walk to
      Publisher -> enter -> real iframe `src` confirmed carrying the
      token.
- [x] Updated `README.md` (limitation note, "Not yet built", district
      count already stale from an earlier phase, fixed too).

## Next
Still one-directional (VDP -> VENVS only) and still no shared cookie
domain -- a session started fresh inside the VENVS iframe doesn't
propagate back out. Not attempted here; would need a real
postMessage-based two-way handoff or a shared cookie domain, neither
of which exists in this ecosystem.
