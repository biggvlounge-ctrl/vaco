# Tasks — Phase 3: length-aware video routing

- [x] Investigate: confirm Vavlt Stvdios' own new `/api/videos`
      contract and real 12-hour cap.
- [x] `lib/episodes.js` — `Episode` gains
      `vaultStvdiosContentType: null`; `attachEpisodeVideo` requires a
      valid `contentType`.
- [x] `server.js` — `postVideoToVaultStvdios` routes by real
      `durationSeconds` against `REEL_DURATION_CAP_SECONDS`; the
      `/api/episodes/:id/video` route passes the resolved
      `contentType` through to `attachEpisodeVideo`.
- [x] 3 plain-Node checks — all passing.
- [x] Live pass with all four servers running: the exact real
      45-minute episode from Phase 2's own live pass now succeeds via
      the real long-form route, independently confirmed
      (`vaultStvdiosContentType: 'video'`); a real short episode still
      routes to and is confirmed as a genuine Reel
      (`vaultStvdiosContentType: 'reel'`).
- [x] Shut down all test servers; confirmed via process list.
- [x] Update `README.md` (What's here, Verified, Not yet built).
- [x] Write this plan/tasks pair.

## Next
The real 12-hour ceiling on the long-form path remains a real, named
(not literally unbounded) limit.
