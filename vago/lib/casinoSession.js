// VAGO -- Casino Sessions, the real currency-routing enforcement point.
// Source of truth: VAGO_ARCHITECTURE.md's `CasinoSession { id, userId,
// gameType, currency: "gold-coin" | "vcoin", amoeEntryUsed }` and
// `POST /vago/casino/sessions -- start a session; MUST specify
// currency: gold-coin for sweepstakes-compliant play`.
//
// This is the real, structural proof of the Gold Coin/VCoin
// separation: a `gold-coin` session can only ever debit
// `lib/goldCoin.js`'s local ledger and never calls the injected
// `transferFn`; a `vcoin` session can only ever call `transferFn` (the
// same real, injected pattern VOID and VOKEN use to reach V3 through
// venvs-mock-backend) and never touches the Gold Coin ledger. The two
// branches share no code path -- there is no single function through
// which both currencies flow, which is what makes "genuinely
// non-interchangeable" real rather than asserted.
//
// Game outcomes (live-dealer results, Originals RNG, game-show
// results) were NOT built in this phase -- this phase was the
// currency foundation only, per the doc's own framing of the Gold
// Coin/VCoin split as the structural requirement everything else sits
// on top of. **Originals (Plinko/Mines) outcome logic now built** --
// see `lib/originals.js` and `lib/provablyFair.js`. A session's own
// `roundStarted` flag (below) is the real guard preventing one staked
// session from being spent on more than one round.

const { debitGoldCoin } = require('./goldCoin');

const CASINO_GAME_TYPES = ['live-dealer', 'originals', 'game-show'];
const CASINO_CURRENCIES = ['gold-coin', 'vcoin'];
const VAGO_HOUSE_ACCOUNT = 'vago-house';

// Real, host-configurable table limits for Originals -- closes the
// README's own previously-flagged gap ("current startCasinoSession
// enforces only 'positive,' no per-game ceiling"). Flagged, interpretive
// numbers (neither VAGO doc names an exact figure): a real casino's own
// table limits are always host-set, not a fixed law of the game itself,
// so these are a reasonable, structurally accurate default rather than
// an invented "real" number.
const ORIGINALS_MIN_STAKE = 1;
const ORIGINALS_MAX_STAKE = 10000;

async function startCasinoSession(store, options = {}) {
  const { userId, gameType, currency, stakeAmount, amoeEntryUsed = false, transferFn } = options;

  if (!userId) throw new Error('startCasinoSession requires a userId');
  if (!CASINO_GAME_TYPES.includes(gameType)) {
    throw new Error(`startCasinoSession: invalid gameType "${gameType}" (expected one of ${CASINO_GAME_TYPES.join(', ')})`);
  }
  if (!CASINO_CURRENCIES.includes(currency)) {
    throw new Error(`startCasinoSession: invalid currency "${currency}" (expected one of ${CASINO_CURRENCIES.join(', ')})`);
  }
  if (!Number.isFinite(stakeAmount) || stakeAmount <= 0) {
    throw new Error('startCasinoSession requires a positive stakeAmount');
  }
  if (typeof amoeEntryUsed !== 'boolean') {
    throw new Error('startCasinoSession requires a boolean amoeEntryUsed');
  }
  if (gameType === 'originals' && (stakeAmount < ORIGINALS_MIN_STAKE || stakeAmount > ORIGINALS_MAX_STAKE)) {
    throw new Error(`startCasinoSession: originals stake must be between ${ORIGINALS_MIN_STAKE} and ${ORIGINALS_MAX_STAKE}`);
  }

  if (currency === 'gold-coin') {
    // Real, local-only debit -- never calls transferFn, never reaches V3.
    debitGoldCoin(store, { userId, amount: stakeAmount, reason: 'casino-session-stake' });
  } else {
    // Real VCoin movement -- never touches the Gold Coin ledger.
    if (typeof transferFn !== 'function') {
      throw new Error('startCasinoSession requires a transferFn(fromUserId, toUserId, amount, reason) for vcoin sessions');
    }
    await transferFn(userId, VAGO_HOUSE_ACCOUNT, stakeAmount, 'vago_casino_session_stake');
  }

  const session = {
    id: store.nextCasinoSessionId++,
    userId,
    gameType,
    currency,
    stakeAmount,
    amoeEntryUsed,
    roundStarted: false,
    createdAt: Date.now(),
  };
  store.casinoSessions.push(session);
  return session;
}

function getCasinoSession(store, sessionId) {
  return store.casinoSessions.find((s) => s.id === sessionId) || null;
}

module.exports = {
  CASINO_GAME_TYPES, CASINO_CURRENCIES, VAGO_HOUSE_ACCOUNT,
  ORIGINALS_MIN_STAKE, ORIGINALS_MAX_STAKE,
  startCasinoSession, getCasinoSession,
};
