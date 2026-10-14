'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createLeaderboardsStore, recordFor, recordMatchResult, winRate,
  disciplineLeaders, leagueLeaders,
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
