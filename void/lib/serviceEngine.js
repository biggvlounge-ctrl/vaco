// VOID -- the service engine: one lifecycle machine, four archetypes.
//
// **Why this exists rather than 21 more hand-written modules.**
//
// Pet care and laundry were written by hand, back to back, and the
// second one made the duplication impossible to ignore. Both had a
// subject record, a booking, a lifecycle with enforced ordering, one
// trust gate, and a completion. What differed was the *vocabulary* and
// the *moment the price becomes real* -- not the machinery.
//
// Writing 19 more by copying would produce 19 slightly different
// lifecycles and 19 slightly different cancellation rules. That is how
// a marketplace ends up unable to answer "what state is this job in"
// across its own categories.
//
// So: one engine, four lifecycles, and a config per vertical. A new
// service app is a config plus whatever domain vocabulary it genuinely
// needs -- not a rewrite.
//
// **What this deliberately does NOT do.** It does not replace
// `petCare.js` or `laundry.js`. Those two have domain depth the engine
// should not try to express -- a pet's medication list, a meet-and-greet
// that is per-walker-per-animal, a weight cap that holds a wash. They
// are the reference implementations, and the engine is what makes the
// *other* verticals affordable. Where a vertical outgrows the engine,
// it graduates to its own module, exactly as those two did.
//
// **The four archetypes**, derived by sorting all 25 verticals rather
// than invented:
//
//   recurring    the customer wants the same person again. The product
//                is the rebooking. (cleaning, landscaping, tutoring,
//                personal training, senior care, childcare)
//   round-trip   pickup and delivery ARE the service, and the price is
//                not known until the item is assessed. (auto repair,
//                waste removal)
//   appointment  a slot with a named person at a known price, where the
//                cancellation policy is the commercial mechanism.
//                (beauty, photography, notary, IT support, event
//                planning)
//   quote        the work cannot be priced from a form; someone must
//                assess and quote first. (freight/moving, freelance)

const {
  requiredVettingFor, assessCancellation, generateOccurrences,
} = require('./serviceCommon');
const { canWorkVertical, requireProvider } = require('./providerProfiles');
const { VERTICALS } = require('./verticals');
const { settleJob } = require('./settlement');

const ARCHETYPES = ['recurring', 'round-trip', 'appointment', 'quote'];

// Each archetype's lifecycle, as an explicit ordered map of
// state -> the states it may move to. Written out rather than derived,
// because an illegal transition is exactly the bug worth making
// impossible: "delivered before picked up" should not be expressible.
const LIFECYCLES = {
  recurring: {
    requested: ['confirmed', 'cancelled'],
    confirmed: ['in-progress', 'cancelled', 'no-show'],
    'in-progress': ['completed', 'cancelled'],
    completed: [],
    cancelled: [],
    'no-show': [],
  },
  'round-trip': {
    scheduled: ['collected', 'cancelled'],
    collected: ['assessed', 'cancelled'],
    assessed: ['in-progress', 'cancelled'],
    'in-progress': ['ready', 'cancelled'],
    ready: ['returned'],
    returned: [],
    cancelled: [],
  },
  appointment: {
    requested: ['confirmed', 'cancelled'],
    confirmed: ['in-progress', 'cancelled', 'no-show'],
    'in-progress': ['completed'],
    completed: [],
    cancelled: [],
    'no-show': [],
  },
  quote: {
    requested: ['surveyed', 'cancelled'],
    surveyed: ['quoted', 'cancelled'],
    quoted: ['accepted', 'declined', 'cancelled'],
    accepted: ['in-progress', 'cancelled'],
    'in-progress': ['completed'],
    completed: [],
    declined: [],
    cancelled: [],
  },
};

const INITIAL_STATE = {
  recurring: 'requested',
  'round-trip': 'scheduled',
  appointment: 'requested',
  quote: 'requested',
};

// The state at which the price stops being an estimate. Different per
// archetype, and the reason the archetypes are separate at all: a
// haircut is priced when booked, a car repair is priced after someone
// looks at the car, and a house move is priced after a survey.
const PRICING_BECOMES_REAL_AT = {
  recurring: 'requested',    // known up front
  'round-trip': 'assessed',  // known after inspection
  appointment: 'requested',  // known up front
  quote: 'quoted',           // known after a survey
};

class ServiceEngineError extends Error {}

