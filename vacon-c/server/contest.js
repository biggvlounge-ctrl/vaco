// server/contest.js
//
// Contest resolution — the sim engine. Given the people, decide who
// wins, from what they are actually rated at.
//
// ---------------------------------------------------------------------
// **The gap this closes.**
//
// VDP's `combatSports.js` is a real card-and-booking system: it checks
// that a one-on-one has two participants and not three, that fighters
// share a tier, that a declared winner was on the card, that everyone
// cannot win. All of that is worth having. But its `recordResult(match,
// winnerIds)` takes the WINNER AS A PARAMETER — somebody outside
// decides, and nothing reads a rating. Grep it for `trait`, `rating`,
// `attribute`: zero hits.
//
// Meanwhile this engine generates a `combat` family (Melee Skill,
// Ranged Skill, Tactical Awareness, Bloodlust, Composure Under Fire,
// Weapon Mastery) and a `sports` family (Speed, Coordination,
// Competitive Drive, Team Chemistry, Injury Resistance) on **every
// single NPC**, and until now nothing anywhere read either one. The
// ratings existed and resolved nothing.
//
// ---------------------------------------------------------------------
// **Deterministic, and that is not a limitation — it is the point.**
//
// VACANCY's standing rule is that core decision-making stays
// deterministic. A contest with no variance would mean the higher-rated
// fighter always wins, which is not a sport. A contest using
// `Math.random()` would mean a result nobody can reproduce, and VAGO
// settles prediction markets on these outcomes — an unreproducible
// settlement is one somebody has to be trusted about.
//
// So: **seeded**. The draw comes from a hash of the contest id, the
// tick, and the participants. Same inputs always give the same winner,
// forever, on any machine — and upsets still happen, because the draw
// is compared against a real probability derived from the rating gap.
// Anyone can re-run a settled contest and check it.
//
// ---------------------------------------------------------------------
// **This module decides who wins. It does not pay, book, or broadcast.**
//
// VDP owns the card, VAGO owns the market, Vavlt Stvdios owns the
// stream — that split is stated in combatSports.js's own header and is
// not disturbed here. `resolveContest` returns a result object and
// writes nothing except, optionally, the trait wear of having competed.

'use strict';

const { hashSeed, seededUnit, seededDraw } = require('./seeded.js');

const { getLiveEntity } = require('./entityTraits.js');

// ---------------------------------------------------------------------------
// Disciplines — which ratings decide which kind of contest
// ---------------------------------------------------------------------------
// Weights are interpretive and flagged: no document scores a fight.
// What is NOT invented is the trait list — every name below is verbatim
// from `traits.js`, and a typo would silently weight nothing, so
// `assertDisciplinesReadRealTraits()` at the bottom checks each one
// against the live catalog at require time.
//
// Bloodlust is deliberately absent from `combat`: it describes appetite
// for violence, not skill at it, and weighting it would make a
// bloodthirsty novice beat a disciplined professional.
const DISCIPLINES = {
  combat: {
    physical: { Strength: 1, Endurance: 1, Agility: 1.5, Reflexes: 1.5, 'Pain Tolerance': 1 },
    combat: {
      'Melee Skill': 3, 'Weapon Mastery': 2, 'Tactical Awareness': 2, 'Composure Under Fire': 2,
    },
    mental: { Focus: 1 },
  },
  sport: {
    physical: { Endurance: 1.5, Agility: 1.5, Stamina: 1.5, Reflexes: 1 },
    sports: {
      Speed: 3, Coordination: 3, 'Competitive Drive': 2, 'Injury Resistance': 1,
    },
    mental: { Focus: 1 },
  },
  // A team sport reads the same athletics PLUS the trait that only
  // matters when there is a team: Team Chemistry is worthless in a
  // singles bout and decisive in a five-a-side.
  teamSport: {
    physical: { Endurance: 1.5, Agility: 1, Stamina: 1.5 },
    sports: {
      Speed: 2, Coordination: 2, 'Competitive Drive': 1.5, 'Team Chemistry': 3,
    },
    social: { 'Group Loyalty': 1 },
  },

  // **The house games** — pool, darts, horseshoes, anything where a
  // steady hand and a good eye decide it. Added because a settlement
  // that has rebuilt far enough to have a table in a room is a
  // settlement with a social life, and this engine could already
  // resolve a knife fight and a footrace but not a game of pool.
  //
  // `Vision Acuity` carries the most weight and only appears here:
  // it is generated on every NPC and was read by nothing, the same
  // dead-trait pattern `contest.js` was originally written to fix.
  // Endurance and Strength are deliberately absent — a frail person
  // with a good eye should win.
  precision: {
    physical: { 'Vision Acuity': 3, Reflexes: 1.5, Agility: 1 },
    sports: { Coordination: 3 },
    mental: { Focus: 2 },
  },

  // **Cards, dominoes, board games** — nerve and reading the table.
  // `Risk Assessment` rather than an inverted Impulsivity, because
  // `rateEntity` averages by weight sum and a negative weight would
  // corrupt the divisor rather than penalising the trait.
  //
  // Charisma is here at low weight and is not a joke: a card game is
  // partly a performance, and this is the one discipline where
  // persuading somebody of something false is a skill.
  wits: {
    mental: {
      'Risk Assessment': 3, Memory: 2.5, Focus: 2, 'Problem Solving': 2,
    },
    social: { Charisma: 1 },
  },
};

