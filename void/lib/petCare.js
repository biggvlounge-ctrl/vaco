// VOID -- Pet Care as a real service app.
//
// **Why this file exists.** Pet care was a row in `verticals.js`: a
// name, a pricing unit, and a 20% take rate, riding the generic
// marketplace loop. That is enough to transact and not enough to
// compete. Rover is not a pricing scheme -- it is pet profiles, a
// walker you rebook, a recurring Tuesday/Thursday, a meet-and-greet
// before anyone takes your dog, and a photo when it is done. None of
// that is expressible in `{verticalId, quantity, unitPrice}`.
//
// This module is the domain half. It follows the precedent set by
// `staffing.js` and `realEstateMedia.js`: a vertical grows its own
// module when its domain demands one, and still settles through the
// shared marketplace loop and the shared V3 payout. The provider pool,
// the money, and the safety layer stay shared -- splitting those would
// give up the only advantage VOID has over Rover.
//
// **The meet-and-greet is a gate, not a nicety.** Rover's own trust
// model rests on it, and the reason is not customer comfort: handing a
// stranger a key and an animal is the single highest-risk moment in
// this vertical. A first booking with a new walker is refused until a
// meet-and-greet is recorded as completed. Repeat bookings with the
// same walker skip it, which is exactly the behaviour that makes
// rebooking the same person the path of least resistance -- the
// retention loop and the safety mechanism are the same mechanism.

const { canWorkVertical, requireProvider } = require('./providerProfiles');
const { settleJob } = require('./settlement');

const PET_CARE_VERTICAL_ID = 'petCare';

const PET_SPECIES = ['dog', 'cat', 'bird', 'rabbit', 'reptile', 'other'];

const PET_CARE_SERVICES = [
  'walk', 'drop-in', 'daycare', 'boarding', 'grooming', 'training',
];

//: Flagged interpretive: no source document sets these. Durations are
//: the real defaults these services are sold in -- a 30-minute walk
//: and a 20-minute drop-in are the industry-standard units, boarding
//: is overnight. They exist so the service day planner has a real
//: duration to schedule against instead of a generic hour.
const SERVICE_DEFAULT_MINUTES = {
  walk: 30,
  'drop-in': 20,
  daycare: 480,
  boarding: 1440,
  grooming: 90,
  training: 60,
};

const BOOKING_STATUSES = ['requested', 'confirmed', 'completed', 'cancelled'];

//: How long a completed meet-and-greet stays valid before it must be
//: repeated. A relationship that lapses for a year is not the same
//: relationship, and the animal, the home, and the walker may all have
//: changed. Overridable.
const MEET_AND_GREET_VALID_DAYS = 365;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

class PetCareError extends Error {}

// -- pets --------------------------------------------------------------
//
// A pet is a first-class record, not a free-text note on a job. That
// is the whole difference between "walk a dog" and pet care: the
// vet contact, the medication, and the behavioural flag have to
// survive the booking they were entered on.

function registerPet(store, options = {}) {
  const {
    ownerId, name, species, breed = null, weightKg = null,
    vetName = null, vetPhone = null, medications = [],
    behaviouralNotes = null, emergencyContactPhone = null, now = Date.now(),
  } = options;

  if (!ownerId) throw new PetCareError('registerPet requires an ownerId');
  if (!name) throw new PetCareError('registerPet requires a name');
  if (!PET_SPECIES.includes(species)) {
    throw new PetCareError(`registerPet: species must be one of ${PET_SPECIES.join(', ')}`);
  }
  if (weightKg !== null && (!Number.isFinite(weightKg) || weightKg <= 0)) {
    throw new PetCareError('registerPet: weightKg must be a positive number when given');
  }
  if (!Array.isArray(medications)) {
    throw new PetCareError('registerPet: medications must be an array');
  }

  const pet = {
    id: store.nextPetId++,
    ownerId,
    name,
    species,
    breed,
    weightKg,
    vetName,
    vetPhone,
    medications,
    behaviouralNotes,
    emergencyContactPhone,
    createdAt: now,
  };
  store.pets.push(pet);
  return pet;
}

function getPet(store, petId) {
  return store.pets.find((p) => p.id === petId) || null;
}

function listPetsForOwner(store, ownerId) {
  return store.pets.filter((p) => p.ownerId === ownerId);
}

// -- the meet-and-greet gate -------------------------------------------

function hasValidMeetAndGreet(store, options = {}) {
  const {
    ownerId, providerId, petId, now = Date.now(),
    validDays = MEET_AND_GREET_VALID_DAYS,
  } = options;

  return store.petCareBookings.some((b) => b.ownerId === ownerId
    && b.providerId === providerId
    && b.petId === petId
    && b.isMeetAndGreet
    && b.status === 'completed'
    && b.completedAt !== null
    && now - b.completedAt <= validDays * MS_PER_DAY);
}

