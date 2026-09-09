// VOID -- the service engine across all 25 verticals.
//
// The engine's job is to make a lifecycle violation *impossible*
// rather than unlikely. "Delivered before picked up" and "started work
// before anyone priced it" should not be expressible, because both
// produce a well-formed record and a real-world mess.
//
// These tests also pin the config table itself. A vertical added
// without an archetype, or with a service menu that does not match its
// lifecycle, would fail silently at the first booking rather than at
// review.

const test = require('node:test');
const assert = require('node:assert');

const engine = require('../lib/serviceEngine');
const { SERVICE_CONFIGS } = require('../lib/verticalServiceConfigs');
const { VERTICALS } = require('../lib/verticals');
const { registerProvider, addSkill, verifySkill } = require('../lib/providerProfiles');
const { recordVetting, requiredVettingFor } = require('../lib/serviceCommon');
const { createVoidStore } = require('../lib/store');

// Records transfers instead of moving money, so a test can assert on
// exactly what would have been paid. Settlement now happens inside
// advanceBooking, so any transition to a completion state needs one.
function recorder() {
  const calls = [];
  const fn = async (from, to, amount, reason) => { calls.push({ from, to, amount, reason }); };
  fn.calls = calls;
  return fn;
}

// Settlement needs a transferFn; most tests do not care what it does.
const TEST_TRANSFER = async () => {};

const NOW = Date.UTC(2026, 8, 1);
const H = 60 * 60 * 1000;
const YEAR = 365 * 24 * H;

// Registers a provider vetted to whatever the vertical actually needs,
// so a test exercises the thing it is about rather than the gate.
function providerFor(store, verticalId, id = 'pro') {
  registerProvider(store, {
    providerId: id, displayName: id, homeBaseLat: 40.7, homeBaseLng: -74,
  });
  addSkill(store, { providerId: id, verticalId, now: NOW });
  const needed = requiredVettingFor(verticalId);
  if (needed !== 'none') {
    recordVetting(store, {
      providerId: id, level: needed, verifiedBy: 'ops', referenceId: `R-${id}-${verticalId}`,
      expiresAt: needed === 'identity-verified' ? null : NOW + YEAR, now: NOW,
    });
  }
  if (VERTICALS[verticalId].licensingGated) {
    verifySkill(store, { providerId: id, verticalId, now: NOW });
  }
  return id;
}

function firstService(verticalId) {
  return SERVICE_CONFIGS[verticalId].services[0];
}

// Satisfies requiredSubjectAttributes generically, so this helper works
// for every vertical without knowing any of them.
function subjectFor(store, verticalId, ownerId = 'sam') {
  const config = SERVICE_CONFIGS[verticalId];
  const attributes = {};
  for (const field of config.requiredSubjectAttributes || []) attributes[field] = 'x';
  return engine.registerSubject(store, {
    verticalId, ownerId, label: `${verticalId} subject`, attributes, now: NOW,
  });
}

function bookingFor(store, verticalId, overrides = {}) {
  const config = SERVICE_CONFIGS[verticalId];
  const providerId = overrides.providerId || providerFor(store, verticalId);
  const subjectId = config.requiresSubject ? subjectFor(store, verticalId).id : null;
  return engine.createServiceBooking(store, {
    verticalId,
    subjectId,
    customerId: 'sam',
    providerId,
    service: firstService(verticalId),
    scheduledFor: NOW + 48 * H,
    quotedTotal: 100,
    // Intro-gated verticals need this on a first booking.
    isIntroSession: Boolean(config.requiresIntroSession),
    now: NOW,
    ...overrides,
  });
}

// -- the config table itself -------------------------------------------

test('every registered vertical has a service config', async () => {
  const configured = Object.keys(SERVICE_CONFIGS);
  const missing = Object.keys(VERTICALS).filter((v) => !configured.includes(v));
  assert.deepStrictEqual(missing, [], 'every vertical must be a service app');
  assert.strictEqual(configured.length, 25);
});