const DISCIPLINE_NAMES = Object.keys(DISCIPLINES);

// ---------------------------------------------------------------------------
// Rating — one number, from the live sheet
// ---------------------------------------------------------------------------
// LIVE traits via getLiveEntity(), not the generation-time snapshot:
// a Key resolver that shook someone's composure has to show up in the
// next fight, or the simulation and the sport disagree.
function rateEntity(worldState, entityId, discipline = 'combat') {
  const weights = DISCIPLINES[discipline];
  if (!weights) {
    throw new Error(`rateEntity: "${discipline}" is not a discipline (one of: ${DISCIPLINE_NAMES.join(', ')}).`);
  }

  const live = getLiveEntity(worldState, entityId);
  if (!live) throw new Error(`rateEntity: no entity with id ${entityId}.`);

  let total = 0;
  let weightSum = 0;
  const contributions = {};

  for (const [family, traits] of Object.entries(weights)) {
    for (const [trait, weight] of Object.entries(traits)) {
      const value = live.traits?.[family]?.[trait];
      // A trait this entity does not carry contributes nothing and does
      // not silently count as 0 out of 100 — that would punish an
      // entity for a family it was never generated with.
      if (!Number.isFinite(Number(value))) continue;
      total += Number(value) * weight;
      weightSum += weight;
      contributions[`${family}.${trait}`] = Number(value);
    }
  }

  if (weightSum === 0) {
    throw new Error(
      `rateEntity: entity ${entityId} carries none of the traits "${discipline}" reads. `
      + 'An unrated entity cannot be given a number — it has to be refused.',
    );
  }

  return {
    entityId,
    discipline,
    rating: Math.round((total / weightSum) * 10) / 10,
    contributions,
  };
}

// ---------------------------------------------------------------------------
// The seeded draw
// ---------------------------------------------------------------------------
// FNV-1a over a string built from the contest's own facts. Not
// cryptographic and does not need to be — it needs to be reproducible
// and evenly spread, and it is both.
// **Moved to `server/seeded.js`, unchanged.** Mortality needs the same
// primitives — §88's world seed means nothing if deaths are random
// when contests are not — and duplicating a PRNG is how two systems
// end up drawing correlated values for reasons nobody can find later.
// Re-exported below so this module's own API is unchanged.

// Rating gap -> win probability. Logistic, so a small edge is a small
// edge and a large one is not a certainty: at +10 rating the favourite
// wins about 3 times in 4, at +30 about 9 times in 10, and never 10.
// **The ceiling matters.** A probability of 1 would make upsets
// impossible, and a sport where the better athlete always wins is a
// table, not a contest.
const RATING_SCALE = 12;

