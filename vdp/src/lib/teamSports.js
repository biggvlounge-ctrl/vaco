// VDP — Team Sports: basketball, football, and any other real team
// ball sport.
//
// Per direct instruction (14 Oct 2026): "when it's set up as
// basketball or football, it's set up just like the sports games as
// well... when you're playing, it's set up like the sports games."
// Same real split `combatSports.js` already draws for individual
// combat: VDP owns the game -- two real rosters, a real score, a real
// winner -- VAGO owns the prediction market and the money, Vavlt
// Stvdios owns the broadcast. This module calls none of them, same
// discipline, same reason.
//
// **`teamSportType` stays an open string, deliberately** -- the same
// treatment `combatSportType` already gets, for the same reason: the
// instruction names basketball and football as real examples, not an
// exhaustive list, and an enum here would quietly contradict that.
//
// **The one real structural difference from `combatSports.js`, and
// the reason this is its own module rather than one more match
// format.** A combat bout's winner is handed to `recordResult` as a
// given fact -- somebody outside the match decided it. A real team
// sports game is not refereed that way: `endGame` DERIVES the winner
// from the real, accumulated score. Nobody declares who won a
// basketball game; the scoreboard does. A tie is a real, honest
// possible outcome (`winnerTeamId: null`, `tie: true`), not an error
// -- not every real sport this module can be asked to run forces an
// overtime, and inventing one would be a rule this module has no
// business making up.
//
// **Box score, not just a final number.** `recordPlayerStat` credits
// one real player's running point total within the game they are
// actually fielded in, checked against that team's real roster so a
// stat line can never land on somebody who is not even playing.
// `recordScore` is the team-level sibling, for points with no single
// attributed scorer (a team penalty, a defensive score) -- both move
// the same real scoreboard, and `recordPlayerStat` moves it too so a
// caller never has to call both to keep the two numbers honest.
// `teamStandings.js` is what accumulates this across many games into
// something a league table or a scoring-leader board can read -- this
// module owns one game at a time, the same "it holds games, not a
// season" restraint VACON-C's own `competition.js` already names for
// exactly this reason.

export const DISTRICT_NAME = 'Team Sports';

export class TeamSportsError extends Error {}

function requireString(value, field, action) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TeamSportsError(`${action} requires a non-empty ${field}`);
  }
  return value.trim();
}

function requirePositiveInt(value, field, action) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new TeamSportsError(`${action}: ${field} must be a positive integer, got ${value}`);
  }
  return value;
}

export function createTeam(options = {}) {
  const a = 'createTeam';
  const { teamId, name, rosterIds = [] } = options;
  const id = requireString(teamId, 'teamId', a);
  const teamName = requireString(name, 'name', a);
  if (!Array.isArray(rosterIds)) throw new TeamSportsError(`${a}: rosterIds must be an array`);
  const roster = rosterIds.map((p) => requireString(String(p ?? ''), 'playerId', a));
  const unique = new Set(roster);
  if (unique.size !== roster.length) {
    throw new TeamSportsError(`${a}: the same player appears twice on the roster`);
  }
  return { teamId: id, name: teamName, rosterIds: roster };
}

export function createGame(options = {}) {
  const a = 'createGame';
  const {
    gameId, teamSportType, periods, homeTeam, awayTeam, scheduledAt = null,
  } = options;
  const id = requireString(gameId, 'gameId', a);
  const sport = requireString(teamSportType, 'teamSportType', a).toLowerCase();
  requirePositiveInt(periods, 'periods', a);
  if (!homeTeam || !awayTeam) throw new TeamSportsError(`${a}: requires a real homeTeam and awayTeam`);
  if (homeTeam.teamId === awayTeam.teamId) throw new TeamSportsError(`${a}: a team cannot play itself`);

  return {
    gameId: id,
    teamSportType: sport,
    periods,
    currentPeriod: 0,
    homeTeam: { teamId: homeTeam.teamId, name: homeTeam.name, rosterIds: [...homeTeam.rosterIds], score: 0 },
    awayTeam: { teamId: awayTeam.teamId, name: awayTeam.name, rosterIds: [...awayTeam.rosterIds], score: 0 },
    boxScore: {}, // playerId -> real accumulated points
    scheduledAt,
    status: 'scheduled',
    winnerTeamId: null,
    tie: false,
  };
}