test('no config names a vertical that does not exist', async () => {
  for (const verticalId of Object.keys(SERVICE_CONFIGS)) {
    assert.ok(VERTICALS[verticalId], `${verticalId} is configured but not a real vertical`);
  }
});

test('every vertical is describable through one interface', async () => {
  const store = createVoidStore();
  for (const verticalId of Object.keys(SERVICE_CONFIGS)) {
    const described = engine.describeService(store, verticalId);
    assert.ok(described.services.length > 0, `${verticalId} needs a service menu`);
    assert.ok(engine.ARCHETYPES.includes(described.archetype));
    assert.ok(described.lifecycle.length > 0);
  }
});

test('describeService reports the real vetting and licensing posture', async () => {
  const store = createVoidStore();
  assert.strictEqual(engine.describeService(store, 'childcare').requiredVetting, 'background-checked');
  assert.strictEqual(engine.describeService(store, 'cannabisDelivery').licensingGated, true);
  assert.strictEqual(engine.describeService(store, 'courier').requiredVetting, 'none');
});

test('only recurring verticals advertise recurring support', async () => {
  const store = createVoidStore();
  for (const verticalId of Object.keys(SERVICE_CONFIGS)) {
    const d = engine.describeService(store, verticalId);
    assert.strictEqual(d.supportsRecurring, d.archetype === 'recurring');
  }
});

// -- gates, checked once in the engine rather than per vertical ---------

test('an unvetted provider is refused in every vertical that requires vetting', async () => {
  for (const verticalId of Object.keys(SERVICE_CONFIGS)) {
    if (requiredVettingFor(verticalId) === 'none') continue;
    const store = createVoidStore();
    registerProvider(store, {
      providerId: 'bare', displayName: 'bare', homeBaseLat: 40.7, homeBaseLng: -74,
    });
    addSkill(store, { providerId: 'bare', verticalId, now: NOW });

    assert.throws(() => bookingFor(store, verticalId, { providerId: 'bare' }),
      /vetting|licensing-gated/, `${verticalId} must refuse an unvetted provider`);
  }
});

test('a service not on the vertical menu is refused', async () => {
  const store = createVoidStore();
  assert.throws(() => bookingFor(store, 'beauty', { service: 'oil-change' }),
    /is not a beauty service/);
});

test('a subject belonging to another vertical is refused', async () => {
  // Booking a lawn service against a car is exactly the kind of thing
  // a generic engine must not allow.
  const store = createVoidStore();
  providerFor(store, 'landscaping');
  const car = subjectFor(store, 'autoRepairDetailing');
  assert.throws(() => engine.createServiceBooking(store, {
    verticalId: 'landscaping', subjectId: car.id, customerId: 'sam',
    providerId: 'pro', service: 'mow', scheduledFor: NOW + 48 * H, now: NOW,
  }), /belongs to autoRepairDetailing/);
});

test('a vertical requiring a subject refuses a booking without one', async () => {
  const store = createVoidStore();
  providerFor(store, 'landscaping');
  assert.throws(() => engine.createServiceBooking(store, {
    verticalId: 'landscaping', customerId: 'sam', providerId: 'pro',
    service: 'mow', scheduledFor: NOW + 48 * H, now: NOW,
  }), /requires a subjectId/);
});

test('a required subject attribute cannot be omitted', async () => {
  // A lawn with no size cannot be quoted.
  const store = createVoidStore();
  assert.throws(() => engine.registerSubject(store, {
    verticalId: 'landscaping', ownerId: 'sam', label: 'Lawn', attributes: {}, now: NOW,
  }), /requires the "lotSizeSqM" attribute/);
});

test('an intro session is required before a first booking where configured', async () => {
  const store = createVoidStore();
  providerFor(store, 'childcare');
  const kid = subjectFor(store, 'childcare');

  assert.throws(() => engine.createServiceBooking(store, {
    verticalId: 'childcare', subjectId: kid.id, customerId: 'sam', providerId: 'pro',
    service: 'babysitting', scheduledFor: NOW + 48 * H, now: NOW,
  }), /requires a completed intro session/);
});

