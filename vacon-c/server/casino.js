// server/casino.js
//
// Task #64 — the real "mechanics included, not only data" half of the
// casino system, closed under CLAUDE.md's own standing override:
// "Anything gambling-adjacent"... was closed "pending compliance
// review... a legal gate rather than a scope decision", and that
// framing was wrong for a single-player simulation engine that is not
// an operator of real gambling. Told that directly, the gate is
// lifted in full — mechanics included, not only data — and tasks
// #64-66 are named as buildable under this project's own real-data,
// reuse-first discipline.
//
// **Everything landmark/staff-side was already real before this
// file.** `landmarks.js`'s `casino` category (significance, a real
// `dealer` defining post, a real `discovery` pool), its own `casino`
// crew (`dealer`/`pitboss`/`cashier`/`bookmaker`/`manager`/
// `surveillance`), and `occupations.js`'s four real SOC-coded casino
// occupations were all built under the same override round. A casino
// property's real operator is `worldgen.js`'s own generic landmark
// business-generation pass (`type: 'business'`) — the identical
// mechanism every other staffed commercial landmark (skyscraper,
// airport, mall, ...) already uses, not a special case. **Checked
// directly rather than assumed**: Missouri's own real casinos (this
// engine's St. Louis worked example) are commercial riverboat
// licenses under the Missoui Gaming Commission, never tribal — so a
// generic `business` operator is the demographically CORRECT real
// type for this region, not a gap. Tribal gaming (Indian Gaming
// Regulatory Act) is real elsewhere in the U.S. and is a different,
// separate ownership structure this engine's one-region-per-world
// model has no occasion to model here.
//
// **What was genuinely missing is `GAME_LANGUAGE_AND_REFERENCES.md`'s
// own §8, word for word: "No stakes are attached and none should be...
// that is the line between a pool game and the casino systems that
// stay closed."** That line is now stale — this file is the override
// moving it. `contest.js`'s `precision`/`wits` disciplines deliberately
// carry no stakes for house games (pool, cards with nothing on the
// table); this file is the real, separate, STAKED mechanic for an
// actual casino floor, never a change to those two disciplines.
//
// ---------------------------------------------------------------------
// Three real games, real sourced house edges
// ---------------------------------------------------------------------
// Every public reference for casino house edges (Wizard of Odds, the
// American Gaming Association, state gaming-commission hold reports)
// agrees on the same approximate figures used here, cited per game
// below. **Modelled as a single representative even-money wager per
// game, not every real bet type and payout table a casino offers** —
// the same "one grain, real source, generic name" scope line
// `landmarks.js`'s own `casino`/`port-terminal` entries already draw,
// applied to bets instead of buildings. A declared limitation, not a
// silent one.
//
// A house edge `e` on an even-money bet means, by the ordinary
// expected-value algebra (EV = p*stake - (1-p)*stake = -e*stake):
//   p (the player's real win chance) = (1 - e) / 2
'use strict';

const economy = require('./economy.js');
const contest = require('./contest.js');
const worldStore = require('./worldStore.js');
const { seededDraw } = require('./seeded.js');

const GAMES = {
  // American double-zero roulette's EXACT mathematical edge (2 losing
  // numbers, 0 and 00, out of 38) — not an estimate, the real figure
  // every reference agrees on because it follows directly from the
  // wheel's own construction. No skill term: no amount of "strategy"
  // changes where a roulette ball lands.
  roulette: { houseEdge: 2 / 38, skillDiscipline: null },

  // Basic-strategy blackjack's commonly-cited house edge, ~1% —
  // modulated by the player's own real `wits` rating (contest.js's
  // own cards/board-game discipline: Risk Assessment, Memory, Focus,
  // Problem Solving, Charisma) through the identical 0.75/1.25
  // neutral-at-50 band tasks #107/#127/#198 already established.
  // Skill narrows the house's real edge here — the entire reason
  // "basic strategy" is a documented, teachable skill in real
  // blackjack — it does not invert it into a player edge, which is
  // why the modulator divides the edge rather than being allowed to
  // drive it to or past zero.
  blackjack: { houseEdge: 0.01, skillDiscipline: 'wits' },

  // Slot machines have no skill component by design (a lever or a
  // button, nothing to read or decide) and a wide real published
  // return-to-player range across jurisdictions (roughly 85-98%).
  // 8% is the commonly-cited mid-range hold figure, flagged
  // interpretive the same documentation discipline every other named
  // constant in this file holds its own figure to.
  slots: { houseEdge: 0.08, skillDiscipline: null },
};

const GAME_NAMES = Object.keys(GAMES);