// The real double-booking guard -- same shape `combatSports.js`'s own
// `assertBookable` already uses, checked against rosters instead of a
// flat fighter list: a player cannot be fielded in two live games at
// once.
export function assertBookable(game, liveGames = []) {
  const a = 'assertBookable';
  const busy = new Set();
  for (const live of liveGames) {
    if (live.status !== 'live') continue;
    for (const p of [...live.homeTeam.rosterIds, ...live.awayTeam.rosterIds]) busy.add(p);
  }
  const roster = [...game.homeTeam.rosterIds, ...game.awayTeam.rosterIds];
  const clash = roster.filter((p) => busy.has(p));
  if (clash.length > 0) {
    throw new TeamSportsError(`${a}: ${clash.join(', ')} ${clash.length === 1 ? 'is' : 'are'} already fielded in a live game`);
  }
  return game;
}

export function startGame(game) {
  if (game.status !== 'scheduled') {
    throw new TeamSportsError(`startGame: game ${game.gameId} is "${game.status}", not scheduled`);
  }
  game.status = 'live';
  game.currentPeriod = 1;
  return game;
}

function teamInGame(game, teamId) {
  if (game.homeTeam.teamId === teamId) return game.homeTeam;
  if (game.awayTeam.teamId === teamId) return game.awayTeam;
  return null;
}

// Team-level scoring, live only -- the same "a result only moves
// during a live match" gating `combatSports.js`'s own status machine
// already enforces, one level down (a score, not a final result).
export function recordScore(game, options = {}) {
  const a = 'recordScore';
  const { teamId, points } = options;
  if (game.status !== 'live') throw new TeamSportsError(`${a}: game ${game.gameId} is "${game.status}", not live`);
  const team = teamInGame(game, teamId);
  if (!team) throw new TeamSportsError(`${a}: "${teamId}" is not playing in this game`);
  requirePositiveInt(points, 'points', a);
  team.score += points;
  return team.score;
}

// The real box score -- checked against the roster the player is
// actually fielded on for THIS game, so a stat can never land on
// somebody who is not even playing. Moves the team score too, so the
// box score and the scoreboard can never quietly disagree.
export function recordPlayerStat(game, options = {}) {
  const a = 'recordPlayerStat';
  const { playerId, teamId, points } = options;
  if (game.status !== 'live') throw new TeamSportsError(`${a}: game ${game.gameId} is "${game.status}", not live`);
  const team = teamInGame(game, teamId);
  if (!team) throw new TeamSportsError(`${a}: "${teamId}" is not playing in this game`);
  if (!team.rosterIds.includes(playerId)) {
    throw new TeamSportsError(`${a}: "${playerId}" is not on ${teamId}'s real roster for this game`);
  }
  requirePositiveInt(points, 'points', a);
  game.boxScore[playerId] = (game.boxScore[playerId] || 0) + points;
  team.score += points;
  return { playerPoints: game.boxScore[playerId], teamScore: team.score };
}

export function advancePeriod(game) {
  const a = 'advancePeriod';
  if (game.status !== 'live') throw new TeamSportsError(`${a}: game ${game.gameId} is "${game.status}", not live`);
  if (game.currentPeriod >= game.periods) {
    throw new TeamSportsError(`${a}: game ${game.gameId} is already in its final period`);
  }
  game.currentPeriod += 1;
  return game.currentPeriod;
}

// The real structural difference from `combatSports.recordResult` --
// nobody declares the winner, the scoreboard does.
export function endGame(game) {
  const a = 'endGame';
  if (game.status !== 'live') throw new TeamSportsError(`${a}: game ${game.gameId} is "${game.status}", not live`);
  game.status = 'finished';
  if (game.homeTeam.score === game.awayTeam.score) {
    game.tie = true;
    game.winnerTeamId = null;
  } else {
    game.winnerTeamId = game.homeTeam.score > game.awayTeam.score ? game.homeTeam.teamId : game.awayTeam.teamId;
  }
  return game;
}

// The gate before calling VAGO -- same shape
// `combatSports.predictionMarketEligibility` already uses. No tier
// restriction here: the instruction names no skill-level ladder for
// team sports the way the Combat Sports District's own source
// document named street/amateur/semi-pro/professional, so none is
// invented.
export function predictionMarketEligibility(game) {
  if (game.status === 'finished') {
    return { eligible: false, reason: 'this game is already finished' };
  }
  return { eligible: true, reason: null };
}

export function describeGame(game) {
  return {
    gameId: game.gameId,
    headline: `${game.teamSportType} · ${game.homeTeam.name} vs ${game.awayTeam.name}`,
    score: `${game.homeTeam.score}-${game.awayTeam.score}`,
    period: `${game.currentPeriod}/${game.periods}`,
    status: game.status,
    winnerTeamId: game.winnerTeamId,
    tie: game.tie,
  };
}
