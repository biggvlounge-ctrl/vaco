// VOID -- the two service apps built as domain modules.
//
// Pet care and laundry were chosen as the first two because their
// domains look nothing like each other. Pet care is a relationship
// (the same walker, the same dog, a standing Tuesday). Laundry is a
// round trip with a machine in the middle and a price that does not
// exist until the bag is weighed.
//
// Both have one gate that is the reason the vertical is trustworthy,
// and both gates fail open silently if broken: a meet-and-greet check
// that stops running just lets strangers take dogs, and a weight cap
// that stops holding just bills people double.

const test = require('node:test');
const assert = require('node:assert');

const petCare = require('../lib/petCare');
const laundry = require('../lib/laundry');
const { registerProvider, addSkill } = require('../lib/providerProfiles');
const { recordVetting } = require('../lib/serviceCommon');
const { createVoidStore } = require('../lib/store');

const DAY = Date.UTC(2026, 8, 1);
const H = 60 * 60 * 1000;

// Pet care requires identity verification -- someone is being handed a
// key and an animal. The fixture records it so these tests exercise
// the domain gate rather than tripping over the vetting gate first.
function walker(store, id = 'maria') {
  registerProvider(store, {
    providerId: id, displayName: id, homeBaseLat: 40.7128, homeBaseLng: -74.006,
  });
  addSkill(store, { providerId: id, verticalId: 'petCare' });
  recordVetting(store, {
    providerId: id, level: 'identity-verified',
    verifiedBy: 'trust-ops', referenceId: `IDV-${id}`,
  });
  return id;
}

// Records transfers instead of calling V3. Completion now settles, so a
// transferFn is required — and having the record makes it possible to
// assert that the provider was actually paid rather than that a status
// changed.
function recordingTransfers() {
  const moves = [];
  const fn = async (from, to, amount, reason) => {
    moves.push({ from, to, amount, reason });
    return { ok: true };
  };
  fn.moves = moves;
  return fn;
}

function biscuit(store, ownerId = 'sam') {
  return petCare.registerPet(store, {
    ownerId, name: 'Biscuit', species: 'dog', breed: 'beagle', weightKg: 12,
    vetName: 'Dr Chen', vetPhone: '555-0100', medications: ['thyroid'],
    behaviouralNotes: 'nervous around bikes',
  });
}

async function completedMeetAndGreet(store, petId, providerId, at = DAY) {
  const mg = petCare.createBooking(store, {
    petId, providerId, service: 'drop-in', scheduledFor: at, isMeetAndGreet: true, now: at,
  });
  petCare.confirmBooking(store, { bookingId: mg.id });
  // A meet-and-greet is an introduction, not a service, so it is free
  // and settles nothing — which is why no transferFn is needed here.
  await petCare.completeBooking(store, { bookingId: mg.id, now: at });
  return mg;
}

// -- pets are first-class records -------------------------------------

test('a pet carries the details that must outlive one booking', async () => {
  const store = createVoidStore();
  const pet = biscuit(store);
  assert.strictEqual(pet.vetPhone, '555-0100');
  assert.deepStrictEqual(pet.medications, ['thyroid']);
  assert.strictEqual(pet.behaviouralNotes, 'nervous around bikes');
});

test('an unknown species is refused', async () => {
  const store = createVoidStore();
  assert.throws(() => petCare.registerPet(store, {
    ownerId: 'sam', name: 'Rex', species: 'dragon',
  }), /species must be one of/);
});

// -- the meet-and-greet gate ------------------------------------------

test('a FIRST booking with a new walker is refused', async () => {
  const store = createVoidStore();
  const id = walker(store);
  const pet = biscuit(store);

  assert.throws(() => petCare.createBooking(store, {
    petId: pet.id, providerId: id, service: 'walk', scheduledFor: DAY + 9 * H, now: DAY, price: 32
  }), /has not met Biscuit/);
});

test('a completed meet-and-greet opens the gate', async () => {
  const store = createVoidStore();
  const id = walker(store);
  const pet = biscuit(store);
  await completedMeetAndGreet(store, pet.id, id);

  const booking = petCare.createBooking(store, {
    petId: pet.id, providerId: id, service: 'walk', scheduledFor: DAY + 9 * H, now: DAY, price: 32
  });
  assert.strictEqual(booking.status, 'requested');
});

