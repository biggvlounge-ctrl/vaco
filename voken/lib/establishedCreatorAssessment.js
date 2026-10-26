// VOKEN — Established Creator Assessment.
// Source of truth: VOKEN_NEW_VALUE_ALGORITHM.md: someone with genuine
// existing status shouldn't be treated as a blank-slate rookie when
// they join, but also shouldn't be allowed to self-declare an
// inflated value -- the system looks at real, already-public external
// metrics to calibrate a fair, defensible starting tier.
//
// **Recalibrated by direct instruction: "it shouldn't be easy to get
// to 100. The top of the top should hit 100."** The original formula
// summed four differently-scaled raw terms with no shared ceiling, so
// a single real but unremarkable number (a few hundred thousand
// followers) already saturated the whole score -- confirmed directly
// against two real public figures before this fix: one hit 100 off
// social following alone, the other hit 100 at every follower count
// tested from 50,000 up.
//
// The fix: every real signal is now its own real, log-scaled
// **sub-score capped at 100**, and the five sub-scores are combined by
// **real weights that themselves sum to exactly 100** (the same
// weighted-components pattern `valueAlgorithm.js` already uses for
// traditional/digitalEngagement/genuineSignificance). Hitting 100
// overall now requires being near-maximal on every real axis at
// once -- genuinely global social reach AND heavy real press coverage
// AND formal industry recognition AND a massive real content-
// consumption total AND a real, substantial body of work. No single
// axis can carry the score there alone any more.
//
// Every log-scale anchor below is a real, named, order-of-magnitude
// estimate (flagged as interpretive, same discipline as every other
// formula in this session) rather than an arbitrary curve:
//   - ~1 billion combined real followers across every platform is
//     roughly the realistic ceiling for the single most-followed
//     living person (the real most-followed humans on one platform
//     alone run several hundred million).
//   - ~10,000 real published articles is a genuinely enormous press
//     footprint -- decades of global coverage, not a few write-ups.
//   - ~10 billion combined real streams/listens/views/units-sold is a
//     massive, multi-platform career total.
// `realSocialFollowing` and `realPressCoverageCount` are meant to be
// summed across every platform the person is on, per direct
// instruction ("it's not just our platform, it's all platforms") --
// this module has no way to enforce that itself (it takes whatever
// total the caller supplies), so the honesty burden sits with whoever
// assembles that number.

const { RARITY_TIERS } = require('./cardTypes');

function round(n) {
  return Math.round(n * 100) / 100;
}
function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

// A real, named occupation/domain label -- by direct instruction
// ("different categories: influencers, musicians, political... also
// have nominations... just different categories"). Purely a real,
// stored classification for display/filtering (the Explore page can
// section by it the same way `historicExplore.js` already sections
// historic cards by subject type) -- it does not change which formula
// runs; the achievement sub-score below is already self-selecting,
// since a musician naturally has a real album count and a politician
// naturally has real office terms, never both.
const OCCUPATION_CATEGORIES = ['influencer', 'musician', 'political', 'author', 'athlete', 'other'];

// -- social reach --------------------------------------------------
// Anchor: ~1,000,000,000 combined real followers across every real
// platform -> sub-score 100.
const SOCIAL_FOLLOWING_LOG_MULTIPLIER = 100 / 9; // log10(1e9+1) ≈ 9

// -- real press coverage ---------------------------------------------
// Anchor: ~10,000 real published articles ABOUT this person -> 100.
// Log-scaled now, not a flat per-article amount -- the original flat
// 5-points-per-article let a double-digit article count alone
// saturate this term.
const PRESS_COVERAGE_LOG_MULTIPLIER = 100 / 4; // log10(1e4+1) ≈ 4

// -- formal industry recognition --------------------------------------
// A flat boolean bonus, same as before, but itself now only worth its
// own 100-point sub-scale (weighted down below like everything else).
// **`realCulturalImpactRecognitionCount`, added by direct
// instruction**: "it could be something with civil rights that'll
// make things go up high. It could be a Malcolm X... historians...
// civil rights... groundbreaking influence." A real, named-honor
// count independent of `realIndustryRecognition` (a Presidential
// Medal of Freedom, a Congressional Gold Medal, a Rock & Roll Hall of
// Fame induction, a Nobel Prize) -- the same real "named honors" idea
// `historicRegistry.js`'s own `recognitions` list already uses for
// historic cards, extended here to a living creator's own real
// record. Additive with the boolean bonus, not a replacement for it --
// either path alone, or both together, can reach the same real
// ceiling.
const INDUSTRY_RECOGNITION_BONUS = 100;
const CULTURAL_IMPACT_POINTS_PER_HONOR = 40;

