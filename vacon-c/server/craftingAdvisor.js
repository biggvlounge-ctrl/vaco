// server/craftingAdvisor.js
//
// By direct instruction: "the different inventory from food to things
// will also expand into things to sell as long as the right person
// is around... turning something, making something out of nothing
// through the different pieces, random pieces of different things...
// is what the AI has. It looks at your inventory, it looks at your
// group members, and it looks what it has, and the AI will make an
// NPC make a suggestion... of what you could do with those items by
// the accumulation of what you have."
//
// ---------------------------------------------------------------------
// The conversions themselves already exist — this is the fourth real
// "AI" advisor this engine builds, not a new crafting system
// ---------------------------------------------------------------------
// "Cereal into granola bars" and "oranges into orange juice" are the
// request's own named examples, and both are now real
// `salvage.RECIPES` entries (see that file's own header) built the
// identical way `bread`/`preserved_vegetables` already were — a real
// occupation, a real skill floor, real ingredients. "Aluminum and
// glass into different items" needed no new recipe at all:
// `salvage.js`'s existing `scrap_metal`/`glass` materials already
// become `blade`/`club`/`zip_gun`/`shield`/`hand_tool`/`container`.
// What did not exist is the thing the request is actually asking
// for by name — "the AI... depending on what your team
// characteristics and statistics look like" — the same real,
// weighted-aptitude shape `influenceRatingOf`/`espionageAptitudeOf`/
// `heists.js#robberyAptitudeOf`/`tacticalAdvisor.js#
// approachAptitudeOf` already use, a fifth time, pointed at
// `salvage.canMake` instead of combat.
//
// ---------------------------------------------------------------------
// "By the accumulation of what you have" — pooled, never claimed to
// be instantly craftable by one person alone
// ---------------------------------------------------------------------
// `salvage.canMake` checks ONE entity's own inventory, by design —
// `make` consumes from exactly the holder who passes the check, and
// nothing in this engine pools materials across several people's
// holdings into one craft. So this file reports TWO different real
// facts rather than collapsing them into one: `readyNow` (a real
// member who, right now, personally both qualifies AND already holds
// enough to call `salvage.make` directly — `canMake` says yes) and
// `possibleIfPooled` (the GROUP's own real holdings, summed across
// every real member the same way `tribeWealth.js#tribeWealthOf`
// already sums inventory value, are enough — but somebody still has
// to physically move the materials to the crafter first, through the
// real `inventory.transfer` this engine already has). Reporting the
// second as though it were the first would be claiming a pooled-
// crafting mechanic that does not exist.
//
// ---------------------------------------------------------------------
// Advisory only, same posture as `tacticalAdvisor.recommendSplit`
// ---------------------------------------------------------------------
// This file touches nothing. It reads real holdings, real occupations
// and real skills, and returns real suggestions — the actual craft
// still goes through the existing `make-thing` player verb
// (`server/actions.js`), unchanged.

'use strict';

const membership = require('./membership.js');
const inventory = require('./inventory.js');
const salvage = require('./salvage.js');

// Every real member's own holdings, summed by item name — the same
// "accumulation across the group" shape `tribeWealth.js` already sums
// for value rather than for a specific item count.
function pooledHoldingsOf(worldState, memberIds) {
  const pooled = {};
  for (const memberId of memberIds) {
    for (const holding of inventory.holdingsOf(worldState, memberId)) {
      pooled[holding.item_name] = (pooled[holding.item_name] || 0) + Number(holding.quantity);
    }
  }
  return pooled;
}

function groupHasEnough(pooled, ingredients) {
  return Object.entries(ingredients).every(([material, needed]) => (pooled[material] || 0) >= needed);
}

function memberIdsFor(worldState, options) {
  const { organizationId = null, familyId = null } = options;
  if ((organizationId == null) === (familyId == null)) {
    throw new Error('suggestCrafting requires exactly one of organizationId or familyId.');
  }

  if (organizationId != null) {
    const organization = (worldState.organizations || [])
      .find((o) => o.id === Number(organizationId));
    if (!organization) throw new Error(`suggestCrafting: no organization with id ${organizationId}.`);
    const ids = new Set(membership.membersOf(worldState, organization.id).map((n) => n.id));
    if (organization.leader_id != null) ids.add(Number(organization.leader_id));
    return [...ids];
  }

  const family = (worldState.families || []).find((f) => f.id === Number(familyId));
  if (!family) throw new Error(`suggestCrafting: no family with id ${familyId}.`);
  const ids = new Set((worldState.familyMemberships || [])
    .filter((m) => m.family_id === family.id).map((m) => m.entity_id));
  if (family.head_npc_id != null) ids.add(Number(family.head_npc_id));
  return [...ids];
}

// The real suggestions: for every real product this civilization
// still knows how to make (`salvage.PRODUCT_NAMES`), whether this
// specific group's own real people and real holdings can make it —
// right now, by one of them alone, or only once the group's pooled
// materials are physically brought together.
function suggestCrafting(worldState, options = {}) {
  const memberIds = memberIdsFor(worldState, options);
  if (memberIds.length === 0) {
    throw new Error('suggestCrafting: no real members to suggest anything for.');
  }

  const pooled = pooledHoldingsOf(worldState, memberIds);
  const suggestions = [];

  for (const product of salvage.PRODUCT_NAMES) {
    const recipe = salvage.recipeFor(product);
    const readyNow = [];
    for (const memberId of memberIds) {
      const check = salvage.canMake(worldState, memberId, product);
      if (check.ok) readyNow.push(memberId);
    }

    const possibleIfPooled = recipe.from.some((ingredients) => groupHasEnough(pooled, ingredients));
    if (readyNow.length === 0 && !possibleIfPooled) continue;

    suggestions.push({
      product,
      category: salvage.PRODUCTS[product].category,
      readyNow,
      possibleIfPooled: possibleIfPooled && readyNow.length === 0,
    });
  }

  return { memberIds, suggestions };
}

module.exports = {
  pooledHoldingsOf,
  groupHasEnough,
  suggestCrafting,
};
