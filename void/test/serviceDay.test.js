// VOID -- provider profiles, skills, and the cross-vertical service day.
//
// The failure modes here are scheduling failures, which are quiet by
// nature. A plan that sends a provider to two places at once still
// returns a well-formed schedule. A skill check dropped from the
// matcher still works for every provider who happens to be qualified.
// A licensing-gated vertical accepting a *claimed* skill instead of a
// verified one puts someone on an unlicensed cannabis run and returns
// 200.

const test = require('node:test');
const assert = require('node:assert');

const {
  registerProvider, addSkill, verifySkill, suspendSkill,
  canWorkVertical, addAvailability, listProvidersForVertical,
  describeProviderCapabilities, DEFAULT_SERVICE_RADIUS_KM,
} = require('../lib/providerProfiles');
const { buildServiceDay, suggestSkillsToAdd } = require('../lib/serviceDay');
const { recordVetting } = require('../lib/serviceCommon');
const { requestJob } = require('../lib/marketplace');
const { createVoidStore } = require('../lib/store');

const DAY = Date.UTC(2026, 8, 1);
const H = 60 * 60 * 1000;

// Manhattan-ish; close enough that travel never dominates.
const BASE = { homeBaseLat: 40.7128, homeBaseLng: -74.0060 };

// Identity-verified by default. Most verticals that involve a home, a
// key, or property require it (see lib/serviceCommon.js), so a bare
// provider would trip the vetting gate before reaching whatever a test
// is actually about.
function provider(store, id = 'maria', overrides = {}) {
  const profile = registerProvider(store, {
    providerId: id, displayName: id, ...BASE, ...overrides,
  });
  recordVetting(store, {
    providerId: id, level: 'identity-verified',
    verifiedBy: 'trust-ops', referenceId: `IDV-${id}`,
  });
  return profile;
}

function job(store, verticalId, hour, overrides = {}) {
  return requestJob(store, {
    verticalId,
    customerId: 'cust',
    quantity: 1,
    unitPrice: 100,
    scheduledFor: DAY + hour * H,
    lat: 40.713,
    lng: -74.0055,
    durationMinutes: 30,
    ...overrides,
  });
}

// -- registration -----------------------------------------------------

test('an individual and a business are both providers, one shape', () => {
  const store = createVoidStore();
  const solo = provider(store, 'maria');
  const biz = registerProvider(store, {
    providerId: 'suds', displayName: 'Suds', providerType: 'business',
    businessName: 'Suds & Co', crewSize: 6, ...BASE,
  });

  assert.strictEqual(solo.providerType, 'individual');
  assert.strictEqual(solo.crewSize, 1);
  assert.strictEqual(biz.providerType, 'business');
  assert.strictEqual(biz.crewSize, 6);
});

test('a business without a name is refused', () => {
  // Otherwise it is an individual with extra steps, and the name is
  // what a customer actually sees.
  const store = createVoidStore();
  assert.throws(() => registerProvider(store, {
    providerId: 'x', displayName: 'x', providerType: 'business', ...BASE,
  }), /businessName/);
});

test('registering the same provider twice is refused', () => {
  const store = createVoidStore();
  provider(store, 'maria');
  assert.throws(() => provider(store, 'maria'), /already registered/);
});

test('a provider needs a real location', () => {
  const store = createVoidStore();
  assert.throws(() => registerProvider(store, {
    providerId: 'x', displayName: 'x', homeBaseLat: 'forty', homeBaseLng: -74,
  }), /numeric homeBaseLat/);
});

// -- skills -----------------------------------------------------------

test('a claimed skill is enough for a vertical needing no vetting', () => {
  // Courier deliberately requires no vetting -- dropping a package is
  // not unsupervised access to a person or an empty home.
  const store = createVoidStore();
  provider(store);
  addSkill(store, { providerId: 'maria', verticalId: 'courier' });
  assert.strictEqual(canWorkVertical(store, 'maria', 'courier').allowed, true);
});

test('a LICENSING-GATED vertical requires a verified skill, not a claimed one', () => {
  // The important one. A claimed skill is someone saying they are
  // licensed. That is not evidence.
  const store = createVoidStore();
  provider(store);
  // Credential vetting recorded up front so this test isolates the
  // licensing rule rather than tripping the vetting gate first.
  recordVetting(store, {
    providerId: 'maria', level: 'credential-verified', verifiedBy: 'trust-ops',
    referenceId: 'CRED-1', expiresAt: DAY + 365 * 24 * H,
  });
  addSkill(store, { providerId: 'maria', verticalId: 'cannabisDelivery' });

  const claimed = canWorkVertical(store, 'maria', 'cannabisDelivery');
  assert.strictEqual(claimed.allowed, false);
  assert.match(claimed.reason, /licensing-gated/);

  verifySkill(store, { providerId: 'maria', verticalId: 'cannabisDelivery' });
  assert.strictEqual(canWorkVertical(store, 'maria', 'cannabisDelivery').allowed, true);
});