test('an INCOMPLETE meet-and-greet does not open the gate', async () => {
  // Booking one is not the same as attending one.
  const store = createVoidStore();
  const id = walker(store);
  const pet = biscuit(store);
  petCare.createBooking(store, {
    petId: pet.id, providerId: id, service: 'drop-in',
    scheduledFor: DAY, isMeetAndGreet: true, now: DAY,
  });

  assert.throws(() => petCare.createBooking(store, {
    petId: pet.id, providerId: id, service: 'walk', scheduledFor: DAY + 9 * H, now: DAY, price: 32
  }), /has not met/);
});

test('the gate is per walker AND per pet -- meeting one dog is not meeting another', async () => {
  const store = createVoidStore();
  const id = walker(store);
  const pet = biscuit(store);
  const other = petCare.registerPet(store, { ownerId: 'sam', name: 'Pepper', species: 'cat' });
  await completedMeetAndGreet(store, pet.id, id);

  assert.throws(() => petCare.createBooking(store, {
    petId: other.id, providerId: id, service: 'drop-in', scheduledFor: DAY + 9 * H, now: DAY, price: 32
  }), /has not met Pepper/);
});

test('a DIFFERENT walker still has to meet the pet', async () => {
  const store = createVoidStore();
  const maria = walker(store, 'maria');
  const dan = walker(store, 'dan');
  const pet = biscuit(store);
  await completedMeetAndGreet(store, pet.id, maria);

  assert.throws(() => petCare.createBooking(store, {
    petId: pet.id, providerId: dan, service: 'walk', scheduledFor: DAY + 9 * H, now: DAY, price: 32
  }), /"dan" has not met/);
});

test('an expired meet-and-greet closes the gate again', async () => {
  const store = createVoidStore();
  const id = walker(store);
  const pet = biscuit(store);
  await completedMeetAndGreet(store, pet.id, id, DAY);

  const twoYearsLater = DAY + 730 * 24 * H;
  assert.strictEqual(
    petCare.requiresMeetAndGreet(store, {
      ownerId: 'sam', providerId: id, petId: pet.id, now: twoYearsLater,
    }),
    true,
  );
});

test('a provider without the petCare skill cannot be booked at all', async () => {
  // Without this the generic loop would happily assign a courier.
  const store = createVoidStore();
  registerProvider(store, {
    providerId: 'courier-only', displayName: 'c', homeBaseLat: 40.7, homeBaseLng: -74,
  });
  addSkill(store, { providerId: 'courier-only', verticalId: 'courier' });
  const pet = biscuit(store);

  assert.throws(() => petCare.createBooking(store, {
    petId: pet.id, providerId: 'courier-only', service: 'walk',
    scheduledFor: DAY + 9 * H, isMeetAndGreet: true, now: DAY,
  }), /no petCare skill/);
});

// -- recurring bookings ------------------------------------------------

test('a recurring series creates real, individually cancellable bookings', async () => {
  const store = createVoidStore();
  const id = walker(store);
  const pet = biscuit(store);
  await completedMeetAndGreet(store, pet.id, id);

  const { recurrenceId, bookings } = petCare.createRecurringBookings(store, {
    petId: pet.id, providerId: id, service: 'walk', price: 32,
    firstScheduledFor: DAY + 9 * H, intervalDays: 7, occurrences: 4, now: DAY,
  });

  assert.strictEqual(bookings.length, 4);
  assert.ok(bookings.every((b) => b.recurrenceId === recurrenceId));
  // Weekly spacing, actually checked.
  const gap = bookings[1].scheduledFor - bookings[0].scheduledFor;
  assert.strictEqual(gap, 7 * 24 * H);
});

test('cancelling a series leaves already-completed bookings alone', async () => {
  const store = createVoidStore();
  const id = walker(store);
  const pet = biscuit(store);
  await completedMeetAndGreet(store, pet.id, id);
  const { recurrenceId, bookings } = petCare.createRecurringBookings(store, {
    petId: pet.id, providerId: id, service: 'walk', price: 32,
    firstScheduledFor: DAY + 9 * H, intervalDays: 7, occurrences: 3, now: DAY,
  });

  petCare.confirmBooking(store, { bookingId: bookings[0].id });
  await petCare.completeBooking(store, { bookingId: bookings[0].id, now: DAY + 10 * H, transferFn: recordingTransfers() });
  petCare.cancelRecurrence(store, { recurrenceId });

  assert.strictEqual(petCare.getBooking(store, bookings[0].id).status, 'completed');
  assert.strictEqual(petCare.getBooking(store, bookings[1].id).status, 'cancelled');
});

