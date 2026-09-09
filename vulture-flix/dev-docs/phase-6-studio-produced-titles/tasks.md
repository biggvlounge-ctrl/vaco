# Tasks — Phase 6: studio-produced titles

- [x] Investigated `acquireExclusiveTitle` / `licenseNonExclusiveTitle`,
      confirmed both hard-require a positive fee and are unsuitable
      for an already-financed title.
- [x] Added `registerStudioProducedTitle` to `lib/titles.js`, inserted
      just before `getTitleRecord`.
- [x] Added `registerStudioProducedTitle` to `lib/titles.js`'s own
      `module.exports`.
- [x] Added `registerStudioProducedTitle` to `server.js`'s destructured
      import from `./lib/titles`.
- [x] Added `POST /api/titles/studio-produced` route to `server.js`.
- [x] `node --check server.js` and `node --check lib/titles.js` —
      passed.
- [x] Live-verified end-to-end as part of Vvltvre Studios' own full
      lifecycle test: real title created with the correct
      `acquisitionType`/`acquisitionFee`/`ownershipRetainedPercent`/
      `studioProjectId`, independently re-confirmed via this app's
      own separate `GET /api/titles/:id`.
- [x] Live-verified the honest-failure path: killed this app mid-test,
      confirmed Vvltvre Studios' own `distribute` call correctly
      surfaced a real `502`.
- [x] Updated this app's own README with a new "Real studio-produced
      titles (Phase 6)" section.

## Next
Nothing further planned for this specific addition. A real Vvltvre
Studios VDP district (not yet built) would be the natural next piece
to surface this cross-app hand-off visually.
