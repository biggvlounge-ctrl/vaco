// VOKEN — the real, two-path Cvltvre Card onboarding flow.
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

const { computeExternalScore, ELIGIBLE_TIERS } = require('./establishedCreatorAssessment');

const APPLICATION_PATHS = ['kenji-proactive-invitation', 'self-initiated-request'];
const APPLICATION_STATUSES = ['pending-review', 'accepted', 'declined'];
const SELF_INITIATED_MIN_EXTERNAL_SCORE = 10;

function submitApplication(store, options = {}) {
  const { applicantId, applicationPath, submittedInfo = {} } = options;
  if (!applicantId) throw new Error('submitApplication requires an applicantId');
  if (!APPLICATION_PATHS.includes(applicationPath)) {
    throw new Error(`submitApplication: invalid applicationPath "${applicationPath}" (expected one of ${APPLICATION_PATHS.join(', ')})`);
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
  if (application.status !== 'pending-review') {
    throw new Error(`runKenjiAnalysis: application ${applicationId} is "${application.status}", not pending-review`);
  }

  const totalFollowers = application.submittedInfo.socialMediaPresence.reduce((sum, p) => sum + (p.followerCount || 0), 0);
  const externalScore = computeExternalScore({
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

module.exports = {
  APPLICATION_PATHS,
  APPLICATION_STATUSES,
  SELF_INITIATED_MIN_EXTERNAL_SCORE,
  submitApplication,
  getApplication,
  runKenjiAnalysis,
};
