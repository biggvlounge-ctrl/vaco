// server/fencing.js
//
// A real stolen-goods resale market — by direct instruction: "car
// fencing (stolen-vehicle resale market)."
//
// ---------------------------------------------------------------------
// The real gap this closes
// ---------------------------------------------------------------------
// `vehicles.stealVehicle` moved a real vehicle via `inventory.transfer`
// and recorded a real `crime.recordCrime` theft, and that was all.
// Once the transfer completed, the stolen vehicle was an ordinary
// holding — no `stolen` flag anywhere in `inventory.js`'s own schema —
// indistinguishable from one the thief bought outright, and sellable
// to anybody through `barter.exchange` at the exact same price a
// legitimate owner would get. A hot car and a clean one priced
// identically is not a resale market, it is the absence of one.
//
// `vehicles.stealVehicle` now sets a real `stolen: true` flag directly
// on the resulting holding row — see that file's own header on the
// one real limitation this carries (the flag lives on the row, keyed
// on itemName+condition, the real grain `inventory.js` has; this
// engine has no per-vehicle VIN-equivalent identity).
//
// ---------------------------------------------------------------------
// A fence is a measured fact about this population, not a role
// ---------------------------------------------------------------------
// `policing.evasionOf` already reads `criminal.'Black Market Ties'` as
// one of the four real skills that make somebody hard to catch. A
// fence is simply somebody with a lot of it — measured directly
// against a real generated population (`fence-measure` seed, 180
// NPCs) rather than guessed: min 10, median 52, p75 75, p90 87, p95
// 92, max 95. `FENCE_BLACK_MARKET_TIES_FLOOR = 87` is that measured
// p90 — the real top tenth of this population by the real trait that
// already means "moves things without getting caught," not an
// invented cutoff.
//
// ---------------------------------------------------------------------
// The discount, and where it lands
// ---------------------------------------------------------------------
// `FENCE_PRICE_MULTIPLIER = 0.6`, flagged interpretive the same
// honesty `policing.VICTIM_BONUS`/`disguise.DISGUISE_EVASION_BONUS`
// already carry — no document gives a fence's own markdown. A fence
// takes on real risk moving stolen goods and prices that risk in,
// same as any real black market. `barter.agreedPrice`/`exchange` both
// gained an optional `priceMultiplier` (default 1 — every existing
// call stays byte-for-byte unaffected), and `barter.exchange` itself
// now refuses to move a `stolen: true` holding to anybody who is not
// a real fence — closing the actual gap, rather than leaving a second,
// parallel sale path that bypasses the check this file exists to add.

'use strict';

const { getLiveEntity } = require('./entityTraits.js');

const FENCE_BLACK_MARKET_TIES_FLOOR = 87;

const FENCE_PRICE_MULTIPLIER = 0.6;

function blackMarketTiesOf(worldState, entityId) {
  const live = getLiveEntity(worldState, entityId);
  const value = Number(live?.traits?.criminal?.['Black Market Ties'] ?? 50);
  return Number.isFinite(value) ? value : 50;
}

function isFence(worldState, entityId) {
  return blackMarketTiesOf(worldState, entityId) >= FENCE_BLACK_MARKET_TIES_FLOOR;
}

// Sell a real stolen holding to a real fence, at the real discount —
// a thin, named wrapper over `barter.exchange` rather than a second
// money-movement path, so every real consumer of a sale (finances,
// inventory, the object actually moving) stays the one real mechanism.
function sellToFence(worldState, options = {}) {
  const { sellerId, fenceId, itemName, quantity = 1, cityId = null, tick = worldState.tick ?? 0 } = options;
  if (!isFence(worldState, fenceId)) {
    return {
      settled: false,
      reason: `entity ${fenceId} does not have real Black Market Ties `
        + `(needs ${FENCE_BLACK_MARKET_TIES_FLOOR}+) to fence stolen goods`,
    };
  }
  // eslint-disable-next-line global-require
  const barter = require('./barter.js');
  return barter.exchange(worldState, {
    buyerId: fenceId, sellerId, itemName, quantity, cityId, tick,
    priceMultiplier: FENCE_PRICE_MULTIPLIER,
  });
}

module.exports = {
  FENCE_BLACK_MARKET_TIES_FLOOR,
  FENCE_PRICE_MULTIPLIER,
  blackMarketTiesOf,
  isFence,
  sellToFence,
};
