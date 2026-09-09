// server/familyTraits.js
//
// Family-tier trait data — locked Day 1 step 6 ("build the minimal
// Family Engine"). VACANCY_TRAIT_DATABASE_ATTACHMENT.md's
// FAMILY_TRAIT_FAMILIES lists 10 dimensions: unity, loyalty,
// reputation, wealth, resources, traditions, leadership,
// generationalKnowledge, cooperation, conflictLevel.
//
// Applying the lesson from step 5's correction (see
// dev-docs/phase-5-organization-trait-sheet/tasks.md): cross-check
// each dimension against `families`' own columns in
// VACANCY_POSTGRESQL_SCHEMA.sql *before* deciding it needs an
// entity_traits row. Four don't:
//   - unity      -> families.unity      (DEFAULT 50, real column)
//   - reputation -> families.reputation (DEFAULT 50, real column)
//   - conflictLevel -> families.conflict (DEFAULT 0, real column;
//                       name differs slightly but is unambiguously
//                       the same concept — there's no other candidate)
//   - wealth     -> families.wealth, and explicitly NOT a directly-set
//                   value at all — the schema comments it "computed
//                   rollup from individual_finances of members, not
//                   independently tracked", which is standing rule 3
//                   verbatim ("Never duplicate computable rollups...
//                   Family Wealth are all computed, never stored").
//                   engine.js#getFamilyWealth() computes this live;
//                   nothing stores a wealth field on the family object.
// A fifth, `traditions`, maps to families.traditions but that column
// is JSONB, not a 0-100 score — structurally a list of traditions, not
// a trait. Handled as its own field (default `[]`), not an
// entity_traits row.
//
// That leaves 5 dimensions with no dedicated column anywhere in the
// schema — these go through entity_traits, same pattern as
// Organization's remaining 9.

'use strict';

const FAMILY_TRAIT_FAMILIES = [
  'loyalty', 'resources', 'leadership', 'generationalKnowledge', 'cooperation',
];

module.exports = {
  FAMILY_TRAIT_FAMILIES,
};
