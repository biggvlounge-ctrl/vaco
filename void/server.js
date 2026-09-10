// VOID — real-world execution platform, the software-buildable slice.
// Source of truth: VOID_MASTER_FREEZE.md, VOID_MULTI_STOP_DRONE_ROUTING.md,
// VOID_STATION_NAMING_CONVENTION.md, VOID_SERVICE_VERTICALS_COMPARABLES.md,
// BUSINESS_AGENT_GIBSON_VOID_DESIGN.md, VOID_HVNTZ_SESSION_ADDITIONS_PRICING.md.
//
// Run:
//   npm install
//   npm start
//
// Test:
//   curl http://localhost:8793/api/health

const express = require('express');
const cors = require('cors');
require('dotenv/config');

const { createVoidStore } = require('./lib/store');
const path = require('path');
const { createPersistentStore, durable } = require('./lib/persistence');
const { STATION_TYPES, registerStation, getStation, getStationsByRegion } = require('./lib/stations');
const { computeNetworkDensity } = require('./lib/networkDensity');
const { registerNoFlyZone, getNoFlyZones } = require('./lib/noFlyZones');
const {
  OPTIMIZATION_MODES, buildRoute, getRoute, groupOrdersIntoRoutes,
} = require('./lib/droneRouting');
const { listVerticals, getVertical } = require('./lib/verticals');
const {
  JOB_STATUSES, requestJob, getJob, matchProvider, acceptJob, completeJob, rateJob,
  reportFailedDelivery, retryDelivery, sweepFailedDeliveries, cancelJob, getJobsForVertical, getJobsForUser,
} = require('./lib/marketplace');
const {
  declareTrip, getTripDeclaration, registerVehicleCapacityProfile, getVehicleCapacityProfile, checkCapacityFit,
} = require('./lib/loadManagement');
const { computeDynamicCargoPricing } = require('./lib/cargoPricing');
const { computeSequencing } = require('./lib/sequencing');
const {
  createReserveBooking, getReserveBooking, matchReserveDriver, cancelReserveBooking,
} = require('./lib/reserveBooking');
const {
  openCommuteBatch, getCommuteBatch, submitCommuteRequest, runBatchMatch,
} = require('./lib/commuteScheduling');
const {
  createDedicatedLane, getDedicatedLane, claimDedicatedLane, releaseDedicatedLane,
  postSpotLoad, getSpotLoad, bookSpotLoad,
} = require('./lib/dedicatedLanes');
const {
  createHourlyBooking, getHourlyBooking, addHourlyStop, computeHourlyCharge,
} = require('./lib/hourlyBooking');
const {
  DEFAULT_ACCEPTABLE_WINDOW_HOURS, decideAirVsGround, computeLoadIntelligenceScore, recommendDeadTimeOpportunity,
  ORDER_TYPES, getDeliveryPriority, computeAcceptanceDelay,
} = require('./lib/dispatchIntelligence');
const { registerKitchenStream, getKitchenTrustStatus } = require('./lib/foodTrust');
const {
  VEHICLE_TIERS, EQUIPMENT_OPTIONS, createMovingJob, getMovingJob, assignMovingDriver, addMovingHelper,
} = require('./lib/movingServices');
const {
  REAL_ESTATE_SERVICES, POST_PRODUCTION_MODES, createRealEstateMediaJob, getRealEstateMediaJob, assignNearestProvider,
} = require('./lib/realEstateMedia');
const {
  ORIGINATION_METHODS, originateShipmentAtHub, getHubOriginatedShipment, decideFulfillmentForShipment,
} = require('./lib/hubOrigination');
const {
  LOCKER_LOCATION_TYPES, PMS_OPTIONS, registerLocker, getLocker, depositPackage, retrievePackage,
} = require('./lib/voidLocker');
const {
  LOCKER_TO_DOOR_STATUSES, requestLockerToDoor, getLockerToDoorRequest, assignDriverToLockerRequest,
  retrieveWithDriverAccess, completeLockerToDoorDelivery,
} = require('./lib/lockerToDoor');
const { findRelayPath } = require('./lib/multiModalRelay');
const {
  AFFILIATE_ROLES, registerExternalBusiness, submitDeliveryManifest, getManifestStatus,
  registerAffiliateStation, listAffiliateStations,
} = require('./lib/externalIntegration');
const {
  DRIVER_TIERS, DSP_STARTUP_CAPITAL_REQUIRED, registerGigDriver, getGigDriver,
  registerVoidDSP, getVoidDSP, addDriverToDSP, addVehicleToDSP, assignRouteToDSP,
} = require('./lib/driverFleet');
const {
  DELIVERY_METHODS, quoteDeliveryMethods, quotePickupOption, selectDeliveryMethod, getDeliveryMethodSelection,
} = require('./lib/deliveryChoice');
const {
  LOCKER_SIZES, registerBusinessLocker, getBusinessLocker, getBusinessLockersForSeller,
  placeSellerInventory, loadDroneFromLocker, getDroneLoadingEventsForLocker,
} = require('./lib/businessLockers');
const {
  PRODUCT_CATEGORIES, registerRegulatedBox, getRegulatedBox, logCustodyEvent, verifyRecipientIdentity,
} = require('./lib/regulatedBoxes');
const {
  EMPLOYMENT_TYPES, URGENCY_LEVELS, postStaffingPosition, getStaffingPosition,
  getStaffingPositionsForBusiness, requestHuntStaffing, getHuntStaffingRequest,
} = require('./lib/staffing');
const {
  MOBILE_VEHICLE_TYPES, OPERATION_MODES, registerMobileDockingVehicle, getMobileDockingVehicle,
  updateVehicleLocation, dockDrone, launchDrone, computeDualMobilityCoordination,
  registerLaunchpadDriver, getLaunchpadDriver,
} = require('./lib/mobileDocking');
const {
  ACQUISITION_MODELS, registerTaasSubscription, getTaasSubscription, getTaasSubscriptionsForClient,
} = require('./lib/taas');

const {
  requireActor, requireParamActor, requireSession, requireCallingService,
} = require('./lib/shieldAuth.cjs');
const { createServiceAuth } = require('./lib/serviceAuth.cjs');
const { createDecisionLog } = require('./lib/decisionLog.cjs');
const { createOperatorAuth } = require('./lib/operatorAuth.cjs');
const twoPerson = require('./lib/twoPersonVetting');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const { traceMiddleware } = require('./lib/tracing.cjs');
// Trace context, mounted before any auth middleware: a request that is
// *refused* still carries a trace id, and a 401 you cannot correlate is
// exactly the one you want to correlate.
app.use(traceMiddleware());


app.use(express.static(path.join(__dirname, 'public')));
const PORT = process.env.PORT || 8793;
const V3_API_URL = process.env.V3_API_URL || 'http://localhost:8811';

// V3 requires every mutating caller to be either a user session or a
// known internal service. This app settles server-to-server, with no
// end-user session to present, so it presents a service credential.
// See shared/serviceAuth.js. Absent in dev, which V3 answers with a
// clear 401 rather than a silent success.
const VACO_SERVICE_NAME = process.env.VACO_SERVICE_NAME || 'void';
const VACO_SERVICE_TOKEN = process.env.VACO_SERVICE_TOKEN || '';
function serviceHeaders() {
  return VACO_SERVICE_TOKEN
    ? { 'X-Service-Name': VACO_SERVICE_NAME, 'X-Service-Token': VACO_SERVICE_TOKEN }
    : {};
}

const HVNTZ_API_URL = process.env.HVNTZ_API_URL || 'http://localhost:8792';
const VACA_API_URL = process.env.VACA_API_URL || 'http://localhost:8804';
const VACO_ANALYTICS_URL = process.env.VACO_ANALYTICS_URL || 'http://localhost:8790';
const store = createPersistentStore(path.join(__dirname, 'data', 'store.json'), createVoidStore);
app.use(durable(store));  // commit before responding -- see lib/persistence.js

