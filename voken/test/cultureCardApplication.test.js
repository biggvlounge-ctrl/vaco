// VOKEN -- the real, three-path Cvltvre Card onboarding flow. Focused
// on the new `community-nomination` path (added by direct
// instruction: "you can be nominated for a card"), with light
// coverage of the two pre-existing paths to confirm nothing broke.
// The failure this file exists to catch: a community nomination
// getting auto-accepted by score the way a self-initiated request
// is -- the real abuse path this path's own design exists to close
// (anyone nominating anyone famous, with nobody ever actually
// deciding to do it).

const test = require('node:test');
const assert = require('node:assert');

const { createVokenStore } = require('../lib/store');
const {
  APPLICATION_PATHS, submitApplication, getApplication, runKenjiAnalysis, reviewNomination,
} = require('../lib/cultureCardApplication');

function baseSubmittedInfo(overrides = {}) {
  return {
    category: 'music',
    socialMediaPresence: [{ platform: 'instagram', followerCount: 500000 }],
    credentials: [],
    ...overrides,
  };
}

test('APPLICATION_PATHS includes the real community-nomination path', () => {
  assert.deepEqual(APPLICATION_PATHS, ['kenji-proactive-invitation', 'self-initiated-request', 'community-nomination']);
});

// -- the two pre-existing paths, lightly re-verified ---------------------

test('a self-initiated request is accepted when it clears the real external-score bar', () => {
  const store = createVokenStore();
  const application = submitApplication(store, {
    applicantId: 'ada', applicationPath: 'self-initiated-request', submittedInfo: baseSubmittedInfo(),
  });
  const analyzed = runKenjiAnalysis(store, { applicationId: application.applicationId });
  assert.equal(analyzed.status, 'accepted');
});

test('a Kenji-proactive-invitation is always accepted, regardless of score', () => {
  const store = createVokenStore();
  const application = submitApplication(store, {
    applicantId: 'ada', applicationPath: 'kenji-proactive-invitation',
    submittedInfo: baseSubmittedInfo({ socialMediaPresence: [] }),
  });
  const analyzed = runKenjiAnalysis(store, { applicationId: application.applicationId });
  assert.equal(analyzed.status, 'accepted');
});

// -- community-nomination: submission ------------------------------------

test('submitApplication requires a nominatedPersonId for community-nomination', () => {
  const store = createVokenStore();
  assert.throws(
    () => submitApplication(store, {
      applicantId: 'ben', applicationPath: 'community-nomination', submittedInfo: baseSubmittedInfo(),
    }),
    /community-nomination requires a nominatedPersonId/,
  );
});

test('submitApplication refuses a nominatedPersonId on any path other than community-nomination', () => {
  const store = createVokenStore();
  assert.throws(
    () => submitApplication(store, {
      applicantId: 'ada', applicationPath: 'self-initiated-request', nominatedPersonId: 'carlos', submittedInfo: baseSubmittedInfo(),
    }),
    /nominatedPersonId only applies to community-nomination/,
  );
});

test('a real community nomination records both the nominator and the nominee, kept distinct', () => {
  const store = createVokenStore();
  const application = submitApplication(store, {
    applicantId: 'ben', applicationPath: 'community-nomination', nominatedPersonId: 'carlos', submittedInfo: baseSubmittedInfo(),
  });
  assert.equal(application.applicantId, 'ben', 'the nominator');
  assert.equal(application.nominatedPersonId, 'carlos', 'the real subject being nominated, not the nominator');
});

test('nominatedPersonId is honestly null on the two paths that are not a nomination', () => {
  const store = createVokenStore();
  const selfInitiated = submitApplication(store, {
    applicantId: 'ada', applicationPath: 'self-initiated-request', submittedInfo: baseSubmittedInfo(),
  });
  assert.equal(selfInitiated.nominatedPersonId, null);
});

// -- community-nomination: never auto-accepted by score ------------------

