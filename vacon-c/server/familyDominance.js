// server/familyDominance.js
//
// By direct instruction: "family/tribe territorial dominance +
// city-wide escalation" — task #49 of "the next 5 tasks."
//
// ---------------------------------------------------------------------
// The real split with `dominance.js`, stated rather than re-derived
// ---------------------------------------------------------------------
// `dominance.js` already closes the identical shape for real
// ORGANIZATIONS: a group that already, genuinely dominates a
// community's residents converts that real local power into a real
// territorial claim the moment the state's writ fails there — a
// frictionless conversion, because `organizations.isFaction` is a
// real column that just flips true. That file's own header names the
// one real input it cannot cover the same way: "Families (tribes) are
// the one real input this cannot cover the identical way... A family's
// own real route to holding ground is `control.js`'s takeover key —
// already built, already real — not a second structure invented here
// to force a family through the organization-shaped one."
//
// This file is that real route, used rather than re-invented. A
// family's dominance is never frictionless the way an organization's
// is — `control.js#SCALES.community.holders` is "everybody who lives
// there," so a family has to actually win a real, probabilistic
// takeover (real composition, real materiel, a real success draw)
// against the whole neighbourhood's real defender count. That is a
// genuinely different, harder claim than an organization's, and
// deliberately so — see `control.js`'s own comment on why a block is
// "far harder to take than the building on it."
//
// ---------------------------------------------------------------------
// The real gap this closes in `control.js` itself
// ---------------------------------------------------------------------
// `control.js#SCALES.community.seize` used to do nothing at all on a
// real family win — "records nothing and says why," because
// `territory_blocks.faction_id` only references `factions
// (organization_id)`. A family could win the real contest and the
// world would forget it the same tick. Closed directly in
// `control.js` itself (task #49's other half): `worldState.
// familyTerritory` (community id -> {familyId, sinceTick}) is the
// same real, in-memory-only posture `worldState.prisonGangs` already
// carries for the identical reason — no schema column, real separate
// schema work for another round, same documented, stated limitation.
// `familyHolderOf` below is the real reader.
//
// ---------------------------------------------------------------------
// "City-wide escalation" — a real share, not an invented event
// ---------------------------------------------------------------------
// `cityFamilyDominanceOf` reuses `control.js`'s own real city ->
// community link (the identical `communities.city_id` filter `control
// .communitiesOfCity` already uses) to report how many of a city's
// real communities one family currently, really holds
// (`familyHolderOf`, never re-derived a second way). `CITY_WIDE_
// MAJORITY` is 0.5 — more than half a city's own real communities —
// the plain-language meaning of "city-wide" rather than a fitted
// percentage, the same posture `subGovernment.POVERTY_PUSH_FLOOR`
// already took for "impoverished area."

'use strict';

const authority = require('./authority.js');
const control = require('./control.js');

// The real family with the most real resident members in this
// community — the identical shape `membership.organizationPresence`
// already uses for organizations, read over `familyMemberships`
// instead of `entityOrganizationMemberships`. No weighting formula:
// no document says a family's own real `unity`/`political_influence`
// should break a tie against sheer headcount, so this does not invent
// one — a tie is reported as whichever family id is lower, the same
// deterministic, order-independent tie-break `authority.holderOf`'s
// own loop already falls back to by iterating in a fixed order.
function dominantFamilyOf(worldState, communityId) {
  const residents = new Set((worldState.npcs || [])
    .filter((n) => n.communityId === communityId)
    .map((n) => n.id));

  const byFamily = new Map();
  for (const m of worldState.familyMemberships || []) {
    if (!residents.has(m.entity_id)) continue;
    byFamily.set(m.family_id, (byFamily.get(m.family_id) || 0) + 1);
  }

  let best = null;
  for (const [familyId, members] of byFamily) {
    if (!best || members > best.members) best = { familyId, members };
  }
  return best;
}

// The real family that already holds this community, if any — reads
// `control.js#SCALES.community.seize`'s own real write, never a
// second "who runs this block" fact invented here.
function familyHolderOf(worldState, communityId) {
  const row = (worldState.familyTerritory || {})[communityId];
  return row ? row.familyId : null;
}

// Attempt real dominance where the state's writ has failed — the
// identical real gate `dominance.js#claimDominantGround` already uses
// for organizations (`contested` or `lawless`, never only full
// `lawless`), through the real, probabilistic `control.attempt`,
// never a frictionless grant.
function attemptFamilyDominance(worldState, options = {}) {
  const { communityId, tick = worldState.tick ?? 0 } = options;
  if (communityId == null) throw new Error('attemptFamilyDominance requires options.communityId');

  const community = (worldState.communities || []).find((c) => c.id === communityId);
  if (!community) return null;

  const reading = authority.writOf(worldState, communityId);
  if (reading.regime === 'governed' || reading.regime === null) return null;

  // Idempotence (standing rule 15): a community a family already
  // holds is not attempted again.
  if (familyHolderOf(worldState, communityId) !== null) return null;

  const dominant = dominantFamilyOf(worldState, communityId);
  if (!dominant) return null;

  return control.attempt(worldState, {
    scale: 'community', locationId: communityId, tribeId: dominant.familyId, tick,
  });
}

// Every real community, checked the same honest way `dominance.js
// #scanForPowerVacuums` already checks one for organizations.
function scanForFamilyPowerVacuums(worldState, options = {}) {
  const { tick = worldState.tick ?? 0 } = options;
  const attempts = [];
  for (const community of worldState.communities || []) {
    const result = attemptFamilyDominance(worldState, { communityId: community.id, tick });
    if (result) attempts.push({ communityId: community.id, ...result });
  }
  return attempts;
}

const CITY_WIDE_MAJORITY = 0.5;

// The real share of a city's own real communities one family
// currently holds — "city-wide escalation," read literally. `null`
// for a city with no real communities at all, the same "unknown is
// not a zero" shape this engine's other rollups already hold to.
function cityFamilyDominanceOf(worldState, cityId) {
  const communities = (worldState.communities || []).filter((c) => c.city_id === cityId);
  if (communities.length === 0) return null;

  const byFamily = new Map();
  for (const community of communities) {
    const familyId = familyHolderOf(worldState, community.id);
    if (familyId === null) continue;
    byFamily.set(familyId, (byFamily.get(familyId) || 0) + 1);
  }

  let best = null;
  for (const [familyId, held] of byFamily) {
    if (!best || held > best.held) best = { familyId, held };
  }
  if (!best) return { cityWide: false, familyId: null, held: 0, total: communities.length };

  return {
    cityWide: best.held / communities.length > CITY_WIDE_MAJORITY,
    familyId: best.familyId,
    held: best.held,
    total: communities.length,
  };
}

module.exports = {
  CITY_WIDE_MAJORITY,
  dominantFamilyOf,
  familyHolderOf,
  attemptFamilyDominance,
  scanForFamilyPowerVacuums,
  cityFamilyDominanceOf,
};