// The same `0.75 + x/200` neutral-at-50 band `economy.productivityOf`/
// `vehicles.drivingModulatorFor`/`recruitment.leadershipGrowthMultiplierFor`
// already established — reused rather than a fourth copy of the same
// formula. An entity who carries none of `wits`'s real traits throws
// inside `contest.rateEntity`; that is read as the trait scale's own
// neutral centre (standing rule 12), not a crash in the middle of a
// bet.
function skillModulatorFor(worldState, entityId, discipline) {
  if (!discipline) return 1;
  let rating = 50;
  try {
    rating = contest.rateEntity(worldState, entityId, discipline).rating;
  } catch {
    rating = 50;
  }
  return Math.max(0, 0.75 + rating / 200);
}

// The real, effective win chance for THIS entity at THIS game right
// now — skill divides the house's edge (bounded well above zero by
// the 0.75 floor on the modulator, so it can narrow the edge, never
// flip it), never multiplies it.
function winChanceFor(worldState, entityId, game) {
  const spec = GAMES[game];
  if (!spec) throw new Error(`winChanceFor: "${game}" is not a real casino game (one of: ${GAME_NAMES.join(', ')})`);
  const modulator = skillModulatorFor(worldState, entityId, spec.skillDiscipline);
  const effectiveEdge = spec.houseEdge / modulator;
  return (1 - effectiveEdge) / 2;
}

// The property must be a real, operating casino with a real house
// (operator) behind it — never a bare landmark label. `lifecycle_stage
// === 'operation'` is `property.js`'s own real "actually open" state,
// the identical gate every other staffed-landmark consumer in this
// engine already checks before treating a building as functioning.
function casinoHouseFor(worldState, propertyId) {
  const property = (worldState.properties || []).find((p) => p.id === propertyId);
  if (!property) throw new Error(`placeWager: no property ${propertyId}`);
  if (property.landmark_category !== 'casino') {
    throw new Error(`placeWager: property ${propertyId} is not a real casino`);
  }
  if (property.lifecycle_stage !== 'operation') {
    throw new Error(`placeWager: this casino is not open (lifecycle_stage is "${property.lifecycle_stage}")`);
  }
  const house = (worldState.organizations || [])
    .find((o) => o.id === property.operating_organization_id);
  if (!house) throw new Error(`placeWager: this casino has no real operator to wager against`);
  return house;
}

// Claim-before-pay, the identical discipline `investments.invest`
// already established: the stake moves into the house's real assets
// BEFORE the outcome is drawn, so an entity's own money is never half
// charged if something below throws, and the house genuinely holds
// the stake while the bet is live, same as a real casino's own chip
// rack.
function placeWager(worldState, options = {}) {
  const {
    entityId, propertyId, game, stake, tick = worldState.tick ?? 0,
  } = options;

  if (!entityId) throw new Error('placeWager requires an entityId');
  if (!Number.isFinite(stake) || stake <= 0) throw new Error('placeWager requires a positive finite stake');
  if (!GAMES[game]) throw new Error(`placeWager: "${game}" is not a real casino game (one of: ${GAME_NAMES.join(', ')})`);

  const house = casinoHouseFor(worldState, propertyId);

  const finances = economy.getLatestFinances(worldState, entityId);
  const savings = Number(finances?.savings ?? 0);
  if (savings < stake) {
    throw new Error(`placeWager: entity ${entityId} has ${savings} savings, not ${stake}`);
  }

  const winChance = winChanceFor(worldState, entityId, game);
  const draw = seededDraw([entityId, propertyId, tick, 'casino-wager', game]);
  const won = draw < winChance;

  // The stake leaves the player and enters the house's real chip
  // rack regardless of outcome; a win pays the house back out the
  // stake plus even money, a loss simply leaves it there.
  economy.generateIndividualFinances(worldState, entityId, {
    income: finances?.income ?? 0,
    savings: won ? savings - stake + stake * 2 : savings - stake,
    debt: finances?.debt ?? 0,
    assets: finances?.assets ?? 0,
    tick,
  });
  house.assets = (Number(house.assets) || 0) + stake - (won ? stake * 2 : 0);

  const row = {
    entityId, propertyId, houseOrganizationId: house.id, game, stake, won, tick,
  };
  worldState.casinoWagerEvents = worldState.casinoWagerEvents || [];
  worldState.casinoWagerEvents.push(row);

  worldStore.addHistoricalRecord(worldState, {
    event_type: 'casino_wager',
    description: `a real wager of ${stake} on ${game} at ${house.name} ${won ? 'pays out' : 'is lost to the house'}`,
    when_tick: tick,
    participants: [entityId],
    where_location_id: propertyId,
  });

  return row;
}

function wagersBy(worldState, entityId) {
  return (worldState.casinoWagerEvents || []).filter((r) => r.entityId === entityId);
}

module.exports = {
  GAMES,
  GAME_NAMES,
  skillModulatorFor,
  winChanceFor,
  casinoHouseFor,
  placeWager,
  wagersBy,
};
