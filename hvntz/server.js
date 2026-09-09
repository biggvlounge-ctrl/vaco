// HVNTZ — Revenue Stack API.
// Source of truth: HVNTZ_COMPLETE_REVENUE_STACK.md,
// HVNTZ_VOID_STATION_REVENUE_STRUCTURE.md,
// VOID_HVNTZ_SESSION_ADDITIONS_PRICING.md.
//
// Real payouts route through the same V3-compatible wallet contract
// this whole session established (venvs-mock-backend), matching the
// doc's own framing of HVNTZ as part of one shared VACO ecosystem
// wallet, not a separate ledger.
//
// Run:
//   npm install
//   npm start
//
// Test:
//   curl -X POST http://localhost:8792/api/business -H "Content-Type: application/json" -d '{"name":"Cherokee Fitness","ownerId":"gym-owner"}'

const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv/config');

const { createPersistentStore, durable } = require('./lib/persistence');

const {
  REVENUE_EVENT_TYPES, LOCATION_TYPES, createHvntzStore,
  registerBusiness, getBusiness, registerLocation, getLocation, getLocationsForBusiness, syncLocationToMapSearch,
  recordRevenueEvent, getRevenueEvents, getFranchiseList,
} = require('./lib/revenueStack');
const { PARTICIPATION_TYPES, registerLocationParticipation, getParticipations } = require('./lib/participation');
const { setPlacementRule, checkPlacementAllowed, flagPlacement, resolveFlag, getFlagsForVenue } = require('./lib/drea');
const { AD_TIERS, calculateAdPrice } = require('./lib/adPricing');
const { computeDigitalTwinLevel } = require('./lib/digitalTwin');
const {
  optInToNeighborProgram, optOutOfNeighborProgram, getNeighborProgram, findNearbyNeighbors, recordNeighborTrade, suggestNeighborTrades,
} = require('./lib/neighborProgram');
const { PACKAGE_TIERS, setCvnvoPlacement, getCvnvoPlacement } = require('./lib/cvnvoPlacement');
const {
  HUNT_INTENSITY_LEVELS, createHunt, getHunt, addCheckpoint, checkInAtCheckpoint, getHuntProgress, recommendBreak,
} = require('./lib/hunts');
const { getExplorePage } = require('./lib/explore');
const {
  submitAdContent, getAdSubmission, reviewAdSubmission, getAdSubmissions, runAdSubmission,
} = require('./lib/adReview');
const { getScreenAnalytics } = require('./lib/screenAnalytics');


const { createServiceAuth } = require('./lib/serviceAuth.cjs');
const { createDecisionLog } = require('./lib/decisionLog.cjs');
const { createOperatorAuth } = require('./lib/operatorAuth.cjs');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const { traceMiddleware } = require('./lib/tracing.cjs');
// Trace context, mounted before any auth middleware: a request that is
// *refused* still carries a trace id, and a 401 you cannot correlate is
// exactly the one you want to correlate.
app.use(traceMiddleware());


app.use(express.static(path.join(__dirname, 'public')));
const PORT = process.env.PORT || 8792;
const V3_API_URL = process.env.V3_API_URL || 'http://localhost:8811';

// V3 requires every mutating caller to be either a user session or a
// known internal service. This app settles server-to-server, with no
// end-user session to present, so it presents a service credential.
// See v3/lib/serviceAuth.js. Absent in dev, which V3 answers with a
// clear 401 rather than a silent success.
const VACO_SERVICE_NAME = process.env.VACO_SERVICE_NAME || 'hvntz';
const VACO_SERVICE_TOKEN = process.env.VACO_SERVICE_TOKEN || '';
function serviceHeaders() {
  return VACO_SERVICE_TOKEN
    ? { 'X-Service-Name': VACO_SERVICE_NAME, 'X-Service-Token': VACO_SERVICE_TOKEN }
    : {};
}

const VAVLT_STVDIOS_API_URL = process.env.VAVLT_STVDIOS_API_URL || 'http://localhost:8808';
const store = createPersistentStore(path.join(__dirname, 'data', 'store.json'), createHvntzStore);
app.use(durable(store));  // commit before responding -- see lib/persistence.js

// `requireCallingService()` on this app's operator and telemetry routes
// is only meaningful with serviceAuth establishing who the caller is.
// It also puts a floor under everything else: no route here has a
// legitimate anonymous caller.
const serviceAuth = createServiceAuth();
app.use(serviceAuth.middleware);

