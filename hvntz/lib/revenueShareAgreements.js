// HVNTZ — Connected Network Revenue Sharing, §15-18.
// Source: `dev-docs/on-deck/HVNTZ_CONNECTED_NETWORK_FREEZE.md`, scoped
// by its own §40 audit (see `dev-docs/on-deck/README.md`) to the
// narrowest real slice of the single largest confirmed gap in the
// whole repo: every real settlement mechanism anywhere in this
// ecosystem (`hvntz/lib/revenueStack.js`'s own `recordRevenueEvent`,
// `void/lib/marketplace.js`'s courier payouts, VAGO's
// `esportsStaking.js`) is hardcoded to exactly two legs — platform vs.
// one recipient. Nothing supports named per-agreement roles with
// configurable percentages, which is §17's own explicit ask: "Do not
// hard-code one universal percentage. Create configurable
// revenue-sharing agreements."
//
// **Not a second ledger, and not a new execution primitive.** §15's
// own rule: "The existing VACO/VASH/VCoin financial infrastructure
// remains the settlement foundation." V3's real `POST /api/vcoin/
// settle` (`v3/lib/vcoin.js`) already executes an atomic, N-leg
// settlement — nothing here re-implements that. The real gap this
// file closes is narrower and specific: turning a *configurable named-
// role agreement* into the leg amounts `settle` expects, with money
// solvent by construction (every leg sums to exactly the distributed
// total, the same "no money invented or lost" discipline VAGO's
// `predictionMarkets.js` and HVNTZ's own `recordRevenueEvent` already
// hold).
//
// **Scoped deliberately narrow, and widened once, on purpose.** §17
// names nine split shapes (fixed percentages, fixed amounts, tiered
// percentages, performance bonuses, event-specific splits,
// Hunt-specific splits, creator-specific splits, sponsor-funded
// rewards, time-limited agreements). This builds `percentage` and
// `fixed-amount` — the two concrete shapes §17's own worked example
// actually uses — plus time-limited agreements (an optional
// `expiresAt`; `distributeRevenue` refuses to distribute through an
// expired one, the same "computed live, never trusted from a cached
// field" discipline VASH TAP's `currentAssignmentFor` and VAGO's
// `isGroupWagerLocked` already hold), plus, added 9 Oct 2026,
// `tiered-percentage` — a real revenue BAND (§17's own words: "do not
// hard-code one universal percentage"), one set of percentages applied
// to the whole amount depending which band it falls in, not a
// marginal bracket split nobody asked for.
//
// Event-specific, Hunt-specific and creator-specific splits need no
// new split TYPE — `distributeRevenue`'s existing `sourceType`/
// `sourceId` already let an agreement be created and invoked per
// event/Hunt/creator context, which is the real content of those three
// names. Performance bonuses and sponsor-funded rewards are still
// genuinely unbuilt: a bonus leg needs a real metric to trigger on
// (nothing in this app computes one against a threshold yet), and
// sponsor funding needs a real decision about who besides a business's
// own owner may ever be `distributeRevenue`'s `payerId` — both their
// own undertaking, not a detail of this file, same as every other gap
// this session's audits have found — not a silent scope-narrowing, an
// explicit one (see the app's own README).
//
// **An Agreement belongs to a Network, not a floating global config**
// — §17's own worked example is literally "A business can establish:
// Network Agreement," and a Network is already a real HVNTZ business's
// own Hub (`lib/networkConnections.js`). `distributeRevenue`'s payer
// is always the triggering session's own identity (see server.js's
// route), never a body-supplied `payerId` — a business can only ever
// distribute its own money, never direct someone else's.

'use strict';

const { findNetwork } = require('./networkConnections');

const SPLIT_TYPES = ['percentage', 'fixed-amount', 'tiered-percentage'];
const AGREEMENT_STATUSES = ['active', 'archived'];

