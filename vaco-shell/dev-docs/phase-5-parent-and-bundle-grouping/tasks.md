# Tasks — Phase 5: 15 real parents, 5 real bundles

- [x] Confirmed the exact 15 parents and their foldings directly with
      the user, iteratively (the initial dictated list had genuine
      ambiguity — V4's scope, Vault vs. Vvltvre, where VOID MAGIC/
      VSAFE/VACA/Shield/VACO Analytics/DREAMS/VENVM belong — resolved
      each rather than guessing).
- [x] Booted all 23 real backends behind the 15 parents; hit each
      `/api/health`. 22/23 returned 200. The one non-200 (`v4-proxy`)
      read directly from its own log: a real, deliberate refusal to
      boot without `ANTHROPIC_API_KEY`, not a bug.
- [x] Cross-checked frontend coverage against `vdp/src/lib/world.js`'s
      real district list. 14/15 parents confirmed. VACON-C flagged as
      the one real gap (no district) — reported to the user rather
      than silently built or skipped.
- [x] Fixed two more real, stale registry descriptions found while
      verifying: `vacay` ("API only, no UI yet" — false, a real
      district exists) and `venvs` (still listed "VADO" after VEX was
      already removed last phase — both were deleted from VENVS in
      the same Phase 12, confirmed via `venvs/README.md`).
- [x] Added 3 real, already-built apps missing from the registry
      entirely: `dreams`, `venvm`, `vulture-studios` (each verified
      against its own `server.js` for the real port).
- [x] `lib/registry.js`: added `parent`/`bundle` to every entry; new
      `BUNDLES` array (5 named groups); `listBundles()`/`getBundle()`
      deriving each bundle's app list live from `APPS`.
- [x] `server.js`: `GET /api/bundles`, `GET /api/bundles/:name`.
- [x] Live-verified: booted `vaco-shell`, confirmed `GET /api/bundles`
      returns exactly the right apps under each of the 5 groups,
      `GET /api/bundles/leisure%20%26%20entertainment` resolves a
      single bundle by name, and `GET /api/apps` grew from 28 to 31
      entries as expected.
