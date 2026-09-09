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

// `idempotencyKey` is optional and forwarded to V3 as an
// Idempotency-Key header. When present, V3 replays the first
// result instead of charging again. It is deliberately a
// parameter rather than something derived here -- see the note
// at the call sites.
async function transferVCoin(fromUserId, toUserId, amount, reason, idempotencyKey) {
  const res = await fetch(`${V3_API_URL}/api/vcoin/transfer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...serviceHeaders() },
    body: JSON.stringify({
      fromUserId, toUserId, amount, reason,
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `transferVCoin failed (${res.status})`);
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
  store: store.bookings, transferVCoin, requestVoidJob, requestVoidHourlyBooking,
}));
app.use('/api/home', createHomeRouter({ store: store.home, transferVCoin }));
app.use('/api/auto', createAutoRouter({ store: store.auto, transferVCoin }));
app.use('/api/flights', createFlightsRouter({
  store: store.flights, bookingsStore: store.bookings, transferVCoin, createBooking,
}));

app.listen(PORT, () => {
  console.log(`VACAY listening on http://localhost:${PORT}`);
  console.log(`Health check: curl http://localhost:${PORT}/api/health`);
  console.log('Sections: /api/bookings, /api/home, /api/auto, /api/flights');
});
