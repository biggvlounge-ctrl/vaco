# Tasks — Phase 6: real lat/lng + Map Search sync + business/location lookups

- [x] Investigate: read `registerLocation` and `neighborProgram.js`
      directly to confirm lat/lng didn't exist on the base `Location`
      entity; read Vavlt Stvdios' own `mapSearch.js` for its real
      shape/bounds; read `hunts.js`'s own `postToVavltStvdios` pattern
      to reuse, not reinvent.
- [x] `lib/revenueStack.js` — `registerLocation` gained real, required
      `lat`/`lng` (bounded -90..90/-180..180); added
      `syncLocationToMapSearch`.
- [x] `server.js` — added `postMapListing` client, `GET /api/business/:id`,
      `GET /api/location/:id`, `POST /api/location/:id/sync-map-search`.
- [x] 8 plain-Node checks — all passing.
- [x] Live pass against `venvs-mock-backend` + `hvntz` + `vavlt-stvdios`:
      real business registered and looked up, real location registered
      with real coordinates, synced live, independently confirmed
      searchable on Vavlt Stvdios' own server.
- [x] Shut down all test servers; confirmed via port checks.
- [x] Update `README.md` (What's here, Verified, Not yet built).
- [x] Update `../vavlt-stvdios/README.md`'s own matching "Not yet
      built" entry.
- [x] Write this plan/tasks pair.

## Next
CVNVO's own BarBuddy validation against the new `GET /api/business/:id`
route — see `../cvnvo/dev-docs/phase-10-barbuddy-hvntz-validation/`.