function winProbability(ratingA, ratingB) {
  const p = 1 / (1 + Math.exp(-(ratingA - ratingB) / RATING_SCALE));
  return Math.min(0.97, Math.max(0.03, Math.round(p * 1000) / 1000));
}

// ---------------------------------------------------------------------------
// The loser's own outcome — real, by direct instruction: "NPCs can
// run, tap out, choose not to fight once they feel a punch... everybody
// punches different, kicks different power, runs different speed." A
// combat bout was strictly binary (win/lose) with no way for the loser
// to have done anything other than stand there and be beaten.
//
// **Reuses the exact real inputs `rateEntity('combat')` already reads
// and the exact real sigmoid `winProbability` already is — no third
// invented curve or threshold.** `combat['Composure Under Fire']` is
// combat's own real measure of holding together under pressure;
// `physical['Pain Tolerance']` is the request's own "once they feel a
// punch." Their mean, run through `winProbability` against 50 — the
// trait scale's own neutral centre, the twelfth standing rule's
// "centre on the average person" applied here — gives the chance an
// ORDINARY loser keeps fighting to the end. A loser who keeps fighting
// is the identical, unchanged `resolveContest` result this function
// always produced; this only ever adds a second real outcome for the
// loser who does not.
//
// **Fled vs. submitted is a real trait comparison, not a second
// invented probability.** `physical.Agility` carries the fight-vs-flee
// choice already: a loser whose own Agility exceeds their own
// Composure Under Fire runs, because that is the one thing they are
// relatively better at; otherwise they stay and submit.
function resolveLoserOutcome(worldState, { loserId, seed }) {
  const live = getLiveEntity(worldState, loserId);
  const composure = Number(live?.traits?.combat?.['Composure Under Fire']);
  const painTolerance = Number(live?.traits?.physical?.['Pain Tolerance']);
  const agility = Number(live?.traits?.physical?.Agility);
  if (!Number.isFinite(composure) || !Number.isFinite(painTolerance)) {
    // Neither trait generated for this entity -- an unrated resolve
    // cannot be given a number any more than an unrated combat skill
    // can (rateEntity's own refusal, same reasoning).
    return 'defeated';
  }
  const resolve = (composure + painTolerance) / 2;
  const keepsFighting = seededDraw([seed, 'contest-resolve', loserId]) < winProbability(resolve, 50);
  if (keepsFighting) return 'defeated';
  return Number.isFinite(agility) && agility > composure ? 'fled' : 'submitted';
}

// ---------------------------------------------------------------------------
// resolveContest()
// ---------------------------------------------------------------------------
// options:
//   participantIds - required, at least two
//   discipline     - combat | sport | teamSport
//   contestId      - any stable id. Part of the seed, so the SAME
//                    fighters on the same tick in two different bouts
//                    can produce different results.
function resolveContest(worldState, options = {}) {
  const {
    participantIds, discipline = 'combat', contestId = null,
    // **The tick is an input, not a read of `worldState` at the moment
    // of the call.** It was the latter, and that quietly made
    // `verifyContest` work only on the tick the bout was fought:
    // re-running a week-old result seeded it with today's tick, drew a
    // different number, and reported a settled contest as unreproduced.
    // For a function whose entire purpose is "anybody can verify a
    // settlement without trusting whoever reported it", verifying only
    // in the same instant is close to no verification at all. Defaults
    // to the world's tick, so every existing caller is unchanged.
    tick = worldState.tick,
  } = options;

  if (!Array.isArray(participantIds) || participantIds.length < 2) {
    throw new Error('resolveContest requires participantIds with at least two entrants.');
  }
  if (new Set(participantIds).size !== participantIds.length) {
    throw new Error('resolveContest: an entity cannot compete against itself.');
  }

  const rated = participantIds.map((id) => rateEntity(worldState, id, discipline));
  const seed = seedFor({ contestId, tick, discipline, participantIds });
  const draw = seededUnit(seed);
  const { winner, favourite, probability } = pickWinner(rated, draw);

  // Real for `combat` only — nobody flees a card game or a footrace,
  // and `resolveLoserOutcome` reads traits (`Composure Under Fire`,
  // `Pain Tolerance`) that only `combat`'s own discipline weights
  // give meaning to. Every participant other than the winner gets a
  // real outcome; `pickWinner` generalises past two entrants, so a
  // three-way bout can have two losers with two different outcomes.
  const loserOutcomes = discipline === 'combat'
    ? Object.fromEntries(
      participantIds
        .filter((id) => id !== winner.entityId)
        .map((loserId) => [loserId, resolveLoserOutcome(worldState, { loserId, seed })]),
    )
    : null;

  return {
    contestId,
    discipline,
    tick,
    winnerId: winner.entityId,
    // Everything a settlement needs to be re-checked by somebody who
    // does not trust the result.
    seed,
    draw: Math.round(draw * 10000) / 10000,
    favouriteId: favourite.entityId,
    favouriteProbability: probability,
    upset: winner.entityId !== favourite.entityId,
    ratings: rated.map((r) => ({ entityId: r.entityId, rating: r.rating })),
    contributions: Object.fromEntries(rated.map((r) => [r.entityId, r.contributions])),
    // `null` for every non-combat discipline -- a declared absence,
    // never an empty object a caller could mistake for "nobody fled."
    loserOutcomes,
  };
}

