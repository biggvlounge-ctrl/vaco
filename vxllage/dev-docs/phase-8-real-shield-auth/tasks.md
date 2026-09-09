# Tasks — Phase 8: real Shield session auth

- [x] Re-read `venvs`/`vdp`'s own real `shieldAuth.js` clients to match
      the exact same session-check contract.
- [x] Count every mutating route in `server.js` (31 `app.post`, zero
      `app.put`/`app.delete`).
- [x] Write `lib/shieldAuth.js` — `verifySessionToken`,
      `requireSession()` middleware (401 missing header, 401 invalid/
      expired, 502 Shield unreachable, `req.sessionUserId` on success).
- [x] Apply `requireSession()` to all 31 mutating routes via a
      mechanical sed pass; grep-confirmed all 31 carry it, zero GET
      routes do.
- [x] 5 plain-Node checks against the middleware (real local HTTP
      stand-in for Shield) — all passing.
- [x] Live pass: real Shield + VXLLAGE started, a tokenless request
      rejected, a fabricated token rejected by Shield's own real
      validation, a real Shield session carrying a real post through
      to creation.
- [x] Shut down all test servers.
- [x] Update `vxllage/README.md` — new Phase 8 bullets in "What's
      here", a new "Verified" paragraph, and the resolved item
      replaced with the narrower, honestly-scoped identity-matching
      follow-up in "Not yet built".
- [x] Write this plan/tasks pair.

## Next
Real per-route identity matching (session `userId` vs. each route's
own acting-user body field) remains a real, separate, more careful
follow-up -- not attempted here, flagged directly in both the README
and `lib/shieldAuth.js`'s own header.
