// V3 -- VASH Insurance: small-scale home and vehicle insurance,
// denominated in VCoin, administered the way a real Managing General
// Agent (MGA) administers a policy on behalf of a licensed carrier.
// Confirmed real structure (Milliman): an MGA handles underwriting,
// policy issuance, and claims; the licensed carrier behind it bears
// the real regulatory, financial, and actuarial risk. That split is
// exactly why a company can offer real insurance without itself
// becoming a licensed carrier -- Metromile underwrote as its own
// carrier before its 2022 acquisition by Lemonade, which instead
// operates its own full-stack carriers and reinsures the exposure;
// either real path requires real licensing, named below.
//
// Per direct instruction: "we can cover our vehicles and our
// properties, so we might as well be able to do that for others...
// vehicle insurance, home insurance... at least on a smaller scale."
//
// **What this honestly is, and is not.** Real premiums and real
// claim payouts in VCoin, through V3's own real ledger -- the same
// administrative mechanics a real MGA's own software would need:
// quote, purchase, file a claim, a real reviewer decision, a real
// payout. **It is not, and cannot be, a licensed insurance carrier or
// MGA.** Offering real insurance on a real house or a real vehicle
// requires a real state insurance producer licence and either
// becoming a licensed carrier (reserves, solvency, state rate
// filings) or a real MGA agreement with one. Do not wire a real
// premium or a real payout to this module without that licensing and
// counsel first -- the same rule VASH Mortgage's own header states for
// lending, and the same rule dev-docs/GO_LIVE_DOSSIER.md §2 states for
// VAGO's real-money gambling.

// `transferFn` is injected everywhere money actually moves below, not
// required from `./vcoin` directly -- same reason as VASH Mortgage's
// own header: V3 runs on one of two real ledger backends, and this
// module must settle through whichever one is actually live, not
// always the in-memory store.

const INSURANCE_POLICY_TYPES = ['home', 'vehicle'];
const INSURANCE_POLICY_STATUSES = ['active', 'cancelled'];
const INSURANCE_CLAIM_STATUSES = ['filed', 'approved', 'denied', 'paid'];
// Not a real user account -- the platform's own real VCoin pool every
// real premium pays into and every real claim pays out of. A claim
// can never pay out more than the pool has actually collected in
// premiums: `transfer` below throws "Insufficient VCoin balance" if
// it tries, the same honest failure every other VCoin transfer in
// this ecosystem gets, not a fabricated bottomless pool. (Like any
// first-touched account, `vcoin.js`'s own `STARTING_VCOIN_BALANCE`
// auto-grant gives this pool 1000 VCoin before a single real premium
// is ever paid in -- a pre-existing ecosystem-wide quirk, not
// something invented for this module, and the same 1000 every other
// platform account, such as DREAMS' own, starts with.)
const PLATFORM_INSURANCE_POOL_ACCOUNT = 'vash-insurance-pool';

//: Flagged interpretive, not quoted from any source document or
//: external benchmark -- a simple, named starting rate so a quote is
//: deterministic rather than invented per call. 0.5%/yr of coverage
//: for home sits inside the real, broad range insurers quote
//: (commonly cited as roughly $0.35-0.55 per $100 of coverage
//: annually); 4%/yr for vehicle is a flagged placeholder -- real auto
//: premiums vary far more by driver than any one flat rate can
//: honestly represent.
const ANNUAL_RATE_BY_POLICY_TYPE = { home: 0.005, vehicle: 0.04 };

function round(n) {
  return Math.round(n * 100) / 100;
}

function quotePolicy(options = {}) {
  const { policyType, coverageAmount } = options;
  if (!INSURANCE_POLICY_TYPES.includes(policyType)) {
    throw new Error(`quotePolicy: policyType must be one of ${INSURANCE_POLICY_TYPES.join(', ')}`);
  }
  if (!Number.isFinite(coverageAmount) || coverageAmount <= 0) {
    throw new Error('quotePolicy requires a positive coverageAmount');
  }
  const annualPremium = round(coverageAmount * ANNUAL_RATE_BY_POLICY_TYPE[policyType]);
  return { policyType, coverageAmount, annualPremium, monthlyPremium: round(annualPremium / 12) };
}

// Purchasing a policy charges the real annual premium up front, into
// the real pool account above -- the same reason a real insurer
// collects premiums before it can honestly promise to pay a claim.
async function purchasePolicy(store, options = {}, deps = {}) {
  const {
    policyholderId, policyType, coverageAmount, propertyOrVehicleDescription, now = Date.now(),
  } = options;
  const { transferFn } = deps;
  if (typeof transferFn !== 'function') throw new Error('purchasePolicy requires a transferFn(options)');
  if (!policyholderId) throw new Error('purchasePolicy requires a policyholderId');
  if (!propertyOrVehicleDescription) throw new Error('purchasePolicy requires a propertyOrVehicleDescription');
  const quote = quotePolicy({ policyType, coverageAmount });

  const result = await transferFn({
    fromUserId: policyholderId, toUserId: PLATFORM_INSURANCE_POOL_ACCOUNT, amount: quote.annualPremium,
    reason: `${policyType} insurance premium`, now,
  });

  const policy = {
    id: store.nextInsurancePolicyId++,
    policyholderId,
    policyType,
    coverageAmount,
    propertyOrVehicleDescription,
    annualPremium: quote.annualPremium,
    monthlyPremium: quote.monthlyPremium,
    status: 'active',
    premiumTransactionId: result.transaction.id,
    createdAt: now,
  };
  store.insurancePolicies.push(policy);
  return policy;
}

