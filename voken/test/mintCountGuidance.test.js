// VOKEN -- the real recommended mint-count guidance, by direct
// instruction: "make sure we have the numbers correct. You have a
// correct number for how many physical cards. How many digital
// cards?" The failure this file exists to catch: a recommendation
// that contradicts the real scarcity curve it's supposed to be
// grounded against (e.g. a "rarer" tier recommended with a bigger
// print run than a less-rare one).

const test = require('node:test');
const assert = require('node:assert');

const { RARITY_TIERS } = require('../lib/cardTypes');
const { RECOMMENDED_MINT_COUNTS_BY_RARITY, recommendedMintCountsFor } = require('../lib/mintCountGuidance');
const { computeTraditionalScore } = require('../lib/valueAlgorithm');

test('every real rarity tier has a real recommendation with both counts', () => {
  for (const tier of RARITY_TIERS) {
    const rec = RECOMMENDED_MINT_COUNTS_BY_RARITY[tier];
    assert.ok(rec, `expected a recommendation for "${tier}"`);
    assert.ok(Number.isInteger(rec.plannedDigitalMintCount) && rec.plannedDigitalMintCount > 0);
    assert.ok(Number.isInteger(rec.plannedPhysicalMintCount) && rec.plannedPhysicalMintCount >= 0);
  }
});

test('recommendedMintCountsFor looks up a real tier and refuses an unknown one', () => {
  assert.deepEqual(recommendedMintCountsFor('legendary'), {
    rarityTier: 'legendary', plannedDigitalMintCount: 60, plannedPhysicalMintCount: 10,
  });
  assert.throws(() => recommendedMintCountsFor('not-a-real-tier'), /no recommendation for rarityTier/);
});

test('recommended totals strictly shrink moving up the real rarity ladder', () => {
  const totals = RARITY_TIERS.map((t) => {
    const rec = RECOMMENDED_MINT_COUNTS_BY_RARITY[t];
    return rec.plannedDigitalMintCount + rec.plannedPhysicalMintCount;
  });
  for (let i = 1; i < totals.length; i++) {
    assert.ok(totals[i] < totals[i - 1], `expected "${RARITY_TIERS[i]}" total (${totals[i]}) < "${RARITY_TIERS[i - 1]}" total (${totals[i - 1]})`);
  }
});

test('the recommendation is genuinely grounded in the real scarcity curve: scarcityScore rises moving up the rarity ladder', () => {
  const scarcityScores = RARITY_TIERS.map((t) => {
    const rec = RECOMMENDED_MINT_COUNTS_BY_RARITY[t];
    const { scarcityScore } = computeTraditionalScore({
      totalMintCount: rec.plannedDigitalMintCount + rec.plannedPhysicalMintCount,
      authenticityGrade: 'A', isRookieDesignation: false,
    });
    return scarcityScore;
  });
  for (let i = 1; i < scarcityScores.length; i++) {
    assert.ok(scarcityScores[i] >= scarcityScores[i - 1], `expected "${RARITY_TIERS[i]}" scarcityScore (${scarcityScores[i]}) >= "${RARITY_TIERS[i - 1]}" (${scarcityScores[i - 1]})`);
  }
  // And the climb is real, not flat -- the whole point of grounding
  // this against the scarcity curve at all.
  assert.ok(scarcityScores[scarcityScores.length - 1] > scarcityScores[0] + 30);
});
