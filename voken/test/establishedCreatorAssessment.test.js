// VOKEN -- Established Creator Assessment, recalibrated by direct
// instruction: "it shouldn't be easy to get to 100. The top of the
// top should hit 100." The failure this file exists to catch: a
// single real but unremarkable signal (a few hundred thousand
// followers) alone saturating the score -- which is exactly what the
// pre-recalibration formula did, confirmed directly against two real
// public figures before this fix.

const test = require('node:test');
const assert = require('node:assert');

const { createVokenStore } = require('../lib/store');
const {
  OCCUPATION_CATEGORIES,
  assessEstablishedCreator, computeExternalScore, getLatestAssessmentForCreator,
} = require('../lib/establishedCreatorAssessment');

function baseMetrics(overrides = {}) {
  return {
    realSocialFollowing: 0, realPressCoverageCount: 0, realIndustryRecognition: false, ...overrides,
  };
}

// -- the hardness fix itself --------------------------------------------

test('a real but unremarkable follower count no longer saturates the score -- the exact bug this recalibration fixes', () => {
  // Before this fix, ~215,000 followers alone already pushed
  // externalScore to 100. It must not come close now.
  const { externalScore } = computeExternalScore(baseMetrics({ realSocialFollowing: 250000 }));
  assert.ok(externalScore < 50, `expected a real but modest follower count to score well under 50, got ${externalScore}`);
});

test('reaching 100 requires being near-maximal on every real axis at once, not just one', () => {
  // Massive social following alone: still nowhere near 100, because
  // the other four weighted axes are still at 0.
  const socialOnly = computeExternalScore(baseMetrics({ realSocialFollowing: 1000000000 }));
  assert.ok(socialOnly.externalScore < 40, `social alone must not carry the score near 100, got ${socialOnly.externalScore}`);

  // Only maxing every real axis simultaneously gets genuinely close
  // to 100.
  const allMaxed = computeExternalScore({
    realSocialFollowing: 1000000000,
    realPressCoverageCount: 10000,
    realIndustryRecognition: true,
    realContentConsumptionCount: 10000000000,
    realAlbumCount: 12,
  });
  assert.ok(allMaxed.externalScore >= 95, `expected near-100 when every real axis is maxed, got ${allMaxed.externalScore}`);
});

test('two real public figures with wildly different follower counts no longer tie at 100 -- the exact scenario that motivated this fix', () => {
  // Modeled on the real research done earlier this session: one
  // figure with ~1.57M real followers and real press coverage, one
  // with an unverified but plausible ~250,000. Both used to hit
  // exactly 100 against the old formula.
  const a = computeExternalScore(baseMetrics({ realSocialFollowing: 1570000, realPressCoverageCount: 5 }));
  const b = computeExternalScore(baseMetrics({ realSocialFollowing: 250000, realPressCoverageCount: 1, realIndustryRecognition: true }));
  assert.notEqual(a.externalScore, 100);
  assert.notEqual(b.externalScore, 100);
  assert.notEqual(a.externalScore, b.externalScore, 'two real, differently-famous people must not tie at the same score');
});

test('computeExternalScore returns a real breakdown, each sub-score independently capped at 100', () => {
  const { breakdown } = computeExternalScore({
    realSocialFollowing: 1000000000, realPressCoverageCount: 1000000, realIndustryRecognition: true,
    realContentConsumptionCount: 1000000000000, realAlbumCount: 500,
  });
  assert.ok(breakdown.social.subScore <= 100);
  assert.ok(breakdown.press.subScore <= 100);
  assert.ok(breakdown.consumption.subScore <= 100);
  assert.ok(breakdown.achievement.subScore <= 100);
});

// -- the real achievement term (albums/articles/books/office terms) -----

test('realAlbumCount, realArticlesPublished, realBooksPublished, and realTimesElectedToOffice each real-raise the score on their own', () => {
  const none = computeExternalScore(baseMetrics());
  const withAlbums = computeExternalScore(baseMetrics({ realAlbumCount: 12 }));
  const withArticles = computeExternalScore(baseMetrics({ realArticlesPublished: 200 }));
  const withBooks = computeExternalScore(baseMetrics({ realBooksPublished: 10 }));
  const withOffice = computeExternalScore(baseMetrics({ realTimesElectedToOffice: 4 }));

  for (const [label, scored] of [['albums', withAlbums], ['articles', withArticles], ['books', withBooks], ['office', withOffice]]) {
    assert.ok(scored.externalScore > none.externalScore, `${label} must real-raise the score`);
  }
});

