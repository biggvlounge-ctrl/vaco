// Referrals, growth missions, ambassador tiers, and the KPI scorecard.
//
// Every assertion was watched failing against a reintroduced bug
// before being trusted, per
// `dev-docs/STANDING_INSTRUCTION_TEST_VERIFICATION.md`.

const test = require('node:test');
const assert = require('node:assert');

const {
  REFERRAL_STATUSES, AMBASSADOR_TIERS, GROWTH_MISSIONS,
  createReferralCode, getReferralCode, recordReferral, getReferral,
  convertReferral, rewardReferral, ambassadorTier, ambassadorScorecard, checkMissionProgress,
} = require('../lib/growthPrograms');
const { createVenvmStore } = require('../lib/store');

// -- Referral codes -------------------------------------------------------

test('createReferralCode is unique even for the same ambassador called twice', () => {
  const store = createVenvmStore();
  const a = createReferralCode(store, { ambassadorId: 'kaya' });
  const b = createReferralCode(store, { ambassadorId: 'kaya' });
  assert.notStrictEqual(a.code, b.code);
  assert.strictEqual(getReferralCode(store, a.code).ambassadorId, 'kaya');
});

test('recordReferral refuses a code that does not exist', () => {
  const store = createVenvmStore();
  assert.throws(() => recordReferral(store, { code: 'NOPE-1', referredId: 'sam' }), /no referral code/);
});

test('recordReferral refuses self-referral', () => {
  const store = createVenvmStore();
  const { code } = createReferralCode(store, { ambassadorId: 'kaya' });
  assert.throws(() => recordReferral(store, { code, referredId: 'kaya' }), /cannot refer themselves/);
});

test('the same person cannot be referred twice by the same ambassador', () => {
  const store = createVenvmStore();
  const { code } = createReferralCode(store, { ambassadorId: 'kaya' });
  recordReferral(store, { code, referredId: 'sam' });
  assert.throws(() => recordReferral(store, { code, referredId: 'sam' }), /already referred/);
});

test('a fresh referral starts pending, not converted', () => {
  const store = createVenvmStore();
  const { code } = createReferralCode(store, { ambassadorId: 'kaya' });
  const referral = recordReferral(store, { code, referredId: 'sam' });
  assert.strictEqual(referral.status, 'pending');
  assert.ok(REFERRAL_STATUSES.includes(referral.status));
});

// -- Conversion and reward -------------------------------------------

test('convertReferral refuses a referral that is not pending', () => {
  const store = createVenvmStore();
  const { code } = createReferralCode(store, { ambassadorId: 'kaya' });
  const referral = recordReferral(store, { code, referredId: 'sam' });
  convertReferral(store, { referralId: referral.id });
  assert.throws(() => convertReferral(store, { referralId: referral.id }), /expected "pending"/);
});

test('rewardReferral requires the referral to already be converted', () => {
  const store = createVenvmStore();
  const { code } = createReferralCode(store, { ambassadorId: 'kaya' });
  const referral = recordReferral(store, { code, referredId: 'sam' });
  assert.throws(() => rewardReferral(store, { referralId: referral.id, rewardAmount: 10 }), /expected "converted"/);
});

test('rewardReferral records a real reward amount and refuses a non-positive one', () => {
  const store = createVenvmStore();
  const { code } = createReferralCode(store, { ambassadorId: 'kaya' });
  const referral = recordReferral(store, { code, referredId: 'sam' });
  convertReferral(store, { referralId: referral.id });
  assert.throws(() => rewardReferral(store, { referralId: referral.id, rewardAmount: 0 }), /positive rewardAmount/);
  const rewarded = rewardReferral(store, { referralId: referral.id, rewardAmount: 25 });
  assert.strictEqual(rewarded.status, 'rewarded');
  assert.strictEqual(rewarded.rewardAmount, 25);
});

// -- Ambassador tiers -------------------------------------------------

test('ambassadorTier climbs only on real converted-or-better referrals, pending ones do not count', () => {
  const store = createVenvmStore();
  const { code } = createReferralCode(store, { ambassadorId: 'kaya' });
  for (let i = 0; i < 3; i += 1) {
    recordReferral(store, { code, referredId: `pending-${i}` }); // left pending on purpose
  }
  assert.strictEqual(ambassadorTier(store, 'kaya'), 'none', 'pending referrals should not count toward a tier');

  for (let i = 0; i < 3; i += 1) {
    const r = recordReferral(store, { code, referredId: `converted-${i}` });
    convertReferral(store, { referralId: r.id });
  }
  assert.strictEqual(ambassadorTier(store, 'kaya'), 'bronze');
});

