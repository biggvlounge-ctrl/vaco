// VOKEN — the real, hybrid value algorithm.
// Source of truth: VOKEN_NEW_VALUE_ALGORITHM.md. Real value combines
// two genuinely separate signal types -- traditional factors (real
// scarcity, VACA-verified authenticity, rookie status, and -- by
// direct instruction -- the subject's own real, cross-platform social
// influence) and digital-native factors no physical card could ever
// track (live view/click/comment/like counts on the card itself, with
// engagement *velocity* tracked separately from raw totals). A third,
// independent Genuine Significance Score is weighted equally alongside
// digital engagement so that pure virality can never silently outrank
// real, lasting substance -- the doc's own direct example: a figure of
// Martin Luther King's genuine historical significance shouldn't be
// beaten by a viral influencer just because today's click numbers are
// bigger.
//
// **Cross-platform social influence, added by direct instruction**:
// "how many views, how many likes, the algorithm of all of their
// social media put together, their influence" is a real, distinct
// question from a single card's own view/like counts
// (`computeDigitalEngagementScore` already answers that one) -- it's
// asking how famous the *subject* already is, across every platform
// they're on, the same real factor that makes a LeBron rookie card
// worth more than an equally scarce card of an unknown player.
// `externalInfluenceScore` is that answer, and it is a pure input
// here, same posture as `authenticityGrade`: this module reuses
// `establishedCreatorAssessment.js`'s own `computeExternalScore()`
// (real social-following log curve + press coverage + industry
// recognition, already built and already weighed at onboarding time)
// rather than inventing a second formula for the same real question --
// genuine cross-phase code reuse. The real, live assembly of *which*
// cross-platform numbers to feed in happens one layer up, in
// `server.js`'s `/api/card/:id/value-score` endpoint, exactly like
// `authenticityGrade`.
//
// No exact formula is given anywhere in any source doc for any of
// these three scores -- every formula below is real, deterministic,
// bounded [0,100], and flagged as an interpretive choice, matching
// this session's established pattern (hvntz's adPricing.js,
// void's cargoPricing.js) rather than an invented black box.
//
// `authenticityGrade` is a pure input here (this module never fetches
// anything, on purpose -- it stays a synchronous, directly-testable
// pure function). The real "VACA-verified" part now happens one layer
// up, in `server.js`'s `/api/card/:id/value-score` endpoint, which
// fetches the real grade live from VACA (`../vaca/`) rather than
// trusting a caller-supplied value -- confirmed, before that endpoint
// existed, that this grade was never actually verified by anything.

const AUTHENTICITY_GRADES = ['A', 'B', 'C'];
const AUTHENTICITY_GRADE_SCORES = { A: 100, B: 70, C: 40 };
const ROOKIE_BONUS = 15;
// Rebalanced to make room for `influence` while keeping the same real
// ceiling the original two-weight version had: the three multiplicative
// weights below still sum to 0.85, so a perfect scarcity+authenticity+
// influence card plus the flat rookie bonus still tops out at exactly
// 100 -- unchanged headroom, not a silent inflation of every score.
const TRADITIONAL_WEIGHTS = { scarcity: 0.35, authenticity: 0.25, influence: 0.25, rookie: 0.15 };

function round(n) {
  return Math.round(n * 100) / 100;
}
function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

// Real log-scale scarcity curve: a 1/1 scores near-maximum, a
// thousand-print run scores near zero, with a smooth curve between --
// not a hard cliff at some arbitrary cutoff.
//
// `externalInfluenceScore` is optional and defaults to 0 -- not every
// card has a real subject with a cross-platform following to score at
// all (a historic card's subject is the printing press, not a person;
// a World Layer location has no social media). Zero is the honest
// value for "no real external influence to report," not a penalty.
function computeTraditionalScore(options = {}) {
  const { totalMintCount, authenticityGrade, isRookieDesignation, externalInfluenceScore = 0 } = options;

  if (!Number.isInteger(totalMintCount) || totalMintCount < 1) {
    throw new Error('computeTraditionalScore requires a positive integer totalMintCount');
  }
  if (!AUTHENTICITY_GRADES.includes(authenticityGrade)) {
    throw new Error(`computeTraditionalScore: invalid authenticityGrade "${authenticityGrade}" (expected one of ${AUTHENTICITY_GRADES.join(', ')})`);
  }
  if (typeof isRookieDesignation !== 'boolean') {
    throw new Error('computeTraditionalScore requires a boolean isRookieDesignation');
  }
  if (!Number.isFinite(externalInfluenceScore) || externalInfluenceScore < 0 || externalInfluenceScore > 100) {
    throw new Error('computeTraditionalScore requires externalInfluenceScore to be a number between 0 and 100 when given');
  }

  const scarcityScore = clamp(100 - Math.log10(totalMintCount + 1) * 40, 0, 100);
  const authenticityScore = AUTHENTICITY_GRADE_SCORES[authenticityGrade];
  const rookieBonus = isRookieDesignation ? ROOKIE_BONUS : 0;

  const traditionalScore = round(clamp(
    scarcityScore * TRADITIONAL_WEIGHTS.scarcity
      + authenticityScore * TRADITIONAL_WEIGHTS.authenticity
      + externalInfluenceScore * TRADITIONAL_WEIGHTS.influence
      + rookieBonus,
    0, 100
  ));
  return {
    scarcityScore: round(scarcityScore),
    authenticityScore,
    externalInfluenceScore: round(externalInfluenceScore),
    rookieBonus,
    traditionalScore,
  };
}

const DIGITAL_WEIGHTS = { views: 0.15, clicks: 0.25, comments: 0.30, likes: 0.30 };
const MAX_VELOCITY_BONUS = 20;

