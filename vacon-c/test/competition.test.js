// Somebody actually plays.
//
// **The gap this closes is the smallest and the most embarrassing kind.**
// `server/contest.js` is a complete contest resolver: five disciplines,
// live traits, a seeded draw, and a result that can be re-run from
// itself so a settlement can be verified by somebody who does not trust
// whoever reported it. It has its own test file. Every test in it
// passes. `CLAUDE.md` names it as one of two systems the phase map
// never anticipated.
//
// And `grep -n 'contest' server/tick.js` returned two matches, both the
// word "contested" about territory blocks. **No world this engine had
// ever generated held a single contest.** The `sports` family — Speed,
// Coordination, Competitive Drive, Team Chemistry, Injury Resistance —
// was generated on every NPC, stored, migrated, restored, and read by
// exactly one function nothing called.
//
// The eleventh standing rule is about a generator nothing calls. This
// is the sibling: a RESOLVER nothing calls, which is worse in one way,
// because the resolver has tests and they are green.
//
// **A second defect fell out of building it, and it was older.** The
// `compete` habit would not form: measured at 0.7 after 200 ticks. So
// would `gathering`, at 0.3, and `gathering` had been shipping since the
// Behavior Engine was built. Habit decay was a flat 0.5 a tick against
// reinforcement that arrives per occurrence, and flat decay against
// periodic reinforcement is a step function — daily routines found a
// balance at 75 and everything practised less often fell to zero. The
// weekly frequency was wired, firing, and inert.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const competition = require('../server/competition.js');
const contest = require('../server/contest.js');
const behavior = require('../server/behavior.js');
const traitDrift = require('../server/traitDrift.js');
const traits = require('../server/traits.js');
const statistics = require('../server/statistics.js');
const engine = require('../server/engine.js');
const worldgen = require('../server/worldgen.js');

// -- the vocabulary -------------------------------------------------------

test('every discipline a settlement holds is a real one, and none of them is combat', () => {
  // `rateEntity` falls back to `combat`'s weights for an unknown
  // discipline name — it does not throw and does not log — so a typo
  // here would quietly stage fights in settlements meant to be playing
  // darts. The module asserts this at require time; this is the same
  // check held where somebody will see it fail.
  for (const discipline of competition.SETTLEMENT_DISCIPLINES) {
    assert.ok(contest.DISCIPLINE_NAMES.includes(discipline),
      `"${discipline}" is not a contest discipline`);
  }
  assert.equal(competition.SETTLEMENT_DISCIPLINES.includes('combat'), false,
    'a settlement now stages knife fights every fortnight, which no document asks for');
  assert.doesNotThrow(() => competition.assertDisciplinesExist());
});

test('the habit it forms is one trait drift knows about', () => {
  // Otherwise competing would be an event that changed nobody: the
  // habit would form, `EXERCISES` would have no entry for it, and the
  // whole point — that playing makes you faster — would be missing with
  // nothing to say so.
  const exercised = traitDrift.EXERCISES[competition.COMPETE_HABIT];
  assert.ok(exercised, `traitDrift has no EXERCISES entry for "${competition.COMPETE_HABIT}"`);
  for (const [family, name] of exercised) {
    assert.ok(traits.TRAIT_FAMILIES[family]?.includes(name),
      `compete exercises "${family} ${name}", which is not a trait`);
  }
  // It has to touch the family `contest.js` rates a bout from, or the
  // loop does not close.
  assert.ok(exercised.some(([family]) => family === 'sports'),
    'competing exercises nothing in the sports family, so the next bout is rated the same');
});

// -- the older defect: a weekly routine that could not form ---------------

