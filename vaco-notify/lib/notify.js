// VACO Notify — the one channel.
//
// **Why this exists.** `dev-docs/COMPLETION_AUDIT.md` §3.5 recorded the
// same gap three times over: VSAFE escalations, DREAMS alerts, and VACO
// Analytics alerts are all *recorded* and **page nobody**.
// `vsafe/lib/safetyCheckIn.js` says it in its own header — the missed
// check-in sweep "returns the real list that a notification layer would
// act on -- no actual SMS/push delivery is built here, that's separate
// infrastructure."
//
// This is that infrastructure. One service, one interface, per-channel
// adapters — the same shape `v4-search` uses for its adapters and
// `void/lib/settlement.js` uses for one settlement path.
//
// ---------------------------------------------------------------
// **The design rule that shapes everything below.**
//
// The rest of this repo draws a line: *fail soft on signals, hard on
// money.* A safety escalation is on neither side of that line, and
// treating it like a signal is how a safety product quietly stops being
// one. So there is a third posture here:
//
//   signal    (DREAMS impressions, analytics metrics)
//             best-effort. A dropped one costs a data point.
//   alert     (analytics anomalies, DREAMS budget exhaustion)
//             retried, and a total failure is recorded.
//   critical  (VSAFE escalation)
//             **must not fail silently.** If every channel fails, the
//             notification is stored as UNDELIVERED and `send` reports
//             failure to its caller, rather than returning a cheerful
//             202 that nobody reads.
//
// A green status page is exactly what stays correct while nobody is
// paged, which is the monitoring version of the money lesson this
// repo's test suites are built on.
//
// ---------------------------------------------------------------
// **Which channels are real.**
//
// `console` and `file` work with no vendor and no account, today.
// `webhook` posts real JSON to a real URL, which means Slack, Discord,
// PagerDuty, and Opsgenie all work right now through their incoming-
// webhook endpoints — no SDK, no key management, no per-vendor code.
//
// SMS, email and voice call are **deliberately not stubbed**. A stub
// that accepts a message and drops it is exactly the failure this
// service was built to end. Requesting one returns a clear error
// naming what is missing, so `sms` fails loudly instead of pretending.
//
// **`webpush`, added 9 Oct 2026, is real and needed no vendor
// account.** That is the one thing that made it buildable where
// `sms`/native `push` (APNs/FCM) are not: APNs needs an Apple developer
// account and a signing certificate, FCM needs a Google Cloud project
// and a service-account key, SMS needs a numbered sender a vendor
// issues — all real, external, paid-or-gated setup this environment
// cannot do on a caller's behalf. Web Push (RFC 8030/8291, the
// `Notification`/`PushManager` browser API) needs only a VAPID keypair,
// which is generated locally with no account and no cost
// (`scripts/generate-vapid-keys.js`). `web-push` (npm, MIT) implements
// the real protocol — ECDH key agreement, HKDF, aes128gcm payload
// encryption, and the VAPID JWT the push service itself checks — so
// this does not hand-roll cryptography; it is a protocol library, not
// a vendor SDK, the same distinction `serviceAuth`'s JWT handling
// draws elsewhere in this ecosystem.
//
// What is still real work for whoever deploys this: `VAPID_PUBLIC_KEY`
// and `VAPID_PRIVATE_KEY` must be set (`npm run generate-vapid-keys`
// prints a pair), and a browser client has to register a service
// worker and call `pushManager.subscribe()` with the public key — this
// module never collects a subscription itself, the same way `webhook`
// never creates the Slack channel it posts to.

const CHANNELS = ['console', 'file', 'webhook', 'webpush'];
// `push` here means NATIVE app push (APNs/FCM) specifically, distinct
// from `webpush` above — a real iOS/Android app push still needs an
// Apple developer account + signing certificate or a Google Cloud
// project + service-account key, neither of which exists for this
// ecosystem and neither of which a library alone can substitute for.
const UNIMPLEMENTED_CHANNELS = ['sms', 'email', 'push', 'voice'];

const SEVERITIES = ['signal', 'alert', 'critical'];

//: Flagged interpretive: no source document specifies retry counts.
//: One attempt for a signal (a dropped impression is a data point),
//: three for anything that claims to page a human. Past three, more
//: retries stop being a delivery strategy and start being a way to
//: avoid recording the failure.
const ATTEMPTS_BY_SEVERITY = { signal: 1, alert: 3, critical: 3 };

const DELIVERY_STATUSES = ['delivered', 'undelivered'];

function severityRank(severity) {
  return SEVERITIES.indexOf(severity);
}

function createNotifyStore() {
  return {
    notifications: [],
    nextNotificationId: 1,
    // name -> { name, channel, target, minSeverity, apps, createdAt }
    subscriptions: [],
    nextSubscriptionId: 1,
  };
}

