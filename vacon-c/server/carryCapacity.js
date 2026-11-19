// server/carryCapacity.js
//
// A real carry-capacity limit — by direct instruction: "carry-capacity
// / bags / storage system." `vehicles.js`'s own header already
// declared this gap honestly: "No carry-capacity LIMIT exists
// anywhere in this engine... a real number with nothing real to
// multiply." This closes it, and the "bags" half of the request turns
// out to already exist: `salvage.js`'s own `container` product
// (Tier 1, Crafting, real materials — plastic/scrap_metal/junk) has
// been real and craftable since that file was written, with zero
// consumers anywhere in `server/` — the eleventh standing rule's own
// "a generator nothing calls" trap, found rather than built from
// scratch.
//
// ---------------------------------------------------------------------
// Slots, not weight — a declared, interpretive choice
// ---------------------------------------------------------------------
// No item in this engine's own catalogue (`items.js`'s real §26/§27/
// §28 vocabulary) carries a weight or size field, and adding one to
// every item this engine has ever registered — §27's seventeen priced
// items, every `salvage.PRODUCTS`/material, every lazily-registered
// real item (ammunition, fuel, knowledge books...) — is its own, much
// larger round than this one. This measures carry capacity in real
// COUNT of items held (`inventory.holdingsOf`'s own `quantity` field,
// summed), the same honest "declare the simpler real thing rather
// than invent the harder one" choice CLAUDE.md's own thirty-third
// standing rule already made for a body-composition index.
//
// `BASE_CAPACITY` and `CONTAINER_CAPACITY_BONUS` are flagged
// interpretive — no document specifies either — the same honesty
// `territory.js`'s own `CONTESTED_THRESHOLD`/`FORTIFIED_THRESHOLD`
// already carry.
//
// ---------------------------------------------------------------------
// Wired into exactly one real consumer this round
// ---------------------------------------------------------------------
// `discovery.search` is the one place a player actually ACQUIRES an
// item through a real action, so it is the one real consumer this
// round wires in: a find that would put the searcher over capacity is
// still a real find (the location still loses it, the same honest
// "searched and found nothing you could carry" cost the empty-
// candidates branch already pays), but is not added to the holder's
// own inventory. `heists.js`/`barter.js`/ordinary `inventory.give`
// calls elsewhere are deliberately NOT gated this round — a broader
// enforcement pass is real, separate, future work, named here rather
// than silently implied.

'use strict';

const inventory = require('./inventory.js');

const BASE_CAPACITY = 10;
const CONTAINER_ITEM_NAME = 'container';
const CONTAINER_CAPACITY_BONUS = 15;

// A real, derived, never-stored total — standing rule 3's own
// treatment. Every real `container` the entity currently HOLDS (not
// only equipped — a bag is carried, not worn the way armor is) adds
// the real bonus; holding three really does let you carry more, the
// same honest "more of the same thing helps more" shape `heists.js`'s
// own crew-size cap already holds, just uncapped here since nothing
// about carrying several bags is unrealistic the way an unlimited
// crew would be.
function capacityOf(worldState, entityId) {
  const held = inventory.quantityOf(worldState, entityId, CONTAINER_ITEM_NAME);
  return BASE_CAPACITY + held * CONTAINER_CAPACITY_BONUS;
}

function carriedCountOf(worldState, entityId) {
  return inventory.holdingsOf(worldState, entityId)
    .reduce((total, holding) => total + (Number(holding.quantity) || 0), 0);
}

function canCarry(worldState, entityId, additionalQuantity = 1) {
  return carriedCountOf(worldState, entityId) + additionalQuantity <= capacityOf(worldState, entityId);
}

module.exports = {
  BASE_CAPACITY,
  CONTAINER_ITEM_NAME,
  CONTAINER_CAPACITY_BONUS,
  capacityOf,
  carriedCountOf,
  canCarry,
};
