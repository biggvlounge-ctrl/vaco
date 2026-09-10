// VACAY -- one app, four real sections inside it, per explicit
// instruction: "one big app with different apps inside," not five
// separate deployable services. Each section keeps its own real,
// isolated lib/ folder and its own store namespace (see lib/store.js's
// own header) -- genuinely separate concerns, just composed into one
// process/one port instead of five.
//
// - Bookings (/api/bookings) -- Airbnb stays + Booking.com
//   professional inventory (hostType) + Airbnb Experiences + VOID
//   integration. Was the standalone `vacay` + `vacay-experiences`
//   apps.
// - Home (/api/home) -- Zillow's real estate model. Was the
//   standalone `vacay-homes` app.
// - Auto (/api/auto) -- three real businesses in one section: Turo
//   peer rental, CarGurus buy/sell, and VACAY's own owned-fleet
//   rental. Was the standalone `vacay-auto` app, plus two new real
//   sub-features.
// - Flights (/api/flights) -- Expedia's merchant-of-record model,
//   plus /bundles, a real, in-process (not cross-app HTTP anymore)
//   Flights+Stays booking. Was the standalone `vacay-flights` app.
//
// Run:
//   npm install
//   npm start
//
// Test:
//   curl http://localhost:8803/api/health

const express = require('express');
const cors = require('cors');
require('dotenv/config');

const { createVacayStore } = require('./lib/store');
const path = require('path');
const { createPersistentStore, durable } = require('./lib/persistence');
const { createBookingsRouter } = require('./lib/bookings/routes');
const { createHomeRouter } = require('./lib/home/routes');
const { createAutoRouter } = require('./lib/auto/routes');
const { createFlightsRouter } = require('./lib/flights/routes');
const { createBooking } = require('./lib/bookings/bookings');
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
const PORT = process.env.PORT || 8803;
const V3_API_URL = process.env.V3_API_URL || 'http://localhost:8811';

// V3 requires every mutating caller to be either a user session or a
// known internal service. This app settles server-to-server, with no
// end-user session to present, so it presents a service credential.
// See shared/serviceAuth.js. Absent in dev, which V3 answers with a
// clear 401 rather than a silent success.
const VACO_SERVICE_NAME = process.env.VACO_SERVICE_NAME || 'vacay';
const VACO_SERVICE_TOKEN = process.env.VACO_SERVICE_TOKEN || '';
function serviceHeaders() {
  return VACO_SERVICE_TOKEN
    ? { 'X-Service-Name': VACO_SERVICE_NAME, 'X-Service-Token': VACO_SERVICE_TOKEN }
    : {};
}

const VOID_API_URL = process.env.VOID_API_URL || 'http://localhost:8793';
const store = createPersistentStore(path.join(__dirname, 'data', 'store.json'), createVacayStore);
app.use(durable(store));  // commit before responding -- see lib/persistence.js

// **VACAY receives writes as well as sending them.** Its two inventory
// surfaces -- the fleet vehicles VACAY itself owns and the airline
// inventory it resells as merchant of record -- belong to no user, so
// they are guarded with `requireCallingService()` in the routers. That
// is only meaningful with serviceAuth mounted to establish who the
// caller is in the first place.
//
// It also closes the whole app to anonymous mutation as a floor: every
// one of VACAY's 29 mutating routes moves VCoin or commits inventory,
// and none of them has a legitimate anonymous caller.
const serviceAuth = createServiceAuth();
app.use(serviceAuth.middleware);

// Atomic settlement: every leg moves, or none does.
//
// **VACAY settles out of escrow**, which is what made the old shape
// dangerous. A stay, an experience and a peer-to-peer car rental each
// paid the host or owner and then the platform in two consecutive
// transfers *from the same escrow account* -- so the second could fail
// precisely because the first had just drained it. The booking's status
// is written afterwards, so the record stayed `booked` and a retry paid
// the host out of escrow a second time.
//
// A flight was worse: three legs, the first of them the passenger's
// own charge, with the booking record created only after all three. A
// failure part-way charged a passenger for a flight that had no
// booking and no seat taken.
//
// `POST /api/vcoin/settle` validates every leg against *running*
// balances, which is also what makes the flight case work at all: the
// escrow credit on leg 1 is what funds legs 2 and 3.
//
// **`settleVCoin` is deliberately gone**, rather than kept beside
// this. It also carried a real, smaller bug worth recording: it took
// an `idempotencyKey` parameter, its comment said the value was
// "forwarded to V3 as an Idempotency-Key header", and the function
// never referenced it again. Every caller that passed one got no
// idempotency at all.
async function settleVCoin(legs, meta = {}) {
  const res = await fetch(`${V3_API_URL}/api/vcoin/settle`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...serviceHeaders(),
      // Unlike the helper this replaces, the key is actually sent.
      ...(meta.reason ? { 'Idempotency-Key': `settle:${meta.reason}` } : {}),
    },
    body: JSON.stringify({ legs, reason: meta.reason ?? null }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `settleVCoin failed (${res.status})`);
  return body;
}

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

async function requestVoidHourlyBooking(riderId, driverId, blockHours, hourlyRate, overageRatePerMile, overageRatePerMinute) {
  const res = await fetch(`${VOID_API_URL}/api/hourly-booking`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      riderId, driverId, blockHours, hourlyRate, overageRatePerMile, overageRatePerMinute,
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `requestVoidHourlyBooking failed (${res.status})`);
  return body;
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true, service: 'vacay', sections: ['bookings', 'home', 'auto', 'flights'],
  });
});

app.use('/api/bookings', createBookingsRouter({
  store: store.bookings, settleVCoin, requestVoidJob, requestVoidHourlyBooking,
}));
app.use('/api/home', createHomeRouter({ store: store.home, settleVCoin }));
app.use('/api/auto', createAutoRouter({ store: store.auto, settleVCoin }));
app.use('/api/flights', createFlightsRouter({
  store: store.flights, bookingsStore: store.bookings, settleVCoin, createBooking,
}));

app.listen(PORT, () => {
  console.log(`VACAY listening on http://localhost:${PORT}`);
  console.log(`Health check: curl http://localhost:${PORT}/api/health`);
  console.log('Sections: /api/bookings, /api/home, /api/auto, /api/flights');
});