test('runKenjiAnalysis refuses to run on a community nomination at all', () => {
  const store = createVokenStore();
  const application = submitApplication(store, {
    applicantId: 'ben', applicationPath: 'community-nomination', nominatedPersonId: 'carlos',
    submittedInfo: baseSubmittedInfo({ socialMediaPresence: [{ platform: 'instagram', followerCount: 50000000 }] }),
  });
  assert.throws(
    () => runKenjiAnalysis(store, { applicationId: application.applicationId }),
    /use reviewNomination, a real operator decision/,
  );
  // And it must still be sitting pending-review, not silently decided.
  assert.equal(getApplication(store, application.applicationId).status, 'pending-review');
});

// -- community-nomination: reviewNomination, the real required operator decision --

test('reviewNomination accepts or declines only by the operator\'s own explicit decision, not the nominee\'s score', () => {
  const store = createVokenStore();
  // Even a massive follower count must not auto-accept -- the operator
  // explicitly declines here, and that must be respected.
  const application = submitApplication(store, {
    applicantId: 'ben', applicationPath: 'community-nomination', nominatedPersonId: 'carlos',
    submittedInfo: baseSubmittedInfo({ socialMediaPresence: [{ platform: 'instagram', followerCount: 500000000 }] }),
  });
  const declined = reviewNomination(store, {
    applicationId: application.applicationId, accepted: false, operatorName: 'operator-jane', reason: 'could not verify this is really carlos',
  });
  assert.equal(declined.status, 'declined');
});

test('reviewNomination accepts when the operator explicitly says so', () => {
  const store = createVokenStore();
  const application = submitApplication(store, {
    applicantId: 'ben', applicationPath: 'community-nomination', nominatedPersonId: 'carlos', submittedInfo: baseSubmittedInfo(),
  });
  const accepted = reviewNomination(store, {
    applicationId: application.applicationId, accepted: true, operatorName: 'operator-jane',
  });
  assert.equal(accepted.status, 'accepted');
  assert.match(accepted.kenjiAnalysisResult.reasoning, /real operator decision by operator-jane/);
});

test('reviewNomination still surfaces the nominee\'s real external score for the operator to see, without letting it decide', () => {
  const store = createVokenStore();
  const application = submitApplication(store, {
    applicantId: 'ben', applicationPath: 'community-nomination', nominatedPersonId: 'carlos',
    submittedInfo: baseSubmittedInfo({ socialMediaPresence: [{ platform: 'instagram', followerCount: 2000000 }] }),
  });
  const reviewed = reviewNomination(store, {
    applicationId: application.applicationId, accepted: true, operatorName: 'operator-jane',
  });
  assert.ok(Number.isFinite(reviewed.kenjiAnalysisResult.nomineeExternalScore));
});

test('reviewNomination refuses a non-nomination application', () => {
  const store = createVokenStore();
  const application = submitApplication(store, {
    applicantId: 'ada', applicationPath: 'self-initiated-request', submittedInfo: baseSubmittedInfo(),
  });
  assert.throws(
    () => reviewNomination(store, { applicationId: application.applicationId, accepted: true, operatorName: 'operator-jane' }),
    /not a community-nomination/,
  );
});

test('reviewNomination requires a boolean accepted and a real operatorName', () => {
  const store = createVokenStore();
  const application = submitApplication(store, {
    applicantId: 'ben', applicationPath: 'community-nomination', nominatedPersonId: 'carlos', submittedInfo: baseSubmittedInfo(),
  });
  assert.throws(
    () => reviewNomination(store, { applicationId: application.applicationId, operatorName: 'operator-jane' }),
    /requires a boolean accepted/,
  );
  assert.throws(
    () => reviewNomination(store, { applicationId: application.applicationId, accepted: true }),
    /requires an operatorName/,
  );
});

test('reviewNomination refuses to re-decide an already-decided nomination', () => {
  const store = createVokenStore();
  const application = submitApplication(store, {
    applicantId: 'ben', applicationPath: 'community-nomination', nominatedPersonId: 'carlos', submittedInfo: baseSubmittedInfo(),
  });
  reviewNomination(store, { applicationId: application.applicationId, accepted: true, operatorName: 'operator-jane' });
  assert.throws(
    () => reviewNomination(store, { applicationId: application.applicationId, accepted: false, operatorName: 'operator-jane' }),
    /not pending-review/,
  );
});
