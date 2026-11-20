// server/leagues.js — real combat leagues emerging from real chaos
// (task #171). "This is where sports leagues will come from. It's
// from the fighting and the chaos." See that file's own header for
// why this reuses recruitment.js's chaos-driven rate, meetings.js's
// crowd cap, and competition.js's own cadence rather than inventing
// three new constants for questions this engine has already answered.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const leagues = require('../server/leagues.js');
const contest = require('../server/contest.js');
const competition = require('../server/competition.js');
const { getTraitId } = require('../server/traitDefinitions.js');

// Same recipe `test/recruitment.test.js` already verified against
// `crime.dangerByCommunity` — constructed, not generated (standing
// rule 8), so a league's formation is about a specific real condition
// rather than whatever a seed happens to produce.
function dangerousWorld() {
  const w = {
    tick: 400,
    seed: 'leagues-test',
    npcs: [],
    communities: [{ id: 1, name: 'Hollow Row' }],
    crimeIncidents: [],
    entityTraits: [],
    relationships: [],
    memories: [],
    habits: [],
    historicalRecords: [],
    events: [],
    leagues: [],
    leagueMatches: [],
  };
  for (let i = 0; i < 3; i += 1) {
    w.crimeIncidents.push({ id: i + 1, community_id: 1, category: 'theft', tick: w.tick - 20 });
  }
  return w;
}

let nextId = 1;

// A real resident who `contest.rateEntity` can actually rate — one
// real combat trait row, not a full generated sheet, so the rating is
// the exact number the test controls rather than whatever a random
// draw produced.
function fighter(w, options = {}) {
  const { id = nextId++, communityId = 1, rating = 50, imprisoned = false } = options;
  w.npcs.push({ id, communityId, status: imprisoned ? 'imprisoned' : 'active' });
  w.entityTraits.push({
    id: w.entityTraits.length + 1,
    entity_id: id,
    trait_id: getTraitId('combat', 'Melee Skill'),
    current_value: rating,
  });
  return id;
}

test('ratedResidents includes a real fighter and excludes an imprisoned or untraited resident', () => {
  const w = dangerousWorld();
  const a = fighter(w, { rating: 60 });
  fighter(w, { imprisoned: true });
  w.npcs.push({ id: nextId++, communityId: 1, status: 'active' }); // no real traits at all

  const eligible = leagues.ratedResidents(w, 1);
  assert.deepEqual(eligible, [a]);
});

test('runLeagues never forms a league with no real measured danger', () => {
  const w = dangerousWorld();
  w.crimeIncidents = []; // genuinely unmeasured
  fighter(w, { rating: 60 });
  fighter(w, { rating: 40 });

  for (let t = w.tick; t < w.tick + 600; t += 1) leagues.runLeagues(w, { tick: t });
  assert.equal(leagues.leaguesIn(w, 1).length, 0,
    'a league formed in a community with no real measured danger');
});

test('runLeagues never forms a league with fewer than two real fighters', () => {
  const w = dangerousWorld();
  fighter(w, { rating: 60 }); // only one real fighter in the whole community

  for (let t = w.tick; t < w.tick + 2000; t += 1) leagues.runLeagues(w, { tick: t });
  assert.equal(leagues.leaguesIn(w, 1).length, 0,
    'a league formed with fewer than the two real fighters a contest itself requires');
});

test('with real danger and two real fighters, a real league eventually forms, with a real round-robin season', () => {
  const w = dangerousWorld();
  const a = fighter(w, { rating: 70 });
  const b = fighter(w, { rating: 30 });

  let formedAt = null;
  for (let t = w.tick; t < w.tick + 2000 && formedAt === null; t += 1) {
    leagues.runLeagues(w, { tick: t });
    if (leagues.leaguesIn(w, 1).length > 0) formedAt = t;
  }
  assert.ok(formedAt, 'no league formed in 2000 real seeded draws at a real, non-zero danger score');

  const league = leagues.leaguesIn(w, 1)[0];
  assert.equal(league.season, 1);
  assert.deepEqual([...league.roster].sort((x, y) => x - y), [a, b].sort((x, y) => x - y));
  // Two real fighters round-robin to exactly one real fixture.
  assert.equal(league.fixtures.length, 1);
  assert.ok(
    w.historicalRecords.some((r) => r.event_type === 'league_formed'),
    'no real historical record was written for the league forming',
  );
});