// The account platform fees land in, matching marketplace.js's own
// `'void-platform'` so service-app revenue and marketplace revenue
// report against one account rather than two.
const VOID_PLATFORM_ACCOUNT = 'void-platform';

function round(n) {
  return Math.round(n * 100) / 100;
}

// The states at which money actually moves, per archetype. A booking
// is settled when the work is done -- 'returned' for a round trip
// (the item is back with its owner), 'completed' for everything else.
const SETTLES_AT = {
  recurring: 'completed',
  'round-trip': 'returned',
  appointment: 'completed',
  quote: 'completed',
};

// -- config -------------------------------------------------------------

function assertConfig(config, verticalId) {
  if (!config) throw new ServiceEngineError(`no service config for "${verticalId}"`);
  if (!ARCHETYPES.includes(config.archetype)) {
    throw new ServiceEngineError(
      `${verticalId}: archetype must be one of ${ARCHETYPES.join(', ')}, got "${config.archetype}"`,
    );
  }
  if (!Array.isArray(config.services) || config.services.length === 0) {
    throw new ServiceEngineError(`${verticalId}: config requires a non-empty services list`);
  }
  if (!VERTICALS[verticalId]) {
    throw new ServiceEngineError(`${verticalId}: not a registered vertical`);
  }
}

// -- subjects -----------------------------------------------------------
//
// The thing the service is performed on or for: a lawn, a student, a
// car, a home. Generic on purpose -- what makes a subject useful is
// that it *persists between bookings*, and the fields that matter
// differ per vertical. Pet care proved the principle with a pet's vet
// contact; a lawn's gate code is the same idea.

function registerSubject(store, options = {}) {
  const {
    verticalId, ownerId, label, attributes = {},
    lat = null, lng = null, accessNotes = null, now = Date.now(),
  } = options;

  const config = store.serviceConfigs[verticalId];
  assertConfig(config, verticalId);
  if (!ownerId) throw new ServiceEngineError('registerSubject requires an ownerId');
  if (!label) throw new ServiceEngineError('registerSubject requires a label');

  // A vertical may declare attributes it cannot operate without. A
  // lawn without a size cannot be quoted; a student without a subject
  // cannot be matched to a tutor.
  for (const field of config.requiredSubjectAttributes || []) {
    if (attributes[field] === undefined || attributes[field] === null) {
      throw new ServiceEngineError(
        `registerSubject: ${verticalId} requires the "${field}" attribute`,
      );
    }
  }

  const subject = {
    id: store.nextServiceSubjectId++,
    verticalId,
    ownerId,
    label,
    attributes,
    lat,
    lng,
    accessNotes,
    createdAt: now,
  };
  store.serviceSubjects.push(subject);
  return subject;
}

function getSubject(store, subjectId) {
  return store.serviceSubjects.find((s) => s.id === subjectId) || null;
}

function listSubjectsForOwner(store, ownerId, verticalId = null) {
  return store.serviceSubjects.filter(
    (s) => s.ownerId === ownerId && (verticalId === null || s.verticalId === verticalId),
  );
}

// -- bookings -----------------------------------------------------------

