'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createTeamStandingsStore, teamRecordFor, playerRecordFor, recordGameResult,
  teamStandings, scoringLeaders,
} from '../src/lib/teamStandings.js';
import { createTeam, createGame, startGame, recordPlayerStat, recordScore, endGame } from '../src/lib/teamSports.js';

function playGame({ gameId, homeId, homeName, homeRoster, awayId, awayName, awayRoster, homePoints, awayPoints }) {
  const home = createTeam({ teamId: homeId, name: homeName, rosterIds: homeRoster });
  const away = createTeam({ teamId: awayId, name: awayName, rosterIds: awayRoster });
  const game = createGame({ gameId, teamSportType: 'basketball', periods: 4, homeTeam: home, awayTeam: away });
  startGame(game);
  if (homePoints > 0) recordPlayerStat(game, { playerId: homeRoster[0], teamId: homeId, points: homePoints });
  if (awayPoints > 0) recordPlayerStat(game, { playerId: awayRoster[0], teamId: awayId, points: awayPoints });
  return endGame(game);
}

test('teamRecordFor/playerRecordFor return null before any game is recorded', () => {
  const store = createTeamStandingsStore();
  assert.equal(teamRecordFor(store, 'hawks'), null);
  assert.equal(playerRecordFor(store, 'alice'), null);
});

test('recordGameResult refuses anything but a real finished game', () => {
  const store = createTeamStandingsStore();
  assert.throws(() => recordGameResult(store, null), /finished game/);
  const home = createTeam({ teamId: 'hawks', name: 'Hawks', rosterIds: ['alice'] });
  const away = createTeam({ teamId: 'owls', name: 'Owls', rosterIds: ['bob'] });
  const scheduled = createGame({ gameId: 'g1', teamSportType: 'basketball', periods: 4, homeTeam: home, awayTeam: away });
  assert.throws(() => recordGameResult(store, scheduled), /finished game/);
});

test('recordGameResult credits the real winner a win, the real loser a loss, with real points for/against', () => {
  const store = createTeamStandingsStore();
  const game = playGame({
    gameId: 'g1', homeId: 'hawks', homeName: 'Hawks', homeRoster: ['alice'], homePoints: 10,
    awayId: 'owls', awayName: 'Owls', awayRoster: ['bob'], awayPoints: 6,
  });
  recordGameResult(store, game);

  const hawks = teamRecordFor(store, 'hawks');
  assert.equal(hawks.wins, 1);
  assert.equal(hawks.losses, 0);
  assert.equal(hawks.pointsFor, 10);
  assert.equal(hawks.pointsAgainst, 6);

  const owls = teamRecordFor(store, 'owls');
  assert.equal(owls.wins, 0);
  assert.equal(owls.losses, 1);
});

test('recordGameResult credits a real tie to both sides, not a win to either', () => {
  const store = createTeamStandingsStore();
  const game = playGame({
    gameId: 'g1', homeId: 'hawks', homeName: 'Hawks', homeRoster: ['alice'], homePoints: 7,
    awayId: 'owls', awayName: 'Owls', awayRoster: ['bob'], awayPoints: 7,
  });
  recordGameResult(store, game);
  assert.equal(teamRecordFor(store, 'hawks').ties, 1);
  assert.equal(teamRecordFor(store, 'owls').ties, 1);
  assert.equal(teamRecordFor(store, 'hawks').wins, 0);
});

test('recordGameResult credits every real roster player a games-played and a real point total, scorer or not', () => {
  const store = createTeamStandingsStore();
  const home = createTeam({ teamId: 'hawks', name: 'Hawks', rosterIds: ['alice', 'zoe'] });
  const away = createTeam({ teamId: 'owls', name: 'Owls', rosterIds: ['bob'] });
  const game = createGame({ gameId: 'g1', teamSportType: 'basketball', periods: 4, homeTeam: home, awayTeam: away });
  startGame(game);
  recordPlayerStat(game, { playerId: 'alice', teamId: 'hawks', points: 10 });
  recordScore(game, { teamId: 'owls', points: 2 }); // team score with no attributed scorer
  endGame(game);
  recordGameResult(store, game);

  assert.equal(playerRecordFor(store, 'alice').points, 10);
  assert.equal(playerRecordFor(store, 'zoe').points, 0, 'a real roster player who never scored still gets a 0-point real record');
  assert.equal(playerRecordFor(store, 'zoe').gamesPlayed, 1);
  assert.equal(playerRecordFor(store, 'bob').points, 0, 'an unattributed team score never lands on a specific player');
});

test('teamStandings ranks by real win percentage, ties worth half a win, point differential as tiebreaker', () => {
  const store = createTeamStandingsStore();
  recordGameResult(store, playGame({
    gameId: 'g1', homeId: 'hawks', homeName: 'Hawks', homeRoster: ['alice'], homePoints: 10,
    awayId: 'owls', awayName: 'Owls', awayRoster: ['bob'], awayPoints: 6,
  }));
  recordGameResult(store, playGame({
    gameId: 'g2', homeId: 'falcons', homeName: 'Falcons', homeRoster: ['carol'], homePoints: 7,
    awayId: 'ravens', awayName: 'Ravens', awayRoster: ['dave'], awayPoints: 7,
  }));

  const standings = teamStandings(store);
  const hawks = standings.find((t) => t.teamId === 'hawks');
  const falcons = standings.find((t) => t.teamId === 'falcons');
  assert.equal(hawks.wins, 1);
  assert.ok(standings.findIndex((t) => t.teamId === 'hawks') < standings.findIndex((t) => t.teamId === 'falcons'), 'a real win outranks a real tie');
  assert.equal(falcons.ties, 1);
});

test('scoringLeaders ranks by real total points, independent of win/loss', () => {
  const store = createTeamStandingsStore();
  // alice scores 20 individually but her team still loses, because the
  // away team's winning points are unattributed (a real team score
  // with no single scorer) rather than credited to bob individually.
  const home = createTeam({ teamId: 'hawks', name: 'Hawks', rosterIds: ['alice'] });
  const away = createTeam({ teamId: 'owls', name: 'Owls', rosterIds: ['bob'] });
  const game = createGame({ gameId: 'g1', teamSportType: 'basketball', periods: 4, homeTeam: home, awayTeam: away });
  startGame(game);
  recordPlayerStat(game, { playerId: 'alice', teamId: 'hawks', points: 20 });
  recordScore(game, { teamId: 'owls', points: 21 });
  endGame(game);
  recordGameResult(store, game);

  const leaders = scoringLeaders(store);
  assert.equal(leaders[0].playerId, 'alice');
  assert.equal(leaders[0].points, 20);
  assert.equal(teamRecordFor(store, 'hawks').losses, 1, "alice's own team still really lost the game she led in scoring");
});

test('teamStandings/scoringLeaders respect a real limit', () => {
  const store = createTeamStandingsStore();
  for (let i = 0; i < 15; i += 1) {
    recordGameResult(store, playGame({
      gameId: `g${i}`, homeId: `team-${i}`, homeName: `Team ${i}`, homeRoster: [`player-${i}`], homePoints: 10,
      awayId: 'bench', awayName: 'Bench', awayRoster: ['sub'], awayPoints: 0,
    }));
  }
  assert.equal(teamStandings(store, { limit: 5 }).length, 5);
  assert.equal(scoringLeaders(store, { limit: 3 }).length, 3);
});