function findRevenueShareAgreement(store, agreementId) {
  return store.revenueShareAgreements.find((a) => a.id === agreementId) || null;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function validateShares(shares, label, { requirePercentTotal } = {}) {
  if (!Array.isArray(shares) || shares.length === 0) {
    throw new Error(`createRevenueShareAgreement: ${label} requires at least one share`);
  }
  for (const [i, share] of shares.entries()) {
    if (!share || !share.role) throw new Error(`createRevenueShareAgreement: ${label}[${i}] requires a role`);
    if (!share.payeeId) throw new Error(`createRevenueShareAgreement: ${label}[${i}] requires a payeeId`);
    if (!Number.isFinite(share.value) || share.value <= 0) {
      throw new Error(`createRevenueShareAgreement: ${label}[${i}] requires a positive value`);
    }
  }
  if (requirePercentTotal) {
    const totalPercent = round2(shares.reduce((sum, s) => sum + s.value, 0));
    if (totalPercent !== 100) {
      throw new Error(`createRevenueShareAgreement: ${label} percentage shares must sum to exactly 100 (got ${totalPercent})`);
    }
  }
  return shares.map((s) => ({ role: s.role, payeeId: s.payeeId, value: s.value }));
}

// §17's "tiered percentages" -- a real revenue BAND shape ("under
// $1,000/month this split, $1,000 and up that split"), not marginal
// tax-bracket math. `computeSplit` applies ONE tier's percentages to
// the WHOLE `totalAmount`, whichever tier it falls in -- the shape
// every real tiered-commission agreement this file's own worked
// example is modeled on (§17) actually uses, and simpler and more
// legible than splitting one payment across brackets for a benefit
// nobody asked for.
//
// Exactly one tier is unbounded (`upTo: null`) -- the top band -- and
// it is sorted to the end regardless of the order a caller supplied
// the tiers in, so `computeSplit` can always just walk ascending and
// stop at the first tier the amount fits inside.
function validateAndSortTiers(tiers) {
  if (!Array.isArray(tiers) || tiers.length === 0) {
    throw new Error('createRevenueShareAgreement: tiered-percentage requires at least one tier');
  }
  const unbounded = tiers.filter((t) => t.upTo === null || t.upTo === undefined);
  if (unbounded.length !== 1) {
    throw new Error('createRevenueShareAgreement: tiered-percentage requires exactly one unbounded top tier (upTo: null)');
  }
  const bounded = tiers.filter((t) => t.upTo !== null && t.upTo !== undefined);
  for (const [i, tier] of bounded.entries()) {
    if (!Number.isFinite(tier.upTo) || tier.upTo <= 0) {
      throw new Error(`createRevenueShareAgreement: tiers[${i}].upTo must be a positive number, or null for the top tier`);
    }
  }
  const sortedBounded = [...bounded].sort((a, b) => a.upTo - b.upTo);
  const allTiers = [...sortedBounded, unbounded[0]];
  return allTiers.map((tier, i) => ({
    upTo: tier.upTo ?? null,
    shares: validateShares(tier.shares, `tiers[${i}].shares`, { requirePercentTotal: true }),
  }));
}

function createRevenueShareAgreement(store, options = {}) {
  const {
    networkId, name, splitType, shares, tiers, expiresAt = null, now = Date.now(),
  } = options;

  const network = findNetwork(store, networkId);
  if (!network) throw new Error(`createRevenueShareAgreement: no network with id ${networkId}`);
  if (!name) throw new Error('createRevenueShareAgreement requires a name');
  if (!SPLIT_TYPES.includes(splitType)) {
    throw new Error(`createRevenueShareAgreement requires a splitType of ${SPLIT_TYPES.join(', ')}`);
  }
  if (expiresAt !== null) {
    if (!Number.isFinite(expiresAt) || expiresAt <= now) {
      throw new Error('createRevenueShareAgreement: expiresAt must be a timestamp in the future');
    }
  }

  const agreement = {
    id: store.nextRevenueShareAgreementId++,
    networkId,
    name,
    splitType,
    status: 'active',
    expiresAt,
    createdAt: now,
  };

  if (splitType === 'tiered-percentage') {
    agreement.tiers = validateAndSortTiers(tiers);
  } else {
    agreement.shares = validateShares(shares, 'shares', { requirePercentTotal: splitType === 'percentage' });
  }

  store.revenueShareAgreements.push(agreement);
  return agreement;
}

// §17's "time-limited agreements" — computed live from `expiresAt`
// rather than a stored flag that a background job would need to flip,
// same discipline VASH TAP's `currentAssignmentFor` and VAGO's
// `isGroupWagerLocked` already hold for their own time boundaries.
function isAgreementExpired(agreement, now = Date.now()) {
  return agreement.expiresAt !== null && now >= agreement.expiresAt;
}

function archiveRevenueShareAgreement(store, options = {}) {
  const { agreementId, now = Date.now() } = options;
  const agreement = findRevenueShareAgreement(store, agreementId);
  if (!agreement) throw new Error(`archiveRevenueShareAgreement: no agreement ${agreementId}`);
  if (agreement.status === 'archived') throw new Error(`archiveRevenueShareAgreement: agreement ${agreementId} is already archived`);
  agreement.status = 'archived';
  agreement.archivedAt = now;
  return agreement;
}

// **Solvent by construction.** Every share's raw amount is rounded
// individually except the last, whose amount is the exact remainder
// (`totalAmount` minus every other leg) — the same "compute N-1, the
// last absorbs rounding" shape `recordRevenueEvent` already uses for
// its own two-party split, generalized to N parties. The sum of the
// returned legs always equals `totalAmount` to the cent; no money is
// ever invented or lost to rounding.
function splitByPercentage(shares, totalAmount) {
  let allocated = 0;
  return shares.map((s, i) => {
    if (i === shares.length - 1) {
      return { role: s.role, payeeId: s.payeeId, amount: round2(totalAmount - allocated) };
    }
    const amount = round2((totalAmount * s.value) / 100);
    allocated = round2(allocated + amount);
    return { role: s.role, payeeId: s.payeeId, amount };
  });
}

// The band this `totalAmount` falls in, by the same `upTo` ordering
// `validateAndSortTiers` already sorted ascending — first tier whose
// ceiling the amount does not exceed, or the unbounded one at the end.
function tierFor(agreement, totalAmount) {
  return agreement.tiers.find((tier) => tier.upTo === null || totalAmount <= tier.upTo);
}

function computeSplit(agreement, totalAmount) {
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
    throw new Error('computeSplit requires a positive totalAmount');
  }
  const { shares, splitType } = agreement;

  if (splitType === 'fixed-amount') {
    const totalFixed = round2(shares.reduce((sum, s) => sum + s.value, 0));
    if (totalFixed !== round2(totalAmount)) {
      throw new Error(`computeSplit: fixed-amount shares (${totalFixed}) must sum to exactly totalAmount (${round2(totalAmount)})`);
    }
    return shares.map((s) => ({ role: s.role, payeeId: s.payeeId, amount: round2(s.value) }));
  }

  if (splitType === 'tiered-percentage') {
    const tier = tierFor(agreement, totalAmount);
    // Unreachable given `validateAndSortTiers` always keeps exactly one
    // unbounded tier — every amount matches something — but a split
    // function that could silently return nothing for a real payment
    // is worse than one more line of defence.
    if (!tier) throw new Error(`computeSplit: no tier of agreement ${agreement.id} covers amount ${totalAmount}`);
    return splitByPercentage(tier.shares, totalAmount);
  }

  // percentage
  return splitByPercentage(shares, totalAmount);
}

