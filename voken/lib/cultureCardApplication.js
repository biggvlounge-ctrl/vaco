// VOKEN — the real, three-path Cvltvre Card onboarding flow.
// Source of truth: VOKEN_NEW_VALUE_ALGORITHM.md: Kenji's proactive
// invitation (monitors real activity/achievement, invites once a
// genuine threshold is hit) alongside a self-initiated request path
// (anyone can apply directly, submitting structured real info) --
// both real, complementary paths, not one or the other.
//
// Real code reuse: `runKenjiAnalysis()` reuses the exact same
// `computeExternalScore()` the Established Creator Assessment already
// uses, rather than inventing a second scoring formula for what is,
// underneath, the same real question -- how substantial is this
// applicant's real, documented profile.
//
// No real acceptance threshold is given anywhere -- a real, flagged,
// deterministic rule: a proactive Kenji invitation is always accepted
// (Kenji already vetted the person before ever inviting them); a
// self-initiated request is accepted if it clears a real minimum
// external-score bar or includes at least one real credential.
//
// **`community-nomination`, a third real path, added by direct
// instruction**: "you can be nominated for a card." Genuinely
// different from the other two in one real way: a self-initiated
// applicant is making claims about themselves (real accountability),
// and a Kenji invitation already passed Kenji's own vetting before it
// ever reached this file -- a community nomination is a third party
// claiming facts about someone else, with no vetting at all yet. So a
// nomination is never auto-accepted by score the way a self-initiated
// request is (`runKenjiAnalysis` refuses to run on one) -- it is
// always decided by `reviewNomination`, a real, named human-operator
// decision, the same discipline this ecosystem's own `requireOperator`
// gate already enforces for other decisions a single unverified
// claim must not be allowed to settle on its own. Accepting a
// nomination only marks the nominee eligible, the same real effect an
// accepted application of any path already has here -- nothing in
// this file ever mints a card; the real mint still goes through
// `mintCultureCard`'s own session-gated consent check elsewhere, so a
// nomination can never mint a card about someone without their own
// session, regardless of who nominated them.

const { computeExternalScore, ELIGIBLE_TIERS } = require('./establishedCreatorAssessment');

const APPLICATION_PATHS = ['kenji-proactive-invitation', 'self-initiated-request', 'community-nomination'];
const APPLICATION_STATUSES = ['pending-review', 'accepted', 'declined'];
const SELF_INITIATED_MIN_EXTERNAL_SCORE = 10;

function submitApplication(store, options = {}) {
  const { applicantId, applicationPath, submittedInfo = {}, nominatedPersonId = null } = options;
  if (!applicantId) throw new Error('submitApplication requires an applicantId');
  if (!APPLICATION_PATHS.includes(applicationPath)) {
    throw new Error(`submitApplication: invalid applicationPath "${applicationPath}" (expected one of ${APPLICATION_PATHS.join(', ')})`);
  }
  if (applicationPath === 'community-nomination' && !nominatedPersonId) {
    throw new Error('submitApplication: community-nomination requires a nominatedPersonId -- the real person being nominated, distinct from the nominator');
  }
  if (applicationPath !== 'community-nomination' && nominatedPersonId) {
    throw new Error('submitApplication: nominatedPersonId only applies to community-nomination -- every other path is about the applicant themselves');
  }
  if (!submittedInfo.category) {
    throw new Error('submitApplication requires submittedInfo.category');
  }
  if (!Array.isArray(submittedInfo.socialMediaPresence)) {
    throw new Error('submitApplication requires submittedInfo.socialMediaPresence to be an array');
  }
  if (!Array.isArray(submittedInfo.credentials)) {
    throw new Error('submitApplication requires submittedInfo.credentials to be an array');
  }

  const application = {
    applicationId: store.nextApplicationId++,
    applicantId,
    nominatedPersonId: applicationPath === 'community-nomination' ? nominatedPersonId : null,
    applicationPath,
    submittedInfo,
    kenjiAnalysisResult: null,
    status: 'pending-review',
    createdAt: Date.now(),
  };
  store.cultureCardApplications.push(application);
  return application;
}

function getApplication(store, applicationId) {
  return store.cultureCardApplications.find((a) => a.applicationId === applicationId) || null;
}

