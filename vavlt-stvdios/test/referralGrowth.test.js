// Vavlt Stvdios — a referral tier bonus settles once per real
// referrer, and a refused bonus doesn't leave the tier stuck.
//
// **Why this file exists.** `referralGrowth.js` had zero coverage
// while moving real VCoin on every tier crossing. Two quiet failures
// targeted:
//
//   - the settlement reason -- which doubles as V3's idempotency key,
//     see server.js's settleVCoin -- used to omit referrerId entirely
//     (`vavlt_stvdios_referral_tier:${threshold}`). Every referrer who
//     ever crossed the same tier shared the exact same key, so the
//     next unrelated referrer to cross it collided with whoever got
//     there first and was refused by V3 outright.
//   - that refusal used to throw AFTER `tiersReached`/`spinsAvailable`
//     had already been mutated, with nothing to undo it -- the
//     referrer was left permanently "credited" for a tier whose bonus
//     never arrived, and the guard against re-crediting a tier meant
//     no retry could ever reach settleFn again for it.
//
// Asserted on the real settlement and the real record state, never
// just on a returned object.

const test = require('node:test');
const assert = require('node:assert');

const { createVavltStvdiosStore } = require('../lib/store');
const {
  recordReferral, getReferralProgress, VAVLT_STVDIOS_GROWTH_ACCOUNT,
} = require('../lib/referralGrowth');

// Reproduces V3's real idempotency behavior: a reused key whose body
// differs is refused (422), not replayed -- the exact gap a plain
// call-recording mock leaves open.
function idempotentLedger() {
  const seen = new Map();
  const moves = [];
  const fn = async (legs, meta = {}) => {
    const fingerprint = JSON.stringify(legs);
    if (meta.reason) {
      const prior = seen.get(meta.reason);
      if (prior !== undefined && prior !== fingerprint) {
        throw new Error(`Idempotency-Key "settle:${meta.reason}" was already used for a different request.`);
      }
      seen.set(meta.reason, fingerprint);
    }
    moves.push(...legs);
    return { ok: true };
  };
  fn.moves = moves;
  fn.totalTo = (who) => moves.filter((m) => m.toUserId === who).reduce((n, m) => n + m.amount, 0);
  return fn;
}

function recorder({ failNext = false } = {}) {
  const moves = [];
  let refuse = failNext;
  const fn = async (legs) => {
    if (refuse) { refuse = false; throw new Error('V3 unreachable'); }
    moves.push(...legs);
    return { ok: true };
  };
  fn.moves = moves;
  return fn;
}

test('two different referrers each crossing tier 1 both get paid -- the key is not a bare threshold literal', async () => {
  const store = createVavltStvdiosStore();
  const fn = idempotentLedger();

  // Pre-fix, this is exactly the sequence that broke: both bonuses
  // share the identical reason "vavlt_stvdios_referral_tier:1", so the
  // second referrer -- a different toUserId -- collides with the
  // first's idempotency key and is refused outright.
  const first = await recordReferral(store, { referrerId: 'ada', refereeId: 'r1', settleFn: fn });
  const second = await recordReferral(store, { referrerId: 'bo', refereeId: 'r2', settleFn: fn });

  assert.strictEqual(first.tierReached.threshold, 1);
  assert.strictEqual(second.tierReached.threshold, 1,
    'the second referrer to ever cross this tier must not be refused');
  assert.strictEqual(fn.totalTo('ada'), 10);
  assert.strictEqual(fn.totalTo('bo'), 10);
});

test('a refused tier bonus does not leave the tier permanently credited', async () => {
  const store = createVavltStvdiosStore();
  const fn = recorder({ failNext: true });

  await assert.rejects(
    () => recordReferral(store, { referrerId: 'ada', refereeId: 'r1', settleFn: fn }),
    /V3 unreachable/,
  );

  const progress = getReferralProgress(store, 'ada');
  // The referral itself is real regardless of the bonus settlement,
  // but the tier credit and the spins it unlocked must not survive a
  // refused payout -- otherwise the referrer is "rewarded" forever
  // with no way to actually collect the VCoin, since re-crediting an
  // already-reached tier is refused by recordReferral's own guard.
  assert.strictEqual(progress.spinsAvailable, 0,
    'spins must not be credited for a bonus that was never actually paid');
  assert.strictEqual(fn.moves.length, 0);

  // referralCount itself already advanced from the failed attempt
  // above (the referral relationship is real regardless of the bonus),
  // so two more referrals reach tier 3 next -- which must still pay in
  // full, proving the rolled-back tier 1 credit did not leave the
  // record permanently stuck.
  const healthyFn = recorder();
  await recordReferral(store, { referrerId: 'ada', refereeId: 'r2', settleFn: healthyFn });
  const third = await recordReferral(store, { referrerId: 'ada', refereeId: 'r3', settleFn: healthyFn });

  assert.strictEqual(third.tierReached.threshold, 3);
  assert.strictEqual(healthyFn.moves.length, 1);
  assert.strictEqual(healthyFn.moves[0].amount, 25);
});

test('crossing the same tier twice for one referrer only pays once', async () => {
  const store = createVavltStvdiosStore();
  const fn = recorder();

  await recordReferral(store, { referrerId: 'ada', refereeId: 'r1', settleFn: fn });
  await recordReferral(store, { referrerId: 'ada', refereeId: 'r2', settleFn: fn });
  const third = await recordReferral(store, { referrerId: 'ada', refereeId: 'r3', settleFn: fn });

  // Tier 1 pays once (at referral 1); referral 2 crosses no new tier;
  // referral 3 pays tier 3.
  assert.strictEqual(third.tierReached.threshold, 3);
  assert.strictEqual(fn.moves.length, 2, 'only genuine tier crossings settle, not every referral');
  assert.strictEqual(fn.moves.reduce((n, m) => n + m.amount, 0), 35);
});
