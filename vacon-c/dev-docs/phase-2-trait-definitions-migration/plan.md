# Plan — Migrate trait storage to trait_definitions / entity_traits

## Goal
Reshape trait storage to mirror `VACANCY_POSTGRESQL_SCHEMA.sql`'s
definition/instance split (`trait_definitions` + `entity_traits`)
while staying entirely in-memory — locked Day 1 step 2. Postgres
itself isn't stood up until step 9; this step is about making the
in-memory shape identical to the target schema now, so step 9 is a
straight data copy, not a reshape.

## Why this now, out of strict step order
Step 3 (Skills family) already landed before this, since it had no DB
dependency and step 2 was blocked pending
`VACANCY_POSTGRESQL_SCHEMA.sql`. That file is now available (see
`dev-docs/phase-1-trait-split/tasks.md` for the resolved trait-count
discrepancy this unblocked), so step 2 proceeds now, completing the
locked order up through step 3.

## Scope for this task only
- `server/traitDefinitions.js` — builds the `trait_definitions`
  catalog (114 rows) from `traits.js`'s `TRAIT_FAMILIES`, using the
  schema's own column defaults verbatim (no per-trait tuning is
  specified anywhere in the handoff package).
- `server/entityTraits.js` — generates `entity_traits`-shaped rows per
  entity, and converts a set of rows back into the legacy nested
  `{ family: { name: value } }` shape (`traitsToSheet()`).
- `engine.js`'s `WorldState` gains `entityTraits`, a flat array
  mirroring the `entity_traits` table itself (not a per-entity map),
  and a `getEntityTraits(entityId)` query helper.
- `generateNPC()`'s **public output is unchanged** — `npc.traits` is
  still the nested shape, now derived from the new `entity_traits` rows
  via `traitsToSheet()` rather than generated directly.

## Explicitly NOT in this task
- Any actual Postgres connection — step 9.
- Splitting `entities`/`npcs` into two separate in-memory objects —
  not asked for by this step; the merged npc object shape from step 1
  is unchanged.
- Key resolver logic that writes to the modifier columns — step 4.
  `current_value === base_value` at generation time is correct for now
  since nothing writes modifiers yet.

## Done when
- `trait_definitions`-shaped catalog exists, 114 rows, correct columns,
  sequential `trait_id`.
- `entity_traits`-shaped rows exist per generated NPC, correct columns,
  `current_value`/`base_value` in `[0, 100]`, modifiers all `0`.
- `generateNPC()`'s returned `npc.traits` is unchanged in shape and
  value range from before this migration.
- `WorldState.entityTraits` genuinely mirrors what a
  `SELECT * FROM entity_traits` would return — a flat table, not a
  nested structure.