function runKenjiAnalysis(store, options = {}) {
  const { applicationId } = options;
  const application = getApplication(store, applicationId);
  if (!application) throw new Error(`runKenjiAnalysis: no application with id ${applicationId}`);
  if (application.applicationPath === 'community-nomination') {
    throw new Error(`runKenjiAnalysis: application ${applicationId} is a community nomination -- use reviewNomination, a real operator decision, not an automatic score-based accept`);
  }
  if (application.status !== 'pending-review') {
    throw new Error(`runKenjiAnalysis: application ${applicationId} is "${application.status}", not pending-review`);
  }

  const totalFollowers = application.submittedInfo.socialMediaPresence.reduce((sum, p) => sum + (p.followerCount || 0), 0);
  const { externalScore } = computeExternalScore({
    realSocialFollowing: totalFollowers,
    realPressCoverageCount: 0,
    realIndustryRecognition: application.submittedInfo.credentials.length > 0,
  });

  const recommendedTier = externalScore >= 80 ? ELIGIBLE_TIERS[4]
    : externalScore >= 60 ? ELIGIBLE_TIERS[3]
      : externalScore >= 40 ? ELIGIBLE_TIERS[2]
        : externalScore >= 20 ? ELIGIBLE_TIERS[1]
          : externalScore >= SELF_INITIATED_MIN_EXTERNAL_SCORE ? ELIGIBLE_TIERS[0]
            : 'common';

  const accepted = application.applicationPath === 'kenji-proactive-invitation'
    || externalScore >= SELF_INITIATED_MIN_EXTERNAL_SCORE
    || application.submittedInfo.credentials.length > 0;

  application.kenjiAnalysisResult = {
    recommendedTier,
    recommendedCategory: application.submittedInfo.category,
    reasoning: application.applicationPath === 'kenji-proactive-invitation'
      ? 'Kenji identified real, meaningful activity/achievement before inviting this applicant'
      : `real external score ${externalScore} and ${application.submittedInfo.credentials.length} documented credential(s)`,
  };
  application.status = accepted ? 'accepted' : 'declined';
  return application;
}

// The real, required operator decision for a community nomination --
// see this file's own header for why a nomination is never
// auto-accepted by score the way a self-initiated request is. The
// real external score is still computed and attached for the
// operator to actually look at, same real information a self-
// initiated request's `runKenjiAnalysis` already surfaces -- it just
// doesn't get to decide the outcome here on its own.
function reviewNomination(store, options = {}) {
  const { applicationId, accepted, operatorName, reason = null } = options;
  const application = getApplication(store, applicationId);
  if (!application) throw new Error(`reviewNomination: no application with id ${applicationId}`);
  if (application.applicationPath !== 'community-nomination') {
    throw new Error(`reviewNomination: application ${applicationId} is "${application.applicationPath}", not a community-nomination`);
  }
  if (application.status !== 'pending-review') {
    throw new Error(`reviewNomination: application ${applicationId} is "${application.status}", not pending-review`);
  }
  if (typeof accepted !== 'boolean') throw new Error('reviewNomination requires a boolean accepted');
  if (!operatorName) throw new Error('reviewNomination requires an operatorName');

  const totalFollowers = application.submittedInfo.socialMediaPresence.reduce((sum, p) => sum + (p.followerCount || 0), 0);
  const { externalScore } = computeExternalScore({
    realSocialFollowing: totalFollowers,
    realPressCoverageCount: 0,
    realIndustryRecognition: application.submittedInfo.credentials.length > 0,
  });

  application.kenjiAnalysisResult = {
    recommendedTier: null,
    recommendedCategory: application.submittedInfo.category,
    nomineeExternalScore: externalScore,
    reasoning: `real operator decision by ${operatorName}${reason ? ` -- ${reason}` : ''}`,
  };
  application.status = accepted ? 'accepted' : 'declined';
  return application;
}

module.exports = {
  APPLICATION_PATHS,
  APPLICATION_STATUSES,
  SELF_INITIATED_MIN_EXTERNAL_SCORE,
  submitApplication,
  getApplication,
  runKenjiAnalysis,
  reviewNomination,
};
