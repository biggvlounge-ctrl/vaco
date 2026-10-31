'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createLeaderboardsStore, recordFor, recordMatchResult, winRate,
  disciplineLeaders, leagueLeaders, opponentCount, knockouts, finishes,
  ratingLeaders, risingLeaders,
} from '../src/lib/leaderboards.js';
import { createMatch, startMatch, recordResult } from '../src/lib/combatSports.js';

function finishedMatch({ sport, participantIds, winnerIds, matchId }) {
  const match = createMatch({
    matchId, matchFormat: 'one-on-one', combatSportType: sport, skillLevel: 'amateur', participantIds,
  });
  startMatch(match);
  recordResult(match, winnerIds);
  return match;
}

test('recordFor returns null for a fighter with no recorded result yet', () => {
  const store = createLeaderboardsStore();
  assert.equal(recordFor(store, 'alice'), null);
});

test('recordMatchResult refuses anything but a real finished match', () => {
  const store = createLeaderboardsStore();
  assert.throws(() => recordMatchResult(store, null), /finished match/);
  const scheduled = createMatch({
    matchId: 'm1', matchFormat: 'one-on-one', combatSportType: 'boxing', skillLevel: 'amateur',
    participantIds: ['alice', 'bob'],
  });
  assert.throws(() => recordMatchResult(store, scheduled), /finished match/);
});

test('recordMatchResult credits the winner and debits the loser, overall and per discipline', () => {
  const store = createLeaderboardsStore();
  const match = finishedMatch({ matchId: 'm1', sport: 'boxing', participantIds: ['alice', 'bob'], winnerIds: ['alice'] });
  recordMatchResult(store, match);

  const alice = recordFor(store, 'alice');
  assert.equal(alice.wins, 1);
  assert.equal(alice.losses, 0);
  assert.deepEqual(alice.byDiscipline.boxing, { wins: 1, losses: 0 });

  const bob = recordFor(store, 'bob');
  assert.equal(bob.wins, 0);
  assert.equal(bob.losses, 1);
  assert.deepEqual(bob.byDiscipline.boxing, { wins: 0, losses: 1 });
});

test('winRate is null for an undecided (0-0) record, and a real fraction otherwise', () => {
  assert.equal(winRate({ wins: 0, losses: 0 }), null);
  assert.equal(winRate({ wins: 3, losses: 1 }), 0.75);
});

test('disciplineLeaders ranks real wins first, win rate second, and never crosses disciplines', () => {
  const store = createLeaderboardsStore();
  // alice: 2-0 in boxing. bob: 2-1 in boxing. carol: 5-0 but all in mma.
  recordMatchResult(store, finishedMatch({ matchId: 'm1', sport: 'boxing', participantIds: ['alice', 'bob'], winnerIds: ['alice'] }));
  recordMatchResult(store, finishedMatch({ matchId: 'm2', sport: 'boxing', participantIds: ['alice', 'bob'], winnerIds: ['alice'] }));
  recordMatchResult(store, finishedMatch({ matchId: 'm3', sport: 'boxing', participantIds: ['bob', 'alice'], winnerIds: ['bob'] }));
  recordMatchResult(store, finishedMatch({ matchId: 'm4', sport: 'boxing', participantIds: ['bob', 'alice'], winnerIds: ['bob'] }));
  for (let i = 0; i < 5; i += 1) {
    recordMatchResult(store, finishedMatch({ matchId: `mma${i}`, sport: 'mma', participantIds: ['carol', 'dave'], winnerIds: ['carol'] }));
  }

  const boxingLeaders = disciplineLeaders(store, 'boxing');
  assert.deepEqual(boxingLeaders.map((l) => l.fighterId).sort(), ['alice', 'bob'], 'alice (2-2) ties bob (2-2) -- same wins, same win rate');
  assert.equal(boxingLeaders.find((l) => l.fighterId === 'carol'), undefined, 'a pure-MMA fighter never appears on the boxing board');

  const mmaLeaders = disciplineLeaders(store, 'mma');
  assert.equal(mmaLeaders[0].fighterId, 'carol');
  assert.equal(mmaLeaders[0].wins, 5);
});

test('leagueLeaders ranks across every discipline combined, unlike disciplineLeaders', () => {
  const store = createLeaderboardsStore();
  recordMatchResult(store, finishedMatch({ matchId: 'm1', sport: 'boxing', participantIds: ['alice', 'bob'], winnerIds: ['alice'] }));
  recordMatchResult(store, finishedMatch({ matchId: 'm2', sport: 'mma', participantIds: ['alice', 'bob'], winnerIds: ['alice'] }));
  recordMatchResult(store, finishedMatch({ matchId: 'm3', sport: 'wrestling', participantIds: ['alice', 'bob'], winnerIds: ['alice'] }));

  const leaders = leagueLeaders(store);
  assert.equal(leaders[0].fighterId, 'alice');
  assert.equal(leaders[0].wins, 3);
  assert.equal(leaders[0].losses, 0);
  const bob = leaders.find((l) => l.fighterId === 'bob');
  assert.equal(bob.wins, 0);
  assert.equal(bob.losses, 3);
});

test('disciplineLeaders/leagueLeaders respect a real limit', () => {
  const store = createLeaderboardsStore();
  for (let i = 0; i < 15; i += 1) {
    recordMatchResult(store, finishedMatch({
      matchId: `m${i}`, sport: 'boxing', participantIds: [`fighter-${i}`, 'punching-bag'], winnerIds: [`fighter-${i}`],
    }));
  }
  assert.equal(disciplineLeaders(store, 'boxing', { limit: 5 }).length, 5);
  assert.equal(leagueLeaders(store, { limit: 3 }).length, 3);
});