// **Mounted here, above every route, and that placement is the point.**
// This block first sat next to the guard helpers two thirds of the way
// down the file — which reads fine and is wrong: `app.use()` only
// applies to routes registered *after* it, so seventy-odd routes
// defined above would have skipped it silently. The per-route guards
// would still have fired, so nothing would have looked broken; the
// routes relying on `req.callingService` would simply have refused
// everyone forever, and the rest would have accepted anonymous
// callers. Middleware order is composition, and composition is the
// category this repo keeps getting caught by.
const serviceAuth = createServiceAuth();
app.use(serviceAuth.middleware);

// Operator-grade decisions are recorded in vaco-audit BEFORE they
// execute, and refuse to execute if the record does not land. See
// shared/decisionLog.js for why this one does not fail soft, and
// dev-docs/DECISION_AUDIT.md for the posture.
const decisionLog = createDecisionLog({ app: 'void' });
const operatorAuth = createOperatorAuth();
const { requireOperator } = operatorAuth;

// The ownership-lookup shape. VOID's ids (`customerId`, `providerId`,
// `riderId`, `driverId`, `sellerId`) are V3 account ids — `completeJob`
// settles to `job.providerId` through the ledger — so they are Shield
// user ids and compare directly against a session.
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

// A job has a customer and (once matched) a provider. Both may act on
// it: a customer cancels, a provider accepts and completes. Rating is
// narrower — only the customer rates.
const requireJobParty = () => requireRecordParty(
  'job', (req) => getJob(store, Number(req.params.id)), (j) => [j.customerId, j.providerId],
);
const requireJobCustomer = () => requireRecordParty(
  'job', (req) => getJob(store, Number(req.params.id)), (j) => j.customerId,
);
const requireReserveBookingRider = () => requireRecordParty(
  'reserve booking', (req) => getReserveBooking(store, Number(req.params.id)), (b) => b.riderId,
);
const requireHourlyBookingParty = () => requireRecordParty(
  'hourly booking', (req) => getHourlyBooking(store, Number(req.params.id)), (b) => [b.riderId, b.driverId],
);
const requirePetBookingParty = () => requireRecordParty(
  'pet care booking', (req) => petCare.getBooking(store, Number(req.params.id)), (b) => [b.ownerId, b.providerId],
);
const requireLaundryOrderParty = () => requireRecordParty(
  'laundry order', (req) => laundry.getOrder(store, Number(req.params.id)), (o) => [o.customerId, o.providerId],
);
// Approving an over-cap charge is the customer accepting a bigger bill.
// The provider who weighed the load must not be able to approve it on
// the customer's behalf — that is the whole point of a cap.
const requireLaundryOrderCustomer = () => requireRecordParty(
  'laundry order', (req) => laundry.getOrder(store, Number(req.params.id)), (o) => o.customerId,
);
const requireServiceBookingParty = () => requireRecordParty(
  'service booking', (req) => serviceEngine.getServiceBooking(store, Number(req.params.id)), (b) => [b.customerId, b.providerId],
);
// Same reasoning as laundry, across all 25 verticals at once.
const requireServiceBookingCustomer = () => requireRecordParty(
  'service booking', (req) => serviceEngine.getServiceBooking(store, Number(req.params.id)), (b) => b.customerId,
);
const requireLockerToDoorCustomer = () => requireRecordParty(
  'locker-to-door request', (req) => getLockerToDoorRequest(store, Number(req.params.id)), (r) => r.customerId,
);
const requireMovingJobCustomer = () => requireRecordParty(
  'moving job', (req) => getMovingJob(store, Number(req.params.id)), (m) => m.customerId,
);
const requireMediaJobAgent = () => requireRecordParty(
  'real estate media job', (req) => getRealEstateMediaJob(store, Number(req.params.id)), (m) => m.agentId,
);
const requireBusinessLockerSeller = () => requireRecordParty(
  'business locker', (req) => getBusinessLocker(store, Number(req.params.id)), (l) => l.sellerId,
);
const requireDedicatedLaneShipper = () => requireRecordParty(
  'dedicated lane', (req) => getDedicatedLane(store, Number(req.params.id)), (l) => [l.shipperId, l.carrierId],
);


// Real presentation/demo data -- only when the store is genuinely
// empty (a fresh boot, not a persisted store loaded from disk with
// real stations/jobs already in it), so restarting the server never
// double-seeds and real data is never clobbered.
const { seedDemoData } = require('./lib/seedDemoData');
if (store.stations.length === 0) {
  seedDemoData(store);
}

// Real, live cross-app call to HVNTZ's own real business lookup --
// the Affiliate Network's own real HVNTZ-onboarded verification (see
// externalIntegration.js's own header).
async function fetchHvntzBusiness(hvntzBusinessId) {
  const res = await fetch(`${HVNTZ_API_URL}/api/business/${hvntzBusinessId}`);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `fetchHvntzBusiness failed (${res.status})`);
  return body;
}

// Real, live cross-app call to HVNTZ's own new `GET /api/business/:id/locations`
// (added the same session as this fix) -- the real source of verified
// coordinates for an Affiliate Network registration that has no
// stationId of its own.
async function fetchHvntzBusinessLocations(hvntzBusinessId) {
  const res = await fetch(`${HVNTZ_API_URL}/api/business/${hvntzBusinessId}/locations`);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `fetchHvntzBusinessLocations failed (${res.status})`);
  return body.locations;
}

// Real, live cross-app call to VACA's own real identity layer -- a
// new, real VACA caller (VACA's own README flagged only 2 existed
// anywhere in the ecosystem). Deliberately non-blocking and additive:
// a customer sees a real "is this provider identity-verified" signal
// once matched, but an unverified provider can still be matched and
// complete real jobs -- VOID never required driver identity
// verification before, and this doesn't retroactively require it,
// matching the same additive posture Shield's own credential auth and
// CVNVO's own Yap signal used. Fails soft (`null`), same reasoning as
// CVNVO's `fetchYapSignal`: a missing verification signal shouldn't
// block a real match.
async function fetchProviderVerification(providerId) {
  try {
    const res = await fetch(`${VACA_API_URL}/api/identity-status/void-provider/${encodeURIComponent(providerId)}`);
    if (!res.ok) return null;
    const body = await res.json();
    return body.verified;
  } catch {
    return null;
  }
}

// Real, live VACA identity check for a Regulated Delivery Box
// recipient -- same real, generic `GET /api/identity-status/:subjectType/:subjectId`
// route as `fetchProviderVerification` above, a distinct
// `void-recipient` subjectType rather than reusing `void-provider`
// (a recipient and a driver are not the same real subject).
async function fetchRecipientVerification(recipientId) {
  try {
    const res = await fetch(`${VACA_API_URL}/api/identity-status/void-recipient/${encodeURIComponent(recipientId)}`);
    if (!res.ok) return false;
    const body = await res.json();
    return Boolean(body.verified);
  } catch {
    return false;
  }
}

// **`transferVCoin` is deliberately gone.** Every settling path in
// VOID now goes through `settleVCoin` below, and nothing called this
// any more. Leaving a working single-transfer helper next to them
// would be an invitation: the next money path gets written with two
// consecutive `await transferVCoin(...)` calls, which is exactly the
// shape that paid a provider without the platform fee and then paid
// them again on retry. `settleVCoin([oneLeg], meta)` covers the
// single-leg case with the same atomicity guarantee, so there is no
// job this removal makes harder.
//
// Same reasoning as `shieldAuth.cjs` removing `optionalOwnAccount`
// rather than deprecating it: a helper that is easy to reach for and
// wrong in a way nothing detects should not remain reachable.

