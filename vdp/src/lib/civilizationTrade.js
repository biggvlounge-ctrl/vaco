// VDP — Scarcity-driven trade between civilizations: this session's
// own second gameplay suggestion from "what could make the gameplay
// or lore better." `civilizations.js`/`worldAtlas.js` already carry
// the real raw material for this -- every seeded civilization has a
// real `majorIndustries` list, and the master lore handoff's own rule
// (§13, "no civilization should possess everything") is already
// enforced in the seed data (the mainland hidden civilizations are
// checked directly, in a real test, to never mirror their host
// country's own industries). Nothing before this module gave a player
// a real reason to care that two civilizations have different
// industries -- it was flavor on a seed record. This module is the
// real mechanic: a civilization's missing industries are real
// scarcity, and moving real goods into that scarcity is a real,
// payable business action.
//
// **The same scarcity law `resources.js`'s own `exoticValueFor`
// already established, reused rather than reinvented**: "there will
// be an exotic value of things that are least accessible -- those
// things will be more valuable until they increase" (8 Oct 2026,
// direct instruction). There, accessibility was measured by
// `totalProduced` units of a raw material. Here, at the civilization
// scale, accessibility is measured by how many of the world's real
// civilizations carry that industry at all -- the same inverse
// relationship, a different real denominator. `BASE_SCARCITY_VALUE`
// is a flagged interpretive number on the same footing as
// `BASE_EXOTIC_VALUE` -- no source document gives VDP a real
// civilization-trade price schedule.

import { getCivilization, listCivilizations, createTradeRoute } from './civilizations.js';

export const BASE_SCARCITY_VALUE = 200;

// The real counterpart account to `resources.js`'s own
// `RESOURCE_EXCHANGE_ACCOUNT` -- the governors' own real payer for a
// player who actually closes a scarcity-driven trade.
export const CIVILIZATION_TRADE_ACCOUNT = 'vdp-civilization-trade-office';

// How many of the world's real civilizations actually carry this
// industry, right now -- the real denominator behind its value. Zero
// is impossible to ask about meaningfully (nobody has it, so nobody
// could be the `from` side of a real trade in it), but the formula
// stays well-defined anyway.
function civilizationsCarrying(civStore, industry) {
  return listCivilizations(civStore).filter((c) => c.majorIndustries.includes(industry));
}

export function scarcityValueFor(civStore, industry) {
  const producingCount = civilizationsCarrying(civStore, industry).length;
  return BASE_SCARCITY_VALUE / (1 + producingCount);
}

// Every real industry any civilization in the world actually carries,
// deduplicated -- the real universe `findScarceOpportunities` checks
// a civilization's own gaps against, not an invented catalog.
function allKnownIndustries(civStore) {
  const set = new Set();
  for (const civ of listCivilizations(civStore)) {
    for (const industry of civ.majorIndustries) set.add(industry);
  }
  return [...set];
}

// What a civilization actually lacks that at least one OTHER real
// civilization actually has -- the real "what should I import here,
// and who sells it" readout, ranked scarcest (most valuable) first.
// An industry nobody in the world has yet is never listed -- there is
// nothing real to import if no civilization anywhere produces it.
export function findScarceOpportunities(civStore, civilizationId) {
  const civ = getCivilization(civStore, civilizationId);
  if (!civ) throw new Error(`findScarceOpportunities: no civilization ${civilizationId}`);

  const have = new Set(civ.majorIndustries);
  const opportunities = [];
  for (const industry of allKnownIndustries(civStore)) {
    if (have.has(industry)) continue;
    const suppliers = civilizationsCarrying(civStore, industry).filter((c) => c.id !== civilizationId);
    if (suppliers.length === 0) continue;
    opportunities.push({
      industry,
      value: scarcityValueFor(civStore, industry),
      suppliers: suppliers.map((s) => ({ id: s.id, name: s.name })),
    });
  }
  return opportunities.sort((a, b) => b.value - a.value);
}

// The real, payable business action: a player moves real goods from a
// civilization that actually carries this industry to one that
// actually lacks it, and is paid the real scarcity value of that
// industry, times how much cargo they moved. Refuses a trade that
// isn't real scarcity -- the source must actually have the industry,
// the destination must actually lack it, and they must be two
// different civilizations.
//
// Payment is attempted BEFORE the trade route is recorded, the
// reverse of this app's usual claim-before-pay/rollback ordering --
// there is no real inventory here to deduct-then-restore the way
// `sellMaterials` has; a trade route is a record of a completed real
// trade, so it is only ever created once the payout actually
// succeeds, never left behind as a claim nothing backs.
export async function conductScarcityTrade(civStore, {
  fromCivilizationId, toCivilizationId, industry, traderId, cargoAmount = 1, transferFn, now = Date.now(),
} = {}) {
  if (!traderId) throw new Error('conductScarcityTrade requires a traderId');
  if (fromCivilizationId === toCivilizationId) {
    throw new Error('conductScarcityTrade requires two different civilizations');
  }
  if (!Number.isInteger(cargoAmount) || cargoAmount <= 0) {
    throw new Error('conductScarcityTrade requires a positive integer cargoAmount');
  }
  if (typeof transferFn !== 'function') throw new Error('conductScarcityTrade requires a transferFn');

  const from = getCivilization(civStore, fromCivilizationId);
  if (!from) throw new Error(`conductScarcityTrade: no civilization ${fromCivilizationId}`);
  const to = getCivilization(civStore, toCivilizationId);
  if (!to) throw new Error(`conductScarcityTrade: no civilization ${toCivilizationId}`);

  if (!from.majorIndustries.includes(industry)) {
    throw new Error(`conductScarcityTrade: ${from.name} does not carry "${industry}" -- nothing real to trade`);
  }
  if (to.majorIndustries.includes(industry)) {
    throw new Error(`conductScarcityTrade: ${to.name} already carries "${industry}" -- no real scarcity to profit from`);
  }

  const unitValue = scarcityValueFor(civStore, industry);
  const payout = Math.round(unitValue * cargoAmount);

  await transferFn({
    fromUserId: CIVILIZATION_TRADE_ACCOUNT, toUserId: traderId, amount: payout, reason: `vdp-civilization-trade-${industry}`,
  });

  const route = createTradeRoute(civStore, {
    name: `${from.name} → ${to.name}: ${industry} (${traderId})`,
    createdBy: traderId,
    cargo: [industry],
    status: 'legal',
    now,
  });

  return { route, payout, unitValue, cargoAmount };
}
