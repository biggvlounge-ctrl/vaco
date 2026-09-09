// VOID — the two-person rule for licensing-gated verticals.
//
// **What these tests are protecting.** A two-person rule fails in one
// specific way: it becomes a one-person rule that keeps two names. The
// ways that happens are all quiet —
//
//   - the proposer approves their own proposal
//   - the same person under two spellings ('ada' vs 'ada ')
//   - the rule applies to the wrong set of verticals, so the gated ones
//     slip through single-handed
//   - a proposal approved twice, or after withdrawal
//   - the skill gets verified on *propose* rather than on approve, so
//     the second signature is decoration
//
// The last one is the important one and it is not visible from the
// proposal record at all: the proposal looks correctly pending while
// the vertical is already open.
//
// Per `dev-docs/STANDING_INSTRUCTION_TEST_VERIFICATION.md`, each of
// these was watched fail against the specific bug it names.

const test = require('node:test');
const assert = require('node:assert');

const { createVoidStore } = require('../lib/store');
const providerProfiles = require('../lib/providerProfiles');
const {
  requiresTwoPersons, proposeSkillVerification, approveSkillVerification,
  withdrawSkillVerification, getProposal, listPendingProposals,
} = require('../lib/twoPersonVetting');

const NOW = Date.UTC(2026, 7, 27);

function seeded(verticalId = 'cannabisDelivery') {
  const store = createVoidStore();
  providerProfiles.registerProvider(store, {
    providerId: 'p1', displayName: 'Provider One', homeBaseLat: 35.9, homeBaseLng: -84.1,
  });
  providerProfiles.addSkill(store, { providerId: 'p1', verticalId });
  return store;
}

// -- Which verticals the rule covers -------------------------------------

test('the rule covers exactly the licensing-gated verticals', () => {
  // Scoped to the two places a wrong call has consequences outside this
  // ecosystem. Applying it everywhere would get it ignored everywhere.
  assert.strictEqual(requiresTwoPersons('cannabisDelivery'), true);
  assert.strictEqual(requiresTwoPersons('medicalTransportation'), true);

  for (const ordinary of ['transportation', 'petCare', 'freelance', 'childcare', 'security']) {
    assert.strictEqual(requiresTwoPersons(ordinary), false, `${ordinary} must stay one-operator`);
  }
});

test('an ordinary vertical cannot be pushed through the two-person path', () => {
  // Otherwise the proposal queue becomes a way to add ceremony to
  // things that never needed it, and the queue stops meaning anything.
  const store = seeded('petCare');
  assert.throws(
    () => proposeSkillVerification(store, { providerId: 'p1', verticalId: 'petCare', proposedBy: 'ada' }),
    /not licensing-gated/,
  );
});

// -- The rule itself -----------------------------------------------------

test('the proposer may not approve their own proposal', () => {
  const store = seeded();
  const proposal = proposeSkillVerification(store, {
    providerId: 'p1', verticalId: 'cannabisDelivery', proposedBy: 'ada', now: NOW,
  });

  // One operator holding both halves is the single-operator risk with
  // extra bookkeeping — which is worse than no rule, because the record
  // now *looks* like two people signed off.
  assert.throws(
    () => approveSkillVerification(store, { proposalId: proposal.id, approvedBy: 'ada' }),
    /may not also approve/,
  );
  assert.strictEqual(getProposal(store, proposal.id).status, 'pending');
});

test('the same person under a different spelling is still the same person', () => {
  const store = seeded();
  const proposal = proposeSkillVerification(store, {
    providerId: 'p1', verticalId: 'cannabisDelivery', proposedBy: 'ada', now: NOW,
  });
  // Whitespace is the cheapest possible way around a name comparison,
  // and a rule defeated by a trailing space is not a rule.
  assert.throws(
    () => approveSkillVerification(store, { proposalId: proposal.id, approvedBy: '  ada  ' }),
    /may not also approve/,
  );
});

test('a different operator can approve, and the record keeps both names', () => {
  const store = seeded();
  const proposal = proposeSkillVerification(store, {
    providerId: 'p1', verticalId: 'cannabisDelivery', proposedBy: 'ada',
    evidence: { licenceNumber: 'CD-4471', expiresAt: NOW + 31536000000 }, now: NOW,
  });

  const approved = approveSkillVerification(store, {
    proposalId: proposal.id, approvedBy: 'grace', now: NOW + 3600000,
  });

  // Both names, both times, and the evidence the first one acted on.
  // This pair is what a regulator would actually ask to see.
  assert.strictEqual(approved.status, 'approved');
  assert.strictEqual(approved.proposedBy, 'ada');
  assert.strictEqual(approved.approvedBy, 'grace');
  assert.strictEqual(approved.proposedAt, NOW);
  assert.strictEqual(approved.approvedAt, NOW + 3600000);
  assert.strictEqual(approved.evidence.licenceNumber, 'CD-4471');
});