test('a completed booking cannot be cancelled', async () => {
  const store = createVoidStore();
  const id = walker(store);
  const pet = biscuit(store);
  const mg = await completedMeetAndGreet(store, pet.id, id);
  assert.throws(() => petCare.cancelBooking(store, { bookingId: mg.id }), /already completed/);
});

test('preferred providers rank by most recent, excluding meet-and-greets', async () => {
  const store = createVoidStore();
  const id = walker(store);
  const pet = biscuit(store);
  await completedMeetAndGreet(store, pet.id, id);

  const b = petCare.createBooking(store, {
    petId: pet.id, providerId: id, service: 'walk', scheduledFor: DAY + 9 * H, now: DAY, price: 32
  });
  petCare.confirmBooking(store, { bookingId: b.id });
  await petCare.completeBooking(store, { bookingId: b.id, now: DAY + 10 * H, transferFn: recordingTransfers() });

  const preferred = petCare.preferredProviders(store, 'sam');
  assert.strictEqual(preferred.length, 1);
  assert.strictEqual(preferred[0].providerId, id);
  // The meet-and-greet itself must not inflate the count.
  assert.strictEqual(preferred[0].completedBookings, 1);
});

// -- laundry -----------------------------------------------------------

function laundromat(store) {
  registerProvider(store, {
    providerId: 'suds', displayName: 'Suds', providerType: 'business',
    businessName: 'Suds & Co', crewSize: 6, homeBaseLat: 40.72, homeBaseLng: -74.01,
  });
  addSkill(store, { providerId: 'suds', verticalId: 'laundry' });
  recordVetting(store, {
    providerId: 'suds', level: 'identity-verified',
    verifiedBy: 'trust-ops', referenceId: 'IDV-suds',
  });
  return 'suds';
}

function order(store, overrides = {}) {
  return laundry.scheduleOrder(store, {
    customerId: 'sam', providerId: 'suds', serviceType: 'wash-and-fold',
    pickupWindowStart: DAY + 9 * H, pickupWindowEnd: DAY + 11 * H,
    estimatedPounds: 15, ...overrides,
  });
}

test('the booking price is an ESTIMATE, and the real total appears at weigh-in', async () => {
  const store = createVoidStore();
  laundromat(store);
  const o = order(store);
  assert.strictEqual(o.estimatedTotal, 37.5);
  assert.strictEqual(o.actualTotal, null);

  laundry.markPickedUp(store, { orderId: o.id });
  const weighed = laundry.recordWeight(store, { orderId: o.id, actualPounds: 20 });
  assert.strictEqual(weighed.actualTotal, 50);
});

test('the minimum poundage floors the price', async () => {
  const store = createVoidStore();
  laundromat(store);
  const o = order(store, { estimatedPounds: 3 });
  laundry.markPickedUp(store, { orderId: o.id });
  const weighed = laundry.recordWeight(store, { orderId: o.id, actualPounds: 3 });
  // 10lb minimum at 2.5/lb.
  assert.strictEqual(weighed.actualTotal, 25);
});

test('a weighed total over the customer cap HOLDS the order', async () => {
  const store = createVoidStore();
  laundromat(store);
  const o = order(store, { maxAcceptableTotal: 45 });
  laundry.markPickedUp(store, { orderId: o.id });
  const weighed = laundry.recordWeight(store, { orderId: o.id, actualPounds: 26 });

  assert.strictEqual(weighed.actualTotal, 65);
  assert.strictEqual(weighed.requiresCustomerApproval, true);
});

test('washing cannot start while an order is over cap and unapproved', async () => {
  // Washing first and asking after is how a dispute becomes a loss.
  const store = createVoidStore();
  laundromat(store);
  const o = order(store, { maxAcceptableTotal: 45 });
  laundry.markPickedUp(store, { orderId: o.id });
  laundry.recordWeight(store, { orderId: o.id, actualPounds: 26 });

  assert.throws(() => laundry.startProcessing(store, { orderId: o.id }), /awaiting approval/);

  laundry.approveOverCap(store, { orderId: o.id });
  assert.strictEqual(laundry.startProcessing(store, { orderId: o.id }).status, 'in-progress');
});

test('an order under the cap needs no approval', async () => {
  const store = createVoidStore();
  laundromat(store);
  const o = order(store, { maxAcceptableTotal: 100 });
  laundry.markPickedUp(store, { orderId: o.id });
  const weighed = laundry.recordWeight(store, { orderId: o.id, actualPounds: 20 });
  assert.strictEqual(weighed.requiresCustomerApproval, false);
});

