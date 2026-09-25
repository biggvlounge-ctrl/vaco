// VACO Verified Business Network — Business Passport, Levels 1-3.
//
// Scope: the narrowest real slice of
// `dev-docs/on-deck/VACO_VERIFIED_BUSINESS_NETWORK_FREEZE.md`, per its
// own §30 mandatory audit (see `dev-docs/on-deck/README.md`, "The VACO
// Verified Business Network §30 audit"). Builds ONLY on infrastructure
// the audit confirmed real: VACA identity verification (already
// generic — `subjectType` is a free-form string, a business just needs
// a real caller to use it), HVNTZ business records, and V3's real
// ledger. The audit found no substrate for Levels 4-5 (tokenization,
// tokenized assets), multi-tenant employee roles, business-distinct
// wallets, community treasuries, or a developer portal/SDK/VIG — those
// are each their own undertaking, not a detail of this one.
//
// **Not a second business registry.** §1's own rule: "do not duplicate
// existing VACO systems." A Passport references a real HVNTZ
// `businessId`, verified through an injected `businessFetchFn` rather
// than assumed — the same convention VASH TAP's `registerTap` already
// established for the identical reason.
//
// **Not a second identity system.** VACA's own `subjectType` field is
// never validated against an enum (confirmed in the audit) — this uses
// `subjectType: 'business'` against the real, already-generic VACA
// verification flow, not a parallel one.
//
// **Not a second ledger, and not a credit score.** §4's own rule: "Do
// NOT create an arbitrary subjective credit score... track objective
// network activity." Level 3 ("Network Business... actively conducts
// commerce") is assessed by reading V3's own real transaction history
// for the business's current owner — never a stored duplicate, never a
// derived rating, just a count and a sum of what V3 already recorded.

'use strict';

// §2's own five-tier list, narrowed to the three levels resting on
// real infrastructure. Levels 4-5 (TOKENIZED BUSINESS, TOKENIZED
// ASSETS) require VOKEN's mint/classify/issue/retire pipeline and
// legal/compliance review this ecosystem does not have — building
// toward them now would be inventing rather than reusing.
const NETWORK_LEVELS = ['member', 'verified', 'network'];

function createPassportStore() {
  return {
    passports: [],
    nextPassportId: 1,
  };
}

function findPassport(store, businessId) {
  return store.passports.find((p) => p.businessId === businessId) || null;
}

// **One Passport per business, and it is never recreated.** §3's own
// rule: "Businesses must NOT have to recreate their identity, wallet,
// history or account when advancing levels." registerPassport is the
// only place a Passport is created; every later action advances the
// same record's `level` field in place.
async function registerPassport(store, options = {}) {
  const { businessId, businessFetchFn = null, now = Date.now() } = options;

  if (businessId === undefined || businessId === null) {
    throw new Error('registerPassport requires a businessId');
  }
  if (typeof businessFetchFn !== 'function') {
    throw new Error('registerPassport requires businessFetchFn(businessId)');
  }
  const business = await businessFetchFn(businessId);
  if (!business) throw new Error(`registerPassport: no business with id ${businessId}`);

  if (findPassport(store, businessId)) {
    throw new Error(`registerPassport: business ${businessId} already has a Passport`);
  }

  const passport = {
    id: store.nextPassportId++,
    businessId,
    level: 'member',
    verifiedAt: null,
    networkActivity: null,
    createdAt: now,
    updatedAt: now,
  };
  store.passports.push(passport);
  return passport;
}

// **Level 1 → 2, Verified Business.** VACA must actually confirm
// `verified: true` — a business cannot self-declare its way past this,
// the same "resolution identifies, VACA/VASH authorizes" boundary
// VASH TAP's own payment flow holds to. Idempotent: re-verifying an
// already-verified Passport just refreshes `verifiedAt` rather than
// erroring, since a real KYC/attestation status can lapse and be
// re-confirmed.
async function verifyPassport(store, options = {}) {
  const { businessId, identityFetchFn, now = Date.now() } = options;
  if (typeof identityFetchFn !== 'function') {
    throw new Error('verifyPassport requires identityFetchFn(subjectType, subjectId)');
  }

  const passport = findPassport(store, businessId);
  if (!passport) throw new Error(`verifyPassport: no Passport for business ${businessId}`);

  const status = await identityFetchFn('business', businessId);
  if (!status || !status.verified) {
    throw new Error(`verifyPassport: business ${businessId} is not VACA-verified`);
  }

  if (passport.level === 'member') passport.level = 'verified';
  passport.verifiedAt = now;
  passport.updatedAt = now;
  return passport;
}

// **Level 2 → 3, Network Business.** §2's own definition: "the
// verified business actively conducts commerce through VACO." Assessed
// by reading V3's real transaction history for the business's current
// owner — `transactionsFetchFn` returns the same records
// `GET /api/vcoin/transactions/:userId` already serves, never a second
// copy. §4's rule against a subjective score is why this stops at
// count/volume/dates rather than computing any kind of rating.
async function assessNetworkActivity(store, options = {}) {
  const { businessId, transactionsFetchFn, now = Date.now() } = options;
  if (typeof transactionsFetchFn !== 'function') {
    throw new Error('assessNetworkActivity requires transactionsFetchFn(ownerId)');
  }

  const passport = findPassport(store, businessId);
  if (!passport) throw new Error(`assessNetworkActivity: no Passport for business ${businessId}`);
  if (passport.level === 'member') {
    throw new Error(`assessNetworkActivity: business ${businessId} is not yet Verified — Level 2 comes before Level 3`);
  }

  const transactions = await transactionsFetchFn();
  const timestamps = transactions.map((t) => t.timestamp).filter((t) => Number.isFinite(t));
  const summary = {
    transactionCount: transactions.length,
    totalVolume: Math.round(transactions.reduce((sum, t) => sum + (Number(t.amount) || 0), 0) * 100) / 100,
    firstTransactionAt: timestamps.length ? Math.min(...timestamps) : null,
    lastTransactionAt: timestamps.length ? Math.max(...timestamps) : null,
  };

  passport.networkActivity = summary;
  if (summary.transactionCount > 0) passport.level = 'network';
  passport.updatedAt = now;
  return passport;
}

function reseedIds(store) {
  const maxOf = (rows) => rows.reduce((max, r) => (r.id > max ? r.id : max), 0);
  store.nextPassportId = maxOf(store.passports) + 1;
  return { nextPassportId: store.nextPassportId };
}

module.exports = {
  NETWORK_LEVELS,
  createPassportStore,
  findPassport,
  registerPassport,
  verifyPassport,
  assessNetworkActivity,
  reseedIds,
};
