# Tasks — Phase 12: real Yap safety signal on profile reads

- [x] Confirmed Yap's own real `GET /yap/summary/:subjectId` shape
      (`{subjectId, totalReports, greenCount, redCount}`).
- [x] Added `YAP_API_URL` env var + `fetchYapSignal(userId)` to
      `server.js`, mirroring `fetchIdentityStatus`'s live-fetch
      pattern but failing soft (`null`) instead of throwing.
- [x] Made `GET /api/profiles/:userId` async and merged `yapSignal`
      into its response.
- [x] `node --check server.js` -- clean.
- [x] Live pass: created a profile, confirmed a real
      `yapSignal:{totalReports:0,...}` came back.
- [x] Created a second, genuinely VACA-verified reporter (submitted +
      approved a real identity verification first, then created their
      CVNVO profile so `verifiedBadge` was true at creation time --
      Yap's own reporter-verification gate checks the profile's
      *stored* badge, not a fresh re-check).
- [x] Submitted a real Yap report from that verified reporter;
      confirmed the subject's CVNVO profile read reflected the real
      counts.
- [x] Killed Yap's real process mid-test; confirmed the same profile
      read degraded to `yapSignal: null` instead of erroring.
- [x] Updated `README.md` (new Phase 12 section) and
      `yap/README.md` (closed its own "Not yet built" bullet).

## Next
Yap's own actual review/moderation UI and due-process mechanism is
still real, separate, unbuilt scope -- unaffected by this piece,
already tracked in `yap/README.md`'s own remaining "Not yet built".
