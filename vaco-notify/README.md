# VACO Notify

The one notification channel in the VACO ecosystem. `dev-docs/COMPLETION_AUDIT.md`
recorded the same gap three times over: VSAFE escalations, DREAMS
alerts, and VACO Analytics alerts are all *recorded* and **page
nobody**. `vsafe/lib/safetyCheckIn.js`'s own header says its missed
check-in sweep "returns the real list that a notification layer would
act on -- no actual SMS/push delivery is built here, that's separate
infrastructure." This app is that infrastructure: one service, one
interface, per-channel adapters, called service-to-service by VSAFE,
DREAMS, VACO Analytics and anyone else that needs to page a human.

No prior source doc beyond that audit line exists for this app; it was
built directly from the gap description. There is no separate design
doc here, so the code and this README are the source of truth.

## The design rule

Severity shapes everything: `signal` (best-effort, a dropped one costs
a data point), `alert` (retried, and a total failure is recorded), and
`critical` (**must not fail silently** -- if every channel fails, the
notification is stored `undelivered` and the caller is told, rather
than getting a cheerful 202 nobody reads). A green status page is
exactly what stays correct while nobody is paged, and `undeliveredAlerts`
on `GET /api/health` exists specifically to make that fact visible
instead of silent.

Channels today: `console` and `file` (no vendor, work out of the box),
`webhook` (real JSON POST -- Slack, Discord, PagerDuty, Opsgenie all
accept this as-is), and `webpush` (real RFC 8030/8291 web push via the
`web-push` library, needing only a local VAPID keypair). `sms`,
`email`, native `push` (APNs/FCM), and `voice` are named but
**deliberately not stubbed** -- subscribing to one is refused outright
rather than silently accepted and dropped, because a stub that accepts
a message and drops it is exactly the bug this service exists to end.

## Run

```
cd vaco-notify && npm install && npm start   # localhost:8818
curl http://localhost:8818/api/health
```

`npm run generate-vapid-keys` prints a VAPID keypair for the `webpush`
channel (`VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`); without it, webpush
subscribing is refused with a clear error rather than pretending to
work. With `DATABASE_URL` set, the store lives in Postgres
(`lib/persistencePg.js`); otherwise it persists to `data/store.json`.

## Test

```
npm test
```

`test/notify.test.js` proves the actual gap this service closes: a
critical escalation with no matching subscriber is reported
`undelivered`, not a cheerful 202; a channel that throws is never
swallowed into a success; a severity floor or app filter is actually
enforced. `test/durability.test.js` spawns the real server to prove an
undelivered write survives a crash in the same way a delivered one
does.

## Routes

- `GET /api/health` -- channels, severities, retry policy, and the
  undelivered-alert count, reads unauthenticated.
- `GET /api/webpush/public-key` -- the VAPID public half a browser
  needs before it can call `pushManager.subscribe()`.
- `POST /api/notify` -- the one ingest path every app posts alerts to.
  Service-to-service only (`serviceAuth`, no end-user session); 202
  when it landed somewhere, 500 when nothing took it.
- `GET /api/notifications`, `GET /api/notifications/:id`,
  `GET /api/notifications/undelivered` -- read the notification log.
- `GET /api/subscriptions`, `POST /api/subscriptions`,
  `DELETE /api/subscriptions/:name` -- who hears what. The writes are
  gated by `requireOperator` (a real `vaco-operator` credential via
  `X-Operator-Credential`), because changing who gets paged is an
  administrative act, not a signal.

## Frontend coverage pass (31 Oct 2026)

An audit found `public/index.html` making real calls against only 4 of
this app's 9 routes -- the original 3 tabs (Status, Sent,
Subscriptions) covered health, the notification log, and *adding* a
subscription, but three real routes had **zero** frontend exposure,
and the one write route that *was* wired was silently broken. Every
field below was checked against the real route handler and its
`lib/notify.js` function, and every payload shape was verified against
a live server before being written.

- **Undelivered tab** -- `GET /api/notifications/undelivered` had no
  frontend at all; the Status tab only ever showed the *count*
  (`health.undeliveredAlerts`). New tab lists the real notifications
  behind that number, filterable by `minSeverity`, with why each one
  failed (no matching subscription vs. every channel attempted and
  failed).
- **Subscriptions tab, operator credential fixed** -- the existing
  Subscribe form sent an `operatorId` field in the POST body;
  `subscribe()` in `lib/notify.js` never reads that field, and
  `requireOperator` checks a header
  (`X-Operator-Credential`), not the body -- so the form 401'd against
  any deployment actually running `VACO_OPERATOR_MODE=enforce` (the
  default). Replaced with a credential field that is sent as the real
  header on every write, mirroring the pattern `cvnvo/yap`'s Moderate
  tab already established for this exact situation.
- **Unsubscribe** -- `DELETE /api/subscriptions/:name` had no frontend
  at all. Each row in the subscriptions table now has a Remove button,
  gated behind the same operator credential, with a confirm prompt
  since it immediately stops an on-call channel from hearing about new
  alerts.
- **Browser push (webpush)** -- the entire `webpush` channel, plus
  `GET /api/webpush/public-key`, had zero frontend presence; it was a
  real, tested backend capability nothing could reach from a browser.
  New card in the Subscriptions tab reads the deployment's VAPID public
  key, registers a new `public/sw.js` service worker, subscribes this
  browser through the real `PushManager` API, and POSTs the resulting
  `PushSubscription` straight to `/api/subscriptions` as `target` --
  the exact `{ endpoint, keys: { p256dh, auth } }` shape `subscribe()`
  validates. Falls back to a clear "not configured" or "not supported"
  message rather than pretending the channel works.

**Deliberately left for a follow-up round:** a per-notification detail
view for `GET /api/notifications/:id`. The Sent tab's list already
renders every field that route would show (title, body, app, time,
per-subscription delivery results) except the free-form `context`
object a caller attached; a dedicated detail page would be a thin
wrapper around data already on screen, so it was not worth the tab
slot in this pass. If a future caller starts attaching meaningful
`context` payloads worth inspecting on their own, that is the trigger
to build it.