// Atomic settlement: every leg moves, or none does.
//
// **Why the settling modules take this instead of `transferVCoin`.**
// They used to pay each party with a separate `await transferVCoin(...)`.
// The second call can fail on its own -- the first just debited the
// same payer -- and when it did, one party had been paid, the job's
// status was never advanced, and the retry guard (`'accepted'` for
// marketplace, `'confirmed'` for pet care) still passed. The retry paid
// that party a second time.
//
// `POST /api/vcoin/settle` validates every leg against running balances
// and writes nothing unless all of them pass, so the failure is
// all-or-nothing. Standing rule 5: hard on money.
async function settleVCoin(legs, meta = {}) {
  const res = await fetch(`${V3_API_URL}/api/vcoin/settle`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...serviceHeaders(),
      // The settlement's reason is a stable, unique description of the
      // job being settled, so it doubles as the idempotency key: a
      // retried settlement replays V3's first answer rather than paying
      // twice. Belt as well as braces -- atomicity prevents a *partial*
      // settlement, this prevents a *duplicate* one.
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

// Fail-soft, same posture as cvnvo/server.js's own fetchYapSignal --
// a real job payout is never held up by VACO Analytics being down.
async function pushMetric(metric, value) {
  try {
    await fetch(`${VACO_ANALYTICS_URL}/api/metrics/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...serviceHeaders(), },
      body: JSON.stringify({ app: 'void', metric, value }),
    });
  } catch {
    // real, honest no-op -- VACO Analytics is optional telemetry, not a dependency.
  }
}

app.get('/api/health', (_req, res) => {
  res.json({
    // The decision log's own state, so an `observe` window with real
    // gaps in it is visible from outside rather than only in a log.
    decisionLog: decisionLog.describe(),
    operatorAuth: operatorAuth.describe(),
    ok: true,
    stationTypes: STATION_TYPES,
    optimizationModes: OPTIMIZATION_MODES,
    jobStatuses: JOB_STATUSES,
    verticalCount: listVerticals().length,
    affiliateRoles: AFFILIATE_ROLES,
    defaultAcceptableWindowHours: DEFAULT_ACCEPTABLE_WINDOW_HOURS,
    driverTiers: DRIVER_TIERS,
    dspStartupCapitalRequired: DSP_STARTUP_CAPITAL_REQUIRED,
    orderTypes: ORDER_TYPES,
    vehicleTiers: VEHICLE_TIERS,
    realEstateServices: REAL_ESTATE_SERVICES,
    originationMethods: ORIGINATION_METHODS,
    lockerLocationTypes: LOCKER_LOCATION_TYPES,
    pmsOptions: PMS_OPTIONS,
    lockerToDoorStatuses: LOCKER_TO_DOOR_STATUSES,
  });
});

// -- VOID's own physical and airspace network ------------------------
//
// Stations, no-fly zones, drone routes, affiliate stations, DSPs,
// docking vehicles and launchpads are VOID's infrastructure. No user
// session owns any of it, and `requireActor` has nothing to check.
//
// The no-fly zone is the one to look at twice: `findNoFlyViolation`
// consults this list on every route build, so a caller who can *add*
// zones can ground the fleet, and one who can remove them can route a
// drone through restricted airspace. It is a safety register, not a
// setting.
app.post('/api/station', requireCallingService(), (req, res) => {
  try {
    res.status(201).json(registerStation(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/station/:id', (req, res) => {
  const station = getStation(store, Number(req.params.id));
  if (!station) return res.status(404).json({ error: `no station with id ${req.params.id}` });
  res.json(station);
});

app.get('/api/stations/:regionId', (req, res) => {
  res.json({ stations: getStationsByRegion(store, req.params.regionId) });
});

app.get('/api/network-density/:regionId', (req, res) => {
  try {
    const { maxRelayRangeKm } = req.query;
    res.json(computeNetworkDensity(store, req.params.regionId, {
      maxRelayRangeKm: maxRelayRangeKm !== undefined ? Number(maxRelayRangeKm) : undefined,
    }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/no-fly-zone', requireOperator('void:enforce'), async (req, res) => {
  try {
    await decisionLog.record({
      route: 'POST /api/no-fly-zone',
      outcomeKind: 'enforcement',
      subjectType: 'noFlyZone',
      subjectId: String((req.body||{}).name ?? ''),
      decidedBy: req.operator.operatorName,
      decidedByKind: 'operator',
      inputs: req.body || {},
      reason: (req.body || {}).reason || null,
    });
  } catch (err) {
    return res.status(503).json({ error: err.message });
  }

  try {
    res.status(201).json(registerNoFlyZone(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/no-fly-zones', (_req, res) => {
  res.json({ zones: getNoFlyZones(store) });
});

app.post('/api/drone-route', requireCallingService(), (req, res) => {
  try {
    res.status(201).json(buildRoute(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/drone-route/:id', (req, res) => {
  const route = getRoute(store, Number(req.params.id));
  if (!route) return res.status(404).json({ error: `no route with id ${req.params.id}` });
  res.json(route);
});

app.post('/api/drone-route/group', requireCallingService(), (req, res) => {
  try {
    res.status(201).json(groupOrdersIntoRoutes(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/verticals', (_req, res) => {
  res.json({ verticals: listVerticals() });
});

app.get('/api/vertical/:id', (req, res) => {
  const vertical = getVertical(req.params.id);
  if (!vertical) return res.status(404).json({ error: `no vertical with id ${req.params.id}` });
  res.json({ id: req.params.id, ...vertical });
});

// -- The job lifecycle: two parties, different rights ----------------
//
// A customer requests and cancels; a provider accepts and completes.
// Matching is VOID's dispatcher deciding who gets the work — a party
// who could match themselves onto a job would be picking their own
// assignments out of the pool.
app.post('/api/job', requireActor('customerId'), (req, res) => {
  try {
    res.status(201).json(requestJob(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/job/:id', (req, res) => {
  const job = getJob(store, Number(req.params.id));
  if (!job) return res.status(404).json({ error: `no job with id ${req.params.id}` });
  res.json(job);
});

app.post('/api/job/:id/match', requireCallingService(), async (req, res) => {
  try {
    const job = matchProvider(store, { ...req.body, jobId: Number(req.params.id) });
    // Real, cached-once VACA lookup (not re-fetched on every later
    // read) -- same posture as CHOPZ's own linkedProductVerified.
    job.providerVerified = await fetchProviderVerification(job.providerId);
    res.json(job);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/job/:id/accept', requireJobParty(), (req, res) => {
  try {
    res.json(acceptJob(store, Number(req.params.id)));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/job/:id/complete', requireJobParty(), async (req, res) => {
  try {
    const job = await completeJob(store, { jobId: Number(req.params.id), settleFn: settleVCoin });
    await pushMetric('job_platform_fee', job.platformFee);
    res.json(job);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/job/:id/rate', requireJobCustomer(), (req, res) => {
  try {
    res.json(rateJob(store, { ...req.body, jobId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/job/:id/report-failed', requireJobParty(), (req, res) => {
  try {
    res.json(reportFailedDelivery(store, { ...req.body, jobId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/job/:id/retry', requireJobParty(), (req, res) => {
  try {
    res.json(retryDelivery(store, { jobId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/job/:id/cancel', requireJobParty(), (req, res) => {
  try {
    res.json(cancelJob(store, Number(req.params.id)));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/jobs/vertical/:verticalId', (req, res) => {
  res.json({ jobs: getJobsForVertical(store, req.params.verticalId) });
});

app.get('/api/jobs/user/:userId', (req, res) => {
  const { role } = req.query;
  res.json({ jobs: getJobsForUser(store, req.params.userId, role) });
});

app.post('/api/trip-declaration', requireSession(), (req, res) => {
  try {
    res.status(201).json(declareTrip(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/trip-declaration/:tripId', (req, res) => {
  const declaration = getTripDeclaration(store, req.params.tripId);
  if (!declaration) return res.status(404).json({ error: `no trip declaration for ${req.params.tripId}` });
  res.json(declaration);
});

app.post('/api/vehicle-capacity-profile', requireCallingService(), (req, res) => {
  try {
    res.status(201).json(registerVehicleCapacityProfile(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/vehicle-capacity-profile/:vehicleId', (req, res) => {
  const profile = getVehicleCapacityProfile(store, req.params.vehicleId);
  if (!profile) return res.status(404).json({ error: `no vehicle capacity profile for ${req.params.vehicleId}` });
  res.json(profile);
});

app.get('/api/capacity-fit/:tripId', (req, res) => {
  try {
    res.json(checkCapacityFit(store, req.params.tripId));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/cargo-pricing/:tripId', (req, res) => {
  try {
    const declaration = getTripDeclaration(store, req.params.tripId);
    if (!declaration) return res.status(404).json({ error: `no trip declaration for ${req.params.tripId}` });
    res.json(computeDynamicCargoPricing(declaration));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/sequencing', requireSession(), (req, res) => {
  try {
    const { stops, isDedicatedDeliveryRoute } = req.body || {};
    res.json({ sequenced: computeSequencing(stops, { isDedicatedDeliveryRoute }) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/reserve-booking', requireActor('riderId'), (req, res) => {
  try {
    res.status(201).json(createReserveBooking(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/reserve-booking/:id', (req, res) => {
  const booking = getReserveBooking(store, Number(req.params.id));
  if (!booking) return res.status(404).json({ error: `no reserve booking with id ${req.params.id}` });
  res.json(booking);
});

app.post('/api/reserve-booking/:id/match', requireCallingService(), (req, res) => {
  try {
    res.json(matchReserveDriver(store, { ...req.body, bookingId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/reserve-booking/:id/cancel', requireReserveBookingRider(), (req, res) => {
  try {
    res.json(cancelReserveBooking(store, { bookingId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/commute-batch', requireCallingService(), (req, res) => {
  try {
    res.status(201).json(openCommuteBatch(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/commute-batch/:id', (req, res) => {
  const batch = getCommuteBatch(store, Number(req.params.id));
  if (!batch) return res.status(404).json({ error: `no commute batch with id ${req.params.id}` });
  res.json(batch);
});

app.post('/api/commute-batch/:id/request', requireActor('riderId'), (req, res) => {
  try {
    res.status(201).json(submitCommuteRequest(store, { ...req.body, batchId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/commute-batch/:id/match', requireCallingService(), (req, res) => {
  try {
    res.json(runBatchMatch(store, { batchId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/dedicated-lane', requireActor('shipperId'), (req, res) => {
  try {
    res.status(201).json(createDedicatedLane(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/dedicated-lane/:id', (req, res) => {
  const lane = getDedicatedLane(store, Number(req.params.id));
  if (!lane) return res.status(404).json({ error: `no dedicated lane with id ${req.params.id}` });
  res.json(lane);
});

app.post('/api/dedicated-lane/:id/claim', requireActor('carrierId'), (req, res) => {
  try {
    res.json(claimDedicatedLane(store, { ...req.body, laneId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/dedicated-lane/:id/release', requireDedicatedLaneShipper(), (req, res) => {
  try {
    res.json(releaseDedicatedLane(store, Number(req.params.id)));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/spot-load', requireActor('shipperId'), (req, res) => {
  try {
    res.status(201).json(postSpotLoad(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/spot-load/:id', (req, res) => {
  const load = getSpotLoad(store, Number(req.params.id));
  if (!load) return res.status(404).json({ error: `no spot load with id ${req.params.id}` });
  res.json(load);
});

app.post('/api/spot-load/:id/book', requireActor('carrierId'), (req, res) => {
  try {
    res.json(bookSpotLoad(store, { ...req.body, loadId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/hourly-booking', requireActor('riderId'), (req, res) => {
  try {
    res.status(201).json(createHourlyBooking(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/hourly-booking/:id', (req, res) => {
  const booking = getHourlyBooking(store, Number(req.params.id));
  if (!booking) return res.status(404).json({ error: `no hourly booking with id ${req.params.id}` });
  res.json(booking);
});

app.post('/api/hourly-booking/:id/stop', requireHourlyBookingParty(), (req, res) => {
  try {
    res.status(201).json(addHourlyStop(store, { ...req.body, bookingId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/hourly-booking/:id/charge', (req, res) => {
  try {
    const { actualHours, actualMiles } = req.query;
    res.json(computeHourlyCharge(store, {
      bookingId: Number(req.params.id),
      actualHours: actualHours !== undefined ? Number(actualHours) : undefined,
      actualMiles: actualMiles !== undefined ? Number(actualMiles) : undefined,
    }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Dispatch intelligence: these compute a recommendation from the
// request body and return it. They read no record and write none, so
// there is nothing per-user to check — the app-level credential is the
// whole check that applies.
app.post('/api/dispatch/air-vs-ground', requireSession(), (req, res) => {
  try {
    res.json(decideAirVsGround(req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/dispatch/load-intelligence', requireSession(), (req, res) => {
  try {
    res.json(computeLoadIntelligenceScore(req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/dispatch/dead-time-recommendation', requireSession(), (req, res) => {
  try {
    res.json(recommendDeadTimeOpportunity(req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/relay-path', (req, res) => {
  try {
    const { regionId, originStationId, destinationStationId, maxDroneLegRangeKm } = req.query;
    res.json(findRelayPath(store, {
      regionId,
      originStationId: originStationId !== undefined ? Number(originStationId) : undefined,
      destinationStationId: destinationStationId !== undefined ? Number(destinationStationId) : undefined,
      maxDroneLegRangeKm: maxDroneLegRangeKm !== undefined ? Number(maxDroneLegRangeKm) : undefined,
    }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/external-business', requireCallingService(), (req, res) => {
  try {
    res.status(201).json(registerExternalBusiness(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Authenticated by its own `apiKey`, which `getExternalBusinessByApiKey`
// checks — a second, separate credential mechanism for outside
// businesses. The service credential is the outer envelope; the apiKey
// still identifies which business the manifest belongs to.
app.post('/api/void-direct/manifest', requireCallingService(), (req, res) => {
  try {
    res.status(201).json(submitDeliveryManifest(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/void-direct/manifest/:id', (req, res) => {
  try {
    res.json(getManifestStatus(store, Number(req.params.id)));
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

app.post('/api/affiliate-station', requireCallingService(), async (req, res) => {
  try {
    res.status(201).json(await registerAffiliateStation(store, {
      ...req.body, hvntzFetchFn: fetchHvntzBusiness, hvntzLocationFetchFn: fetchHvntzBusinessLocations,
    }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/affiliate-stations', (req, res) => {
  const { role } = req.query;
  res.json({ affiliates: listAffiliateStations(store, { role }) });
});

app.post('/api/gig-driver', requireActor('driverId'), (req, res) => {
  try {
    res.status(201).json(registerGigDriver(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/gig-driver/:driverId', (req, res) => {
  const driver = getGigDriver(store, req.params.driverId);
  if (!driver) return res.status(404).json({ error: `no gig driver with id ${req.params.driverId}` });
  res.json(driver);
});

app.post('/api/void-dsp', requireCallingService(), (req, res) => {
  try {
    res.status(201).json(registerVoidDSP(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/void-dsp/:id', (req, res) => {
  const dsp = getVoidDSP(store, Number(req.params.id));
  if (!dsp) return res.status(404).json({ error: `no VOID DSP with id ${req.params.id}` });
  res.json(dsp);
});

app.post('/api/void-dsp/:id/driver', requireCallingService(), (req, res) => {
  try {
    res.status(201).json(addDriverToDSP(store, { ...req.body, dspId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/void-dsp/:id/vehicle', requireCallingService(), (req, res) => {
  try {
    res.status(201).json(addVehicleToDSP(store, { ...req.body, dspId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/void-dsp/:id/route', requireCallingService(), (req, res) => {
  try {
    res.status(201).json(assignRouteToDSP(store, { ...req.body, dspId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/dispatch/delivery-priority/:orderType', (req, res) => {
  try {
    res.json(getDeliveryPriority(req.params.orderType));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/dispatch/acceptance-delay', requireSession(), (req, res) => {
  try {
    res.json(computeAcceptanceDelay(req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/kitchen-stream', requireCallingService(), (req, res) => {
  try {
    res.status(201).json(registerKitchenStream(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/kitchen-stream/:businessId', (req, res) => {
  res.json(getKitchenTrustStatus(store, req.params.businessId));
});

app.post('/api/moving-job', requireActor('customerId'), (req, res) => {
  try {
    res.status(201).json(createMovingJob(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/moving-job/:id', (req, res) => {
  const job = getMovingJob(store, Number(req.params.id));
  if (!job) return res.status(404).json({ error: `no moving job with id ${req.params.id}` });
  res.json(job);
});

app.post('/api/moving-job/:id/driver', requireCallingService(), (req, res) => {
  try {
    res.json(assignMovingDriver(store, { ...req.body, movingJobId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/moving-job/:id/helper', requireCallingService(), (req, res) => {
  try {
    res.json(addMovingHelper(store, { ...req.body, movingJobId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/real-estate-media-job', requireActor('agentId'), (req, res) => {
  try {
    res.status(201).json(createRealEstateMediaJob(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/real-estate-media-job/:id', (req, res) => {
  const job = getRealEstateMediaJob(store, Number(req.params.id));
  if (!job) return res.status(404).json({ error: `no real estate media job with id ${req.params.id}` });
  res.json(job);
});

app.post('/api/real-estate-media-job/:id/assign', requireCallingService(), (req, res) => {
  try {
    res.json(assignNearestProvider(store, { ...req.body, mediaJobId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/hub-shipment', requireActor('customerId'), (req, res) => {
  try {
    res.status(201).json(originateShipmentAtHub(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/hub-shipment/:id', (req, res) => {
  const shipment = getHubOriginatedShipment(store, Number(req.params.id));
  if (!shipment) return res.status(404).json({ error: `no hub shipment with id ${req.params.id}` });
  res.json(shipment);
});

app.post('/api/hub-shipment/:id/fulfillment-decision', requireCallingService(), (req, res) => {
  try {
    res.json(decideFulfillmentForShipment(store, { ...req.body, shipmentId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/locker', requireCallingService(), (req, res) => {
  try {
    res.status(201).json(registerLocker(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/locker/:id', (req, res) => {
  const locker = getLocker(store, Number(req.params.id));
  if (!locker) return res.status(404).json({ error: `no locker with id ${req.params.id}` });
  res.json(locker);
});

app.post('/api/locker/:id/deposit', requireCallingService(), (req, res) => {
  try {
    res.status(201).json(depositPackage(store, { ...req.body, lockerId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/locker/:id/retrieve', requireActor('recipientId'), (req, res) => {
  try {
    res.json(retrievePackage(store, { ...req.body, lockerId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/locker-to-door', requireActor('customerId'), (req, res) => {
  try {
    res.status(201).json(requestLockerToDoor(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/locker-to-door/:id', (req, res) => {
  const request = getLockerToDoorRequest(store, Number(req.params.id));
  if (!request) return res.status(404).json({ error: `no locker-to-door request with id ${req.params.id}` });
  res.json(request);
});

app.post('/api/locker-to-door/:id/assign', requireCallingService(), (req, res) => {
  try {
    res.json(assignDriverToLockerRequest(store, { ...req.body, requestId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/locker-to-door/:id/retrieve', requireActor('driverId'), (req, res) => {
  try {
    res.json(retrieveWithDriverAccess(store, { ...req.body, requestId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/locker-to-door/:id/complete', requireLockerToDoorCustomer(), (req, res) => {
  try {
    res.json(completeLockerToDoorDelivery(store, Number(req.params.id)));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// -- Phase 18: Multi-Midpoint Delivery Choice & Forward Inventory,
// plus the Quick Innovation Thread (Regulated Boxes, VOID Staffing +
// HUNT Staffing, Mobile Drone Docking Vehicles, Dual Mobility
// Coordination, Launchpad Drivers, TaaS). See
// dev-docs/phase-18-multi-midpoint-and-quick-innovations/.

app.get('/api/delivery-methods/quote', (req, res) => {
  try {
    const { originLat, originLng, destinationLat, destinationLng } = req.query;
    res.json({
      methods: quoteDeliveryMethods({
        originLat: Number(originLat), originLng: Number(originLng),
        destinationLat: Number(destinationLat), destinationLng: Number(destinationLng),
      }),
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/delivery-methods/pickup-quote', (req, res) => {
  try {
    const { stationId, affiliateStationId } = req.query;
    res.json(quotePickupOption({
      stationId: stationId !== undefined ? Number(stationId) : null,
      affiliateStationId: affiliateStationId !== undefined ? Number(affiliateStationId) : null,
    }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/delivery-methods/select', requireSession(), (req, res) => {
  try {
    res.status(201).json(selectDeliveryMethod(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/delivery-methods/job/:jobId', (req, res) => {
  const selection = getDeliveryMethodSelection(store, Number(req.params.jobId));
  if (!selection) return res.status(404).json({ error: `no delivery method selection for job ${req.params.jobId}` });
  res.json(selection);
});

app.post('/api/business-locker', requireActor('sellerId'), (req, res) => {
  try {
    res.status(201).json(registerBusinessLocker(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/business-locker/:id', (req, res) => {
  const locker = getBusinessLocker(store, Number(req.params.id));
  if (!locker) return res.status(404).json({ error: `no business locker with id ${req.params.id}` });
  res.json(locker);
});

app.get('/api/business-lockers/seller/:sellerId', (req, res) => {
  res.json({ lockers: getBusinessLockersForSeller(store, req.params.sellerId) });
});

app.post('/api/seller-inventory-placement', requireActor('sellerId'), (req, res) => {
  try {
    res.status(201).json(placeSellerInventory(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/business-locker/:id/load-drone', requireCallingService(), (req, res) => {
  try {
    res.status(201).json(loadDroneFromLocker(store, { ...req.body, businessLockerId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/business-locker/:id/loading-events', (req, res) => {
  res.json({ events: getDroneLoadingEventsForLocker(store, Number(req.params.id)) });
});

// Regulated delivery boxes exist for exactly the categories the
// licensing gates cover, and the custody chain is the evidence that a
// regulated item stayed accounted for. A chain anyone can write an
// entry into is not evidence — the same reasoning as `verifiedBy`.
app.post('/api/regulated-box', requireOperator('void:vetting'), async (req, res) => {
  try {
    await decisionLog.record({
      route: 'POST /api/regulated-box',
      outcomeKind: 'credential',
      subjectType: 'regulatedBox',
      subjectId: String((req.body||{}).standardStationId ?? ''),
      decidedBy: req.operator.operatorName,
      decidedByKind: 'operator',
      inputs: req.body || {},
      reason: (req.body || {}).reason || null,
    });
  } catch (err) {
    return res.status(503).json({ error: err.message });
  }

  try {
    res.status(201).json(registerRegulatedBox(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/regulated-box/:id', (req, res) => {
  const box = getRegulatedBox(store, Number(req.params.id));
  if (!box) return res.status(404).json({ error: `no regulated box with id ${req.params.id}` });
  res.json(box);
});

app.post('/api/regulated-box/:id/custody-event', requireOperator('void:vetting'), async (req, res) => {
  try {
    await decisionLog.record({
      route: 'POST /api/regulated-box/:id/custody-event',
      outcomeKind: 'credential',
      subjectType: 'regulatedBox',
      subjectId: req.params.id,
      decidedBy: req.operator.operatorName,
      decidedByKind: 'operator',
      inputs: req.body || {},
      reason: (req.body || {}).reason || null,
    });
  } catch (err) {
    return res.status(503).json({ error: err.message });
  }

  try {
    res.status(201).json(logCustodyEvent(store, { ...req.body, boxId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/regulated-box/:id/verify-recipient', requireOperator('void:vetting'), async (req, res) => {
  try {
    await decisionLog.record({
      route: 'POST /api/regulated-box/:id/verify-recipient',
      outcomeKind: 'credential',
      subjectType: 'regulatedBox',
      subjectId: req.params.id,
      decidedBy: req.operator.operatorName,
      decidedByKind: 'operator',
      inputs: req.body || {},
      reason: (req.body || {}).reason || null,
    });
  } catch (err) {
    return res.status(503).json({ error: err.message });
  }

  try {
    const verified = await verifyRecipientIdentity(store, {
      ...req.body, boxId: Number(req.params.id), vacaFetchFn: fetchRecipientVerification,
    });
    res.json({ verified });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/staffing-position', requireSession(), (req, res) => {
  try {
    res.status(201).json(postStaffingPosition(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/staffing-position/:id', (req, res) => {
  const position = getStaffingPosition(store, Number(req.params.id));
  if (!position) return res.status(404).json({ error: `no staffing position with id ${req.params.id}` });
  res.json(position);
});

app.get('/api/staffing-positions/business/:businessId', (req, res) => {
  res.json({ positions: getStaffingPositionsForBusiness(store, req.params.businessId) });
});

app.post('/api/hunt-staffing', requireCallingService(), async (req, res) => {
  try {
    res.status(201).json(await requestHuntStaffing(store, { ...req.body, hvntzFetchFn: fetchHvntzBusiness }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/hunt-staffing/:id', (req, res) => {
  const request = getHuntStaffingRequest(store, Number(req.params.id));
  if (!request) return res.status(404).json({ error: `no hunt staffing request with id ${req.params.id}` });
  res.json(request);
});

app.post('/api/mobile-docking-vehicle', requireCallingService(), (req, res) => {
  try {
    res.status(201).json(registerMobileDockingVehicle(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/mobile-docking-vehicle/:id', (req, res) => {
  const vehicle = getMobileDockingVehicle(store, Number(req.params.id));
  if (!vehicle) return res.status(404).json({ error: `no mobile docking vehicle with id ${req.params.id}` });
  res.json(vehicle);
});

app.post('/api/mobile-docking-vehicle/:id/location', requireCallingService(), (req, res) => {
  try {
    res.json(updateVehicleLocation(store, { ...req.body, vehicleId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/mobile-docking-vehicle/:id/dock', requireCallingService(), (req, res) => {
  try {
    res.json(dockDrone(store, { ...req.body, vehicleId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/mobile-docking-vehicle/:id/launch', requireCallingService(), (req, res) => {
  try {
    res.json(launchDrone(store, { ...req.body, vehicleId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/dual-mobility-coordination', requireSession(), (req, res) => {
  try {
    res.status(201).json(computeDualMobilityCoordination(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/launchpad-driver', requireCallingService(), (req, res) => {
  try {
    res.status(201).json(registerLaunchpadDriver(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/launchpad-driver/:id', (req, res) => {
  const driver = getLaunchpadDriver(store, Number(req.params.id));
  if (!driver) return res.status(404).json({ error: `no launchpad driver with id ${req.params.id}` });
  res.json(driver);
});

app.post('/api/taas-subscription', requireCallingService(), (req, res) => {
  try {
    res.status(201).json(registerTaasSubscription(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/taas-subscription/:id', (req, res) => {
  const subscription = getTaasSubscription(store, Number(req.params.id));
  if (!subscription) return res.status(404).json({ error: `no TaaS subscription with id ${req.params.id}` });
  res.json(subscription);
});

app.get('/api/taas-subscriptions/client/:clientBusinessId', (req, res) => {
  res.json({ subscriptions: getTaasSubscriptionsForClient(store, req.params.clientBusinessId) });
});

// -- Real background-job-runner behavior (closes the previously
// self-flagged "no background-job runner for automatic retries" gap)
// -- exposed as a real, directly callable route too (not just the
// interval below), so it's genuinely testable without waiting out a
// real 24-hour window or faking the server's own clock.
// A scheduled sweep across everybody's failed deliveries. There is no
// user whose session could authorise it — the same shape as VSAFE's
// missed-check-in sweep.
app.post('/api/jobs/sweep-failed-deliveries', requireCallingService(), (_req, res) => {
  res.json(sweepFailedDeliveries(store));
});

const RETRY_SWEEP_INTERVAL_MS = 15 * 60 * 1000; // real 15-minute check cadence
setInterval(() => {
  const result = sweepFailedDeliveries(store);
  if (result.retried.length > 0 || result.errors.length > 0) {
    console.log(`[retry-sweep] retried ${result.retried.length} job(s): ${result.retried.join(', ') || 'none'}${result.errors.length ? `; ${result.errors.length} error(s)` : ''}`);
  }
}, RETRY_SWEEP_INTERVAL_MS).unref();

// -- Provider profiles: the spine of every service app ----------------
// Individuals and businesses register once, declare skills across
// verticals, and set availability. See lib/providerProfiles.js.

const providerProfiles = require('./lib/providerProfiles');
const serviceCommon = require('./lib/serviceCommon');
const serviceDay = require('./lib/serviceDay');
const petCare = require('./lib/petCare');
const laundry = require('./lib/laundry');

// Every service route funnels through here. It has to handle async
// handlers as well as sync ones: settlement made `completeBooking` and
// `markDelivered` async, and the old synchronous version serialised the
// returned Promise — which JSON-stringifies to `{}`. Worse than the
// empty body, a rejection escaped as an unhandled rejection instead of
// becoming a 400, so a failed settlement would have looked like a
// success to the caller.
//
// `Promise.resolve().then(fn)` covers both shapes: a sync handler
// resolves immediately, a sync throw is caught by the same `.catch`.
// == Authorization ======================================================
//
// **This pass was done against the licensing gates, not around them**,
// because reading it the other way round produced a live exploit.
//
// VOID holds two `licensingGated: true` verticals — `cannabisDelivery`
// and `medicalTransportation` — and enforces them in two places:
//
//   `requestJob`        refuses a gated vertical outright
//   `canWorkVertical`   requires a *verified* skill and
//                       `credential-verified` vetting, not a claimed one
//
// The second is the one that matters long-term: `requestJob`'s blanket
// refusal is explicitly temporary ("not launch-ready without real
// licensing in place"), and `canWorkVertical` is documented as "exactly
// one place where 'may this provider work this job' is decided".
//
// **It could be defeated in four unauthenticated requests.** Verified
// against a running instance before this change:
//
//   POST /api/provider                              -> 201
//   POST /api/provider/:id/skill  {cannabisDelivery} -> claimed
//   POST /api/provider/:id/skill/cannabisDelivery/verify -> VERIFIED
//   POST /api/provider/:id/vetting
//        {level: 'credential-verified',
//         verifiedBy: 'me, obviously',
//         referenceId: 'TOTALLY-REAL-LICENCE'}      -> 201
//
//   GET  /api/provider/:id/capabilities
//        -> workable: [{ verticalId: 'cannabisDelivery', ... }]
//
// A stranger, from nothing, made VOID's own matcher say they may
// deliver cannabis — on a self-verified skill and a self-sighted
// licence. The only thing standing between that and a real dispatch was
// `requestJob`'s temporary blanket refusal, which is a belt-and-braces
// accident rather than the design.
//
// `recordVetting` already insists on `verifiedBy` because "a result
// nobody can be traced back to is not evidence" — and it was accepting
// `verifiedBy: 'me, obviously'` from an anonymous caller. The field was
// doing exactly what its comment promised and proving nothing.
//
// **So the rule for this app: a credential is never self-service.**
// Claiming a skill is self-service (it is an assertion). Verifying one,
// recording vetting against it, and suspending it are decisions *about*
// a provider, made by VOID, and they take `requireCallingService()`.
// A logged-in user is explicitly not sufficient — that is the fourth
// guard shape from the sweep, and here the outcome it decides is legal.

function handle(res, fn, successStatus = 200) {
  return Promise.resolve()
    .then(fn)
    .then((body) => res.status(successStatus).json(body))
    .catch((err) => res.status(400).json({ error: err.message }));
}

// Registering and claiming a skill ARE self-service — a claim is an
// assertion, and `canWorkVertical` treats it as one. What must not be
// self-service is anything that turns a claim into a credential.
app.post('/api/provider', requireActor('providerId'), (req, res) => handle(res,
  () => providerProfiles.registerProvider(store, req.body || {}), 201));

app.get('/api/provider/:id', (req, res) => {
  const profile = providerProfiles.getProvider(store, req.params.id);
  if (!profile) return res.status(404).json({ error: `no provider "${req.params.id}"` });
  return res.json(profile);
});

app.get('/api/provider/:id/capabilities', (req, res) => handle(res,
  () => providerProfiles.describeProviderCapabilities(store, req.params.id)));

// Recording vetting. The vetting gate is real and refuses unvetted
// providers on the verticals where it matters — but there was no route
// to record vetting at all, so those verticals were unreachable over
// HTTP rather than merely gated. This is the missing half of a gate
// that was otherwise correct.
// **A credential is never self-service.** This is the route that made
// the cannabisDelivery gate defeatable — see the block above. It
// records that somebody sighted a licence or ran a background check,
// and `recordVetting` already refuses a result with no `verifiedBy`
// because "a result nobody can be traced back to is not evidence". It
// was accepting `verifiedBy: 'me, obviously'` from an anonymous caller.
app.post('/api/provider/:id/vetting', requireOperator('void:vetting'), async (req, res) => {
  try {
    await decisionLog.record({
      route: 'POST /api/provider/:id/vetting',
      outcomeKind: 'credential',
      subjectType: 'provider',
      subjectId: req.params.id,
      decidedBy: req.operator.operatorName,
      decidedByKind: 'operator',
      inputs: req.body || {},
      reason: (req.body || {}).reason || null,
    });
  } catch (err) {
    return res.status(503).json({ error: err.message });
  }
  return handle(res,
    () => serviceCommon.recordVetting(store, { ...req.body, providerId: req.params.id }), 201);
});

app.post('/api/provider/:id/skill', requireParamActor('id'), (req, res) => handle(res,
  () => providerProfiles.addSkill(store, { ...req.body, providerId: req.params.id }), 201));

// The other half of the same exploit: claimed -> verified is the exact
// distinction `canWorkVertical` relies on for a licensing-gated
// vertical ("requires a *verified* skill, not a claimed one"). A
// provider who can call this has erased the distinction.
// Verifying a provider's skill. **Two paths, and which one you get is
// decided by the vertical, not by the caller.**
//
// For an ordinary vertical this verifies immediately: one operator
// holding `void:vetting`, same as every other group-2 route.
//
// For `cannabisDelivery` and `medicalTransportation` -- the two
// licensing-gated verticals -- this records a *proposal* and returns
// 202. Nothing is verified until a different operator holding
// `void:vetting:approve` approves it below. Those two are the only
// places in this ecosystem where a wrong call has consequences outside
// it: a regulator, a licence, a vulnerable passenger. See
// dev-docs/OPERATOR_ROLES_SCOPE.md §3.4 for why the rule stops there
// and does not extend to settling a game.
//
// The 202 is deliberate and is not an error: the request was accepted
// and is incomplete, which is exactly what a pending proposal is.
app.post('/api/provider/:id/skill/:verticalId/verify', requireOperator('void:vetting'), async (req, res) => {
  const twoPersonRequired = (() => {
    try { return twoPerson.requiresTwoPersons(req.params.verticalId); } catch { return false; }
  })();

  try {
    await decisionLog.record({
      route: 'POST /api/provider/:id/skill/:verticalId/verify',
      // A proposal is a step toward a credential, not a credential.
      // Recording it as one would make the log claim the vertical was
      // opened when it was not.
      outcomeKind: twoPersonRequired ? 'state-change' : 'credential',
      subjectType: 'providerSkill',
      subjectId: `${req.params.id}:${req.params.verticalId}`,
      decidedBy: req.operator.operatorName,
      decidedByKind: 'operator',
      inputs: { ...(req.body || {}), twoPersonRequired },
      reason: (req.body || {}).reason || null,
    });
  } catch (err) {
    return res.status(503).json({ error: err.message });
  }

  if (!twoPersonRequired) {
    return handle(res,
      () => providerProfiles.verifySkill(store, { providerId: req.params.id, verticalId: req.params.verticalId }));
  }

  try {
    const proposal = twoPerson.proposeSkillVerification(store, {
      providerId: req.params.id,
      verticalId: req.params.verticalId,
      proposedBy: req.operator.operatorName,
      evidence: (req.body || {}).evidence || {},
    });
    return res.status(202).json({
      status: 'awaiting-second-operator',
      message: `${req.params.verticalId} is licensing-gated: a different operator holding `
        + 'void:vetting:approve must approve this before the skill is verified',
      proposal,
    });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// The second signature. A different operator, a different scope, and
// the skill is verified only here -- proposing must never open the
// vertical, or the second signature is decoration.
app.post('/api/provider/:id/skill/:verticalId/approve', requireOperator('void:vetting:approve'), async (req, res) => {
  const proposalId = Number((req.body || {}).proposalId);
  const existing = twoPerson.getProposal(store, proposalId);
  if (!existing) return res.status(404).json({ error: `no proposal with id ${proposalId}` });

  try {
    await decisionLog.record({
      route: 'POST /api/provider/:id/skill/:verticalId/approve',
      outcomeKind: 'credential',
      subjectType: 'providerSkill',
      subjectId: `${req.params.id}:${req.params.verticalId}`,
      decidedBy: req.operator.operatorName,
      decidedByKind: 'operator',
      // The pair is the point: this row names the approver, and
      // `proposedBy` names who they are counter-signing.
      inputs: { proposalId, proposedBy: existing.proposedBy },
      reason: (req.body || {}).reason || null,
    });
  } catch (err) {
    return res.status(503).json({ error: err.message });
  }

  try {
    const proposal = twoPerson.approveSkillVerification(store, {
      proposalId, approvedBy: req.operator.operatorName,
    });
    const skill = providerProfiles.verifySkill(store, {
      providerId: proposal.providerId, verticalId: proposal.verticalId,
    });
    return res.json({ proposal, skill });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// Withdrawing a proposal that should not proceed. `void:vetting` rather
// than the approve scope: stopping something concentrates no authority,
// and requiring a second person to withdraw would leave bad proposals
// open waiting for a quorum.
app.post('/api/provider/:id/skill/:verticalId/withdraw', requireOperator('void:vetting'), (req, res) => {
  try {
    return res.json(twoPerson.withdrawSkillVerification(store, {
      proposalId: Number((req.body || {}).proposalId),
      withdrawnBy: req.operator.operatorName,
      reason: (req.body || {}).reason || null,
    }));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// The queue: what is waiting on a second operator right now.
app.get('/api/skill-verification-proposals', (_req, res) => {
  res.json({ pending: twoPerson.listPendingProposals(store) });
});

// Suspension is an enforcement action against a provider. Self-service
// in either direction is wrong: a provider must not lift their own
// suspension, and a rival must not be able to impose one.
app.post('/api/provider/:id/skill/:verticalId/suspend', requireOperator('void:enforce'), async (req, res) => {
  try {
    await decisionLog.record({
      route: 'POST /api/provider/:id/skill/:verticalId/suspend',
      outcomeKind: 'enforcement',
      subjectType: 'providerSkill',
      subjectId: `${req.params.id}:${req.params.verticalId}`,
      decidedBy: req.operator.operatorName,
      decidedByKind: 'operator',
      inputs: req.body || {},
      reason: (req.body || {}).reason || null,
    });
  } catch (err) {
    return res.status(503).json({ error: err.message });
  }
  return handle(res,
    () => providerProfiles.suspendSkill(store, { ...req.body, providerId: req.params.id, verticalId: req.params.verticalId }));
});

app.post('/api/provider/:id/availability', requireParamActor('id'), (req, res) => handle(res,
  () => providerProfiles.addAvailability(store, { ...req.body, providerId: req.params.id }), 201));

app.get('/api/vertical/:verticalId/providers', (req, res) => handle(res,
  () => providerProfiles.listProvidersForVertical(store, req.params.verticalId)));

// -- The service day: one provider, several verticals, one schedule ---

app.post('/api/provider/:id/service-day', requireParamActor('id'), (req, res) => handle(res,
  () => serviceDay.buildServiceDay(store, { ...req.body, providerId: req.params.id })));

app.post('/api/provider/:id/skill-suggestions', requireParamActor('id'), (req, res) => handle(res,
  () => serviceDay.suggestSkillsToAdd(store, { ...req.body, providerId: req.params.id })));

// -- Pet Care ---------------------------------------------------------

app.post('/api/petcare/pet', requireActor('ownerId'), (req, res) => handle(res,
  () => petCare.registerPet(store, req.body || {}), 201));

app.get('/api/petcare/owner/:ownerId/pets', (req, res) => handle(res,
  () => petCare.listPetsForOwner(store, req.params.ownerId)));

app.get('/api/petcare/owner/:ownerId/preferred-providers', (req, res) => handle(res,
  () => petCare.preferredProviders(store, req.params.ownerId)));

app.post('/api/petcare/booking', requireActor('ownerId'), (req, res) => handle(res,
  () => petCare.createBooking(store, req.body || {}), 201));

app.post('/api/petcare/booking/:id/confirm', requirePetBookingParty(), (req, res) => handle(res,
  () => petCare.confirmBooking(store, { bookingId: Number(req.params.id) })));

app.post('/api/petcare/booking/:id/complete', requirePetBookingParty(), (req, res) => handle(res,
  () => petCare.completeBooking(store, {
    ...req.body, bookingId: Number(req.params.id), settleFn: settleVCoin,
  })));

app.post('/api/petcare/booking/:id/cancel', requirePetBookingParty(), (req, res) => handle(res,
  () => petCare.cancelBooking(store, { ...req.body, bookingId: Number(req.params.id) })));

app.post('/api/petcare/recurring', requireActor('ownerId'), (req, res) => handle(res,
  () => petCare.createRecurringBookings(store, req.body || {}), 201));

// -- Laundry ----------------------------------------------------------

// The over-cap approval is the one that matters here: `recordWeight`
// can push an order past its quoted cap, and approving that is the
// customer accepting a higher bill. The provider who weighed it must
// not be able to approve it on the customer's behalf.
app.post('/api/laundry/order', requireActor('customerId'), (req, res) => handle(res,
  () => laundry.scheduleOrder(store, req.body || {}), 201));

app.get('/api/laundry/order/:id', (req, res) => {
  const order = laundry.getOrder(store, Number(req.params.id));
  if (!order) return res.status(404).json({ error: `no laundry order ${req.params.id}` });
  return res.json(order);
});

app.post('/api/laundry/order/:id/pickup', requireLaundryOrderParty(), (req, res) => handle(res,
  () => laundry.markPickedUp(store, { orderId: Number(req.params.id) })));

app.post('/api/laundry/order/:id/weigh', requireLaundryOrderParty(), (req, res) => handle(res,
  () => laundry.recordWeight(store, { ...req.body, orderId: Number(req.params.id) })));

app.post('/api/laundry/order/:id/approve-over-cap', requireLaundryOrderCustomer(), (req, res) => handle(res,
  () => laundry.approveOverCap(store, { orderId: Number(req.params.id) })));

app.post('/api/laundry/order/:id/start', requireLaundryOrderParty(), (req, res) => handle(res,
  () => laundry.startProcessing(store, { orderId: Number(req.params.id) })));

app.post('/api/laundry/order/:id/ready', requireLaundryOrderParty(), (req, res) => handle(res,
  () => laundry.markReady(store, { ...req.body, orderId: Number(req.params.id) })));

app.post('/api/laundry/order/:id/deliver', requireLaundryOrderParty(), (req, res) => handle(res,
  () => laundry.markDelivered(store, {
    ...req.body, orderId: Number(req.params.id), settleFn: settleVCoin,
  })));


// -- The service engine: every vertical, one interface ----------------
// Each of the 25 verticals is a service app. petCare and laundry also
// have dedicated modules with extra domain depth; these routes work
// for all 25 uniformly. See lib/serviceEngine.js.

const serviceEngine = require('./lib/serviceEngine');

app.get('/api/service/:verticalId', (req, res) => handle(res,
  () => serviceEngine.describeService(store, req.params.verticalId)));

app.get('/api/services', (req, res) => handle(res,
  () => Object.keys(store.serviceConfigs).map((v) => serviceEngine.describeService(store, v))));

app.post('/api/service/subject', requireActor('ownerId'), (req, res) => handle(res,
  () => serviceEngine.registerSubject(store, req.body || {}), 201));

app.get('/api/service/owner/:ownerId/subjects', (req, res) => handle(res,
  () => serviceEngine.listSubjectsForOwner(store, req.params.ownerId, req.query.verticalId || null)));

app.post('/api/service/booking', requireActor('customerId'), (req, res) => handle(res,
  () => serviceEngine.createServiceBooking(store, req.body || {}), 201));

app.get('/api/service/booking/:id', (req, res) => {
  const booking = serviceEngine.getServiceBooking(store, Number(req.params.id));
  if (!booking) return res.status(404).json({ error: `no service booking ${req.params.id}` });
  return res.json(booking);
});

// Settlement happens inside advanceBooking at the archetype's own
// completion state, so this route is async and passes the same
// transferVCoin the marketplace loop uses.
app.post('/api/service/booking/:id/advance', requireServiceBookingParty(), async (req, res) => {
  try {
    res.json(await serviceEngine.advanceBooking(store, {
      ...req.body,
      bookingId: Number(req.params.id),
      settleFn: settleVCoin,
    }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/service/booking/:id/approve-over-cap', requireServiceBookingCustomer(), (req, res) => handle(res,
  () => serviceEngine.approveOverCap(store, { bookingId: Number(req.params.id) })));

app.post('/api/service/booking/:id/cancel', requireServiceBookingParty(), (req, res) => handle(res,
  () => serviceEngine.cancelServiceBooking(store, { ...req.body, bookingId: Number(req.params.id) })));

app.post('/api/service/recurring', requireActor('customerId'), (req, res) => handle(res,
  () => serviceEngine.createRecurringSeries(store, req.body || {}), 201));

app.get('/api/service/customer/:customerId/bookings', (req, res) => handle(res,
  () => serviceEngine.listBookingsForCustomer(store, req.params.customerId, req.query.verticalId || null)));

app.get('/api/service/:verticalId/customer/:customerId/preferred', (req, res) => handle(res,
  () => serviceEngine.preferredProviders(store, req.params.customerId, req.params.verticalId)));


app.listen(PORT, () => {
  console.log(`VOID listening on http://localhost:${PORT}`);
  console.log(`Health check: curl http://localhost:${PORT}/api/health`);
});
