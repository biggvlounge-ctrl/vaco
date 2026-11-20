// server/extortion.js
//
// By direct instruction: "extortion mechanic (corrupt forces/gangs/
// tribes vs. arriving businesses)" — task #42 of "the next 5 tasks."
//
// ---------------------------------------------------------------------
// Who can extort, and where — the real "who holds this ground when
// the state does not" this engine already computes, not a second
// territory model invented here
// ---------------------------------------------------------------------
// `authority.writOf`'s real `governed`/`contested`/`lawless` regime
// and `authority.holderOf`'s real strongest-territory-block faction
// are the exact pair `heat.js` and `describeAuthority` already use for
// "who answers for this ground when the state does not" — checked
// directly (`describeAuthority` only ever calls `holderOf` when
// `regime !== 'governed'`) rather than assumed, and followed here the
// same way: a `governed` community has the state's own real,
// complete, already-built answer (`justice.js`'s `judge` → `imprison`
// chain, exactly the reasoning `heat.js`'s own header gives for
// leaving government/police heat out of scope), so no faction ever
// extorts a business there. `contested` and `lawless` both qualify —
// extortion is a lower bar than `corruption.js#runCollapseLooting`'s
// full-collapse gate, because "corrupt forces" exploiting weak-but-
// not-absent state presence is exactly what `contested` already
// measures.
//
// ---------------------------------------------------------------------
// Who gets extorted — a real operating business, never the faction's
// own front
// ---------------------------------------------------------------------
// `properties.operating_organization_id` is the real, already-used
// field `corruption.js#eligiblePropertiesIn` reads the opposite way
// (it requires this to be UNSET for a vacant building to be lootable);
// here it is required to be SET, naming the real business operating
// there. A faction never extorts a property it operates itself —
// checked by excluding the holding faction's own organization id from
// the candidate set, not by a trait or a flag.
//
// ---------------------------------------------------------------------
// Pay or refuse — reusing the real combat trait family rather than
// inventing a "willingness to pay" dimension
// ---------------------------------------------------------------------
// This engine already has a real per-person measure of resisting
// intimidation under threat: `combat.'Composure Under Fire'`, part of
// the same trait family `groupFights.js` already reuses for who
// stands and fights. A business's leader with real Composure at or
// above the trait scale's own neutral centre (50 — the identical
// reused value `roguePolice.CORRUPTION_DEFECTION_THRESHOLD` already
// anchors to for the same reason) refuses the demand; below it, they
// pay. This is a one-shot decision per extortion attempt, never a
// rising value sampled repeatedly — the seventeenth standing rule's
// warning about a repeatedly-sampled threshold does not apply the way
// it did to `resolveAggression`'s escalation floor.
//
// ---------------------------------------------------------------------
// The two real consequences, and why refusal is NOT a call to
// `salvage.stripProperty`
// ---------------------------------------------------------------------
// `salvage.stripProperty` refuses an operated business on purpose —
// its own real, already-enforced "this is somebody's home or
// livelihood, not salvage" rule, which is exactly backwards for what
// a refused extortion demand needs: retaliatory damage to a business
// that is very much still operating. So refusal reduces the property's
// own real `condition` directly, the same direct-mutation pattern
// `salvage.js`/`infrastructure.js`/`vehicles.js` already use for their
// own condition changes, by `VANDALISM_CONDITION_COST` — set equal to
// `salvage.STRIP_CONDITION_COST` (10), the identical real magnitude
// this engine already uses for "a building took a real damage event,"
// rather than a second invented number for what is the same kind of
// event. Refusal also raises real heat between the business's leader
// and the faction via `heat.raiseHeat`, reusing that file's own real
// mechanism rather than a second one, and is recorded as a `property`
// crime — the closest real, already-enumerated category to retaliatory
// damage, the same reuse-the-closest-real-category choice
// `corruption.js` already made picking `property` for collapse looting
// and `fraud` for embezzlement.
//
// Paying moves a real amount of money — `EXTORTION_DEMAND_FRACTION` of
// the business's own real `assets` — out of the business organization
// and into the faction organization, the same direct-mutation pattern
// `corruption.js#runEmbezzlement` already uses for organization assets,
// and is recorded as a `theft` crime — "deprivation, against a
// resident above the poverty line" is the closest real category to
// money taken from an operating business under coercion, not `fraud`
// (no false pretence here) and not `property` (no building touched).
//
// ---------------------------------------------------------------------
// The rate and the fraction — one reused, one flagged
// ---------------------------------------------------------------------
// `EXTORTION_RATE` is `crime.BASE_DEPRIVATION_RISK`, the identical
// real per-person-per-tick order of magnitude `corruption.js` already
// reuses twice for a pressure-driven offence, never a third invented
// rate at a different scale. `EXTORTION_DEMAND_FRACTION` is flagged
// interpretive — no document gives a real extortion demand size — set
// at double `corruption.EMBEZZLEMENT_SKIM_FRACTION` on purpose: an
// open, coercive demand reads as a larger single ask than a secret,
// repeated skim, but still small enough that one demand does not gut a
// business outright.