test('habit decay is proportional, so a habit practised weekly exists at all', () => {
  // **Measured before and after, on one world.** A flat 0.5 a tick put
  // daily habits at 75.3 and `gathering` at 0.3 — seventeen people
  // holding a weekly schedule that fired every seventh tick for +2
  // while 3.5 of decay took it away in between.
  const w = {
    tick: 0,
    habits: [
      { entity_id: 1, habit_name: 'a', strength: 80, harmful: false },
      { entity_id: 2, habit_name: 'b', strength: 4, harmful: false },
    ],
    entityState: [], scheduleEvents: [], npcs: [], events: [],
    pendingObservations: [], entityTraits: [],
  };
  behavior.runBehavior(w);

  // A strong habit sheds more than a weak one, which is what makes an
  // equilibrium possible at all. Under the flat rule both lost 0.5.
  const strongLoss = 80 - w.habits[0].strength;
  const weakLoss = 4 - w.habits[1].strength;
  assert.ok(strongLoss > weakLoss,
    `the strong habit lost ${strongLoss} and the weak one ${weakLoss} — decay is still flat, `
    + 'so anything practised less often than daily falls to zero and stays there');

  // And a habit near nothing is not driven negative.
  assert.ok(w.habits[1].strength > 0);
});

// -- the world ------------------------------------------------------------

// One long-running world, built once. `generateWorld` APPENDS to the
// shared `engine.WorldState` — its own header says so — so a second
// generation in this process would leave the first world's people in
// place, and everything below would be reading a mixture.
const LONG_RUN = 200;
let world = null;
function builtWorld() {
  if (world) return world;
  const w = engine.WorldState;
  worldgen.generateWorld({
    cities: 2, communitiesPerCity: 2, populationPerCommunity: 10, seed: 'games',
  });
  for (let t = 0; t < LONG_RUN; t += 1) engine.advanceTick();
  world = w;
  return w;
}

test('a generated world actually holds games', () => {
  const w = builtWorld();
  assert.ok((w.contests || []).length > 0,
    'two hundred ticks across four settlements and nobody played anything');

  // Not so many that the log is a sports page. The same guard the
  // weather events carry, and for the same reason.
  const contestEvents = w.events.filter((e) => /contest/.test(e.type));
  assert.equal(contestEvents.length, w.contests.length,
    'a game was held that produced no event, or an event fired with no game behind it');
  assert.ok(contestEvents.length < w.events.length / 4,
    `${contestEvents.length} of ${w.events.length} events are games`);
});

test('a game is a crossing, not a condition', () => {
  // **Standing rule 7.** A game held whenever some condition holds
  // would put an identical row in the log every tick forever. The
  // ceiling here is the arithmetic: one game per community per
  // GAME_INTERVAL ticks, and no more.
  const w = builtWorld();
  const ceiling = Math.ceil(LONG_RUN / competition.GAME_INTERVAL) * w.communities.length;
  assert.ok(w.contests.length <= ceiling,
    `${w.contests.length} games against a ceiling of ${ceiling} — something is holding one `
    + 'every tick');

  // And two settlements do not hold theirs on the same morning every
  // time, or the offset is not being applied.
  const days = new Set(w.contests.map((c) => c.tick));
  assert.ok(days.size > competition.GAME_INTERVAL,
    'every game in the world falls on the same few ticks');
});

test('all four disciplines get played, and no combat ever does', () => {
  const w = builtWorld();
  const held = new Set(w.contests.map((c) => c.discipline));
  for (const discipline of competition.SETTLEMENT_DISCIPLINES) {
    assert.ok(held.has(discipline), `nobody ever played ${discipline} in 200 ticks`);
  }
  assert.equal(held.has('combat'), false, 'a settlement staged a fight');
});

test('a result reaches the four places a result has to reach', () => {
  const w = builtWorld();
  const game = w.contests[0];

  // 1. The habit of turning up.
  for (const id of game.entrantIds) {
    const habit = (w.habits || []).find(
      (h) => h.entity_id === id && h.habit_name === competition.COMPETE_HABIT,
    );
    assert.ok(habit, `entrant ${id} played and formed no habit of playing`);
  }

  // 2. Rivalry, on the dimension the schema has for it. `competition`
  //    was a column only keys.js's territory resolver ever wrote.
  const rivalries = w.relationships.filter((r) => Number(r.competition) > 0);
  assert.ok(rivalries.length > 0, 'nobody in the world competes with anybody');
  for (const rel of rivalries) {
    assert.ok(Number(rel.competition) <= 100,
      `competition reached ${rel.competition} — adjustRelationship does not clamp, so this `
      + 'has to be bounded here or it leaves the 0..100 range everything else assumes');
  }

  // 3. A memory each. A thing that happened to somebody and left
  //    nothing they could recall did not happen to them.
  for (const id of game.entrantIds) {
    assert.ok(w.memories.some(
      (m) => m.entity_id === id && /community game/.test(m.description)),
    `entrant ${id} remembers nothing about playing`);
  }

  // 4. The record, and it can be re-run by somebody who does not trust
  //    it — which is the property `contest.js` was built for and that
  //    nothing had ever used.
  const described = competition.describeContest(w, game.contestId);
  assert.ok(described);
  assert.equal(described.verification.reproduced, true,
    'a settled game cannot be reproduced from its own result');
});