function createServiceBooking(store, options = {}) {
  const {
    verticalId, subjectId = null, customerId, providerId, service,
    scheduledFor, quotedTotal = null, durationMinutes = null,
    notes = null, now = Date.now(),
  } = options;

  const config = store.serviceConfigs[verticalId];
  assertConfig(config, verticalId);

  if (!customerId) throw new ServiceEngineError('createServiceBooking requires a customerId');
  requireProvider(store, providerId, 'createServiceBooking');
  if (!config.services.includes(service)) {
    throw new ServiceEngineError(
      `createServiceBooking: "${service}" is not a ${verticalId} service (${config.services.join(', ')})`,
    );
  }
  if (!Number.isFinite(scheduledFor)) {
    throw new ServiceEngineError('createServiceBooking requires a numeric scheduledFor');
  }

  // One gate, checked here rather than per-vertical, so a new service
  // app cannot forget it. Covers the skill, the licensing gate, and
  // the vetting requirement in a single call.
  const permission = canWorkVertical(store, providerId, verticalId, now);
  if (!permission.allowed) {
    throw new ServiceEngineError(`createServiceBooking: ${permission.reason}`);
  }

  if (config.requiresSubject && subjectId === null) {
    throw new ServiceEngineError(`createServiceBooking: ${verticalId} requires a subjectId`);
  }
  if (subjectId !== null) {
    const subject = getSubject(store, subjectId);
    if (!subject) throw new ServiceEngineError(`createServiceBooking: no subject with id ${subjectId}`);
    if (subject.verticalId !== verticalId) {
      throw new ServiceEngineError(
        `createServiceBooking: subject ${subjectId} belongs to ${subject.verticalId}, not ${verticalId}`,
      );
    }
  }

  // An intro session is this engine's generalisation of pet care's
  // meet-and-greet: for verticals where someone is entering a home or
  // working unsupervised with a person, the first booking with a new
  // provider is refused until an intro has happened.
  if (config.requiresIntroSession && !options.isIntroSession) {
    const hasIntro = store.serviceBookings.some((b) => b.verticalId === verticalId
      && b.customerId === customerId
      && b.providerId === providerId
      && b.status === 'completed');
    if (!hasIntro) {
      throw new ServiceEngineError(
        `createServiceBooking: ${verticalId} requires a completed intro session with "${providerId}" first`,
      );
    }
  }

  const booking = {
    id: store.nextServiceBookingId++,
    verticalId,
    archetype: config.archetype,
    subjectId,
    customerId,
    providerId,
    service,
    status: INITIAL_STATE[config.archetype],
    scheduledFor,
    durationMinutes: durationMinutes || config.defaultDurationMinutes || 60,
    isIntroSession: Boolean(options.isIntroSession),
    // Estimate versus real total, and which one is currently in force.
    estimatedTotal: quotedTotal,
    actualTotal: null,
    priceIsFinal: PRICING_BECOMES_REAL_AT[config.archetype] === INITIAL_STATE[config.archetype],
    assessmentNotes: null,
    recurrenceId: null,
    notes,
    history: [{ status: INITIAL_STATE[config.archetype], at: now }],
    completedAt: null,
    cancelledReason: null,
    createdAt: now,
  };
  store.serviceBookings.push(booking);
  return booking;
}

function getServiceBooking(store, bookingId) {
  return store.serviceBookings.find((b) => b.id === bookingId) || null;
}

function requireServiceBooking(store, bookingId, action) {
  const booking = getServiceBooking(store, bookingId);
  if (!booking) throw new ServiceEngineError(`${action}: no service booking with id ${bookingId}`);
  return booking;
}

