// Length tiers, destination routing, and the allocation.
//
// Every assertion was watched failing against a reintroduced bug
// before being trusted, per
// `dev-docs/STANDING_INSTRUCTION_TEST_VERIFICATION.md`.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const {
  RoutingError, LENGTH_TIERS, DESTINATIONS, PLANNED_TOTAL, ALLOCATED, UNALLOCATED,
  MIN_TIER_SEC, assertContiguous,
  getDestination, classifyLength, tiersFor, remainingFor, assertRoutable,
  orphanTiers, describePlan,
} = require('../lib/contentRouting');

const { createProductionJob } = require('../lib/productionPipeline');
const newStore = () => ({ productionJobs: [], nextProductionJobId: 1, likenessConsents: [] });

// -- The allocation ------------------------------------------------------

test('the four allocations sum to 750 against a planned 1,000', () => {
  // The arithmetic the plan does not do for itself. Asserted so nobody
  // has to rediscover the shortfall by adding it up again.
  assert.equal(PLANNED_TOTAL, 1000);
  assert.equal(ALLOCATED, 750);
  assert.equal(UNALLOCATED, 250);
  assert.equal(DESTINATIONS.reduce((n, d) => n + d.allocation, 0), ALLOCATED);
});

test('the allocations are exactly the ones the plan names', () => {
  assert.equal(getDestination('dreams-vmall').allocation, 350);
  assert.equal(getDestination('hvntz-business').allocation, 200);
  assert.equal(getDestination('vulture-flix').allocation, 100);
  assert.equal(getDestination('social').allocation, 100);
});

test('the shortfall is reported, not smoothed over', () => {
  const plan = describePlan();
  assert.equal(plan.unallocated, 250);
  assert.match(plan.note, /not assigned to any destination/);
  // And it must not be silently folded into a destination.
  assert.equal(plan.destinations.reduce((n, d) => n + d.allocation, 0), 750);
});

test('every destination points at an app that exists in this repo', () => {
  // A route to an app that is not here is a route to nothing.
  for (const dest of DESTINATIONS) {
    for (const app of [dest.app, dest.secondaryApp].filter(Boolean)) {
      assert.ok(
        fs.existsSync(path.join(__dirname, '..', '..', app)),
        `${dest.key} routes to "${app}", which is not a directory in this repo`,
      );
    }
  }
});

// -- The tiers, and the gaps between them --------------------------------

test('the four tiers are exactly the contiguous ranges that were decided', () => {
  assert.deepEqual(
    LENGTH_TIERS.map((t) => [t.key, t.minSec, t.maxSec]),
    [
      ['short', 5, 19],
      ['medium', 20, 59],
      ['long-form', 60, 299],
      ['flagship', 300, null],
    ],
  );
});

test('there is no hole between any two tiers', () => {
  // The property the tiers were changed to have. Asserted structurally
  // rather than by sampling seconds, so a future edit that reopens a
  // gap fails here with the gap named, instead of failing whenever
  // somebody happens to upload a video of the wrong length.
  assert.deepEqual(assertContiguous(), []);
});

test('every second from the floor upward lands in exactly one tier', () => {
  // The same property from the other side, and the one that would have
  // caught the original spec: 16-29s and 61-119s belonged to no tier.
  for (let sec = MIN_TIER_SEC; sec <= 400; sec += 1) {
    const matches = LENGTH_TIERS.filter(
      (t) => sec >= t.minSec && (t.maxSec === null || sec <= t.maxSec),
    );
    assert.equal(matches.length, 1, `${sec}s matched ${matches.length} tiers, not exactly one`);
  }
});

test('durations classify to their tier, boundaries included', () => {
  for (const [sec, expected] of [
    [5, 'short'], [10, 'short'], [19, 'short'],
    [20, 'medium'], [45, 'medium'], [59, 'medium'],
    [60, 'long-form'], [240, 'long-form'], [299, 'long-form'],
    [300, 'flagship'], [301, 'flagship'], [3600, 'flagship'],
  ]) {
    assert.equal(classifyLength(sec).tier, expected, `${sec}s classified wrong`);
  }
});

test('the seconds that used to fall in a hole now have a tier', () => {
  // The originally-orphaned ranges, pinned by name so the fix cannot
  // silently regress.
  for (const sec of [16, 20, 25, 29]) assert.ok(classifyLength(sec).tier, `${sec}s still has no tier`);
  for (const sec of [61, 90, 119]) assert.ok(classifyLength(sec).tier, `${sec}s still has no tier`);
});

test('a video under the floor is refused, and not rounded up into Short', () => {
  // The one remaining refusal, and it is a real lower bound rather
  // than a gap: a 2-second clip is not a Short.
  for (const sec of [1, 2, 4]) {
    const r = classifyLength(sec);
    assert.equal(r.tier, null, `${sec}s was rounded up into "${r.tier}"`);
    assert.match(r.reason, /below the 5s floor/);
    assert.match(r.reason, /will not be rounded up/);
  }
  // And the floor itself is in.
  assert.equal(classifyLength(MIN_TIER_SEC).tier, 'short');
});

