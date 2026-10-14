// VDP — Team Standings: the league table, and the real scoring
// leaders.
//
// `leaderboards.js` already does this for individual combat, reading
// `combatSports.js`'s own real finished-match output rather than
// re-deriving it. This is the same real split, one level up, for
// `teamSports.js`: a finished game is a fact about one scoreboard,
// and nothing accumulated it into a record a TEAM could be ranked by,
// or a real total a player's own scoring could be ranked by.
//
// Two different real questions, the team-sport shape of the same
// split `leaderboards.js` already draws between a discipline board
// and the league board: `teamStandings` is the real league table
// (wins/losses/ties, the question a sports fan means by "the
// standings"), and `scoringLeaders` is the real point-scoring board
// (who actually put the ball in), reading the box score rather than
// the final score. A team can top the standings with nobody near the
// top of the scoring board, and that is not a contradiction -- it is
// what a real defense-first team looks like.

export function createTeamStandingsStore() {
  return { teams: {}, players: {} };
}

function ensureTeamRecord(store, teamId) {
  if (!store.teams[teamId]) {
    store.teams[teamId] = { wins: 0, losses: 0, ties: 0, pointsFor: 0, pointsAgainst: 0 };
  }
  return store.teams[teamId];
}

function ensurePlayerRecord(store, playerId) {
  if (!store.players[playerId]) {
    store.players[playerId] = { points: 0, gamesPlayed: 0 };
  }
  return store.players[playerId];
}

export function teamRecordFor(store, teamId) {
  return store.teams[teamId] || null;
}

export function playerRecordFor(store, playerId) {
  return store.players[playerId] || null;
}

// Called once per real finished game -- `teamSports.endGame`'s own
// output, unmodified. The winner is read off the game's own real
// `winnerTeamId`/`tie`, never re-derived from the score a second time
// here -- the same "read the real result, never recompute it" split
// this app's other modules already use.
export function recordGameResult(store, game) {
  if (!game || game.status !== 'finished') {
    throw new Error('recordGameResult requires a real finished game');
  }
  const home = ensureTeamRecord(store, game.homeTeam.teamId);
  const away = ensureTeamRecord(store, game.awayTeam.teamId);
  home.pointsFor += game.homeTeam.score;
  home.pointsAgainst += game.awayTeam.score;
  away.pointsFor += game.awayTeam.score;
  away.pointsAgainst += game.homeTeam.score;

  if (game.tie) {
    home.ties += 1;
    away.ties += 1;
  } else if (game.winnerTeamId === game.homeTeam.teamId) {
    home.wins += 1;
    away.losses += 1;
  } else {
    away.wins += 1;
    home.losses += 1;
  }

  for (const playerId of [...game.homeTeam.rosterIds, ...game.awayTeam.rosterIds]) {
    const player = ensurePlayerRecord(store, playerId);
    player.points += game.boxScore[playerId] || 0;
    player.gamesPlayed += 1;
  }

  return store;
}

function winPct({ wins, losses, ties }) {
  const total = wins + losses + ties;
  return total === 0 ? null : (wins + ties * 0.5) / total;
}

// "The league leaders" for a TEAM sport -- the real league table,
// ranked by real win percentage first (ties worth half a win, the
// same real convention every league standing already uses), real
// point differential as the tiebreaker.
export function teamStandings(store, { limit = 10 } = {}) {
  return Object.entries(store.teams)
    .map(([teamId, record]) => ({ teamId, ...record, differential: record.pointsFor - record.pointsAgainst }))
    .filter((r) => r.wins + r.losses + r.ties > 0)
    .sort((a, b) => winPct(b) - winPct(a) || b.differential - a.differential)
    .slice(0, limit);
}

// "The player leaders" for a TEAM sport -- real total points scored,
// not win/loss (a player does not win or lose a game alone the way a
// fighter does), the honest reason this is not `leaderboards.js`'s
// own `disciplineLeaders` reused.
export function scoringLeaders(store, { limit = 10 } = {}) {
  return Object.entries(store.players)
    .map(([playerId, record]) => ({ playerId, ...record }))
    .filter((r) => r.gamesPlayed > 0)
    .sort((a, b) => b.points - a.points)
    .slice(0, limit);
}