test('both licensing-gated verticals behave the same way', () => {
  const store = createVoidStore();
  provider(store);
  recordVetting(store, {
    providerId: 'maria', level: 'credential-verified', verifiedBy: 'trust-ops',
    referenceId: 'CRED-2', expiresAt: DAY + 365 * 24 * H,
  });
  for (const v of ['cannabisDelivery', 'medicalTransportation']) {
    addSkill(store, { providerId: 'maria', verticalId: v });
    assert.strictEqual(canWorkVertical(store, 'maria', v).allowed, false, `${v} must require verification`);
  }
});

test('a suspended skill blocks work even when previously verified', () => {
  const store = createVoidStore();
  provider(store);
  addSkill(store, { providerId: 'maria', verticalId: 'petCare' });
  verifySkill(store, { providerId: 'maria', verticalId: 'petCare' });
  suspendSkill(store, { providerId: 'maria', verticalId: 'petCare', reason: 'complaint' });

  assert.strictEqual(canWorkVertical(store, 'maria', 'petCare').allowed, false);
});

test('a skill nobody claimed cannot be worked', () => {
  const store = createVoidStore();
  provider(store);
  assert.strictEqual(canWorkVertical(store, 'maria', 'laundry').allowed, false);
});

test('an unregistered provider can work nothing', () => {
  const store = createVoidStore();
  assert.strictEqual(canWorkVertical(store, 'ghost', 'petCare').allowed, false);
});

test('capabilities separate what is workable from what is blocked, with reasons', () => {
  const store = createVoidStore();
  provider(store);
  addSkill(store, { providerId: 'maria', verticalId: 'petCare' });
  addSkill(store, { providerId: 'maria', verticalId: 'cannabisDelivery' });

  const caps = describeProviderCapabilities(store, 'maria');
  assert.deepStrictEqual(caps.workable.map((w) => w.verticalId), ['petCare']);
  assert.strictEqual(caps.blocked.length, 1);
  assert.match(caps.blocked[0].reason, /licensing-gated/);
});

test('listProvidersForVertical excludes the unqualified', () => {
  const store = createVoidStore();
  provider(store, 'maria');
  provider(store, 'dan');
  addSkill(store, { providerId: 'maria', verticalId: 'laundry' });

  const found = listProvidersForVertical(store, 'laundry');
  assert.deepStrictEqual(found.map((p) => p.providerId), ['maria']);
});

// -- availability -----------------------------------------------------

test('overlapping availability windows are refused', () => {
  // Overlap lets the planner double-book the same hour against itself,
  // which surfaces as a provider sent to two places at once.
  const store = createVoidStore();
  provider(store);
  addAvailability(store, { providerId: 'maria', startsAt: DAY + 8 * H, endsAt: DAY + 12 * H });
  assert.throws(() => addAvailability(store, {
    providerId: 'maria', startsAt: DAY + 11 * H, endsAt: DAY + 14 * H,
  }), /overlaps/);
});

test('a window must end after it starts', () => {
  const store = createVoidStore();
  provider(store);
  assert.throws(() => addAvailability(store, {
    providerId: 'maria', startsAt: DAY + 12 * H, endsAt: DAY + 8 * H,
  }), /endsAt after startsAt/);
});

// -- the service day --------------------------------------------------

test('a day spans several verticals -- the whole point', () => {
  const store = createVoidStore();
  provider(store);
  for (const v of ['petCare', 'laundry', 'courier']) {
    addSkill(store, { providerId: 'maria', verticalId: v });
  }
  job(store, 'petCare', 9);
  job(store, 'laundry', 11);
  job(store, 'courier', 14);

  const day = buildServiceDay(store, {
    providerId: 'maria', dayStart: DAY + 8 * H, dayEnd: DAY + 18 * H, now: DAY,
  });

  assert.strictEqual(day.summary.jobCount, 3);
  assert.strictEqual(day.summary.verticalsSpanned, 3);
  assert.ok(day.summary.totalEarnings > 0);
});

test('a job in a vertical the provider lacks is not scheduled', () => {
  const store = createVoidStore();
  provider(store);
  addSkill(store, { providerId: 'maria', verticalId: 'petCare' });
  job(store, 'petCare', 9);
  job(store, 'laundry', 11);

  const day = buildServiceDay(store, {
    providerId: 'maria', dayStart: DAY + 8 * H, dayEnd: DAY + 18 * H, now: DAY,
  });
  assert.strictEqual(day.summary.jobCount, 1);
  assert.strictEqual(day.plan[0].verticalId, 'petCare');
});

test('a job outside the service radius is rejected with a reason', () => {
  const store = createVoidStore();
  provider(store, 'maria', { serviceRadiusKm: 5 });
  addSkill(store, { providerId: 'maria', verticalId: 'petCare' });
  // Roughly Philadelphia -- far outside a 5km radius.
  job(store, 'petCare', 9, { lat: 39.9526, lng: -75.1652 });

  const day = buildServiceDay(store, {
    providerId: 'maria', dayStart: DAY + 8 * H, dayEnd: DAY + 18 * H, now: DAY,
  });
  assert.strictEqual(day.summary.jobCount, 0);
  assert.match(day.rejected[0].reason, /exceeds .*radius/);
});