test('recordMatchResult with a method credits winsByMethod, and knockouts/finishes read it', () => {
  const store = createLeaderboardsStore();
  const match = finishedMatch({ matchId: 'm1', sport: 'boxing', participantIds: ['alice', 'bob'], winnerIds: ['alice'] });
  recordMatchResult(store, match, { method: 'stoppage' });
  const alice = recordFor(store, 'alice');
  assert.deepEqual(alice.winsByMethod, { stoppage: 1 });
  assert.equal(knockouts(alice), 1);
  assert.equal(finishes(alice), 1);

  const bob = recordFor(store, 'bob');
  assert.deepEqual(bob.winsByMethod, {}, 'a loser is credited no method');
  assert.equal(knockouts(bob), 0);
});

test('a plain decision (no method given) never counts as a finish', () => {
  const store = createLeaderboardsStore();
  recordMatchResult(store, finishedMatch({ matchId: 'm1', sport: 'boxing', participantIds: ['alice', 'bob'], winnerIds: ['alice'] }));
  const alice = recordFor(store, 'alice');
  assert.deepEqual(alice.winsByMethod, { decision: 1 });
  assert.equal(finishes(alice), 0);
});

test('opponentCount tracks real distinct opponents faced, win or lose', () => {
  const store = createLeaderboardsStore();
  recordMatchResult(store, finishedMatch({ matchId: 'm1', sport: 'boxing', participantIds: ['alice', 'bob'], winnerIds: ['alice'] }));
  recordMatchResult(store, finishedMatch({ matchId: 'm2', sport: 'boxing', participantIds: ['alice', 'bob'], winnerIds: ['bob'] }));
  recordMatchResult(store, finishedMatch({ matchId: 'm3', sport: 'boxing', participantIds: ['alice', 'carol'], winnerIds: ['alice'] }));
  assert.equal(opponentCount(recordFor(store, 'alice')), 2, 'alice has faced bob and carol');
});

test('a 1v1 win moves Elo rating by exactly the textbook pairwise amount', () => {
  const store = createLeaderboardsStore();
  recordMatchResult(store, finishedMatch({ matchId: 'm1', sport: 'boxing', participantIds: ['alice', 'bob'], winnerIds: ['alice'] }));
  const alice = recordFor(store, 'alice');
  const bob = recordFor(store, 'bob');
  // Equal starting ratings (1000 each): expected score is exactly 0.5
  // for both, so K=32 moves the winner up and the loser down by
  // exactly 16, the real textbook result for two equally-rated
  // players.
  assert.equal(alice.rating, 1016);
  assert.equal(bob.rating, 984);
});

test('a big underdog upset moves rating more than a win over an equal opponent', () => {
  const store = createLeaderboardsStore();
  // Give carol a real rating edge over dave first.
  for (let i = 0; i < 6; i += 1) {
    recordMatchResult(store, finishedMatch({ matchId: `seed${i}`, sport: 'boxing', participantIds: ['carol', 'dave'], winnerIds: ['carol'] }));
  }
  const carolBefore = recordFor(store, 'carol').rating;
  // dave upsets the now-higher-rated carol.
  recordMatchResult(store, finishedMatch({ matchId: 'upset', sport: 'boxing', participantIds: ['carol', 'dave'], winnerIds: ['dave'] }));
  const carolAfter = recordFor(store, 'carol').rating;
  assert.ok(carolBefore - carolAfter > 16, 'losing to a real underdog costs more than losing to an equal');
});

test('ratingLeaders ranks by real rating, never an unranked (0-fight) record', () => {
  const store = createLeaderboardsStore();
  recordMatchResult(store, finishedMatch({ matchId: 'm1', sport: 'boxing', participantIds: ['alice', 'bob'], winnerIds: ['alice'] }));
  const leaders = ratingLeaders(store);
  assert.equal(leaders[0].fighterId, 'alice');
  assert.ok(leaders[0].rating > leaders[1].rating);
  assert.equal(leaders.find((l) => l.fighterId === 'ghost'), undefined);
});

test('risingLeaders surfaces a real recent winning streak ahead of a long-faded one', () => {
  const store = createLeaderboardsStore();
  // alice: 3 old wins, then 3 recent losses -- faded.
  for (let i = 0; i < 3; i += 1) {
    recordMatchResult(store, finishedMatch({ matchId: `a-win${i}`, sport: 'boxing', participantIds: ['alice', 'punchbag'], winnerIds: ['alice'] }));
  }
  for (let i = 0; i < 3; i += 1) {
    recordMatchResult(store, finishedMatch({ matchId: `a-loss${i}`, sport: 'boxing', participantIds: ['alice', 'punchbag'], winnerIds: ['punchbag'] }));
  }
  // bob: 3 recent real wins -- on the come up.
  for (let i = 0; i < 3; i += 1) {
    recordMatchResult(store, finishedMatch({ matchId: `b-win${i}`, sport: 'boxing', participantIds: ['bob', 'punchbag2'], winnerIds: ['bob'] }));
  }
  const rising = risingLeaders(store, { minFights: 3 });
  assert.equal(rising[0].fighterId, 'bob');
  const alice = rising.find((r) => r.fighterId === 'alice');
  assert.ok(alice.gain < rising[0].gain, 'a fighter who just lost three straight is not on the come up');
});

test('risingLeaders excludes a fighter below the minimum real fight count', () => {
  const store = createLeaderboardsStore();
  recordMatchResult(store, finishedMatch({ matchId: 'm1', sport: 'boxing', participantIds: ['rookie', 'punchbag'], winnerIds: ['rookie'] }));
  const rising = risingLeaders(store, { minFights: 3 });
  assert.equal(rising.find((r) => r.fighterId === 'rookie'), undefined);
});