test('care preferences are captured and survive the order', async () => {
  const store = createVoidStore();
  laundromat(store);
  const o = order(store, {
    carePreferences: { waterTemperature: 'cold', drySetting: 'hang-dry', noFabricSoftener: true },
  });
  assert.strictEqual(o.carePreferences.waterTemperature, 'cold');
  assert.strictEqual(o.carePreferences.drySetting, 'hang-dry');
  assert.strictEqual(o.carePreferences.noFabricSoftener, true);
});

test('an impossible care preference is refused rather than defaulted', async () => {
  const store = createVoidStore();
  laundromat(store);
  assert.throws(() => order(store, { carePreferences: { waterTemperature: 'boiling' } }),
    /waterTemperature must be one of/);
});

test('the order lifecycle enforces its own ordering', async () => {
  const store = createVoidStore();
  laundromat(store);
  const o = order(store);
  // Cannot weigh before pickup.
  assert.throws(() => laundry.recordWeight(store, { orderId: o.id, actualPounds: 20 }), /must be picked-up/);
  // Cannot deliver before ready.
  assert.rejects(() => laundry.markDelivered(store, { orderId: o.id }), /must be ready/);
});

test('an order runs the full loop to delivered', async () => {
  const store = createVoidStore();
  laundromat(store);
  const o = order(store);
  laundry.markPickedUp(store, { orderId: o.id, now: DAY + 10 * H });
  laundry.recordWeight(store, { orderId: o.id, actualPounds: 18 });
  laundry.startProcessing(store, { orderId: o.id });
  laundry.markReady(store, {
    orderId: o.id,
    deliveryWindowStart: DAY + 48 * H,
    deliveryWindowEnd: DAY + 52 * H,
  });
  const done = await laundry.markDelivered(store, { orderId: o.id, transferFn: recordingTransfers() });
  assert.strictEqual(done.status, 'delivered');
});

test('overdue is measured against the promised turnaround', async () => {
  const store = createVoidStore();
  laundromat(store);
  const o = order(store, { turnaroundHours: 48 });
  laundry.markPickedUp(store, { orderId: o.id, now: DAY });

  assert.strictEqual(laundry.isOverdue(store, { orderId: o.id, now: DAY + 47 * H }), false);
  assert.strictEqual(laundry.isOverdue(store, { orderId: o.id, now: DAY + 49 * H }), true);
});

test('a provider without the laundry skill cannot take an order', async () => {
  const store = createVoidStore();
  registerProvider(store, {
    providerId: 'walker', displayName: 'w', homeBaseLat: 40.7, homeBaseLng: -74,
  });
  addSkill(store, { providerId: 'walker', verticalId: 'petCare' });
  assert.throws(() => order(store, { providerId: 'walker' }), /no laundry skill/);
});

// -- settlement --------------------------------------------------------
//
// The gap these close: before this pass, `completeBooking` and
// `markDelivered` changed a status and paid nobody. Every test above
// still passed, because they all asserted on status. A provider could
// finish a job and never be paid — silently, with a 200 response.
//
// So these assert on the money.

test('completing a pet care booking pays the walker and takes the platform rate', async () => {
  const store = createVoidStore();
  const id = walker(store);
  const pet = biscuit(store);
  await completedMeetAndGreet(store, pet.id, id);

  const transferFn = recordingTransfers();
  const b = petCare.createBooking(store, {
    petId: pet.id, providerId: id, service: 'walk', price: 40,
    scheduledFor: DAY + 9 * H, now: DAY,
  });
  petCare.confirmBooking(store, { bookingId: b.id });
  const done = await petCare.completeBooking(store, {
    bookingId: b.id, now: DAY + 10 * H, transferFn,
  });

  // Pet care takes 20%: the walker gets 32, the platform 8.
  assert.strictEqual(done.settledTotal, 40);
  assert.strictEqual(done.providerPayout, 32);
  assert.strictEqual(done.platformFee, 8);

  // Two separate transfers, so each stays individually auditable.
  assert.strictEqual(transferFn.moves.length, 2);
  assert.strictEqual(transferFn.moves[0].to, id);
  assert.strictEqual(transferFn.moves[0].amount, 32);
  assert.strictEqual(transferFn.moves[1].to, 'void-platform');
  assert.strictEqual(transferFn.moves[1].amount, 8);
  // Pet care calls the payer `ownerId` where every other vertical says
  // `customerId`; settlement accepts both rather than renaming a field
  // 23 modules already read.
  assert.ok(transferFn.moves.every((m) => m.from === 'sam'));
});

