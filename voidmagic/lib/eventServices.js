// VOID MAGIC -- VOID Event Services (Section 8, Phase 2's first real
// slice). Source of truth: VOID_MAGIC_MASTER_BUILD_BRIEF.md SS8 ("This
// is one of the primary reasons VOID MAGIC belongs in the VOID
// ecosystem"): VOID SECURITY, VOID TRANSPORT, VOID SPACE, VOID
// STAFFING, VOID FULFILLMENT -- and SS47's explicit architectural
// principle, "direct app-to-app relationships" (VOID MAGIC calls
// VOID's own APIs directly, not through a V4 message bus).
//
// Real code reuse, the same pattern already established for CHOPZ
// SHOP's `requestVoidCourierJob`: this module creates an actual job on
// VOID's existing `requestJob()`/verticals system via an injected
// `voidRequestFn`, not a fourth parallel logistics system. SS38 names
// `SecurityAssignment`/`StaffAssignment`/`Transportation` as separate
// entities, but this module deliberately follows VOID's own "one loop
// for many types" design (its 18+ verticals all run through one real
// `Job` shape) rather than building four/five separate real models --
// one `EventServiceRequest` record per service type, flagged as an
// interpretive simplification since SS38 only names entities without
// field-level shapes.
//
// The exact VOID vertical each service type maps to is a real,
// interpretive choice -- VOID MAGIC's own brief never names VOID's
// vertical ids directly. Mapped against VOID's real, already-built
// vertical list (`void/lib/verticals.js`):
//   security   -> 'security'       (VOID's own Security vertical)
//   transport  -> 'transportation' (VOID's own Transportation vertical)
//   space      -> 'eventPlanning'  (closest real fit for venue
//                                   discovery/coordination/booking --
//                                   VOID has no dedicated venue
//                                   vertical)
//   staffing   -> 'staffing'       (VOID's own Staffing vertical)
//   fulfillment -> 'courier'       (VIP packages/merch/gifts/signed
//                                   items -- the same real vertical
//                                   CHOPZ SHOP already uses for
//                                   package delivery)
//
// Real payment model: the host pays for event logistics (the
// real-world norm -- event organizers pay for security/staff/venue/
// transport, not attendees), and that payment happens entirely inside
// VOID's own `completeJob` dual payout once the job is actually
// completed -- VOID MAGIC only orchestrates the request, it does not
// intermediate payment for these services (a deliberately different
// shape from `bookings.js`'s own escrow, which handles the
// customer-to-host Experience payment, a separate real transaction).

const { getExperience } = require('./experiences');

const EVENT_SERVICE_TYPES = ['security', 'transport', 'space', 'staffing', 'fulfillment'];

const EVENT_SERVICE_TO_VOID_VERTICAL = {
  security: 'security',
  transport: 'transportation',
  space: 'eventPlanning',
  staffing: 'staffing',
  fulfillment: 'courier',
};

async function requestEventService(store, options = {}) {
  const {
    experienceId, serviceType, quantity, unitPrice, voidRequestFn, now = Date.now(),
  } = options;

  const experience = getExperience(store, experienceId);
  if (!experience) throw new Error(`requestEventService: no experience with id ${experienceId}`);
  if (!EVENT_SERVICE_TYPES.includes(serviceType)) {
    throw new Error(`requestEventService: invalid serviceType "${serviceType}" (expected one of ${EVENT_SERVICE_TYPES.join(', ')})`);
  }
  if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('requestEventService requires a positive quantity');
  if (!Number.isFinite(unitPrice) || unitPrice <= 0) throw new Error('requestEventService requires a positive unitPrice');
  if (typeof voidRequestFn !== 'function') {
    throw new Error('requestEventService requires a voidRequestFn(verticalId, customerId, quantity, unitPrice)');
  }

  const verticalId = EVENT_SERVICE_TO_VOID_VERTICAL[serviceType];
  const job = await voidRequestFn(verticalId, experience.hostId, quantity, unitPrice);

  const request = {
    id: store.nextEventServiceRequestId++,
    experienceId,
    serviceType,
    verticalId,
    voidJobId: job.id,
    status: 'requested',
    requestedAt: now,
  };
  store.eventServiceRequests.push(request);
  return request;
}

function getEventServiceRequest(store, requestId) {
  return store.eventServiceRequests.find((r) => r.id === requestId) || null;
}

function listEventServiceRequests(store, experienceId) {
  if (!getExperience(store, experienceId)) throw new Error(`listEventServiceRequests: no experience with id ${experienceId}`);
  return store.eventServiceRequests.filter((r) => r.experienceId === experienceId);
}

module.exports = {
  EVENT_SERVICE_TYPES, EVENT_SERVICE_TO_VOID_VERTICAL, requestEventService, getEventServiceRequest, listEventServiceRequests,
};