test('the same seed holds the same games', () => {
  // §88. The whole point of a seeded resolver is that a world can be
  // rebuilt, and a calendar drawn per community has to be part of that.
  const w = builtWorld();
  const seed = w.seed ?? 'games';
  for (const communityId of [1, 2]) {
    for (const tick of [14, 28, 97]) {
      assert.equal(
        competition.isGameDay(w, communityId, tick, seed),
        competition.isGameDay(w, communityId, tick, seed),
      );
      assert.equal(
        competition.drawDiscipline(seed, communityId, tick),
        competition.drawDiscipline(seed, communityId, tick),
      );
    }
  }
});

test('who plays is weighted, not gated, and it is not always the same faces', () => {
  // A threshold on the `competition` value would be a guess about a
  // number — the twelfth standing rule's third clause — and measured on
  // a real population that value runs 25..95 with a median of 59, so
  // any cutoff either excludes most people or includes most people.
  const w = builtWorld();
  const played = new Set();
  for (const game of w.contests) for (const id of game.entrantIds) played.add(id);
  assert.ok(played.size > competition.MAX_ENTRANTS,
    `only ${played.size} people ever played — the draw is picking the same field every time`);

  for (const game of w.contests) {
    assert.ok(game.entrantIds.length >= competition.MIN_ENTRANTS);
    assert.ok(game.entrantIds.length <= competition.MAX_ENTRANTS);
    assert.equal(new Set(game.entrantIds).size, game.entrantIds.length,
      'somebody entered a game against themselves');
  }
});

test('a settlement can say how much it plays', () => {
  const w = builtWorld();
  const profile = statistics.profileFor(w, w.communities[0].id);
  for (const key of ['contests_per_1k', 'competitor_share', 'mean_athleticism']) {
    assert.equal(profile.statistics[key].known, true, `${key} came back null`);
  }
  const share = profile.statistics.competitor_share.value;
  assert.ok(share > 0 && share <= 1);

  // Unknown is not zero: a community with nobody in it holds no games
  // because there is nobody there, which is not a settlement that could
  // and does not.
  assert.equal(competition.contestRatePer1k(w, 999999), null);
  assert.equal(competition.competitorShare(w, 999999), null);
  assert.equal(competition.describeContest(w, 'no-such-game'), null);
});

// -- what is deliberately NOT here ----------------------------------------

test('this is one game at a time, not a league and not a wager', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'server', 'competition.js'), 'utf8',
  )
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
    .replace(/^\s*\/\/:.*$/gm, '');

  // **League structure is deliberately absent.** CLAUDE.md: "no season,
  // table, fixture list, standings or tournament exists anywhere". A
  // season is game design rather than a gap, and this is the smallest
  // thing that makes the resolver real.
  for (const term of ['season', 'standings', 'fixture', 'tournament', 'league']) {
    assert.equal(new RegExp(term, 'i').test(source), false,
      `competition.js mentions ${term} in code — league structure is deferred, not missed`);
  }

  // **And nothing here stakes, pays or prices anything.** Gambling and
  // casino systems stay shut pending compliance review, which is a
  // legal gate rather than a scope decision. A contest with a result
  // somebody could bet on is not a bet.
  for (const term of ['wager', 'bet', 'stake', 'odds', 'payout', 'pot']) {
    assert.equal(new RegExp(`\\b${term}`, 'i').test(source), false,
      `competition.js mentions ${term} — gambling is closed pending compliance review`);
  }
});
