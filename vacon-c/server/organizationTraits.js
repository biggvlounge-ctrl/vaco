// server/organizationTraits.js
//
// Organization-tier trait data — locked Day 1 step 5 ("upgrade
// factions to the full trait sheet"). Faction is an Organization
// subtype (CLAUDE.md standing rule 4: "Organization is a parent
// table; Faction/Business are subtypes, not separate root entities"),
// so "the full trait sheet" for factions means the full Organization
// tier-level trait sheet from VACANCY_TRAIT_DATABASE_ATTACHMENT.md's
// ORGANIZATION_TRAIT_FAMILIES — the `factions` table itself holds no
// trait data of its own, only color/morale/status.
//
// That source doc lists 13 dimensions: power, influence, membership,
// production, innovation, security, territory, resources,
// leadershipQuality, internalLoyalty, diplomacy, reputation,
// growthPotential. CORRECTION (caught while starting step 6, applies
// retroactively to step 5): 4 of those — influence, security,
// innovation, reputation — are already real, directly-settable columns
// on VACANCY_POSTGRESQL_SCHEMA.sql's `organizations` table (with their
// own DEFAULT 0/0/0/50), not rollups or placeholders. Generating them
// *again* here as entity_traits rows would produce two disagreeing
// values for the same concept (engine.js originally did exactly that —
// org.influence = 0 from the organizations-shaped field, vs.
// org.traits.organization.influence = a random ~50 from entity_traits).
// Those 4 are excluded below; engine.js#generateOrganization() sets
// them directly from the organizations table's own columns/defaults
// instead. The remaining 9 dimensions have no dedicated column
// anywhere in the schema, so they go through entity_traits, same as
// before.
//
// Unlike individual-tier TRAIT_FAMILIES (family -> [many trait names]
// per domain), these are flat, directly-scored dimensions — the source
// doc lists them as one set, not grouped into sub-families.
// Interpretive choice, not specified directly: each becomes its own
// trait_definitions row with family='organization' (a single tier
// marker) and name=the dimension itself — flagged in
// dev-docs/phase-5-organization-trait-sheet/tasks.md for confirmation.

'use strict';

const ORGANIZATION_TRAIT_FAMILIES = [
  'power', 'membership', 'production', 'territory', 'resources',
  'leadershipQuality', 'internalLoyalty', 'diplomacy', 'growthPotential',
];

module.exports = {
  ORGANIZATION_TRAIT_FAMILIES,
};
