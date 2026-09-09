# Tasks — Phase 2: real video cross-link to Vavlt Stvdios

- [x] Investigate: confirm Vavlt Stvdios' own real 20-minute Reel cap
      and the real mismatch this creates for full-length video podcast
      episodes.
- [x] `lib/episodes.js` — `Episode` gains `vaultStvdiosPostId: null`;
      added `attachEpisodeVideo`.
- [x] `server.js` — added `postVideoToVaultStvdios` (real cross-app
      HTTP client) and `POST /api/episodes/:id/video`.
- [x] 4 plain-Node checks — all passing.
- [x] Live pass against `venvs-mock-backend` + `vavlt-stvdios` +
      `vulture-pods`: a real 10-minute video episode attached
      successfully; a real 45-minute video episode attempt confirmed
      rejected by Vavlt Stvdios' own real validation (the exact real
      mismatch flagged in the plan, confirmed live, not just
      asserted); double-attach confirmed rejected over real HTTP.
- [x] Shut down all test servers; confirmed via process list.
- [x] Update `README.md` (What's here, Verified, Not yet built).
- [x] Write this plan/tasks pair.

## Next
A real long-form video host for episodes over 20 minutes remains a
real, flagged gap -- this ecosystem has none today.
