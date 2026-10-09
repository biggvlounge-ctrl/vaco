// VAGO -- Group Wager Competitions: Leagues (§12) and Tournaments
// (§11), one engine.
//
// **One engine for two freeze sections, on purpose.** §12's League
// ("recurring group competition across multiple events... standings,
// weekly results, points, accuracy, streaks, rankings") and §11's
// Tournament ("participants accumulate points across multiple events...
// rounds, matchups, points, predictions, advancement, elimination,
// finals, winner, settlement") describe the SAME underlying shape --
// a named series of Group Wagers with cumulative standings -- and
// differ only in whether participants below a cutoff are removed as
// rounds close. §29's own final rule ("the underlying architecture
// must remain reusable so a new group format does not require
// rebuilding the wagering engine") is the reason this is one `format`
// field rather than two parallel modules.
//
// **Not a bracket engine, and that is a real scope line, not a silent
// gap.** §11's worked example ("64 participants enter a prediction
// tournament") reads like single-elimination seeding -- named
// matchups between specific pairs of people. Nothing in this ecosystem
// pairs participants against each other; every real wagering mechanic
// here (`predictionMarkets.js`'s pari-mutuel pool) is N participants
// against a shared proposition, never participant-vs-participant.
// Building a seeded bracket would mean inventing head-to-head matchups
// this engine has no substrate for. What IS real and buildable:
// "accumulate points across multiple events" (§11's own second
// sentence) with a cutoff applied after each round -- Rounds, Points,
// Advancement, Elimination, Finals and Winner all have a real meaning
// under that model; a seeded 1-vs-1 bracket tree does not exist here
// and is not silently approximated by one.
//
// **Points, not earnings.** §6 names "Point-based competition" as its
// own distinct pool/odds shape, separate from pari-mutuel earnings --
// so a Competition scores participants on correct picks
// (`POINTS_PER_CORRECT_PICK` per leg won), not on how much VCoin they
// made. A ranking by real net earnings across a chosen set of legs
// already exists and needs no second implementation:
// `groupWagerLeaderboard.leaderboardFor` takes the exact same leg list
// a Competition carries.
//
// **Elimination is a flat set, not a round-scoped bracket position.**
// `advanceRound` computes standings across every leg added so far,
// ranks the participants not already eliminated, and eliminates
// everyone below `keepTop`. A League never calls it at all -- §12
// names no elimination, only recurring standings -- so its `legs` just
// keep accumulating points with nobody ever removed.

'use strict';

const { findGroupWager } = require('./groupWagers');
const { getPredictionMarket } = require('./predictionMarkets');
const { recomputeContractOutcomes } = require('./groupWagerLeaderboard');

const FORMATS = ['league', 'tournament'];
const POINTS_PER_CORRECT_PICK = 1;

function findCompetition(store, competitionId) {
  return store.competitions.find((c) => c.id === competitionId) || null;
}

function createCompetition(store, options = {}) {
  const { creatorId, name, format, description = null, now = Date.now() } = options;
  if (!creatorId) throw new Error('createCompetition requires a creatorId');
  if (!name) throw new Error('createCompetition requires a name');
  if (!FORMATS.includes(format)) {
    throw new Error(`createCompetition: format must be one of ${FORMATS.join(', ')}`);
  }

  const competition = {
    id: store.nextCompetitionId++,
    creatorId,
    name,
    description,
    format,
    legs: [], // [{ groupWagerId, round, addedAt }]
    eliminatedUserIds: [],
    eliminationLog: [], // [{ userId, round, eliminatedAt }]
    status: 'open', // open -> finished (finished is set by finishCompetition, not inferred)
    winnerUserId: null,
    createdAt: now,
  };
  store.competitions.push(competition);
  return competition;
}

// A leg is just naming an existing Group Wager -- no second wagering
// mechanic, per §29. `round` is required for a tournament (what makes
// "advancement" a real question) and optional for a league (its own
// standings are just cumulative, with no round boundary that matters).
function addLeg(store, options = {}) {
  const { competitionId, groupWagerId, round = null, now = Date.now() } = options;
  const competition = findCompetition(store, competitionId);
  if (!competition) throw new Error(`addLeg: no competition ${competitionId}`);
  if (competition.status !== 'open') {
    throw new Error(`addLeg: competition ${competitionId} is already finished`);
  }
  const groupWager = findGroupWager(store, groupWagerId);
  if (!groupWager) throw new Error(`addLeg: no group wager ${groupWagerId}`);
  if (competition.legs.some((leg) => leg.groupWagerId === groupWagerId)) {
    throw new Error(`addLeg: group wager ${groupWagerId} is already a leg of competition ${competitionId}`);
  }
  if (competition.format === 'tournament' && !Number.isInteger(round)) {
    throw new Error('addLeg: a tournament leg requires an integer round');
  }

  competition.legs.push({ groupWagerId, round, addedAt: now });
  return competition;
}

