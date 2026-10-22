// Vaco Assistant -- the personal AI assistant every signed-in VACO
// user gets, extracted out of vaco-shell into its own app on 15 Oct
// 2026 by direct decision.
//
// **Why it moved.** It was built into vaco-shell first because that
// was the only confirmed consumer. The whole point of a personal AI
// that "connects to all of Vaco's and Vacon's AI system" is that it
// has to be reachable from more than one dashboard -- so this app sits
// next to VACON and v4-proxy, the same way VACA and Shield sit next to
// V3: a real service other apps call over HTTP, not a feature bolted
// onto one surface. vaco-shell is its first caller now, not its only
// one -- see README.md for how another app reaches it.
//
// Run:
//   npm install
//   npm start
//
// Test:
//   curl http://localhost:8828/api/health

const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv/config');

const { createPersistentStore, durable } = require('./lib/persistence');
const { createVacoAssistantStore } = require('./lib/store');
const {
  TONE_OPTIONS, setProfile, getProfile, getHistory, sendMessage,
} = require('./lib/personalAssistant');
const {
  placeAssistantCall, getAssistantCall, listAssistantCalls,
  declineAssistantCall, recordAssistantCallEvent, endAssistantCall,
} = require('./lib/assistantCall');
const {
  GOAL_STATUSES, CONNECTOR_REQUIRED_KINDS,
  createGoal, getGoal, listGoals, completeGoal, cancelGoal,
  addSubscription, listSubscriptions, requestCancellation,
  createReminder, acknowledgeReminder, dueReminders, proactiveSuggestions,
} = require('./lib/assistantTasks');
const { requireActor, requireParamActor, requireSession } = require('./lib/shieldAuth.cjs');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 8828;
const store = createPersistentStore(path.join(__dirname, 'data', 'store.json'), createVacoAssistantStore);

// Commits to disk before responding on every 2xx mutating request. Not
// optional: without it an acknowledged write can be lost to a `kill -9`
// inside the debounce window -- see lib/persistence.js.
app.use(durable(store));

// Every route here funnels its errors through this so a bad request
// reads as a 400 with the module's own message rather than a stack.
function handle(res, fn, successStatus = 200) {
  return Promise.resolve()
    .then(fn)
    .then((body) => res.status(successStatus).json(body))
    .catch((err) => res.status(400).json({ error: err.message }));
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'vaco-assistant',
    tones: TONE_OPTIONS,
    profiles: store.assistantProfiles.length,
    messages: store.assistantMessages.length,
    goalStatuses: GOAL_STATUSES,
    // Named plainly in health, not hidden: every one of these is a
    // real connector-required task kind this environment cannot
    // actually execute yet. See lib/assistantTasks.js's own header.
    connectorRequiredKinds: CONNECTOR_REQUIRED_KINDS,
  });
});

app.get('/api/assistant/tones', (_req, res) => {
  res.json({ tones: TONE_OPTIONS });
});

// `requireParamActor` -- proves a live Shield session AND that it
// belongs to the `:userId` this route names. A profile or a chat
// history is personal; nobody else's session should be able to read
// it. See dev-docs/AUTH_HARDENING.md.
app.get('/api/assistant/profile/:userId', requireParamActor('userId'), (req, res) => {
  res.json(getProfile(store, req.params.userId));
});

app.post('/api/assistant/profile', requireActor('userId'), (req, res) => handle(
  res, () => setProfile(store, req.body || {}),
));

app.get('/api/assistant/history/:userId', requireParamActor('userId'), (req, res) => {
  res.json({ messages: getHistory(store, req.params.userId) });
});

app.post('/api/assistant/chat', requireActor('userId'), (req, res) => handle(
  res, () => sendMessage(store, req.body || {}), 201,
));

// -- FaceTime-style calls with your own assistant ---------------------
//
// V4's own call state lives in V4, not here -- this app holds no
// `store.calls` of its own. A call's `:id` names no user in the path
// or body the way profile/history do, so the ownership check reads
// the real call back from V4 first and compares its `userId` against
// this session, the same shape V4's own `requireCallParty` takes for
// the same reason (stated in v4-proxy/server.js: three honest copies
// beat one abstraction that fits none of them -- this is the fourth,
// because here the record lives in a different app's store).
async function requireOwnCall(req, res, next) {
  let call;
  try {
    call = await getAssistantCall(req.params.id);
  } catch (err) {
    return res.status(err.status || 502).json({ error: err.message });
  }
  if (call.userId !== req.sessionUserId) {
    return res.status(403).json({ error: 'requireOwnCall: this session is not the party on that call' });
  }
  req.assistantCall = call;
  return next();
}

