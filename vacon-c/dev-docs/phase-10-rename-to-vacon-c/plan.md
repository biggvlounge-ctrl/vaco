# Plan — Phase 10: Rename VACANCY → VACON-C

## Goal
Per explicit instruction: this project's correct, official name is
VACON-C, not VACANCY. A naming correction, not a rebuild — the trait
system, Key resolvers, Family engine, resource tracking, and
everything else already built is genuinely VACON-C, unchanged.

## Design
- `git mv vacancy vacon-c` — the directory itself renamed, preserving
  git history.
- `package.json` name (`vacancy-engine` → `vacon-c-engine`) and
  description updated.
- `CLAUDE.md` and `README.md` (project-authored docs) updated with a
  clear naming note; the original `VACANCY_*.md` source doc files kept
  under their real, originally-uploaded filenames, per this session's
  standing practice of never renaming or rewriting uploaded source
  material -- only the project's own name changed, not its citations.
- One bare project-name reference in `server/engine.js`'s header
  comment corrected; every other in-code `VACANCY` reference in
  `server/*.js` turned out to already be a citation to one of the
  `VACANCY_*.md`/`.sql` source filenames (kept as-is, correctly).
- External cross-references in `world-layer`, `v4-search`,
  `vago` (project-authored docs/comments only, not its own
  `VAGO_CLAUDE.md`/`VAGO_COMPARABLES.md` source docs), and
  `vaco-analytics` updated: prose references to VACANCY as this
  project's name, and the one relative path reference
  (`vacancy/server/traits.js` etc.) that broke with the directory
  rename. `world-layer/dev-docs/phase-8-vacancy-reconciliation/` also
  renamed to `phase-8-vacon-c-reconciliation/` for consistency, with
  its own cross-references to the old folder name fixed.
- `v4-search`'s real `APP_IDS` array and `memoryAdapter.js`'s app
  label updated too -- this is the app's own real identifier, and
  correcting it to the project's actual name is exactly "confirming
  the correct name going forward," not a functional rebuild.

## Explicitly NOT touched, flagged directly
`vago/lib/predictionMarkets.js`'s real `MARKET_SOURCES` enum
(`'vacancy-in-game'`) and its matching `GET /api/predictions/vacancy`
route, plus `VAGO_ARCHITECTURE.md`'s matching doc references, are left
exactly as-is. That string is a real, load-bearing API contract value
already wired into real code and a real endpoint -- renaming it would
be a genuine (if small) breaking change to VAGO's own API, which is
what "no rebuild needed" rules out. Flagged to the user directly as
the one place the old name survives in something functional, worth a
deliberate decision later if it should change too.

## Verification approach
After the rename, `server/*.js` confirmed to still `require()` cleanly
(`engine`, `economy`, `keys`, `tick`, `traits`, `familyTraits`,
`organizationTraits`, `entityTraits`, `traitDefinitions`,
`worldStore`) -- no syntax breakage from the sed-based text
replacements. `world-layer`, `v4-search`'s adapter, and
`vaco-analytics`'s `intelligence.js` also confirmed to still
`require()` cleanly. `v4-search/server.js` run live and its real
`/api/health` endpoint confirmed to report `"VACON-C"` in its real
`apps` array, matching its own README's documented example exactly.

## Done when
- The directory, `package.json`, and both project-authored docs use
  VACON-C as the primary name.
- Every real, functional cross-reference (relative paths, the
  `v4-search` app registry) still resolves correctly.
- The one deliberately-untouched functional exception (VAGO's
  prediction-market source enum) is flagged, not silently left
  looking like an oversight.
