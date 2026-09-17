// server/succession.js
//
// What a death sets in motion.
//
// **Nothing, before this.** `mortality.js` moves a dead person out of
// `worldState.npcs`, which makes them structurally incapable of being
// iterated as a person — and that is all it does, deliberately. Its own
// comment on employment says why:
//
//   "The record is left `active` rather than ended: ending somebody's
//   employment because they died is a decision about inheritance and
//   succession, and inventing it here would put a second, quieter
//   answer next to whatever gets built for that."
//
// This is that. Measured, a death left five things dangling:
//
//   employment      the contract stays `active` forever. Payroll skips
//                   the dead by asking, so nobody is paid — but the
//                   post is never vacant and never refilled.
//   property        `ownership_records` keeps a corpse as the current
//                   owner, so `getCurrentOwner` returns a dead person
//                   and `home_ownership_rate` counts them.
//   inventory       holdings stay with the body. Whatever somebody was
//                   carrying leaves the economy permanently.
//   leadership      `organizations.leader_id` and `families.head_npc_id`
//                   point at somebody who is not there.
//   the line        `families.generation` never advances, so a family
//                   that has buried its founder is still on generation
//                   one.
//
// ---------------------------------------------------------------------
// Called from `recordDeath`, not from the tick
//
// Same choice as `membership.releaseDeceased` and
// `behavior.releaseDeceased`, and for the same reason: a death can
// happen through `runMortality`, through `killEntity`, or through a
// scenario, and a cleanup wired into the tick would miss the last two.
// One choke point, guaranteed.
//
// No cycle: this module reads property, inventory, economy and
// membership, and none of those knows about mortality.
//
// ---------------------------------------------------------------------
// What it does NOT do
//
// **It does not appoint a new leader.** When an organization's leader
// dies the post goes vacant and an event says so. Choosing a successor
// is a political act — `politics.js` has elections, factions have
// morale and loyalty, and quietly promoting the longest-serving member
// would put an invented rule where a real mechanism belongs.
//
// **It does not create a family.** An heir has to already be somebody's
// relation; `family_memberships` is where that lives.

'use strict';

const economy = require('./economy.js');
const inventory = require('./inventory.js');
const membership = require('./membership.js');
const property = require('./property.js');

//: The order an estate passes in, drawn from `family_memberships.role`'s
//: own enumeration in the schema — heir, child, partner, sibling,
//: grandparent, parent, guardian are all real values of that column.
//:
//: Flagged interpretive: no document gives an order of succession. This
//: one is `heir` first because the schema has a role that says exactly
//: that, then descending by closeness. Within a role the ELDEST living
//: candidate takes it, which is the conventional default and the single
//: line to change for a world that does it differently.
const HEIR_PRIORITY = ['heir', 'child', 'partner', 'sibling', 'grandparent', 'parent', 'guardian'];

// Who inherits from this person, or null.
//
// **Living relations only.** A world that has lost a whole household
// has no heir, and passing an estate to another corpse would move the
// problem rather than solve it.
function heirFor(worldState, entityId) {
  const families = (worldState.familyMemberships || [])
    .filter((m) => m.entity_id === entityId)
    .map((m) => m.family_id);
  if (families.length === 0) return null;

  const living = new Map(worldState.npcs.map((n) => [n.id, n]));
  const candidates = (worldState.familyMemberships || [])
    .filter((m) => m.entity_id !== entityId && families.includes(m.family_id))
    .map((m) => ({ membership: m, npc: living.get(m.entity_id) }))
    .filter((c) => c.npc);

  for (const role of HEIR_PRIORITY) {
    const matching = candidates.filter((c) => c.membership.role === role);
    if (matching.length === 0) continue;
    // Eldest: the smallest `createdTick` is the earliest born.
    return matching.reduce((eldest, c) => (
      (c.npc.createdTick ?? 0) < (eldest.npc.createdTick ?? 0) ? c : eldest
    )).npc;
  }

  // A relation with no role, or a role this list does not name, still
  // beats nobody — `family_memberships.role` is nullable and worldgen
  // assigns a generic 'member'.
  if (candidates.length > 0) {
    return candidates.reduce((eldest, c) => (
      (c.npc.createdTick ?? 0) < (eldest.npc.createdTick ?? 0) ? c : eldest
    )).npc;
  }
  return null;
}

// -- the estate ---------------------------------------------------------

