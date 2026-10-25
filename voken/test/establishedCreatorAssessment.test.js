// VOKEN -- Established Creator Assessment, focused on
// `getLatestAssessmentForCreator`, the real lookup
// `valueAlgorithm.js`'s new cross-platform `externalInfluenceScore`
// term is built on. The failure this file exists to catch: returning
// a stale assessment when a creator has been reassessed since, or
// crediting one creator's real social following to a different one.

const test = require('node:test');
const assert = require('node:assert');

const { createVokenStore } = require('../lib/store');
const {
  assessEstablishedCreator, computeExternalScore, getLatestAssessmentForCreator,
} = require('../lib/establishedCreatorAssessment');

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
  const score = computeExternalScore(latest.existingExternalMetrics);
  assert.equal(score, assessment.externalScore, 'recomputing from the stored metrics must reproduce the same real score');
});