test('a job outside declared availability is rejected even inside the day', () => {
  // Free 9-12 and 3-6 must not be given a 1pm job just because it is
  // inside 8-18.
  const store = createVoidStore();
  provider(store);
  addSkill(store, { providerId: 'maria', verticalId: 'petCare' });
  addAvailability(store, { providerId: 'maria', startsAt: DAY + 9 * H, endsAt: DAY + 12 * H });
  job(store, 'petCare', 13);

  const day = buildServiceDay(store, {
    providerId: 'maria', dayStart: DAY + 8 * H, dayEnd: DAY + 18 * H, now: DAY,
  });
  assert.strictEqual(day.summary.jobCount, 0);
  assert.match(day.rejected[0].reason, /availability/);
});

test('an unschedulable job is reported as skipped, not silently dropped', () => {
  // A courier run posted for "whenever" is a real request. It is just
  // not day-plannable, and the provider should be able to see why.
  const store = createVoidStore();
  provider(store);
  addSkill(store, { providerId: 'maria', verticalId: 'courier' });
  requestJob(store, { verticalId: 'courier', customerId: 'c', quantity: 1, unitPrice: 25 });

  const day = buildServiceDay(store, {
    providerId: 'maria', dayStart: DAY + 8 * H, dayEnd: DAY + 18 * H, now: DAY,
  });
  assert.strictEqual(day.summary.jobCount, 0);
  assert.match(day.rejected[0].reason, /no location or scheduled time/);
});

test('earnings are net of the platform take, not gross', () => {
  const store = createVoidStore();
  provider(store);
  addSkill(store, { providerId: 'maria', verticalId: 'petCare' });
  job(store, 'petCare', 9, { unitPrice: 100 });

  const day = buildServiceDay(store, {
    providerId: 'maria', dayStart: DAY + 8 * H, dayEnd: DAY + 18 * H, now: DAY,
  });
  // petCare takes 20%.
  assert.strictEqual(day.plan[0].providerEarnings, 80);
});

test('utilisation accounts for unpaid travel', () => {
  const store = createVoidStore();
  provider(store);
  addSkill(store, { providerId: 'maria', verticalId: 'petCare' });
  job(store, 'petCare', 9);

  const day = buildServiceDay(store, {
    providerId: 'maria', dayStart: DAY + 8 * H, dayEnd: DAY + 18 * H, now: DAY,
  });
  assert.ok(day.summary.utilisationPercent > 0 && day.summary.utilisationPercent <= 100);
});

test('a day with no jobs returns an empty plan rather than throwing', () => {
  const store = createVoidStore();
  provider(store);
  const day = buildServiceDay(store, {
    providerId: 'maria', dayStart: DAY + 8 * H, dayEnd: DAY + 18 * H, now: DAY,
  });
  assert.deepStrictEqual(day.plan, []);
  assert.strictEqual(day.summary.totalEarnings, 0);
});

// -- skill suggestions ------------------------------------------------

test('suggestions surface a vertical with real unmet local demand', () => {
  const store = createVoidStore();
  provider(store);
  addSkill(store, { providerId: 'maria', verticalId: 'petCare' });
  job(store, 'petCare', 9);
  job(store, 'beauty', 14, { unitPrice: 120, durationMinutes: 60 });

  const suggestions = suggestSkillsToAdd(store, {
    providerId: 'maria', dayStart: DAY + 8 * H, dayEnd: DAY + 18 * H, now: DAY,
  });
  const beauty = suggestions.find((s) => s.verticalId === 'beauty');
  assert.ok(beauty, 'beauty should be suggested');
  assert.ok(beauty.additionalEarnings > 0);
});

test('a licensing-gated vertical is NEVER suggested', () => {
  // Suggesting someone add cannabis delivery to fill an afternoon is
  // recommending they work without a licence.
  const store = createVoidStore();
  provider(store);
  addSkill(store, { providerId: 'maria', verticalId: 'petCare' });

  const suggestions = suggestSkillsToAdd(store, {
    providerId: 'maria', dayStart: DAY + 8 * H, dayEnd: DAY + 18 * H, now: DAY,
  });
  for (const s of suggestions) {
    assert.ok(!['cannabisDelivery', 'medicalTransportation'].includes(s.verticalId),
      `${s.verticalId} must never be suggested`);
  }
});

test('suggesting does not permanently mutate the provider profile', () => {
  // The simulation adds a skill to test it and must remove it again.
  const store = createVoidStore();
  provider(store);
  addSkill(store, { providerId: 'maria', verticalId: 'petCare' });
  job(store, 'beauty', 14);

  suggestSkillsToAdd(store, {
    providerId: 'maria', dayStart: DAY + 8 * H, dayEnd: DAY + 18 * H, now: DAY,
  });

  const caps = describeProviderCapabilities(store, 'maria');
  assert.deepStrictEqual(caps.workable.map((w) => w.verticalId), ['petCare']);
});

test('the default service radius is a local one, not citywide', () => {
  // Travel is unpaid; a wide default quietly makes the work
  // unprofitable, which is why comparables default local too.
  assert.strictEqual(DEFAULT_SERVICE_RADIUS_KM, 25);
});