// The seed a contest's own facts produce. Participants are sorted so
// that the same bout entered in either order resolves identically —
// otherwise a result would depend on argument order, which is the kind
// of thing nobody finds until a market settles twice.
function seedFor({ contestId, tick, discipline, participantIds }) {
  return hashSeed([
    contestId ?? 'contest',
    tick,
    discipline,
    [...participantIds].sort((a, b) => a - b).join(','),
  ]);
}

// Cumulative selection weighted by rating. With two entrants this is
// exactly the logistic probability above; with more it generalises
// without a special case.
function pickWinner(rated, draw) {
  const favourite = rated.reduce((best, r) => (r.rating > best.rating ? r : best));
  const underdog = rated.reduce((worst, r) => (r.rating < worst.rating ? r : worst));
  const probability = winProbability(favourite.rating, underdog.rating);

  let winner;
  if (rated.length === 2) {
    winner = draw < probability ? favourite : underdog;
  } else {
    // Softmax-ish share of an exponential rating weight.
    const weights = rated.map((r) => Math.exp(r.rating / RATING_SCALE));
    const total = weights.reduce((sum, w) => sum + w, 0);
    let cursor = draw * total;
    winner = rated[rated.length - 1];
    for (let i = 0; i < rated.length; i += 1) {
      cursor -= weights[i];
      if (cursor <= 0) { winner = rated[i]; break; }
    }
  }
  return { winner, favourite, probability };
}

// Re-check a contest from its own result. The check a prediction market
// needs: anybody can verify a settlement without trusting whoever
// reported it.
//
// **Two claims, checked separately, and neither of them re-rates
// anybody.** The first version re-ran `resolveContest` against the LIVE
// world, which meant a result could only be verified in the instant it
// was produced — a day later the entrants' traits had drifted, the tick
// had moved, and a perfectly honest settlement failed its own audit.
//
// What a verifier actually needs to establish is narrower and stronger:
//
//   1. the seed is the one this contest's own identifying facts produce
//      — its id, its tick, its discipline and its entrants — so nobody
//      picked a seed that suited them;
//   2. the reported winner is the one those ratings and that seed
//      select.
//
// The RECORDED ratings are the right input to the second claim. They
// are part of what was published, so anybody re-checking is checking
// the arithmetic that was actually claimed rather than re-deriving a
// different one from a world that has moved on.
function verifyContest(worldState, result) {
  const participantIds = result.ratings.map((r) => r.entityId);
  const seed = seedFor({
    contestId: result.contestId,
    tick: result.tick,
    discipline: result.discipline,
    participantIds,
  });
  const { winner } = pickWinner(result.ratings, seededUnit(seed));

  return {
    reproduced: winner.entityId === result.winnerId && seed === result.seed,
    seedMatches: seed === result.seed,
    expected: result.winnerId,
    actual: winner.entityId,
  };
}