// A completed booking with this walker and this pet also satisfies the
// gate. Someone who has already walked the dog does not need to be
// introduced to it again, and requiring that would be pointless
// friction rather than safety.
function hasPriorCompletedBooking(store, ownerId, providerId, petId) {
  return store.petCareBookings.some((b) => b.ownerId === ownerId
    && b.providerId === providerId
    && b.petId === petId
    && !b.isMeetAndGreet
    && b.status === 'completed');
}

function requiresMeetAndGreet(store, options = {}) {
  const { ownerId, providerId, petId, now = Date.now() } = options;
  if (hasValidMeetAndGreet(store, { ownerId, providerId, petId, now })) return false;
  if (hasPriorCompletedBooking(store, ownerId, providerId, petId)) return false;
  return true;
}

// -- bookings ----------------------------------------------------------

function createBooking(store, options = {}) {
  const {
    petId, providerId, service, scheduledFor,
    isMeetAndGreet = false, lat = null, lng = null,
    durationMinutes = null, notes = null,
    // A booking needs a price or it can never pay anyone. Pet care
    // carried no price field at all, which is exactly why completion
    // used to change a status and pay nobody. A meet-and-greet is
    // genuinely free -- it is an introduction, not a service -- so it
    // is the one case where zero is correct.
    price = null,
    now = Date.now(),
  } = options;

  const pet = getPet(store, petId);
  if (!pet) throw new PetCareError(`createBooking: no pet with id ${petId}`);
  requireProvider(store, providerId, 'createBooking');

  if (!PET_CARE_SERVICES.includes(service)) {
    throw new PetCareError(`createBooking: service must be one of ${PET_CARE_SERVICES.join(', ')}`);
  }
  if (!Number.isFinite(scheduledFor)) {
    throw new PetCareError('createBooking requires a numeric scheduledFor timestamp');
  }
  if (!isMeetAndGreet && (!Number.isFinite(price) || price <= 0)) {
    throw new PetCareError('createBooking requires a positive price (a meet-and-greet is the only free booking)');
  }

  // The provider must actually hold the skill. Without this check a
  // pet care booking could be assigned to a courier, which the generic
  // loop would have happily accepted.
  const permission = canWorkVertical(store, providerId, PET_CARE_VERTICAL_ID);
  if (!permission.allowed) {
    throw new PetCareError(`createBooking: ${permission.reason}`);
  }

  // The gate. A meet-and-greet itself is exempt, or it could never be
  // the thing that satisfies its own requirement.
  if (!isMeetAndGreet && requiresMeetAndGreet(store, { ownerId: pet.ownerId, providerId, petId, now })) {
    throw new PetCareError(
      `createBooking: "${providerId}" has not met ${pet.name}. `
      + 'A completed meet-and-greet is required before a first booking.',
    );
  }

  const booking = {
    id: store.nextPetCareBookingId++,
    petId,
    ownerId: pet.ownerId,
    providerId,
    service,
    isMeetAndGreet,
    scheduledFor,
    price: isMeetAndGreet ? 0 : price,
    durationMinutes: durationMinutes || SERVICE_DEFAULT_MINUTES[service],
    lat,
    lng,
    notes,
    status: 'requested',
    completedAt: null,
    completionPhotoRef: null,
    settledTotal: null,
    providerPayout: null,
    platformFee: null,
    settledAt: null,
    recurrenceId: null,
    createdAt: now,
  };
  store.petCareBookings.push(booking);
  return booking;
}

function getBooking(store, bookingId) {
  return store.petCareBookings.find((b) => b.id === bookingId) || null;
}

function requireBooking(store, bookingId, action) {
  const booking = getBooking(store, bookingId);
  if (!booking) throw new PetCareError(`${action}: no booking with id ${bookingId}`);
  return booking;
}

function confirmBooking(store, options = {}) {
  const { bookingId } = options;
  const booking = requireBooking(store, bookingId, 'confirmBooking');
  if (booking.status !== 'requested') {
    throw new PetCareError(`confirmBooking: booking ${bookingId} is ${booking.status}, not requested`);
  }
  booking.status = 'confirmed';
  return booking;
}

