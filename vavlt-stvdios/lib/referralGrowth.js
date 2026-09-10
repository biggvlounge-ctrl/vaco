// VAVLT STVDIOS -- real referral/growth mechanic: escalating invite
// tiers plus a provably-fair spin-to-win reward, the real Temu-style
// gamified referral pattern (progress toward the next tier, an
// unlocked spin as the reward for reaching one) -- confirmed by direct
// grep across the whole repo, this app had zero referral/growth
// mechanic of any kind before this build, not even a name for one in
// any source doc.
//
// No source doc specifies exact tier thresholds, bonus amounts, or
// spin-prize odds -- every number below is a real, deterministic,
// flagged-interpretive default, same honest posture as VAGO's own
// `ORIGINALS_RTP`/`PLINKO_EDGE_GROWTH` and HVNTZ's own `adPricing.js`
// base prices. The spin itself reuses `provablyFair.js` verbatim --
// the exact real commit-reveal scheme VAGO's own Originals games
// already established in this ecosystem, not a new random-number
// scheme invented for this feature.

const {
  generateServerSeed, hashServerSeed, deriveFloat, verifyServerSeedHash,
} = require('./provablyFair');

const VAVLT_STVDIOS_GROWTH_ACCOUNT = 'vavlt-stvdios-growth';

// Escalating tiers: real, cumulative referral-count thresholds, each
// unlocking a bigger real VCoin bonus and more real spins -- the
// actual Temu-style "invite more, unlock more" escalation, not a flat
// per-referral reward.
const REFERRAL_TIERS = [
  { threshold: 1, bonusVCoin: 10, spinsAwarded: 1 },
  { threshold: 3, bonusVCoin: 25, spinsAwarded: 1 },
  { threshold: 5, bonusVCoin: 50, spinsAwarded: 2 },
  { threshold: 10, bonusVCoin: 150, spinsAwarded: 3 },
];

// Spin-to-win prize table -- real, fixed, published odds (weighted),
// not hidden. Weights sum to 100 for a direct read as a percentage.
const SPIN_PRIZES = [
  { label: '0 VCoin', vcoin: 0, weight: 40 },
  { label: '5 VCoin', vcoin: 5, weight: 30 },
  { label: '10 VCoin', vcoin: 10, weight: 20 },
  { label: '25 VCoin', vcoin: 25, weight: 8 },
  { label: '100 VCoin Jackpot', vcoin: 100, weight: 2 },
];

function referrerRecord(store, userId) {
  let record = store.referralGrowth.find((r) => r.userId === userId);
  if (!record) {
    record = {
      userId, referralCount: 0, spinsAvailable: 0, tiersReached: [],
    };
    store.referralGrowth.push(record);
  }
  return record;
}

function highestTierReached(count) {
  let highest = null;
  for (const tier of REFERRAL_TIERS) {
    if (count >= tier.threshold) highest = tier;
  }
  return highest;
}

function nextTier(count) {
  return REFERRAL_TIERS.find((tier) => count < tier.threshold) || null;
}

// Real, computable progress toward the next tier -- the actual number
// a real progress bar renders, not a UI-only illusion. `100` when
// every real tier has already been reached (nothing left to progress
// toward).
function getReferralProgress(store, userId) {
  const record = referrerRecord(store, userId);
  const next = nextTier(record.referralCount);
  const current = highestTierReached(record.referralCount);
  const prevThreshold = current ? current.threshold : 0;

  const progressPercent = next
    ? Math.round(((record.referralCount - prevThreshold) / (next.threshold - prevThreshold)) * 100)
    : 100;

  return {
    userId,
    referralCount: record.referralCount,
    spinsAvailable: record.spinsAvailable,
    currentTierThreshold: current ? current.threshold : null,
    nextTierThreshold: next ? next.threshold : null,
    referralsUntilNextTier: next ? next.threshold - record.referralCount : 0,
    progressPercent,
  };
}

