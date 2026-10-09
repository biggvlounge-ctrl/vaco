// VACO Verified Business Network — Escrow, the real Level 3 capability.
//
// **What the on-deck audit found, and what this closes.** §30's own
// audit (`dev-docs/on-deck/README.md`, "The VACO Verified Business
// Network §30 audit") found the escrow PATTERN real and proven three
// times over — `voidmagic/lib/bookings.js` charges a customer into a
// fixed `VOID_MAGIC_ESCROW_ACCOUNT` at booking time and pays the host
// out later; VAGO's `sportsbook.js` holds a stake in
// `VAGO_HOUSE_ACCOUNT` and releases it on settlement; VOKEN's
// fractional-ownership pool does the same over
// `VOKEN_FRACTIONAL_POOL` — but found no first-class concept behind
// any of them: "every escrow account is just an ordinary V3 userId by
// convention, no held/pending balance state exists in the schema."
// Three apps, three private reinventions, no shared primitive.
//
// This is that primitive, scoped to §30's own narrower finding: "Level
// 3 (Network Business) needs the proven-three-times escrow pattern
// generalized." A business only gets to hold a customer's money in
// trust once it has actually demonstrated real commerce through VACO
// — `passport.level === 'network'` — which is exactly what Level 3
// means and exactly the gate `assessNetworkActivity` already computes
// from V3's own transaction history. Member and Verified businesses
// cannot open a hold; they have not earned the trust this capability
// assumes.
//
// **Not a second ledger.** §1's own rule, same as every other app in
// this ecosystem that touches money: `ESCROW_ACCOUNT` is an ordinary
// V3 userId, moved only through an injected `settleFn`, the same
// pattern `vago/lib/predictionMarkets.js`'s `VAGO_HOUSE_ACCOUNT` and
// `voidmagic/lib/bookings.js`'s `VOID_MAGIC_ESCROW_ACCOUNT` already
// use. What is new here is the HOLD record itself — a real `held` /
// `released` / `refunded` status V3's schema has no concept of today
// — not a new way of moving the money.
//
// **Release and refund are the business's own decision, not an
// operator's.** The three proven precedents all resolve on a
// deterministic trigger the BUSINESS side controls (a booking's start
// time, a match's real result, a pool's close) — none of them needed
// a neutral third party to decide. So this reuses the exact ownership
// check `server.js` already built for `verify`/`network-activity`
// (`requireParamBusinessOwner`, calling HVNTZ to confirm the real
// owner): only the business that opened a hold may release or refund
// it. **A contested dispute — the payer and the business disagreeing
// about what happened — has no arbitration layer here.** That is
// real, separate work (closer to VAGO's operator-gated `resolve`
// shape than to anything this file does), named rather than silently
// assumed away.

'use strict';

const { settleOnce } = require('./settleOnce');
const { findPassport } = require('./passport');

// Not a second wallet -- an ordinary V3 userId, exactly like the three
// precedents this generalizes.
const ESCROW_ACCOUNT = 'vaco-business-network-escrow';
const HOLD_STATUSES = ['held', 'released', 'refunded'];

function findEscrowHold(store, holdId) {
  return store.escrowHolds.find((h) => h.id === holdId) || null;
}

function escrowHoldsForBusiness(store, businessId) {
  return store.escrowHolds.filter((h) => h.businessId === businessId);
}

// §30's own gate: only a Level 3 ("network") business may hold a
// customer's money in trust. `findPassport` is read here rather than
// trusted from a caller -- a business that regressed, or never
// reached Level 3, must not open a hold just because a stale value
// was passed in.
function requireNetworkLevelBusiness(store, businessId) {
  const passport = findPassport(store, businessId);
  if (!passport) {
    throw new Error(`requireNetworkLevelBusiness: business ${businessId} has no Passport at all`);
  }
  if (passport.level !== 'network') {
    throw new Error(
      `requireNetworkLevelBusiness: business ${businessId} is at Passport level `
      + `"${passport.level}", not "network" -- escrow is a Level 3 capability`,
    );
  }
  return passport;
}

