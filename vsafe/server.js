// VSAFE -- the Universal Safety Layer. Shared infrastructure every
// VACO app calls into, and a real standalone app in its own right.
// Source of truth: UNIVERSAL_SAFETY_LAYER_VSAFE.md.
//
// Run:
//   npm install
//   npm start
//
// Test:
//   curl http://localhost:8799/api/health

const express = require('express');
const cors = require('cors');
require('dotenv/config');

const { createVsafeStore } = require('./lib/store');
const path = require('path');
const { attachStore } = require('./lib/storeBackend');
const {
  SOURCE_APPS, CHECKIN_STATUSES, createSafetyCheckIn, getSafetyCheckIn, confirmSafe, triggerEmergency, checkForMissedCheckIns,
} = require('./lib/safetyCheckIn');
const { ID_DOCUMENT_TYPES, submitIdVerification, getIdVerification, isVerified } = require('./lib/idVerification');
const { computeTrustScore } = require('./lib/trustSignals');
const { CALL_STATUSES, startAnonymousCall, endCall, getCallSession } = require('./lib/communicationControls');
const {
  PROFILE_VISIBILITY_OPTIONS, setPrivacySettings, getPrivacySettings, blockUser, unblockUser, isBlocked,
} = require('./lib/privacyControls');
const { screenContent } = require('./lib/aiMonitoring');
const { moderateContent } = require('./lib/contentModeration');
const {
  requestMeetupVerification, getMeetupVerification, confirmMeetup, isBothConfirmed,
} = require('./lib/meetupVerification');
const { CONCERN_TYPES, logSafetyConcern, getSafetyConcerns } = require('./lib/relationshipSafety');
const { setSafetyWord, checkSafetyWord } = require('./lib/securityFeatures');
const {
  MISSED_CHECKIN_ACTIONS, schedulePhotoCheckIn, getPhotoCheckIn, submitPhotoCheckIn, stopPhotoCheckIn, checkMissedPhotoCheckIns,
} = require('./lib/photoCheckIn');
const {
  FAKE_CALL_STATUSES, scheduleFakeCall, getFakeCall, cancelFakeCall, getDueFakeCalls, answerFakeCall, dismissFakeCall,
} = require('./lib/fakeCall');
const {
  DEFAULT_DAILY_LIMIT_MINUTES, MINOR_DAILY_LIMIT_MINUTES, recordSession, getDailyTotalMinutes, getScreenTimeCheckIn, dismissPrompt,
} = require('./lib/screenTime');