test('a musician\'s real album count and a politician\'s real office terms never need the other to score', () => {
  const musician = computeExternalScore(baseMetrics({ realAlbumCount: 12 }));
  const politician = computeExternalScore(baseMetrics({ realTimesElectedToOffice: 4 }));
  assert.ok(musician.breakdown.achievement.subScore > 0);
  assert.equal(musician.breakdown.achievement.realTimesElectedToOffice, 0);
  assert.ok(politician.breakdown.achievement.subScore > 0);
  assert.equal(politician.breakdown.achievement.realAlbumCount, 0);
});

test('computeExternalScore validates every new achievement input the same way every other input here is', () => {
  for (const field of ['realAlbumCount', 'realArticlesPublished', 'realBooksPublished', 'realTimesElectedToOffice']) {
    assert.throws(
      () => computeExternalScore(baseMetrics({ [field]: -1 })),
      new RegExp(`non-negative integer ${field}`),
    );
  }
});

// -- expanded real statistics, by direct instruction: "we don't just want
// to use information from our ecosystem. We want to use all information
// from everything available... how many views on YouTube... books sold...
// bestseller... movies... interviews... civil rights... groundbreaking
// influence." ---------------------------------------------------------

test('realYoutubeViews, realAllSocialMediaViews, and realBooksSoldCount all feed the one real consumption total, not separate sub-scores', () => {
  const none = computeExternalScore(baseMetrics());
  const withYoutube = computeExternalScore(baseMetrics({ realYoutubeViews: 5000000000 }));
  const withSocial = computeExternalScore(baseMetrics({ realAllSocialMediaViews: 5000000000 }));
  const withBooksSold = computeExternalScore(baseMetrics({ realBooksSoldCount: 5000000000 }));
  for (const [label, scored] of [['YouTube views', withYoutube], ['all-social views', withSocial], ['books sold', withBooksSold]]) {
    assert.ok(scored.externalScore > none.externalScore, `${label} must real-raise the score`);
    assert.ok(scored.breakdown.consumption.subScore > 0);
  }
  // Combined, they sum into one real totalConsumptionCount.
  const combined = computeExternalScore(baseMetrics({ realYoutubeViews: 1000, realAllSocialMediaViews: 2000, realBooksSoldCount: 3000, realContentConsumptionCount: 4000 }));
  assert.equal(combined.breakdown.consumption.totalConsumptionCount, 10000);
});

test('realMoviesProduced, realInterviewCount, and realBestsellerCount each real-raise the achievement sub-score on their own', () => {
  const none = computeExternalScore(baseMetrics());
  const withMovies = computeExternalScore(baseMetrics({ realMoviesProduced: 10 }));
  const withInterviews = computeExternalScore(baseMetrics({ realInterviewCount: 50 }));
  const withBestseller = computeExternalScore(baseMetrics({ realBestsellerCount: 4 }));
  for (const [label, scored] of [['movies', withMovies], ['interviews', withInterviews], ['bestseller', withBestseller]]) {
    assert.ok(scored.externalScore > none.externalScore, `${label} must real-raise the score`);
    assert.equal(scored.breakdown.achievement.subScore, 100, `${label} alone should max the achievement sub-score at its real anchor`);
  }
});

test('realCulturalImpactRecognitionCount raises the recognition sub-score independently of, and additively with, realIndustryRecognition', () => {
  const neither = computeExternalScore(baseMetrics());
  const culturalOnly = computeExternalScore(baseMetrics({ realCulturalImpactRecognitionCount: 3 }));
  const industryOnly = computeExternalScore(baseMetrics({ realIndustryRecognition: true }));
  const both = computeExternalScore(baseMetrics({ realIndustryRecognition: true, realCulturalImpactRecognitionCount: 3 }));

  assert.ok(culturalOnly.breakdown.recognition.subScore > neither.breakdown.recognition.subScore);
  assert.equal(industryOnly.breakdown.recognition.subScore, 100);
  // Both together still cap at the same real 100 ceiling, never overflow.
  assert.equal(both.breakdown.recognition.subScore, 100);
});

test('the new statistics still validate like every other real input here', () => {
  for (const field of ['realYoutubeViews', 'realAllSocialMediaViews', 'realBooksSoldCount', 'realCulturalImpactRecognitionCount', 'realMoviesProduced', 'realInterviewCount', 'realBestsellerCount']) {
    assert.throws(
      () => computeExternalScore(baseMetrics({ [field]: -1 })),
      new RegExp(`non-negative integer ${field}`),
    );
  }
});

// -- occupationCategory (real, stored label) -----------------------------

test('assessEstablishedCreator stores a real occupationCategory, defaulting to "other"', () => {
  const store = createVokenStore();
  const withCategory = assessEstablishedCreator(store, {
    creatorId: 'ada', occupationCategory: 'musician', realSocialFollowing: 1000, realPressCoverageCount: 0, realIndustryRecognition: false,
  });
  assert.equal(withCategory.occupationCategory, 'musician');

  const withoutCategory = assessEstablishedCreator(store, {
    creatorId: 'ben', realSocialFollowing: 1000, realPressCoverageCount: 0, realIndustryRecognition: false,
  });
  assert.equal(withoutCategory.occupationCategory, 'other');
});

