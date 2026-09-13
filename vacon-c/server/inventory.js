// server/inventory.js
//
// Who holds what — the table this schema never had.
//
// **What its absence cost, measured rather than asserted.** There is
// no item, inventory or equipment table anywhere in
// `VACANCY_POSTGRESQL_SCHEMA.sql`, and four separate systems have run
// into that wall:
//
//   `crime.js`       the `gun` category is declared ungeneratable, in
//                    its own words, because "no weapon exists anywhere
//                    in the schema — no item, inventory or equipment
//                    table — so nothing distinguishes an armed offence
//                    from an unarmed one".
//   `barter.js`      a trade could not be conservative: with nothing
//                    to represent the goods, a seller's side had to
//                    reduce `individual_finances.assets` as a stand-in,
//                    and a seller holding none minted value out of
//                    nothing until a check was added.
//   `theft`          a deprivation theft moves no object. The victim
//                    loses nothing and the offender gains nothing.
//   the growth loop  `GAME_LANGUAGE_AND_REFERENCES.md` names "an item
//                    that raises a trait" as one of four missing edges
//                    in the fight -> earn -> buy -> get stronger loop.
//
// ---------------------------------------------------------------------
// Why this is a table, against a deliberately high bar
//
// `server/schema-extensions.sql` only admits a new table when no
// existing one can hold the fact, and `test/migrate.test.js` keeps an
// allowlist so adding one stays a deliberate act. Three existing
// tables were considered:
//
//   `individual_finances.assets` — a single NUMERIC. It is what barter
//   currently uses as a stand-in for goods held, and it cannot say
//   WHICH goods, so it cannot answer "is this person armed", "did the
//   thief take the hammer", or "what does this house contain".
//
//   `properties.occupants` — JSONB, and about people in a building.
//
//   `ownership_records` — the closest, and genuinely wrong for this.
//   It is an append-only HISTORY of who owned a thing, keyed to an
//   `entities(id)`, and every property and artifact is an entity. An
//   item in a satchel is not an entity: there is no `entities` row for
//   the third hammer somebody is carrying, and minting one per item
//   would put hundreds of thousands of rows in the table every other
//   system iterates.
//
// So the row is (holder, item, quantity, condition, equipped), which
// is four things no existing table holds together.
//
// ---------------------------------------------------------------------
// Items are definitions, holdings are rows
//
// `server/items.js` owns the catalogue — §27's seventeen sourced
// values plus whatever a world adds. This module holds no item
// definitions of its own and refuses an item that catalogue does not
// know, so there is exactly one place an item can be defined and the
// two cannot drift.
//
// **That file exists because of this one.** The catalogue started
// inside `barter.js`, and the moment inventory needed it the two
// required each other — a cycle Node resolves by handing one of them a
// half-built module, which surfaced as `barter.findItem is not a
// function` in every test here at once. The catalogue was always the
// shared thing rather than a barter concern.

'use strict';

const items = require('./items.js');
const { nextAfter } = require('./nextAfter.js');

//: Flagged interpretive. Condition runs 0..100 like every other
//: condition in this engine (`properties.condition`,
//: `infrastructure.condition`), and a fresh item starts at 100.
const NEW_CONDITION = 100;

//: What a worn item is worth. A hammer at 50 condition trades for half
//: what one at 100 does — the same straight proportion
//: `property.currentValue` already uses, rather than a second curve.
function conditionFactor(condition) {
  const value = Number(condition);
  if (!Number.isFinite(value)) return 1;
  return Math.max(0, Math.min(100, value)) / 100;
}

let nextHoldingId = 1;

function reseedIds(worldState) {
  nextHoldingId = nextAfter(worldState.inventory, 'id');
  return { nextHoldingId };
}

// -- reading ------------------------------------------------------------

function holdingsOf(worldState, entityId) {
  return (worldState.inventory || []).filter((h) => h.holder_entity_id === entityId);
}

function findHolding(worldState, entityId, itemName, options = {}) {
  const { condition = null } = options;
  return (worldState.inventory || []).find(
    (h) => h.holder_entity_id === entityId
      && h.item_name === itemName
      && (condition === null || h.condition === condition),
  ) || null;
}

function quantityOf(worldState, entityId, itemName) {
  return holdingsOf(worldState, entityId)
    .filter((h) => h.item_name === itemName)
    .reduce((a, h) => a + Number(h.quantity), 0);
}

// **`valueOf` is not here — it is `barter.valueOfHoldings`.** What a
// holding is WORTH is a pricing question, and pricing needs local
// scarcity and population; putting it here would make this module
// require `barter.js`, which requires this one. The catalogue moved to
// `items.js` for the same reason and the valuation followed the same
// rule: this module says what is held, barter says what it is worth.

// -- writing ------------------------------------------------------------

function assertLiving(worldState, entityId, role) {
  const npc = worldState.npcs.find((n) => n.id === entityId);
  if (!npc) throw new Error(`inventory: ${role} ${entityId} is not among the living`);
  return npc;
}