// -- real cross-platform content consumption ---------------------------
// Anchor: ~10,000,000,000 combined real streams/listens/views/units
// sold over a whole career -> 100. **Broadened by direct instruction:
// "we don't just want to use information from our ecosystem. We want
// to use all information from everything available... how many views
// on YouTube, how many views on all social media... how many books
// sold."** `realYoutubeViews`, `realAllSocialMediaViews` (distinct
// from `realSocialFollowing` below -- a view is a single real
// consumption event, a follower is an ongoing real relationship), and
// `realBooksSoldCount` (distinct from `realBooksPublished` below -- a
// book SOLD is audience reach, a book PUBLISHED is body of work, the
// same real distinction `realAlbumCount` vs. streams already draws)
// all feed the same one real consumption total and the same one real
// log curve -- not separate sub-scores, since they are all the same
// real kind of fact: how much of this person's real output has
// actually been consumed, from any real source, inside this ecosystem
// or outside it.
const CONTENT_CONSUMPTION_LOG_MULTIPLIER = 10; // log10(1e10+1) = 10

// -- real body-of-work achievement ------------------------------------
// Linear, not log-scaled: these are real, typically small whole-number
// counts (nobody has "a billion albums"), so a per-unit point value
// with its own 100-point cap fits better than a log curve built for
// counts that run into the millions or billions.
//   - realAlbumCount: meant to be the real, live count of this
//     artist's own album-format releases (see
//     `vulture-music`'s `getAlbumCountForArtist`, fetched live by
//     `server.js` the same way content consumption already is) --
//     12+ real albums alone maxes this one input.
//   - realArticlesPublished / realBooksPublished: the person's OWN
//     real published output (an author/journalist's body of work),
//     genuinely distinct from `realPressCoverageCount` above (press
//     written ABOUT them). No real backend tracks either anywhere in
//     this ecosystem, so both are honestly self-reported, the same
//     posture `realPressCoverageCount` already has.
//   - realTimesElectedToOffice: a real political-category input, also
//     self-reported -- no real civic database exists here either.
//   - realMoviesProduced / realInterviewCount / realBestsellerCount,
//     added by direct instruction ("how many movies has he made...
//     how many interviews... how many times have they been
//     bestseller"): the same real, self-reported, per-unit-point
//     pattern as every other achievement input above -- a real count
//     of a real, named, countable accomplishment, never a guessed
//     total.
const ALBUM_POINTS_PER_RELEASE = 100 / 12;
const ARTICLE_POINTS_PER_PUBLISHED = 100 / 200;
const BOOK_POINTS_PER_PUBLISHED = 10;
const OFFICE_TERM_POINTS = 25;
const MOVIE_POINTS_PER_PRODUCED = 10;
const INTERVIEW_POINTS_PER_APPEARANCE = 2;
const BESTSELLER_POINTS_PER_TIME = 25;

// The real weights, summing to exactly 100 -- the one property that
// makes "100 is genuinely hard" true: every sub-score below is itself
// capped at 100, so the *only* way to reach 100 overall is scoring
// near-maximal on all five axes simultaneously.
const EXTERNAL_SCORE_WEIGHTS = {
  social: 0.30, press: 0.15, recognition: 0.10, consumption: 0.25, achievement: 0.20,
};

function requireNonNegativeInt(value, name, { optional = false } = {}) {
  if (optional && (value === undefined || value === null)) return 0;
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`computeExternalScore requires a non-negative integer ${name}${optional ? ' when given' : ''}`);
  }
  return value;
}