// Same real shape as `requireOwnCall` just above -- a goal/
// subscription/reminder id in the path names a record, not a user,
// so ownership is checked against the record's own stored `userId`
// rather than asking `requireParamActor` to check something the path
// never names.
function requireOwnGoal(req, res, next) {
  const goal = getGoal(store, Number(req.params.id));
  if (!goal) return res.status(404).json({ error: `no goal with id ${req.params.id}` });
  if (goal.userId !== req.sessionUserId) {
    return res.status(403).json({ error: 'requireOwnGoal: this session does not own that goal' });
  }
  req.assistantGoal = goal;
  return next();
}

function requireOwnSubscription(req, res, next) {
  const subscription = listSubscriptions(store, req.sessionUserId).find((s) => s.id === Number(req.params.id));
  if (!subscription) return res.status(404).json({ error: `no subscription with id ${req.params.id} owned by this session` });
  req.assistantSubscription = subscription;
  return next();
}

function requireOwnReminder(req, res, next) {
  const reminder = (store.assistantReminders || []).find((r) => r.id === Number(req.params.id));
  if (!reminder) return res.status(404).json({ error: `no reminder with id ${req.params.id}` });
  if (reminder.userId !== req.sessionUserId) {
    return res.status(403).json({ error: 'requireOwnReminder: this session does not own that reminder' });
  }
  req.assistantReminder = reminder;
  return next();
}

app.post('/api/assistant/calls', requireActor('userId'), (req, res) => handle(
  res, () => placeAssistantCall(req.body.userId, req.body || {}), 201,
));

app.get('/api/assistant/calls', requireSession(), (req, res) => handle(
  res, () => listAssistantCalls(req.sessionUserId),
));

app.get('/api/assistant/calls/:id', requireSession(), requireOwnCall, (req, res) => {
  res.json(req.assistantCall);
});

app.post('/api/assistant/calls/:id/decline', requireSession(), requireOwnCall, (req, res) => handle(
  res, () => declineAssistantCall(req.params.id),
));

app.post('/api/assistant/calls/:id/events', requireSession(), requireOwnCall, (req, res) => handle(
  res, () => recordAssistantCallEvent(req.params.id, (req.body || {}).event),
));

app.post('/api/assistant/calls/:id/end', requireSession(), requireOwnCall, (req, res) => handle(
  res, () => endAssistantCall(req.params.id),
));

// -- Goals, subscriptions, reminders -- the real Muse-style task layer --
//
// See lib/assistantTasks.js's own header for what is real here and
// what explicitly is not (anything needing a real external connector
// -- a bank, a card issuer, a booking system -- stays
// `blocked-no-connector`, never faked as completed). These normally
// reach a user through `/api/assistant/chat`'s own connector
// interception; the routes below exist for a client that wants its
// own task list UI rather than only a chat transcript.
app.get('/api/assistant/goals/:userId', requireParamActor('userId'), (req, res) => {
  res.json({ goals: listGoals(store, req.params.userId) });
});

app.post('/api/assistant/goals', requireActor('userId'), (req, res) => handle(
  res, () => createGoal(store, req.body || {}), 201,
));

app.post('/api/assistant/goals/:id/complete', requireSession(), requireOwnGoal, (req, res) => handle(
  res, () => completeGoal(store, { goalId: req.assistantGoal.id }),
));

app.post('/api/assistant/goals/:id/cancel', requireSession(), requireOwnGoal, (req, res) => handle(
  res, () => cancelGoal(store, { goalId: req.assistantGoal.id }),
));

app.get('/api/assistant/subscriptions/:userId', requireParamActor('userId'), (req, res) => {
  res.json({ subscriptions: listSubscriptions(store, req.params.userId) });
});

app.post('/api/assistant/subscriptions', requireActor('userId'), (req, res) => handle(
  res, () => addSubscription(store, req.body || {}), 201,
));

app.post('/api/assistant/subscriptions/:id/request-cancellation', requireSession(), requireOwnSubscription, (req, res) => handle(
  res, () => requestCancellation(store, { subscriptionId: req.assistantSubscription.id }),
));

app.post('/api/assistant/reminders', requireActor('userId'), (req, res) => handle(
  res, () => createReminder(store, req.body || {}), 201,
));

app.get('/api/assistant/reminders/:userId/due', requireParamActor('userId'), (req, res) => {
  res.json({ reminders: dueReminders(store, req.params.userId) });
});

app.post('/api/assistant/reminders/:id/acknowledge', requireSession(), requireOwnReminder, (req, res) => handle(
  res, () => acknowledgeReminder(store, req.assistantReminder.id),
));

app.get('/api/assistant/suggestions/:userId', requireParamActor('userId'), (req, res) => {
  res.json({ suggestions: proactiveSuggestions(store, req.params.userId) });
});

app.listen(PORT, () => {
  console.log(`Vaco Assistant listening on http://localhost:${PORT}`);
  console.log(`Health check: curl http://localhost:${PORT}/api/health`);
});