// A subscription is "who hears about what". Deliberately not a global
// broadcast: a DREAMS budget alert and a VSAFE escalation should not
// land in the same place by default.
function subscribe(store, options = {}) {
  const {
    name, channel, target = null, minSeverity = 'alert', apps = null, now = Date.now(),
  } = options;

  if (!name) throw new Error('subscribe requires a name');
  if (UNIMPLEMENTED_CHANNELS.includes(channel)) {
    throw new Error(
      `subscribe: the "${channel}" channel is not implemented. It needs a vendor `
      + '(credentials, a sending identity, and delivery-receipt handling). Use "webhook" — '
      + 'Slack, Discord, PagerDuty and Opsgenie all accept incoming webhooks today.',
    );
  }
  if (!CHANNELS.includes(channel)) {
    throw new Error(`subscribe: invalid channel "${channel}" (expected one of ${CHANNELS.join(', ')})`);
  }
  if (!SEVERITIES.includes(minSeverity)) {
    throw new Error(`subscribe: invalid minSeverity "${minSeverity}" (expected one of ${SEVERITIES.join(', ')})`);
  }
  if (channel === 'webhook' && !target) {
    throw new Error('subscribe: a webhook subscription requires a target URL');
  }
  if (channel === 'webpush') {
    if (!target || typeof target !== 'object' || !target.endpoint || !target.keys
      || !target.keys.p256dh || !target.keys.auth) {
      throw new Error(
        'subscribe: a webpush subscription requires a target that is a real browser '
        + 'PushSubscription ({ endpoint, keys: { p256dh, auth } }) -- the object '
        + 'pushManager.subscribe() returns, not a URL',
      );
    }
  }
  if (apps !== null && (!Array.isArray(apps) || apps.length === 0)) {
    throw new Error('subscribe: apps must be null (all apps) or a non-empty array');
  }
  if (store.subscriptions.some((s) => s.name === name)) {
    throw new Error(`subscribe: a subscription named "${name}" already exists`);
  }

  const subscription = {
    id: store.nextSubscriptionId++, name, channel, target, minSeverity, apps, createdAt: now,
  };
  store.subscriptions.push(subscription);
  return subscription;
}

function unsubscribe(store, name) {
  const index = store.subscriptions.findIndex((s) => s.name === name);
  if (index === -1) throw new Error(`unsubscribe: no subscription named "${name}"`);
  return store.subscriptions.splice(index, 1)[0];
}

function listSubscriptions(store) {
  return store.subscriptions;
}

// Which subscriptions should hear about this notification.
function matchingSubscriptions(store, { app, severity }) {
  return store.subscriptions.filter((s) => {
    if (severityRank(severity) < severityRank(s.minSeverity)) return false;
    if (s.apps !== null && !s.apps.includes(app)) return false;
    return true;
  });
}

// -- Adapters -------------------------------------------------------------
//
// Each takes (notification, subscription) and either resolves or
// throws. Nothing here swallows an error: a channel that cannot deliver
// must say so, because `send` below counts on that to decide whether a
// critical notification was actually delivered.

function consoleAdapter(notification) {
  const line = `[vaco-notify] ${notification.severity.toUpperCase()} ${notification.app}: ${notification.title}`;
  // eslint-disable-next-line no-console -- this adapter IS the console
  console.log(line, notification.body ? `\n  ${notification.body}` : '');
  return { channel: 'console' };
}

function makeFileAdapter(fs, path) {
  return (notification, subscription) => {
    const target = subscription.target || path.join(__dirname, '..', 'data', 'notifications.log');
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.appendFileSync(target, `${JSON.stringify(notification)}\n`);
    return { channel: 'file', target };
  };
}

function makeWebhookAdapter(fetchFn) {
  return async (notification, subscription) => {
    const res = await fetchFn(subscription.target, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // `text` is what Slack and Discord render; the structured fields
      // sit alongside it so a real handler can route on them without
      // parsing a sentence.
      body: JSON.stringify({
        text: `[${notification.severity.toUpperCase()}] ${notification.app}: ${notification.title}`
          + (notification.body ? `\n${notification.body}` : ''),
        severity: notification.severity,
        app: notification.app,
        title: notification.title,
        notificationBody: notification.body,
        context: notification.context,
        notificationId: notification.id,
      }),
    });
    if (!res.ok) throw new Error(`webhook returned ${res.status}`);
    return { channel: 'webhook', target: subscription.target, status: res.status };
  };
}

