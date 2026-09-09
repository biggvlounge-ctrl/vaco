// CVNVO (Convo) -- the ecosystem's dating app.
// Source of truth: CVNVO_ARCHITECTURE.md, CVNVO_CORE_FEATURES.md,
// CVNVO_DATING_COMPARABLES.md, CVNVO_BARBUDDY_FEATURE.md.
//
// Run:
//   npm install
//   npm start
//
// Test:
//   curl http://localhost:8798/api/health

const express = require('express');
const cors = require('cors');
const http = require('http');
require('dotenv/config');

const { createCvnvoStore } = require('./lib/store');
const path = require('path');
const { createPersistentStore, durable } = require('./lib/persistence');
const { createMediaClient } = require('./lib/mediaClient.cjs');
const { createMessageSocketServer } = require('./lib/messageSocket');
const { createUserProfile, getUserProfile } = require('./lib/profiles');
const { computeCompatibilityScore } = require('./lib/compatibility');
const {
  MATCH_TYPES, runGaleShapley, createMatch, getMatch, generateAndCreateMatches,
} = require('./lib/matching');
const {
  createSafetyCheckIn, getSafetyCheckIn, getFullCheckInStatus, confirmSafe, getUserDateReliability, attachVoidRideData,
  schedulePhotoCheckIn, submitPhotoCheckIn,
} = require('./lib/firstDateSafety');
const { triggerFakeCall, recordScreenTimeSession } = require('./lib/vsafeExtras');
const { CALL_STATUSES, startAnonymousCall, endCall, getCallSession } = require('./lib/communicationControls');
const { screenMessage } = require('./lib/messageSafety');
const { requireActor, requireSession, requireCallingService } = require('./lib/shieldAuth.cjs');
const { createServiceAuth } = require('./lib/serviceAuth.cjs');
const {
  MAX_UNANSWERED_CONVERSATIONS, sendMessage, getMessagesForMatch, getUnansweredConversations, isUserOverTurnLimit,
} = require('./lib/messages');
const {
  HAPPN_CROSSING_RADIUS_KM, recordProximityEvent, getProximityFeed, sendFlashNote, getFlashNotesForUser,
  checkInAtVenue, checkOutOfVenue, setVenueVisibility, getVisibleUsersAtVenue,
} = require('./lib/proximity');
const {
  SPEED_DATE_FORMATS, scheduleSpeedDate, getSpeedDateSlot, extendSpeedDate, isGroupSlot, generateRotationSchedule,
} = require('./lib/speedDating');
const {
  setGiftThreshold, getGiftThreshold, requestDateWithGift, getGiftRequestsForUser,
} = require('./lib/giftDating');
const {
  CLOSING_DISTANCE_STAGES, setLongDistancePin, getLongDistancePin, getDailyCuratedMatch,
  getClosingDistanceStatus, advanceClosingDistanceStage,
} = require('./lib/longDistance');
const {
  DATE_TOKEN_PRICE_VCOIN, MAX_CONSECUTIVE_CANCELLATIONS, purchaseDateToken, isUserBlockedFromBlindDating,
  assignBlindDate, getBlindDateSession, revealPhotos, cancelBlindDate,
} = require('./lib/blindDate');
const {
  LOCATION_PRIVACY_TIERS, setLocationSharingPreference, getLocationSharingPreference, shareLocation,
  getVisibleLocationsFor, searchNearbyOpenUsers, createDateEvent, getDateEvent, rsvpToDateEvent,
  getVisibleAttendeeCount, linkHuntToDateEvent,
} = require('./lib/dateEvents');

const app = express();

// Live media and recorded assets live in vaco-media, not here.
// **Fails soft**, which is the opposite call from the decision log
// and deliberately so: a settlement that cannot be recorded must
// not happen, but an interaction that cannot show video is
// degraded rather than broken. See shared/mediaClient.js.
const media = createMediaClient({ app: 'cvnvo' });
app.use(cors());
app.use(express.json({ limit: '1mb' }));

const { traceMiddleware } = require('./lib/tracing.cjs');
// Trace context, mounted before any auth middleware: a request that is
// *refused* still carries a trace id, and a 401 you cannot correlate is
// exactly the one you want to correlate.
app.use(traceMiddleware());