// -- The one that is invisible from the proposal record ------------------

test('proposing does NOT verify the skill — only approval can', () => {
  const store = seeded();
  proposeSkillVerification(store, {
    providerId: 'p1', verticalId: 'cannabisDelivery', proposedBy: 'ada', now: NOW,
  });

  // If the route verified on propose, the proposal would still read
  // "pending" and every assertion above would still pass, while the
  // cannabis vertical was already open on one signature. Asserting on
  // the *skill* rather than the proposal is the only thing that catches
  // it — the same reason settlement tests assert on the money and never
  // on a status.
  const skill = store.providerProfiles
    .find((p) => p.providerId === 'p1').skills
    .find((s) => s.verticalId === 'cannabisDelivery');
  assert.notStrictEqual(skill.status, 'verified',
    'a proposal alone must never open a licensing-gated vertical');
});

// -- Lifecycle -----------------------------------------------------------

test('a proposal cannot be approved twice', () => {
  const store = seeded();
  const proposal = proposeSkillVerification(store, {
    providerId: 'p1', verticalId: 'cannabisDelivery', proposedBy: 'ada', now: NOW,
  });
  approveSkillVerification(store, { proposalId: proposal.id, approvedBy: 'grace' });
  assert.throws(
    () => approveSkillVerification(store, { proposalId: proposal.id, approvedBy: 'hopper' }),
    /already approved/,
  );
});

test('a withdrawn proposal cannot then be approved', () => {
  const store = seeded();
  const proposal = proposeSkillVerification(store, {
    providerId: 'p1', verticalId: 'cannabisDelivery', proposedBy: 'ada', now: NOW,
  });
  withdrawSkillVerification(store, { proposalId: proposal.id, withdrawnBy: 'ada', reason: 'licence expired' });
  assert.throws(
    () => approveSkillVerification(store, { proposalId: proposal.id, approvedBy: 'grace' }),
    /already withdrawn/,
  );
});

test('the proposer may withdraw their own proposal', () => {
  // Withdrawing concentrates no authority — it stops something. Needing
  // a quorum to stop a bad proposal would leave bad proposals open.
  const store = seeded();
  const proposal = proposeSkillVerification(store, {
    providerId: 'p1', verticalId: 'cannabisDelivery', proposedBy: 'ada', now: NOW,
  });
  const withdrawn = withdrawSkillVerification(store, {
    proposalId: proposal.id, withdrawnBy: 'ada', reason: 'wrong provider',
  });
  assert.strictEqual(withdrawn.status, 'withdrawn');
  assert.strictEqual(withdrawn.withdrawnReason, 'wrong provider');
});

test('proposing twice returns the open proposal rather than a second one', () => {
  const store = seeded();
  const first = proposeSkillVerification(store, {
    providerId: 'p1', verticalId: 'cannabisDelivery', proposedBy: 'ada', now: NOW,
  });
  const second = proposeSkillVerification(store, {
    providerId: 'p1', verticalId: 'cannabisDelivery', proposedBy: 'hopper', now: NOW + 1,
  });
  // Otherwise a proposer could open a second proposal and approve the
  // first — two records, one person, rule defeated.
  assert.strictEqual(first.id, second.id);
  assert.strictEqual(listPendingProposals(store).length, 1);
});

// -- Attribution ---------------------------------------------------------

test('a proposal that cannot name its proposer is refused', () => {
  const store = seeded();
  for (const bad of [undefined, '', '   ']) {
    assert.throws(
      () => proposeSkillVerification(store, {
        providerId: 'p1', verticalId: 'cannabisDelivery', proposedBy: bad,
      }),
      /requires a non-empty proposedBy/,
    );
  }
  assert.strictEqual(store.skillVerificationProposals.length, 0);
});

test('an approval that cannot name its approver is refused', () => {
  const store = seeded();
  const proposal = proposeSkillVerification(store, {
    providerId: 'p1', verticalId: 'cannabisDelivery', proposedBy: 'ada', now: NOW,
  });
  assert.throws(
    () => approveSkillVerification(store, { proposalId: proposal.id, approvedBy: '  ' }),
    /requires a non-empty approvedBy/,
  );
  assert.strictEqual(getProposal(store, proposal.id).status, 'pending');
});

test('a proposal requires a provider who has actually claimed the skill', () => {
  const store = seeded();
  assert.throws(
    () => proposeSkillVerification(store, {
      providerId: 'p1', verticalId: 'medicalTransportation', proposedBy: 'ada',
    }),
    /has not claimed/,
  );
  assert.throws(
    () => proposeSkillVerification(store, {
      providerId: 'nobody', verticalId: 'cannabisDelivery', proposedBy: 'ada',
    }),
    /no provider/,
  );
});