test('assessEstablishedCreator refuses an occupationCategory that is not real', () => {
  const store = createVokenStore();
  assert.throws(
    () => assessEstablishedCreator(store, {
      creatorId: 'ada', occupationCategory: 'not-a-real-category', realSocialFollowing: 0, realPressCoverageCount: 0, realIndustryRecognition: false,
    }),
    /invalid occupationCategory/,
  );
});

test('OCCUPATION_CATEGORIES covers the real categories named by direct instruction', () => {
  assert.ok(OCCUPATION_CATEGORIES.includes('influencer'));
  assert.ok(OCCUPATION_CATEGORIES.includes('musician'));
  assert.ok(OCCUPATION_CATEGORIES.includes('political'));
});

// -- existing lookup/round-trip behavior, re-verified against the new shape --

test('getLatestAssessmentForCreator returns null when nobody has ever assessed this creator', () => {
  const store = createVokenStore();
  assert.equal(getLatestAssessmentForCreator(store, 'nobody-home'), null);
});

test('getLatestAssessmentForCreator returns the one real assessment on file', () => {
  const store = createVokenStore();
  const assessment = assessEstablishedCreator(store, {
    creatorId: 'ada', realSocialFollowing: 50000, realPressCoverageCount: 2, realIndustryRecognition: true,
  });
  assert.deepEqual(getLatestAssessmentForCreator(store, 'ada'), assessment);
});

test('getLatestAssessmentForCreator returns the most recent of several, not the first or the biggest', () => {
  const store = createVokenStore();
  const older = assessEstablishedCreator(store, {
    creatorId: 'ben', realSocialFollowing: 9000000, realPressCoverageCount: 50, realIndustryRecognition: true,
  });
  older.assessedAt = Date.now() - 1000 * 60 * 60 * 24 * 365; // a year ago, real following was huge then
  const newer = assessEstablishedCreator(store, {
    creatorId: 'ben', realSocialFollowing: 1000, realPressCoverageCount: 0, realIndustryRecognition: false,
  });
  newer.assessedAt = Date.now(); // today, real following has since collapsed

  const latest = getLatestAssessmentForCreator(store, 'ben');
  assert.equal(latest, newer, 'the most recently assessed record wins, even though it reports a smaller following');
});

test('getLatestAssessmentForCreator never mixes up two different creators\' real records', () => {
  const store = createVokenStore();
  assessEstablishedCreator(store, { creatorId: 'ada', realSocialFollowing: 1, realPressCoverageCount: 0, realIndustryRecognition: false });
  const carlosAssessment = assessEstablishedCreator(store, {
    creatorId: 'carlos', realSocialFollowing: 2000000, realPressCoverageCount: 10, realIndustryRecognition: true,
  });
  assert.equal(getLatestAssessmentForCreator(store, 'carlos'), carlosAssessment);
  assert.notEqual(getLatestAssessmentForCreator(store, 'ada').creatorId, 'carlos');
});

test('an assessment\'s existingExternalMetrics round-trips cleanly through computeExternalScore, the real bridge into traditionalScore', () => {
  const store = createVokenStore();
  const assessment = assessEstablishedCreator(store, {
    creatorId: 'dana', realSocialFollowing: 300000, realPressCoverageCount: 4, realIndustryRecognition: true,
  });
  const latest = getLatestAssessmentForCreator(store, 'dana');
  const { externalScore } = computeExternalScore(latest.existingExternalMetrics);
  assert.equal(externalScore, assessment.externalScore, 'recomputing from the stored metrics must reproduce the same real score');
});

test('realContentConsumptionCount defaults to 0 -- a one-time onboarding assessment never needs it', () => {
  const { externalScore } = computeExternalScore(baseMetrics());
  assert.equal(externalScore, 0);
});

test('a real cross-platform content-consumption total strictly raises computeExternalScore, all else equal', () => {
  const base = baseMetrics({ realSocialFollowing: 1000 });
  const noConsumption = computeExternalScore(base);
  const withConsumption = computeExternalScore({ ...base, realContentConsumptionCount: 50000000 });
  assert.ok(withConsumption.externalScore > noConsumption.externalScore);
});

test('computeExternalScore validates realContentConsumptionCount the same way every other input here is', () => {
  assert.throws(
    () => computeExternalScore(baseMetrics({ realContentConsumptionCount: -1 })),
    /non-negative integer realContentConsumptionCount/,
  );
  assert.throws(
    () => computeExternalScore(baseMetrics({ realContentConsumptionCount: 1.5 })),
    /non-negative integer realContentConsumptionCount/,
  );
});