// The one transition function. Every state change goes through here,
// so an illegal transition is impossible rather than merely unlikely,
// and every booking carries its own audit trail.
// **Settlement, and why it lives here.**
//
// Until this was added, a service booking and a marketplace job were
// separate records: completing a booking changed a status and moved no
// money. That made every domain module a scheduling layer rather than a
// business -- the single largest gap across all 25 service apps.
//
// Money moves at the archetype's own completion state, through
// `settlement.js`'s `settleJob` and the injected `settleFn` -- same
// split, same platform account, same reason-string shape as before.
// Two legs rather than one net movement, so the customer's debit and
// the platform's fee are separately auditable, but both legs go to V3
// in one atomic call so a failure cannot pay one party and not the
// other.
//
// `settleFn` is required at settlement and only at settlement. Every
// other transition stays synchronous and needs no ledger, which keeps
// the state machine usable in tests and in plain Node with no network.
async function advanceBooking(store, options = {}) {
  const {
    bookingId, to, actualTotal = null, assessmentNotes = null,
    settleFn = null, now = Date.now(),
  } = options;

  const booking = requireServiceBooking(store, bookingId, 'advanceBooking');
  const lifecycle = LIFECYCLES[booking.archetype];
  const allowed = lifecycle[booking.status];

  if (!allowed) {
    throw new ServiceEngineError(`advanceBooking: unknown status "${booking.status}"`);
  }
  if (!allowed.includes(to)) {
    throw new ServiceEngineError(
      `advanceBooking: ${booking.verticalId} booking ${bookingId} cannot go ${booking.status} -> ${to}`
      + (allowed.length ? ` (allowed: ${allowed.join(', ')})` : ' (terminal state)'),
    );
  }

  // At the archetype's pricing moment, a real total is required. This
  // is the generalisation of laundry's weigh-in: the price stops being
  // a guess and someone has to say what it actually is.
  if (to === PRICING_BECOMES_REAL_AT[booking.archetype] && booking.archetype !== 'recurring'
      && booking.archetype !== 'appointment') {
    if (!Number.isFinite(actualTotal) || actualTotal <= 0) {
      throw new ServiceEngineError(
        `advanceBooking: moving to "${to}" requires a positive actualTotal -- `
        + 'this is the point the price stops being an estimate',
      );
    }
    booking.actualTotal = round(actualTotal);
    booking.priceIsFinal = true;
    booking.assessmentNotes = assessmentNotes;

    const config = store.serviceConfigs[booking.verticalId];
    // The customer's cap, honoured the same way laundry honours it: a
    // total over the agreed ceiling holds rather than proceeding.
    if (booking.maxAcceptableTotal != null && booking.actualTotal > booking.maxAcceptableTotal) {
      booking.requiresCustomerApproval = true;
      booking.overCapReason = `${booking.actualTotal} exceeds the agreed cap of ${booking.maxAcceptableTotal}`;
    } else {
      booking.requiresCustomerApproval = false;
    }
    if (config && config.roundsToWholeUnits) {
      booking.actualTotal = Math.round(booking.actualTotal);
    }
  }

  // Work does not begin on a price the customer has not agreed to.
  if (to === 'in-progress' && booking.requiresCustomerApproval) {
    throw new ServiceEngineError(
      `advanceBooking: booking ${bookingId} is over the customer's cap and awaiting approval. ${booking.overCapReason}`,
    );
  }

  // Settle before the status changes, so a failed transfer leaves the
  // booking in its previous state rather than marked complete and
  // unpaid. Same posture as submitRelease charging before recording.
  if (to === SETTLES_AT[booking.archetype]) {
    // **This used to be a byte-for-byte copy of `settlement.js`'s
    // block, and `settlement.js`'s own header said it was not.** That
    // header reads: "The fix is not to copy the engine's settlement
    // block into two more files. Money logic duplicated three times
    // drifts, and the drift is invisible until someone is underpaid.
    // So the block moved here and all three call it."
    //
    // Two of the three called it. The engine — which settles 23 of the
    // 25 verticals, so the overwhelming majority of VOID's money —
    // kept its own copy and was never converted. The claim was in a
    // comment; nothing checked it, so it stopped being true without
    // anyone noticing, and the atomicity fix applied to `settleJob`
    // would have missed almost every settlement in the app.
    //
    // Now it genuinely calls it. `settleJob` mutates the booking with
    // the same four settlement fields this block set, and refuses a
    // priceless job with the same rule, so the behaviour is unchanged
    // apart from the two legs now moving atomically.
    await settleJob({
      job: booking,
      verticalId: booking.verticalId,
      total: booking.actualTotal ?? booking.estimatedTotal,
      label: 'service',
      reference: bookingId,
      settleFn,
      now,
    });
  }

  booking.status = to;
  booking.history.push({ status: to, at: now });
  if (to === 'completed' || to === 'returned') booking.completedAt = now;
  return booking;
}

function approveOverCap(store, options = {}) {
  const { bookingId } = options;
  const booking = requireServiceBooking(store, bookingId, 'approveOverCap');
  if (!booking.requiresCustomerApproval) {
    throw new ServiceEngineError(`approveOverCap: booking ${bookingId} is not awaiting approval`);
  }
  booking.requiresCustomerApproval = false;
  booking.overCapApproved = true;
  return booking;
}

// Cancellation runs through the shared policy rather than a
// per-vertical invention, and records what it assessed so a dispute
// has something to read.
function cancelServiceBooking(store, options = {}) {
  const {
    bookingId, cancelledBy = 'customer', reason = 'unspecified', now = Date.now(),
  } = options;

  const booking = requireServiceBooking(store, bookingId, 'cancelServiceBooking');
  const lifecycle = LIFECYCLES[booking.archetype];
  if (!lifecycle[booking.status] || !lifecycle[booking.status].includes('cancelled')) {
    throw new ServiceEngineError(
      `cancelServiceBooking: booking ${bookingId} is ${booking.status} and can no longer be cancelled`,
    );
  }

  const config = store.serviceConfigs[booking.verticalId] || {};
  const assessment = assessCancellation({
    scheduledFor: booking.scheduledFor,
    cancelledAt: now,
    jobTotal: booking.actualTotal ?? booking.estimatedTotal ?? 0,
    cancelledBy,
    ...(config.freeCancellationHours ? { freeCancellationHours: config.freeCancellationHours } : {}),
    ...(config.lateFeeRate ? { lateFeeRate: config.lateFeeRate } : {}),
  });

  booking.status = 'cancelled';
  booking.cancelledBy = cancelledBy;
  booking.cancelledReason = reason;
  booking.cancellationAssessment = assessment;
  booking.history.push({ status: 'cancelled', at: now });
  return { booking, assessment };
}

