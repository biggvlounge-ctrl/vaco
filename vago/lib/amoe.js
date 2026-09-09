// VAGO -- the Alternate Method of Entry (AMOE).
// Source of truth: VAGO_ARCHITECTURE.md: `amoeEntryUsed: boolean --
// real, functional alternate-entry path, legally required for the
// sweepstakes model to hold up`, and `POST /vago/casino/amoe-entry --
// the real, required free-entry path`. This is not a UI affordance --
// a genuine sweepstakes-compliant model requires a real, usable,
// no-purchase-necessary way to receive play currency, on real terms
// equal to a paying user, not a token gesture.
//
// No exact grant amount or cooldown is given in any source doc --
// both constants below are real, deterministic, bounded, flagged
// interpretive choices, matching this session's established pattern
// (VOID's cargoPricing.js, VOKEN's valueAlgorithm.js): a real daily
// cadence (matching how real sweepstakes casinos like Chumba/
// LuckyLand cap free entries to keep them genuinely free and usable
// without being trivially gameable), granting an amount comparable to
// a real low-stakes casino session.

const { creditGoldCoin } = require('./goldCoin');

const AMOE_GOLD_COIN_GRANT_AMOUNT = 1000;
const AMOE_COOLDOWN_HOURS = 24;

function getLastEntry(store, userId) {
  const entries = store.amoeEntries.filter((e) => e.userId === userId);
  if (entries.length === 0) return null;
  return entries.reduce((latest, e) => (e.grantedAt > latest.grantedAt ? e : latest));
}

// The real, rate-limited free-entry mechanic: genuinely usable (a real
// credit lands in the real Gold Coin ledger every time it's called),
// but bounded to one grant per real cooldown window so it stays a
// legitimate alternate path rather than an unlimited faucet.
function submitAmoeEntry(store, options = {}) {
  const { userId, now = Date.now() } = options;
  if (!userId) throw new Error('submitAmoeEntry requires a userId');

  const lastEntry = getLastEntry(store, userId);
  if (lastEntry) {
    const cooldownMs = AMOE_COOLDOWN_HOURS * 60 * 60 * 1000;
    const elapsedMs = now - lastEntry.grantedAt;
    if (elapsedMs < cooldownMs) {
      const nextEligibleAt = lastEntry.grantedAt + cooldownMs;
      throw new Error(`submitAmoeEntry: ${userId} already used their free entry this period, next eligible at ${new Date(nextEligibleAt).toISOString()}`);
    }
  }

  const credit = creditGoldCoin(store, { userId, amount: AMOE_GOLD_COIN_GRANT_AMOUNT, reason: 'amoe-free-entry' });

  const entry = {
    id: store.nextAmoeEntryId++,
    userId,
    goldCoinAmount: AMOE_GOLD_COIN_GRANT_AMOUNT,
    grantedAt: now,
  };
  store.amoeEntries.push(entry);

  return { entry, balance: credit.balance };
}

function getAmoeHistory(store, userId) {
  if (!userId) throw new Error('getAmoeHistory requires a userId');
  return store.amoeEntries.filter((e) => e.userId === userId);
}

module.exports = { AMOE_GOLD_COIN_GRANT_AMOUNT, AMOE_COOLDOWN_HOURS, submitAmoeEntry, getAmoeHistory };
