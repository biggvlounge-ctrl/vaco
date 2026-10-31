// VDP — Leaderboards: player leaders and league leaders.
//
// Per direct instruction (14 Oct 2026): "the sports games with all
// the statistics and the leaders, the player leaders, the league
// leaders." `combatSports.js` already resolves a real match --
// `recordResult` carries real, checked `winnerIds` against a real
// roster, "everyone cannot win" already enforced there -- and then
// calls nothing. A result was a fact about one bout and nothing ever
// accumulated it into a record a fighter could be ranked by.
//
// This module is that real accumulation, kept deliberately separate
// from `combatSports.js` itself (which owns the card: who is fighting,
// in what format, whether a bout is well-formed -- see that file's
// own header on why it calls nothing downstream). `recordMatchResult`
// reads a real finished match's own already-checked `winnerIds`/
// `participantIds` and never re-derives who won -- the same "read the
// real result, never recompute it" split `taxes.js` already uses
// against `property.js`'s own tax figure.
//
// "The player leaders" and "the league leaders" are two different
// real questions, not one list sliced two ways: a discipline leader
// board (`disciplineLeaders`) ranks fighters within ONE real sport
// (`combatSportType`) -- the real leaders boxing fans would recognize
// -- while the league leaders (`leagueLeaders`) rank every fighter
// across every discipline combined, the cross-sport standing neither
// a boxing nor an MMA-only list could answer. Both rank by real wins
// first, real win rate second (so a 10-1 record outranks a 10-9 one
// at the same win count), never by an invented "power score."
//
// -- 31 Oct 2026 extension -- per direct instruction: "all tribes,
// organization, users, NPCs should all have statistics and rating on
// their combat, even if it's not in professional settings. How many
// fights, how many wins, how many knockouts, how many opponents, how
// many their rating... on the come up, on the rise." Four real
// additions, same record, nothing re-derived:
//   - a winning method breakdown (`winsByMethod`) -- pin/submission/
//     stoppage/forfeit/decision, read from the real `endedBy` a live
//     match already produces (`liveWrestling.js`), never guessed.
//   - opponents actually faced (`opponents`), so "how many opponents"
//     is a real count, not wins-plus-losses.
//   - a rating. Elo (K=32, starting 1000) is a real, standard rating
//     system, not an invented one -- but `combatSports.js` allows
//     rosters bigger than two (tag-team, royal-rumble), and classic
//     Elo is a two-player formula. The extension to a side of any
//     size here is interpretive and flagged as such below
//     (`teamEloUpdate`): each fighter is rated against the *average*
//     rating of the opposing side, so a 1v1 bout reduces to exact,
//     textbook Elo and a 12-vs-8 handicap still produces one bounded
//     rating change per fighter rather than nine.
//   - "on the come up": `risingLeaders` ranks by real rating gained
//     over a real recent window of fights (`ratingLog`), not by an
//     invented momentum score.
//
// This module stays generic over what a "fighter" id names -- it
// always has been (`ensureRecord` takes any string key). A tribe, a
// gang, a city, or an NPC is exactly as real a record here as a
// player, which is what lets `recordConflictResult` below give a
// dispute's two *groups* their own won-loss/rating record using the
// same accumulation a sanctioned bout already uses, with no parallel
// stat system invented for groups.

const STARTING_RATING = 1000;
// Standard chess/FIDE K-factor -- the real default, not a tuned one.
const ELO_K = 32;

// Invented, not sourced -- how many past ratings a record keeps
// around to answer "on the come up" without growing forever for a
// fighter with hundreds of bouts.
const RATING_LOG_LIMIT = 20;

export function createLeaderboardsStore() {
  return { records: {} };
}

function ensureRecord(store, fighterId) {
  if (!store.records[fighterId]) {
    store.records[fighterId] = {
      wins: 0,
      losses: 0,
      byDiscipline: {},
      winsByMethod: {},
      opponents: {},
      rating: STARTING_RATING,
      ratingLog: [STARTING_RATING],
    };
  }
  return store.records[fighterId];
}

function ensureDiscipline(record, sport) {
  if (!record.byDiscipline[sport]) record.byDiscipline[sport] = { wins: 0, losses: 0 };
  return record.byDiscipline[sport];
}

// The real, read-only lookup -- `null` for a fighter with no recorded
// result yet, never a manufactured zeroed row that would make an
// unranked fighter look identical to a real 0-0 one.
export function recordFor(store, fighterId) {
  return store.records[fighterId] || null;
}