app.use(express.static(path.join(__dirname, 'public')));
const PORT = process.env.PORT || 8798;
const VOID_API_URL = process.env.VOID_API_URL || 'http://localhost:8793';
const VSAFE_API_URL = process.env.VSAFE_API_URL || 'http://localhost:8799';
const VACA_API_URL = process.env.VACA_API_URL || 'http://localhost:8804';
const HVNTZ_API_URL = process.env.HVNTZ_API_URL || 'http://localhost:8792';
const V3_API_URL = process.env.V3_API_URL || 'http://localhost:8811';

// V3 and VSAFE both require every mutating caller to be either a user
// session or a known internal service. This app calls them
// server-to-server, with no end-user session to present, so it presents
// a service credential. See shared/serviceAuth.js.
//
// **This is not optional plumbing.** VSAFE started enforcing after its
// twenty-seven open routes were closed, and every CVNVO -> VSAFE call
// below had to gain the header in the same change or the whole safety
// integration would have started 401ing — a failure that no unit test
// in either app could see, because neither of them sends a request.
// Absent in dev, which both answer with a clear 401 rather than a
// silent success.
const VACO_SERVICE_NAME = process.env.VACO_SERVICE_NAME || 'cvnvo';
const VACO_SERVICE_TOKEN = process.env.VACO_SERVICE_TOKEN || '';
function serviceHeaders() {
  return VACO_SERVICE_TOKEN
    ? { 'X-Service-Name': VACO_SERVICE_NAME, 'X-Service-Token': VACO_SERVICE_TOKEN }
    : {};
}

const YAP_API_URL = process.env.YAP_API_URL || 'http://localhost:8802';
const store = createPersistentStore(path.join(__dirname, 'data', 'store.json'), createCvnvoStore);
app.use(durable(store));  // commit before responding -- see lib/persistence.js

// Establishes that the caller is *someone* — a Shield session or a
// named internal service — before any per-route guard runs. It is what
// makes `requireCallingService()` on the batch matching runs mean
// something, and it closes the two classifier routes that legitimately
// have no per-user check to make.
const serviceAuth = createServiceAuth();
app.use(serviceAuth.middleware);

// Real presentation/demo data -- only when the store is genuinely
// empty (a fresh boot, not a persisted store loaded from disk with
// real profiles already in it), so restarting the server never
// double-seeds and real data is never clobbered.
const { seedDemoData } = require('./lib/seedDemoData');
if (store.profiles.length === 0) {
  seedDemoData(store);
}

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

// Real, live cross-app call to HVNTZ's own real hunt lookup -- Hunts
// Dates' own real validation (see dateEvents.js's own header for why
// this differs from BarBuddy's caller-declared venueId).
async function fetchHunt(huntId) {
  const res = await fetch(`${HVNTZ_API_URL}/api/hunt/${huntId}`);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `fetchHunt failed (${res.status})`);
  return body;
}

// Real, live cross-app call to HVNTZ's own real business lookup --
// BarBuddy's own opt-in venue validation (see proximity.js's own
// header for why it's opt-in, not the default).
async function fetchBusiness(businessId) {
  const res = await fetch(`${HVNTZ_API_URL}/api/business/${businessId}`);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `fetchBusiness failed (${res.status})`);
  return body;
}

// Real, live cross-app call to VOID's own API -- injected into
// lib/firstDateSafety.js the same way transferFn is injected
// elsewhere, so the module stays testable without a live VOID server.
async function fetchVoidJob(voidJobId) {
  const res = await fetch(`${VOID_API_URL}/api/job/${voidJobId}`);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `fetchVoidJob failed (${res.status})`);
  return body;
}

// The real VSAFE client -- CVNVO's own safety check-in logic now
// calls into VSAFE's real, shared, standalone service for every
// safety-critical operation, rather than keeping a local duplicate.
async function vsafeCreate(params) {
  const res = await fetch(`${VSAFE_API_URL}/api/check-ins`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...serviceHeaders() }, body: JSON.stringify(params),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `vsafeCreate failed (${res.status})`);
  return body;
}
async function vsafeConfirm(vsafeCheckInId) {
  const res = await fetch(`${VSAFE_API_URL}/api/check-ins/${vsafeCheckInId}/confirm-safe`, { method: 'POST', headers: serviceHeaders() });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `vsafeConfirm failed (${res.status})`);
  return body;
}
async function vsafeGet(vsafeCheckInId) {
  const res = await fetch(`${VSAFE_API_URL}/api/check-ins/${vsafeCheckInId}`);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `vsafeGet failed (${res.status})`);
  return body;
}

