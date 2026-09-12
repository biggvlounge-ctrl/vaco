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

const { hashSeed, seededUnit } = require('./seeded.js');

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
// resolveContest()
// ---------------------------------------------------------------------------
// options:
//   participantIds - required, at least two
//   discipline     - combat | sport | teamSport
//   contestId      - any stable id. Part of the seed, so the SAME
//                    fighters on the same tick in two different bouts
//                    can produce different results.
function resolveContest(worldState, options = {}) {
  const { participantIds, discipline = 'combat', contestId = null } = options;

  if (!Array.isArray(participantIds) || participantIds.length < 2) {
    throw new Error('resolveContest requires participantIds with at least two entrants.');
  }
  if (new Set(participantIds).size !== participantIds.length) {
    throw new Error('resolveContest: an entity cannot compete against itself.');
  }

  const rated = participantIds.map((id) => rateEntity(worldState, id, discipline));

  // Seeded from facts the contest already has. Participants are sorted
  // so that the same bout entered in either order resolves identically
  // — otherwise a result would depend on argument order, which is the
  // kind of thing nobody finds until a market settles twice.
  const seed = hashSeed([
    contestId ?? 'contest',
    worldState.tick,
    discipline,
    [...participantIds].sort((a, b) => a - b).join(','),
  ]);
  const draw = seededUnit(seed);

  // Cumulative selection weighted by rating. With two entrants this is
  // exactly the logistic probability above; with more it generalises
  // without a special case.
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

  return {
    contestId,
    discipline,
    tick: worldState.tick,
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
  };
}

// Run the same contest again from its own result. The check a
// prediction market needs: anybody can verify a settlement without
// trusting whoever reported it.
function verifyContest(worldState, result) {
  const rerun = resolveContest(worldState, {
    participantIds: result.ratings.map((r) => r.entityId),
    discipline: result.discipline,
    contestId: result.contestId,
  });
  return {
    reproduced: rerun.winnerId === result.winnerId && rerun.seed === result.seed,
    expected: result.winnerId,
    actual: rerun.winnerId,
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
  RATING_SCALE,
  rateEntity,
  winProbability,
  resolveContest,
  verifyContest,
  assertDisciplinesReadRealTraits,
};
