// HVNTZ's money path: the revenue stack's per-event platform split.
//
// HVNTZ was at zero coverage while running the widest money surface in
// the ecosystem — fourteen event types, each with its own VACO share,
// every one moving VCoin from a payer to a business owner and the
// platform.
//
// **Asserted on the money, never on a status.** `recordRevenueEvent`
// returns an event carrying `businessShare` and `vacoShare` fields, and
// a test reading only those would pass while `settleFn` moved nothing,
// moved to the wrong account, or charged the payer twice. Every money
// assertion here reads the recorded transfers.

const test = require('node:test');
const assert = require('node:assert');

const {
  REVENUE_EVENT_TYPES, REVENUE_SPLITS, VACO_PLATFORM_USER_ID,
  defaultVacoShareFor, createHvntzStore, registerBusiness, registerLocation,
  recordRevenueEvent, getRevenueEvents,
} = require('../lib/revenueStack');

function recorder() {
  const moves = [];
  // Takes a settlement and applies each leg, so every existing
  // assertion below reads exactly as it did when these were
  // separate transfers. `calls` is the new question: how many
  // times the ledger was asked. Amounts are identical whether a
  // settlement is atomic or split, which is why only a call count
  // can tell them apart.
  const calls = [];
  const fn = async (legs, meta = {}) => {
    calls.push({ legs, meta });
    for (const { fromUserId: fromUserId, toUserId: toUserId, amount: amount, reason: reason } of legs) {
      moves.push({ fromUserId, toUserId, amount, reason });
    }
    return { ok: true };
  };
  fn.calls = calls;
  fn.moves = moves;
  fn.totalTo = (who) => moves.filter((m) => m.toUserId === who).reduce((n, m) => n + m.amount, 0);
  fn.totalFrom = (who) => moves.filter((m) => m.fromUserId === who).reduce((n, m) => n + m.amount, 0);
  return fn;
}

function hostLocation(store) {
  const business = registerBusiness(store, { name: 'Ada Coffee', ownerId: 'owner-1' });
  const location = registerLocation(store, {
    businessId: business.id, locationType: 'screen', address: '1 Concourse Way',
    lat: 38.62, lng: -90.19,
  });
  return { business, location };
}

// -- The split -----------------------------------------------------------

test('a revenue event pays the business owner and the platform from the payer', async () => {
  const store = createHvntzStore();
  const { location } = hostLocation(store);
  const settleFn = recorder();

  await recordRevenueEvent(store, {
    locationId: location.id, eventType: 'screen-ad', amountEarned: 100,
    payerId: 'advertiser-1', settleFn,
  });

  // screen-ad's low end is 30%.
  assert.equal(settleFn.totalTo('owner-1'), 70);
  assert.equal(settleFn.totalTo(VACO_PLATFORM_USER_ID), 30);
  assert.equal(settleFn.totalFrom('advertiser-1'), 100, 'the payer was not charged exactly once');
});

test('the two shares always sum to the amount, at awkward amounts', async () => {
  // The module rounds VACO's share first and gives the business the
  // exact remainder, so the halves cannot drift apart by a cent. These
  // amounts are ones where two independent roundings would.
  for (const amount of [0.15, 0.25, 0.35, 1.05, 9.99, 33.33]) {
    const store = createHvntzStore();
    const { location } = hostLocation(store);
    const settleFn = recorder();
    await recordRevenueEvent(store, {
      locationId: location.id, eventType: 'screen-ad', amountEarned: amount,
      payerId: 'payer-1', settleFn,
    });
    const paid = Math.round(settleFn.totalFrom('payer-1') * 100) / 100;
    assert.equal(paid, amount, `at ${amount} the payer was charged ${paid}`);
  }
});

test('a zero-share event type pays the business everything and the platform nothing', async () => {
  // Several event types are deliberately 0% — infrastructure fees and
  // free/included placements. A test that only exercised a split type
  // would never reach the branch that skips the platform transfer.
  const store = createHvntzStore();
  const { location } = hostLocation(store);
  const settleFn = recorder();

  await recordRevenueEvent(store, {
    locationId: location.id, eventType: 'community-thread', amountEarned: 50,
    payerId: 'payer-1', settleFn,
  });

  assert.equal(defaultVacoShareFor('community-thread'), 0);
  assert.equal(settleFn.totalTo('owner-1'), 50);
  assert.equal(settleFn.totalTo(VACO_PLATFORM_USER_ID), 0);
  assert.equal(settleFn.moves.length, 1, 'a zero-value platform transfer was still sent');
});

test('every event type defaults to the low end of its own published range', async () => {
  // The interpretive default is flagged in the module; this pins it, so
  // a change to any of the fourteen is a deliberate edit rather than a
  // silent repricing of somebody's revenue.
  for (const eventType of REVENUE_EVENT_TYPES) {
    const split = REVENUE_SPLITS[eventType];
    assert.ok(split, `${eventType} has no published split`);
    assert.equal(
      defaultVacoShareFor(eventType), split.min,
      `${eventType} does not default to its low end`,
    );
  }
});

test('every published split is a real fraction, and min never exceeds max', () => {
  for (const [eventType, split] of Object.entries(REVENUE_SPLITS)) {
    assert.ok(split.min >= 0 && split.min < 1, `${eventType} min ${split.min} is not a fraction under 1`);
    assert.ok(split.max >= split.min, `${eventType} max ${split.max} is below its min`);
    assert.ok(split.basis && split.basis.length > 10, `${eventType} has no stated basis`);
  }
});