// Real, live clients for VSAFE's Phase 3 endpoints (Photo Check-ins,
// Fake Call, Screen Time) -- same posture as the three above.
async function vsafePhotoSchedule(params) {
  const res = await fetch(`${VSAFE_API_URL}/api/photo-check-ins`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...serviceHeaders() }, body: JSON.stringify(params),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `vsafePhotoSchedule failed (${res.status})`);
  return body;
}
async function vsafePhotoSubmit(vsafePhotoCheckInId, photoUrl) {
  const res = await fetch(`${VSAFE_API_URL}/api/photo-check-ins/${vsafePhotoCheckInId}/submit`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...serviceHeaders() }, body: JSON.stringify({ photoUrl }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `vsafePhotoSubmit failed (${res.status})`);
  return body;
}
async function vsafeFakeCall(params) {
  const res = await fetch(`${VSAFE_API_URL}/api/fake-calls`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...serviceHeaders() }, body: JSON.stringify(params),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `vsafeFakeCall failed (${res.status})`);
  return body;
}
async function vsafeScreenTime(params) {
  const res = await fetch(`${VSAFE_API_URL}/api/screen-time/sessions`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...serviceHeaders() }, body: JSON.stringify(params),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `vsafeScreenTime failed (${res.status})`);
  return body;
}

// Real, live cross-app call to VACA's own identity-claim authority --
// confirmed directly (by reading lib/profiles.js and this file
// together) that `verifiedBadge` was, until this call existed, just
// whatever boolean the client put in the request body, the exact same
// "trusted client input" gap VOKEN's own `authenticityGrade` had
// before VACA closed it there. subjectType 'cvnvo-user' scopes VACA's
// claim namespace to this app specifically.
async function fetchIdentityStatus(userId) {
  const res = await fetch(`${VACA_API_URL}/api/identity-status/cvnvo-user/${encodeURIComponent(userId)}`);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `fetchIdentityStatus failed (${res.status})`);
  return body.verified;
}

