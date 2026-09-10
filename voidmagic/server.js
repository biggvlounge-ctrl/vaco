// VOID MAGIC -- Meet & Greet / Interactions / Conversations booking
// platform. Part of Vvltvre Touring & Tix, powered by VOID.
// Source of truth: VOID_MAGIC_MASTER_BUILD_BRIEF.md. Real MVP scope
// per the brief's own Section 39: the minimum viable transaction loop
// only.
//
// Run:
//   npm install
//   npm start
//
// Test:
//   curl http://localhost:8797/api/health

const express = require('express');
const cors = require('cors');
require('dotenv/config');

const { EXPERIENCE_TYPES, EXPERIENCE_FORMATS, createExperience, getExperience, discoverExperiences } = require('./lib/experiences');
const {
  VOID_MAGIC_ESCROW_ACCOUNT, PLATFORM_TAKE_RATE, CANCELLATION_CUTOFF_HOURS, bookExperience, getBooking, checkIn, completeExperience, cancelBooking, getPostEventSummary,
} = require('./lib/bookings');
const {
  EVENT_SERVICE_TYPES, requestEventService, getEventServiceRequest, listEventServiceRequests,
} = require('./lib/eventServices');
const {
  WAITING_ROOM_STATUSES, enterWaitingRoom, getWaitingRoomSession, verifyIdentity, admitToExperience, exitExperience,
} = require('./lib/digitalWaitingRoom');
const {
  NOTIFICATION_TYPES, createNotification, getNotifications, markAsRead,
} = require('./lib/notifications');
const { getCreatorAnalytics } = require('./lib/creatorAnalytics');
const {
  favoriteCreator, unfavoriteCreator, getFavorites, isFavorited, getMyExperiences,
} = require('./lib/customerProfiles');
const {
  MEDIA_TYPES, orderMedia, getMediaOrder, listMediaOrders, deliverMedia, getMagicMemoryPackage,
} = require('./lib/media');
const { verifyArrival } = require('./lib/geofencing');
const { createVoidMagicStore } = require('./lib/store');
const path = require('path');
const { createPersistentStore, durable } = require('./lib/persistence');
const {
  requireActor, requireSession, requireCallingService,
} = require('./lib/shieldAuth.cjs');
const { createServiceAuth } = require('./lib/serviceAuth.cjs');
const { traceMiddleware } = require('./lib/tracing.cjs');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Trace context, mounted before any auth middleware: a request that is
// *refused* still carries a trace id, and a 401 you cannot correlate is
// exactly the one you want to correlate.
app.use(traceMiddleware());


app.use(express.static(path.join(__dirname, 'public')));
const PORT = process.env.PORT || 8797;
const V3_API_URL = process.env.V3_API_URL || 'http://localhost:8811';

// V3 requires every mutating caller to be either a user session or a
// known internal service. This app settles server-to-server, with no
// end-user session to present, so it presents a service credential.
// See v3/lib/serviceAuth.js. Absent in dev, which V3 answers with a
// clear 401 rather than a silent success.
const VACO_SERVICE_NAME = process.env.VACO_SERVICE_NAME || 'voidmagic';
const VACO_SERVICE_TOKEN = process.env.VACO_SERVICE_TOKEN || '';
function serviceHeaders() {
  return VACO_SERVICE_TOKEN
    ? { 'X-Service-Name': VACO_SERVICE_NAME, 'X-Service-Token': VACO_SERVICE_TOKEN }
    : {};
}

const VOID_API_URL = process.env.VOID_API_URL || 'http://localhost:8793';
const store = createPersistentStore(path.join(__dirname, 'data', 'store.json'), createVoidMagicStore);
app.use(durable(store));  // commit before responding -- see lib/persistence.js

// Atomic settlement: every leg moves, or none does.
//
// **VOID MAGIC settles out of escrow like VACAY**, and had the same
// defect. A completed experience, a late cancellation and a delivered
// media order each paid the host and then the platform in two
// consecutive transfers from the same escrow account -- so the second
// could fail because the first had just drained it. Each record's
// status is written afterwards, so a partial failure left the booking
// or order in its pre-settlement state and a retry paid the host a
// second time.
//
// `POST /api/vcoin/settle` validates every leg against running balances
// and writes nothing unless all of them pass.
//
// `settleVCoin` is deliberately gone rather than kept beside this: a
// working single-transfer helper is what the next money path in this
// app gets written with, and consecutive calls to it are the defect.
async function settleVCoin(legs, meta = {}) {
  const res = await fetch(`${V3_API_URL}/api/vcoin/settle`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...serviceHeaders(),
      // The settlement reason uniquely names the booking or order, so
      // it doubles as the idempotency key: a retried settlement replays
      // V3's first answer rather than paying twice.
      ...(meta.reason ? { 'Idempotency-Key': `settle:${meta.reason}` } : {}),
    },
    body: JSON.stringify({ legs, reason: meta.reason ?? null }),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.error || `settleVCoin failed (${res.status})`);
  }
  return body;
}

