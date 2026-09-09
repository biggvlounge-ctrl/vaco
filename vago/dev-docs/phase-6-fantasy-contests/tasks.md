# Tasks — Phase 6: Fantasy Contests (DraftKings Pick6 model)

- [x] Investigate: confirm Kalshi/sportsbook comparables already
      exist but fantasy doesn't, per direct question; re-read
      `VAGO_COMPARABLES.md`'s own real Pick6 framing.
- [x] `lib/fantasy.js` — NEW. `createProp`, `resolveProp`,
      `createFantasyEntry`, `gradeFantasyEntry`, `listEntriesForUser`,
      `PERFECT_PAYOUT_TABLE` (real, flagged, DraftKings-grounded).
- [x] `lib/store.js` — added `fantasyProps`/`nextFantasyPropId`,
      `fantasyEntries`/`nextFantasyEntryId`.
- [x] `server.js` — wired `POST /api/fantasy/props`,
      `GET /api/fantasy/props/:id`,
      `POST /api/fantasy/props/:id/resolve`,
      `POST /api/fantasy/entries`, `GET /api/fantasy/entries/:id`,
      `POST /api/fantasy/entries/:id/grade`,
      `GET /api/fantasy/users/:userId/entries`; exposed
      `fantasyPickBounds`/`fantasyPerfectPayoutTable` on
      `/api/health`.
- [x] 10 plain-Node checks — all passing.
- [x] Live pass against `venvs-mock-backend` + `vago`: a real 4-pick
      perfect entry paying exactly `250` (the real 10x multiplier) on
      a `25` stake against V3's own live balance; a real 2-pick
      losing entry; a real push-refund case confirmed net zero; plus
      fewer-than-minimum-picks, double-grading, and unknown-entry all
      confirmed rejected over real HTTP.
- [x] Shut down all test servers; confirmed via process list.
- [x] Update `README.md` (What's here, Verified, Not yet built).
- [x] Write this plan/tasks pair.

## Next
DraftKings' own separate "Flex Play" remains a real, flagged gap.
