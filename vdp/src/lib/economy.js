// VDP — Economy: a real index that moves with real spending.
//
// Direct instruction (8 Oct 2026): "the economy should continue to
// thrive as far as the owners of the businesses and things like
// that... the economy can go up and down depending on how people are
// spending inside of it." Every other VDP ledger (`resources.js`'s
// exotic values, `jobs.js`'s payroll, `contracts.js`'s rewards) is a
// fixed number regardless of how busy the world actually is -- this
// module is the one real, world-wide measure that moves with real
// VCoin flowing through real purchases (`server.cjs` calls
// `recordSpending` from every real purchase route: homes, land,
// commercial property, ticket fines), and the one thing a business
// owner's own real revenue (`property.js`'s `operateBusiness`) scales
// against, so a thriving world is a literally more profitable one to
// run a business in, not just a flavor number.
//
// `DEFAULT_ECONOMY_BASELINE`, `ECONOMY_WINDOW_MS`, and the index's
// clamp bounds are flagged interpretive constants, the same footing
// `DEFAULT_SECURITY_TIERS`/`DEFAULT_CONTRACT_REWARD` already stand
// on -- no document gives VDP a real spending-to-index formula.

export const DEFAULT_ECONOMY_BASELINE = 500;
export const ECONOMY_WINDOW_MS = 10 * 60 * 1000;
export const MIN_ECONOMY_INDEX = 50;
export const MAX_ECONOMY_INDEX = 200;
export const STARTING_ECONOMY_INDEX = 100;

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

export function createEconomyStore() {
  return { spendingLog: [], index: STARTING_ECONOMY_INDEX };
}

// Every real purchase across this world calls this once, with the
// real VCoin amount that actually moved -- never a second, invented
// "economic activity" score.
export function recordSpending(store, amount, now = Date.now()) {
  if (!Number.isFinite(amount) || amount < 0) {
    throw new Error(`recordSpending requires a non-negative amount, got ${amount}`);
  }
  store.spendingLog.push({ amount, at: now });
  return store.spendingLog[store.spendingLog.length - 1];
}

// The real sum of spending still inside the rolling window -- old
// entries are never deleted (a later caller might want a longer
// window), only filtered out of this read.
export function recentSpending(store, { now = Date.now(), windowMs = ECONOMY_WINDOW_MS } = {}) {
  return store.spendingLog
    .filter((entry) => now - entry.at <= windowMs)
    .reduce((sum, entry) => sum + entry.amount, 0);
}

// Recomputes and stores the real index: recent spending against the
// baseline, as a percentage, clamped so one enormous purchase can't
// send the whole world's economy off a cliff in either direction.
export function updateEconomyIndex(store, {
  now = Date.now(), windowMs = ECONOMY_WINDOW_MS, baseline = DEFAULT_ECONOMY_BASELINE,
} = {}) {
  const spent = recentSpending(store, { now, windowMs });
  const raw = Math.round((spent / baseline) * 100);
  store.index = clamp(raw, MIN_ECONOMY_INDEX, MAX_ECONOMY_INDEX);
  return store.index;
}

// A business owner's real multiplier: 100 (neutral) reads as 1x,
// below/above scales proportionally -- the real mechanism by which
// "the economy can go up and down" actually changes what a business
// owner earns, read by `property.js`'s `operateBusiness`.
export function economyMultiplierFor(index) {
  return index / 100;
}
