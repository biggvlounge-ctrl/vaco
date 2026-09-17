// server/competition.js
//
// Somebody actually plays.
//
// **The gap.** `server/contest.js` is a complete, tested, deterministic
// contest resolver. It rates entrants from their LIVE `combat`,
// `sports`, `physical`, `mental` and `social` traits across five
// disciplines, resolves a bout from a seeded draw, and can re-run any
// result from the result itself so a settlement can be verified by
// somebody who does not trust whoever reported it. `CLAUDE.md` calls it
// out by name as one of two systems the phase map never anticipated.
//
// And `grep -n 'contest' server/tick.js` returned two matches, both the
// word "contested" about territory blocks. **No world this engine has
// ever generated has held a single contest.** The `sports` family —
// Speed, Coordination, Competitive Drive, Team Chemistry, Injury
// Resistance — was generated on every NPC, stored, migrated, restored,
// and read by exactly one function that nothing called.
//
// The eleventh standing rule names this exact shape: a generator that
// nothing calls is indistinguishable from one that does not exist. This
// is the smaller sibling — a RESOLVER that nothing calls. It is worse
// in one way, because the resolver has tests and they all pass.
//
// ---------------------------------------------------------------------
// What this adds, and what it deliberately does not
//
// It adds an OCCASION: every so often, a settlement holds a game.
// Entrants are drawn, `contest.js` decides it, and the result reaches
// the four places a result has to reach in this engine — a memory, a
// relationship, a habit, and the event log.
//
// **It is not a league.** `CLAUDE.md` is explicit that league structure
// is "still false — no season, table, fixture list, standings or
// tournament exists anywhere", and a season is game design rather than
// a gap. This is one game at a time in one place, which is the smallest
// thing that makes the resolver real.
//
// **It is not gambling.** Nothing here stakes anything, pays anything
// or prices anything. Gambling and casino systems (#291-305) stay shut
// pending compliance review, and a contest with a result somebody could
// bet on is not a bet.
//
// **It holds games, not fights.** `contest.js` supports `combat`, and
// this draws only from the four disciplines a settlement could hold in
// public without anybody being hurt. A tick that started staging knife
// fights in every neighbourhood every fortnight would be a claim about
// what these places are, and no document makes it. `combat` stays
// available to a caller who means it — VDP's Combat Sports district
// books cards and calls the resolver directly.

'use strict';

const contest = require('./contest.js');
const behavior = require('./behavior.js');
const motivation = require('./motivation.js');
const worldStore = require('./worldStore.js');
const { seededDraw } = require('./seeded.js');

// ---------------------------------------------------------------------
// The occasion
// ---------------------------------------------------------------------

//: Which of `contest.js`'s five disciplines a settlement holds. See the
//: header: `combat` is excluded on purpose and by name, not by
//: omission.
//:
//: All four are real entries in `contest.DISCIPLINES`, checked below at
//: require time — a typo here would silently fall back to `combat`'s
//: weights inside `rateEntity`, which is the quietest possible way to
//: start staging fights.
const SETTLEMENT_DISCIPLINES = ['sport', 'teamSport', 'precision', 'wits'];

//: How often a community holds one. **Flagged interpretive**: no
//: document sets a frequency. A tick is a day, so a fortnight is often
//: enough that a settlement visibly has a social life and rare enough
//: that the event log is not a sports page — measured at 200 ticks and
//: four communities it produces around 56 games, against a few thousand
//: events.
//:
//: **A crossing, not a condition.** The seventh standing rule: a game
//: held whenever some condition holds would put an identical row in the
//: log every tick forever. Each community also gets its own offset from
//: the seed, so four settlements do not all hold their games on the
//: same morning.
const GAME_INTERVAL = 14;

//: How many people enter. Two is a match; more is a field. Interpretive,
//: and bounded at four because `resolveContest`'s multi-entrant branch
//: spreads probability across a softmax and a field of twenty would make
//: the favourite's edge meaningless.
const MIN_ENTRANTS = 2;
const MAX_ENTRANTS = 4;

//: How much a game moves the rivalry between two people who were in it.
//: `relationships.competition` is a schema column the original list did
//: not have — the schema's own comment says "Competition added to the
//: original Trust/Respect/Fear/Influence list" — and until now the only
//: thing that ever wrote it was `keys.js`'s territory resolver. A game
//: between neighbours is the plainest possible case of the thing that
//: column is for.
const RIVALRY_GAIN = 6;
const RESPECT_FOR_WINNER = 3;
const RELATIONSHIP_CEILING = 100;