// §16's own attribution ask, kept generic rather than enumerating all
// 13 named dimensions the freeze lists — `sourceType`/`sourceId` is
// the same real, reusable generic-subject pattern the on-deck audit
// already found in this ecosystem (VACA's `subjectType`, this app's
// own `decisionLog`).
async function distributeRevenue(store, options = {}) {
  const {
    agreementId, totalAmount, payerId, sourceType = null, sourceId = null,
    idempotencyKey, settleFn, now = Date.now(),
  } = options;
  const agreement = findRevenueShareAgreement(store, agreementId);
  if (!agreement) throw new Error(`distributeRevenue: no agreement ${agreementId}`);
  if (agreement.status !== 'active') {
    throw new Error(`distributeRevenue: agreement ${agreementId} is not active (status=${agreement.status})`);
  }
  if (isAgreementExpired(agreement, now)) {
    throw new Error(`distributeRevenue: agreement ${agreementId} expired at ${new Date(agreement.expiresAt).toISOString()}`);
  }
  if (!payerId) throw new Error('distributeRevenue requires a payerId');
  // **Required, per distribution, not per agreement.** An audit found
  // the reason below used to be `hvntz_revenue_share:${agreement.id}`
  // alone — the SAME string for every distribution ever made against
  // one agreement, forever. V3's idempotency guard is supposed to 422
  // a reused key whose body differs, but its own fingerprint had an
  // independent bug (see v3/lib/idempotency.js's own header) that made
  // it blind to leg amounts, so a second, genuinely different
  // distribution silently replayed the FIRST one's result instead of
  // moving any money. With that fixed, reusing one key per agreement
  // stops being silently wrong and becomes loudly broken instead — a
  // business could never distribute through the same agreement twice,
  // which defeats §17/§44's own point: this is for RECURRING network
  // revenue. A key per distribution, supplied by the caller the same
  // way VASH TAP's own `/pay` route requires one, is what makes a
  // genuine retry (same key) safe to repeat and a genuine second
  // distribution (a new key) actually go through.
  if (!idempotencyKey) throw new Error('distributeRevenue requires an idempotencyKey');
  if (typeof settleFn !== 'function') throw new Error('distributeRevenue requires settleFn(legs, meta)');

  const legs = computeSplit(agreement, totalAmount);
  const reason = `hvntz_revenue_share:${agreement.id}:${idempotencyKey}`;

  // Never recorded as distributed before the ledger confirms it —
  // the same rule VASH TAP's `payViaTap` and VAGO's group wagers
  // already hold for their own money-moving functions. If settleFn
  // throws (e.g. the payer's own balance can't cover it), nothing
  // below runs and no distribution record exists for money that never
  // actually moved.
  const settlementLegs = legs.map((leg) => ({
    fromUserId: payerId, toUserId: leg.payeeId, amount: leg.amount, reason,
  }));
  const settlementResult = await settleFn(settlementLegs, { reason });

  const distribution = {
    id: store.nextRevenueDistributionId++,
    agreementId: agreement.id,
    networkId: agreement.networkId,
    totalAmount: round2(totalAmount),
    payerId,
    sourceType,
    sourceId,
    idempotencyKey,
    legs,
    settlementId: settlementResult && settlementResult.id !== undefined ? settlementResult.id : null,
    createdAt: now,
  };
  store.revenueDistributions.push(distribution);
  return distribution;
}

function distributionsForNetwork(store, networkId) {
  return store.revenueDistributions.filter((d) => d.networkId === networkId);
}

function agreementsForNetwork(store, networkId) {
  return store.revenueShareAgreements.filter((a) => a.networkId === networkId);
}

// A read view exposing the live-computed `expired` state alongside the
// stored record, so a caller never has to re-derive `isAgreementExpired`
// itself — the same "view carries the computed state" shape
// `networkView`/`groupWagerView` already use elsewhere in this session.
function agreementView(store, agreementId, options = {}) {
  const { now = Date.now() } = options;
  const agreement = findRevenueShareAgreement(store, agreementId);
  if (!agreement) return null;
  return { ...agreement, expired: isAgreementExpired(agreement, now) };
}

module.exports = {
  SPLIT_TYPES,
  AGREEMENT_STATUSES,
  findRevenueShareAgreement,
  createRevenueShareAgreement,
  archiveRevenueShareAgreement,
  isAgreementExpired,
  computeSplit,
  distributeRevenue,
  distributionsForNetwork,
  agreementsForNetwork,
  agreementView,
};
