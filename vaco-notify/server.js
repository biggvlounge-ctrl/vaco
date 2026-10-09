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

const { attachStore } = require('./lib/storeBackend');
const { commit: commitFile } = require('./lib/persistence');
const { commit: commitPg } = require('./lib/persistencePg');
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
// -- The store, and which backend holds it ----------------------------
//
// `let`, not `const`: with DATABASE_URL set this app's store lives in
// Postgres, which cannot be built synchronously. `attachStore` mounts a
// gate ahead of the routes so no request runs before the store has
// loaded, and installs the commit-before-responding hook that
// `app.use(durable(store))` used to provide.
//
// **The first-boot seed moved in here, and it had to.** It ran at module
// level, which now means it would run against the empty placeholder --
// seeding a store nothing ever reads, and leaving the real one unseeded
// forever. Route handlers are safe because they read the `store` binding
// when a request arrives; anything running at module level is not.
let store = createNotifyStore();
attachStore(app, {
  appKey: 'vaco-notify',
  createDefault: createNotifyStore,
  filePath: path.join(__dirname, 'data', 'store.json'),
  onReady: (loaded) => {
    store = loaded;
    if (store.subscriptions.length === 0) {
      subscribe(store, {
        name: 'default-console',
        channel: 'console',
        minSeverity: 'alert',
      });
    }
  },
});

// Seed a console subscription on first boot, deliberately.
//
// A notification service with no subscribers is indistinguishable from
// no notification service — every escalation would be recorded
// `undelivered` and the operator would think the wiring was broken. A
// console subscriber at `alert` means the default install genuinely
// delivers somewhere a person can see, and it is the honest floor:
// stdout is a real destination in a container with log collection.

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

// What a browser needs before it can ever create a webpush
// subscription -- `pushManager.subscribe({ applicationServerKey })`
// takes the PUBLIC half only. No session or service credential: the
// public key is not a secret, the same way a webhook's target URL is
// the secret half of that channel and the channel NAME is not.
app.get('/api/webpush/public-key', (_req, res) => {
  const publicKey = process.env.VAPID_PUBLIC_KEY || null;
  if (!publicKey) {
    return res.status(503).json({ error: 'webpush is not configured on this deployment (no VAPID_PUBLIC_KEY)' });
  }
  res.json({ publicKey });
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
    // **Committed explicitly, not left to the generic durable() hook.**
    // That hook (mounted by attachStore) only flushes synchronously on
    // a 2xx response -- the right default everywhere else, where a
    // non-2xx means nothing was written. Here it means the opposite:
    // `send()` already pushed the real notification record regardless
    // of delivery outcome, and this route deliberately answers 500 for
    // an *undelivered* one so a caller can tell delivery failed. Left
    // to the generic hook, that exact record -- an alert nobody was
    // paged for, the one case `GET /api/health`'s undeliveredAlerts
    // exists to surface -- would fall back to the ordinary 200ms
    // debounce, and a crash in that window would lose it: a restart
    // with `undeliveredAlerts` back to looking clean, which is the
    // precise "green status page while nobody was paged" failure this
    // service exists to prevent. Forced here regardless of outcome, the
    // same way a successful transfer elsewhere is flushed before its
    // 2xx. Exactly one of commitFile/commitPg owns `store`; the other
    // is a documented no-op.
    await commitPg(store);
    commitFile(store);
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