test('a formed league actually plays its real fixtures and records them in the real log', () => {
  const w = dangerousWorld();
  const a = fighter(w, { rating: 90 });
  const b = fighter(w, { rating: 10 });

  let formedAt = null;
  for (let t = w.tick; t < w.tick + 2000 && formedAt === null; t += 1) {
    leagues.runLeagues(w, { tick: t });
    if (leagues.leaguesIn(w, 1).length > 0) formedAt = t;
  }
  assert.ok(formedAt);

  // Run far enough past formation for the one real match day this
  // fixture needs — `LEAGUE_MATCH_INTERVAL` ticks is enough for any
  // real offset. `runLeagues` RETURNS its events (`tick.js` is what
  // collects them into the real log); a test has to do the same
  // rather than reading `w.events`, which this pass never writes to.
  let allEvents = [];
  for (let t = formedAt; t < formedAt + leagues.LEAGUE_MATCH_INTERVAL + 1; t += 1) {
    allEvents = allEvents.concat(leagues.runLeagues(w, { tick: t }));
  }

  const league = leagues.leaguesIn(w, 1)[0];
  assert.equal(league.nextFixtureIndex, 1, 'the one real fixture in this season was never played');
  assert.equal(w.leagueMatches.length, 1);
  const match = w.leagueMatches[0];
  assert.deepEqual([...match.entrantIds].sort((x, y) => x - y), [a, b].sort((x, y) => x - y));
  assert.ok([a, b].includes(match.winnerId));
  assert.ok(
    allEvents.some((e) => e.type === 'league_match_held' || e.type === 'league_match_upset'),
    'the real match produced no real event',
  );

  const standings = leagues.standingsFor(w, league.id);
  const winnerRow = standings.find((row) => row.entityId === match.winnerId);
  const loserRow = standings.find((row) => row.entityId !== match.winnerId);
  assert.equal(winnerRow.wins, 1);
  assert.equal(loserRow.losses, 1);
  assert.ok(winnerRow.wins > loserRow.wins, 'the real table does not actually rank the real winner above the real loser');
});

test('a season crowns a real champion from the real match log, never a second stored counter', () => {
  const w = dangerousWorld();
  fighter(w, { rating: 95 }); // entity 1 — wins every real bout it is rated to win
  fighter(w, { rating: 5 });

  let formedAt = null;
  for (let t = w.tick; t < w.tick + 2000 && formedAt === null; t += 1) {
    leagues.runLeagues(w, { tick: t });
    if (leagues.leaguesIn(w, 1).length > 0) formedAt = t;
  }
  assert.ok(formedAt);

  // Run well past the single real fixture this two-person season
  // holds, so the season ends and a champion is crowned.
  for (let t = formedAt; t < formedAt + leagues.LEAGUE_MATCH_INTERVAL * 3; t += 1) {
    leagues.runLeagues(w, { tick: t });
  }

  const league = leagues.leaguesIn(w, 1)[0];
  assert.ok(league.champions.length > 0, 'no real season was ever crowned');
  assert.equal(league.champions[0].season, 1);
  assert.ok(
    w.historicalRecords.some((r) => r.event_type === 'league_season_crowned'),
    'no real historical record was written for the crowning',
  );

  // The crowned champion is exactly who the real match log says won —
  // never a second, disagreeing counter (standing rule 3).
  const standings = leagues.standingsFor(w, league.id, { season: 1 });
  assert.equal(league.champions[0].entityId, standings[0].entityId);
});

test('LEAGUE_FORMATION_RISK, LEAGUE_ROSTER_CAP and LEAGUE_MATCH_INTERVAL are real, reused constants, not invented ones', () => {
  const recruitment = require('../server/recruitment.js');
  const meetings = require('../server/meetings.js');
  assert.equal(leagues.LEAGUE_FORMATION_RISK, recruitment.BASE_RECRUITMENT_RISK);
  assert.equal(leagues.LEAGUE_ROSTER_CAP, meetings.MAXIMUM_ATTENDANCE);
  assert.equal(leagues.LEAGUE_MATCH_INTERVAL, competition.GAME_INTERVAL);
});

test('combat is the real discipline leagues use, and it is a real contest discipline', () => {
  assert.equal(leagues.LEAGUE_DISCIPLINE, 'combat');
  assert.ok(contest.DISCIPLINE_NAMES.includes(leagues.LEAGUE_DISCIPLINE));
});
