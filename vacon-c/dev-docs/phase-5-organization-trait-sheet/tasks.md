# Tasks — Organization/Faction Trait Sheet

- [x] Create `server/organizationTraits.js`: `ORGANIZATION_TRAIT_FAMILIES`,
      the 13 dimension names verbatim from
      `VACANCY_TRAIT_DATABASE_ATTACHMENT.md`.
- [x] Extend `server/traitDefinitions.js` to build one combined
      `TRAIT_DEFINITIONS` catalog (individual tier's 114 rows, then
      organization tier's 13, `trait_id` sequential 1..127) and export
      tier-scoped `INDIVIDUAL_DEFINITIONS` / `ORGANIZATION_DEFINITIONS`
      subsets.
- [x] Update `server/entityTraits.js#generateEntityTraits()` to require
      an explicit `definitions` argument (previously defaulted to the
      whole catalog — now unsafe once the catalog spans two tiers).
- [x] Add `engine.js#generateOrganization(options)` — requires
      `options.type` (no schema default exists for it), builds the
      entities+organizations merged object, generates its 13
      `entity_traits` rows via `ORGANIZATION_DEFINITIONS`.
- [x] Add `engine.js#generateFaction(options)` — calls
      `generateOrganization()` (defaulting `type` to `'gang'`), merges
      `color`/`morale`/`factionStatus`/`isFaction` on top.
- [x] Update `engine.js#generateNPC()` to pass `INDIVIDUAL_DEFINITIONS`
      explicitly (was relying on the now-unsafe default).
- [x] Verify against a live `WorldState`:
      - Catalog: 127 total definitions, 114/13 split, sequential
        `trait_id`, organization rows all `family='organization'` and
        exactly matching `ORGANIZATION_TRAIT_FAMILIES`'s 13 names.
      - Regression: NPC generation unaffected — still 20 families /
        114 `entity_traits` rows, no `organization` family present.
      - `generateOrganization({})` throws (no `type` given, and there's
        no schema default to fall back to).
      - `generateOrganization({ type: 'business' })` produces a
        13-trait `organization` sheet, values in range, own id
        sharing the same counter as NPC ids (no collision).
      - `generateFaction({ name: 'Hollow Saints' })` defaults to
        `type: 'gang'`, carries the full 13-trait sheet plus
        `color`/`morale: 50`/`factionStatus: 'controlled'`/
        `isFaction: true`; a second call with `type: 'government'`
        confirms the override works.
      - `applyKeyModifier()` (from step 4) confirmed tier-agnostic:
        successfully wrote a `key_modifier` to an organization's
        `power` trait and recomputed `current_value` correctly — no
        changes needed to that function for this step.
      - Existing Key resolver (`resolveResilience`) re-run against an
        NPC generated after this change — still writes correctly,
        confirming no regression from steps 1-4.
- [x] Commit as its own change, separate from steps 1-4.

## Interpretive choices, flagged for confirmation (see plan.md)
1. Organization-tier dimensions all share `family='organization'`
   (a single tier marker) rather than any sub-grouping — the source
   doc doesn't specify one.
2. Organizations share the NPC id counter, standing in for the
   schema's missing `organizations.id -> entities.id` FK (`npcs` has
   one via `entity_id`; `organizations` doesn't, despite `'organization'`
   being a valid `entities.type` value and `entity_traits`/
   `relationships`/`memories` all requiring a real `entities.id`).
3. `generateFaction()`'s default `type: 'gang'`, matching the only
   concrete example in the handoff package (HOLLOW SAINTS).

## Correction (caught while starting step 6, applied here retroactively)
The original 13-dimension `ORGANIZATION_TRAIT_FAMILIES` generated
`influence`/`security`/`innovation`/`reputation` as `entity_traits`
rows — but those 4 are already real, directly-settable columns on
`organizations` (`DEFAULT 0/0/0/50`), and `generateOrganization()`
*also* set them directly as those fields. Two disagreeing values for
the same concept (`org.influence = 0` vs. `org.traits.organization
.influence` = a random ~50). Fixed: `ORGANIZATION_TRAIT_FAMILIES` is
now the 9 dimensions with no dedicated column (power, membership,
production, territory, resources, leadershipQuality, internalLoyalty,
diplomacy, growthPotential); the other 4 stay as `organizations`'
own fields, set from their schema defaults. `TRAIT_DEFINITIONS` is now
123 total (114 + 9), not 127. Verified: no key overlap between
`org.traits.organization` and the direct fields.

This changes the general approach for any future tier trait sheet
(Family, City, Civilization, Culture): cross-check each dimension name
against that tier's own table columns in
`VACANCY_POSTGRESQL_SCHEMA.sql` *first* — only dimensions with no
dedicated column go through `entity_traits`. Applied from the start in
`dev-docs/phase-6-family-engine/`.

## Next task after this one
Step 6 (build the minimal Family Engine) per `CLAUDE.md`'s locked
order. The `families`/`family_memberships` tables exist in the schema;
no Family generation code exists yet in any handoff.
