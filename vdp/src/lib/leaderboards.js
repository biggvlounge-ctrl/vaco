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

export function createLeaderboardsStore() {
  return { records: {} };
}

function ensureRecord(store, fighterId) {
  if (!store.records[fighterId]) {
    store.records[fighterId] = { wins: 0, losses: 0, byDiscipline: {} };
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

// Called once per real finished match -- `combatSports.recordResult`'s
// own output, unmodified. Every participant not among the real,
// already-validated `winnerIds` is a real loss; there is no draw case
// because `recordResult` itself refuses a result where "everyone
// cannot win," never a tie it would need to represent.
export function recordMatchResult(store, match) {
  if (!match || match.status !== 'finished' || !Array.isArray(match.winnerIds)) {
    throw new Error('recordMatchResult requires a real finished match with winnerIds');
  }
  for (const fighterId of match.participantIds) {
    const record = ensureRecord(store, fighterId);
    const discipline = ensureDiscipline(record, match.combatSportType);
    if (match.winnerIds.includes(fighterId)) {
      record.wins += 1;
      discipline.wins += 1;
    } else {
      record.losses += 1;
      discipline.losses += 1;
    }
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