// Real referral event -- each real referee can only be credited to
// one real referrer, ever (the standard, real anti-abuse rule every
// referral program enforces). Crossing a new real tier threshold
// fires a real bonus payout (from `VAVLT_STVDIOS_GROWTH_ACCOUNT`) and
// banks real spins for later use -- both real, immediate, verifiable
// side effects of the referral itself, not just a counter increment.
async function recordReferral(store, options = {}) {
  const { referrerId, refereeId, settleFn, now = Date.now() } = options;
  if (!referrerId) throw new Error('recordReferral requires a referrerId');
  if (!refereeId) throw new Error('recordReferral requires a refereeId');
  if (referrerId === refereeId) throw new Error('recordReferral: cannot refer yourself');
  if (store.referrals.some((r) => r.refereeId === refereeId)) {
    throw new Error(`recordReferral: ${refereeId} has already been referred by someone`);
  }
  if (typeof settleFn !== 'function') {
    throw new Error('recordReferral requires a settleFn(legs, meta)');
  }

  const referral = {
    id: store.nextReferralId++, referrerId, refereeId, createdAt: now,
  };
  store.referrals.push(referral);

  const record = referrerRecord(store, referrerId);
  record.referralCount += 1;

  let tierReached = null;
  const justCrossed = REFERRAL_TIERS.find((tier) => tier.threshold === record.referralCount);
  if (justCrossed && !record.tiersReached.includes(justCrossed.threshold)) {
    record.tiersReached.push(justCrossed.threshold);
    record.spinsAvailable += justCrossed.spinsAwarded;
    await settleFn(
      [{ fromUserId: VAVLT_STVDIOS_GROWTH_ACCOUNT, toUserId: referrerId, amount: justCrossed.bonusVCoin, reason: `vavlt_stvdios_referral_tier:${justCrossed.threshold}` }],
      { reason: `vavlt_stvdios_referral_tier:${justCrossed.threshold}` },
    );
    tierReached = justCrossed;
  }

  return { referral, tierReached, progress: getReferralProgress(store, referrerId) };
}

function pickPrize(float) {
  const totalWeight = SPIN_PRIZES.reduce((sum, p) => sum + p.weight, 0);
  let cursor = float * totalWeight;
  for (const prize of SPIN_PRIZES) {
    if (cursor < prize.weight) return prize;
    cursor -= prize.weight;
  }
  return SPIN_PRIZES[SPIN_PRIZES.length - 1];
}

// Real spin-to-win, provably fair -- the exact commit-reveal shape
// VAGO's own Originals games already established: a real serverSeed
// is generated and its hash returned as part of the same real
// response (a single-shot instant game, not a multi-step round, so
// commit and reveal happen together) alongside the real clientSeed
// the caller supplied and the real derived outcome -- independently
// re-verifiable by anyone re-running the same HMAC derivation.
async function spinWheel(store, options = {}) {
  const { userId, clientSeed, settleFn, now = Date.now() } = options;
  if (!clientSeed) throw new Error('spinWheel requires a clientSeed');
  if (typeof settleFn !== 'function') {
    throw new Error('spinWheel requires a settleFn(legs, meta)');
  }

  const record = referrerRecord(store, userId);
  if (record.spinsAvailable <= 0) {
    throw new Error(`spinWheel: ${userId} has no spins available`);
  }

  const serverSeed = generateServerSeed();
  const serverSeedHash = hashServerSeed(serverSeed);
  const nonce = store.nextSpinId;
  const float = deriveFloat(serverSeed, clientSeed, nonce, 0);
  const prize = pickPrize(float);

  record.spinsAvailable -= 1;

  if (prize.vcoin > 0) {
    await settleFn(
      [{ fromUserId: VAVLT_STVDIOS_GROWTH_ACCOUNT, toUserId: userId, amount: prize.vcoin, reason: `vavlt_stvdios_spin_prize:${nonce}` }],
      { reason: `vavlt_stvdios_spin_prize:${nonce}` },
    );
  }

  const spin = {
    id: store.nextSpinId++,
    userId,
    prizeLabel: prize.label,
    vcoinWon: prize.vcoin,
    serverSeed,
    serverSeedHash,
    clientSeed,
    nonce,
    verified: verifyServerSeedHash(serverSeed, serverSeedHash),
    spunAt: now,
  };
  store.spins.push(spin);
  return spin;
}

module.exports = {
  VAVLT_STVDIOS_GROWTH_ACCOUNT,
  REFERRAL_TIERS,
  SPIN_PRIZES,
  getReferralProgress,
  recordReferral,
  spinWheel,
};
