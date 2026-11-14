// server/fraud.js
//
// Closes `crime.js`'s own declared, ungenerated `fraud` category -- by
// direct instruction, among a wider request for "corruption at all
// levels... scamming and scheming all over." `CATEGORIES.fraud`'s own
// substrate note already named the exact gap: "market_listings
// resolve honestly and there is no contract, claim, insurance or
// instrument to falsify. employment_records and ownership_records are
// the nearest substrate and neither can currently be forged." Both
// stay honest; this adds the one real transaction type that was
// missing instead -- a buyer who pays and a seller who never had
// title to deliver.
//
// ---------------------------------------------------------------------
// The real object of the fraud: a property sale, not an invented
// instrument
// ---------------------------------------------------------------------
// §9/§26 give this file no "contract" or "insurance claim" item or
// table to forge, and inventing one would be exactly the kind of
// second, disagreeing instrument this project's own standing rules
// warn against. `ownership_records`/`properties` already real: a
// perpetrator offers a real, existing property they do NOT hold
// (`property.getCurrentOwner` says who actually does, or nobody),
// a real victim pays a real deposit toward it, and the perpetrator
// never grants title because they never had it to grant. The scam is
// the ordinary, real-world shape fraud most often takes, modelled with
// the two real tables this engine already has for exactly this.
//
// ---------------------------------------------------------------------
// Who attempts it: the real, already-read `criminal.Deception` trait
// ---------------------------------------------------------------------
// `policing.evasionOf` and `bluff.js` already read this trait for the
// identical reason — it is the one `criminal`-family dimension this
// engine already treats as "how good this person is at making someone
// believe something false." Reused directly rather than a second,
// disagreeing "scheming" trait.
//
// ---------------------------------------------------------------------
// The real wealth movement: the identical primitive `payMissionReward`
// already uses
// ---------------------------------------------------------------------
// There is no general "adjust this person's money" function anywhere
// in this engine — `economy.js` only generates a fresh
// `individual_finances` row and reads the latest one back.
// `engine.js#payMissionReward` is the one real precedent for moving
// money into somebody's savings this way; `moveSavings` below is the
// same shape, debiting one side and crediting the other with two real
// rows rather than inventing a second ledger.

'use strict';

const economy = require('./economy.js');
const property = require('./property.js');
const crime = require('./crime.js');
const { getLiveEntity } = require('./entityTraits.js');
const { seededDraw } = require('./seeded.js');

// Per tick, at Deception 100 -- the same order of magnitude
// `crime.BASE_DEPRIVATION_RISK` uses at full pressure, since both are
// "how often does this person's own real disposition turn into an
// actual incident this tick" questions. Scaled by `deception / 100`
// below: 0 Deception attempts nothing, which is the honest answer for
// somebody with no gift for it, not a baseline this recalibrates —
// there is no prior fraud rate here to shift, only a new mechanic
// starting from zero.
const BASE_FRAUD_RISK = 0.0006;

// The real share of a property's own computed value a mark is scammed
// out of -- a deposit toward a sale that never closes, not the full
// price up front, which nobody who has ever bought real estate would
// hand over before closing.
const DEPOSIT_SHARE = 0.15;

function deceptionOf(worldState, entityId) {
  const live = getLiveEntity(worldState, entityId);
  const value = Number(live?.traits?.criminal?.Deception);
  return Number.isFinite(value) ? value : 50;
}

// The same two-row shape `payMissionReward` already uses, generalized
// to move real savings between any two entities rather than crediting
// one side only.
function moveSavings(worldState, fromId, toId, amount, tick) {
  const fromCurrent = economy.getLatestFinances(worldState, fromId);
  economy.generateIndividualFinances(worldState, fromId, {
    income: fromCurrent?.income ?? 0,
    savings: Math.round(((fromCurrent?.savings ?? 0) - amount) * 100) / 100,
    debt: fromCurrent?.debt ?? 0,
    assets: fromCurrent?.assets ?? 0,
    tick,
  });
  const toCurrent = economy.getLatestFinances(worldState, toId);
  economy.generateIndividualFinances(worldState, toId, {
    income: toCurrent?.income ?? 0,
    savings: Math.round(((toCurrent?.savings ?? 0) + amount) * 100) / 100,
    debt: toCurrent?.debt ?? 0,
    assets: toCurrent?.assets ?? 0,
    tick,
  });
}

// A real property in this community nobody holds title to, or that
// this specific perpetrator does not hold title to -- the honest
// "something to falsely offer" a scammer needs, read from the real
// ownership table rather than invented.
function unownedOrOtherOwnedPropertyIn(worldState, communityId, perpetratorId) {
  const candidates = (worldState.properties || [])
    .filter((p) => p.community_id === communityId);
  for (const candidate of candidates) {
    const owner = property.getCurrentOwner(worldState, candidate.id);
    if (!owner || owner.owner_entity_id !== perpetratorId) return candidate;
  }
  return null;
}

// A real, living mark with real liquid savings in the same community
// -- never the perpetrator, and never somebody who could not actually
// pay the deposit, since a scam against money that is not there is
// not a real incident.
function markIn(worldState, communityId, perpetratorId, minimumSavings) {
  let best = null;
  let bestSavings = -Infinity;
  for (const npc of worldState.npcs || []) {
    if (npc.communityId !== communityId || npc.id === perpetratorId) continue;
    const finances = economy.getLatestFinances(worldState, npc.id);
    const savings = Number(finances?.savings);
    if (!Number.isFinite(savings) || savings < minimumSavings) continue;
    if (savings > bestSavings) { bestSavings = savings; best = npc; }
  }
  return best;
}

// Real fraud, for the whole living population, once per tick -- the
// identical "whole population, once per tick, inside the Security
// phase" shape `crime.runDeprivationCrime` already holds, so the two
// sit beside each other in the pipeline rather than one running on a
// different cadence than the other.
function runFraud(worldState, tick = worldState.tick ?? 0) {
  const incidents = [];

  for (const npc of worldState.npcs || []) {
    if (npc.communityId === null || npc.communityId === undefined) continue;

    const deception = deceptionOf(worldState, npc.id);
    const risk = (deception / 100) * BASE_FRAUD_RISK;
    if (risk <= 0) continue;
    if (seededDraw([npc.id, tick, 'crime:fraud']) >= risk) continue;

    const target = unownedOrOtherOwnedPropertyIn(worldState, npc.communityId, npc.id);
    if (!target) continue;

    const amount = Math.round(property.currentValue(target) * DEPOSIT_SHARE);
    if (amount <= 0) continue;

    const victim = markIn(worldState, npc.communityId, npc.id, amount);
    if (!victim) continue;

    moveSavings(worldState, victim.id, npc.id, amount, tick);

    const incident = crime.recordCrime(worldState, {
      category: 'fraud',
      perpetratorId: npc.id,
      victimId: victim.id,
      tick,
      detail: `fraudulent sale of property ${target.id} (no real title held); `
        + `${amount} taken as a deposit`,
    });
    incidents.push(incident);
  }

  return incidents;
}

module.exports = {
  BASE_FRAUD_RISK,
  DEPOSIT_SHARE,
  deceptionOf,
  moveSavings,
  unownedOrOtherOwnedPropertyIn,
  markIn,
  runFraud,
};
