// VAGO -- BLIND (§17) and Before-the-Answer (§18), one engine.
//
// **Genuinely new, unlike every other group format in this session's
// pass.** Side Wagers, Team roles and the Leaderboard all turned out to
// need no new mechanic (`groupWagers.js`'s own header on the first two;
// `groupWagerLeaderboard.js`'s on the third) -- real substrate already
// existed to wrap. BLIND and Before-the-Answer do not: both need every
// participant answering the SAME free-form proposition (a number, a
// name, a guess), not a yes/no pick on a shared proposition the way
// `predictionMarkets.js` already handles. No multi-outcome or
// free-answer engine exists anywhere else in VAGO to reuse, confirmed
// by the on-deck audit before this session started.
//
// **One engine, because the freeze describes the same shape twice.**
// §17's BLIND ("VAGO/ARIES selects a random eligible proposition... each
// user submits a prediction... the result is resolved") and §18's
// Before-the-Answer ("BET BEFORE I ANSWER... each participant submits
// an answer... VAGO performs the predefined research... the answer is
// resolved") differ only in where the question comes from and what
// kind of research resolves it -- mechanically, both are: one shared
// proposition, free-form answers, a lock, a real answer, and a payout
// to whoever was closest or exactly right. `format` records which one
// this round is cosmetically; nothing in the settlement logic branches
// on it.
//
// **ARIES does not exist** (confirmed absent anywhere in the repo by
// the on-deck audit) **and does not need to.** `groupWagers.js` already
// resolved the identical ambiguity for its own "VAGO/ARIES selects a
// random eligible proposition" line by letting a real creator supply
// the question; this does the same. The random-selection half of §17
// is not built -- a creator picks the proposition, same as every other
// VAGO market -- which is a real, named scope line, not a silent
// substitution.
//
// **A real stake pool, not an abstract points game.** §6 names "fixed-
// entry contests," "pool," "winner-take-all" and "multiple winners" as
// real payout shapes; this builds exactly those four as one mechanic:
// every participant pays the same `entryAmount` into the real
// `VAGO_HOUSE_ACCOUNT` (the same custody account `predictionMarkets.js`
// and `casinoSession.js` already use), the pool is the sum of every
// entry, and at resolution it splits evenly among whoever was exactly
// right (`answerType: 'exact'`) or closest (`answerType: 'numeric'`) --
// one winner is winner-take-all, a tie is "multiple winners," and
// nothing else in §6's list (negotiated odds, tiered/ranked payouts,
// "fixed payout" independent of pool size) is built. Each of those is
// its own real undertaking, named here rather than silently assumed.
//
// **§18's integrity rule is procedural, not mechanical.** "The AI must
// not alter the answer based on the participants' bets" cannot be
// enforced by this module -- it is a constraint on whoever performs the
// real-world research that produces `realAnswer`, not on any code path
// here. What IS enforced: resolving a round is operator-only
// (`requireOperator`, same as every other VAGO settlement) and
// decision-logged, exactly like `/api/group-wagers/:id/resolve` --
// which at least makes who resolved it and what they submitted a real,
// auditable record rather than an unwitnessed claim.

'use strict';

const { VAGO_HOUSE_ACCOUNT } = require('./casinoSession');
const { settleOnce } = require('./settleOnce');

const FORMATS = ['blind', 'before-the-answer'];
const ANSWER_TYPES = ['exact', 'numeric'];

function round2(n) {
  return Math.round(n * 100) / 100;
}

function findBlindRound(store, blindRoundId) {
  return store.blindRounds.find((r) => r.id === blindRoundId) || null;
}

function isBlindRoundLocked(blindRound, now = Date.now()) {
  return now >= blindRound.entryDeadline || blindRound.status !== 'open';
}

function createBlindRound(store, options = {}) {
  const {
    creatorId, format, proposition, answerType, entryAmount, entryDeadline,
    maxParticipants = null, now = Date.now(),
  } = options;

  if (!creatorId) throw new Error('createBlindRound requires a creatorId');
  if (!FORMATS.includes(format)) {
    throw new Error(`createBlindRound: format must be one of ${FORMATS.join(', ')}`);
  }
  if (!proposition) throw new Error('createBlindRound requires a proposition');
  if (!ANSWER_TYPES.includes(answerType)) {
    throw new Error(`createBlindRound: answerType must be one of ${ANSWER_TYPES.join(', ')}`);
  }
  if (!Number.isFinite(entryAmount) || entryAmount <= 0) {
    throw new Error('createBlindRound requires a positive entryAmount');
  }
  if (!Number.isFinite(entryDeadline) || entryDeadline <= now) {
    throw new Error('createBlindRound requires an entryDeadline in the future');
  }
  if (maxParticipants !== null && (!Number.isInteger(maxParticipants) || maxParticipants < 2)) {
    throw new Error('createBlindRound: maxParticipants must be an integer of at least 2, or omitted');
  }

  const blindRound = {
    id: store.nextBlindRoundId++,
    creatorId,
    format,
    proposition,
    answerType,
    entryAmount,
    entryDeadline,
    maxParticipants,
    answers: [], // [{ userId, answer, submittedAt }]
    pool: 0,
    status: 'open', // open -> resolved
    realAnswer: null,
    createdAt: now,
  };
  store.blindRounds.push(blindRound);
  return blindRound;
}

function findAnswer(blindRound, userId) {
  return blindRound.answers.find((a) => a.userId === userId) || null;
}