test('nonsense durations are refused rather than classified', () => {
  for (const bad of [0, -5, NaN, Infinity, null, undefined, '30']) {
    assert.equal(classifyLength(bad).tier, null, `${bad} was classified`);
  }
});

test('no tier is orphaned — every one has somewhere to go', () => {
  assert.deepEqual(orphanTiers(), []);
});

// -- Tier/destination fit ------------------------------------------------

test('a catalogue destination does not take short-form', () => {
  assert.throws(
    () => assertRoutable({ destination: 'vulture-flix', durationSeconds: 10 }),
    (e) => e instanceof RoutingError && /does not belong on Vvltvre Flix/.test(e.message),
  );
  // And does take what it is for.
  assert.equal(assertRoutable({ destination: 'vulture-flix', durationSeconds: 600 }).tier, 'flagship');
});

test('screen and social destinations do not take long-form', () => {
  for (const dest of ['dreams-vmall', 'social']) {
    assert.throws(
      () => assertRoutable({ destination: dest, durationSeconds: 240 }),
      (e) => /does not belong on/.test(e.message),
      `${dest} accepted a long-form video`,
    );
  }
});

test('HVNTZ business content takes medium and long-form, not shorts', () => {
  assert.equal(tiersFor('hvntz-business').sort().join(), 'long-form,medium');
  assert.equal(assertRoutable({ destination: 'hvntz-business', durationSeconds: 45 }).tier, 'medium');
  assert.throws(() => assertRoutable({ destination: 'hvntz-business', durationSeconds: 10 }), /does not belong/);
});

test('an unknown destination is refused, and the message lists the real ones', () => {
  assert.throws(
    () => assertRoutable({ destination: 'vmall', durationSeconds: 10 }),
    (e) => /no destination "vmall"/.test(e.message) && /dreams-vmall/.test(e.message),
  );
});

// -- Quotas --------------------------------------------------------------

test('a destination at its allocation refuses the next video', () => {
  const full = { 'vulture-flix': 100 };
  assert.throws(
    () => assertRoutable({ destination: 'vulture-flix', durationSeconds: 600, produced: full }),
    (e) => /used its full allocation of 100/.test(e.message),
  );
  // The refusal points at the unassigned pool rather than just saying no.
  try {
    assertRoutable({ destination: 'vulture-flix', durationSeconds: 600, produced: full });
  } catch (e) {
    assert.match(e.message, /250 of the 1000 planned videos are still unassigned/);
  }
});

test('one under the allocation still routes', () => {
  const r = assertRoutable({
    destination: 'vulture-flix', durationSeconds: 600, produced: { 'vulture-flix': 99 },
  });
  assert.equal(r.remaining, 1);
});

test('remainingFor counts down and never goes negative', () => {
  assert.equal(remainingFor('dreams-vmall'), 350);
  assert.equal(remainingFor('dreams-vmall', { 'dreams-vmall': 50 }), 300);
  assert.equal(remainingFor('dreams-vmall', { 'dreams-vmall': 9999 }), 0);
  assert.throws(() => remainingFor('nope'), /no destination/);
});

test("one destination's usage does not consume another's", () => {
  assert.equal(remainingFor('social', { 'dreams-vmall': 350 }), 100);
});

// -- The gate in the production pipeline ---------------------------------

test('a routed job records its destination and tier', () => {
  const store = newStore();
  const job = createProductionJob(store, {
    requesterApp: 'hvntz', title: 'Storefront promo',
    destination: 'hvntz-business', durationSeconds: 45,
  });
  assert.equal(job.destination, 'hvntz-business');
  assert.equal(job.lengthTier, 'medium');
  assert.equal(job.durationSeconds, 45);
});

test('a job that could never be routed is never created', () => {
  // Same posture as the likeness-consent gate: refused before the job
  // exists, not after it is queued.
  const store = newStore();
  assert.throws(
    () => createProductionJob(store, {
      requesterApp: 'x', title: 'too short for Flix',
      destination: 'vulture-flix', durationSeconds: 10,
    }),
    RoutingError,
  );
  assert.equal(store.productionJobs.length, 0, 'a refused job was still stored');
});

test('destination and duration are both-or-neither', () => {
  const store = newStore();
  for (const half of [{ destination: 'social' }, { durationSeconds: 10 }]) {
    assert.throws(
      () => createProductionJob(store, { requesterApp: 'x', title: 't', ...half }),
      (e) => /go together/.test(e.message),
    );
  }
  assert.equal(store.productionJobs.length, 0);
});

test('jobs predating the plan still work, with no routing recorded', () => {
  // The plan must not break the pipeline that existed before it.
  const store = newStore();
  const job = createProductionJob(store, { requesterApp: 'hvntz', title: 'legacy' });
  assert.equal(job.destination, null);
  assert.equal(job.lengthTier, null);
  assert.equal(job.stage, 'script-ready');
});

test('describePlan reports remaining capacity per destination', () => {
  const plan = describePlan({ 'dreams-vmall': 100, 'social': 100 });
  const byKey = Object.fromEntries(plan.destinations.map((d) => [d.key, d]));
  assert.equal(byKey['dreams-vmall'].remaining, 250);
  assert.equal(byKey.social.remaining, 0);
  assert.equal(byKey['vulture-flix'].remaining, 100);
});
