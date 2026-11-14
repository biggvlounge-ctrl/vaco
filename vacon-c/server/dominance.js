// server/dominance.js
//
// By direct instruction: "gang, tribes, organizations, religions,
// families could already run a certain amount of a town or city or
// block through drugs, religion, or whatever their organization holds
// power over that community, through business. This will
// automatically put them into a power position when the chaos kicks
// off. And then it is, from there, it is their security and
// infrastructure that maintains it or loses it."
//
// ---------------------------------------------------------------------
// The "already run a certain amount" half needed nothing new
// ---------------------------------------------------------------------
// `membership.organizationPresence(worldState, communityId)` already
// answers "who holds real power over this community, through what" —
// real member count per real organization resident here, already
// tagged by `type` (gang, business, religion, government, ...) and by
// the organization's own real `influence` column. Nothing invented:
// this file's only new work is reading that existing answer and
// deciding what happens to the one it names ONCE the state's own writ
// stops reaching the place at all.
//
// ---------------------------------------------------------------------
// "Automatically put them into a power position when the chaos kicks
// off" — the real crossing, and the real conversion
// ---------------------------------------------------------------------
// `authority.writOf` is the same already-measured regime
// (`governed`/`contested`/`lawless`) `roguePolice.js` and
// `justice.js#runCorruptGuardBreaks` both already key on. This fires
// on the identical, slightly wider gate `runCorruptGuardBreaks` chose
// over `roguePolice.js`'s stricter one: `contested` OR `lawless`, not
// only full `lawless` — the organization that already dominates this
// community's own residents does not need the area to finish
// collapsing before it starts asserting real control; it is already
// standing on the ground.
//
// `territory_blocks.faction_id` can only ever name a real
// `isFaction: true` organization — `territory.generateTerritoryBlock`'s
// own hard check. The dominant organization here very likely is NOT
// one yet: `orgArchetypes.js`'s `'religious order'` entry deliberately
// set `isFaction: false` ("persuades rather than holds ground"), and
// an ordinary `business` is never generated as a faction either. That
// decision stands for a GOVERNED area — nothing here reopens it there.
// What changes the moment the writ fails is the real-world shape the
// user is naming: a congregation, a cartel's storefront, a dominant
// employer that already commands a community's loyalty through
// business or belief does not need to found a new organization the
// way `roguePolice.js`'s defecting officers do — it already exists,
// already has the people, and the only thing missing is the formal
// territorial claim. So the conversion is a real, visible state change
// on the organization itself (`organization.isFaction = true`) rather
// than a second organization founded alongside it, followed by the
// identical "try to use that force" step `roguePolice.js` already
// established: a real `generateTerritoryBlock` call, resolved this
// same tick by the real, already-ticking `resolveTerritoryControl`.
//
// ---------------------------------------------------------------------
// "From there, it is their security and infrastructure that maintains
// it or loses it" — already real, nothing added
// ---------------------------------------------------------------------
// `tick.js#runOrganizationPhase` already calls
// `territory.resolveTerritoryControl` for every real territory block,
// every tick, reading the holding organization's own LIVE
// `organization.power`/`organization.territory` traits
// (`getLiveEntity`, the ninth standing rule) to decide whether a hold
// stays `controlled`, tips to `fortified`, or slips to `contested`.
// That is the real, ongoing "security and infrastructure" the user is
// describing, and it needed no new code here — converting the
// organization and claiming the block is the only new event; staying
// in power or losing it afterward was already a live mechanism before
// this file existed.
//
// ---------------------------------------------------------------------
// Excluded on purpose, not by omission
// ---------------------------------------------------------------------
// **Government-type organizations are never a candidate**, however
// much local presence one measures (its own officers, stationed
// residents). The premise of this whole mechanic is the state's own
// writ failing here; converting the failing government's own
// organization into the beneficiary of its own collapse would be
// reporting the cause as the effect.
//
// **Families (tribes) are the one real input this cannot cover the
// identical way, and that is named rather than papered over.**
// `territory_blocks.faction_id` references `organizations.id`; a
// family is a distinct root entity (standing rule 4's own parent/
// subtype split does not make `families` a subtype of
// `organizations`). A family's own real route to holding ground is
// `control.js`'s takeover key — already built, already real — not a
// second structure invented here to force a family through the
// organization-shaped one.

'use strict';

const authority = require('./authority.js');
const membership = require('./membership.js');
const territory = require('./territory.js');

// The real organization that already, genuinely dominates this
// community's residents — the most real local members
// (`membership.organizationPresence`'s own count), the organization's
// own real `influence` breaking a tie. Never a weighting formula: no
// document says how many members a point of influence is worth, so
// this does not invent one.
function dominantOrganizationOf(worldState, communityId) {
  const presence = membership.organizationPresence(worldState, communityId)
    .filter((row) => row.type !== 'government');
  let best = null;
  for (const row of presence) {
    if (!best || row.members > best.members
      || (row.members === best.members && (row.influence ?? 0) > (best.influence ?? 0))) {
      best = row;
    }
  }
  return best;
}

// Returns null for every honest reason nothing happens: the community
// does not exist, the state's writ still reaches it (`governed`) or
// has never been measured (`null`), nobody real dominates this
// community at all, or the dominant organization already holds real
// ground here (idempotence — the fifteenth standing rule — a second
// call on an unchanged world claims nothing a second time).
function claimDominantGround(worldState, options = {}) {
  const { communityId, tick = worldState.tick ?? 0 } = options;
  if (communityId == null) throw new Error('claimDominantGround requires options.communityId');

  const community = (worldState.communities || []).find((c) => c.id === communityId);
  if (!community) return null;

  const reading = authority.writOf(worldState, communityId);
  if (reading.regime === 'governed' || reading.regime === null) return null;

  const dominant = dominantOrganizationOf(worldState, communityId);
  if (!dominant) return null;

  const organization = (worldState.organizations || [])
    .find((o) => o.id === dominant.organizationId);
  if (!organization) return null;

  const alreadyHeld = (worldState.territoryBlocks || []).some(
    (b) => b.faction_id === organization.id && b.community_id === communityId,
  );
  if (alreadyHeld) return null;

  // The conversion: a real, pre-existing local power converts into a
  // real territorial claim the moment the state's writ fails here.
  organization.isFaction = true;

  const block = territory.generateTerritoryBlock(worldState, {
    factionId: organization.id,
    cityId: community.city_id,
    communityId,
  });
  territory.resolveTerritoryControl(worldState, block, tick);

  return {
    organizationId: organization.id,
    communityId,
    dominantType: dominant.type,
    dominantMembers: dominant.members,
    territoryBlockId: block.id,
    territoryStatus: block.status,
  };
}

// Every real community, checked the same honest way `claimDominantGround`
// itself checks one — see `roguePolice.js#scanForCollapsedPolicing`'s
// own precedent for this exact shape.
function scanForPowerVacuums(worldState, options = {}) {
  const { tick = worldState.tick ?? 0 } = options;
  const claimed = [];
  for (const community of worldState.communities || []) {
    const result = claimDominantGround(worldState, { communityId: community.id, tick });
    if (result) claimed.push(result);
  }
  return claimed;
}

module.exports = {
  dominantOrganizationOf,
  claimDominantGround,
  scanForPowerVacuums,
};