function computeExternalScore(options = {}) {
  const {
    realSocialFollowing, realPressCoverageCount, realIndustryRecognition,
  } = options;
  const realContentConsumptionCount = requireNonNegativeInt(options.realContentConsumptionCount, 'realContentConsumptionCount', { optional: true });
  const realYoutubeViews = requireNonNegativeInt(options.realYoutubeViews, 'realYoutubeViews', { optional: true });
  const realAllSocialMediaViews = requireNonNegativeInt(options.realAllSocialMediaViews, 'realAllSocialMediaViews', { optional: true });
  const realBooksSoldCount = requireNonNegativeInt(options.realBooksSoldCount, 'realBooksSoldCount', { optional: true });
  const realCulturalImpactRecognitionCount = requireNonNegativeInt(options.realCulturalImpactRecognitionCount, 'realCulturalImpactRecognitionCount', { optional: true });
  const realAlbumCount = requireNonNegativeInt(options.realAlbumCount, 'realAlbumCount', { optional: true });
  const realArticlesPublished = requireNonNegativeInt(options.realArticlesPublished, 'realArticlesPublished', { optional: true });
  const realBooksPublished = requireNonNegativeInt(options.realBooksPublished, 'realBooksPublished', { optional: true });
  const realTimesElectedToOffice = requireNonNegativeInt(options.realTimesElectedToOffice, 'realTimesElectedToOffice', { optional: true });
  const realMoviesProduced = requireNonNegativeInt(options.realMoviesProduced, 'realMoviesProduced', { optional: true });
  const realInterviewCount = requireNonNegativeInt(options.realInterviewCount, 'realInterviewCount', { optional: true });
  const realBestsellerCount = requireNonNegativeInt(options.realBestsellerCount, 'realBestsellerCount', { optional: true });

  requireNonNegativeInt(realSocialFollowing, 'realSocialFollowing');
  requireNonNegativeInt(realPressCoverageCount, 'realPressCoverageCount');
  if (typeof realIndustryRecognition !== 'boolean') {
    throw new Error('computeExternalScore requires a boolean realIndustryRecognition');
  }

  const socialSubScore = clamp(Math.log10(realSocialFollowing + 1) * SOCIAL_FOLLOWING_LOG_MULTIPLIER, 0, 100);
  const pressSubScore = clamp(Math.log10(realPressCoverageCount + 1) * PRESS_COVERAGE_LOG_MULTIPLIER, 0, 100);
  const recognitionSubScore = clamp(
    (realIndustryRecognition ? INDUSTRY_RECOGNITION_BONUS : 0) + realCulturalImpactRecognitionCount * CULTURAL_IMPACT_POINTS_PER_HONOR,
    0, 100,
  );
  const totalConsumptionCount = realContentConsumptionCount + realYoutubeViews + realAllSocialMediaViews + realBooksSoldCount;
  const consumptionSubScore = clamp(Math.log10(totalConsumptionCount + 1) * CONTENT_CONSUMPTION_LOG_MULTIPLIER, 0, 100);
  const achievementSubScore = clamp(
    realAlbumCount * ALBUM_POINTS_PER_RELEASE
      + realArticlesPublished * ARTICLE_POINTS_PER_PUBLISHED
      + realBooksPublished * BOOK_POINTS_PER_PUBLISHED
      + realTimesElectedToOffice * OFFICE_TERM_POINTS
      + realMoviesProduced * MOVIE_POINTS_PER_PRODUCED
      + realInterviewCount * INTERVIEW_POINTS_PER_APPEARANCE
      + realBestsellerCount * BESTSELLER_POINTS_PER_TIME,
    0, 100,
  );

  const externalScore = round(clamp(
    socialSubScore * EXTERNAL_SCORE_WEIGHTS.social
      + pressSubScore * EXTERNAL_SCORE_WEIGHTS.press
      + recognitionSubScore * EXTERNAL_SCORE_WEIGHTS.recognition
      + consumptionSubScore * EXTERNAL_SCORE_WEIGHTS.consumption
      + achievementSubScore * EXTERNAL_SCORE_WEIGHTS.achievement,
    0, 100,
  ));

  return {
    externalScore,
    breakdown: {
      social: { realSocialFollowing, subScore: round(socialSubScore), weight: EXTERNAL_SCORE_WEIGHTS.social },
      press: { realPressCoverageCount, subScore: round(pressSubScore), weight: EXTERNAL_SCORE_WEIGHTS.press },
      recognition: {
        realIndustryRecognition, realCulturalImpactRecognitionCount,
        subScore: round(recognitionSubScore), weight: EXTERNAL_SCORE_WEIGHTS.recognition,
      },
      consumption: {
        realContentConsumptionCount, realYoutubeViews, realAllSocialMediaViews, realBooksSoldCount,
        totalConsumptionCount, subScore: round(consumptionSubScore), weight: EXTERNAL_SCORE_WEIGHTS.consumption,
      },
      achievement: {
        realAlbumCount, realArticlesPublished, realBooksPublished, realTimesElectedToOffice,
        realMoviesProduced, realInterviewCount, realBestsellerCount,
        subScore: round(achievementSubScore), weight: EXTERNAL_SCORE_WEIGHTS.achievement,
      },
    },
  };
}

