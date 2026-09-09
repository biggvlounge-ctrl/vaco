# Tasks — Phase 7: UNESCO World Heritage import

- [x] Confirm network reachability before writing code: direct `curl`
      to `query.wikidata.org` from this session, plus a check of the
      proxy's own `/__agentproxy/status` endpoint — confirmed 403
      CONNECT rejection at the proxy level, not a Wikidata-side error.
- [x] Create `world-layer/imports/unescoImport.js`:
      `importUnescoSites`, `fetchUnescoSites` (documented stub).
- [x] Verify (throwaway script, run with `node`, deleted after):
      - `importUnescoSites` throws when `siteRecords` isn't an array.
      - Throws on a record missing `name`.
      - Throws on a record missing/non-numeric `lat`/`lng`.
      - 3 real, accurate UNESCO sites (Cahokia Mounds, Statue of
        Liberty, Independence Hall) import correctly: count matches,
        all `tier: 'hero'`.
      - `landmarkData` correct per-site: `unesco: true`, `country`,
        `inscribedYear`, `historicalImportance: 100`.
      - A field omitted from the input record (`description` on
        Statue of Liberty) defaults to `null` rather than throwing or
        being silently dropped.
      - `fetchUnescoSites()` throws its documented stub error rather
        than silently doing nothing.
      - Regression: Phase 1 (`generateLocation`) used internally,
        unaffected.
- [x] Commit as its own change.

## Next
NRHP and Overture Maps imports are structurally identical problems
(also outside this environment's proxy allowlist) — not attempted.
Real next step if network access becomes available: implement
`fetchUnescoSites()` for real, or accept a pre-fetched data file path
as an alternative input source. Hero Building Identification / multi-
factor importance scoring (referenced by
`AUTOMATED_HISTORIC_LANDMARK_IMPORT_SYSTEM.md` as "already specified")
doesn't exist in this codebase yet and would need to be built from
scratch, not wired to an existing system.