// The real RFC 8030/8291 protocol (ECDH + HKDF + aes128gcm, VAPID JWT
// auth), via `web-push` -- not a vendor SDK, a protocol library. Fails
// loudly rather than stubbing when no VAPID key pair is configured,
// the same rule every other real-but-unconfigured path in this
// ecosystem follows (`settleVCoin` with no service token, VASH TAP
// with no payer account): a channel that silently drops a message is
// worse than one that says why it can't send.
function makeWebPushAdapter(webpush, vapidDetails) {
  const configured = Boolean(vapidDetails && vapidDetails.publicKey && vapidDetails.privateKey);
  if (configured) {
    webpush.setVapidDetails(vapidDetails.subject, vapidDetails.publicKey, vapidDetails.privateKey);
  }
  return async (notification, subscription) => {
    if (!configured) {
      throw new Error(
        'webpush: no VAPID key pair configured -- set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY '
        + '(run `npm run generate-vapid-keys` to create one)',
      );
    }
    const payload = JSON.stringify({
      title: `${notification.app}: ${notification.title}`,
      body: notification.body,
      severity: notification.severity,
      app: notification.app,
      notificationId: notification.id,
    });
    const result = await webpush.sendNotification(subscription.target, payload);
    return { channel: 'webpush', statusCode: result.statusCode };
  };
}

function createAdapters(deps = {}) {
  const fs = deps.fs || require('fs');
  const path = deps.path || require('path');
  const fetchFn = deps.fetchFn || globalThis.fetch;
  const webpush = deps.webpush || require('web-push');
  const vapidDetails = deps.vapidDetails || {
    subject: process.env.VAPID_SUBJECT || 'mailto:admin@vaco.example',
    publicKey: process.env.VAPID_PUBLIC_KEY || null,
    privateKey: process.env.VAPID_PRIVATE_KEY || null,
  };
  return {
    console: consoleAdapter,
    file: makeFileAdapter(fs, path),
    webhook: makeWebhookAdapter(fetchFn),
    webpush: makeWebPushAdapter(webpush, vapidDetails),
  };
}

// -- Sending ---------------------------------------------------------------

async function attemptDelivery(adapter, notification, subscription, attempts) {
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      // eslint-disable-next-line no-await-in-loop -- retries are sequential by definition
      const result = await adapter(notification, subscription);
      return { ok: true, attempts: attempt, result };
    } catch (err) {
      lastError = err;
    }
  }
  return { ok: false, attempts, error: lastError ? lastError.message : 'unknown' };
}

// The one entry point. Returns the stored notification, including
// per-subscription delivery results and an overall status.
//
// **`status` is the honest part.** It is `delivered` only if at least
// one subscription actually took it. A critical notification with no
// matching subscription is `undelivered` — not "nothing to do", because
// "nobody was configured to hear this" and "this was heard" are
// different facts and only one of them is safe.
async function send(store, options = {}) {
  const {
    app, severity = 'alert', title, body = null, context = {},
    adapters = createAdapters(), now = Date.now(),
  } = options;

  if (!app) throw new Error('send requires an app');
  if (!title) throw new Error('send requires a title');
  if (!SEVERITIES.includes(severity)) {
    throw new Error(`send: invalid severity "${severity}" (expected one of ${SEVERITIES.join(', ')})`);
  }

  const notification = {
    id: store.nextNotificationId++,
    app, severity, title, body, context,
    createdAt: now,
    status: 'undelivered',
    deliveries: [],
  };

  const subscriptions = matchingSubscriptions(store, { app, severity });
  const attempts = ATTEMPTS_BY_SEVERITY[severity];

  for (const subscription of subscriptions) {
    const adapter = adapters[subscription.channel];
    if (!adapter) {
      notification.deliveries.push({
        subscription: subscription.name, channel: subscription.channel,
        ok: false, error: `no adapter for channel "${subscription.channel}"`,
      });
      continue;
    }
    // eslint-disable-next-line no-await-in-loop -- one subscriber at a time,
    // so a slow webhook cannot hide a fast failure elsewhere
    const outcome = await attemptDelivery(adapter, notification, subscription, attempts);
    notification.deliveries.push({
      subscription: subscription.name, channel: subscription.channel, ...outcome,
    });
  }

  notification.status = notification.deliveries.some((d) => d.ok) ? 'delivered' : 'undelivered';
  store.notifications.push(notification);
  return notification;
}

function getNotification(store, id) {
  return store.notifications.find((n) => n.id === id) || null;
}

// The query that matters operationally: what claimed to page a human
// and did not. If this is ever non-empty, the safety product is not
// keeping its promise, and that must be visible without reading a log.
function listUndelivered(store, options = {}) {
  const { minSeverity = 'alert' } = options;
  return store.notifications.filter(
    (n) => n.status === 'undelivered' && severityRank(n.severity) >= severityRank(minSeverity),
  );
}

function listNotifications(store, options = {}) {
  const { app = null, severity = null, limit = 100 } = options;
  return store.notifications
    .filter((n) => (app ? n.app === app : true))
    .filter((n) => (severity ? n.severity === severity : true))
    .slice(-limit)
    .reverse();
}

module.exports = {
  CHANNELS,
  UNIMPLEMENTED_CHANNELS,
  SEVERITIES,
  DELIVERY_STATUSES,
  ATTEMPTS_BY_SEVERITY,
  createNotifyStore,
  createAdapters,
  subscribe,
  unsubscribe,
  listSubscriptions,
  matchingSubscriptions,
  send,
  getNotification,
  listNotifications,
  listUndelivered,
};