function computeDigitalEngagementScore(options = {}) {
  const { views, clicks, comments, likes, engagementVelocity } = options;

  for (const [name, value] of Object.entries({ views, clicks, comments, likes, engagementVelocity })) {
    if (!Number.isFinite(value) || value < 0) {
      throw new Error(`computeDigitalEngagementScore requires a non-negative ${name}`);
    }
  }

  const normalizedViews = clamp(Math.log10(views + 1) * 20, 0, 100);
  const normalizedClicks = clamp(Math.log10(clicks + 1) * 25, 0, 100);
  const normalizedComments = clamp(Math.log10(comments + 1) * 30, 0, 100);
  const normalizedLikes = clamp(Math.log10(likes + 1) * 25, 0, 100);

  const baseEngagement =
    normalizedViews * DIGITAL_WEIGHTS.views +
    normalizedClicks * DIGITAL_WEIGHTS.clicks +
    normalizedComments * DIGITAL_WEIGHTS.comments +
    normalizedLikes * DIGITAL_WEIGHTS.likes;

  const velocityBonus = clamp(engagementVelocity, 0, MAX_VELOCITY_BONUS);
  const digitalEngagementScore = round(clamp(baseEngagement + velocityBonus, 0, 100));
  return { baseEngagement: round(baseEngagement), velocityBonus: round(velocityBonus), digitalEngagementScore };
}

const LONGEVITY_POINTS_PER_YEAR = 2;
const MAX_LONGEVITY_SCORE = 60;
const RECOGNITION_POINTS_PER_HONOR = 10;
const MAX_RECOGNITION_SCORE = 30;
const DOCUMENTED_IMPACT_BONUS = 10;

// Independent of digital engagement entirely, per the doc's own
// explicit requirement -- never derives from views/clicks/likes.
function computeGenuineSignificanceScore(options = {}) {
  const { longevityOfImpactYears, institutionalRecognitionCount, documentedHistoricalImpact } = options;

  if (!Number.isFinite(longevityOfImpactYears) || longevityOfImpactYears < 0) {
    throw new Error('computeGenuineSignificanceScore requires a non-negative longevityOfImpactYears');
  }
  if (!Number.isInteger(institutionalRecognitionCount) || institutionalRecognitionCount < 0) {
    throw new Error('computeGenuineSignificanceScore requires a non-negative integer institutionalRecognitionCount');
  }
  if (typeof documentedHistoricalImpact !== 'boolean') {
    throw new Error('computeGenuineSignificanceScore requires a boolean documentedHistoricalImpact');
  }

  const longevityScore = clamp(longevityOfImpactYears * LONGEVITY_POINTS_PER_YEAR, 0, MAX_LONGEVITY_SCORE);
  const recognitionScore = clamp(institutionalRecognitionCount * RECOGNITION_POINTS_PER_HONOR, 0, MAX_RECOGNITION_SCORE);
  const impactBonus = documentedHistoricalImpact ? DOCUMENTED_IMPACT_BONUS : 0;

  const genuineSignificanceScore = round(clamp(longevityScore + recognitionScore + impactBonus, 0, 100));
  return { longevityScore: round(longevityScore), recognitionScore: round(recognitionScore), impactBonus, genuineSignificanceScore, independentOfDigitalEngagement: true };
}

// The real balancing act: digitalEngagement and genuineSignificance
// weighted EQUALLY (0.35 each) -- the literal implementation of "not
// letting one silently dominate the other."
const COMBINED_WEIGHTS = { traditional: 0.30, digitalEngagement: 0.35, genuineSignificance: 0.35 };

function computeCombinedRealValueScore(options = {}) {
  const { traditionalScore, digitalEngagementScore, genuineSignificanceScore } = options;
  for (const [name, value] of Object.entries({ traditionalScore, digitalEngagementScore, genuineSignificanceScore })) {
    if (!Number.isFinite(value) || value < 0 || value > 100) {
      throw new Error(`computeCombinedRealValueScore requires ${name} to be a number between 0 and 100`);
    }
  }
  const combinedRealValueScore = round(clamp(
    traditionalScore * COMBINED_WEIGHTS.traditional +
    digitalEngagementScore * COMBINED_WEIGHTS.digitalEngagement +
    genuineSignificanceScore * COMBINED_WEIGHTS.genuineSignificance,
    0, 100
  ));
  return { combinedRealValueScore };
}

// The full, real assembly -- one call producing the complete
// CultureCardValueScore shape from the architecture doc.
function computeCultureCardValueScore(cardId, options = {}) {
  const traditional = computeTraditionalScore(options.traditional);
  const digitalEngagement = computeDigitalEngagementScore(options.digitalEngagement);
  const genuineSignificance = computeGenuineSignificanceScore(options.genuineSignificance);
  const combined = computeCombinedRealValueScore({
    traditionalScore: traditional.traditionalScore,
    digitalEngagementScore: digitalEngagement.digitalEngagementScore,
    genuineSignificanceScore: genuineSignificance.genuineSignificanceScore,
  });

  return {
    cardId,
    traditionalScore: traditional,
    digitalEngagementScore: digitalEngagement,
    genuineSignificanceScore: genuineSignificance,
    combinedRealValueScore: combined.combinedRealValueScore,
  };
}

module.exports = {
  AUTHENTICITY_GRADES,
  TRADITIONAL_WEIGHTS,
  DIGITAL_WEIGHTS,
  MAX_VELOCITY_BONUS,
  COMBINED_WEIGHTS,
  computeTraditionalScore,
  computeDigitalEngagementScore,
  computeGenuineSignificanceScore,
  computeCombinedRealValueScore,
  computeCultureCardValueScore,
};