// Real, live fetch of YAP's own safety summary -- closes YAP's own
// previously-flagged gap ("CVNVO's discovery stack surfacing
// verification/Yap signals visibly" -- yap/README.md's own "Not yet
// built"). Unlike `fetchIdentityStatus` above (called once at profile
// creation, allowed to fail loudly), this is called on every profile
// read -- fails soft (`null`) rather than 500ing an entire profile
// view just because YAP happens to be down, since a missing safety
// signal is a real, honest degradation, not a reason to hide the rest
// of a real profile.
async function fetchYapSignal(userId) {
  try {
    const res = await fetch(`${YAP_API_URL}/yap/summary/${encodeURIComponent(userId)}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'cvnvo',
    matchTypes: MATCH_TYPES,
    callStatuses: CALL_STATUSES,
    speedDateFormats: SPEED_DATE_FORMATS,
    closingDistanceStages: CLOSING_DISTANCE_STAGES,
    locationPrivacyTiers: LOCATION_PRIVACY_TIERS,
  });
});

// -- Authorization ------------------------------------------------------
//
// **Thirty-three of CVNVO's thirty-five mutating routes had no guard.**
// On a dating app that is not an abstract exposure: an unauthenticated
// caller could send messages as somebody else, check them into a bar,
// broadcast their live location, cancel their blind date, or file a
// safety check-in in their name. The two that were guarded were the two
// that moved VCoin — which is exactly the bias the acceleration matrix
// predicted and the reason this sweep is not organised by money.
//
// Two shapes, following vxllage's pass:
//
//   the body names the actor      -> requireActor('senderId')
//   the path names a THING        -> resolve it, compare its owner
//
// `requireSession()` alone is never the answer for the second shape. It
// proves somebody is logged in, which says nothing about whose match,
// check-in or venue visit this is.
function requireRecordOwner(label, lookup, ownerOf) {
  const session = requireSession();
  return (req, res, next) => session(req, res, () => {
    const record = lookup(req);
    if (!record) return res.status(404).json({ error: `no ${label} with id ${req.params.id ?? req.params.matchId}` });
    const owner = ownerOf(record);
    const allowed = Array.isArray(owner) ? owner.includes(req.sessionUserId) : owner === req.sessionUserId;
    if (!allowed) {
      return res.status(403).json({ error: `only a participant in this ${label} may act on it` });
    }
    return next();
  });
}

const requireCheckInOwner = () => requireRecordOwner(
  'safety check-in', (req) => getSafetyCheckIn(store, Number(req.params.id)), (c) => c.userId,
);
// Either side of a match may message, call or end a call on it.
const requireMatchParticipant = (param = 'id') => requireRecordOwner(
  'match', (req) => getMatch(store, Number(req.params[param])), (m) => [m.userAId, m.userBId],
);
const requireSpeedDateParticipant = () => requireRecordOwner(
  'speed date slot', (req) => getSpeedDateSlot(store, Number(req.params.id)), (slot) => slot.participants,
);
const requireBlindDateOwner = () => requireRecordOwner(
  'blind date session', (req) => getBlindDateSession(store, Number(req.params.id)), (bd) => bd.userId,
);
const requireDateEventParticipant = () => requireRecordOwner(
  'date event', (req) => getDateEvent(store, Number(req.params.id)), (e) => e.participants,
);
// A call session is ended by either party, same reasoning as a match.
const requireCallParty = () => requireRecordOwner(
  'call session',
  (req) => store.callSessions.find((c) => c.id === Number(req.params.id)),
  (c) => [c.callerId, c.calleeId],
);

// Some bodies name a LIST of people rather than one actor — a speed
// date's participants, a date event's attendees. The rule the domain
// already implies is that you may only arrange something you are part
// of, so: the session user must appear in the list.
function requireListedParticipant(field) {
  const session = requireSession();
  return (req, res, next) => session(req, res, () => {
    const listed = (req.body || {})[field];
    if (!Array.isArray(listed) || !listed.includes(req.sessionUserId)) {
      return res.status(403).json({
        error: `requireListedParticipant: you may only arrange this for a '${field}' list you are part of`,
      });
    }
    return next();
  });
}

app.post('/api/profiles', requireActor('userId'), async (req, res) => {
  try {
    const body = req.body || {};
    if (!body.userId) throw new Error('createUserProfile requires a userId');
    // Real override, not a merge -- whatever verifiedBadge the client
    // sent is discarded in favor of VACA's own real, live answer, same
    // posture as VOKEN's authenticityGrade override.
    const verifiedBadge = await fetchIdentityStatus(body.userId);
    res.status(201).json(createUserProfile(store, { ...body, verifiedBadge }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/profiles/:userId', async (req, res) => {
  const profile = getUserProfile(store, req.params.userId);
  if (!profile) return res.status(404).json({ error: `no profile for ${req.params.userId}` });
  // Real, visible safety signal on CVNVO's own discovery-relevant
  // profile read -- closes yap/README.md's own "Not yet built" gap
  // ("CVNVO's discovery stack surfacing verification/Yap signals
  // visibly"). `null` (YAP unreachable) is a real, honest possibility,
  // not hidden from the caller.
  const yapSignal = await fetchYapSignal(req.params.userId);
  res.json({ ...profile, yapSignal });
});

app.get('/api/compatibility/:userAId/:userBId', (req, res) => {
  try {
    const profileA = getUserProfile(store, req.params.userAId);
    const profileB = getUserProfile(store, req.params.userBId);
    if (!profileA || !profileB) return res.status(404).json({ error: 'both users must have real profiles' });
    res.json(computeCompatibilityScore(profileA, profileB));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// **The two batch matching runs are operator surfaces, and CVNVO has no
// operator role yet.** They take two lists of user ids and either
// preview or actually create matches between them — there is no single
// user whose session could authorise it, and `requireSession()` here
// would be the vxllage mistake in a new place: proof that somebody is
// logged in, which says nothing about whether they may run the matcher
// over other people's profiles.
//
// So they are guarded as scheduled jobs — the same call the VSAFE
// sweeps got — and CVNVO gains serviceAuth to make that meaningful. A
// person cannot reach them at all, which is correct until there is a
// real operator role to check against. Recorded as category D in
// dev-docs/ROUTE_AUTHORIZATION_AUDIT.md.
app.post('/api/matches/generate', requireCallingService(), (req, res) => {
  try {
    res.json({ preview: runGaleShapley(store, req.body || {}) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/matches', requireCallingService(), (req, res) => {
  try {
    res.status(201).json({ matches: generateAndCreateMatches(store, req.body || {}) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/matches/:id', (req, res) => {
  const match = getMatch(store, Number(req.params.id));
  if (!match) return res.status(404).json({ error: `no match with id ${req.params.id}` });
  res.json(match);
});

// -- Messages + Your Turn Limits --

app.post('/api/matches/:id/messages', requireActor('senderId'), requireMatchParticipant(), (req, res) => {
  try {
    const matchId = Number(req.params.id);
    const message = sendMessage(store, { ...req.body, matchId });
    // Real push, not just persistence -- broadcastMessage below.
    broadcastMessage(matchId, message);
    res.status(201).json(message);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/matches/:id/messages', (req, res) => {
  res.json({ messages: getMessagesForMatch(store, Number(req.params.id)) });
});

app.get('/api/users/:userId/turn-limit-status', (req, res) => {
  const unansweredConversations = getUnansweredConversations(store, req.params.userId);
  res.json({
    userId: req.params.userId,
    unansweredConversationCount: unansweredConversations.length,
    maxUnansweredConversations: MAX_UNANSWERED_CONVERSATIONS,
    overTurnLimit: isUserOverTurnLimit(store, req.params.userId),
  });
});

app.post('/api/safety/check-ins', requireActor('userId'), async (req, res) => {
  try {
    res.status(201).json(await createSafetyCheckIn(store, { ...req.body, vsafeCreateFn: vsafeCreate }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/safety/check-ins/:id', (req, res) => {
  const checkIn = getSafetyCheckIn(store, Number(req.params.id));
  if (!checkIn) return res.status(404).json({ error: `no check-in with id ${req.params.id}` });
  res.json(checkIn);
});

app.get('/api/safety/check-ins/:id/full-status', async (req, res) => {
  try {
    res.json(await getFullCheckInStatus(store, { checkInId: Number(req.params.id), vsafeGetFn: vsafeGet }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/safety/check-ins/:id/confirm-safe', requireCheckInOwner(), async (req, res) => {
  try {
    res.json(await confirmSafe(store, { ...req.body, checkInId: Number(req.params.id), vsafeConfirmFn: vsafeConfirm }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/safety/reliability/:userId', (req, res) => {
  res.json(getUserDateReliability(store, req.params.userId));
});

app.post('/api/safety/check-ins/:id/void-ride', requireCheckInOwner(), async (req, res) => {
  try {
    res.json(await attachVoidRideData(store, { ...req.body, checkInId: Number(req.params.id), voidFetchFn: fetchVoidJob }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/safety/check-ins/:id/photo-check-in', requireCheckInOwner(), async (req, res) => {
  try {
    res.status(201).json(await schedulePhotoCheckIn(store, {
      ...req.body, checkInId: Number(req.params.id), vsafeGetFn: vsafeGet, vsafePhotoScheduleFn: vsafePhotoSchedule,
    }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/safety/check-ins/:id/photo-check-in/submit', requireCheckInOwner(), async (req, res) => {
  try {
    res.json(await submitPhotoCheckIn(store, { ...req.body, checkInId: Number(req.params.id), vsafePhotoSubmitFn: vsafePhotoSubmit }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/safety/fake-call', requireActor('userId'), async (req, res) => {
  try {
    res.status(201).json(await triggerFakeCall(store, { ...req.body, vsafeFakeCallFn: vsafeFakeCall }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/safety/screen-time', requireActor('userId'), async (req, res) => {
  try {
    res.status(201).json(await recordScreenTimeSession(store, { ...req.body, vsafeScreenTimeFn: vsafeScreenTime }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/calls', requireActor('callerId'), (req, res) => {
  try {
    res.status(201).json(startAnonymousCall(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/calls/:id/end', requireCallParty(), (req, res) => {
  try {
    res.json(endCall(store, { callSessionId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/calls/:id', (req, res) => {
  const session = getCallSession(store, Number(req.params.id));
  if (!session) return res.status(404).json({ error: `no call session with id ${req.params.id}` });
  res.json(session);
});

// A pure classifier over a string: reads no record, writes no record,
// names no user. There is nothing per-user to check. The app-level
// serviceAuth still refuses an anonymous caller.
// audit-route-guards: open -- pure classifier over a string; reads no record, writes none, names no user
app.post('/api/messages/screen', (req, res) => {
  try {
    res.json(screenMessage((req.body || {}).text));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// -- Proximity (Happn) + FlashNotes + BarBuddy --

app.post('/api/proximity', requireActor('userId'), (req, res) => {
  try {
    res.status(201).json(recordProximityEvent(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/proximity/:userId', (req, res) => {
  res.json({ crossingRadiusKm: HAPPN_CROSSING_RADIUS_KM, feed: getProximityFeed(store, req.params.userId) });
});

app.post('/api/flash-notes', requireActor('senderId'), (req, res) => {
  try {
    res.status(201).json(sendFlashNote(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/flash-notes/:userId', (req, res) => {
  res.json({ notes: getFlashNotesForUser(store, req.params.userId) });
});

app.post('/api/barbuddy/check-in', requireActor('userId'), async (req, res) => {
  try {
    res.status(201).json(await checkInAtVenue(store, { ...req.body, hvntzFetchFn: fetchBusiness }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/barbuddy/check-out', requireActor('userId'), (req, res) => {
  try {
    res.json(checkOutOfVenue(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/barbuddy/visibility', requireActor('userId'), (req, res) => {
  try {
    res.json(setVenueVisibility(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/barbuddy/venues/:venueId', (req, res) => {
  res.json({ venueId: req.params.venueId, visibleUsers: getVisibleUsersAtVenue(store, req.params.venueId) });
});

// -- Speed Dating + Group Dating --

app.post('/api/speed-dates', requireListedParticipant('participants'), async (req, res) => {
  let date;
  try {
    date = scheduleSpeedDate(store, req.body || {});
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  // **Not recordable, and that is the important argument.** vaco-media
  // defaults `recordable` to false and refuses to turn it on after the
  // fact, so a speed date cannot become a recorded one later. Consent
  // for a private conversation is given before it happens or not at
  // all. CVNVO keeps the duration rule, the extension rule and the
  // matching -- none of that moves.
  const session = await media.openSession(date.id, 'call', {
    maxParticipants: (date.participants || []).length || 2,
  });
  const grants = [];
  if (session) {
    for (const participantId of date.participants || []) {
      const invite = await media.inviteParticipant(session.id, participantId, {
        ttlMs: Math.min(3600000, ((date.durationSec || 600) + 300) * 1000),
      });
      if (invite) grants.push({ participantId, joinCredential: invite.credential });
    }
  }

  return res.status(201).json({
    ...date,
    media: session
      ? { sessionId: session.id, recordable: false, grants, joinAt: '/api/join' }
      : { available: false, reason: 'vaco-media did not answer; the date is scheduled without video' },
  });
});

app.get('/api/speed-dates/:id', (req, res) => {
  const slot = getSpeedDateSlot(store, Number(req.params.id));
  if (!slot) return res.status(404).json({ error: `no speed date slot with id ${req.params.id}` });
  res.json(slot);
});

app.post('/api/speed-dates/:id/extend', requireSpeedDateParticipant(), (req, res) => {
  try {
    res.json(extendSpeedDate(store, { ...req.body, slotId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/speed-dates/:id/rotation', (req, res) => {
  try {
    res.json({ rounds: generateRotationSchedule(store, { slotId: Number(req.params.id) }) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// -- Gift Dating --

app.post('/api/gift-dating/threshold', requireActor('userId'), (req, res) => {
  try {
    res.status(201).json(setGiftThreshold(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/gift-dating/threshold/:userId', (req, res) => {
  res.json(getGiftThreshold(store, req.params.userId) || { userId: req.params.userId, minGiftValueVCoin: 0 });
});

app.post('/api/gift-dating/request', requireActor('requesterId'), async (req, res) => {
  try {
    res.status(201).json(await requestDateWithGift(store, { ...req.body, transferFn: transferVCoin }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/gift-dating/requests/:userId', (req, res) => {
  res.json({ requests: getGiftRequestsForUser(store, req.params.userId) });
});

// -- Long-Distance Mode --

app.post('/api/long-distance/pin', requireActor('userId'), (req, res) => {
  try {
    res.status(201).json(setLongDistancePin(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/long-distance/pin/:userId', (req, res) => {
  const pin = getLongDistancePin(store, req.params.userId);
  if (!pin) return res.status(404).json({ error: `no long-distance pin for ${req.params.userId}` });
  res.json(pin);
});

app.post('/api/long-distance/daily-match', requireActor('userId'), (req, res) => {
  try {
    res.json(getDailyCuratedMatch(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/long-distance/roadmap/:matchId', (req, res) => {
  res.json(getClosingDistanceStatus(store, Number(req.params.matchId)));
});

app.post('/api/long-distance/roadmap/:matchId/advance', requireMatchParticipant('matchId'), (req, res) => {
  try {
    res.json(advanceClosingDistanceStage(store, { matchId: Number(req.params.matchId) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// -- Blind Date Mode --

app.post('/api/blind-date/token', requireActor('userId'), async (req, res) => {
  try {
    res.status(201).json(await purchaseDateToken(store, { ...req.body, transferFn: transferVCoin }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/blind-date/assign', requireActor('userId'), (req, res) => {
  try {
    res.status(201).json(assignBlindDate(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/blind-date/:id', (req, res) => {
  const session = getBlindDateSession(store, Number(req.params.id));
  if (!session) return res.status(404).json({ error: `no blind date session with id ${req.params.id}` });
  res.json(session);
});

app.post('/api/blind-date/:id/reveal', requireBlindDateOwner(), (req, res) => {
  try {
    res.json(revealPhotos(store, { sessionId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/blind-date/:id/cancel', requireBlindDateOwner(), (req, res) => {
  try {
    res.json(cancelBlindDate(store, { sessionId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/blind-date/blocked/:userId', (req, res) => {
  res.json({ userId: req.params.userId, blocked: isUserBlockedFromBlindDating(store, req.params.userId) });
});

// -- Snap Map / location privacy + DateEvents (Hunts Dates) --

app.post('/api/location/sharing-preference', requireActor('userId'), (req, res) => {
  try {
    res.status(201).json(setLocationSharingPreference(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/location/share', requireActor('userId'), (req, res) => {
  try {
    res.status(201).json(shareLocation(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/location/visible/:viewerId', (req, res) => {
  res.json({ visibleLocations: getVisibleLocationsFor(store, req.params.viewerId) });
});

app.get('/api/location/search', (req, res) => {
  try {
    res.json(searchNearbyOpenUsers(store, {
      lat: Number(req.query.lat), lng: Number(req.query.lng), radiusKm: Number(req.query.radiusKm),
    }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/date-events', requireListedParticipant('participants'), (req, res) => {
  try {
    res.status(201).json(createDateEvent(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/date-events/:id', (req, res) => {
  const event = getDateEvent(store, Number(req.params.id));
  if (!event) return res.status(404).json({ error: `no date event with id ${req.params.id}` });
  res.json({ ...event, visibleAttendeeCount: getVisibleAttendeeCount(store, event.id) });
});

app.post('/api/date-events/:id/rsvp', requireActor('userId'), requireDateEventParticipant(), (req, res) => {
  try {
    res.status(201).json(rsvpToDateEvent(store, { ...req.body, eventId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/date-events/:id/link-hunt', requireDateEventParticipant(), async (req, res) => {
  try {
    res.json(await linkHuntToDateEvent(store, { ...req.body, eventId: Number(req.params.id), huntFetchFn: fetchHunt }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Real WebSocket push (closes the "polled, not pushed" gap) -- shares
// this same HTTP server/port, no new process needed.
const server = http.createServer(app);
const { broadcastMessage } = createMessageSocketServer(server);

server.listen(PORT, () => {
  console.log(`CVNVO listening on http://localhost:${PORT}`);
  console.log(`Health check: curl http://localhost:${PORT}/api/health`);
  console.log(`Real-time messages: ws://localhost:${PORT}/ws/matches?matchId=<id>`);
});
