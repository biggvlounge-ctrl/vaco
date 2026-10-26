// VOKEN — the real family-representative claim, by direct instruction:
// "for the people who aren't living, the initial card, I guess you can
// call it like the master card, goes to the family."
//
// `mintCultureCard`'s subject-gets-card-1 guarantee works because the
// subject has a real session to prove they are who they say they are.
// A deceased historic person has no session at all, so the equivalent
// guarantee for their family needs its own real check: anyone could
// otherwise type a name and claim to be a stranger's family. The fix
// mirrors `cultureCardApplication.js`'s own `community-nomination`
// discipline exactly — a third party's unverified claim about someone
// else is never auto-accepted, it is always settled by a real, named
// human-operator decision (`reviewFamilyRepresentativeClaim`). Only
// an *approved* claim can ever receive the master edition; a pending
// or declined one changes nothing about how `mintHistoricCard` mints.
//
// Scoped deliberately to `historicSubjectType === 'person'` only — a
// place, monument, invention, or book has no family to claim it, the
// same real distinction `historicRegistry.js` already draws.

const { getHistoricEntry } = require('./historicRegistry');

const CLAIM_STATUSES = ['pending-review', 'approved', 'declined'];

function submitFamilyRepresentativeClaim(store, options = {}) {
  const { claimantId, historicSlug, relationship, evidence = [] } = options;
  if (!claimantId) throw new Error('submitFamilyRepresentativeClaim requires a claimantId');
  const entry = getHistoricEntry(historicSlug);
  if (!entry) throw new Error(`submitFamilyRepresentativeClaim: no historic entry "${historicSlug}" in the register`);
  if (entry.subjectType !== 'person') {
    throw new Error(`submitFamilyRepresentativeClaim: "${historicSlug}" is a "${entry.subjectType}", not a person -- there is no family to represent`);
  }
  if (!relationship) throw new Error('submitFamilyRepresentativeClaim requires a stated relationship (e.g. "great-granddaughter")');
  if (!Array.isArray(evidence)) throw new Error('submitFamilyRepresentativeClaim requires evidence to be an array');

  const existingApproved = store.familyRepresentativeClaims.find(
    (c) => c.historicSlug === historicSlug && c.status === 'approved',
  );
  if (existingApproved) {
    throw new Error(`submitFamilyRepresentativeClaim: "${historicSlug}" already has an approved family representative (claim ${existingApproved.claimId}) -- the master edition has already gone to a real family claimant`);
  }

  const claim = {
    claimId: store.nextFamilyRepresentativeClaimId++,
    claimantId,
    historicSlug,
    relationship,
    evidence,
    status: 'pending-review',
    reviewedBy: null,
    reviewReason: null,
    createdAt: Date.now(),
  };
  store.familyRepresentativeClaims.push(claim);
  return claim;
}

function getFamilyRepresentativeClaim(store, claimId) {
  return store.familyRepresentativeClaims.find((c) => c.claimId === claimId) || null;
}

// The real, required operator decision -- see this file's own header
// for why a family claim is never auto-accepted. Approving a second
// claim for a slug that already has an approved claimant is refused
// outright: the master edition is a singular guarantee, not something
// two different approved "family" could each hold.
function reviewFamilyRepresentativeClaim(store, options = {}) {
  const { claimId, approved, operatorName, reason = null } = options;
  const claim = getFamilyRepresentativeClaim(store, claimId);
  if (!claim) throw new Error(`reviewFamilyRepresentativeClaim: no claim with id ${claimId}`);
  if (claim.status !== 'pending-review') {
    throw new Error(`reviewFamilyRepresentativeClaim: claim ${claimId} is "${claim.status}", not pending-review`);
  }
  if (typeof approved !== 'boolean') throw new Error('reviewFamilyRepresentativeClaim requires a boolean approved');
  if (!operatorName) throw new Error('reviewFamilyRepresentativeClaim requires an operatorName');

  if (approved) {
    const existingApproved = store.familyRepresentativeClaims.find(
      (c) => c.historicSlug === claim.historicSlug && c.status === 'approved',
    );
    if (existingApproved) {
      throw new Error(`reviewFamilyRepresentativeClaim: "${claim.historicSlug}" already has an approved family representative (claim ${existingApproved.claimId})`);
    }
  }

  claim.status = approved ? 'approved' : 'declined';
  claim.reviewedBy = operatorName;
  claim.reviewReason = reason;
  return claim;
}

// The real lookup `mintHistoricCard` calls: who, if anyone, has an
// operator-approved claim to be this deceased person's family. Returns
// null honestly when nobody has come forward and been approved yet --
// no master edition is fabricated for an owner who was never real.
function getApprovedFamilyRepresentative(store, historicSlug) {
  const claim = store.familyRepresentativeClaims.find(
    (c) => c.historicSlug === historicSlug && c.status === 'approved',
  );
  return claim ? claim.claimantId : null;
}

module.exports = {
  CLAIM_STATUSES,
  submitFamilyRepresentativeClaim,
  getFamilyRepresentativeClaim,
  reviewFamilyRepresentativeClaim,
  getApprovedFamilyRepresentative,
};