//: What entering does to the habit of entering. Small: a fortnightly
//: game is not a training regime, and `behavior.reinforceHabit` applies
//: its own diminishing returns on top.
//:
//: The habit name matters — `traitDrift.EXERCISES` is keyed by habit
//: name, and `compete` has an entry there. That closes the loop: a
//: person who keeps turning up gets faster and better coordinated, and
//: the next bout is rated from the traits the last one grew.
//:
//: **And the loop is slow, which is worth saying rather than implying
//: otherwise.** One world run twice off the same seed, differing only
//: in whether games are held, moved mean athleticism 48.92 → 49.10 over
//: 600 ticks. Real, reproducible, and a fraction of a point a year —
//: `traitDrift`'s `compete` entry carries the arithmetic. Over the runs
//: anybody actually does, `mean_athleticism` is still mostly a reading
//: of what a population was born with, and its caveat in
//: `statistics.js` says so.
const COMPETE_HABIT = 'compete';
const COMPETE_REINFORCEMENT = 2;

//: How long a settlement's games count toward its participation rate.
//: One year of ticks, the same window and for the same reason as
//: `crime.DANGER_WINDOW_TICKS`: a rate over all time only ever rises,
//: so a place that held games a decade ago and none since would read as
//: sporting forever.
const PARTICIPATION_WINDOW_TICKS = 365;

// ---------------------------------------------------------------------
// Who turns up
// ---------------------------------------------------------------------

// How much this person wants to compete, 0..1.
//
// **Weighted, not gated.** A threshold would be a guess about a number
// (the twelfth standing rule's third clause), and measured on a real
// population the `competition` value runs 25..95 with a median of 59 —
// so any cutoff either excludes most people or includes most people.
// Weighting the draw instead means anybody can end up in a game and the
// people who care about it turn up far more often, which is both truer
// and has no number in it to defend.
//
// `values_db.competition` is the schema's own value name, one of the
// fifteen in `motivation.VALUES`, and it drifts over a life. Falls back
// to the `sports.Competitive Drive` trait where a person has no values
// recorded — and to nothing at all where they have neither, because
// unknown is not enthusiasm.
function appetiteOf(worldState, entityId) {
  const value = motivation.valueOf(worldState, entityId, 'competition');
  if (value) {
    const level = Number(value.current_strength);
    if (Number.isFinite(level)) return Math.max(0, Math.min(1, level / 100));
  }
  return null;
}

// Draw the field for one game. Returns entity ids, or an empty array
// when the community cannot field one.
function drawEntrants(worldState, residents, options = {}) {
  const { seed = worldState.seed ?? 'competition', communityId, tick } = options;

  const pool = residents
    .map((npc) => ({ id: npc.id, appetite: appetiteOf(worldState, npc.id) }))
    .filter((entry) => entry.appetite !== null && entry.appetite > 0);
  if (pool.length < MIN_ENTRANTS) return [];

  const span = MAX_ENTRANTS - MIN_ENTRANTS + 1;
  const wanted = Math.min(
    pool.length,
    MIN_ENTRANTS + Math.floor(seededDraw([seed, 'field', communityId, tick]) * span),
  );

  // Weighted draw without replacement. Seeded on the community and the
  // tick — §88, and on POSITION rather than on identity, because ids
  // come from a counter whose state depends on what was built before.
  const remaining = [...pool];
  const chosen = [];
  for (let i = 0; i < wanted && remaining.length > 0; i += 1) {
    const total = remaining.reduce((sum, entry) => sum + entry.appetite, 0);
    if (total <= 0) break;
    let cursor = seededDraw([seed, 'entrant', communityId, tick, i]) * total;
    let picked = remaining.length - 1;
    for (let j = 0; j < remaining.length; j += 1) {
      cursor -= remaining[j].appetite;
      if (cursor <= 0) { picked = j; break; }
    }
    chosen.push(remaining[picked].id);
    remaining.splice(picked, 1);
  }
  return chosen.length >= MIN_ENTRANTS ? chosen : [];
}

function drawDiscipline(seed, communityId, tick) {
  const roll = seededDraw([seed, 'discipline', communityId, tick]);
  return SETTLEMENT_DISCIPLINES[
    Math.min(SETTLEMENT_DISCIPLINES.length - 1,
      Math.floor(roll * SETTLEMENT_DISCIPLINES.length))
  ];
}