// ---------------------------------------------------------------------------
// Submission holds — choke / knee-on-neck / arm-hold — a real, LIVE pressure
// bar, by direct instruction alongside task #136's own per-incident
// force-level rating (`crime.js`'s `FORCE_LEVELS`, a SNAPSHOT taken once an
// incident has already resolved).
// ---------------------------------------------------------------------------
// This is that rating's live counterpart: a bar an onlooker, or a UI, would
// actually watch MOVE round by round while a hold is still happening, not
// a single number produced after the fact.
//
// **Deterministic and re-runnable, same discipline as the rest of this
// file — never a value that lives only in server memory while a request is
// in flight.** `resolveHold` computes the WHOLE round-by-round trace in one
// seeded call, the same way `resolveContest` settles a whole bout in one
// call. `rounds` IS the live bar: one entry per round, for a caller to
// render exactly as recorded, in order. `verifyHold` re-derives the
// identical trace from the recorded seed and the recorded per-round
// chances — the same real guarantee `verifyContest`'s own header already
// argues for (recorded inputs, not a re-read of a world that moved on).
//
// **Two real endings, not one mechanic pretending all three holds are the
// same physiological event.** A choke restricts the airway/carotids, and a
// knee planted across the neck does the same thing from a different
// position — both can genuinely make somebody pass out. An arm hold is a
// joint lock: it does not black anybody out, it makes the pain unbearable
// first. `HOLD_TECHNIQUES[name].passesOut` carries that distinction rather
// than inventing a pass-out path for a technique that cannot physically
// produce one.
const HOLD_TECHNIQUES = {
  // Airway/blood restriction — resisted by raw strength (breaking the
  // grip) and endurance (how long the body holds out without air).
  choke: { passesOut: true, resistTraits: ['Strength', 'Endurance'] },
  knee_on_neck: { passesOut: true, resistTraits: ['Strength', 'Endurance'] },
  // A joint lock — resisted by strength (fighting the angle) and pain
  // tolerance (enduring it), never endurance, which has nothing to do
  // with how long an elbow can bend the wrong way.
  arm_hold: { passesOut: false, resistTraits: ['Strength', 'Pain Tolerance'] },
};
const HOLD_TECHNIQUE_NAMES = Object.keys(HOLD_TECHNIQUES);

const HOLD_PASS_OUT_THRESHOLD = 100; // the bar is 0..100
// Past this, the victim gets a real chance to tap out each round rather
// than being carried helplessly to the pass-out threshold — reuses
// `resolveLoserOutcome`'s own real resolve check (Composure Under Fire +
// Pain Tolerance, against the trait scale's own neutral centre), never a
// second, invented "give up" curve.
const HOLD_SUBMIT_THRESHOLD = 60;
const HOLD_MAX_ROUNDS = 8; // a real bound; nobody holds a struggling person forever
const HOLD_BASE_PRESSURE_PER_ROUND = 25; // an even matchup fills the bar in ~4 rounds

// The holder's own control — how much pressure they can apply per round.
// `Melee Skill` is technique; `Strength` is the raw grip/weight behind it.
// The same `rateEntity`-style "mean of the real traits", no new curve.
function holderControlOf(worldState, holderId) {
  const live = getLiveEntity(worldState, holderId);
  const strength = Number(live?.traits?.physical?.Strength);
  const melee = Number(live?.traits?.combat?.['Melee Skill']);
  if (!Number.isFinite(strength) || !Number.isFinite(melee)) return null;
  return (strength + melee) / 2;
}

// The victim's own resistance — which two real traits depends on the
// technique (see HOLD_TECHNIQUES' own header above).
function victimResistanceOf(worldState, victimId, technique) {
  const live = getLiveEntity(worldState, victimId);
  const [traitA, traitB] = HOLD_TECHNIQUES[technique].resistTraits;
  const a = Number(live?.traits?.physical?.[traitA]);
  const b = Number(live?.traits?.physical?.[traitB]);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return (a + b) / 2;
}

