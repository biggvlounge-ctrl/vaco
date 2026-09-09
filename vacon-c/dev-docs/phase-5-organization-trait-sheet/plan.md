# Plan — Upgrade factions to the full trait sheet (locked Day 1 step 5)

## Goal
Give Organizations (and, since Faction is an Organization subtype per
`CLAUDE.md` standing rule 4, Factions by extension) the full
tier-level trait sheet: `ORGANIZATION_TRAIT_FAMILIES` — power,
influence, membership, production, innovation, security, territory,
resources, leadershipQuality, internalLoyalty, diplomacy, reputation,
growthPotential (13 dimensions), from
`VACANCY_TRAIT_DATABASE_ATTACHMENT.md`.

No prior faction code existed in any handoff so far to literally
"upgrade" — `CLAUDE.md` describes an "already running... Faction
system (territory, morale, status resolution)" but that code was never
included in what was given. This builds the full-trait-sheet version
fresh, following the schema and the definition/instance split pattern
already proven for individuals (steps 1-2).

## Design
- `server/organizationTraits.js` — the 13 flat dimension names.
- `server/traitDefinitions.js` — extended to build ONE combined
  `TRAIT_DEFINITIONS` catalog spanning both tiers (individual, then
  organization), plus tier-scoped `INDIVIDUAL_DEFINITIONS` /
  `ORGANIZATION_DEFINITIONS` subsets so a caller can't accidentally
  generate the wrong tier's traits for an entity.
- `server/entityTraits.js#generateEntityTraits()` — now takes an
  explicit `definitions` argument (no default) instead of always using
  the full catalog, forcing every caller to state which tier applies.
- `engine.js#generateOrganization()` — new, matches the `entities` +
  `organizations` column shapes, same merge-into-one-object convention
  `generateNPC()` established. Gives the org its full 13-dimension
  trait sheet via the same `entity_traits` machinery as NPCs.
- `engine.js#generateFaction()` — calls `generateOrganization()` (this
  *is* "upgrading factions to the full trait sheet" — factions
  themselves carry no trait data, only `color`/`morale`/`status`) and
  merges the `factions` subtype columns on top of that same object.

## Interpretive choices — flagged in tasks.md for confirmation
1. Each of the 13 organization dimensions becomes its own
   `trait_definitions` row with `family='organization'` — the source
   doc doesn't show sub-groupings for tier-level sheets the way
   individual `TRAIT_FAMILIES` groups traits under domains, so a single
   tier marker is the most direct, literal reading.
2. `organizations.id` is declared as its own independent `BIGSERIAL` in
   the schema, not `REFERENCES entities(id)` the way `npcs.entity_id`
   is — but `entities.type` lists `'organization'` as valid, and
   `entity_traits`/`relationships`/`memories` all FK to `entities(id)`.
   Treated organizations as sharing the same id space as NPCs (both
   drawn from the same counter) so those FKs are actually satisfiable;
   flagged as a likely schema gap, not silently worked around.
3. `generateFaction()` defaults `type` to `'gang'` — the only concrete
   faction example anywhere in the handoff package (Section 13.5's
   HOLLOW SAINTS gang faction) — overridable to any valid
   `organizations.type`.

## Explicitly NOT in this task
- Wiring Key resolvers to operate on organizations (they're
  tier-agnostic already — `applyKeyModifier()` works on any entity —
  but none of the 7 existing resolvers are organization-flavored; that
  wasn't asked for here).
- A separate `WorldState.factions` array mirroring the literal
  `factions` table row-for-row — factions fields are merged onto the
  same object as their organization, matching the flat-object
  convention `generateNPC()` set, not a new storage pattern.
- Business/Government subtypes — same pattern as Faction, not asked
  for by this step specifically.

## Done when
- Organizations generate with all 13 tier-level traits, verified
  in-range and structurally correct.
- Factions generate with the same 13 traits (via the underlying
  Organization) plus their own `color`/`morale`/`factionStatus`.
- NPC generation is provably unaffected (regression check): still 20
  families / 114 traits, no organization-tier leakage.