test('a completed intro session opens the gate', async () => {
  const store = createVoidStore();
  const intro = bookingFor(store, 'childcare');
  await engine.advanceBooking(store, { transferFn: TEST_TRANSFER, bookingId: intro.id, to: 'confirmed', now: NOW });
  await engine.advanceBooking(store, { transferFn: TEST_TRANSFER, bookingId: intro.id, to: 'in-progress', now: NOW });
  await engine.advanceBooking(store, { transferFn: TEST_TRANSFER, bookingId: intro.id, to: 'completed', now: NOW });

  const real = engine.createServiceBooking(store, {
    verticalId: 'childcare', subjectId: subjectFor(store, 'childcare').id,
    customerId: 'sam', providerId: 'pro', service: 'after-school',
    scheduledFor: NOW + 72 * H, now: NOW,
  });
  assert.strictEqual(real.status, 'requested');
});

// -- lifecycles: illegal transitions must be impossible -----------------

test('every archetype refuses a transition that skips a step', async () => {
  const store = createVoidStore();
  // round-trip: cannot start work before the item is assessed.
  const repair = bookingFor(store, 'autoRepairDetailing');
  await engine.advanceBooking(store, { transferFn: TEST_TRANSFER, bookingId: repair.id, to: 'collected', now: NOW });
  await assert.rejects(() => engine.advanceBooking(store, { transferFn: TEST_TRANSFER, bookingId: repair.id, to: 'in-progress', now: NOW }),
    /cannot go collected -> in-progress/);
});

test('a terminal state cannot be advanced out of', async () => {
  const store = createVoidStore();
  const b = bookingFor(store, 'beauty');
  await engine.advanceBooking(store, { transferFn: TEST_TRANSFER, bookingId: b.id, to: 'confirmed', now: NOW });
  await engine.advanceBooking(store, { transferFn: TEST_TRANSFER, bookingId: b.id, to: 'in-progress', now: NOW });
  await engine.advanceBooking(store, { transferFn: TEST_TRANSFER, bookingId: b.id, to: 'completed', now: NOW });
  await assert.rejects(() => engine.advanceBooking(store, { transferFn: TEST_TRANSFER, bookingId: b.id, to: 'in-progress', now: NOW }),
    /terminal state/);
});

test('every booking carries its own audit trail', async () => {
  const store = createVoidStore();
  const b = bookingFor(store, 'beauty');
  await engine.advanceBooking(store, { transferFn: TEST_TRANSFER, bookingId: b.id, to: 'confirmed', now: NOW });
  await engine.advanceBooking(store, { transferFn: TEST_TRANSFER, bookingId: b.id, to: 'in-progress', now: NOW + H });
  assert.deepStrictEqual(b.history.map((h) => h.status), ['requested', 'confirmed', 'in-progress']);
});

// -- pricing: the moment it stops being a guess --------------------------

test('a round-trip booking cannot reach "assessed" without a real total', async () => {
  const store = createVoidStore();
  const repair = bookingFor(store, 'autoRepairDetailing');
  await engine.advanceBooking(store, { transferFn: TEST_TRANSFER, bookingId: repair.id, to: 'collected', now: NOW });
  await assert.rejects(() => engine.advanceBooking(store, { transferFn: TEST_TRANSFER, bookingId: repair.id, to: 'assessed', now: NOW }),
    /requires a positive actualTotal/);
});

test('a quote booking cannot reach "quoted" without a real total', async () => {
  const store = createVoidStore();
  const move = bookingFor(store, 'freightMoving');
  await engine.advanceBooking(store, { transferFn: TEST_TRANSFER, bookingId: move.id, to: 'surveyed', now: NOW });
  await assert.rejects(() => engine.advanceBooking(store, { transferFn: TEST_TRANSFER, bookingId: move.id, to: 'quoted', now: NOW }),
    /requires a positive actualTotal/);
});