const {
  requireSession, requireActor, requireParamActor, actorOrService, requireCallingService,
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
const PORT = process.env.PORT || 8799;
// -- The store, and which backend holds it ----------------------------
//
// `let`, not `const`: with DATABASE_URL set this app's store lives in
// Postgres, which cannot be built synchronously. `attachStore` mounts a
// gate ahead of the routes so no request runs before the store has
// loaded, and installs the commit-before-responding hook that
// `app.use(durable(store))` used to provide. The route handlers close
// over this binding rather than a value, so they see the real store the
// moment it is installed.
//
// Without DATABASE_URL nothing changes: the same JSON file, in the same
// place, with the same guarantees.
let store = createVsafeStore();
attachStore(app, {
  appKey: 'vsafe',
  createDefault: createVsafeStore,
  filePath: path.join(__dirname, 'data', 'store.json'),
  onReady: (loaded) => { store = loaded; },
});

// **VSAFE both calls and is called.** It presents a credential to
// vaco-notify (below) and receives writes from CVNVO, VACAY and the
// other source apps, which arrange check-ins on a user's behalf with no
// browser session of their own in the request. Twenty-seven of its
// twenty-eight mutating routes were open to anyone.
//
// The shape that fits, route by route, is `actorOrService`: a person
// acting on their own record, OR a named service acting for them.
// Requiring a session everywhere would 401 CVNVO; requiring a service
// credential everywhere would lock out the app's own frontend.
//
// serviceAuth is the outer layer — it establishes that the caller is
// *someone*, and sets `req.callingService` when they are a verified
// service. The per-route guard then answers the separate question of
// whether that someone may act on this particular user's record.
const serviceAuth = createServiceAuth();
app.use(serviceAuth.middleware);

// **The ownership-lookup shape, generalised.** Half of VSAFE's routes
// name a *record* rather than an actor — a check-in id, a photo
// check-in id, a fake-call id. `requireActor` has nothing to check
// against in those bodies, and `requireSession()` alone is exactly the
// mistake vxllage shipped: it proves somebody is logged in, which has
// no bearing on whose record this is.
//
// So: resolve the record, compare its stored owner against the session.
// A missing record is 404 before the 403, deliberately — a 403 on a
// nonexistent id would confirm that ids in that range exist.
function requireRecordOwner(label, lookup, ownerOf = (record) => record.userId) {
  const session = requireSession();
  return (req, res, next) => session(req, res, () => {
    const record = lookup(req);
    if (!record) return res.status(404).json({ error: `no ${label} with id ${req.params.id}` });
    const owner = ownerOf(record);
    const allowed = Array.isArray(owner) ? owner.includes(req.sessionUserId) : owner === req.sessionUserId;
    if (!allowed) {
      return res.status(403).json({ error: `only the person this ${label} belongs to may act on it` });
    }
    return next();
  });
}

const requireCheckInOwner = () => requireRecordOwner(
  'check-in', (req) => getSafetyCheckIn(store, Number(req.params.id)),
);
const requirePhotoCheckInOwner = () => requireRecordOwner(
  'photo check-in', (req) => getPhotoCheckIn(store, Number(req.params.id)),
);
const requireFakeCallOwner = () => requireRecordOwner(
  'fake call', (req) => getFakeCall(store, Number(req.params.id)),
);
// Either party to a call may end it — both are on it, and a call one
// side cannot hang up is a worse safety property than a call either can.
const requireCallParty = () => requireRecordOwner(
  'call session',
  (req) => getCallSession(store, Number(req.params.id)),
  (session) => [session.callerId, session.calleeId],
);

// Requesting a meetup verification names participants rather than an
// actor, and `requireActor` would have nothing to check. The rule that
// makes sense is the one the domain already implies: you may only ask
// for a verification you are part of.
function requireMeetupParticipant() {
  const session = requireSession();
  return (req, res, next) => session(req, res, () => {
    const participantIds = (req.body || {}).participantIds;
    if (!Array.isArray(participantIds) || !participantIds.includes(req.sessionUserId)) {
      return res.status(403).json({
        error: 'requireMeetupParticipant: you may only request a verification you are a participant in',
      });
    }
    return next();
  });
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true, service: 'vsafe', sourceApps: SOURCE_APPS, checkInStatuses: CHECKIN_STATUSES,
    idDocumentTypes: ID_DOCUMENT_TYPES, callStatuses: CALL_STATUSES, profileVisibilityOptions: PROFILE_VISIBILITY_OPTIONS,
    relationshipConcernTypes: CONCERN_TYPES, missedCheckInActions: MISSED_CHECKIN_ACTIONS, fakeCallStatuses: FAKE_CALL_STATUSES,
    screenTimeDefaultDailyLimitMinutes: DEFAULT_DAILY_LIMIT_MINUTES, screenTimeMinorDailyLimitMinutes: MINOR_DAILY_LIMIT_MINUTES,
  });
});