// JOIN + FUND, atomically -- the same one-step shape every other real
// money-in path in this ecosystem uses (VAGO's `joinGroupWager`,
// VASH TAP's `payViaTap`): no window where a payer has been charged
// but no hold record exists, or a hold exists for money that never
// actually moved.
async function openEscrowHold(store, options = {}) {
  const {
    businessId, payerId, payeeId, amount, reason = null, settleFn, now = Date.now(),
  } = options;

  if (businessId === undefined || businessId === null) throw new Error('openEscrowHold requires a businessId');
  requireNetworkLevelBusiness(store, businessId);
  if (!payerId) throw new Error('openEscrowHold requires a payerId');
  if (!payeeId) throw new Error('openEscrowHold requires a payeeId');
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('openEscrowHold requires a positive amount');
  if (typeof settleFn !== 'function') throw new Error('openEscrowHold requires a settleFn(legs, meta)');

  const holdReason = `vaco_passport_escrow_open:${businessId}:${payerId}:${now}`;
  await settleFn(
    [{ fromUserId: payerId, toUserId: ESCROW_ACCOUNT, amount, reason: holdReason }],
    { reason: holdReason },
  );

  const hold = {
    id: store.nextEscrowHoldId++,
    businessId,
    payerId,
    payeeId,
    amount,
    reason,
    status: 'held',
    createdAt: now,
    settledAt: null,
  };
  store.escrowHolds.push(hold);
  return hold;
}

// §15's settlement shape, same `settleOnce` claim-before-pay
// discipline `predictionMarkets.js`'s `resolveMarket` and
// `revenueShareAgreements.js`'s `distributeRevenue` already use: the
// terminal status is written before a single leg moves, so a retried
// or concurrent release/refund cannot pay the same hold out twice.
async function releaseEscrowHold(store, options = {}) {
  const { holdId, settleFn, now = Date.now() } = options;
  const hold = findEscrowHold(store, holdId);
  if (!hold) throw new Error(`releaseEscrowHold: no escrow hold ${holdId}`);
  if (hold.status !== 'held') {
    throw new Error(`releaseEscrowHold: hold ${holdId} is not held (status: ${hold.status})`);
  }
  if (typeof settleFn !== 'function') throw new Error('releaseEscrowHold requires a settleFn(legs, meta)');

  await settleOnce(hold, { status: 'released', settledAt: now }, async () => {
    const reason = `vaco_passport_escrow_release:${holdId}`;
    await settleFn(
      [{ fromUserId: ESCROW_ACCOUNT, toUserId: hold.payeeId, amount: hold.amount, reason }],
      { reason },
    );
  });
  return hold;
}

async function refundEscrowHold(store, options = {}) {
  const { holdId, settleFn, now = Date.now() } = options;
  const hold = findEscrowHold(store, holdId);
  if (!hold) throw new Error(`refundEscrowHold: no escrow hold ${holdId}`);
  if (hold.status !== 'held') {
    throw new Error(`refundEscrowHold: hold ${holdId} is not held (status: ${hold.status})`);
  }
  if (typeof settleFn !== 'function') throw new Error('refundEscrowHold requires a settleFn(legs, meta)');

  await settleOnce(hold, { status: 'refunded', settledAt: now }, async () => {
    const reason = `vaco_passport_escrow_refund:${holdId}`;
    await settleFn(
      [{ fromUserId: ESCROW_ACCOUNT, toUserId: hold.payerId, amount: hold.amount, reason }],
      { reason },
    );
  });
  return hold;
}

function reseedIds(store) {
  const maxOf = (rows) => rows.reduce((max, r) => (r.id > max ? r.id : max), 0);
  store.nextEscrowHoldId = maxOf(store.escrowHolds) + 1;
  return { nextEscrowHoldId: store.nextEscrowHoldId };
}

module.exports = {
  ESCROW_ACCOUNT,
  HOLD_STATUSES,
  findEscrowHold,
  escrowHoldsForBusiness,
  requireNetworkLevelBusiness,
  openEscrowHold,
  releaseEscrowHold,
  refundEscrowHold,
  reseedIds,
};
