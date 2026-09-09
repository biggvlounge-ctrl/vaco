# Tasks — Phase 5: real video cross-link to Vavlt Stvdios

- [x] Investigate: confirm Vavlt Stvdios' own real Reel infrastructure
      and 20-minute cap; confirm a real music video is almost always
      well under it.
- [x] `lib/releases.js` — `Release` gains `vaultStvdiosPostId: null`;
      added `attachMusicVideo` (works on any release format).
- [x] `server.js` — added `postVideoToVaultStvdios` (real cross-app
      HTTP client) and `POST /api/releases/:id/video`.
- [x] 4 plain-Node checks — all passing.
- [x] Live pass against `venvs-mock-backend` + `vavlt-stvdios` +
      `vulture-music`: a real 4-minute music video attached to a real
      `single` release, independently confirmed as a genuine Reel on
      Vavlt Stvdios' own server (`source: 'vulture-music'`); a
      double-attach and an unknown-release attach both confirmed
      rejected over real HTTP.
- [x] Shut down all test servers; confirmed via process list.
- [x] Update `README.md` (What's here, Verified).
- [x] Write this plan/tasks pair.

## Next
None identified for this specific gap.