app.post('/api/check-ins', actorOrService(requireActor('userId')), (req, res) => {
  try {
    res.status(201).json(createSafetyCheckIn(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/check-ins/:id', (req, res) => {
  const checkIn = getSafetyCheckIn(store, Number(req.params.id));
  if (!checkIn) return res.status(404).json({ error: `no check-in with id ${req.params.id}` });
  res.json(checkIn);
});

app.post('/api/check-ins/:id/confirm-safe', actorOrService(requireCheckInOwner()), (req, res) => {
  try {
    res.json(confirmSafe(store, { checkInId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// -- Escalation delivery ------------------------------------------------
//
// `lib/safetyCheckIn.js` says it plainly in its own header: the missed
// check-in sweep "returns the real list that a notification layer would
// act on -- no actual SMS/push delivery is built here, that's separate
// infrastructure." That layer now exists (`vaco-notify`, port 8818),
// and this is the wiring.
//
// **This one does not fail soft.** Everywhere else in this ecosystem a
// cross-app call is best-effort — `pushMetric` swallows its errors on
// purpose, because a fractional-share purchase should not be held up by
// analytics being down. An escalation is the opposite: the whole
// product promise is that somebody finds out. So a failure here is
// surfaced in the response rather than logged and forgotten, and the
// caller can see that the page did not land.
const VACO_NOTIFY_URL = process.env.VACO_NOTIFY_URL || 'http://localhost:8818';

// Internal services (V3, VACA, Analytics, Notify, VACON) refuse an
// unauthenticated mutating call. This app calls them server-to-server
// with no end-user session, so it presents a service credential. See
// shared/serviceAuth.js.
const VACO_SERVICE_NAME = process.env.VACO_SERVICE_NAME || 'vsafe';
const VACO_SERVICE_TOKEN = process.env.VACO_SERVICE_TOKEN || '';
function serviceHeaders() {
  return VACO_SERVICE_TOKEN
    ? { 'X-Service-Name': VACO_SERVICE_NAME, 'X-Service-Token': VACO_SERVICE_TOKEN }
    : {};
}

async function escalate(checkIn) {
  try {
    const res = await fetch(`${VACO_NOTIFY_URL}/api/notify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...serviceHeaders(), },
      body: JSON.stringify({
        app: 'vsafe',
        severity: 'critical',
        title: `Safety check-in escalated for ${checkIn.userId}`,
        body: `${checkIn.userId} did not confirm safe for a ${checkIn.activityType} `
          + `started via ${checkIn.sourceApp}. Trusted contacts: `
          + `${(checkIn.trustedContactIds || []).join(', ') || 'none on file'}.`,
        // The trusted contacts ARE the escalation. A notification that
        // says "something happened to somebody" is not actionable.
        context: {
          checkInId: checkIn.id,
          userId: checkIn.userId,
          sourceApp: checkIn.sourceApp,
          activityType: checkIn.activityType,
          trustedContactIds: checkIn.trustedContactIds,
          locationSharingActive: checkIn.locationSharingActive,
        },
      }),
    });
    const body = await res.json();
    return { checkInId: checkIn.id, notified: res.ok, notificationId: body.id ?? null, status: body.status ?? null };
  } catch (err) {
    return { checkInId: checkIn.id, notified: false, error: err.message };
  }
}

// **Only the check-in's own user may trigger it.** Anyone could before,
// and that got materially worse the moment escalations started actually
// paging people: an open trigger is a harassment vector aimed at a real
// person's trusted contacts, and an alert-fatigue vector aimed at the
// channel itself. A pager that fires on strangers' whims gets muted,
// and then the real escalation is missed too.
//
// `requireActor` cannot cover this — the body names no actor, only the
// check-in id. So it is the ownership-lookup shape: a session first,
// then a check against the userId the stored check-in already records.
//
// Deliberately NOT extended to trusted contacts. A contact escalating on
// someone's behalf is a real product question (do they need consent?
// does the subject get told?) and inventing an answer here would be
// worse than the honest restriction. Recorded in
// dev-docs/ROUTE_AUTHORIZATION_AUDIT.md rather than guessed at.
app.post('/api/check-ins/:id/emergency', requireCheckInOwner(), async (req, res) => {
  try {
    const checkIn = triggerEmergency(store, { checkInId: Number(req.params.id) });
    const delivery = await escalate(checkIn);
    res.json({ ...checkIn, notification: delivery });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/check-missed', requireCallingService(), async (req, res) => {
  const escalated = checkForMissedCheckIns(store, req.body || {});
  const notifications = [];
  for (const checkIn of escalated) {
    // eslint-disable-next-line no-await-in-loop -- one at a time, so a
    // single slow or failing page cannot hide the others
    notifications.push(await escalate(checkIn));
  }
  // Reported rather than buried: if `undelivered` is non-empty, the
  // sweep escalated somebody and nobody was told.
  res.json({
    escalated,
    notifications,
    undelivered: notifications.filter((n) => !n.notified).map((n) => n.checkInId),
  });
});

app.post('/api/id-verification', actorOrService(requireActor('userId')), (req, res) => {
  try {
    res.status(201).json(submitIdVerification(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/id-verification/:userId', (req, res) => {
  const record = getIdVerification(store, req.params.userId);
  if (!record) return res.status(404).json({ error: `no id verification record for ${req.params.userId}` });
  res.json(record);
});

app.get('/api/id-verification/:userId/verified', (req, res) => {
  res.json({ userId: req.params.userId, verified: isVerified(store, req.params.userId) });
});

app.post('/api/trust-score', actorOrService(requireActor('userId')), (req, res) => {
  try {
    res.json(computeTrustScore(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/calls', actorOrService(requireActor('callerId')), (req, res) => {
  try {
    res.status(201).json(startAnonymousCall(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/calls/:id/end', actorOrService(requireCallParty()), (req, res) => {
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

app.post('/api/privacy-settings', requireActor('userId'), (req, res) => {
  try {
    res.status(201).json(setPrivacySettings(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/privacy-settings/:userId', (req, res) => {
  res.json(getPrivacySettings(store, req.params.userId));
});

app.post('/api/blocks', requireActor('userId'), (req, res) => {
  try {
    res.status(201).json(blockUser(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/blocks/remove', requireActor('userId'), (req, res) => {
  try {
    res.json(unblockUser(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/blocks/:userIdA/:userIdB', (req, res) => {
  res.json({ blocked: isBlocked(store, req.params.userIdA, req.params.userIdB) });
});

// **These two name no user, and that is correct.** `screenContent` and
// `moderateContent` are pure classifiers over a string — they read no
// record, write no record, and there is no "whose" to check. The
// app-level serviceAuth still applies, so an anonymous caller is
// refused; what is deliberately absent is a per-user check, because
// there is no user in the request to check.
// audit-route-guards: open -- stateless screen of submitted content; reads no record, names no user
app.post('/api/monitor/screen', (req, res) => {
  try {
    res.json(screenContent((req.body || {}).text));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// audit-route-guards: open -- stateless moderation classifier; reads no record, names no user
app.post('/api/moderation/check', (req, res) => {
  try {
    res.json(moderateContent((req.body || {}).text));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/meetup-verifications', actorOrService(requireMeetupParticipant()), (req, res) => {
  try {
    res.status(201).json(requestMeetupVerification(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/meetup-verifications/:id', (req, res) => {
  const v = getMeetupVerification(store, Number(req.params.id));
  if (!v) return res.status(404).json({ error: `no verification with id ${req.params.id}` });
  res.json(v);
});

app.post('/api/meetup-verifications/:id/confirm', actorOrService(requireActor('userId')), (req, res) => {
  try {
    res.json(confirmMeetup(store, { ...req.body, verificationId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/meetup-verifications/:id/both-confirmed', (req, res) => {
  try {
    res.json({ verificationId: Number(req.params.id), bothConfirmed: isBothConfirmed(store, Number(req.params.id)) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/relationship-safety/concerns', requireActor('userId'), (req, res) => {
  try {
    res.status(201).json(logSafetyConcern(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/relationship-safety/concerns/:userId', (req, res) => {
  res.json({ concerns: getSafetyConcerns(store, req.params.userId) });
});

app.post('/api/safety-word', requireActor('userId'), (req, res) => {
  try {
    res.status(201).json(setSafetyWord(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/safety-word/check', actorOrService(requireActor('userId')), (req, res) => {
  try {
    res.json(checkSafetyWord(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/photo-check-ins', actorOrService(requireActor('userId')), (req, res) => {
  try {
    res.status(201).json(schedulePhotoCheckIn(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/photo-check-ins/:id', (req, res) => {
  const record = getPhotoCheckIn(store, Number(req.params.id));
  if (!record) return res.status(404).json({ error: `no photo check-in with id ${req.params.id}` });
  res.json(record);
});

app.post('/api/photo-check-ins/:id/submit', actorOrService(requirePhotoCheckInOwner()), (req, res) => {
  try {
    res.json(submitPhotoCheckIn(store, { ...req.body, photoCheckInId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/photo-check-ins/:id/stop', actorOrService(requirePhotoCheckInOwner()), (req, res) => {
  try {
    res.json(stopPhotoCheckIn(store, { photoCheckInId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/photo-check-ins/check-missed', requireCallingService(), (req, res) => {
  res.json({ resolved: checkMissedPhotoCheckIns(store, req.body || {}) });
});

app.post('/api/fake-calls', actorOrService(requireActor('userId')), (req, res) => {
  try {
    res.status(201).json(scheduleFakeCall(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/fake-calls/:id', (req, res) => {
  const call = getFakeCall(store, Number(req.params.id));
  if (!call) return res.status(404).json({ error: `no fake call with id ${req.params.id}` });
  res.json(call);
});

app.post('/api/fake-calls/:id/cancel', actorOrService(requireFakeCallOwner()), (req, res) => {
  try {
    res.json(cancelFakeCall(store, { fakeCallId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/fake-calls/due/:userId', (req, res) => {
  res.json({ due: getDueFakeCalls(store, { userId: req.params.userId }) });
});

app.post('/api/fake-calls/:id/answer', actorOrService(requireFakeCallOwner()), (req, res) => {
  try {
    res.json(answerFakeCall(store, { fakeCallId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/fake-calls/:id/dismiss', actorOrService(requireFakeCallOwner()), (req, res) => {
  try {
    res.json(dismissFakeCall(store, { fakeCallId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/screen-time/sessions', actorOrService(requireActor('userId')), (req, res) => {
  try {
    res.status(201).json(recordSession(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/screen-time/:userId/daily-total', (req, res) => {
  res.json({ userId: req.params.userId, dailyTotalMinutes: getDailyTotalMinutes(store, req.params.userId) });
});

app.get('/api/screen-time/:userId/today', (req, res) => {
  const checkIn = getScreenTimeCheckIn(store, { userId: req.params.userId });
  if (!checkIn) return res.status(404).json({ error: `no screen-time check-in recorded today for ${req.params.userId}` });
  res.json(checkIn);
});

app.post('/api/screen-time/:userId/dismiss-prompt', actorOrService(requireParamActor('userId')), (req, res) => {
  try {
    res.json(dismissPrompt(store, { userId: req.params.userId }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`VSAFE listening on http://localhost:${PORT}`);
  console.log(`Health check: curl http://localhost:${PORT}/api/health`);
});