// Completion takes an optional photo reference. Every real pet care
// platform has this, and it is not decoration: it is the proof of
// service an owner actually wants, and the record that resolves a
// dispute. VOID does not host media, so this is a reference to
// wherever the media actually lives -- stated rather than pretending
// otherwise.
// Completing a booking pays the provider. It used to change a status
// and move no money at all -- a walker could finish a job and never be
// paid, silently, with a 200 response.
//
// Settlement runs BEFORE the status changes, so a ledger failure leaves
// the booking confirmed rather than complete-and-unpaid. Same rule the
// service engine follows for the other 23 verticals, and now literally
// the same code (`settlement.js`).
//
// A meet-and-greet settles nothing, because it is an introduction
// rather than a service and is genuinely free.
async function completeBooking(store, options = {}) {
  const { bookingId, completionPhotoRef = null, settleFn = null, now = Date.now() } = options;
  const booking = requireBooking(store, bookingId, 'completeBooking');
  if (booking.status !== 'confirmed') {
    throw new PetCareError(`completeBooking: booking ${bookingId} is ${booking.status}, must be confirmed`);
  }

  if (!booking.isMeetAndGreet) {
    await settleJob({
      job: booking,
      verticalId: PET_CARE_VERTICAL_ID,
      total: booking.price,
      label: 'petcare',
      reference: bookingId,
      settleFn,
      now,
    });
  }

  booking.status = 'completed';
  booking.completedAt = now;
  booking.completionPhotoRef = completionPhotoRef;
  return booking;
}

function cancelBooking(store, options = {}) {
  const { bookingId, reason = 'unspecified' } = options;
  const booking = requireBooking(store, bookingId, 'cancelBooking');
  if (booking.status === 'completed') {
    throw new PetCareError(`cancelBooking: booking ${bookingId} is already completed`);
  }
  booking.status = 'cancelled';
  booking.cancelledReason = reason;
  return booking;
}

// -- recurring bookings ------------------------------------------------
//
// The retention mechanic of this entire vertical. A dog is walked on a
// schedule, not on impulse, and a platform that makes someone rebook
// the same walk every week is one a customer leaves for one that does
// not.
//
// Implemented as real generated bookings rather than a rule evaluated
// later, so a recurring series is inspectable, individually
// cancellable, and visible to the service day planner like any other
// booking.

function createRecurringBookings(store, options = {}) {
  const {
    petId, providerId, service, firstScheduledFor,
    intervalDays, occurrences, price = null, now = Date.now(),
  } = options;

  if (!Number.isInteger(intervalDays) || intervalDays < 1) {
    throw new PetCareError('createRecurringBookings requires a positive integer intervalDays');
  }
  if (!Number.isInteger(occurrences) || occurrences < 2) {
    throw new PetCareError('createRecurringBookings requires occurrences of at least 2');
  }

  const recurrenceId = `rec-${petId}-${providerId}-${firstScheduledFor}`;
  const created = [];
  for (let i = 0; i < occurrences; i += 1) {
    const booking = createBooking(store, {
      petId,
      providerId,
      service,
      // The price rides through to every generated booking. Without it
      // a recurring series would create bookings that can never settle
      // — the exact failure this pass exists to close.
      price,
      scheduledFor: firstScheduledFor + i * intervalDays * MS_PER_DAY,
      now,
    });
    booking.recurrenceId = recurrenceId;
    created.push(booking);
  }
  return { recurrenceId, bookings: created };
}

function cancelRecurrence(store, options = {}) {
  const { recurrenceId, reason = 'series cancelled', fromTimestamp = 0 } = options;
  const affected = store.petCareBookings.filter(
    (b) => b.recurrenceId === recurrenceId
      && b.status !== 'completed'
      && b.scheduledFor >= fromTimestamp,
  );
  for (const booking of affected) {
    booking.status = 'cancelled';
    booking.cancelledReason = reason;
  }
  return affected;
}

// The walkers an owner has actually used, most-recent first. This is
// what a pet care home screen leads with -- not a search box.
function preferredProviders(store, ownerId) {
  const counts = new Map();
  for (const b of store.petCareBookings) {
    if (b.ownerId !== ownerId || b.status !== 'completed' || b.isMeetAndGreet) continue;
    const existing = counts.get(b.providerId) || { providerId: b.providerId, completedBookings: 0, lastAt: 0 };
    existing.completedBookings += 1;
    existing.lastAt = Math.max(existing.lastAt, b.completedAt || 0);
    counts.set(b.providerId, existing);
  }
  return [...counts.values()].sort((a, b) => b.lastAt - a.lastAt);
}

module.exports = {
  PET_CARE_VERTICAL_ID,
  PET_SPECIES,
  PET_CARE_SERVICES,
  SERVICE_DEFAULT_MINUTES,
  BOOKING_STATUSES,
  MEET_AND_GREET_VALID_DAYS,
  PetCareError,
  registerPet,
  getPet,
  listPetsForOwner,
  hasValidMeetAndGreet,
  requiresMeetAndGreet,
  createBooking,
  getBooking,
  confirmBooking,
  completeBooking,
  cancelBooking,
  createRecurringBookings,
  cancelRecurrence,
  preferredProviders,
};
