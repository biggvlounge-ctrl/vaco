# Tasks — Phase 7: real DREA-driven automatic neighbor-match suggestions

- [x] Re-read `neighborProgram.js`, `drea.js`, and `explore.js` to
      ground the design in real, already-established patterns.
- [x] `neighborProgram.js` — `optInToNeighborProgram` gains an
      optional `category` field.
- [x] `neighborProgram.js` — moved `computeLocationScore`/
      `LOCATION_SCORE_DECAY_KM` here from `explore.js`.
- [x] `neighborProgram.js` — new `suggestNeighborTrades` (real
      candidate filtering + ranking).
- [x] `explore.js` — updated to import the moved scoring function
      instead of its own copy.
- [x] `server.js` — new `GET /api/neighbor-program/:businessId/suggestions`
      route.
- [x] 6 plain-Node checks — all passing.
- [x] `explore.js` regression check — confirmed identical output after
      the refactor.
- [x] Live pass: real HVNTZ started, three real businesses (two
      same-category, one different), suggestions correctly excluding
      the closer competitor.
- [x] Shut down all test servers.
- [x] Update `hvntz/README.md` — new Phase 7 bullets in "What's here",
      a new "Verified" paragraph, and the resolved item removed from
      "Not yet built".
- [x] Write this plan/tasks pair.

## Next
The actual DREA AI agent remains unbuilt -- this phase is only the
real, deterministic ranking layer underneath where it would sit, same
posture as `drea.js`'s own placement-rule enforcement.