// The victim's own real resolve to keep enduring once the bar crosses
// HOLD_SUBMIT_THRESHOLD — byte-identical to `resolveLoserOutcome`'s own
// Composure Under Fire + Pain Tolerance mean, read against 50. `null` when
// either trait was never generated for this entity, same as that function's
// own "an unrated resolve cannot be given a number" refusal.
function victimEnduranceChanceOf(worldState, victimId) {
  const live = getLiveEntity(worldState, victimId);
  const composure = Number(live?.traits?.combat?.['Composure Under Fire']);
  const painTolerance = Number(live?.traits?.physical?.['Pain Tolerance']);
  if (!Number.isFinite(composure) || !Number.isFinite(painTolerance)) return null;
  return winProbability((composure + painTolerance) / 2, 50);
}

// The shared round loop `resolveHold` and `verifyHold` both run, so the two
// can never quietly drift apart into two different mechanics with the same
// name. Takes the per-round CHANCES, never live traits — a verifier re-runs
// the arithmetic that was actually claimed, not a fresh rating of a world
// that may have moved on since (`verifyContest`'s own reasoning, applied
// here).
function runHoldRounds(seed, { holdChance, escapeChance, passesOut, enduranceChance }) {
  const rounds = [];
  let pressure = 0;
  let outcome = 'released';
  for (let round = 1; round <= HOLD_MAX_ROUNDS; round += 1) {
    const escapeDraw = seededDraw([seed, 'hold-escape', round]);
    if (escapeDraw < escapeChance) {
      outcome = 'escaped';
      rounds.push({ round, pressure, event: 'escaped' });
      break;
    }

    const gainDraw = seededDraw([seed, 'hold-gain', round]);
    const gain = gainDraw < holdChance
      ? HOLD_BASE_PRESSURE_PER_ROUND
      : HOLD_BASE_PRESSURE_PER_ROUND * 0.4;
    pressure = Math.min(HOLD_PASS_OUT_THRESHOLD, pressure + gain);

    if (passesOut && pressure >= HOLD_PASS_OUT_THRESHOLD) {
      outcome = 'passed_out';
      rounds.push({ round, pressure, event: 'passed_out' });
      break;
    }

    if (pressure >= HOLD_SUBMIT_THRESHOLD && enduranceChance !== null) {
      const resolveDraw = seededDraw([seed, 'hold-resolve', round]);
      if (resolveDraw >= enduranceChance) {
        outcome = 'submitted';
        rounds.push({ round, pressure, event: 'submitted' });
        break;
      }
    }

    rounds.push({ round, pressure, event: 'held' });
  }
  return { rounds, outcome, finalPressure: pressure };
}

// options: holderId, victimId, technique ('choke'|'knee_on_neck'|
//          'arm_hold'), tick (defaults to the world's), contestId (any
//          stable id, same role `resolveContest`'s own has).
//
// Returns `null` on an honest unmet precondition (an unrated entity — the
// same refusal `rateEntity`'s own callers already get), never throws for
// that case. Throws only for a bad technique name or a holder targeting
// themselves — the same "a bad argument throws, an unready world returns
// null" split every `offerXMission` function in `missionVariety.js`
// already holds.
function resolveHold(worldState, options = {}) {
  const {
    holderId, victimId, technique, tick = worldState.tick, contestId = null,
  } = options;

  if (!HOLD_TECHNIQUES[technique]) {
    throw new Error(
      `resolveHold: "${technique}" is not a real technique. The three are: `
      + `${HOLD_TECHNIQUE_NAMES.join(', ')}.`,
    );
  }
  if (Number(holderId) === Number(victimId)) {
    throw new Error('resolveHold: a hold needs two different people.');
  }

  const control = holderControlOf(worldState, Number(holderId));
  const resistance = victimResistanceOf(worldState, Number(victimId), technique);
  if (control === null || resistance === null) return null;

  const seed = seedFor({
    contestId: contestId ?? 'hold',
    tick,
    discipline: `hold:${technique}`,
    participantIds: [Number(holderId), Number(victimId)],
  });
  // The same sigmoid `winProbability` already is, read both ways: the
  // holder's own chance to keep building pressure, and the victim's own
  // chance to break free outright — the complement INPUTS, not `1 -
  // holdChance`, so both stay inside winProbability's own real floor and
  // ceiling rather than one of them escaping it.
  const holdChance = winProbability(control, resistance);
  const escapeChance = winProbability(resistance, control);
  const enduranceChance = victimEnduranceChanceOf(worldState, Number(victimId));

  const passesOut = HOLD_TECHNIQUES[technique].passesOut;
  const { rounds, outcome, finalPressure } = runHoldRounds(seed, {
    holdChance, escapeChance, passesOut, enduranceChance,
  });

  return {
    technique,
    holderId: Number(holderId),
    victimId: Number(victimId),
    tick,
    contestId,
    seed,
    holdChance,
    escapeChance,
    enduranceChance,
    rounds,
    finalPressure,
    outcome,
  };
}

