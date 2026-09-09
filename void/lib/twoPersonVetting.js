// VOID — the two-person rule, for licensing-gated verticals only.
//
// **Why only two verticals.** `cannabisDelivery` and
// `medicalTransportation` are the two places in this ecosystem where a
// wrong decision has consequences *outside* it — a regulator, a
// licence, a vulnerable passenger. Everything else in group 2 is
// somebody losing money inside a system we control, which is bad and
// is recoverable. That difference is the whole justification, and it is
// why this deliberately does not apply to settling a game or grading a
// bet: a two-person rule everywhere would be ignored everywhere.
//
// **The cost, stated plainly.** Verification of these two verticals
// stalls whenever only one operator is available. That is accepted:
// a stalled onboarding is a delay, and a wrongly-opened cannabis
// vertical is a licensing problem somebody else adjudicates.
//
// **Why a proposal rather than a flag.** The rule is not "two
// credentials on one request" — that is one person with two
// credentials, which is exactly the situation this exists to prevent.
// It is two *acts*, separated in the record: one operator proposes with
// their evidence, a different operator approves. vaco-audit is
// append-only, so those are naturally two rows, and the pair is what a
// regulator would actually want to read.
//
// See `dev-docs/OPERATOR_ROLES_SCOPE.md` §3.4.

const { VERTICALS } = require('./verticals');

class TwoPersonError extends Error {}

// Derived from the vertical definitions rather than restated here. A
// third licensing-gated vertical added to verticals.js is covered by
// this rule automatically, which is the correct default: the failure
// to avoid is a gated vertical that quietly is not covered.
function requiresTwoPersons(verticalId) {
  const vertical = VERTICALS[verticalId];
  if (!vertical) throw new TwoPersonError(`unknown verticalId "${verticalId}"`);
  return vertical.licensingGated === true;
}

const PROPOSAL_STATUSES = ['pending', 'approved', 'withdrawn'];

// Step one. The proposing operator records what they saw -- a licence
// number, an expiry, whatever the evidence was -- and nothing is
// verified yet.
function proposeSkillVerification(store, options = {}) {
  const a = 'proposeSkillVerification';
  const { providerId, verticalId, proposedBy, evidence = {}, now = Date.now() } = options;

  if (!providerId) throw new TwoPersonError(`${a} requires a providerId`);
  if (!requiresTwoPersons(verticalId)) {
    throw new TwoPersonError(`${a}: "${verticalId}" is not licensing-gated -- verify it directly`);
  }
  if (typeof proposedBy !== 'string' || proposedBy.trim() === '') {
    throw new TwoPersonError(`${a} requires a non-empty proposedBy`);
  }

  const profile = store.providerProfiles.find((p) => p.providerId === providerId);
  if (!profile) throw new TwoPersonError(`${a}: no provider "${providerId}"`);
  if (!profile.skills.some((s) => s.verticalId === verticalId)) {
    throw new TwoPersonError(`${a}: "${providerId}" has not claimed "${verticalId}"`);
  }

  const open = store.skillVerificationProposals.find(
    (p) => p.providerId === providerId && p.verticalId === verticalId && p.status === 'pending',
  );
  if (open) return open;

  const proposal = {
    id: store.nextSkillProposalId++,
    providerId,
    verticalId,
    proposedBy: proposedBy.trim(),
    evidence,
    proposedAt: now,
    status: 'pending',
    approvedBy: null,
    approvedAt: null,
  };
  store.skillVerificationProposals.push(proposal);
  return proposal;
}

// Step two, and the line the whole mechanism rests on: **a different
// person**. An approver who is the proposer is one operator doing both
// halves, which is the single-operator risk with extra bookkeeping.
//
// Compared as strings on purpose -- the proposer's name arrives from a
// stored record and the approver's from a live verification, and an
// approval that slipped through on a type mismatch would defeat the
// rule while every test above still passed.
function approveSkillVerification(store, options = {}) {
  const a = 'approveSkillVerification';
  const { proposalId, approvedBy, now = Date.now() } = options;

  if (typeof approvedBy !== 'string' || approvedBy.trim() === '') {
    throw new TwoPersonError(`${a} requires a non-empty approvedBy`);
  }
  const proposal = store.skillVerificationProposals.find((p) => p.id === proposalId);
  if (!proposal) throw new TwoPersonError(`${a}: no proposal with id ${proposalId}`);
  if (proposal.status !== 'pending') {
    throw new TwoPersonError(`${a}: proposal ${proposalId} is already ${proposal.status}`);
  }
  if (String(proposal.proposedBy) === String(approvedBy).trim()) {
    throw new TwoPersonError(
      `${a}: "${approvedBy}" proposed this verification and may not also approve it -- `
      + 'a licensing-gated vertical requires two different operators',
    );
  }

  proposal.status = 'approved';
  proposal.approvedBy = String(approvedBy).trim();
  proposal.approvedAt = now;
  return proposal;
}

// Withdrawal, for a proposal that should not proceed. The proposer may
// withdraw their own -- unlike approving it, withdrawing concentrates
// no authority, and requiring a second person to *stop* something would
// mean bad proposals sit open waiting for a quorum.
function withdrawSkillVerification(store, options = {}) {
  const a = 'withdrawSkillVerification';
  const { proposalId, withdrawnBy, reason = null, now = Date.now() } = options;

  if (typeof withdrawnBy !== 'string' || withdrawnBy.trim() === '') {
    throw new TwoPersonError(`${a} requires a non-empty withdrawnBy`);
  }
  const proposal = store.skillVerificationProposals.find((p) => p.id === proposalId);
  if (!proposal) throw new TwoPersonError(`${a}: no proposal with id ${proposalId}`);
  if (proposal.status !== 'pending') {
    throw new TwoPersonError(`${a}: proposal ${proposalId} is already ${proposal.status}`);
  }

  proposal.status = 'withdrawn';
  proposal.withdrawnBy = String(withdrawnBy).trim();
  proposal.withdrawnReason = reason;
  proposal.withdrawnAt = now;
  return proposal;
}

function getProposal(store, proposalId) {
  return store.skillVerificationProposals.find((p) => p.id === proposalId) || null;
}

function listPendingProposals(store) {
  return store.skillVerificationProposals.filter((p) => p.status === 'pending');
}

module.exports = {
  TwoPersonError,
  PROPOSAL_STATUSES,
  requiresTwoPersons,
  proposeSkillVerification,
  approveSkillVerification,
  withdrawSkillVerification,
  getProposal,
  listPendingProposals,
};