// -- recurrence ---------------------------------------------------------

function createRecurringSeries(store, options = {}) {
  const {
    verticalId, subjectId = null, customerId, providerId, service,
    firstScheduledFor, intervalDays, occurrences, quotedTotal = null, now = Date.now(),
  } = options;

  const config = store.serviceConfigs[verticalId];
  assertConfig(config, verticalId);
  if (config.archetype !== 'recurring') {
    throw new ServiceEngineError(
      `createRecurringSeries: ${verticalId} is a "${config.archetype}" service, not a recurring one`,
    );
  }

  const times = generateOccurrences({ firstAt: firstScheduledFor, intervalDays, occurrences });
  const recurrenceId = `svc-${verticalId}-${customerId}-${firstScheduledFor}`;

  const created = times.map((at) => {
    const booking = createServiceBooking(store, {
      verticalId, subjectId, customerId, providerId, service,
      scheduledFor: at, quotedTotal, now,
    });
    booking.recurrenceId = recurrenceId;
    return booking;
  });

  return { recurrenceId, bookings: created };
}

function cancelSeries(store, options = {}) {
  const { recurrenceId, reason = 'series cancelled', fromTimestamp = 0, now = Date.now() } = options;
  const affected = store.serviceBookings.filter(
    (b) => b.recurrenceId === recurrenceId
      && !['completed', 'cancelled', 'returned'].includes(b.status)
      && b.scheduledFor >= fromTimestamp,
  );
  for (const booking of affected) {
    booking.status = 'cancelled';
    booking.cancelledReason = reason;
    booking.history.push({ status: 'cancelled', at: now });
  }
  return affected;
}

// -- reading ------------------------------------------------------------

function listBookingsForCustomer(store, customerId, verticalId = null) {
  return store.serviceBookings.filter(
    (b) => b.customerId === customerId && (verticalId === null || b.verticalId === verticalId),
  );
}

function preferredProviders(store, customerId, verticalId) {
  const counts = new Map();
  for (const b of store.serviceBookings) {
    if (b.customerId !== customerId || b.verticalId !== verticalId) continue;
    if (b.status !== 'completed' && b.status !== 'returned') continue;
    if (b.isIntroSession) continue;
    const existing = counts.get(b.providerId)
      || { providerId: b.providerId, completedBookings: 0, lastAt: 0 };
    existing.completedBookings += 1;
    existing.lastAt = Math.max(existing.lastAt, b.completedAt || 0);
    counts.set(b.providerId, existing);
  }
  return [...counts.values()].sort((a, b) => b.lastAt - a.lastAt);
}

// What a vertical's service app actually offers -- the answer to
// "render me this category's booking screen."
function describeService(store, verticalId) {
  const config = store.serviceConfigs[verticalId];
  assertConfig(config, verticalId);
  const vertical = VERTICALS[verticalId];

  return {
    verticalId,
    name: vertical.name,
    archetype: config.archetype,
    services: config.services,
    pricingUnit: vertical.pricingUnit,
    takeRate: vertical.takeRate,
    licensingGated: vertical.licensingGated,
    requiredVetting: requiredVettingFor(verticalId),
    requiresSubject: Boolean(config.requiresSubject),
    requiresIntroSession: Boolean(config.requiresIntroSession),
    supportsRecurring: config.archetype === 'recurring',
    priceKnownAtBooking: PRICING_BECOMES_REAL_AT[config.archetype] === INITIAL_STATE[config.archetype],
    lifecycle: Object.keys(LIFECYCLES[config.archetype]),
    comparables: config.comparables || [],
  };
}

module.exports = {
  ARCHETYPES,
  SETTLES_AT,
  VOID_PLATFORM_ACCOUNT,
  LIFECYCLES,
  INITIAL_STATE,
  PRICING_BECOMES_REAL_AT,
  ServiceEngineError,
  registerSubject,
  getSubject,
  listSubjectsForOwner,
  createServiceBooking,
  getServiceBooking,
  advanceBooking,
  approveOverCap,
  cancelServiceBooking,
  createRecurringSeries,
  cancelSeries,
  listBookingsForCustomer,
  preferredProviders,
  describeService,
};
