// server/traitDefinitions.js
//
// Builds the trait_definitions catalog (VACANCY_POSTGRESQL_SCHEMA.sql,
// Layer 1-2), spanning every tier that has trait data so far:
// individual (traits.js, step 2), organization (organizationTraits.js,
// step 5 — "upgrade factions to the full trait sheet"), and family
// (familyTraits.js, step 6 — "the minimal Family Engine"). This is the
// "definition" half of the definition/instance split; server/
// entityTraits.js is the "instance" half (entity_traits).
//
// No per-trait tuning is specified anywhere in the handoff package, so
// every definition uses the schema's own column defaults verbatim
// (min_value=0, max_value=100, default_value=50, mutation_chance=0.05,
// inheritance_chance=0.5, growth_rate=0.01, decay_rate=0.005,
// visible=true, stackable=false, locked=false) — the literal DEFAULT
// clauses from the schema, not invented values.
//
// trait_id is assigned 1-based, tiers appended in the order they were
// built (individual, then organization, then family), mirroring
// BIGSERIAL semantics: a stable, sequential integer PK assigned once
// at row-creation time, not reassigned when a later tier is added.
//
// trait_definitions itself has no `tier` column (it's schema-literal
// — nothing here adds one), so tier membership is inferred from
// `family`. Each tier's dimensions were cross-checked against that
// tier's own table columns first (see organizationTraits.js's and
// familyTraits.js's header comments) — a dimension only becomes an
// entity_traits row if the schema has no dedicated column for it
// already; otherwise it's a direct field on the generated object
// instead (set in engine.js), to avoid two disagreeing sources of
// truth for the same concept (the mistake step 5 originally made and
// then corrected). entityTraits.js's generateEntityTraits() requires
// callers to pass a tier-scoped subset explicitly — there is no
// "generate one row per definition, regardless of tier" default,
// specifically to avoid one tier picking up another's traits.

'use strict';

const { TRAIT_FAMILIES } = require('./traits.js');
const { ORGANIZATION_TRAIT_FAMILIES } = require('./organizationTraits.js');
const { FAMILY_TRAIT_FAMILIES } = require('./familyTraits.js');

function schemaDefaults(name, family) {
  return {
    name,
    family,
    description: null,
    min_value: 0,
    max_value: 100,
    default_value: 50,
    mutation_chance: 0.05,
    inheritance_chance: 0.5,
    growth_rate: 0.01,
    decay_rate: 0.005,
    visible: true,
    stackable: false,
    locked: false,
  };
}

const TRAIT_DEFINITIONS = [];

// Individual tier — 20 families, 114 traits (see dev-docs/phase-1-trait-split/).
for (const [family, traitNames] of Object.entries(TRAIT_FAMILIES)) {
  for (const name of traitNames) {
    TRAIT_DEFINITIONS.push({ trait_id: TRAIT_DEFINITIONS.length + 1, ...schemaDefaults(name, family) });
  }
}
const INDIVIDUAL_DEFINITION_COUNT = TRAIT_DEFINITIONS.length;

// Organization tier — 9 flat dimensions after step 5's correction
// (see dev-docs/phase-5-organization-trait-sheet/tasks.md).
for (const name of ORGANIZATION_TRAIT_FAMILIES) {
  TRAIT_DEFINITIONS.push({ trait_id: TRAIT_DEFINITIONS.length + 1, ...schemaDefaults(name, 'organization') });
}
const ORGANIZATION_DEFINITION_END = TRAIT_DEFINITIONS.length;

// Family tier — 5 flat dimensions (see dev-docs/phase-6-family-engine/).
for (const name of FAMILY_TRAIT_FAMILIES) {
  TRAIT_DEFINITIONS.push({ trait_id: TRAIT_DEFINITIONS.length + 1, ...schemaDefaults(name, 'family') });
}

const INDIVIDUAL_DEFINITIONS = TRAIT_DEFINITIONS.slice(0, INDIVIDUAL_DEFINITION_COUNT);
const ORGANIZATION_DEFINITIONS = TRAIT_DEFINITIONS.slice(INDIVIDUAL_DEFINITION_COUNT, ORGANIZATION_DEFINITION_END);
const FAMILY_DEFINITIONS = TRAIT_DEFINITIONS.slice(ORGANIZATION_DEFINITION_END);

// (family, name) -> trait_id, and trait_id -> definition. Used by
// entityTraits.js and engine.js to build/serialize/modify entity_traits
// rows without a linear scan per lookup.
const TRAIT_ID_BY_FAMILY_NAME = new Map(
  TRAIT_DEFINITIONS.map((d) => [`${d.family} ${d.name}`, d.trait_id])
);
const DEFINITION_BY_ID = new Map(TRAIT_DEFINITIONS.map((d) => [d.trait_id, d]));

function getTraitId(family, name) {
  return TRAIT_ID_BY_FAMILY_NAME.get(`${family} ${name}`);
}

function getDefinition(traitId) {
  return DEFINITION_BY_ID.get(traitId);
}

module.exports = {
  TRAIT_DEFINITIONS,
  INDIVIDUAL_DEFINITIONS,
  ORGANIZATION_DEFINITIONS,
  FAMILY_DEFINITIONS,
  getTraitId,
  getDefinition,
};