// The real, direct VOID Event Services call (Section 8/47's "direct
// app-to-app relationships", not a V4 message bus) -- creates an
// actual job on VOID's own existing marketplace.
async function requestVoidJob(verticalId, customerId, quantity, unitPrice) {
  const res = await fetch(`${VOID_API_URL}/api/job`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      verticalId, customerId, quantity, unitPrice,
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `requestVoidJob failed (${res.status})`);
  return body;
}

// == Authorization ======================================================
//
// **Two principals, and almost every route belongs to exactly one.** A
// **host** owns an experience and gets paid; a **customer** books it and
// pays. Sixteen of seventeen mutating routes had no guard, on an app
// where every one of them either moves VCoin out of escrow or decides
// who gets through the door.
//
// The door is the part worth reading twice. `verifyIdentity` checks a
// credential the attendee presents and marks the session
// `identity-verified` — the same claimed-vs-verified line VOID's
// licensing pass turned on. It is the host's check to make, not the
// attendee's: an attendee who can call it verifies themselves.
const serviceAuth = createServiceAuth();
app.use(serviceAuth.middleware);

function requireRecordParty(label, lookup, partiesOf) {
  const session = requireSession();
  return (req, res, next) => session(req, res, () => {
    const record = lookup(req);
    if (!record) return res.status(404).json({ error: `no ${label} with id ${req.params.id}` });
    const parties = [].concat(partiesOf(record)).filter(Boolean);
    if (!parties.includes(req.sessionUserId)) {
      return res.status(403).json({ error: `only a party to this ${label} may act on it` });
    }
    return next();
  });
}

const hostOfExperience = (experienceId) => {
  const experience = getExperience(store, Number(experienceId));
  return experience ? experience.hostId : null;
};
const hostOfBooking = (booking) => (booking ? hostOfExperience(booking.experienceId) : null);

// Cancelling is genuinely either party's, and the refund rule makes
// that safe rather than merely convenient: the outcome is decided by
// the cancellation cutoff, not by who called. A customer cancelling
// late still settles the host; a host cancelling early still refunds
// the customer. Neither side can pick the favourable branch by being
// the one to press the button.
const requireBookingParty = () => requireRecordParty(
  'booking', (req) => getBooking(store, Number(req.params.id)),
  (b) => [b.customerId, hostOfBooking(b)],
);
const requireBookingCustomer = () => requireRecordParty(
  'booking', (req) => getBooking(store, Number(req.params.id)), (b) => b.customerId,
);
// The door: check-in, identity verification, admission.
const requireBookingHost = () => requireRecordParty(
  'booking', (req) => getBooking(store, Number(req.params.id)), (b) => hostOfBooking(b),
);
const requireExperienceHost = () => requireRecordParty(
  'experience', (req) => getExperience(store, Number(req.params.id)), (e) => e.hostId,
);
const requireWaitingRoomHost = () => requireRecordParty(
  'waiting room session', (req) => getWaitingRoomSession(store, Number(req.params.id)),
  (sess) => hostOfBooking(getBooking(store, sess.bookingId)),
);
const requireWaitingRoomCustomer = () => requireRecordParty(
  'waiting room session', (req) => getWaitingRoomSession(store, Number(req.params.id)),
  (sess) => (getBooking(store, sess.bookingId) || {}).customerId,
);
const requireMediaOrderHost = () => requireRecordParty(
  'media order', (req) => getMediaOrder(store, Number(req.params.id)),
  (o) => hostOfBooking(getBooking(store, o.bookingId)),
);
const requireNotificationRecipient = () => requireRecordParty(
  'notification', (req) => (store.notifications || []).find((n) => n.id === Number(req.params.id)),
  (n) => n.recipientId,
);

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true, service: 'voidmagic', experienceTypes: EXPERIENCE_TYPES, experienceFormats: EXPERIENCE_FORMATS,
    platformTakeRate: PLATFORM_TAKE_RATE, cancellationCutoffHours: CANCELLATION_CUTOFF_HOURS,
    eventServiceTypes: EVENT_SERVICE_TYPES, waitingRoomStatuses: WAITING_ROOM_STATUSES,
    notificationTypes: NOTIFICATION_TYPES, mediaTypes: MEDIA_TYPES,
  });
});