// Operator-grade decisions are recorded in vaco-audit BEFORE they
// execute, and refuse to execute if the record does not land. See
// shared/decisionLog.js for why this one does not fail soft, and
// dev-docs/DECISION_AUDIT.md for the posture.
const decisionLog = createDecisionLog({ app: 'hvntz' });
const operatorAuth = createOperatorAuth();
const { requireOperator } = operatorAuth;

// Real presentation/demo data -- only when the store is genuinely
// empty (a fresh boot, not a persisted store loaded from disk with
// real businesses already in it), so restarting the server never
// double-seeds and real data is never clobbered. Seeding itself is
// real, async work (recordRevenueEvent), so it's awaited before the
// server starts accepting requests -- see the bottom of this file.
const { seedDemoData } = require('./lib/seedDemoData');

// `idempotencyKey` is optional and forwarded to V3 as an
// Idempotency-Key header. When present, V3 replays the first
// result instead of charging again. It is deliberately a
// parameter rather than something derived here -- see the note
// at the call sites.
async function transferVCoin(fromUserId, toUserId, amount, reason, idempotencyKey) {
  const res = await fetch(`${V3_API_URL}/api/vcoin/transfer`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...serviceHeaders(),
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    },
    body: JSON.stringify({ fromUserId, toUserId, amount, reason }),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.error || `transferVCoin failed (${res.status})`);
  }
  return body;
}

// Real, live cross-app call into Vavlt Stvdios' own content API --
// checkInAtCheckpoint's own real photo-proof feature (lib/hunts.js)
// injects this the same way every other cross-app client in this
// session is injected, rather than HVNTZ building its own photo/post
// storage.
async function postToVavltStvdios(postOptions) {
  const res = await fetch(`${VAVLT_STVDIOS_API_URL}/api/posts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(postOptions),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.error || `postToVavltStvdios failed (${res.status})`);
  }
  return body;
}

// Real, live cross-app call into Vavlt Stvdios' own Map Search API --
// same injected-client shape as `postToVavltStvdios` above.
async function postMapListing(listingOptions) {
  const res = await fetch(`${VAVLT_STVDIOS_API_URL}/api/map-listings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(listingOptions),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.error || `postMapListing failed (${res.status})`);
  }
  return body;
}

const {
  requireActor, requireSession, requireCallingService,
} = require('./lib/shieldAuth.cjs');

// -- Authorization ------------------------------------------------------
//
// **HVNTZ's routes almost all name a business, not a user.** A business
// has one `ownerId`, so the shape here is an ownership lookup on that
// field wherever it appears -- in the body, in the path, or one hop
// away through a location or an ad submission.
//
// The exposure this closes is commercial rather than personal: without
// it anyone could register a location under somebody else's business,
// opt their competitor out of the neighbor program, set placement rules
// on a venue they do not own, or approve their own ad submission.
function businessOwnerOf(store, businessId) {
  const business = getBusiness(store, Number(businessId));
  return business ? business.ownerId : null;
}

function requireBusinessOwner(resolveBusinessId, label = 'business') {
  const session = requireSession();
  return (req, res, next) => session(req, res, () => {
    const businessId = resolveBusinessId(req);
    if (businessId === null || businessId === undefined) {
      return res.status(400).json({ error: `this route must name the ${label} it acts on` });
    }
    const ownerId = businessOwnerOf(store, businessId);
    if (ownerId === null) return res.status(404).json({ error: `no business with id ${businessId}` });
    if (ownerId !== req.sessionUserId) {
      return res.status(403).json({ error: `only the owner of this ${label} may act on it` });
    }
    return next();
  });
}

const requireBodyBusinessOwner = () => requireBusinessOwner((req) => (req.body || {}).businessId);
const requireParamBusinessOwner = (param) => requireBusinessOwner((req) => req.params[param]);
// A location belongs to a business; the business's owner is the party.
const requireLocationBusinessOwner = () => requireBusinessOwner((req) => {
  const location = getLocation(store, Number(req.params.id));
  return location ? location.businessId : null;
}, 'location');
// An ad submission belongs to the business that submitted it. **Review
// is deliberately NOT this** -- see the route.
const requireSubmissionBusinessOwner = () => requireBusinessOwner((req) => {
  const submission = getAdSubmission(store, Number(req.params.id));
  return submission ? submission.businessId : null;
}, 'ad submission');

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true, revenueEventTypes: REVENUE_EVENT_TYPES.length, locationTypes: LOCATION_TYPES, adTiers: AD_TIERS,
    // The decision log's own state, so an `observe` window with real
    // gaps in it is visible from outside rather than only in a log.
    decisionLog: decisionLog.describe(),
    operatorAuth: operatorAuth.describe(),
  });
});