// **No named tier labels, by direct instruction, reversing an earlier
// pass of this same file.** An `EXTERNAL_SCORE_TIERS`/
// `describeExternalScoreTier()` pair briefly existed here, labeling a
// score "Rising" or "Industry Legend." Removed on direct, explicit
// correction: "there won't be a rising industry legend or anything
// like that... it is the value of the card that will represent it,
// just like a baseball card. It will just have statistics on there...
// shown in the value of the card." The real number
// (`externalScore`) and the real statistics behind it
// (`breakdown`) are the only things ever shown now -- no named-tier
// word standing in for the number. Removed the same way
// `computeStature()` was fully removed earlier this session: no
// stale label path left half-wired in.

// Upper five real tiers only -- never 'common' (not a blank-slate
// rookie) and never '1-of-1' (a card-scarcity property, not a fame
// tier).
const ELIGIBLE_TIERS = RARITY_TIERS.filter((t) => t !== 'common' && t !== '1-of-1');

function assessEstablishedCreator(store, options = {}) {
  const {
    creatorId, realSocialFollowing, realPressCoverageCount, realIndustryRecognition,
    occupationCategory = 'other',
    realContentConsumptionCount = 0, realYoutubeViews = 0, realAllSocialMediaViews = 0, realBooksSoldCount = 0,
    realCulturalImpactRecognitionCount = 0,
    realAlbumCount = 0, realArticlesPublished = 0, realBooksPublished = 0, realTimesElectedToOffice = 0,
    realMoviesProduced = 0, realInterviewCount = 0, realBestsellerCount = 0,
  } = options;
  if (!creatorId) throw new Error('assessEstablishedCreator requires a creatorId');
  if (!OCCUPATION_CATEGORIES.includes(occupationCategory)) {
    throw new Error(`assessEstablishedCreator: invalid occupationCategory "${occupationCategory}" (expected one of ${OCCUPATION_CATEGORIES.join(', ')})`);
  }

  const metrics = {
    realSocialFollowing, realPressCoverageCount, realIndustryRecognition,
    realContentConsumptionCount, realYoutubeViews, realAllSocialMediaViews, realBooksSoldCount,
    realCulturalImpactRecognitionCount,
    realAlbumCount, realArticlesPublished, realBooksPublished, realTimesElectedToOffice,
    realMoviesProduced, realInterviewCount, realBestsellerCount,
  };
  const { externalScore, breakdown } = computeExternalScore(metrics);

  // ELIGIBLE_TIERS = ['uncommon', 'rare', 'epic', 'legendary', 'mythic']
  let suggestedStartingTier;
  if (externalScore >= 80) suggestedStartingTier = ELIGIBLE_TIERS[4]; // mythic
  else if (externalScore >= 60) suggestedStartingTier = ELIGIBLE_TIERS[3]; // legendary
  else if (externalScore >= 40) suggestedStartingTier = ELIGIBLE_TIERS[2]; // epic
  else if (externalScore >= 20) suggestedStartingTier = ELIGIBLE_TIERS[1]; // rare
  else suggestedStartingTier = ELIGIBLE_TIERS[0]; // uncommon

  const assessment = {
    creatorId,
    occupationCategory,
    existingExternalMetrics: metrics,
    externalScore,
    externalScoreBreakdown: breakdown,
    suggestedStartingTier,
    assessedAt: Date.now(),
  };
  store.establishedCreatorAssessments.push(assessment);
  return assessment;
}

// The real lookup `valueAlgorithm.js`'s own `externalInfluenceScore`
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
  OCCUPATION_CATEGORIES,
  ELIGIBLE_TIERS,
  computeExternalScore,
  assessEstablishedCreator,
  getLatestAssessmentForCreator,
};