test('an appointment price is final at booking; a quote price is not', async () => {
  const store = createVoidStore();
  assert.strictEqual(bookingFor(store, 'beauty').priceIsFinal, true);

  const store2 = createVoidStore();
  assert.strictEqual(bookingFor(store2, 'freightMoving').priceIsFinal, false);
});

test('a total over the customer cap HOLDS the work', async () => {
  const store = createVoidStore();
  const repair = bookingFor(store, 'autoRepairDetailing');
  repair.maxAcceptableTotal = 300;
  await engine.advanceBooking(store, { transferFn: TEST_TRANSFER, bookingId: repair.id, to: 'collected', now: NOW });
  await engine.advanceBooking(store, { transferFn: TEST_TRANSFER, bookingId: repair.id, to: 'assessed', actualTotal: 520, now: NOW });

  assert.strictEqual(repair.requiresCustomerApproval, true);
  await assert.rejects(() => engine.advanceBooking(store, { transferFn: TEST_TRANSFER, bookingId: repair.id, to: 'in-progress', now: NOW }),
    /awaiting approval/);

  engine.approveOverCap(store, { bookingId: repair.id });
  assert.strictEqual(
    (await engine.advanceBooking(store, {
      transferFn: TEST_TRANSFER, bookingId: repair.id, to: 'in-progress', now: NOW,
    })).status,
    'in-progress',
  );
});

test('a total under the cap proceeds without approval', async () => {
  const store = createVoidStore();
  const repair = bookingFor(store, 'autoRepairDetailing');
  repair.maxAcceptableTotal = 600;
  await engine.advanceBooking(store, { transferFn: TEST_TRANSFER, bookingId: repair.id, to: 'collected', now: NOW });
  await engine.advanceBooking(store, { transferFn: TEST_TRANSFER, bookingId: repair.id, to: 'assessed', actualTotal: 520, now: NOW });
  assert.strictEqual(repair.requiresCustomerApproval, false);
});

// -- cancellation --------------------------------------------------------

test('a late customer cancellation charges them and pays the provider', async () => {
  const store = createVoidStore();
  const b = bookingFor(store, 'beauty', { scheduledFor: NOW + 2 * H });
  const { assessment } = engine.cancelServiceBooking(store, {
    bookingId: b.id, cancelledBy: 'customer', now: NOW,
  });
  assert.strictEqual(assessment.isLate, true);
  assert.ok(assessment.customerFee > 0);
  assert.strictEqual(assessment.customerFee, assessment.providerCompensation);
});

test('a per-vertical cancellation window overrides the default', async () => {
  // Childcare is configured at 48h because arranging replacement care
  // on short notice is genuinely hard.
  const store = createVoidStore();
  const b = bookingFor(store, 'childcare', { scheduledFor: NOW + 30 * H });
  const { assessment } = engine.cancelServiceBooking(store, { bookingId: b.id, now: NOW });
  assert.strictEqual(assessment.isLate, true, '30h notice is late under a 48h policy');
});

test('a completed booking can no longer be cancelled', async () => {
  const store = createVoidStore();
  const b = bookingFor(store, 'beauty');
  await engine.advanceBooking(store, { transferFn: TEST_TRANSFER, bookingId: b.id, to: 'confirmed', now: NOW });
  await engine.advanceBooking(store, { transferFn: TEST_TRANSFER, bookingId: b.id, to: 'in-progress', now: NOW });
  await engine.advanceBooking(store, { transferFn: TEST_TRANSFER, bookingId: b.id, to: 'completed', now: NOW });
  assert.throws(() => engine.cancelServiceBooking(store, { bookingId: b.id, now: NOW }),
    /can no longer be cancelled/);
});

// -- recurrence ----------------------------------------------------------

test('a recurring series generates evenly spaced bookings', async () => {
  const store = createVoidStore();
  providerFor(store, 'landscaping');
  const lawn = subjectFor(store, 'landscaping');
  const { bookings } = engine.createRecurringSeries(store, {
    verticalId: 'landscaping', subjectId: lawn.id, customerId: 'sam', providerId: 'pro',
    service: 'mow', firstScheduledFor: NOW + 9 * H, intervalDays: 14, occurrences: 6, now: NOW,
  });
  assert.strictEqual(bookings.length, 6);
  assert.strictEqual(bookings[1].scheduledFor - bookings[0].scheduledFor, 14 * 24 * H);
});

