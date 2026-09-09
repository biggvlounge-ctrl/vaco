# Plan — Phase 6: Persistent Asset Library

## Goal
Sixth and final bundled system from
`UNIVERSAL_WORLD_LAYER_ARCHITECTURE.md`, section 6: "One generated gas
station appears in thousands of towns; one house family creates
millions of real variations; one warehouse gets reused globally —
major reduction in ongoing AI generation cost through real, tracked
reuse." Doc's field list: `assetType, generatedModel, variants,
qualityLevel, usageCount, locationHistory`.

## Design
- `registerAsset(worldLayer, options)` creates one asset record
  (`assetType`, `generatedModel`, `variants`, `qualityLevel`);
  `usageCount` always starts at `0` and `locationHistory` always
  starts empty — those two fields exist specifically to be built up by
  `useAsset()`, not set at registration.
- **`qualityLevel` reuses `LOCATION_TIERS` (`hero`/`regional`/
  `filler`) from Phase 1, imported directly rather than redefined.**
  This isn't a coincidence of naming: section 7 of the architecture
  doc ("real human cost hierarchy") explicitly maps Tier 1/2/3 onto
  UNESCO-grade sites, major cities, and everything-else — the exact
  same three-tier concept Phase 1 already applied to locations, now
  applied to assets. Reusing the actual exported constant (verified in
  the test run that `LOCATION_TIERS` and the accepted `qualityLevel`
  values are identical) means the two tier systems can't drift apart
  by editing one file and forgetting the other.
- `useAsset(worldLayer, assetId, locationId)` is the actual reuse-
  tracking mechanic the doc is about: increments `usageCount` and
  appends `{ locationId, tick }` to `locationHistory`. Validates both
  the asset and location exist.
- `getAssetsByType(worldLayer, assetType)` — the query that answers
  "do we already have a generated gas station we can reuse here"
  before generating a new one, which is the entire cost-saving premise
  of this system.

## Explicitly NOT in this task
- No actual AI generation call, no `generatedModel` file handling —
  it's stored as an opaque string identifier (a path/URI/reference),
  same treatment as `building` on a Commerce record (Phase 3).
- No automatic "reuse an existing asset instead of generating a new
  one" decision logic — `getAssetsByType()` provides the lookup; the
  choice of whether to reuse vs. generate fresh is left to the caller,
  not decided here.
- No connection between `variants` and any actual variation-generation
  logic — stored as a caller-provided list, not computed.

## Done when
- `registerAsset` validates `assetType`, `generatedModel`, and
  `qualityLevel` (against the reused `LOCATION_TIERS` list) all
  correctly; defaults `qualityLevel` to `'filler'`.
- `usageCount` and `locationHistory` both start empty regardless of
  input, and are only ever changed by `useAsset()`.
- `useAsset` called against the same asset at multiple different
  locations correctly accumulates `usageCount` and `locationHistory`
  entries for all of them — the literal "one gas station, thousands of
  towns" scenario, verified with 3 real locations in the test run, not
  just 1.
- `useAsset` throws on a nonexistent asset or location.
- `getAssetsByType` filters correctly, including an empty result for
  an unregistered type.
- Regression: Phase 1 (`generateLocation`, `LOCATION_TIERS`) unaffected.
