# Plan — Phase 1: Location schema

## Goal
First task of the Universal World Layer initiative (see
`UNIVERSAL_WORLD_LAYER_ARCHITECTURE.md`): define the shared location
record's shape as a standalone module, before wiring in any external
data source (Cesium, UNESCO, NRHP, Overture) or refactoring any
consuming app's NPC generation.

## Why this first, not a data import
Nothing in VACON-C, VENVS, or HVNTZ has anywhere to write imported
data yet. Starting with an API integration before the shared record
shape exists means the first import has nowhere real to land. This
mirrors how VACON-C itself was built — schema/shape first
(`trait_definitions`/`entity_traits`), imports and consumers after.

## Design
- `world-layer/locations.js` — the module. In-memory `WorldLayer`
  object (`{ tick, locations, nextLocationId }`), mirroring VACON-C's
  `WorldState` pattern (flat array of row-shaped objects, first-param
  convention, straight-copy-to-Postgres shape).
- One `Location` record holds the nine data slices from the
  architecture doc's `UniversalWorldLayer` block: `geographyData`,
  `buildingData`, `businessData`, `landmarkData`, `populationData`,
  `transportationData`, `economicData`, `ownershipData`, plus
  `eventHistoryData` (kept as its own array field, appended via
  `addLocationEvent`, same pattern as VACON-C's `addMemory`).
  `terrainType` is a real column (a simple classification), separate
  from the free-form `geographyData` slice — the architecture doc
  lists both as distinct fields.
- `tier` (`hero`/`regional`/`filler`) is baked into the base record
  now, not deferred — section 2 of the architecture doc calls this
  "the standing structure," and it's the mechanism that governs which
  locations get real human/AI-assisted attention later. Defaults to
  `'filler'`, the doc's own "fully automated" tier.
- Every data slice starts `null` — no import wired in yet. Written via
  `setLocationData(worldLayer, locationId, field, value)`, validated
  against the known field list so a typo'd field name fails loud
  instead of silently creating a stray property.
- `schema.sql` — literal Postgres shape, same conventions as
  `VACON-C_POSTGRESQL_SCHEMA.sql` (BIGSERIAL PK, BIGINT tick). The
  nine data slices are JSONB, since the architecture doc itself
  describes them as variable-shape and no import has defined a fixed
  shape for any of them yet — same reasoning VACON-C used for
  `context_json`/`requirements`.

## Explicitly NOT in this task
- No Cesium/UNESCO/NRHP/Overture import — those are separate tasks,
  now unblocked by this schema existing.
- No NPC Genesis Engine refactor, no change to VACON-C's `entities`/
  `npcs` tables, no `locationId` foreign key added anywhere yet. The
  architecture doc's NPC Genesis Engine connects to a location via
  `locationId` — that wiring is the next task, not this one.
- No `populationData`/`economicData` computation logic — these stay
  opaque JSON slices for now, same as every other field.
- Not folded into `vacon-c/server/` — this module is shared
  infrastructure VACON-C, VENVS, and HVNTZ all read from, not owned by
  VACON-C specifically, so it lives as its own top-level package.

## Done when
- `generateLocation` validates `name`/`lat`/`lng`/`tier` correctly.
- `setLocationData` rejects unknown fields and unknown location ids.
- `addLocationEvent` stamps the current `tick`.
- A `hero`-tier and a `filler`-tier (default) location both generate
  correctly, using a real St. Louis landmark (Gateway Arch) as the
  hero-tier example, consistent with VACON-C's own St. Louis anchor.
