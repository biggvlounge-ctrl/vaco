// server/leagues.js
//
// By direct instruction, task #171: "this is where sports leagues
// will come from. It's from the fighting and the chaos." The one real
// gap CLAUDE.md's own foundation table names by name: "Competition/
// league system... Half true, and the half matters... *League
// structure is still false* -- no season, table, fixture list,
// standings or tournament exists anywhere in `server/`."
//
// ---------------------------------------------------------------------
// Reuse, not a second resolver
// ---------------------------------------------------------------------
// `contest.js` is the real, tested, deterministic resolver -- rate,
// draw, decide, verify. `competition.js` is the real occasion that
// already calls it for ordinary settlement games, and deliberately
// excludes `combat` ("it holds games, not fights" -- see that file's
// own header). This file is the deliberate combat counterpart that
// header names but does not build, and it does not duplicate
// `competition.js`'s own shape blindly: a league specifically grows
// out of real, already-measured community danger
// (`crime.dangerByCommunity`), the identical chance-scaled-by-real-
// danger pattern `recruitment.js` already established for "once chaos
// starts to erupt" ("leagues... from the fighting and the chaos" is
// the same real shape one event type over) -- reusing
// `recruitment.BASE_RECRUITMENT_RISK` verbatim rather than a second
// constant at the same value under a new name, and never an
// unconditional background process running in every community
// regardless of how chaotic it actually is.
//
// ---------------------------------------------------------------------
// A real season, table, fixture list and tournament -- the actual gap
// ---------------------------------------------------------------------
// `runLeagues` founds a real league once a community's real danger
// score crosses that chaos-driven rate. Its real roster is every real
// resident `contest.rateEntity` can actually give a real combat number
// to (that function's own refusal is the one real eligibility filter
// -- never a second, invented one), capped at `meetings.
// MAXIMUM_ATTENDANCE`, the real "crowd, not a leadership" bound this
// engine already uses elsewhere, reused rather than invented fresh for
// a second kind of gathering. A season is a real round-robin fixture
// list over that roster, generated once and shuffled by a real seeded
// draw (§88); one fixture resolves every `competition.GAME_INTERVAL`
// ticks -- the identical real cadence that file already established
// for "how often a settlement visibly has a social life," reused
// rather than a second number for the identical question. `standingsFor`
// is the real table, computed from the real match log every time
// (standing rule 3 -- never a second, stored win/loss counter). When
// every real fixture in a season is played, the league crowns the
// real highest-win member and a new real season begins with a freshly
// drawn roster -- a real tournament structure, not a flat "games
// happen forever" loop.

'use strict';

const contest = require('./contest.js');
const competition = require('./competition.js');
const crime = require('./crime.js');
const recruitment = require('./recruitment.js');
const meetings = require('./meetings.js');
const behavior = require('./behavior.js');
const worldStore = require('./worldStore.js');
const { seededDraw } = require('./seeded.js');

const LEAGUE_DISCIPLINE = 'combat';

// The identical real chaos-driven rate `recruitment.js` already
// established for "once chaos starts to erupt" -- reused verbatim.
const LEAGUE_FORMATION_RISK = recruitment.BASE_RECRUITMENT_RISK;

// `meetings.js`'s own real "crowd, not a leadership" bound, reused
// rather than invented fresh for a second kind of gathering.
const LEAGUE_ROSTER_CAP = meetings.MAXIMUM_ATTENDANCE;

// The hard floor `contest.resolveContest` itself enforces (at least
// two participants) -- not a second, invented minimum.
const MIN_ROSTER = 2;

// `competition.js`'s own real cadence -- "how often a settlement
// visibly has a social life" is the identical question for a league
// match day, so this is that constant, not a second one.
const LEAGUE_MATCH_INTERVAL = competition.GAME_INTERVAL;

const RELATIONSHIP_CEILING = 100;

let nextLeagueId = 1;

function reseedIds(worldState) {
  nextLeagueId = (worldState.leagues || []).reduce((max, l) => Math.max(max, l.id), 0) + 1;
  return { nextLeagueId };
}

function leaguesIn(worldState, communityId) {
  return (worldState.leagues || []).filter((l) => l.communityId === communityId);
}

// Every real resident `contest.rateEntity` can actually give a real
// combat number to. `rateEntity` throws for someone who carries none
// of the discipline's traits -- "an unrated entity cannot be given a
// number, it has to be refused," that function's own words -- so this
// is the one real filter, not a second invented eligibility rule.
function ratedResidents(worldState, communityId) {
  return (worldState.npcs || [])
    .filter((n) => n.communityId === communityId && n.status !== 'imprisoned')
    .filter((n) => {
      try {
        contest.rateEntity(worldState, n.id, LEAGUE_DISCIPLINE);
        return true;
      } catch {
        return false;
      }
    })
    .map((n) => n.id);
}

