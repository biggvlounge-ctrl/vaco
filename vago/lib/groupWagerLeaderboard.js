// VAGO -- Group Wager Leaderboard, §10.
//
// **A computed rollup, never a second copy of standings.** `resolveMarket`
// already carries everything a leaderboard needs on the resolved market
// itself -- `contracts` (userId/side/quantity/avgPrice), `outcome`, and
// the pool it was solvent against (`yesPool + noPool`, unchanged by
// resolution) -- but never persists the per-user payout it computed, so
// this recomputes it with the exact same formula `resolveMarket` uses
// rather than storing a duplicate that could drift from it. The same
// "never duplicate a computable rollup" rule `vacon-c`'s own CLAUDE.md
// states for its property/family-wealth rollups, applied here.
//
// Scoped to a caller-supplied list of group wager ids, never "every
// group wager ever" implicitly -- a global leaderboard, a creator's own
// series, and a league/tournament's standings (see
// `groupWagerCompetitions.js`) are all the same shape of question
// ("rank these participants across these wagers"), differing only in
// which ids are passed in. `allSettledGroupWagerIds` is the one
// convenience for "every wager, platform-wide."

'use strict';

const { findGroupWager } = require('./groupWagers');
const { getPredictionMarket } = require('./predictionMarkets');

function round(n, places = 2) {
  const factor = 10 ** places;
  return Math.round(n * factor) / factor;
}

// Every participant's real outcome on one resolved market, recomputed
// rather than stored. `stake` is `quantity * avgPrice` -- the same
// cost-weighted average `buyContract` already maintains across repeat
// buys -- and `payout` is the exact pari-mutuel share `resolveMarket`
// paid, recomputed from the same inputs it used (`contracts`, `outcome`,
// the real remaining pool).
function recomputeContractOutcomes(market) {
  if (!market || !market.resolved) return [];
  const winningContracts = market.contracts.filter((c) => c.side === market.outcome && c.quantity > 0);
  const totalWinningQuantity = winningContracts.reduce((sum, c) => sum + c.quantity, 0);
  const totalPool = round(market.yesPool + market.noPool);

  return market.contracts.map((contract) => {
    const won = contract.side === market.outcome;
    const payout = won && totalWinningQuantity > 0 && totalPool > 0
      ? round(totalPool * (contract.quantity / totalWinningQuantity))
      : 0;
    const stake = round(contract.quantity * contract.avgPrice);
    return {
      userId: contract.userId,
      side: contract.side,
      quantity: contract.quantity,
      stake,
      won,
      payout,
      net: round(payout - stake),
    };
  });
}

// Every group wager that has ever settled, platform-wide. The one
// convenience beyond "a caller-supplied list of ids" — everything else
// (a creator's own series, one league or tournament's legs) is a
// narrower filter the caller already knows how to build.
function allSettledGroupWagerIds(store) {
  return store.groupWagers.filter((g) => g.status === 'settled').map((g) => g.id);
}

// Standings across the named group wagers: wins, losses, accuracy,
// total staked/paid out, net earnings, and a streak -- computed in
// SETTLEMENT order per user, not creation order, since a streak is
// about the sequence of real outcomes a person actually experienced.
//
// Only settled group wagers contribute. An open one has no outcome yet
// to be right or wrong about, and `recomputeContractOutcomes` already
// returns nothing for it -- never silently counted as a loss.
function leaderboardFor(store, groupWagerIds) {
  const records = [];
  for (const groupWagerId of groupWagerIds) {
    const groupWager = findGroupWager(store, groupWagerId);
    if (!groupWager) continue;
    const market = getPredictionMarket(store, groupWager.marketId);
    if (!market || !market.resolved) continue;
    const settledAt = groupWager.settledAt ?? 0;
    for (const outcome of recomputeContractOutcomes(market)) {
      records.push({ ...outcome, settledAt, groupWagerId });
    }
  }

  const byUser = new Map();
  for (const record of records) {
    if (!byUser.has(record.userId)) byUser.set(record.userId, []);
    byUser.get(record.userId).push(record);
  }

  const rows = [];
  for (const [userId, userRecords] of byUser) {
    userRecords.sort((a, b) => a.settledAt - b.settledAt);

    let wins = 0;
    let losses = 0;
    let totalStaked = 0;
    let totalPayout = 0;
    let currentStreak = 0; // positive = win streak, negative = loss streak
    let bestStreak = 0;

    for (const record of userRecords) {
      if (record.won) {
        wins += 1;
        currentStreak = currentStreak >= 0 ? currentStreak + 1 : 1;
      } else {
        losses += 1;
        currentStreak = currentStreak <= 0 ? currentStreak - 1 : -1;
      }
      bestStreak = Math.max(bestStreak, currentStreak);
      totalStaked = round(totalStaked + record.stake);
      totalPayout = round(totalPayout + record.payout);
    }

    const participations = userRecords.length;
    rows.push({
      userId,
      participations,
      wins,
      losses,
      accuracy: participations > 0 ? round(wins / participations, 4) : null,
      totalStaked,
      totalPayout,
      netEarnings: round(totalPayout - totalStaked),
      currentStreak,
      bestStreak,
    });
  }

  // Ranked by net earnings first -- §10 names "Earnings" explicitly,
  // and it is the one figure that is not a tie-breakable count. Wins
  // break ties among equal earners (two people who haven't cashed out
  // yet, both at zero).
  rows.sort((a, b) => b.netEarnings - a.netEarnings || b.wins - a.wins);
  return rows;
}

module.exports = {
  recomputeContractOutcomes,
  allSettledGroupWagerIds,
  leaderboardFor,
};