test('a non-recurring vertical refuses a series', async () => {
  const store = createVoidStore();
  providerFor(store, 'beauty');
  assert.throws(() => engine.createRecurringSeries(store, {
    verticalId: 'beauty', customerId: 'sam', providerId: 'pro', service: 'haircut',
    firstScheduledFor: NOW + 9 * H, intervalDays: 7, occurrences: 4, now: NOW,
  }), /is a "appointment" service, not a recurring one/);
});

test('cancelling a series leaves completed bookings alone', async () => {
  const store = createVoidStore();
  providerFor(store, 'landscaping');
  const lawn = subjectFor(store, 'landscaping');
  const { recurrenceId, bookings } = engine.createRecurringSeries(store, {
    verticalId: 'landscaping', subjectId: lawn.id, customerId: 'sam', providerId: 'pro',
    service: 'mow', firstScheduledFor: NOW + 9 * H, intervalDays: 7, occurrences: 3,
    quotedTotal: 60, now: NOW,
  });
  await engine.advanceBooking(store, { transferFn: TEST_TRANSFER, bookingId: bookings[0].id, to: 'confirmed', now: NOW });
  await engine.advanceBooking(store, { transferFn: TEST_TRANSFER, bookingId: bookings[0].id, to: 'in-progress', now: NOW });
  await engine.advanceBooking(store, { transferFn: TEST_TRANSFER, bookingId: bookings[0].id, to: 'completed', now: NOW });

  engine.cancelSeries(store, { recurrenceId, now: NOW });
  assert.strictEqual(engine.getServiceBooking(store, bookings[0].id).status, 'completed');
  assert.strictEqual(engine.getServiceBooking(store, bookings[1].id).status, 'cancelled');
});

// -- reading -------------------------------------------------------------

test('preferred providers exclude intro sessions from the count', async () => {
  const store = createVoidStore();
  const intro = bookingFor(store, 'childcare');
  for (const to of ['confirmed', 'in-progress', 'completed']) {
    await engine.advanceBooking(store, { transferFn: TEST_TRANSFER, bookingId: intro.id, to, now: NOW });
  }
  const real = engine.createServiceBooking(store, {
    verticalId: 'childcare', subjectId: subjectFor(store, 'childcare').id,
    customerId: 'sam', providerId: 'pro', service: 'after-school',
    scheduledFor: NOW + 72 * H, quotedTotal: 100, now: NOW,
  });
  for (const to of ['confirmed', 'in-progress', 'completed']) {
    await engine.advanceBooking(store, { transferFn: TEST_TRANSFER, bookingId: real.id, to, now: NOW + H });
  }

  const preferred = engine.preferredProviders(store, 'sam', 'childcare');
  assert.strictEqual(preferred.length, 1);
  assert.strictEqual(preferred[0].completedBookings, 1, 'the intro must not inflate the count');
});

test('bookings are filterable by vertical for one customer', async () => {
  const store = createVoidStore();
  bookingFor(store, 'beauty', { providerId: providerFor(store, 'beauty', 'salon') });
  bookingFor(store, 'landscaping', { providerId: providerFor(store, 'landscaping', 'green') });

  assert.strictEqual(engine.listBookingsForCustomer(store, 'sam').length, 2);
  assert.strictEqual(engine.listBookingsForCustomer(store, 'sam', 'beauty').length, 1);
});

// -- licensing-gated verticals stay gated --------------------------------

