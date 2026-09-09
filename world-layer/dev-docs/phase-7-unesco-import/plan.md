# Plan — Phase 7: UNESCO World Heritage import

## Goal
First real external-data-source task from
`AUTOMATED_HISTORIC_LANDMARK_IMPORT_SYSTEM.md`: "the UNESCO World
Heritage Site list is a real, comprehensive, structured, publicly
available dataset... Claude Code should import from this real,
structured data source directly." Imports as `hero`-tier locations
(Phase 1's `LOCATION_TIERS`), matching
`UNIVERSAL_WORLD_LAYER_ARCHITECTURE.md` section 7's own "Tier 1:
global icons, ~1,200 UNESCO locations."

## Real, confirmed network constraint
Before writing any import code, tested whether this sandboxed session
can actually reach a real UNESCO/Wikidata endpoint:
```
curl https://query.wikidata.org/sparql?... 
-> curl: (56) CONNECT tunnel failed, response 403
```
Confirmed via the proxy's own `/__agentproxy/status` endpoint
(`recentRelayFailures`: `"gateway answered 403 to CONNECT (policy
denial or upstream failure)"`, host `query.wikidata.org:443`). The
proxy's `noProxy` allowlist covers `anthropic.com`, npm/PyPI/crates/Go
module registries, and internal cluster hosts — general internet
access, including both UNESCO's own site and Wikidata's public SPARQL
endpoint (which mirrors UNESCO's list in structured form), is outside
that allowlist. This is a real, verified constraint of the execution
environment, not a guess — flagged honestly rather than either
silently skipping the import or pretending to fetch live data that
wasn't actually fetched.

## Design given that constraint
- `world-layer/imports/unescoImport.js`:
  - `importUnescoSites(worldLayer, siteRecords)` — the real, tested
    half. Takes an array of `{ name, lat, lng, country,
    inscribedYear, description }` records (the shape a real UNESCO/
    Wikidata query would return) and, for each, calls Phase 1's
    `generateLocation()` with `tier: 'hero'` and
    `setLocationData(..., 'landmarkData', {...})` with `unesco: true`
    and a `historicalImportance: 100` — UNESCO inscription is treated
    as maximal significance in this model, an interpretive choice
    (no scoring formula is specified anywhere) consistent with how
    the source doc itself frames UNESCO as the top tier.
  - `fetchUnescoSites()` — an **intentional, documented stub** that
    throws explaining exactly why (the network constraint above), not
    a forgotten placeholder. The real live-fetch implementation is
    isolated to this single function so wiring it in later (from an
    environment that can reach the network, or via a fetched-data file
    committed to the repo) is a one-function swap, not a rewrite of
    `importUnescoSites()`, which doesn't care where the records came
    from.
- Verified with 3 real, accurate UNESCO World Heritage Sites (not
  placeholder/fake data): Cahokia Mounds (1982, near St. Louis — the
  project's own established city anchor), Statue of Liberty (1984),
  Independence Hall (1979). Real names, real inscription years, real
  approximate coordinates, from training knowledge — genuinely
  correct facts, not fabricated placeholders standing in for facts.

## Explicitly NOT in this task
- No live network call — see constraint above. This is not "deferred
  as a design choice," it's environmentally blocked and confirmed as
  such.
- No NRHP or Overture Maps import — structurally the same problem
  (also outside the proxy allowlist), not attempted here; a real next
  step once network access is available (a different execution
  environment, or a locally-provided data file).
- No deduplication logic (importing the same site twice creates two
  locations) — not specified as a requirement anywhere, and Phase 1
  never established an identity/uniqueness concept for locations.
- No Hero Building Identification / multi-factor scoring system
  (Historical/Economic/Tourism/Cultural/Gameplay Importance) — the
  source doc references this as "already specified" elsewhere, but no
  such scoring system exists anywhere in this codebase yet;
  `historicalImportance: 100` is the only score set, and only because
  UNESCO status alone determines it in this pass.

## Done when
- `importUnescoSites` validates input is an array, and each record has
  a `name` and numeric `lat`/`lng`.
- Real UNESCO sites import as `hero`-tier locations with correct
  `landmarkData` (`unesco: true`, `country`, `inscribedYear`,
  `historicalImportance: 100`), verified against 3 real, accurate
  sites, not fixtures with fabricated names.
- `fetchUnescoSites()` fails loud with a message that explains the
  real reason, rather than silently returning nothing or fake data.
- Regression: Phase 1 (`generateLocation`, `setLocationData`,
  `LOCATION_TIERS`) unaffected.