export function opponentCount(record) {
  return Object.keys(record.opponents).length;
}

export function knockouts(record) {
  return record.winsByMethod.stoppage || 0;
}

// Any win that was not a plain decision -- the "finish" boxing/MMA/
// wrestling fans would recognize across every discipline at once.
export function finishes(record) {
  let total = 0;
  for (const [method, count] of Object.entries(record.winsByMethod)) {
    if (method !== 'decision') total += count;
  }
  return total;
}

function expectedScore(ratingSelf, ratingOpponent) {
  return 1 / (1 + 10 ** ((ratingOpponent - ratingSelf) / 400));
}

function average(values) {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function pushRatingLog(record) {
  record.ratingLog.push(record.rating);
  if (record.ratingLog.length > RATING_LOG_LIMIT) record.ratingLog.shift();
}

// See the header: each fighter rates against the opposing side's
// *average* rating, so this is exact two-player Elo whenever both
// sides have exactly one fighter, and a real, bounded extension of it
// whenever either side is bigger.
function teamEloUpdate(store, winnerIds, loserIds) {
  const winners = winnerIds.map((id) => ensureRecord(store, id));
  const losers = loserIds.map((id) => ensureRecord(store, id));
  const avgWinnerRating = average(winners.map((w) => w.rating));
  const avgLoserRating = average(losers.map((l) => l.rating));
  for (const w of winners) {
    w.rating += ELO_K * (1 - expectedScore(w.rating, avgLoserRating));
    pushRatingLog(w);
  }
  for (const l of losers) {
    l.rating += ELO_K * (0 - expectedScore(l.rating, avgWinnerRating));
    pushRatingLog(l);
  }
}

// The shared accumulation both a sanctioned match (`recordMatchResult`)
// and a dispute/street-fight (`recordConflictResult`, in `conflicts.js`'s
// own result) feed real results through -- one real place that updates
// wins, losses, method, opponents, and rating, so neither caller can
// drift from the other on what a "result" does to a record.
function applyResult(store, { participantIds, winnerIds, discipline, method }) {
  const loserIds = participantIds.filter((id) => !winnerIds.includes(id));
  for (const fighterId of participantIds) {
    const record = ensureRecord(store, fighterId);
    const won = winnerIds.includes(fighterId);
    const disciplineRecord = ensureDiscipline(record, discipline);
    if (won) {
      record.wins += 1;
      disciplineRecord.wins += 1;
      record.winsByMethod[method] = (record.winsByMethod[method] || 0) + 1;
    } else {
      record.losses += 1;
      disciplineRecord.losses += 1;
    }
    const others = won ? loserIds : winnerIds;
    for (const opponentId of others) {
      record.opponents[opponentId] = (record.opponents[opponentId] || 0) + 1;
    }
  }
  teamEloUpdate(store, winnerIds, loserIds);
  return store.records;
}

// Called once per real finished match -- `combatSports.recordResult`'s
// own output, unmodified. Every participant not among the real,
// already-validated `winnerIds` is a real loss; there is no draw case
// because `recordResult` itself refuses a result where "everyone
// cannot win," never a tie it would need to represent.
//
// `method` is the real way the win happened -- `liveWrestling.js`'s
// own `endedBy` ("pin"/"submission"/"stoppage"/"forfeit") for a live
// match, or left as the default "decision" for an operator-declared
// result with no live engine behind it (nothing invents a method a
// caller never reported).
export function recordMatchResult(store, match, { method = 'decision' } = {}) {
  if (!match || match.status !== 'finished' || !Array.isArray(match.winnerIds)) {
    throw new Error('recordMatchResult requires a real finished match with winnerIds');
  }
  return applyResult(store, {
    participantIds: match.participantIds,
    winnerIds: match.winnerIds,
    discipline: match.combatSportType,
    method,
  });
}

// Called once per real finished dispute/street fight (`conflicts.js`'s
// own `recordDuelResult`/`forfeitSide`, never re-derived here). Per
// direct instruction -- "tribes, organization, gangs, cities, cultures,
// families can choose to fight to settle disputes... all tribes,
// organization, users, NPCs should all have statistics and rating" --
// this credits two real things from one conflict: every individual who
// fought for either side (discipline `conflict:<kind>`, so a tribal
// dispute never mixes into a sanctioned boxing record), and, when both
// sides name a real `groupId` (a tribe, gang, org, or city, not an ad
// hoc street crew), the two *groups themselves* as a single head-to-
// head result (discipline `conflict:group`) -- the same accumulation
// `applyResult` already gives a player, given to a tribe with no
// second stat system invented for it.
//
// A conflict `conflicts.js`'s own `escalateToWar` marked as a real war
// (`conflict.escalation` set) is credited under `conflict:war` instead
// of `conflict:<kind>` -- per direct instruction, "it could be
// considered a war between two different factions" once injuries,
// headcount, and duration cross a real threshold, and a faction's war
// record is a real, separate stat from its ordinary dispute record.
export function recordConflictResult(store, conflict) {
  if (!conflict || conflict.status !== 'finished' || (conflict.winningSide !== 'A' && conflict.winningSide !== 'B')) {
    throw new Error('recordConflictResult requires a real finished conflict with a winningSide');
  }
  const winningSide = conflict.winningSide === 'A' ? conflict.sideA : conflict.sideB;
  const losingSide = conflict.winningSide === 'A' ? conflict.sideB : conflict.sideA;
  const method = conflict.resolution || 'gauntlet';
  const discipline = conflict.escalation ? 'conflict:war' : `conflict:${conflict.kind}`;
  applyResult(store, {
    participantIds: [...winningSide.participantIds, ...losingSide.participantIds],
    winnerIds: [...winningSide.participantIds],
    discipline,
    method,
  });
  if (winningSide.groupId && losingSide.groupId) {
    applyResult(store, {
      participantIds: [winningSide.groupId, losingSide.groupId],
      winnerIds: [winningSide.groupId],
      discipline: 'conflict:group',
      method,
    });
  }
  return store.records;
}

// `null` rather than 0 for a fighter with no decided bout yet -- an
// 0-0 record and an unranked fighter are different real facts, the
// same distinction `recordFor` above already draws.
export function winRate({ wins, losses }) {
  const total = wins + losses;
  return total === 0 ? null : wins / total;
}

function rank(entries, limit) {
  return entries
    .sort((a, b) => b.wins - a.wins || winRate(b) - winRate(a))
    .slice(0, limit);
}

// "The player leaders" -- real standing within one real discipline.
export function disciplineLeaders(store, sport, { limit = 10 } = {}) {
  const entries = Object.entries(store.records)
    .map(([fighterId, record]) => ({ fighterId, ...ensureDiscipline(record, sport) }))
    .filter((r) => r.wins + r.losses > 0);
  return rank(entries, limit);
}

// "The league leaders" -- real standing across every discipline
// combined, which no single-sport board above can answer on its own.
export function leagueLeaders(store, { limit = 10 } = {}) {
  const entries = Object.entries(store.records)
    .map(([fighterId, record]) => ({ fighterId, wins: record.wins, losses: record.losses }))
    .filter((r) => r.wins + r.losses > 0);
  return rank(entries, limit);
}

// Real rating standing -- every fighter/group with a recorded result,
// ranked by the Elo rating `applyResult` actually moved.
export function ratingLeaders(store, { limit = 10 } = {}) {
  const entries = Object.entries(store.records)
    .map(([fighterId, record]) => ({
      fighterId, rating: record.rating, wins: record.wins, losses: record.losses,
    }))
    .filter((r) => r.wins + r.losses > 0);
  return entries.sort((a, b) => b.rating - a.rating).slice(0, limit);
}

// "On the come up" -- ranked by real rating gained over a real recent
// window of fights, read straight from `ratingLog`, never an invented
// momentum score. `window` and `minFights` are both invented, flagged
// defaults (how many recent fights count as "recent," and how many
// fights a record needs before a trend means anything) -- the gain
// itself is not.
export function risingLeaders(store, { limit = 10, window = 5, minFights = 3 } = {}) {
  const entries = Object.entries(store.records)
    .map(([fighterId, record]) => {
      const log = record.ratingLog;
      const fights = record.wins + record.losses;
      if (fights < minFights || log.length < 2) return null;
      const back = Math.min(window, log.length - 1);
      const gain = log[log.length - 1] - log[log.length - 1 - back];
      return { fighterId, gain, rating: record.rating, wins: record.wins, losses: record.losses };
    })
    .filter((e) => e !== null);
  return entries.sort((a, b) => b.gain - a.gain).slice(0, limit);
}