app.post('/api/business', requireActor('ownerId'), (req, res) => {
  try {
    res.status(201).json(registerBusiness(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/business/:id', (req, res) => {
  const business = getBusiness(store, Number(req.params.id));
  if (!business) return res.status(404).json({ error: `no business with id ${req.params.id}` });
  res.json(business);
});

// Real, previously-missing gap: `GET /api/business/:id` alone never
// exposed a business's real coordinates (they live on Location, not
// Business) -- closed for VOID's own real Affiliate Network onboarding
// flow, which needs the real list to let an operator pick which
// location becomes a delivery midpoint.
app.get('/api/business/:id/locations', (req, res) => {
  try {
    res.json({ locations: getLocationsForBusiness(store, Number(req.params.id)) });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

app.post('/api/location', requireBodyBusinessOwner(), (req, res) => {
  try {
    res.status(201).json(registerLocation(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/location/:id', (req, res) => {
  const location = getLocation(store, Number(req.params.id));
  if (!location) return res.status(404).json({ error: `no location with id ${req.params.id}` });
  res.json(location);
});

app.post('/api/location/:id/sync-map-search', requireLocationBusinessOwner(), async (req, res) => {
  try {
    res.json(await syncLocationToMapSearch(store, { ...req.body, locationId: Number(req.params.id), syncToMapSearch: postMapListing }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// A revenue event moves VCoin from a payer to a business. It is
// recorded by the platform on a real transaction, not claimed by the
// business itself -- a business that could post its own revenue events
// could pay itself.
app.post('/api/revenue-event', requireOperator('hvntz:settle'), async (req, res) => {
  try {
    await decisionLog.record({
      route: 'POST /api/revenue-event',
      outcomeKind: 'settlement',
      subjectType: 'business',
      subjectId: String((req.body||{}).locationId ?? ''),
      decidedBy: req.operator.operatorName,
      decidedByKind: 'operator',
      inputs: req.body || {},
      reason: (req.body || {}).reason || null,
    });
  } catch (err) {
    return res.status(503).json({ error: err.message });
  }

  try {
    const event = await recordRevenueEvent(store, { ...req.body, transferFn: transferVCoin });
    res.status(201).json(event);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/revenue-events', (req, res) => {
  const { businessId, locationId, eventType } = req.query;
  res.json({
    events: getRevenueEvents(store, {
      businessId: businessId ? Number(businessId) : undefined,
      locationId: locationId ? Number(locationId) : undefined,
      eventType,
    }),
  });
});

app.get('/api/franchise-list/:businessId', (req, res) => {
  try {
    res.json({ franchiseList: getFranchiseList(store, Number(req.params.businessId)) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/participation', requireBodyBusinessOwner(), (req, res) => {
  try {
    res.status(201).json(registerLocationParticipation(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/participation/:businessId', (req, res) => {
  res.json({ participations: getParticipations(store, Number(req.params.businessId)) });
});

app.post('/api/placement-rule', requireBodyBusinessOwner(), (req, res) => {
  try {
    res.status(201).json(setPlacementRule(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// A read in POST clothing: it answers "would this placement be allowed"
// and writes nothing.
app.post('/api/placement-check', requireSession(), (req, res) => {
  res.json(checkPlacementAllowed(store, req.body || {}));
});

app.post('/api/placement-flag', requireSession(), (req, res) => {
  try {
    res.status(201).json(flagPlacement(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/placement-flag/:id/resolve', requireOperator('hvntz:enforce'), async (req, res) => {
  try {
    await decisionLog.record({
      route: 'POST /api/placement-flag/:id/resolve',
      outcomeKind: 'enforcement',
      subjectType: 'placementFlag',
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
    res.json(resolveFlag(store, Number(req.params.id), (req.body || {}).status));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/placement-flags/:venueId', (req, res) => {
  const { status } = req.query;
  res.json({ flags: getFlagsForVenue(store, Number(req.params.venueId), { status }) });
});

app.post('/api/ad-price', requireSession(), (req, res) => {
  try {
    res.json(calculateAdPrice(req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/digital-twin/:businessId', (req, res) => {
  try {
    res.json(computeDigitalTwinLevel(store, Number(req.params.businessId)));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/neighbor-program/opt-in', requireBodyBusinessOwner(), (req, res) => {
  try {
    res.status(201).json(optInToNeighborProgram(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/neighbor-program/opt-out/:businessId', requireParamBusinessOwner('businessId'), (req, res) => {
  try {
    res.json(optOutOfNeighborProgram(store, Number(req.params.businessId)));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/neighbor-program/:businessId', (req, res) => {
  res.json(getNeighborProgram(store, Number(req.params.businessId)));
});

app.get('/api/neighbor-program/:businessId/nearby', (req, res) => {
  try {
    res.json({ neighbors: findNearbyNeighbors(store, Number(req.params.businessId)) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/neighbor-program/:businessId/suggestions', (req, res) => {
  try {
    res.json({ suggestions: suggestNeighborTrades(store, Number(req.params.businessId)) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/neighbor-program/trade', requireBodyBusinessOwner(), (req, res) => {
  try {
    res.status(201).json(recordNeighborTrade(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/cvnvo-placement', requireBodyBusinessOwner(), (req, res) => {
  try {
    res.status(201).json(setCvnvoPlacement(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/cvnvo-placement/:businessId', (req, res) => {
  res.json(getCvnvoPlacement(store, Number(req.params.businessId)));
});

app.post('/api/hunt', requireActor('sponsorId'), (req, res) => {
  try {
    res.status(201).json(createHunt(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/hunt/:huntId', (req, res) => {
  const hunt = getHunt(store, Number(req.params.huntId));
  if (!hunt) return res.status(404).json({ error: `no hunt with id ${req.params.huntId}` });
  res.json(hunt);
});

app.post('/api/hunt/:huntId/checkpoint', requireBodyBusinessOwner(), (req, res) => {
  try {
    res.status(201).json(addCheckpoint(store, { ...req.body, huntId: Number(req.params.huntId) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/hunt/:huntId/checkin', requireActor('userId'), async (req, res) => {
  try {
    const result = await checkInAtCheckpoint(store, {
      ...req.body,
      huntId: Number(req.params.huntId),
      transferFn: transferVCoin,
      // Real and optional -- only actually calls Vavlt Stvdios when
      // the caller supplied a real photoUrl in the request body.
      postToVavltStvdios,
    });
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/hunt/:huntId/progress/:userId', (req, res) => {
  try {
    res.json(getHuntProgress(store, Number(req.params.huntId), req.params.userId));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/hunt/:huntId/break-recommendation/:userId', (req, res) => {
  try {
    const { lat, lng } = req.query;
    const recommendation = recommendBreak(store, {
      huntId: Number(req.params.huntId),
      userId: req.params.userId,
      currentLat: lat !== undefined ? Number(lat) : undefined,
      currentLng: lng !== undefined ? Number(lng) : undefined,
    });
    res.json(recommendation);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/explore', (req, res) => {
  try {
    const { lat, lng } = req.query;
    res.json({ surfaced: getExplorePage(store, { userLat: Number(lat), userLng: Number(lng) }) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/ad-submission', requireBodyBusinessOwner(), (req, res) => {
  try {
    res.status(201).json(submitAdContent(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/ad-submission/:id', (req, res) => {
  const submission = getAdSubmission(store, Number(req.params.id));
  if (!submission) return res.status(404).json({ error: `no ad submission with id ${req.params.id}` });
  res.json(submission);
});

// **Review is HVNTZ's, not the submitter's.** Guarding this with the
// submission's own business owner would let every advertiser approve
// their own ad, which is the opposite of what a review is for. It stays
// a service surface until there is a real moderator role.
app.post('/api/ad-submission/:id/review', requireOperator('hvntz:grade'), async (req, res) => {
  try {
    await decisionLog.record({
      route: 'POST /api/ad-submission/:id/review',
      outcomeKind: 'grade',
      subjectType: 'adSubmission',
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
    res.json(reviewAdSubmission(store, { ...req.body, submissionId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/ad-submissions', (req, res) => {
  const { businessId, status } = req.query;
  res.json({ submissions: getAdSubmissions(store, { businessId: businessId ? Number(businessId) : undefined, status }) });
});

app.post('/api/ad-submission/:id/run', requireOperator('hvntz:settle'), async (req, res) => {
  try {
    await decisionLog.record({
      route: 'POST /api/ad-submission/:id/run',
      outcomeKind: 'settlement',
      subjectType: 'adSubmission',
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
    const result = await runAdSubmission(store, {
      ...req.body,
      submissionId: Number(req.params.id),
      transferFn: transferVCoin,
    });
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/screen-analytics/:businessId', (req, res) => {
  try {
    res.json(getScreenAnalytics(store, Number(req.params.businessId)));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

async function start() {
  if (store.businesses.length === 0) {
    await seedDemoData(store);
  }
  app.listen(PORT, () => {
    console.log(`HVNTZ Revenue Stack listening on http://localhost:${PORT}`);
    console.log(`Health check: curl http://localhost:${PORT}/api/health`);
    console.log(`Real payouts route through V3 at ${V3_API_URL} (venvs-mock-backend in this environment)`);
  });
}

start();