app.post('/api/experiences', requireActor('hostId'), (req, res) => {
  try {
    res.status(201).json(createExperience(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/experiences/:id', (req, res) => {
  const experience = getExperience(store, Number(req.params.id));
  if (!experience) return res.status(404).json({ error: `no experience with id ${req.params.id}` });
  res.json(experience);
});

app.get('/api/experiences', (req, res) => {
  const { type, format } = req.query;
  res.json({ experiences: discoverExperiences(store, { type: type || null, format: format || null }) });
});

app.post('/api/bookings', requireActor('customerId'), async (req, res) => {
  try {
    res.status(201).json(await bookExperience(store, { ...req.body, settleFn: settleVCoin }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/bookings/:id', (req, res) => {
  const booking = getBooking(store, Number(req.params.id));
  if (!booking) return res.status(404).json({ error: `no booking with id ${req.params.id}` });
  res.json(booking);
});

app.post('/api/bookings/:id/check-in', requireBookingHost(), (req, res) => {
  try {
    res.json(checkIn(store, { ...req.body, bookingId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/bookings/:id/cancel', requireBookingParty(), async (req, res) => {
  try {
    res.json(await cancelBooking(store, { ...req.body, bookingId: Number(req.params.id), settleFn: settleVCoin }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/experiences/:id/complete', requireExperienceHost(), async (req, res) => {
  try {
    res.json(await completeExperience(store, { experienceId: Number(req.params.id), settleFn: settleVCoin }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/experiences/:id/event-services', requireExperienceHost(), async (req, res) => {
  try {
    res.status(201).json(await requestEventService(store, {
      ...req.body, experienceId: Number(req.params.id), voidRequestFn: requestVoidJob,
    }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/event-services/:id', (req, res) => {
  const request = getEventServiceRequest(store, Number(req.params.id));
  if (!request) return res.status(404).json({ error: `no event service request with id ${req.params.id}` });
  res.json(request);
});

app.get('/api/experiences/:id/event-services', (req, res) => {
  try {
    res.json({ requests: listEventServiceRequests(store, Number(req.params.id)) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/waiting-room/enter', requireActor('customerId'), (req, res) => {
  try {
    res.status(201).json(enterWaitingRoom(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/waiting-room/:id', (req, res) => {
  const session = getWaitingRoomSession(store, Number(req.params.id));
  if (!session) return res.status(404).json({ error: `no waiting room session with id ${req.params.id}` });
  res.json(session);
});

app.post('/api/waiting-room/:id/verify-identity', requireWaitingRoomHost(), (req, res) => {
  try {
    res.json(verifyIdentity(store, { ...req.body, sessionId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/waiting-room/:id/admit', requireWaitingRoomHost(), (req, res) => {
  try {
    res.json(admitToExperience(store, { sessionId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/waiting-room/:id/exit', requireWaitingRoomCustomer(), (req, res) => {
  try {
    res.json(exitExperience(store, { sessionId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/notifications', requireCallingService(), (req, res) => {
  try {
    res.status(201).json(createNotification(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/notifications/:recipientId', (req, res) => {
  try {
    res.json({ notifications: getNotifications(store, req.params.recipientId, { unreadOnly: req.query.unreadOnly === 'true' }) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/notifications/:id/read', requireNotificationRecipient(), (req, res) => {
  try {
    res.json(markAsRead(store, Number(req.params.id)));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/creators/:hostId/analytics', (req, res) => {
  try {
    res.json(getCreatorAnalytics(store, req.params.hostId));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/favorites', requireActor('customerId'), (req, res) => {
  try {
    res.status(201).json(favoriteCreator(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/favorites/remove', requireActor('customerId'), (req, res) => {
  try {
    res.json(unfavoriteCreator(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/customers/:customerId/favorites', (req, res) => {
  try {
    res.json({ favorites: getFavorites(store, req.params.customerId) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/customers/:customerId/favorites/:creatorId', (req, res) => {
  res.json({ favorited: isFavorited(store, req.params.customerId, req.params.creatorId) });
});

app.get('/api/customers/:customerId/experiences', (req, res) => {
  try {
    res.json({ experiences: getMyExperiences(store, req.params.customerId, { upcomingOnly: req.query.upcomingOnly === 'true' }) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/media-orders', requireActor('customerId'), async (req, res) => {
  try {
    res.status(201).json(await orderMedia(store, { ...req.body, settleFn: settleVCoin }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/media-orders/:id', (req, res) => {
  const order = getMediaOrder(store, Number(req.params.id));
  if (!order) return res.status(404).json({ error: `no media order with id ${req.params.id}` });
  res.json(order);
});

app.get('/api/bookings/:id/media-orders', (req, res) => {
  try {
    res.json({ mediaOrders: listMediaOrders(store, Number(req.params.id)) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/media-orders/:id/deliver', requireMediaOrderHost(), async (req, res) => {
  try {
    res.json(await deliverMedia(store, { ...req.body, mediaOrderId: Number(req.params.id), settleFn: settleVCoin }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/bookings/:id/magic-memory', (req, res) => {
  try {
    res.json(getMagicMemoryPackage(store, Number(req.params.id)));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/bookings/:id/verify-arrival', requireBookingCustomer(), (req, res) => {
  try {
    res.json(verifyArrival(store, { ...req.body, bookingId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/bookings/:id/post-event-summary', (req, res) => {
  try {
    res.json(getPostEventSummary(store, Number(req.params.id)));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`VOID MAGIC listening on http://localhost:${PORT}`);
  console.log(`Health check: curl http://localhost:${PORT}/api/health`);
});