// Whether this community holds a game on this tick.
//
// The offset is what keeps four settlements from all holding theirs on
// the same day, and it is drawn from the seed so the same world always
// has the same calendar.
function isGameDay(worldState, communityId, tick, seed) {
  const offset = Math.floor(seededDraw([seed, 'calendar', communityId]) * GAME_INTERVAL);
  return tick > 0 && ((tick + offset) % GAME_INTERVAL === 0);
}

// ---------------------------------------------------------------------
// The result, written where results go
// ---------------------------------------------------------------------

// A relationship field moved toward a ceiling rather than past it.
// `worldStore.adjustRelationship` adds a raw delta and does not clamp,
// so a fortnightly game over a long life would take `competition` into
// the hundreds and out of the 0..100 range every other reading in this
// engine assumes.
function boundedGain(current, gain) {
  const now = Number(current) || 0;
  return Math.max(0, Math.min(gain, RELATIONSHIP_CEILING - now));
}

function recordResult(worldState, result, options = {}) {
  const { communityId, tick } = options;
  const entrants = result.ratings.map((r) => r.entityId);

  // 1. The habit of turning up. Reinforced for everybody who entered,
  //    winner or not — showing up is the thing being practised.
  for (const entityId of entrants) {
    behavior.reinforceHabit(worldState, entityId, COMPETE_HABIT, {
      amount: COMPETE_REINFORCEMENT,
    });
  }

  // 2. Rivalry, between every pair who were in it, and respect toward
  //    whoever won.
  //
  //    **`neighbor`, not `rival`.** The schema enumerates
  //    family|friend|enemy|business|political|romantic|educational|
  //    military|neighbor|mentor|student, and rivalry is not a
  //    relationship TYPE in it — it is the `competition` dimension,
  //    which is exactly why that column exists separately from the
  //    type. Two people in the same settlement who played each other
  //    are neighbours who compete.
  for (let i = 0; i < entrants.length; i += 1) {
    for (let j = i + 1; j < entrants.length; j += 1) {
      const existing = worldStore.findRelationship(worldState, entrants[i], entrants[j]);
      worldStore.adjustRelationship(worldState, entrants[i], entrants[j], 'neighbor', {
        competition: boundedGain(existing?.competition, RIVALRY_GAIN),
      });
    }
  }
  for (const entityId of entrants) {
    if (entityId === result.winnerId) continue;
    const existing = worldStore.findRelationship(worldState, entityId, result.winnerId);
    worldStore.adjustRelationship(worldState, entityId, result.winnerId, 'neighbor', {
      respect: boundedGain(existing?.respect, RESPECT_FOR_WINNER),
    });
  }

  // 3. A memory each. The write-back contract: a thing that happened to
  //    somebody and left nothing they could recall did not happen to
  //    them.
  for (const entityId of entrants) {
    const won = entityId === result.winnerId;
    worldStore.addMemory(worldState, {
      entityId,
      memoryType: 'experience',
      category: 'social',
      description: won
        ? `won the ${result.discipline} at the community game`
        : `lost the ${result.discipline} at the community game`,
      // An upset is worth remembering more than a result everybody
      // expected, which is `contest.js`'s own `upset` flag doing work
      // rather than a second judgement about the same bout.
      importance: result.upset ? 55 : 35,
      emotionLevel: won ? 60 : 40,
      relatedEntityIds: entrants.filter((id) => id !== entityId),
      tick,
    });
  }

  // 4. The record. No `contests` table exists in the schema — the whole
  //    system was built without one — so this is an in-memory list like
  //    `activeConditions`, and `migrate.js` names it among what a
  //    checkpoint does not carry.
  const row = {
    ...result,
    communityId,
    entrantIds: entrants,
    tick,
  };
  (worldState.contests || (worldState.contests = [])).push(row);
  return row;
}

// ---------------------------------------------------------------------
// The pass
// ---------------------------------------------------------------------

