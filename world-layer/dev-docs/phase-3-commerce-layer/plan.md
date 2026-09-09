# Plan — Phase 3: Real World Commerce Layer

## Goal
Third bundled system from `UNIVERSAL_WORLD_LAYER_ARCHITECTURE.md`,
section 3: "Overture Places + Cesium OSM Buildings + business data +
the property system, unified." The doc's own field list:
`businessId, location, building, owner, industry, employees,
economicValue, supplyNeeds, securityRequirement`.

## Design
- `world-layer/commerce.js`: `generateBusiness(worldLayer, options)`
  builds one business with exactly those fields (`id` in place of
  `businessId`, `locationId` in place of `location`, `ownerId` in
  place of `owner` — matching this project's existing `*Id` naming
  convention from Phases 1-2 rather than the doc's shorthand).
- **Real connection to Phase 2, not a parallel one.** The doc lists
  this layer as directly powering "the Business Founding Pipeline" —
  read literally: generating a business with an `ownerId` calls
  `assignRole(worldLayer, ownerId, 'business_founder')` automatically,
  and `addEmployee()` calls `assignRole(worldLayer, npcId,
  'employee')`. This is the first place two phases' code actually call
  into each other, not just share a `locationId` convention.
- `employees` is a real many-to-many relationship
  (`world_business_employees` join table in `schema.sql`), not an
  array column — the same fix VACON-C's own schema already applied
  for `entity_organization_memberships` (one NPC can hold more than
  one job; a business obviously has more than one employee). The
  in-memory side mirrors this with a plain array of npc ids on the
  business record plus `addEmployee()`'s dedup check, matching how
  `locations.js`/`npcGenesis.js` already keep the JS side simple while
  the SQL side enforces real cardinality.
- `securityRequirement` gets a fixed enum
  (`none`/`low`/`medium`/`high`) — not specified by the architecture
  doc, an interpretive choice flagged as such, same reasoning as
  Phase 2's `migrationStatus` enum. VACON-C's own security phase
  (tick pipeline phase 8) is the plausible future reader of this
  field, though nothing wires them together here.
- `economicValue` requires a non-negative number at both generation
  and update (`setBusinessEconomicValue`) — no currency/formula
  implied by any source doc, just a sane guard rail consistent with
  every other numeric field validated so far in this project.

## Explicitly NOT in this task
- No Cesium/Overture import — `building` stays an opaque optional
  field, same as every other still-unwired data source.
- No supply chain logic — `supplyNeeds` is stored, not resolved
  against anything (no connection to VACON-C's own resource/economy
  system).
- No property system — the doc explicitly bundles "the property
  system" into this layer's description, but VACON-C's own `CLAUDE.md`
  defers Property beyond the minimum, and no minimum exists anywhere
  yet. Not invented here.
- No automatic economic rollup from business `economicValue` to a
  location's `economicData` slice — two separate, manually-reconciled
  things, same pattern as Phase 2's `populationData` gap.

## Done when
- `generateBusiness` validates `locationId`, `industry`,
  `economicValue`, `securityRequirement`, and (when provided) `ownerId`
  all correctly, and rejects bad input on each.
- Generating a business with an owner assigns that NPC the
  `business_founder` role automatically; `addEmployee` assigns
  `employee`.
- `addEmployee` is idempotent (no duplicate entries) and validates
  both the business and the npc exist.
- `setBusinessEconomicValue` rejects negative values.
- `getBusinessesAtLocation` reflects reality after generation.
- Regression: Phases 1-2 (`locations.js`, `npcGenesis.js`) unaffected,
  verified by reusing both in the same test run.
