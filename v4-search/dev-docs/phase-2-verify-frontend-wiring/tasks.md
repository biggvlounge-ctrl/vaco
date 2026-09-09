# Tasks — Phase 2: verify frontend wiring + fix stale naming

- [x] Investigate: read `V4Prototype.jsx` in full around
      `searchEcosystem`/`EcosystemSearch`/`SearchResultRow` rather
      than trusting the README's "not yet wired" claim.
- [x] Confirmed: `EcosystemSearch` is fully wired, routed, and
      reachable from Home via a real button — the wiring gap was
      already closed.
- [x] Found and fixed a real staleness: `V4Prototype.jsx`'s
      `SEARCH_APPS` array and two comments still said `VACANCY`
      (this project's own old name for `VACON-C`) — 3 replacements.
- [x] Live pass against `v4-search/server.js`: the exact `{query}`-
      only shape `searchEcosystem()` sends, a scoped `apps`-filtered
      search, and a `VACON-C`-specific search all confirmed returning
      real, correctly-shaped results.
- [x] Shut down the test server; confirmed via process list.
- [x] Update `README.md`'s "Wiring a frontend" section to accurately
      describe the real, already-wired state instead of the stale
      claim.
- [x] Write this plan/tasks pair (and a retroactive
      `phase-1-search-layer` pair, since neither `v4-search` nor
      `v4-proxy` had any `dev-docs/` at all before this pass).

## Next
None identified — this closes the audit's own flagged V4 gap.