test('licensing-gated verticals are configured but still require a verified skill', async () => {
  for (const verticalId of ['cannabisDelivery', 'medicalTransportation']) {
    const store = createVoidStore();
    registerProvider(store, {
      providerId: 'p', displayName: 'p', homeBaseLat: 40.7, homeBaseLng: -74,
    });
    addSkill(store, { providerId: 'p', verticalId, now: NOW });
    recordVetting(store, {
      providerId: 'p', level: 'credential-verified', verifiedBy: 'ops',
      referenceId: `C-${verticalId}`, expiresAt: NOW + YEAR, now: NOW,
    });
    // Vetted but skill still only claimed.
    assert.throws(() => bookingFor(store, verticalId, { providerId: 'p' }),
      /licensing-gated/, `${verticalId} must still refuse a claimed skill`);
  }
});

// -- settlement: the join that makes these businesses rather than -------
// -- schedules ----------------------------------------------------------
//
// Until this existed, completing a booking changed a status and moved
// no money. Every one of the 25 service apps was a scheduling layer.

test('completing a booking pays the provider and takes the platform fee', async () => {
  const store = createVoidStore();
  const t = recorder();
  const b = bookingFor(store, 'beauty', { quotedTotal: 200 });

  await engine.advanceBooking(store, { bookingId: b.id, to: 'confirmed', transferFn: t, now: NOW });
  await engine.advanceBooking(store, { bookingId: b.id, to: 'in-progress', transferFn: t, now: NOW });
  await engine.advanceBooking(store, { bookingId: b.id, to: 'completed', transferFn: t, now: NOW });

  // beauty takes 20%.
  assert.strictEqual(b.providerPayout, 160);
  assert.strictEqual(b.platformFee, 40);
  assert.strictEqual(b.settledTotal, 200);

  assert.strictEqual(t.calls.length, 2, 'payout and fee are separately auditable');
  assert.strictEqual(t.calls[0].to, 'pro');
  assert.strictEqual(t.calls[0].amount, 160);
  assert.strictEqual(t.calls[1].to, engine.VOID_PLATFORM_ACCOUNT);
  assert.strictEqual(t.calls[1].amount, 40);
});

test('payout and fee always sum to exactly the total', async () => {
  // An awkward total is where a naive split loses a cent.
  const store = createVoidStore();
  const t = recorder();
  const b = bookingFor(store, 'beauty', { quotedTotal: 333.33 });
  for (const to of ['confirmed', 'in-progress', 'completed']) {
    await engine.advanceBooking(store, { bookingId: b.id, to, transferFn: t, now: NOW });
  }
  assert.strictEqual(Math.round((b.providerPayout + b.platformFee) * 100) / 100, 333.33);
});

test('a round trip settles at RETURNED, not at ready', async () => {
  // The item is not back with its owner until it is returned, and that
  // is when the work is actually done.
  const store = createVoidStore();
  const t = recorder();
  const repair = bookingFor(store, 'autoRepairDetailing');

  await engine.advanceBooking(store, { bookingId: repair.id, to: 'collected', transferFn: t, now: NOW });
  await engine.advanceBooking(store, { bookingId: repair.id, to: 'assessed', actualTotal: 500, transferFn: t, now: NOW });
  await engine.advanceBooking(store, { bookingId: repair.id, to: 'in-progress', transferFn: t, now: NOW });
  await engine.advanceBooking(store, { bookingId: repair.id, to: 'ready', transferFn: t, now: NOW });
  assert.strictEqual(t.calls.length, 0, 'nothing settles before the item is returned');

  await engine.advanceBooking(store, { bookingId: repair.id, to: 'returned', transferFn: t, now: NOW });
  assert.strictEqual(t.calls.length, 2);
  // The ASSESSED total settles, not the booking estimate.
  assert.strictEqual(repair.settledTotal, 500);
});

test('settlement uses the assessed total, never the estimate', async () => {
  const store = createVoidStore();
  const t = recorder();
  const repair = bookingFor(store, 'autoRepairDetailing', { quotedTotal: 100 });
  await engine.advanceBooking(store, { bookingId: repair.id, to: 'collected', transferFn: t, now: NOW });
  await engine.advanceBooking(store, { bookingId: repair.id, to: 'assessed', actualTotal: 640, transferFn: t, now: NOW });
  await engine.advanceBooking(store, { bookingId: repair.id, to: 'in-progress', transferFn: t, now: NOW });
  await engine.advanceBooking(store, { bookingId: repair.id, to: 'ready', transferFn: t, now: NOW });
  await engine.advanceBooking(store, { bookingId: repair.id, to: 'returned', transferFn: t, now: NOW });

  assert.strictEqual(repair.settledTotal, 640);
  assert.notStrictEqual(repair.settledTotal, 100);
});