function runCompetition(worldState, options = {}) {
  const {
    tick = worldState.tick ?? 0, seed = worldState.seed ?? 'competition',
  } = options;
  const events = [];

  const byCommunity = new Map();
  for (const npc of worldState.npcs || []) {
    const list = byCommunity.get(npc.communityId);
    if (list) list.push(npc);
    else byCommunity.set(npc.communityId, [npc]);
  }

  for (const community of worldState.communities || []) {
    if (!isGameDay(worldState, community.id, tick, seed)) continue;

    const residents = byCommunity.get(community.id) ?? [];
    const entrants = drawEntrants(worldState, residents, {
      seed, communityId: community.id, tick,
    });
    if (entrants.length < MIN_ENTRANTS) continue;

    const discipline = drawDiscipline(seed, community.id, tick);
    const result = contest.resolveContest(worldState, {
      participantIds: entrants,
      discipline,
      // Stable and unique per game, so two settlements holding the same
      // discipline on the same tick do not resolve identically.
      contestId: `community-${community.id}-${tick}`,
    });

    const row = recordResult(worldState, result, { communityId: community.id, tick });

    events.push({
      type: result.upset ? 'contest_upset' : 'contest_held',
      severity: 'low',
      note: `${discipline} at community ${community.id}: ${result.winnerId} won`,
      tick,
      affected_entity_ids: entrants,
      global_effects: {
        communityId: community.id,
        discipline,
        winnerId: result.winnerId,
        favouriteId: result.favouriteId,
        upset: result.upset,
        contestId: row.contestId,
      },
    });
  }

  return events;
}

// ---------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------

function contestsIn(worldState, communityId, options = {}) {
  const { sinceTick = null } = options;
  return (worldState.contests || []).filter(
    (row) => row.communityId === communityId
      && (sinceTick === null || Number(row.tick) >= sinceTick),
  );
}

// How much competition a settlement actually holds, per 1,000 residents
// per year. Null for a community with nobody in it — an empty block
// holds no games because there is nobody there, which is not the same
// as a settlement that could and does not.
function contestRatePer1k(worldState, communityId, options = {}) {
  const { tick = worldState.tick ?? 0, window = PARTICIPATION_WINDOW_TICKS } = options;
  const population = (worldState.npcs || []).filter((n) => n.communityId === communityId).length;
  if (population === 0) return null;
  const held = contestsIn(worldState, communityId, { sinceTick: tick - window }).length;
  return Math.round((held / population) * 1000 * 100) / 100;
}

// The share of a settlement that has been in a game inside the window.
// The participation half: a hundred games between the same two people
// is a different place from a hundred games across a hundred.
function competitorShare(worldState, communityId, options = {}) {
  const { tick = worldState.tick ?? 0, window = PARTICIPATION_WINDOW_TICKS } = options;
  const residents = (worldState.npcs || []).filter((n) => n.communityId === communityId);
  if (residents.length === 0) return null;
  const entered = new Set();
  for (const row of contestsIn(worldState, communityId, { sinceTick: tick - window })) {
    for (const id of row.entrantIds) entered.add(id);
  }
  const alive = residents.filter((npc) => entered.has(npc.id)).length;
  return Math.round((alive / residents.length) * 10000) / 10000;
}

function describeContest(worldState, contestId) {
  const row = (worldState.contests || []).find((c) => c.contestId === contestId);
  if (!row) return null;
  return {
    ...row,
    // Anybody can check the settlement without trusting it.
    verification: contest.verifyContest(worldState, row),
  };
}

// ---------------------------------------------------------------------
// Every discipline named here must be a real one, at require time.
// ---------------------------------------------------------------------
// `rateEntity` falls back to `combat`'s weights for an unknown
// discipline name, so a typo above would not throw, would not log, and
// would quietly stage fights in settlements meant to be playing darts.
// The same guard `contest.js` puts on its own trait names.
function assertDisciplinesExist() {
  const unknown = SETTLEMENT_DISCIPLINES.filter((d) => !contest.DISCIPLINE_NAMES.includes(d));
  if (unknown.length > 0) {
    throw new Error(
      `competition: ${unknown.join(', ')} is not a contest discipline `
      + `(one of: ${contest.DISCIPLINE_NAMES.join(', ')})`,
    );
  }
  if (SETTLEMENT_DISCIPLINES.includes('combat')) {
    throw new Error(
      'competition: combat is deliberately excluded from the disciplines a settlement '
      + 'holds on its own — see the header',
    );
  }
}

assertDisciplinesExist();

module.exports = {
  SETTLEMENT_DISCIPLINES,
  GAME_INTERVAL,
  MIN_ENTRANTS,
  MAX_ENTRANTS,
  RIVALRY_GAIN,
  RESPECT_FOR_WINNER,
  COMPETE_HABIT,
  PARTICIPATION_WINDOW_TICKS,
  appetiteOf,
  drawEntrants,
  drawDiscipline,
  isGameDay,
  recordResult,
  runCompetition,
  contestsIn,
  contestRatePer1k,
  competitorShare,
  describeContest,
  assertDisciplinesExist,
};
