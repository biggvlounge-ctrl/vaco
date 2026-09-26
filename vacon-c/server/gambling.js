// server/gambling.js
//
// **A house game against the world's own economy — added 26 Sep 2026 at
// the owner's direct request, confined deliberately to virtual stakes.**
//
// ---------------------------------------------------------------------
// What this is not
// ---------------------------------------------------------------------
// `server/competition.js`'s own header is explicit: contest resolution
// "is not gambling... nothing here stakes anything, pays anything or
// prices anything," because "gambling and casino systems (#291-305)
// stay shut pending compliance review" — a LEGAL gate on real-money
// gambling, not a taste decision. This file does not touch that gate:
// every stake here is `individual_finances.savings`, the same in-world
// virtual currency `barter.js`/`economy.js` already move, never
// anything connected to a real payment rail. If this project ever
// wires a location's takings to real money, the #291-305 review
// applies again in full; nothing here answers that question.
//
// ---------------------------------------------------------------------
// What it reuses rather than invents
// ---------------------------------------------------------------------
// `economic.Risk Appetite` and `economic.Greed` have existed on every
// NPC since the economic trait family was written, with no gambling
// mechanic to read them — the same shape `server/drugs.js` closed for
// `criminal['Black Market Ties']`. `psychological.Compulsiveness`
// already exists and already means "does more of what it does" —
// reused here for problem gambling rather than inventing a second
// trait for the same idea. `server/seeded.js`'s `seededDraw` is the
// house's own dice roll, so §88's replay guarantee holds: the same
// world and seed produce the same wins and losses.
//
// `individual_finances` is append-only (`economy.generateIndividualFinances`
// writes a fresh row; nothing here edits one in place) — the same
// contract `barter.exchange` keeps, for the reason its own comment
// gives: the table is a history of somebody's position, not a mutable
// balance.

'use strict';

const economy = require('./economy.js');
const { getLiveEntity } = require('./entityTraits.js');
const { seededDraw } = require('./seeded.js');

// ---------------------------------------------------------------------
// One game — a coin flip with a house edge
// ---------------------------------------------------------------------
//: No document gives a house edge; this is the shape of the model, the
//: same flagged-interpretive status `crime.js`'s `BASE_DEPRIVATION_RISK`
//: carries. 6% is an ordinary real-world casino edge, not measured from
//: anything in this engine.
const WIN_CHANCE = 0.47;
const PAYOUT_MULTIPLIER = 2;

// One wager, resolved immediately. Returns `{ played: false, ... }`
// rather than throwing when the stake cannot be covered — the same
// shape `barter.exchange` returns for an unaffordable trade, because a
// refused wager is an ordinary outcome, not an error.
function play(worldState, options = {}) {
  const { entityId, amount, tick = worldState.tick ?? 0 } = options;
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error(`gambling.play: amount must be a positive number, got ${amount}`);
  }

  const finances = economy.getLatestFinances(worldState, entityId);
  const liquid = Number(finances?.savings ?? 0);
  if (amount > liquid) {
    return {
      played: false, reason: 'cannot cover the stake', amount, liquid,
    };
  }

  const won = seededDraw([worldState.seed ?? 'world', 'gambling:play', entityId, tick]) < WIN_CHANCE;
  const payout = won ? amount * PAYOUT_MULTIPLIER : 0;
  const net = payout - amount;

  economy.generateIndividualFinances(worldState, entityId, {
    income: finances?.income ?? 0,
    savings: (finances?.savings ?? 0) + net,
    debt: finances?.debt ?? 0,
    assets: finances?.assets ?? 0,
    tick,
  });

  return {
    played: true, won, amount, payout, net, tick,
  };
}

// ---------------------------------------------------------------------
// Urges — Risk Appetite and Greed's first reader, Compulsiveness's second
// ---------------------------------------------------------------------
//: Below this, `economic['Risk Appetite']` is exactly what it was
//: before this file existed: a number on the sheet nothing reads. Same
//: shape and same size as `drugs.PRODUCTION_TIES_FLOOR`, for the same
//: reason — an ordinary person never gambles, which is the twelfth
//: standing rule's "does not recalibrate the world" discipline again.
const PROPENSITY_FLOOR = 55;
const URGE_CHANCE_AT_MAX_PROPENSITY = 0.04;
//: How much of current savings one urge stakes. A fraction rather than
//: a flat amount, so a wealthy gambler and a poor one both risk a
//: comparable share of what they have, not a comparable number.
const WAGER_FRACTION_OF_SAVINGS = 0.1;
const MINIMUM_WAGER = 1;