test('AMBASSADOR_TIERS is ordered ascending by minConverted', () => {
  for (let i = 1; i < AMBASSADOR_TIERS.length; i += 1) {
    assert.ok(AMBASSADOR_TIERS[i].minConverted > AMBASSADOR_TIERS[i - 1].minConverted);
  }
});

// -- KPI scorecard ------------------------------------------------------

test('ambassadorScorecard counts real referrals by status and sums real rewards only', () => {
  const store = createVenvmStore();
  const { code } = createReferralCode(store, { ambassadorId: 'kaya' });
  const r1 = recordReferral(store, { code, referredId: 'sam' });
  const r2 = recordReferral(store, { code, referredId: 'bo' });
  const r3 = recordReferral(store, { code, referredId: 'dee' });
  convertReferral(store, { referralId: r1.id });
  rewardReferral(store, { referralId: r1.id, rewardAmount: 10 });
  convertReferral(store, { referralId: r2.id });
  // r3 stays pending

  const card = ambassadorScorecard(store, 'kaya');
  assert.strictEqual(card.totalReferrals, 3);
  assert.strictEqual(card.byStatus.pending, 1);
  assert.strictEqual(card.byStatus.converted, 1);
  assert.strictEqual(card.byStatus.rewarded, 1);
  assert.strictEqual(card.totalRewardEarned, 10, 'a converted-but-not-yet-rewarded referral must not count toward earnings');
  assert.strictEqual(card.conversionRate, Math.round((2 / 3) * 100) / 100);
});

test('ambassadorScorecard for an ambassador with no referrals reports a real, unmeasured rate', () => {
  const store = createVenvmStore();
  const card = ambassadorScorecard(store, 'nobody');
  assert.strictEqual(card.totalReferrals, 0);
  assert.strictEqual(card.conversionRate, null);
  assert.strictEqual(card.totalRewardEarned, 0);
});

// -- Growth missions ----------------------------------------------------

test('checkMissionProgress refuses an unknown mission key', () => {
  const store = createVenvmStore();
  assert.throws(() => checkMissionProgress(store, { ambassadorId: 'kaya', missionKey: 'made-up' }), /not a real growth mission/);
});

test('every real mission in GROWTH_MISSIONS has a positive requiredCount', () => {
  for (const [key, mission] of Object.entries(GROWTH_MISSIONS)) {
    assert.ok(mission.requiredCount > 0, `${key} has a non-positive requiredCount`);
  }
});

test('a mission with a referralType only counts referrals of that exact type', () => {
  const store = createVenvmStore();
  const { code } = createReferralCode(store, { ambassadorId: 'kaya' });
  const userReferral = recordReferral(store, { code, referredId: 'sam', referralType: 'user' });
  convertReferral(store, { referralId: userReferral.id });
  const creatorReferral = recordReferral(store, { code, referredId: 'bo', referralType: 'creator' });
  convertReferral(store, { referralId: creatorReferral.id });

  const progress = checkMissionProgress(store, { ambassadorId: 'kaya', missionKey: 'recruit-3-creators' });
  assert.strictEqual(progress.currentCount, 1, 'the user-type referral must not count toward a creator-only mission');
  assert.strictEqual(progress.complete, false);
});

test('a mission completes exactly when currentCount reaches requiredCount, pending referrals excluded', () => {
  const store = createVenvmStore();
  const { code } = createReferralCode(store, { ambassadorId: 'kaya' });
  const r = recordReferral(store, { code, referredId: 'sam' });
  let progress = checkMissionProgress(store, { ambassadorId: 'kaya', missionKey: 'first-referral' });
  assert.strictEqual(progress.complete, false, 'a pending referral should not complete the mission');

  convertReferral(store, { referralId: r.id });
  progress = checkMissionProgress(store, { ambassadorId: 'kaya', missionKey: 'first-referral' });
  assert.strictEqual(progress.complete, true);
});
