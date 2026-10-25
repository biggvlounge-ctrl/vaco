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
  TRADITIONAL_WEIGHTS, DIGITAL_WEIGHTS, computeTraditionalScore, computeDigitalEngagementScore, computeCultureCardValueScore,
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
    digitalEngagement: { views: 0, clicks: 0, comments: 0, likes: 0, shares: 0, engagementVelocity: 0 },
    genuineSignificance: { longevityOfImpactYears: 0, institutionalRecognitionCount: 0, documentedHistoricalImpact: false },
  });
  const massiveInfluence = computeCultureCardValueScore(1, {
    traditional: baseTraditionalArgs({ externalInfluenceScore: 95 }),
    digitalEngagement: { views: 0, clicks: 0, comments: 0, likes: 0, shares: 0, engagementVelocity: 0 },
    genuineSignificance: { longevityOfImpactYears: 0, institutionalRecognitionCount: 0, documentedHistoricalImpact: false },
  });

  assert.ok(massiveInfluence.combinedRealValueScore > noInfluence.combinedRealValueScore);
  assert.equal(massiveInfluence.traditionalScore.externalInfluenceScore, 95);
});

function baseDigitalArgs(overrides = {}) {
  return {
    views: 100, clicks: 20, comments: 5, likes: 30, shares: 0, engagementVelocity: 0,
    ...overrides,
  };
}

test('the five digital-engagement weights (views/clicks/comments/likes/shares) sum to exactly 1.0', () => {
  const sum = Object.values(DIGITAL_WEIGHTS).reduce((s, w) => s + w, 0);
  assert.equal(Math.round(sum * 100) / 100, 1.0);
});

test('a real share is a real, standard metric now -- a share-only card scores above zero', () => {
  const noShares = computeDigitalEngagementScore(baseDigitalArgs({ views: 0, clicks: 0, comments: 0, likes: 0, shares: 0 }));
  const onlyShares = computeDigitalEngagementScore(baseDigitalArgs({ views: 0, clicks: 0, comments: 0, likes: 0, shares: 500 }));
  assert.equal(noShares.digitalEngagementScore, 0);
  assert.ok(onlyShares.digitalEngagementScore > 0);
});

test('shares is validated the same way every other digital-engagement input is', () => {
  assert.throws(
    () => computeDigitalEngagementScore(baseDigitalArgs({ shares: -1 })),
    /requires a non-negative shares/,
  );
  assert.throws(
    () => computeDigitalEngagementScore({ views: 1, clicks: 1, comments: 1, likes: 1, engagementVelocity: 1 }), // shares omitted entirely
    /requires a non-negative shares/,
  );
});

test('the per-type log-multipliers for views/clicks/comments/likes are unchanged from before shares existed', () => {
  // Regression check: adding shares rebalanced DIGITAL_WEIGHTS, but the
  // underlying log10(x+1)*k normalization for the original four types
  // must still use the same real k values (20/25/30/25) -- only how
  // much weight each normalized score carries changed, not the curve
  // itself. Computed by hand against the real formula, not copied from
  // the implementation.
  const views1000 = Math.round((Math.log10(1001) * 20) * 100) / 100;
  const clicks1000 = Math.round((Math.log10(1001) * 25) * 100) / 100;
  const comments1000 = Math.round((Math.log10(1001) * 30) * 100) / 100;
  const likes1000 = Math.round((Math.log10(1001) * 25) * 100) / 100;

  const scoreViewsOnly = computeDigitalEngagementScore({ views: 1000, clicks: 0, comments: 0, likes: 0, shares: 0, engagementVelocity: 0 });
  const scoreClicksOnly = computeDigitalEngagementScore({ views: 0, clicks: 1000, comments: 0, likes: 0, shares: 0, engagementVelocity: 0 });
  const scoreCommentsOnly = computeDigitalEngagementScore({ views: 0, clicks: 0, comments: 1000, likes: 0, shares: 0, engagementVelocity: 0 });
  const scoreLikesOnly = computeDigitalEngagementScore({ views: 0, clicks: 0, comments: 0, likes: 1000, shares: 0, engagementVelocity: 0 });

  assert.equal(scoreViewsOnly.digitalEngagementScore, Math.round(views1000 * DIGITAL_WEIGHTS.views * 100) / 100);
  assert.equal(scoreClicksOnly.digitalEngagementScore, Math.round(clicks1000 * DIGITAL_WEIGHTS.clicks * 100) / 100);
  assert.equal(scoreCommentsOnly.digitalEngagementScore, Math.round(comments1000 * DIGITAL_WEIGHTS.comments * 100) / 100);
  assert.equal(scoreLikesOnly.digitalEngagementScore, Math.round(likes1000 * DIGITAL_WEIGHTS.likes * 100) / 100);
});