// Everything the dead person owned, transferred or released.
//
// Returns a report rather than throwing on the parts it cannot do: a
// death must always complete, and an estate with no heir is a real
// outcome rather than an error.
function settleEstate(worldState, options = {}) {
  const { entityId, tick = worldState.tick ?? 0 } = options;
  const heir = heirFor(worldState, entityId);

  const report = {
    entityId,
    heirId: heir ? heir.id : null,
    employmentEnded: 0,
    propertiesTransferred: 0,
    propertiesUnclaimed: 0,
    itemsTransferred: 0,
    itemsLost: 0,
    postsVacated: [],
    generationAdvanced: false,
  };

  // ---- employment ----------------------------------------------------
  // The post is vacant, not inherited. A job is a relationship with an
  // employer rather than an asset, and handing one down would invent a
  // rule about hereditary employment that no document describes.
  for (const record of worldState.employmentRecords || []) {
    if (record.entity_id !== entityId || record.status !== 'active') continue;
    record.status = 'ended';
    report.employmentEnded += 1;
  }

  // ---- property ------------------------------------------------------
  // `ownership_records` is append-only history, so inheritance is a new
  // row rather than an edit — the dead person really did own it until
  // they died, and rewriting that would erase the fact.
  //
  // `acquired_method: 'inherited'` is one of the schema's own eight
  // values. It was there from the start, waiting for this.
  // `getHoldings` returns { count, totalValue, properties } — the
  // list is the third field, not the object itself.
  for (const holding of property.getHoldings(worldState, entityId).properties) {
    if (heir) {
      property.recordOwnership(worldState, {
        entityId: holding.property.id,
        ownerEntityId: heir.id,
        ownerType: 'individual',
        acquiredMethod: 'inherited',
        tick,
      });
      report.propertiesTransferred += 1;
    } else {
      // **`owner_type: 'none'` is a real schema value**, and this is
      // what it is for: a building whose owner died with nobody to
      // leave it to is unclaimed, which is a different fact from
      // unowned-from-the-start and from still-owned-by-a-corpse.
      property.recordOwnership(worldState, {
        entityId: holding.property.id,
        ownerEntityId: entityId,
        ownerType: 'none',
        acquiredMethod: 'inherited',
        tick,
      });
      report.propertiesUnclaimed += 1;
    }
  }

  // ---- inventory -----------------------------------------------------
  // **Aggregated by item NAME, not iterated per holding**, and that
  // distinction crashed a tick before it was found.
  //
  // `inventory.take` works by name and spends across every holding of
  // it, worst condition first. Iterating the holdings instead — two
  // ropes in different condition are two rows — meant the first
  // transfer could take from the SECOND row, and the loop then reached
  // that row with a quantity already spent. `take` refuses a quantity
  // of 0, so a death with two conditions of one item threw out of
  // `runMortality` and took the whole tick with it. It surfaced only on
  // a 300-tick run of a 100-person world, because it needs somebody to
  // die holding two grades of the same thing.
  const byItem = new Map();
  for (const holding of inventory.holdingsOf(worldState, entityId)) {
    const quantity = Number(holding.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) continue;
    byItem.set(holding.item_name, (byItem.get(holding.item_name) ?? 0) + quantity);
  }

  for (const [itemName, quantity] of byItem) {
    if (heir) {
      inventory.transfer(worldState, {
        fromId: entityId, toId: heir.id, itemName, quantity, tick,
      });
      report.itemsTransferred += quantity;
    } else {
      // Nobody to take it. The goods leave the world rather than
      // sitting in a corpse's hands forever, which would make every
      // `valueOfHoldings` over a population quietly wrong.
      inventory.take(worldState, { entityId, itemName, quantity });
      report.itemsLost += quantity;
    }
  }

  // ---- savings -------------------------------------------------------
  // Money follows the goods. A fresh `individual_finances` row for
  // both, because that table is a history of a position — see
  // `barter.exchange`, which made the same choice for the same reason.
  const estate = economy.getLatestFinances(worldState, entityId);
  const savings = Number(estate?.savings ?? 0);
  const assets = Number(estate?.assets ?? 0);
  if (heir && (savings > 0 || assets > 0)) {
    const heirFinances = economy.getLatestFinances(worldState, heir.id);
    economy.generateIndividualFinances(worldState, heir.id, {
      income: heirFinances?.income ?? 0,
      savings: (heirFinances?.savings ?? 0) + savings,
      debt: heirFinances?.debt ?? 0,
      assets: (heirFinances?.assets ?? 0) + assets,
      tick,
    });
    economy.generateIndividualFinances(worldState, entityId, {
      income: 0, savings: 0, debt: estate?.debt ?? 0, assets: 0, tick,
    });
    report.estateValue = savings + assets;
  }

  // ---- leadership ----------------------------------------------------
  // Vacated, never filled. See the header: choosing a successor is a
  // political act and `politics.js` is where that belongs.
  for (const organization of worldState.organizations || []) {
    if (organization.leader_id === entityId) {
      organization.leader_id = null;
      report.postsVacated.push({ kind: 'organization', id: organization.id });
    }
  }
  for (const community of worldState.communities || []) {
    if (community.leadership_npc_id === entityId) {
      community.leadership_npc_id = null;
      report.postsVacated.push({ kind: 'community', id: community.id });
    }
  }
  for (const city of worldState.cities || []) {
    if (city.mayor_npc_id === entityId) {
      city.mayor_npc_id = null;
      report.postsVacated.push({ kind: 'city', id: city.id });
    }
  }

  // ---- the family ----------------------------------------------------
  // A family whose head has died gets the heir as head and advances a
  // generation. **This is what makes `families.generation` mean
  // something** — it was 1 for every family in every world, because
  // only a birth could ever have advanced it and births set the
  // CHILD's generation, not the family's.
  for (const family of worldState.families || []) {
    if (family.head_npc_id !== entityId) continue;
    family.head_npc_id = heir ? heir.id : null;
    if (heir) {
      family.generation = (Number(family.generation) || 1) + 1;
      report.generationAdvanced = true;
    } else {
      report.postsVacated.push({ kind: 'family', id: family.id });
    }
    family.updatedTick = tick;
  }

  // Membership rosters are released by `membership.releaseDeceased`,
  // which `recordDeath` already calls — not repeated here, because two
  // places doing the same cleanup is how they drift.
  void membership;

  return report;
}

module.exports = {
  HEIR_PRIORITY,
  heirFor,
  settleEstate,
};