function propensityOf(worldState, entityId) {
  const live = getLiveEntity(worldState, entityId);
  const riskAppetite = Number(live?.traits?.economic?.['Risk Appetite'] ?? 0);
  const greed = Number(live?.traits?.economic?.Greed ?? 0);
  const compulsiveness = Number(live?.traits?.psychological?.Compulsiveness ?? 0);
  // Greed and Compulsiveness both push someone who already gambles
  // toward doing it more; Risk Appetite is the gate itself, weighted
  // double so the other two cannot substitute for actually being a
  // risk-taker.
  return (riskAppetite * 2 + greed + compulsiveness) / 4;
}

function urgesThisTick(worldState, entityId, tick) {
  const propensity = propensityOf(worldState, entityId);
  if (propensity < PROPENSITY_FLOOR) return false;
  const chance = ((propensity - PROPENSITY_FLOOR) / (100 - PROPENSITY_FLOOR))
    * URGE_CHANCE_AT_MAX_PROPENSITY;
  return seededDraw([worldState.seed ?? 'world', 'gambling:urge', entityId, tick]) < chance;
}

//: Losing this share of savings in one sitting is a loss worth a
//: stress response — `behavior.js`'s own `STRESS_BY_EVENT` decides how
//: much; this only decides whether the event fires. Kept low so an
//: urge-sized wager (10% of savings) routinely crosses it: losing IS
//: the ordinary outcome at a 47% win chance, and a mechanic that only
//: ever stressed a catastrophic loss would rarely fire at all.
const NOTABLE_LOSS_FRACTION = 0.03;

// One tick's worth of urges for the living population. Returns the
// events a notable win or loss produces, the same contract
// `drugs.runUseAndWithdrawal` keeps — pushed onto `candidateEvents` by
// the caller, so `behavior.applyEventStress` (already wired into every
// tick) does the rest without this file needing to know how stress
// works.
function runUrges(worldState, tick) {
  const events = [];
  for (const npc of worldState.npcs || []) {
    if (npc.status !== 'active') continue;
    if (!urgesThisTick(worldState, npc.id, tick)) continue;

    const finances = economy.getLatestFinances(worldState, npc.id);
    const liquid = Number(finances?.savings ?? 0);
    if (liquid <= 0) continue;
    const amount = Math.max(MINIMUM_WAGER, Math.round(liquid * WAGER_FRACTION_OF_SAVINGS));
    const result = play(worldState, { entityId: npc.id, amount, tick });
    if (!result.played) continue;

    if (Math.abs(result.net) >= liquid * NOTABLE_LOSS_FRACTION) {
      events.push({
        type: result.won ? 'gambling_win' : 'gambling_loss',
        severity: result.won ? 'low' : 'medium',
        note: `entity ${npc.id} ${result.won ? 'won' : 'lost'} ${Math.abs(result.net)} gambling`,
        tick,
        affected_entity_ids: [npc.id],
        global_effects: { amount: result.amount, net: result.net },
      });
    }
  }
  return events;
}

// One call, one tick's worth of everything this file does.
function runGambling(worldState, options = {}) {
  const { tick = worldState.tick ?? 0 } = options;
  return { events: runUrges(worldState, tick) };
}

// The measurement, standing rule 11's guard on this file specifically.
function describeGambling(worldState) {
  const players = (worldState.npcs || [])
    .filter((n) => propensityOf(worldState, n.id) >= PROPENSITY_FLOOR).length;
  return { eligiblePlayers: players };
}

module.exports = {
  WIN_CHANCE,
  PAYOUT_MULTIPLIER,
  PROPENSITY_FLOOR,
  WAGER_FRACTION_OF_SAVINGS,
  play,
  propensityOf,
  urgesThisTick,
  runUrges,
  runGambling,
  describeGambling,
};