test('a pet care booking cannot complete without a transferFn, and stays confirmed', async () => {
  const store = createVoidStore();
  const id = walker(store);
  const pet = biscuit(store);
  await completedMeetAndGreet(store, pet.id, id);

  const b = petCare.createBooking(store, {
    petId: pet.id, providerId: id, service: 'walk', price: 40,
    scheduledFor: DAY + 9 * H, now: DAY,
  });
  petCare.confirmBooking(store, { bookingId: b.id });
  await assert.rejects(
    () => petCare.completeBooking(store, { bookingId: b.id, now: DAY + 10 * H }),
    /requires a transferFn/,
  );
  // Settlement runs before the status changes, so a ledger failure
  // leaves the booking confirmed rather than complete-and-unpaid.
  assert.strictEqual(petCare.getBooking(store, b.id).status, 'confirmed');
});

test('a paid booking with no price is refused at creation, not settled at zero', async () => {
  const store = createVoidStore();
  const id = walker(store);
  const pet = biscuit(store);
  assert.throws(() => petCare.createBooking(store, {
    petId: pet.id, providerId: id, service: 'walk', scheduledFor: DAY + 9 * H, now: DAY,
  }), /requires a positive price/);
});

test('a meet-and-greet is free and settles nothing', async () => {
  const store = createVoidStore();
  const id = walker(store);
  const pet = biscuit(store);
  const transferFn = recordingTransfers();

  const mg = petCare.createBooking(store, {
    petId: pet.id, providerId: id, service: 'drop-in',
    scheduledFor: DAY, isMeetAndGreet: true, now: DAY,
  });
  petCare.confirmBooking(store, { bookingId: mg.id });
  const done = await petCare.completeBooking(store, { bookingId: mg.id, now: DAY, transferFn });

  assert.strictEqual(done.status, 'completed');
  assert.strictEqual(done.price, 0);
  assert.strictEqual(transferFn.moves.length, 0, 'an introduction is not a billable service');
});

test('laundry settles the WEIGHED total, never the estimate', async () => {
  const store = createVoidStore();
  laundromat(store);
  const transferFn = recordingTransfers();

  // Estimated at 15 lb; the real bag weighs 20.
  const o = order(store, { estimatedPounds: 15 });
  const estimate = o.estimatedTotal;
  laundry.markPickedUp(store, { orderId: o.id, now: DAY + 10 * H });
  laundry.recordWeight(store, { orderId: o.id, actualPounds: 20 });
  laundry.startProcessing(store, { orderId: o.id });
  laundry.markReady(store, {
    orderId: o.id, deliveryWindowStart: DAY + 48 * H, deliveryWindowEnd: DAY + 52 * H,
  });
  const done = await laundry.markDelivered(store, { orderId: o.id, transferFn });

  assert.strictEqual(done.settledTotal, done.actualTotal);
  assert.notStrictEqual(done.settledTotal, estimate,
    'settling the estimate would charge a number the customer was told was provisional');

  // Laundry takes 25%.
  assert.strictEqual(done.platformFee, Math.round(done.actualTotal * 0.25 * 100) / 100);
  assert.strictEqual(
    Math.round((done.providerPayout + done.platformFee) * 100) / 100,
    done.settledTotal,
    'the two shares must add back up to what the customer paid',
  );
  assert.strictEqual(transferFn.moves.length, 2);
});

test('an unweighed order can never reach delivery in the first place', async () => {
  const store = createVoidStore();
  laundromat(store);
  const o = order(store);
  laundry.markPickedUp(store, { orderId: o.id, now: DAY + 10 * H });

  // The lifecycle is the real protection: nothing can be processed
  // before it has been weighed, so an unweighed order cannot reach
  // 'ready' and therefore cannot reach settlement.
  assert.throws(() => laundry.startProcessing(store, { orderId: o.id }), /must be weighed/);
  assert.strictEqual(laundry.getOrder(store, o.id).status, 'picked-up');

  // `markDelivered`'s own "never weighed" check is deliberately kept as
  // belt-and-braces rather than removed as dead code: it is the last
  // thing standing between a future lifecycle change and settling a
  // number the customer was told was provisional. It is unreachable
  // through the normal flow, and that is the point — asserted here
  // against a hand-built order that skips the lifecycle entirely.
  const unweighed = { ...laundry.getOrder(store, o.id), status: 'ready', actualTotal: null };
  store.laundryOrders.push({ ...unweighed, id: 9999 });
  await assert.rejects(
    () => laundry.markDelivered(store, { orderId: 9999, transferFn: recordingTransfers() }),
    /never weighed/,
  );
});