// One user's real points across every SETTLED leg, recomputed from the
// same per-contract outcomes the leaderboard uses -- `won` on a leg is
// worth `POINTS_PER_CORRECT_PICK`, however large or small the stake.
function pointsStandings(store, competition) {
  const perUser = new Map();
  for (const leg of competition.legs) {
    const groupWager = findGroupWager(store, leg.groupWagerId);
    if (!groupWager) continue;
    const market = getPredictionMarket(store, groupWager.marketId);
    if (!market || !market.resolved) continue;
    for (const outcome of recomputeContractOutcomes(market)) {
      const row = perUser.get(outcome.userId) || {
        userId: outcome.userId, points: 0, wins: 0, losses: 0, participations: 0,
      };
      row.participations += 1;
      if (outcome.won) {
        row.points += POINTS_PER_CORRECT_PICK;
        row.wins += 1;
      } else {
        row.losses += 1;
      }
      perUser.set(outcome.userId, row);
    }
  }

  const rows = [...perUser.values()].map((row) => ({
    ...row,
    eliminated: competition.eliminatedUserIds.includes(row.userId),
  }));
  rows.sort((a, b) => b.points - a.points || b.wins - a.wins);
  return rows;
}

// §11's Advancement/Elimination, applied across every settled leg so
// far rather than one isolated round -- a cumulative cutoff, not a
// bracket match. Refuses on a league: §12 names no elimination, and
// silently accepting one would let a league quietly start behaving
// like a tournament nobody declared it to be.
function advanceRound(store, options = {}) {
  const { competitionId, round, keepTop, now = Date.now() } = options;
  const competition = findCompetition(store, competitionId);
  if (!competition) throw new Error(`advanceRound: no competition ${competitionId}`);
  if (competition.format !== 'tournament') {
    throw new Error(`advanceRound: competition ${competitionId} is a ${competition.format}, not a tournament`);
  }
  if (!Number.isInteger(keepTop) || keepTop < 1) {
    throw new Error('advanceRound requires a keepTop of at least 1');
  }

  const legsThisRound = competition.legs.filter((leg) => leg.round === round);
  if (legsThisRound.length === 0) {
    throw new Error(`advanceRound: competition ${competitionId} has no legs in round ${round}`);
  }
  for (const leg of legsThisRound) {
    const groupWager = findGroupWager(store, leg.groupWagerId);
    if (!groupWager || groupWager.status !== 'settled') {
      throw new Error(`advanceRound: round ${round} still has an unsettled leg (group wager ${leg.groupWagerId})`);
    }
  }

  const standings = pointsStandings(store, competition).filter((row) => !row.eliminated);
  const eliminated = standings.slice(keepTop);
  for (const row of eliminated) {
    competition.eliminatedUserIds.push(row.userId);
    competition.eliminationLog.push({ userId: row.userId, round, eliminatedAt: now });
  }

  // The Finals round is the one that leaves exactly one survivor --
  // declaring a winner here, rather than making a caller infer it from
  // standings, is the difference between §11's "Winner" step actually
  // happening and a cutoff that merely trims the field.
  const survivors = standings.slice(0, keepTop);
  if (survivors.length === 1 && competition.status === 'open') {
    competition.status = 'finished';
    competition.winnerUserId = survivors[0].userId;
    competition.finishedAt = now;
  }

  return { competition, eliminated: eliminated.map((row) => row.userId), survivors: survivors.map((row) => row.userId) };
}

// A league has no elimination to declare a winner through — it is
// closed explicitly, and the winner is whoever leads the real
// cumulative standings at that moment. Also usable to end a tournament
// manually (e.g. its legs are all settled and nobody ever called
// `advanceRound` down to one survivor).
function finishCompetition(store, options = {}) {
  const { competitionId, now = Date.now() } = options;
  const competition = findCompetition(store, competitionId);
  if (!competition) throw new Error(`finishCompetition: no competition ${competitionId}`);
  if (competition.status === 'finished') {
    throw new Error(`finishCompetition: competition ${competitionId} is already finished`);
  }

  const standings = pointsStandings(store, competition).filter((row) => !row.eliminated);
  competition.status = 'finished';
  competition.winnerUserId = standings.length > 0 ? standings[0].userId : null;
  competition.finishedAt = now;
  return competition;
}

function competitionView(store, competitionId) {
  const competition = findCompetition(store, competitionId);
  if (!competition) return null;
  return { ...competition, standings: pointsStandings(store, competition) };
}

function reseedIds(store) {
  const maxOf = (rows) => rows.reduce((max, r) => (r.id > max ? r.id : max), 0);
  store.nextCompetitionId = maxOf(store.competitions) + 1;
  return { nextCompetitionId: store.nextCompetitionId };
}

module.exports = {
  FORMATS,
  POINTS_PER_CORRECT_PICK,
  findCompetition,
  createCompetition,
  addLeg,
  pointsStandings,
  advanceRound,
  finishCompetition,
  competitionView,
  reseedIds,
};