'use strict';

const crime = require('./crime.js');
const authority = require('./authority.js');
const heat = require('./heat.js');
const salvage = require('./salvage.js');
const entityTraits = require('./entityTraits.js');
const { seededDraw } = require('./seeded.js');

const EXTORTION_RATE = crime.BASE_DEPRIVATION_RISK;

const EXTORTION_DEMAND_FRACTION = 0.02;

// The trait scale's own neutral centre — the identical reused value
// `roguePolice.CORRUPTION_DEFECTION_THRESHOLD` already anchors to,
// never a second, disagreeing "what counts as resistant" cutoff.
const COMPOSURE_REFUSAL_THRESHOLD = 50;

const VANDALISM_CONDITION_COST = salvage.STRIP_CONDITION_COST;

function composureOf(worldState, entityId) {
  if (entityId === null || entityId === undefined) return null;
  const live = entityTraits.getLiveEntity(worldState, entityId);
  const composure = Number(live?.traits?.combat?.['Composure Under Fire']);
  return Number.isFinite(composure) ? composure : null;
}

// Every real organization operating a real property in this
// community, except the faction's own — a faction never extorts
// itself. One row per organization, however many properties it
// operates here.
function operatingBusinessesIn(worldState, communityId, excludeOrganizationId) {
  const orgIds = new Set();
  for (const property of worldState.properties || []) {
    if (property.community_id !== communityId) continue;
    const orgId = property.operating_organization_id;
    if (orgId === null || orgId === undefined) continue;
    if (orgId === excludeOrganizationId) continue;
    orgIds.add(orgId);
  }
  return (worldState.organizations || []).filter((o) => orgIds.has(o.id));
}

// The first real property this organization operates in this
// community — the one a refused demand's retaliation lands on.
function propertyOperatedBy(worldState, communityId, organizationId) {
  return (worldState.properties || []).find((p) => p.community_id === communityId
    && p.operating_organization_id === organizationId) || null;
}

function runExtortion(worldState, tick = worldState.tick ?? 0) {
  const incidents = [];
  for (const community of worldState.communities || []) {
    const writ = authority.writOf(worldState, community.id);
    // The state's own real chain already answers a governed area
    // completely — see this file's own header.
    if (writ.regime === 'governed') continue;

    const factionId = authority.holderOf(worldState, community.id);
    if (factionId === null || factionId === undefined) continue;
    const factionOrg = (worldState.organizations || []).find((o) => o.id === factionId);
    if (!factionOrg) continue;

    const businesses = operatingBusinessesIn(worldState, community.id, factionId);
    for (const org of businesses) {
      const assets = Number(org.assets) || 0;
      if (assets <= 0) continue;

      const draw = seededDraw([worldState.seed ?? 'world', 'extortion-demand', factionId, org.id, tick]);
      if (draw >= EXTORTION_RATE) continue;

      const demand = Math.round(assets * EXTORTION_DEMAND_FRACTION * 100) / 100;
      if (demand <= 0) continue;

      const composure = composureOf(worldState, org.leader_id);
      const refuses = composure !== null && composure >= COMPOSURE_REFUSAL_THRESHOLD;

      if (refuses) {
        const target = propertyOperatedBy(worldState, community.id, org.id);
        if (target) {
          target.condition = Math.max(0, Number(target.condition ?? 0) - VANDALISM_CONDITION_COST);
        }
        heat.raiseHeat(worldState, { entityId: org.leader_id, factionOrganizationId: factionId });
        incidents.push(crime.recordCrime(worldState, {
          category: 'property',
          perpetratorId: factionOrg.leader_id ?? null,
          victimId: org.leader_id ?? null,
          communityId: community.id,
          tick,
          detail: `organization ${factionId} vandalized property of organization ${org.id} `
            + `after a refused extortion demand of ${demand}`,
        }));
      } else {
        org.assets = Math.round((assets - demand) * 100) / 100;
        factionOrg.assets = Math.round(((Number(factionOrg.assets) || 0) + demand) * 100) / 100;
        incidents.push(crime.recordCrime(worldState, {
          category: 'theft',
          perpetratorId: factionOrg.leader_id ?? null,
          victimId: org.leader_id ?? null,
          communityId: community.id,
          tick,
          detail: `organization ${org.id} paid ${demand} to organization ${factionId} `
            + 'under an extortion demand',
        }));
      }
    }
  }
  return incidents;
}

module.exports = {
  EXTORTION_RATE,
  EXTORTION_DEMAND_FRACTION,
  COMPOSURE_REFUSAL_THRESHOLD,
  VANDALISM_CONDITION_COST,
  composureOf,
  operatingBusinessesIn,
  propertyOperatedBy,
  runExtortion,
};
