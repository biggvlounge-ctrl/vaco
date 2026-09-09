# Plan — Territory/Community (block-tier)

## Goal
The other flagged locked-scope gap, alongside Citizen-mode binding.
Scoped per Section 11's exact wording: "Territory/Community
(block-tier)" — not the full City/Region/Civilization hierarchy, and
not one of `CLAUDE.md`'s 9 numbered steps (all complete as of
`dev-docs/phase-9-postgres/`).

## Design
- `server/territory.js`:
  - `generateCity(worldState, options)` — minimal; `region_id` left
    `null` (Region/Civilization generation is out of scope; the column
    has no `NOT NULL` constraint). The Build Prompt's own target is
    literally "one living city — St. Louis," so a real, minimal city
    generator (not a full geography system) is exactly what's asked
    for.
  - `generateCommunity(worldState, options)` — `tier` defaults to
    `'block'`, the locked scope's explicit tier.
  - `generateTerritoryBlock(worldState, options)` — requires
    `factionId` referencing an *existing faction specifically*
    (`territory_blocks.faction_id REFERENCES factions(organization_id)`,
    not any organization — an Organization that isn't a Faction can't
    hold territory per the schema itself, enforced here by checking
    `isFaction`).
  - `resolveTerritoryControl(worldState, block, tick)` — the actual
    "factions/orgs gain or lose territory" mechanic (Build Prompt,
    tick pipeline phase 7). Reads the controlling faction's LIVE
    organization-tier `territory`/`power` traits (`getLiveEntity()`,
    step 8's correctness fix) and transitions the block between
    `contested`/`controlled`/`fortified` on a threshold model
    (`< 40` contested, `40-79` controlled, `>= 80` fortified — an
    interpretive choice, no formula specified in any doc, same
    honesty as every other undocumented formula in this project).
- `tick.js`'s Organization phase — was an explicit no-op since step 8
  ("territory_blocks and faction membership lists don't exist yet").
  Now calls `resolveTerritoryControl()` for every tracked block and
  emits a `territory_status_change` event whenever a block's status
  actually changes.

## Why this specifically unblocks Organization phase, not Migration
Migration phase (step 6 of the pipeline) needs *Property* to relocate
individual NPCs — that system still doesn't exist at all (`CLAUDE.md`
defers "Property beyond the minimum," and there is no minimum built
either). Territory/Community is about *faction-level* control of
blocks, a different concern entirely; it unblocks Organization phase
specifically, which is exactly what the Build Prompt's phase
description says ("factions/orgs gain or lose territory, resources").

## Explicitly NOT in this task
- Region/Civilization generation — `cities.region_id` stays `null`.
- Property, and therefore still no real Migration-phase relocation.
- Wiring the drought cascade itself into faction territory (e.g. a
  resource shortage triggering territorial disputes) — the mechanism
  now exists (`resolveTerritoryControl()` reads real, changeable
  organization traits) but nothing in this pass connects a drought
  event to a faction's `territory`/`power` values specifically. A
  believable next step, not done here.

## Done when
- City/Community/TerritoryBlock generation all work, with correct
  validation (a City name is required; a TerritoryBlock's faction must
  actually be a Faction, not any Organization).
- `resolveTerritoryControl()` correctly transitions a block through
  all three statuses when the controlling faction's live traits are
  moved across each threshold — verified directly, not just for one
  direction.
- Regression: NPC/Organization/Faction/Family generation and the rest
  of the tick pipeline unaffected.