function getPolicy(store, policyId) {
  return store.insurancePolicies.find((p) => p.id === policyId) || null;
}

function cancelPolicy(store, options = {}) {
  const { policyId, policyholderId, now = Date.now() } = options;
  const policy = getPolicy(store, policyId);
  if (!policy) throw new Error(`cancelPolicy: no policy with id ${policyId}`);
  if (policy.policyholderId !== policyholderId) throw new Error('cancelPolicy: policyholderId does not match this policy');
  if (policy.status !== 'active') throw new Error(`cancelPolicy: policy ${policyId} is "${policy.status}", not "active"`);
  policy.status = 'cancelled';
  policy.cancelledAt = now;
  return policy;
}

function fileClaim(store, options = {}) {
  const {
    policyId, policyholderId, description, amountRequested, now = Date.now(),
  } = options;
  const policy = getPolicy(store, policyId);
  if (!policy) throw new Error(`fileClaim: no policy with id ${policyId}`);
  if (policy.policyholderId !== policyholderId) throw new Error('fileClaim: policyholderId does not match this policy');
  if (policy.status !== 'active') throw new Error(`fileClaim: policy ${policyId} is "${policy.status}", not "active"`);
  if (!description) throw new Error('fileClaim requires a description');
  if (!Number.isFinite(amountRequested) || amountRequested <= 0) {
    throw new Error('fileClaim requires a positive amountRequested');
  }
  if (amountRequested > policy.coverageAmount) {
    throw new Error(`fileClaim: amountRequested ${amountRequested} exceeds the real policy coverage ${policy.coverageAmount}`);
  }

  const claim = {
    id: store.nextInsuranceClaimId++,
    policyId,
    policyholderId,
    description,
    amountRequested,
    status: 'filed',
    amountApproved: null,
    reviewedBy: null,
    reviewNotes: null,
    reviewedAt: null,
    paidAt: null,
    createdAt: now,
  };
  store.insuranceClaims.push(claim);
  return claim;
}

function getClaim(store, claimId) {
  return store.insuranceClaims.find((c) => c.id === claimId) || null;
}

function requireFiled(store, claimId, action) {
  const claim = getClaim(store, claimId);
  if (!claim) throw new Error(`${action}: no claim with id ${claimId}`);
  if (claim.status !== 'filed') throw new Error(`${action}: claim ${claimId} is "${claim.status}", not "filed"`);
  return claim;
}

// The real adjuster decision -- a human/operator call, same posture as
// VASH Mortgage's underwriting and VACA's verification approval.
function approveClaim(store, options = {}) {
  const { claimId, reviewedBy, amountApproved, now = Date.now() } = options;
  const claim = requireFiled(store, claimId, 'approveClaim');
  if (!reviewedBy) throw new Error('approveClaim requires a reviewedBy');
  if (!Number.isFinite(amountApproved) || amountApproved <= 0) {
    throw new Error('approveClaim requires a positive amountApproved');
  }
  if (amountApproved > claim.amountRequested) {
    throw new Error('approveClaim: amountApproved cannot exceed the amount requested');
  }

  claim.status = 'approved';
  claim.amountApproved = amountApproved;
  claim.reviewedBy = reviewedBy;
  claim.reviewedAt = now;
  return claim;
}

function denyClaim(store, options = {}) {
  const { claimId, reviewedBy, reason, now = Date.now() } = options;
  const claim = requireFiled(store, claimId, 'denyClaim');
  if (!reviewedBy) throw new Error('denyClaim requires a reviewedBy');
  if (!reason) throw new Error('denyClaim requires a reason');

  claim.status = 'denied';
  claim.reviewNotes = reason;
  claim.reviewedBy = reviewedBy;
  claim.reviewedAt = now;
  return claim;
}

async function payClaim(store, options = {}, deps = {}) {
  const { claimId, now = Date.now() } = options;
  const { transferFn } = deps;
  if (typeof transferFn !== 'function') throw new Error('payClaim requires a transferFn(options)');
  const claim = getClaim(store, claimId);
  if (!claim) throw new Error(`payClaim: no claim with id ${claimId}`);
  if (claim.status !== 'approved') throw new Error(`payClaim: claim ${claimId} is "${claim.status}", not "approved"`);

  const result = await transferFn({
    fromUserId: PLATFORM_INSURANCE_POOL_ACCOUNT, toUserId: claim.policyholderId, amount: claim.amountApproved,
    reason: `insurance claim #${claimId} payout`, now,
  });

  claim.status = 'paid';
  claim.paidAt = now;
  claim.payoutTransactionId = result.transaction.id;
  return { claim, transaction: result.transaction };
}

module.exports = {
  INSURANCE_POLICY_TYPES,
  INSURANCE_POLICY_STATUSES,
  INSURANCE_CLAIM_STATUSES,
  PLATFORM_INSURANCE_POOL_ACCOUNT,
  ANNUAL_RATE_BY_POLICY_TYPE,
  quotePolicy,
  purchasePolicy,
  getPolicy,
  cancelPolicy,
  fileClaim,
  getClaim,
  approveClaim,
  denyClaim,
  payClaim,
};
