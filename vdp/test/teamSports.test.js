'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createTeam, createGame, assertBookable, startGame, recordScore, recordPlayerStat,
  advancePeriod, endGame, predictionMarketEligibility, describeGame, TeamSportsError,
} from '../src/lib/teamSports.js';

function basketballGame() {
  const home = createTeam({ teamId: 'hawks', name: 'The Hawks', rosterIds: ['alice', 'bob'] });
  const away = createTeam({ teamId: 'owls', name: 'The Owls', rosterIds: ['carol', 'dave'] });
  return createGame({
    gameId: 'g1', teamSportType: 'basketball', periods: 4, homeTeam: home, awayTeam: away,
  });
}

test('createTeam refuses a duplicate roster entry', () => {
  assert.throws(() => createTeam({ teamId: 'x', name: 'X', rosterIds: ['alice', 'alice'] }), /appears twice/);
});

test('createGame refuses a team playing itself', () => {
  const home = createTeam({ teamId: 'hawks', name: 'The Hawks', rosterIds: ['alice'] });
  assert.throws(
    () => createGame({ gameId: 'g1', teamSportType: 'football', periods: 4, homeTeam: home, awayTeam: home }),
    /cannot play itself/,
  );
});

test('a game starts scheduled with a real zeroed scoreboard', () => {
  const game = basketballGame();
  assert.equal(game.status, 'scheduled');
  assert.equal(game.homeTeam.score, 0);
  assert.equal(game.awayTeam.score, 0);
  assert.deepEqual(game.boxScore, {});
});

test('scoring is refused before the game is live', () => {
  const game = basketballGame();
  assert.throws(() => recordScore(game, { teamId: 'hawks', points: 2 }), /not live/);
});

test('recordPlayerStat checks the real roster, and moves both the box score and the team score', () => {
  const game = basketballGame();
  startGame(game);
  recordPlayerStat(game, { playerId: 'alice', teamId: 'hawks', points: 3 });
  assert.equal(game.boxScore.alice, 3);
  assert.equal(game.homeTeam.score, 3);

  assert.throws(
    () => recordPlayerStat(game, { playerId: 'carol', teamId: 'hawks', points: 2 }),
    /not on hawks's real roster/,
  );
});

test('recordScore moves a team score with no single attributed scorer', () => {
  const game = basketballGame();
  startGame(game);
  recordScore(game, { teamId: 'owls', points: 2 });
  assert.equal(game.awayTeam.score, 2);
  assert.deepEqual(game.boxScore, {});
});

test('advancePeriod refuses to go past the real final period', () => {
  const game = basketballGame();
  startGame(game);
  advancePeriod(game); advancePeriod(game); advancePeriod(game);
  assert.equal(game.currentPeriod, 4);
  assert.throws(() => advancePeriod(game), /already in its final period/);
});

test('endGame DERIVES the winner from the real score -- nobody declares it', () => {
  const game = basketballGame();
  startGame(game);
  recordPlayerStat(game, { playerId: 'alice', teamId: 'hawks', points: 10 });
  recordPlayerStat(game, { playerId: 'carol', teamId: 'owls', points: 6 });
  const finished = endGame(game);
  assert.equal(finished.status, 'finished');
  assert.equal(finished.winnerTeamId, 'hawks');
  assert.equal(finished.tie, false);
});

test('endGame reports a real, honest tie rather than forcing a winner', () => {
  const game = basketballGame();
  startGame(game);
  recordScore(game, { teamId: 'hawks', points: 7 });
  recordScore(game, { teamId: 'owls', points: 7 });
  const finished = endGame(game);
  assert.equal(finished.tie, true);
  assert.equal(finished.winnerTeamId, null);
});

test('endGame refuses a game that is not live', () => {
  const game = basketballGame();
  assert.throws(() => endGame(game), /not live/);
});

test('assertBookable refuses a player already fielded in another live game', () => {
  const game1 = basketballGame();
  startGame(game1);
  const home2 = createTeam({ teamId: 'falcons', name: 'The Falcons', rosterIds: ['alice'] });
  const away2 = createTeam({ teamId: 'ravens', name: 'The Ravens', rosterIds: ['eve'] });
  const game2 = createGame({ gameId: 'g2', teamSportType: 'football', periods: 4, homeTeam: home2, awayTeam: away2 });
  assert.throws(() => assertBookable(game2, [game1]), /already fielded in a live game/);
});

test('predictionMarketEligibility is open until the game finishes', () => {
  const game = basketballGame();
  assert.equal(predictionMarketEligibility(game).eligible, true);
  startGame(game);
  recordScore(game, { teamId: 'hawks', points: 2 });
  endGame(game);
  assert.equal(predictionMarketEligibility(game).eligible, false);
});

test('describeGame reports the real, current scoreboard', () => {
  const game = basketballGame();
  startGame(game);
  recordPlayerStat(game, { playerId: 'alice', teamId: 'hawks', points: 2 });
  const described = describeGame(game);
  assert.equal(described.score, '2-0');
  assert.equal(described.status, 'live');
  assert.ok(described.headline.includes('The Hawks'));
});

test('teamSportType is open, not an enum -- football works identically', () => {
  const home = createTeam({ teamId: 'falcons', name: 'The Falcons', rosterIds: ['alice'] });
  const away = createTeam({ teamId: 'ravens', name: 'The Ravens', rosterIds: ['bob'] });
  const game = createGame({ gameId: 'g3', teamSportType: 'Football', periods: 4, homeTeam: home, awayTeam: away });
  assert.equal(game.teamSportType, 'football');
});

test('TeamSportsError is exported so a caller can distinguish this module\'s own refusals', () => {
  assert.throws(() => createTeam({}), TeamSportsError);
});