// JOIN + FUND + submit, atomically -- the same one-step shape
// `joinGroupWager` already established for the identical reason: no
// window where a participant has paid in but is not recorded, or is
// recorded without having actually paid.
async function submitAnswer(store, options = {}) {
  const { blindRoundId, userId, answer, settleFn, now = Date.now() } = options;
  const blindRound = findBlindRound(store, blindRoundId);
  if (!blindRound) throw new Error(`submitAnswer: no blind round ${blindRoundId}`);
  if (isBlindRoundLocked(blindRound, now)) {
    throw new Error(`submitAnswer: blind round ${blindRoundId} is locked (entry deadline passed or already resolved)`);
  }
  if (!userId) throw new Error('submitAnswer requires a userId');
  if (blindRound.answerType === 'numeric') {
    if (!Number.isFinite(answer)) throw new Error('submitAnswer: a numeric blind round requires a numeric answer');
  } else if (answer === undefined || answer === null || String(answer).trim() === '') {
    throw new Error('submitAnswer requires a non-empty answer');
  }
  if (findAnswer(blindRound, userId)) {
    throw new Error(`submitAnswer: ${userId} has already submitted an answer to blind round ${blindRoundId}`);
  }
  if (blindRound.maxParticipants !== null && blindRound.answers.length >= blindRound.maxParticipants) {
    throw new Error(`submitAnswer: blind round ${blindRoundId} is full (${blindRound.maxParticipants} participants)`);
  }
  if (typeof settleFn !== 'function') throw new Error('submitAnswer requires a settleFn(legs, meta)');

  await settleFn(
    [{ fromUserId: userId, toUserId: VAGO_HOUSE_ACCOUNT, amount: blindRound.entryAmount, reason: `vago_blind_entry:${blindRoundId}` }],
    { reason: `vago_blind_entry:${blindRoundId}:${userId}` },
  );

  blindRound.answers.push({ userId, answer, submittedAt: now });
  blindRound.pool = round2(blindRound.pool + blindRound.entryAmount);
  return blindRound;
}

// Pure -- no state read beyond the round itself, no money moved. The
// resolver and the leaderboard-style reader both need this, so it is
// computed once rather than inlined twice.
function determineWinners(blindRound) {
  if (blindRound.answers.length === 0) return [];
  if (blindRound.answerType === 'exact') {
    const normalize = (v) => String(v).trim().toLowerCase();
    const target = normalize(blindRound.realAnswer);
    return blindRound.answers.filter((a) => normalize(a.answer) === target);
  }
  // numeric: closest absolute distance, ties share the win.
  const distances = blindRound.answers.map((a) => Math.abs(a.answer - blindRound.realAnswer));
  const minDistance = Math.min(...distances);
  return blindRound.answers.filter((_a, i) => distances[i] === minDistance);
}

// §15's settlement shape, same discipline as `resolveMarket`: claimed
// before a single leg moves (`settleOnce`), so a retried or concurrent
// resolve cannot pay the pool out twice.
async function resolveBlindRound(store, options = {}) {
  const { blindRoundId, realAnswer, settleFn, now = Date.now() } = options;
  const blindRound = findBlindRound(store, blindRoundId);
  if (!blindRound) throw new Error(`resolveBlindRound: no blind round ${blindRoundId}`);
  if (blindRound.status !== 'open') throw new Error(`resolveBlindRound: blind round ${blindRoundId} is not open`);
  if (blindRound.answerType === 'numeric' && !Number.isFinite(realAnswer)) {
    throw new Error('resolveBlindRound: a numeric blind round requires a numeric realAnswer');
  }
  if (blindRound.answerType === 'exact' && (realAnswer === undefined || realAnswer === null)) {
    throw new Error('resolveBlindRound requires a realAnswer');
  }
  if (typeof settleFn !== 'function') throw new Error('resolveBlindRound requires a settleFn(legs, meta)');

  const payouts = [];
  await settleOnce(blindRound, { status: 'resolved', realAnswer, resolvedAt: now }, async () => {
    const winners = determineWinners(blindRound);
    if (winners.length === 0 || blindRound.pool <= 0) return;
    const share = round2(blindRound.pool / winners.length);
    for (const winner of winners) {
      if (share <= 0) continue;
      // eslint-disable-next-line no-await-in-loop
      await settleFn(
        [{ fromUserId: VAGO_HOUSE_ACCOUNT, toUserId: winner.userId, amount: share, reason: `vago_blind_payout:${blindRoundId}:${winner.userId}` }],
        { reason: `vago_blind_payout:${blindRoundId}:${winner.userId}` },
      );
      payouts.push({ userId: winner.userId, payout: share });
    }
  });
  return { blindRound, payouts };
}

function blindRoundView(store, blindRoundId, options = {}) {
  const { now = Date.now() } = options;
  const blindRound = findBlindRound(store, blindRoundId);
  if (!blindRound) return null;
  return {
    ...blindRound,
    locked: isBlindRoundLocked(blindRound, now),
    participantCount: blindRound.answers.length,
    winners: blindRound.status === 'resolved' ? determineWinners(blindRound).map((w) => w.userId) : null,
  };
}

function reseedIds(store) {
  const maxOf = (rows) => rows.reduce((max, r) => (r.id > max ? r.id : max), 0);
  store.nextBlindRoundId = maxOf(store.blindRounds) + 1;
  return { nextBlindRoundId: store.nextBlindRoundId };
}

module.exports = {
  FORMATS,
  ANSWER_TYPES,
  findBlindRound,
  isBlindRoundLocked,
  createBlindRound,
  submitAnswer,
  determineWinners,
  resolveBlindRound,
  blindRoundView,
  reseedIds,
};