// Re-check a hold from its own result — the identical real guarantee
// `verifyContest` already gives a settled bout. See that function's own
// header for why this re-derives from the RECORDED seed and chances rather
// than re-reading the live world.
function verifyHold(worldState, result) {
  if (!HOLD_TECHNIQUES[result.technique]) {
    throw new Error(`verifyHold: "${result.technique}" is not a real technique.`);
  }
  const seed = seedFor({
    contestId: result.contestId ?? 'hold',
    tick: result.tick,
    discipline: `hold:${result.technique}`,
    participantIds: [result.holderId, result.victimId],
  });
  const { rounds, outcome, finalPressure } = runHoldRounds(seed, {
    holdChance: result.holdChance,
    escapeChance: result.escapeChance,
    passesOut: HOLD_TECHNIQUES[result.technique].passesOut,
    enduranceChance: result.enduranceChance,
  });
  return {
    seedMatches: seed === result.seed,
    reproduced: seed === result.seed
      && outcome === result.outcome
      && finalPressure === result.finalPressure
      && rounds.length === result.rounds.length,
    expected: result.outcome,
    actual: outcome,
  };
}

// ---------------------------------------------------------------------------
// Every weighted trait must be a real one, checked at require time.
// ---------------------------------------------------------------------------
// A misspelled trait name would be skipped silently by rateEntity and
// simply weight nothing — the discipline would still return a number
// and it would be the wrong number. This is the flows.js dead-signal
// lesson applied before it can happen twice.
function assertDisciplinesReadRealTraits() {
  // Required lazily: traits.js has no dependency on this file, but
  // keeping the import here makes the check obviously self-contained.
  const { TRAIT_FAMILIES } = require('./traits.js');
  const bad = [];
  for (const [name, weights] of Object.entries(DISCIPLINES)) {
    for (const [family, traits] of Object.entries(weights)) {
      const known = TRAIT_FAMILIES[family];
      if (!known) { bad.push(`${name}: no trait family "${family}"`); continue; }
      for (const trait of Object.keys(traits)) {
        if (!known.includes(trait)) bad.push(`${name}: ${family} has no trait "${trait}"`);
      }
    }
  }
  if (bad.length) {
    throw new Error(`contest.js weights traits that do not exist:\n  ${bad.join('\n  ')}`);
  }
}

assertDisciplinesReadRealTraits();

module.exports = {
  DISCIPLINES,
  DISCIPLINE_NAMES,
  seedFor,
  pickWinner,
  RATING_SCALE,
  rateEntity,
  winProbability,
  resolveContest,
  verifyContest,
  HOLD_TECHNIQUES,
  HOLD_TECHNIQUE_NAMES,
  HOLD_PASS_OUT_THRESHOLD,
  HOLD_SUBMIT_THRESHOLD,
  HOLD_MAX_ROUNDS,
  resolveHold,
  verifyHold,
  assertDisciplinesReadRealTraits,
};
