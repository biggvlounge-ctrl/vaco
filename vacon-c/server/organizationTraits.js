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

// ---------------------------------------------------------------------
// cohesionOf — the organization-tier sibling of `familyTraits.cohesionOf`
// ---------------------------------------------------------------------
// Built for the training/cohesion round ("a small organization that is
// congruent and all act as one is more valuable than a large
// organization... that don't act as one"), which needed a real
// cohesion score for an ORGANIZATION the same way `familyTraits
// .cohesionOf` already gives one for a family.
//
// **Same formula shape, one real asymmetry, stated rather than
// papered over.** `familyTraits.cohesionOf` is `((unity + cooperation)
// / 2 / 100) * (1 - conflict / 100)`, where `unity` and `conflict` are
// STORED, slow-moving stocks (`families.unity`/`.conflict`, moved a
// little at a time by `advanceCohesion`) and `cooperation` is a live
// trait. Organizations have no equivalent stored stock — no
// `organizations.unity` or `.conflict` column exists, and adding one
// is a real, separate, future schema change, not folded into this
// round. So this function computes its "unity" and "conflict" terms
// LIVE instead, straight off `relationships.trust`/`.conflict` between
// the organization's own real current members, every time it is
// called, rather than off a persisted figure with its own momentum. An
// organization's cohesion can therefore swing in a single tick where a
// family's cannot — an honest difference in what each entity type's
// schema actually offers, not a design inconsistency.
//
// `internalLoyalty` (the real, already-generated
// `ORGANIZATION_TRAIT_FAMILIES` dimension above) stands in for
// `cooperation`'s role — the live trait half of the pull term, read
// through `getLiveEntity` per standing rule 9, never the frozen sheet.
//
// Returns null for an organization that does not exist, exactly like
// the family version. A real organization with fewer than two living
// members (so no internal relationship can exist) still gets a score —
// `internalLoyalty` alone carries the pull term, with no trust reading
// to average in, the same "unknown is not a zero" treatment a family
// with no measurable relationships gets from `unityTarget`/
// `conflictTarget` returning null.
function cohesionOf(worldState, organizationId) {
  const organization = (worldState.organizations || []).find((o) => o.id === organizationId);
  if (!organization) return null;

  // eslint-disable-next-line global-require
  const membership = require('./membership.js');
  // eslint-disable-next-line global-require
  const { getLiveEntity } = require('./entityTraits.js');

  const members = membership.membersOf(worldState, organizationId);
  const ids = new Set(members.map((m) => m.id));

  let meanTrust = null;
  let meanConflict = 0;
  if (ids.size >= 2) {
    const internal = (worldState.relationships || []).filter(
      (r) => r.entity_a_id !== r.entity_b_id && ids.has(r.entity_a_id) && ids.has(r.entity_b_id),
    );
    const trusts = internal.map((r) => Number(r.trust)).filter(Number.isFinite);
    const conflicts = internal.map((r) => Number(r.conflict)).filter(Number.isFinite);
    if (trusts.length > 0) meanTrust = trusts.reduce((a, b) => a + b, 0) / trusts.length;
    if (conflicts.length > 0) meanConflict = conflicts.reduce((a, b) => a + b, 0) / conflicts.length;
  }

  const live = getLiveEntity(worldState, organizationId);
  const loyalty = Number(live?.traits?.organization?.internalLoyalty ?? 50);
  const trustTerm = meanTrust ?? 50;

  const pull = ((trustTerm + loyalty) / 2) / 100;
  const drag = 1 - Math.max(0, Math.min(1, meanConflict / 100));
  return Math.round(Math.max(0, Math.min(1, pull * drag)) * 10000) / 10000;
}

module.exports = {
  ORGANIZATION_TRAIT_FAMILIES,
  cohesionOf,
};