test('completing without a transferFn is REFUSED, not silently unpaid', async () => {
  // The failure this prevents: a booking marked complete that paid
  // nobody, which nothing downstream would notice.
  const store = createVoidStore();
  const t = recorder();
  const b = bookingFor(store, 'beauty', { quotedTotal: 200 });
  await engine.advanceBooking(store, { bookingId: b.id, to: 'confirmed', transferFn: t, now: NOW });
  await engine.advanceBooking(store, { bookingId: b.id, to: 'in-progress', transferFn: t, now: NOW });

  await assert.rejects(
    () => engine.advanceBooking(store, { bookingId: b.id, to: 'completed', now: NOW }),
    /requires a transferFn/,
  );
  assert.strictEqual(b.status, 'in-progress', 'the booking must not advance');
});

test('a failed transfer leaves the booking UNCOMPLETED', async () => {
  // Settlement runs before the status changes, so a ledger failure
  // cannot leave a booking marked complete and unpaid.
  const store = createVoidStore();
  const failing = async () => { throw new Error('V3 unreachable'); };
  const b = bookingFor(store, 'beauty', { quotedTotal: 200 });
  await engine.advanceBooking(store, { bookingId: b.id, to: 'confirmed', transferFn: TEST_TRANSFER, now: NOW });
  await engine.advanceBooking(store, { bookingId: b.id, to: 'in-progress', transferFn: TEST_TRANSFER, now: NOW });

  await assert.rejects(
    () => engine.advanceBooking(store, { bookingId: b.id, to: 'completed', transferFn: failing, now: NOW }),
    /V3 unreachable/,
  );
  assert.strictEqual(b.status, 'in-progress');
  assert.strictEqual(b.settledAt, undefined);
});

test('a booking with no price cannot complete', async () => {
  const store = createVoidStore();
  const b = bookingFor(store, 'beauty', { quotedTotal: null });
  await engine.advanceBooking(store, { bookingId: b.id, to: 'confirmed', transferFn: TEST_TRANSFER, now: NOW });
  await engine.advanceBooking(store, { bookingId: b.id, to: 'in-progress', transferFn: TEST_TRANSFER, now: NOW });
  await assert.rejects(
    () => engine.advanceBooking(store, { bookingId: b.id, to: 'completed', transferFn: TEST_TRANSFER, now: NOW }),
    /no settleable total/,
  );
});

test('a cancelled booking never settles', async () => {
  const store = createVoidStore();
  const t = recorder();
  const b = bookingFor(store, 'beauty', { quotedTotal: 200 });
  engine.cancelServiceBooking(store, { bookingId: b.id, now: NOW });
  assert.strictEqual(t.calls.length, 0);
  assert.strictEqual(b.settledAt, undefined);
});

test('every vertical settles at its own take rate', async () => {
  // Spot-checks across archetypes that the rate comes from
  // verticals.js rather than a hardcoded default.
  for (const verticalId of ['beauty', 'landscaping', 'courier']) {
    const store = createVoidStore();
    const t = recorder();
    const b = bookingFor(store, verticalId, { quotedTotal: 100 });
    const settleState = engine.SETTLES_AT[SERVICE_CONFIGS[verticalId].archetype];
    const path = { completed: ['confirmed', 'in-progress', 'completed'] }[settleState];
    for (const to of path) {
      await engine.advanceBooking(store, { bookingId: b.id, to, transferFn: t, now: NOW });
    }
    const expectedFee = Math.round(100 * VERTICALS[verticalId].takeRate * 100) / 100;
    assert.strictEqual(b.platformFee, expectedFee, `${verticalId} fee`);
  }
});
