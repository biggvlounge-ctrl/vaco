// VAGO -- Esports skill-based staking (1v1Me-model).
// Source of truth: VAGO_ARCHITECTURE.md's `EsportsBet { id, matchId,
// player1Id, player2Id, stakes: [{userId, backedPlayerId,
// amountVCoin}], isFlashStake }`. VAGO_COMPARABLES.md: 1v1Me is real,
// funded, peer-to-peer skill-based staking "priced by the market
// rather than house odds" -- explicitly NOT the sportsbook mechanic in
// sportsbook.js. LANDuel's real precedent (players staking on
// themselves, not just fans backing others) is naturally supported
// here too: nothing prevents `backedPlayerId === userId`.
//
// The doc's own `EsportsBet` shape has no price/odds field at all --
// "priced by the market" here means the real, relative pool sizes
// implicitly reflect sentiment, not a displayed per-share price like
// predictionMarkets.js. Settlement is pari-mutuel-style pooled
// distribution (mirroring predictionMarkets.js's own, separately
// verified solvent-by-construction pattern): the entire real pool
// staked on both players splits proportionally among the winner's
// backers.
//
// Flash Stakes get real, structural enforcement rather than a
// caller-supplied (and therefore spoofable) boolean: `isFlashStake` is
// derived automatically from the match's real state at stake time
// (true once the match has gone `live`, matching the doc's own "live
// in-match staking opportunities that pop up as a match unfolds"),
// not trusted from the request body.

const { VAGO_HOUSE_ACCOUNT } = require('./casinoSession');
const { settleOnce } = require('./settleOnce');

const MATCH_STATUSES = ['scheduled', 'live', 'resolved'];

function round(n) {
  return Math.round(n * 100) / 100;
}

function createEsportsMatch(store, options = {}) {
  const { matchId, player1Id, player2Id } = options;
  if (!matchId) throw new Error('createEsportsMatch requires a matchId');
  if (store.esportsMatches.some((m) => m.matchId === matchId)) {
    throw new Error(`createEsportsMatch: a match with id "${matchId}" already exists`);
  }
  if (!player1Id || !player2Id) throw new Error('createEsportsMatch requires player1Id and player2Id');
  if (player1Id === player2Id) throw new Error('createEsportsMatch: player1Id and player2Id must be different players');

  const match = {
    matchId, player1Id, player2Id, status: 'scheduled', stakes: [], winnerId: null, finalPool: null, createdAt: Date.now(),
  };
  store.esportsMatches.push(match);
  return match;
}

function getEsportsMatch(store, matchId) {
  return store.esportsMatches.find((m) => m.matchId === matchId) || null;
}

function startEsportsMatch(store, options = {}) {
  const { matchId } = options;
  const match = getEsportsMatch(store, matchId);
  if (!match) throw new Error(`startEsportsMatch: no match with id ${matchId}`);
  if (match.status !== 'scheduled') throw new Error(`startEsportsMatch: match ${matchId} is not scheduled (status: ${match.status})`);
  match.status = 'live';
  return match;
}

async function placeStake(store, options = {}) {
  const { matchId, userId, backedPlayerId, amountVCoin, settleFn } = options;
  const match = getEsportsMatch(store, matchId);
  if (!match) throw new Error(`placeStake: no match with id ${matchId}`);
  if (match.status === 'resolved') throw new Error(`placeStake: match ${matchId} is already resolved`);
  if (!userId) throw new Error('placeStake requires a userId');
  if (backedPlayerId !== match.player1Id && backedPlayerId !== match.player2Id) {
    throw new Error(`placeStake: backedPlayerId must be one of the match's two real players`);
  }
  if (!Number.isFinite(amountVCoin) || amountVCoin <= 0) throw new Error('placeStake requires a positive amountVCoin');
  if (typeof settleFn !== 'function') throw new Error('placeStake requires a settleFn(legs, meta)');

  await settleFn(
    [{ fromUserId: userId, toUserId: VAGO_HOUSE_ACCOUNT, amount: amountVCoin, reason: `vago_esports_stake:${matchId}` }],
    { reason: `vago_esports_stake:${matchId}` },
  );

  const isFlashStake = match.status === 'live';
  const stake = { userId, backedPlayerId, amountVCoin, isFlashStake, at: Date.now() };
  match.stakes.push(stake);
  return { match, stake };
}

async function resolveEsportsMatch(store, options = {}) {
  const { matchId, winnerId, settleFn } = options;
  const match = getEsportsMatch(store, matchId);
  if (!match) throw new Error(`resolveEsportsMatch: no match with id ${matchId}`);
  if (match.status === 'resolved') throw new Error(`resolveEsportsMatch: match ${matchId} is already resolved`);
  if (winnerId !== match.player1Id && winnerId !== match.player2Id) {
    throw new Error('resolveEsportsMatch: winnerId must be one of the match\'s two real players');
  }
  if (typeof settleFn !== 'function') throw new Error('resolveEsportsMatch requires a settleFn(legs, meta)');

  const totalPool = round(match.stakes.reduce((sum, s) => sum + s.amountVCoin, 0));
  const winningStakes = match.stakes.filter((s) => s.backedPlayerId === winnerId);
  const totalWinningAmount = round(winningStakes.reduce((sum, s) => sum + s.amountVCoin, 0));

  // Claimed before the payout loop. Five concurrent resolutions each
  // paid the whole pool: 200.00 out of a 40.00 pool, measured.
  const payouts = [];
  await settleOnce(match, { status: 'resolved', winnerId, finalPool: totalPool }, async () => {
    if (totalWinningAmount > 0 && totalPool > 0) {
      for (const stake of winningStakes) {
        const share = stake.amountVCoin / totalWinningAmount;
        const payout = round(totalPool * share);
        if (payout > 0) {
          await settleFn(
            [{ fromUserId: VAGO_HOUSE_ACCOUNT, toUserId: stake.userId, amount: payout, reason: `vago_esports_payout:${matchId}` }],
            { reason: `vago_esports_payout:${matchId}` },
          );
          payouts.push({ userId: stake.userId, payout });
        }
      }
    }
  });
  return { match, payouts };
}

module.exports = {
  MATCH_STATUSES,
  createEsportsMatch,
  getEsportsMatch,
  startEsportsMatch,
  placeStake,
  resolveEsportsMatch,
};
