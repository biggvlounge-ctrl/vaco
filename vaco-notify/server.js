// VACO Notify — the one notification channel.
//
// Closes a gap `dev-docs/COMPLETION_AUDIT.md` recorded three times:
// VSAFE escalations, DREAMS alerts and VACO Analytics alerts all record
// and page nobody. VSAFE's own `safetyCheckIn.js` header says the
// missed-check-in sweep returns a list "that a notification layer would
// act on -- no actual SMS/push delivery is built here, that's separate
// infrastructure." This is that layer.
//
// Run:
//   npm install
//   npm start
//
// Test:
//   curl http://localhost:8818/api/health

const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv/config');

const { createPersistentStore, durable } = require('./lib/persistence');
const {
  CHANNELS, UNIMPLEMENTED_CHANNELS, SEVERITIES, ATTEMPTS_BY_SEVERITY,
  createNotifyStore, subscribe, unsubscribe, listSubscriptions,
  send, getNotification, listNotifications, listUndelivered,
} = require('./lib/notify');
const { requireActor } = require('./lib/shieldAuth.cjs');

const { createServiceAuth } = require('./lib/serviceAuth.cjs');
const { createOperatorAuth } = require('./lib/operatorAuth.cjs');
const { traceMiddleware } = require('./lib/tracing.cjs');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Trace context, mounted before any auth middleware: a request that is
// *refused* still carries a trace id, and a 401 you cannot correlate is
// exactly the one you want to correlate.
app.use(traceMiddleware());


// -- Trusted-service allowlist ------------------------------------------
//
// This is the one channel. An outsider able to POST here can bury a real
// VSAFE escalation under noise, which defeats the service by using it.
//
// `ROUTE_AUTHORIZATION_AUDIT.md` §3B: this app accepts writes from other
// apps with no end-user session to present, and until now accepted them
// from anyone. `serviceAuth` is the same mechanism V3 has used and
// proven -- per-service tokens, constant-time compare -- generalised
// out of V3 because it was never V3-specific.
//
// Reads are not gated; this stops unauthorized WRITES.
const serviceAuth = createServiceAuth();
app.use(serviceAuth.middleware);

const operatorAuth = createOperatorAuth();
const { requireOperator } = operatorAuth;

app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 8818;
const store = createPersistentStore(path.join(__dirname, 'data', 'store.json'), createNotifyStore);
app.use(durable(store));

// Seed a console subscription on first boot, deliberately.
//
// A notification service with no subscribers is indistinguishable from
// no notification service — every escalation would be recorded
// `undelivered` and the operator would think the wiring was broken. A
// console subscriber at `alert` means the default install genuinely
// delivers somewhere a person can see, and it is the honest floor:
// stdout is a real destination in a container with log collection.
if (store.subscriptions.length === 0) {
  subscribe(store, {
    name: 'default-console',
    channel: 'console',
    minSeverity: 'alert',
  });
}

app.get('/api/health', (_req, res) => {
  const undelivered = listUndelivered(store, { minSeverity: 'alert' });
  res.json({
    ok: true,
    service: 'vaco-notify',
    channels: CHANNELS,
    unimplementedChannels: UNIMPLEMENTED_CHANNELS,
    severities: SEVERITIES,
    attemptsBySeverity: ATTEMPTS_BY_SEVERITY,
    subscriptions: store.subscriptions.length,
    notifications: store.notifications.length,
    // Surfaced on health on purpose. An alert that claimed to page a
    // human and did not is an operational fact, not a log line — the
    // same reason V3 reports its own serviceAuth posture here.
    undeliveredAlerts: undelivered.length,
    oldestUndelivered: undelivered.length > 0 ? undelivered[0].createdAt : null,
  });
});

// Sending is service-to-service: VSAFE, DREAMS and Analytics call it
// with no end-user session. It is deliberately NOT behind requireActor
// — there is no acting user — but it is also not a route a browser
// should reach, so the deploy layer keeps 8818 off the public listener.
// Recorded here rather than assumed: see deploy/nginx-docker.conf.
// audit-route-guards: open -- the ingest path every app posts alerts to; app-level service credential is the right and only check
app.post('/api/notify', async (req, res) => {
  try {
    const notification = await send(store, req.body || {});
    // 202 when it landed somewhere, 500 when nothing took it. A
    // caller escalating a safety event needs to be able to tell those
    // apart, and a uniform 202 is exactly the lie this service exists
    // to stop telling.
    res.status(notification.status === 'delivered' ? 202 : 500).json(notification);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/notifications', (req, res) => {
  res.json({
    notifications: listNotifications(store, {
      app: req.query.app || null,
      severity: req.query.severity || null,
      limit: Number(req.query.limit) || 100,
    }),
  });
});

app.get('/api/notifications/undelivered', (req, res) => {
  res.json({ undelivered: listUndelivered(store, { minSeverity: req.query.minSeverity || 'alert' }) });
});

app.get('/api/notifications/:id', (req, res) => {
  const notification = getNotification(store, Number(req.params.id));
  if (!notification) return res.status(404).json({ error: `no notification with id ${req.params.id}` });
  res.json(notification);
});

app.get('/api/subscriptions', (_req, res) => {
  res.json({ subscriptions: listSubscriptions(store) });
});

// Changing who gets paged is an administrative act, so it takes a real
// session tied to the operator making the change.
app.post('/api/subscriptions', requireOperator('vaco-notify:subscribe'), (req, res) => {
  try {
    res.status(201).json(subscribe(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/subscriptions/:name', requireOperator('vaco-notify:subscribe'), (req, res) => {
  try {
    res.json(unsubscribe(store, req.params.name));
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`VACO Notify listening on http://localhost:${PORT}`);
  console.log(`Health check: curl http://localhost:${PORT}/api/health`);
});
