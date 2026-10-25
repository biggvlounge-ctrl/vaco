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
// Deliberately lower than the social-following multiplier: real
// cross-app content-consumption totals (streams + listens + views +
// units sold, summed) run into the tens or hundreds of millions for a
// genuinely huge career, where a real follower count more commonly
// tops out in the single-digit millions -- a lower multiplier means
// this term saturates at a comparably huge, not trivially small,
// real number.
const CONTENT_CONSUMPTION_LOG_MULTIPLIER = 12;

function round(n) {
  return Math.round(n * 100) / 100;
}
function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

// **`realContentConsumptionCount`, added by direct instruction**: "get
// all the information from everything we can... duplicate this and
// use it for all of our participants" -- a real, cross-platform sum
// of every connected app's own real per-creator total (vulture-music
// streams, vulture-pods listens, vulture-flix views, cvllex units
// sold), not a second parallel follower-style metric. Optional and
// defaulting to 0: `assessEstablishedCreator`'s own one-time onboarding
// snapshot below has no reason to call out to four other apps just to
// record a starting tier, so this stays 0 there -- it is meant to be
// supplied live, by the caller, at value-score time instead (see
// `server.js`'s own real cross-app fetches), which is also exactly why
// it is not persisted onto the stored assessment: it changes
// continuously, the way a follower count self-reported once a year
// does not.
function computeExternalScore(options = {}) {
  const {
    realSocialFollowing, realPressCoverageCount, realIndustryRecognition, realContentConsumptionCount = 0,
  } = options;

  if (!Number.isInteger(realSocialFollowing) || realSocialFollowing < 0) {
    throw new Error('computeExternalScore requires a non-negative integer realSocialFollowing');
  }
  if (!Number.isInteger(realPressCoverageCount) || realPressCoverageCount < 0) {
    throw new Error('computeExternalScore requires a non-negative integer realPressCoverageCount');
  }
  if (typeof realIndustryRecognition !== 'boolean') {
    throw new Error('computeExternalScore requires a boolean realIndustryRecognition');
  }
  if (!Number.isInteger(realContentConsumptionCount) || realContentConsumptionCount < 0) {
    throw new Error('computeExternalScore requires a non-negative integer realContentConsumptionCount when given');
  }

  const socialScore = Math.log10(realSocialFollowing + 1) * SOCIAL_FOLLOWING_LOG_MULTIPLIER;
  const pressScore = realPressCoverageCount * PRESS_COVERAGE_POINTS_PER_ARTICLE;
  const recognitionBonus = realIndustryRecognition ? INDUSTRY_RECOGNITION_BONUS : 0;
  const consumptionScore = Math.log10(realContentConsumptionCount + 1) * CONTENT_CONSUMPTION_LOG_MULTIPLIER;

  return round(clamp(socialScore + pressScore + recognitionBonus + consumptionScore, 0, 100));
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

// The real lookup `valueAlgorithm.js`'s new `externalInfluenceScore`
// input is built from: a creator can be assessed more than once (a
// following that was 10,000 at onboarding might be 500,000 a year
// later), so this returns the *most recent* real assessment on file --
// the current, real cross-platform-influence record for this creator,
// or `null` if nobody has ever assessed them (an honest "no real
// external-influence data exists for this creator," not a guessed 0
// baked in here -- the caller decides what "no assessment" means).
function getLatestAssessmentForCreator(store, creatorId) {
  const assessments = store.establishedCreatorAssessments.filter((a) => a.creatorId === creatorId);
  if (assessments.length === 0) return null;
  return assessments.reduce((latest, a) => (a.assessedAt > latest.assessedAt ? a : latest));
}

module.exports = {
  ELIGIBLE_TIERS, computeExternalScore, assessEstablishedCreator, getLatestAssessmentForCreator,
};