// Put something into somebody's hands.
//
// Stacks with an identical holding — same item, same condition —
// rather than adding a second row, because "three hammers" and "one
// hammer three times" are the same fact and two rows would make every
// count depend on how they were acquired. Different conditions do NOT
// stack: a hammer at 20 and one at 100 are genuinely different things
// to be holding.
function give(worldState, options = {}) {
  const {
    entityId, itemName, quantity = 1,
    condition = NEW_CONDITION, tick = worldState.tick ?? 0, equipped = false,
  } = options;

  assertLiving(worldState, entityId, 'holder');
  if (!items.findItem(worldState, itemName)) {
    throw new Error(
      `inventory: "${itemName}" is not a known item. Items are defined in server/items.js — `
      + 'the sourced seventeen, or whatever a world adds through worldState.barterItems.',
    );
  }
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error(`inventory: quantity must be a positive number, got ${quantity}`);
  }

  const existing = findHolding(worldState, entityId, itemName, { condition });
  if (existing) {
    existing.quantity = Number(existing.quantity) + quantity;
    return existing;
  }

  const holding = {
    id: nextHoldingId++,
    holder_entity_id: entityId,
    item_name: itemName,
    quantity,
    condition,
    equipped,
    acquired_tick: tick,
  };
  worldState.inventory.push(holding);
  return holding;
}

// Take something out of somebody's hands. Returns what was actually
// taken, which may be less than asked for — a caller that needs all or
// nothing checks `quantityOf` first.
//
// **Refuses to take what is not there rather than going negative.** A
// negative holding is the inventory equivalent of the negative savings
// `barter.exchange` had to be stopped from creating, and it would make
// every count downstream wrong without throwing.
function take(worldState, options = {}) {
  const { entityId, itemName, quantity = 1 } = options;
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error(`inventory: quantity must be a positive number, got ${quantity}`);
  }

  let remaining = quantity;
  const taken = [];
  // Worst condition first: somebody handing over a hammer hands over
  // the worn one. Interpretive, and it makes `equipped` items the last
  // to go, which is the behaviour anybody would expect.
  const held = holdingsOf(worldState, entityId)
    .filter((h) => h.item_name === itemName)
    .sort((a, b) => (a.equipped === b.equipped ? 0 : a.equipped ? 1 : -1)
      || Number(a.condition) - Number(b.condition));

  for (const holding of held) {
    if (remaining <= 0) break;
    const move = Math.min(remaining, Number(holding.quantity));
    holding.quantity = Number(holding.quantity) - move;
    remaining -= move;
    taken.push({ itemName, quantity: move, condition: holding.condition });
  }

  worldState.inventory = worldState.inventory.filter((h) => Number(h.quantity) > 0);
  return { taken, quantity: quantity - remaining, short: remaining };
}

// Move goods between two people, preserving condition.
//
// This is the half `barter.exchange` could not do. It moves the
// OBJECT; `exchange` moves the value. Together they make a trade
// conservative on both sides.
function transfer(worldState, options = {}) {
  const { fromId, toId, itemName, quantity = 1, tick = worldState.tick ?? 0 } = options;
  if (fromId === toId) throw new Error('inventory: an entity cannot transfer to itself');
  assertLiving(worldState, toId, 'recipient');

  const available = quantityOf(worldState, fromId, itemName);
  if (available < quantity) {
    return { moved: 0, short: quantity - available, available };
  }

  const removed = take(worldState, { entityId: fromId, itemName, quantity });
  for (const parcel of removed.taken) {
    give(worldState, {
      entityId: toId,
      itemName: parcel.itemName,
      quantity: parcel.quantity,
      condition: parcel.condition,
      tick,
    });
  }
  return { moved: removed.quantity, short: 0, parcels: removed.taken };
}

// -- equipment ----------------------------------------------------------

// §26's `protection` and `tools` categories are things somebody has
// ABOUT them rather than in store, and `crime.js` needs exactly that
// distinction to tell an armed offence from an unarmed one.
//
// Equipping splits a stack: equipping one of three hammers leaves two
// in store, because the alternative is a boolean that lies about the
// other two.
function equip(worldState, options = {}) {
  const { entityId, itemName, condition = null } = options;
  const holding = findHolding(worldState, entityId, itemName, { condition });
  if (!holding) throw new Error(`inventory: ${entityId} holds no "${itemName}" to equip`);
  if (holding.equipped) return holding;

  if (Number(holding.quantity) > 1) {
    holding.quantity = Number(holding.quantity) - 1;
    const one = {
      id: nextHoldingId++,
      holder_entity_id: entityId,
      item_name: itemName,
      quantity: 1,
      condition: holding.condition,
      equipped: true,
      acquired_tick: holding.acquired_tick,
    };
    worldState.inventory.push(one);
    return one;
  }
  holding.equipped = true;
  return holding;
}

function equippedItems(worldState, entityId) {
  return holdingsOf(worldState, entityId).filter((h) => h.equipped === true);
}

// Does this person have something of a given §26 category about them?
// This is the question `crime.js` asks to tell an armed offence from an
// unarmed one, and the question `contest.js` would ask about a weapon.
function hasEquippedCategory(worldState, entityId, category) {
  return equippedItems(worldState, entityId).some((h) => {
    const item = items.findItem(worldState, h.item_name);
    return item && item.category === category;
  });
}

module.exports = {
  NEW_CONDITION,
  conditionFactor,
  reseedIds,
  holdingsOf,
  findHolding,
  quantityOf,
  give,
  take,
  transfer,
  equip,
  equippedItems,
  hasEquippedCategory,
};
