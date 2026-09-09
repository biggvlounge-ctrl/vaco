// VOKEN — Established Creator Assessment.
// Source of truth: VOKEN_NEW_VALUE_ALGORITHM.md: someone with genuine
// existing status shouldn't be treated as a blank-slate rookie when
// they join, but also shouldn't be allowed to self-declare an
// inflated value -- the system looks at real, already-public external
// metrics to calibrate a fair, defensible starting tier.
//
// No exact formula or tier-mapping is given anywhere -- a real,
// flagged, log-scale formula below (matching the same discipline as
// valueAlgorithm.js), and the resulting tier is always drawn from the
// upper five of the seven RARITY_TIERS -- never `common` (the doc's
// own "not a rookie designation" requirement, and never `1-of-1`,
// since that tier is about a card's own print run, not a person's
// fame).

const { RARITY_TIERS } = require('./cardTypes');

const SOCIAL_FOLLOWING_LOG_MULTIPLIER = 15;
const PRESS_COVERAGE_POINTS_PER_ARTICLE = 5;
const INDUSTRY_RECOGNITION_BONUS = 20;

function round(n) {
  return Math.round(n * 100) / 100;
}
function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function computeExternalScore(options = {}) {
  const { realSocialFollowing, realPressCoverageCount, realIndustryRecognition } = options;

  if (!Number.isInteger(realSocialFollowing) || realSocialFollowing < 0) {
    throw new Error('computeExternalScore requires a non-negative integer realSocialFollowing');
  }
  if (!Number.isInteger(realPressCoverageCount) || realPressCoverageCount < 0) {
    throw new Error('computeExternalScore requires a non-negative integer realPressCoverageCount');
  }
  if (typeof realIndustryRecognition !== 'boolean') {
    throw new Error('computeExternalScore requires a boolean realIndustryRecognition');
  }

  const socialScore = Math.log10(realSocialFollowing + 1) * SOCIAL_FOLLOWING_LOG_MULTIPLIER;
  const pressScore = realPressCoverageCount * PRESS_COVERAGE_POINTS_PER_ARTICLE;
  const recognitionBonus = realIndustryRecognition ? INDUSTRY_RECOGNITION_BONUS : 0;

  return round(clamp(socialScore + pressScore + recognitionBonus, 0, 100));
}

// Upper five real tiers only -- never 'common' (not a blank-slate
// rookie) and never '1-of-1' (a card-scarcity property, not a fame
// tier).
const ELIGIBLE_TIERS = RARITY_TIERS.filter((t) => t !== 'common' && t !== '1-of-1');

function assessEstablishedCreator(store, options = {}) {
  const { creatorId, realSocialFollowing, realPressCoverageCount, realIndustryRecognition } = options;
  if (!creatorId) throw new Error('assessEstablishedCreator requires a creatorId');

  const externalScore = computeExternalScore({ realSocialFollowing, realPressCoverageCount, realIndustryRecognition });

  // ELIGIBLE_TIERS = ['uncommon', 'rare', 'epic', 'legendary', 'mythic']
  let suggestedStartingTier;
  if (externalScore >= 80) suggestedStartingTier = ELIGIBLE_TIERS[4]; // mythic
  else if (externalScore >= 60) suggestedStartingTier = ELIGIBLE_TIERS[3]; // legendary
  else if (externalScore >= 40) suggestedStartingTier = ELIGIBLE_TIERS[2]; // epic
  else if (externalScore >= 20) suggestedStartingTier = ELIGIBLE_TIERS[1]; // rare
  else suggestedStartingTier = ELIGIBLE_TIERS[0]; // uncommon

  const assessment = {
    creatorId,
    existingExternalMetrics: { realSocialFollowing, realPressCoverageCount, realIndustryRecognition },
    externalScore,
    suggestedStartingTier,
    assessedAt: Date.now(),
  };
  store.establishedCreatorAssessments.push(assessment);
  return assessment;
}

module.exports = { ELIGIBLE_TIERS, computeExternalScore, assessEstablishedCreator };