test('an overridden share is honoured, and the halves still sum', async () => {
  const store = createHvntzStore();
  const { location } = hostLocation(store);
  const settleFn = recorder();
  await recordRevenueEvent(store, {
    locationId: location.id, eventType: 'screen-ad', amountEarned: 200,
    payerId: 'payer-1', settleFn, vacoSharePercent: 0.5,
  });
  assert.equal(settleFn.totalTo(VACO_PLATFORM_USER_ID), 100);
  assert.equal(settleFn.totalTo('owner-1'), 100);
  assert.equal(settleFn.totalFrom('payer-1'), 200);
});

// -- Refusals move nothing -----------------------------------------------

test('a share of 100% or more is refused — the business cannot be left with nothing', async () => {
  const store = createHvntzStore();
  const { location } = hostLocation(store);
  const settleFn = recorder();
  for (const bad of [1, 1.5, -0.1, NaN]) {
    await assert.rejects(
      () => recordRevenueEvent(store, {
        locationId: location.id, eventType: 'screen-ad', amountEarned: 100,
        payerId: 'payer-1', settleFn, vacoSharePercent: bad,
      }),
      /vacoSharePercent/,
      `vacoSharePercent ${bad} was accepted`,
    );
  }
  assert.equal(settleFn.moves.length, 0);
});

test('a non-numeric amount is refused rather than becoming NaN in the split', async () => {
  const store = createHvntzStore();
  const { location } = hostLocation(store);
  const settleFn = recorder();
  for (const bad of [NaN, Infinity, -1, 0, '100', null, undefined]) {
    await assert.rejects(
      () => recordRevenueEvent(store, {
        locationId: location.id, eventType: 'screen-ad', amountEarned: bad,
        payerId: 'payer-1', settleFn,
      }),
      `amountEarned ${String(bad)} was accepted`,
    );
  }
  assert.equal(settleFn.moves.length, 0);
  assert.equal(store.revenueEvents.length, 0, 'a refused event was still recorded');
});

test('an event with no settleFn is refused rather than silently free', async () => {
  const store = createHvntzStore();
  const { location } = hostLocation(store);
  await assert.rejects(
    () => recordRevenueEvent(store, {
      locationId: location.id, eventType: 'screen-ad', amountEarned: 100, payerId: 'payer-1',
    }),
    /requires a settleFn/,
  );
  assert.equal(store.revenueEvents.length, 0, 'revenue was recorded with no money moved');
});

test('an event with no payer is refused — somebody has to be charged', async () => {
  const store = createHvntzStore();
  const { location } = hostLocation(store);
  const settleFn = recorder();
  await assert.rejects(
    () => recordRevenueEvent(store, {
      locationId: location.id, eventType: 'screen-ad', amountEarned: 100, settleFn,
    }),
    /requires a payerId/,
  );
  assert.equal(settleFn.moves.length, 0);
});

test('an unknown event type is refused rather than defaulting to a zero share', async () => {
  // The dangerous default: an unrecognised type silently taking 0%
  // would hand the business the platform's cut without anyone noticing.
  const store = createHvntzStore();
  const { location } = hostLocation(store);
  const settleFn = recorder();
  await assert.rejects(
    () => recordRevenueEvent(store, {
      locationId: location.id, eventType: 'not-a-real-event', amountEarned: 100,
      payerId: 'payer-1', settleFn,
    }),
    /invalid eventType/,
  );
  assert.equal(settleFn.moves.length, 0);
});

test('an event at a location that does not exist moves nothing', async () => {
  const store = createHvntzStore();
  const settleFn = recorder();
  await assert.rejects(
    () => recordRevenueEvent(store, {
      locationId: 9999, eventType: 'screen-ad', amountEarned: 100,
      payerId: 'payer-1', settleFn,
    }),
    /no location with id/,
  );
  assert.equal(settleFn.moves.length, 0);
});

// -- Attribution ----------------------------------------------------------

test("revenue is attributed to the location's own business, not another", async () => {
  const store = createHvntzStore();
  const a = registerBusiness(store, { name: 'Ada Coffee', ownerId: 'owner-a' });
  const b = registerBusiness(store, { name: 'Bo Books', ownerId: 'owner-b' });
  const locA = registerLocation(store, {
    businessId: a.id, locationType: 'screen', address: '1 A St', lat: 38.6, lng: -90.1,
  });
  registerLocation(store, {
    businessId: b.id, locationType: 'screen', address: '2 B St', lat: 38.7, lng: -90.2,
  });
  const settleFn = recorder();

  await recordRevenueEvent(store, {
    locationId: locA.id, eventType: 'screen-ad', amountEarned: 100,
    payerId: 'payer-1', settleFn,
  });

  assert.equal(settleFn.totalTo('owner-a'), 70);
  assert.equal(settleFn.totalTo('owner-b'), 0, 'the wrong business was paid');
  assert.equal(getRevenueEvents(store, { businessId: b.id }).length, 0);
  assert.equal(getRevenueEvents(store, { businessId: a.id }).length, 1);
});

test('the recorded event agrees with what actually moved', async () => {
  // A report that drifts from the ledger is how an owner disputes a
  // payout and nobody can settle it.
  const store = createHvntzStore();
  const { location } = hostLocation(store);
  const settleFn = recorder();
  const event = await recordRevenueEvent(store, {
    locationId: location.id, eventType: 'vavlt-streaming', amountEarned: 250,
    payerId: 'payer-1', settleFn,
  });
  assert.equal(event.businessShare, settleFn.totalTo('owner-1'));
  assert.equal(event.vacoShare, settleFn.totalTo(VACO_PLATFORM_USER_ID));
  assert.equal(event.businessShare + event.vacoShare, 250);
});