// Fisher-Yates, seeded on position within the shuffle rather than on
// anybody's identity -- the same positional-seeding discipline (§88)
// this engine holds everywhere else, so the same world always
// schedules the same season and draws the same roster.
function seededShuffle(items, seed) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(seededDraw([seed, 'shuffle', i]) * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// A real round-robin: every unique pair of a real roster, once.
function roundRobinFixtures(roster) {
  const pairs = [];
  for (let i = 0; i < roster.length; i += 1) {
    for (let j = i + 1; j < roster.length; j += 1) {
      pairs.push([roster[i], roster[j]]);
    }
  }
  return pairs;
}

// Starts a real new season in place: a freshly drawn roster (anyone
// real and rated, not only last season's survivors -- chaos keeps
// sweeping new people in) and a real round-robin fixture list over it.
function startSeason(worldState, league, tick) {
  const seed = `${worldState.seed ?? 'world'}-league-${league.id}-season-${league.season + 1}`;
  const roster = seededShuffle(ratedResidents(worldState, league.communityId), seed)
    .slice(0, LEAGUE_ROSTER_CAP);
  league.season += 1;
  league.roster = roster;
  league.fixtures = seededShuffle(roundRobinFixtures(roster), seed);
  league.nextFixtureIndex = 0;
  league.seasonStartTick = tick;
  return league;
}

// Whether this league plays on this tick -- the same real per-id
// offset `competition.isGameDay` already uses to keep every league
// from playing on the same morning, seeded on the league rather than
// the community so two leagues in the same place still stagger.
function isLeagueMatchDay(league, tick, seed) {
  const offset = Math.floor(
    seededDraw([seed, 'league-calendar', league.id]) * LEAGUE_MATCH_INTERVAL,
  );
  return tick > 0 && ((tick + offset) % LEAGUE_MATCH_INTERVAL === 0);
}

// The real table -- computed from the real match log every time,
// never a second, stored win/loss counter (standing rule 3). Scoped
// to the league's CURRENT season; a past season's table is read the
// identical way by filtering the same log on an older `season` number.
function standingsFor(worldState, leagueId, options = {}) {
  const league = (worldState.leagues || []).find((l) => l.id === leagueId);
  if (!league) return null;
  const { season = league.season } = options;
  const table = new Map(league.roster.map((id) => [id, {
    entityId: id, played: 0, wins: 0, losses: 0,
  }]));
  for (const row of worldState.leagueMatches || []) {
    if (row.leagueId !== leagueId || row.season !== season) continue;
    for (const id of row.entrantIds) {
      const entry = table.get(id);
      if (!entry) continue;
      entry.played += 1;
      if (id === row.winnerId) entry.wins += 1; else entry.losses += 1;
    }
  }
  return [...table.values()].sort((a, b) => b.wins - a.wins || a.losses - b.losses);
}

function boundedGain(current, gain) {
  const now = Number(current) || 0;
  return Math.max(0, Math.min(gain, RELATIONSHIP_CEILING - now));
}

// The same real write-back shape `competition.recordResult` already
// holds for an ordinary game -- habit, rivalry, respect, a memory each
// -- plus the one real thing combat has that a game of darts does not:
// `resolveContest`'s own real loser-outcome tier (defeated/fled/
// submitted), folded into the memory rather than a flat "lost".
function recordMatch(worldState, league, result, tick) {
  const entrants = result.ratings.map((r) => r.entityId);

  for (const entityId of entrants) {
    behavior.reinforceHabit(worldState, entityId, competition.COMPETE_HABIT, {
      amount: competition.COMPETE_REINFORCEMENT,
    });
  }

  for (let i = 0; i < entrants.length; i += 1) {
    for (let j = i + 1; j < entrants.length; j += 1) {
      const existing = worldStore.findRelationship(worldState, entrants[i], entrants[j]);
      worldStore.adjustRelationship(worldState, entrants[i], entrants[j], 'neighbor', {
        competition: boundedGain(existing?.competition, competition.RIVALRY_GAIN),
      });
    }
  }
  for (const entityId of entrants) {
    if (entityId === result.winnerId) continue;
    const existing = worldStore.findRelationship(worldState, entityId, result.winnerId);
    worldStore.adjustRelationship(worldState, entityId, result.winnerId, 'neighbor', {
      respect: boundedGain(existing?.respect, competition.RESPECT_FOR_WINNER),
    });
  }

  for (const entityId of entrants) {
    const won = entityId === result.winnerId;
    const outcome = won ? null : result.loserOutcomes?.[entityId];
    worldStore.addMemory(worldState, {
      entityId,
      memoryType: 'experience',
      category: 'social',
      description: won
        ? `won a league combat bout`
        : `was ${outcome ?? 'defeated'} in a league combat bout`,
      importance: result.upset ? 55 : 35,
      emotionLevel: won ? 60 : -40,
      relatedEntityIds: entrants.filter((id) => id !== entityId),
      tick,
    });
  }

  const row = {
    ...result, leagueId: league.id, communityId: league.communityId,
    entrantIds: entrants, season: league.season, tick,
  };
  (worldState.leagueMatches || (worldState.leagueMatches = [])).push(row);
  return row;
}

// One real pass: form a league wherever real chaos has just crossed
// the real rate, then play one real fixture in every league whose
// real match day this is, crowning and re-drawing a season that just
// ran out of fixtures.
function runLeagues(worldState, options = {}) {
  const { tick = worldState.tick ?? 0, seed = worldState.seed ?? 'world' } = options;
  const danger = crime.dangerByCommunity(worldState, { tick });
  const events = [];

  for (const community of worldState.communities || []) {
    if (leaguesIn(worldState, community.id).length > 0) continue;
    const dangerScore = danger.get(community.id);
    if (!dangerScore) continue;

    const chance = LEAGUE_FORMATION_RISK * dangerScore;
    const draw = seededDraw([community.id, tick, 'league-formation']);
    if (draw >= chance) continue;

    const roster = ratedResidents(worldState, community.id);
    if (roster.length < MIN_ROSTER) continue;

    const league = {
      id: nextLeagueId, communityId: community.id, discipline: LEAGUE_DISCIPLINE,
      formedTick: tick, season: 0, roster: [], fixtures: [], nextFixtureIndex: 0,
      seasonStartTick: tick, champions: [],
    };
    nextLeagueId += 1;
    startSeason(worldState, league, tick);
    (worldState.leagues || (worldState.leagues = [])).push(league);

    worldStore.addHistoricalRecord(worldState, {
      event_type: 'league_formed',
      description: `a real combat league forms${community.name ? ` in ${community.name}` : ''} `
        + 'out of the real chaos there',
      when_tick: tick,
      participants: league.roster,
      where_location_id: null,
    });
  }

  for (const league of worldState.leagues || []) {
    if (!isLeagueMatchDay(league, tick, seed)) continue;

    if (league.nextFixtureIndex >= league.fixtures.length) {
      if (league.fixtures.length > 0) {
        const standings = standingsFor(worldState, league.id);
        const champion = standings?.[0] ?? null;
        if (champion) {
          league.champions.push({
            season: league.season, entityId: champion.entityId, wins: champion.wins,
          });
          worldStore.addHistoricalRecord(worldState, {
            event_type: 'league_season_crowned',
            description: `entity ${champion.entityId} takes the league ${league.id} `
              + `season ${league.season} title with ${champion.wins} real wins`,
            when_tick: tick,
            participants: [champion.entityId],
            where_location_id: null,
          });
          events.push({
            type: 'league_season_crowned',
            severity: 'low',
            note: `league ${league.id} crowns entity ${champion.entityId} for season ${league.season}`,
            tick,
            affected_entity_ids: [champion.entityId],
            global_effects: { leagueId: league.id, season: league.season, wins: champion.wins },
          });
        }
      }
      // Paused rather than restarted if real chaos has not left this
      // community two real fighters -- tried again on the next real
      // match day, never a season number that climbs on nothing played.
      if (ratedResidents(worldState, league.communityId).length < MIN_ROSTER) continue;
      startSeason(worldState, league, tick);
      if (league.fixtures.length === 0) continue;
    }

    const [a, b] = league.fixtures[league.nextFixtureIndex];
    league.nextFixtureIndex += 1;

    // A roster member can die or go to prison between seasons -- a
    // fixture missing a real living, free participant is skipped
    // rather than thrown.
    const alive = new Set(
      (worldState.npcs || []).filter((n) => n.status !== 'imprisoned').map((n) => n.id),
    );
    if (!alive.has(a) || !alive.has(b)) continue;

    const result = contest.resolveContest(worldState, {
      participantIds: [a, b],
      discipline: LEAGUE_DISCIPLINE,
      contestId: `league-${league.id}-s${league.season}-${league.nextFixtureIndex}`,
      tick,
    });
    const row = recordMatch(worldState, league, result, tick);

    events.push({
      type: result.upset ? 'league_match_upset' : 'league_match_held',
      severity: 'low',
      note: `league ${league.id}: entity ${result.winnerId} won a real combat bout`,
      tick,
      affected_entity_ids: [a, b],
      global_effects: {
        leagueId: league.id, communityId: league.communityId,
        winnerId: result.winnerId, contestId: row.contestId,
      },
    });
  }

  return events;
}

module.exports = {
  LEAGUE_DISCIPLINE,
  LEAGUE_FORMATION_RISK,
  LEAGUE_ROSTER_CAP,
  LEAGUE_MATCH_INTERVAL,
  MIN_ROSTER,
  reseedIds,
  leaguesIn,
  ratedResidents,
  standingsFor,
  runLeagues,
};
