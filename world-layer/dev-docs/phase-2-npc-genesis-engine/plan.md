# Plan — Phase 2: NPC Genesis Engine

## Goal
Second task of the Universal World Layer initiative. Source of truth:
`UNIVERSAL_WORLD_LAYER_ARCHITECTURE.md`, section 1 — "one NPC creation
system, not seven" (survivors, employees, business founders,
influencers, Tribe members, displaced persons, NPC skill-holders).
Connects generated people to Phase 1's location records via
`locationId`.

## Design
- `world-layer/npcGenesis.js`: `generateNPC(worldLayer, options)`
  builds one person with exactly the fields the architecture doc's
  `NPCGenesisEngine` block lists (`locationId`, `demographics`,
  `occupation`, `skills`, `language`, `personality`, `relationships`,
  `goals`, `migrationStatus`, `economicRole`), plus a `roles` array
  that starts empty.
- **Role is an assignment, not a generation input.** The doc's own
  point is "the same generated NPC can *become* any of these roles —
  no separate creation cost per category." Modeled that literally:
  `generateNPC()` never takes a role; `assignRole(worldLayer, npcId,
  role)` adds one after the fact, and an NPC can hold more than one
  role at once (duplicate assignment is a no-op, not an error — the
  first check was whether re-assigning the same role should throw,
  and it shouldn't: nothing in the doc suggests roles are exclusive or
  single-assignment).
- `locationId` is validated against Phase 1's `locations` array at
  generation time (`getLocation()` from `locations.js`) — an NPC can't
  be generated at a location that doesn't exist. Same validation
  pattern as `setLocationData`'s field check: fail loud on a bad
  reference rather than silently creating an orphan.
- `migrationStatus` gets a fixed enum (`resident`/`migrating`/
  `displaced`/`arrived`) — not specified by the architecture doc
  itself, but the doc explicitly lists `migrationStatus` as a field
  and VACON-C's own migration-risk system (a locked Day 1 system)
  needs *some* status vocabulary to eventually key off of. Interpretive
  choice, flagged as such — no formula or exhaustive list was given in
  any source doc.
- `relocateNPC(worldLayer, npcId, newLocationId)` — the actual
  migration mechanic: changes which location an NPC's `populationData`
  should count against. Validates both ids exist.
- `getNPCsAtLocation(worldLayer, locationId)` — the query a location's
  `populationData` slice would eventually be computed from (not wired
  up automatically here — `populationData` stays a manually-set opaque
  field per Phase 1, same as every other data slice).

## Explicitly NOT in this task
- **Reconciliation with VACON-C's `entities`/`npcs` Postgres tables**
  — resolved in `dev-docs/phase-8-vacon-c-reconciliation/plan.md`:
  linked, not replaced. `world_npcs` stays a separate shared layer;
  VACON-C's own NPC generation (`vacon-c/server/traits.js`,
  `engine.js#generateNPC`) remains untouched and authoritative for
  VACON-C specifically.
- No auto-derivation of a location's `populationData` from
  `getNPCsAtLocation()` — kept as two separate, manually-reconciled
  things for now, same reasoning as Phase 1's undone
  `resolveTerritoryControl()`-to-drought wiring.
- No relationship-graph logic — `relationships` stays an empty array
  at creation; populating it is a separate task.
- No skills/personality generation logic (no `randomTraitValue()`
  equivalent) — both fields are passed straight through from
  `options`, deliberately not reusing VACON-C's `traits.js` random
  generator, since World Layer must not depend on any one consuming
  app's private code (VENVS/HVNTZ don't have access to
  `vacon-c/server/`).

## Done when
- `generateNPC` validates `locationId` (present, references a real
  location) and `demographics` (present, an object), and rejects an
  invalid `migrationStatus`.
- A single NPC can be assigned more than one role, duplicates are a
  no-op, and an invalid role throws.
- `relocateNPC` moves an NPC between locations and rejects a
  nonexistent NPC or destination.
- `getNPCsAtLocation` reflects relocation correctly.
- Regression: Phase 1 (`locations.js`) unaffected — verified by
  reusing its `generateLocation` in the same test run.
