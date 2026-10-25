// VOKEN -- the real, hybrid Value Algorithm. Focused on
// `computeTraditionalScore`'s new `externalInfluenceScore` term (the
// real cross-platform social-influence signal, added by direct
// instruction) and its integration into the full
// `computeCultureCardValueScore` assembly. The failure this file
// exists to catch: a card with real, massive social influence scoring
// no differently from one with none -- the whole point of wiring this
// in at all.

const test = require('node:test');
const assert = require('node:assert');

const {
  TRADITIONAL_WEIGHTS, computeTraditionalScore, computeCultureCardValueScore,
} = require('../lib/valueAlgorithm');

function baseTraditionalArgs(overrides = {}) {
  return {
    totalMintCount: 500, authenticityGrade: 'B', isRookieDesignation: false,
    ...overrides,
  };
}

test('externalInfluenceScore defaults to 0 when omitted -- an honest "no real data," not a penalty or a guess', () => {
  const withNone = computeTraditionalScore(baseTraditionalArgs());
  const withZero = computeTraditionalScore(baseTraditionalArgs({ externalInfluenceScore: 0 }));
  assert.equal(withNone.externalInfluenceScore, 0);
  assert.deepEqual(withNone, withZero);
});

test('a higher real externalInfluenceScore strictly raises the traditional score, all else equal', () => {
  const low = computeTraditionalScore(baseTraditionalArgs({ externalInfluenceScore: 10 }));
  const high = computeTraditionalScore(baseTraditionalArgs({ externalInfluenceScore: 90 }));
  assert.ok(high.traditionalScore > low.traditionalScore);
});

test('the three multiplicative weights (scarcity, authenticity, influence) still sum to 0.85, the same ceiling the pre-influence formula had', () => {
  const sum = TRADITIONAL_WEIGHTS.scarcity + TRADITIONAL_WEIGHTS.authenticity + TRADITIONAL_WEIGHTS.influence;
  assert.equal(Math.round(sum * 100) / 100, 0.85);
});

test('a perfect card (near-1/1 scarcity, grade A, max influence, rookie) still tops out at 100, not above', () => {
  const perfect = computeTraditionalScore({
    totalMintCount: 1, authenticityGrade: 'A', isRookieDesignation: true, externalInfluenceScore: 100,
  });
  assert.ok(perfect.traditionalScore <= 100);
});

test('externalInfluenceScore is validated the same way every other score input here is', () => {
  assert.throws(
    () => computeTraditionalScore(baseTraditionalArgs({ externalInfluenceScore: -1 })),
    /externalInfluenceScore to be a number between 0 and 100/,
  );
  assert.throws(
    () => computeTraditionalScore(baseTraditionalArgs({ externalInfluenceScore: 101 })),
    /externalInfluenceScore to be a number between 0 and 100/,
  );
  assert.throws(
    () => computeTraditionalScore(baseTraditionalArgs({ externalInfluenceScore: 'a lot' })),
    /externalInfluenceScore to be a number between 0 and 100/,
  );
});

test('computeCultureCardValueScore carries externalInfluenceScore through the full real assembly', () => {
  const noInfluence = computeCultureCardValueScore(1, {
    traditional: baseTraditionalArgs(),
    digitalEngagement: { views: 0, clicks: 0, comments: 0, likes: 0, engagementVelocity: 0 },
    genuineSignificance: { longevityOfImpactYears: 0, institutionalRecognitionCount: 0, documentedHistoricalImpact: false },
  });
  const massiveInfluence = computeCultureCardValueScore(1, {
    traditional: baseTraditionalArgs({ externalInfluenceScore: 95 }),
    digitalEngagement: { views: 0, clicks: 0, comments: 0, likes: 0, engagementVelocity: 0 },
    genuineSignificance: { longevityOfImpactYears: 0, institutionalRecognitionCount: 0, documentedHistoricalImpact: false },
  });

  assert.ok(massiveInfluence.combinedRealValueScore > noInfluence.combinedRealValueScore);
  assert.equal(massiveInfluence.traditionalScore.externalInfluenceScore, 95);
});
