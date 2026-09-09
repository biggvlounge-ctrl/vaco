# Plan — Minimal Family Engine (locked Day 1 step 6)

## Goal
Build the Family layer from nothing — the architecture doc's own
System Map (Section 2) lists it as "None — Entire layer missing," and
no Family generation code exists in any handoff so far. `CLAUDE.md`
scopes this as "Family (minimal)" — not the full engine (Household vs.
Family distinction, per-member role depth beyond a flat `role` string,
Information Spread Key — all flagged as real gaps in Section 3.11 but
out of scope for "minimal").

## Lesson applied from step 5's correction
Step 5 originally generated all 13 `ORGANIZATION_TRAIT_FAMILIES`
dimensions as `entity_traits` rows, missing that 4 of them
(influence/security/innovation/reputation) already had dedicated
columns on `organizations` — producing two disagreeing values for the
same concept. Fixed retroactively (see
`dev-docs/phase-5-organization-trait-sheet/tasks.md`).

Applied here from the start: `VACANCY_TRAIT_DATABASE_ATTACHMENT.md`'s
`FAMILY_TRAIT_FAMILIES` lists 10 dimensions (unity, loyalty,
reputation, wealth, resources, traditions, leadership,
generationalKnowledge, cooperation, conflictLevel). Cross-checked
against `families`' own columns first:

| Dimension | Schema column | Handling |
|---|---|---|
| unity | `families.unity` (DEFAULT 50) | Direct field, not a trait |
| reputation | `families.reputation` (DEFAULT 50) | Direct field, not a trait |
| conflictLevel | `families.conflict` (DEFAULT 0) | Direct field, not a trait |
| wealth | `families.wealth`, explicitly commented "computed rollup... not independently tracked" | **Computed function** (`getFamilyWealth()`), not stored anywhere — this is standing rule 3 verbatim |
| traditions | `families.traditions` (JSONB) | Direct field (`[]`), not a numeric trait — structurally a list, not a score |
| loyalty, resources, leadership, generationalKnowledge, cooperation | *(no column)* | `entity_traits`, family='family' |

## Design
- `server/familyTraits.js` — the 5 dimensions with no dedicated column.
- `server/traitDefinitions.js` — extended with the family tier (5 more
  rows, `trait_id` 124-128), `FAMILY_DEFINITIONS` export.
- `engine.js#generateFamily(options)` — matches `entities` + `families`
  columns, same merge convention as `generateNPC()`/
  `generateOrganization()`. No `wealth` field on the object at all.
- `engine.js#addFamilyMember(familyId, entityId, role, generationNumber)`
  — matches `family_memberships`; increments `families.total_members`
  (a real stored column, unlike wealth).
- `engine.js#getFamilyWealth(familyId)` — the standing-rule-3-compliant
  computed rollup: sums each member's most recent `individual_finances`
  net worth (`assets + savings - debt`; `income` is a flow, excluded)
  via `family_memberships`. `WorldState.individualFinances` starts
  empty (step 7, real economy, isn't built yet) so this honestly
  returns 0 until that lands — not a stub bug.

## Explicitly NOT in this task
- Household vs. Family distinction (Section 3.11's flagged gap).
- Per-member role validation beyond a free-text field (matches
  `generateNPC()`'s existing permissive `role`/`education`/`religion`).
- Information Spread Key, generational trait inheritance
  (`generateNPC()` "conditioning on parent family's trait sheet," per
  3.10 — explicitly deferred there until "Family Engine lands," which
  this is the minimal version of, not the trait-inheritance follow-up).
- Real `individual_finances` generation — step 7.

## Done when
- Families generate with their 5-dimension trait sheet, no overlap
  with `unity`/`reputation`/`conflict`/`traditions`.
- `addFamilyMember()` correctly updates `total_members`.
- `getFamilyWealth()` returns 0 with no data, and correctly sums
  multiple members' most recent finances once seeded — proving it's
  genuinely computed, not a stored/faked value.
- NPC/Organization generation regression-checked unaffected.
