// VACO Analytics — the unified management dashboard's API layer.
// Source of truth: VACO_ANALYTICS_MANAGEMENT_DASHBOARD.md.
//
// Run:
//   npm install
//   npm start
//
// Test:
//   curl -X POST http://localhost:8790/api/metrics/ingest \
//     -H "Content-Type: application/json" \
//     -d '{"app":"DREAMS","metric":"screen_revenue","value":42.5}'
//   curl http://localhost:8790/api/dashboard
//
// Wallboard (always-on live view, polls /api/dashboard every 5s):
//   open http://localhost:8790/wallboard.html

import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import "dotenv/config";
import {
  createMetricsStore,
  ingestMetric,
  getMetrics,
  getSummary,
  getApps,
  getEcosystemSnapshot,
} from "./metricsStore.js";
import { evaluateMetric, getAlerts } from "./intelligence.js";
import { createPersistentStore } from "./persistence.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

import { createServiceAuth } from "./lib/serviceAuth.cjs";
import shieldAuth from "./lib/shieldAuth.cjs";

const { requireCallingService } = shieldAuth;
import tracingModule from './lib/tracing.cjs';
const { traceMiddleware } = tracingModule;

const app = express();
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Trace context, mounted before any auth middleware: a request that is
// *refused* still carries a trace id, and a 401 you cannot correlate is
// exactly the one you want to correlate.
app.use(traceMiddleware());


// -- Trusted-service allowlist ------------------------------------------
//
// Every app POSTs metrics here. Unauthenticated ingest means anyone can
// poison the baseline an anomaly detector is measured against -- and a
// poisoned baseline hides the anomaly rather than raising it.
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

app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 8790;
const store = createPersistentStore(path.join(__dirname, "data", "store.json"), createMetricsStore);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, apps: getApps(store) });
});

// **"From services" is now enforced, not just asserted.** This carried
// an `audit-route-guards: open` marker whose reason was "telemetry
// ingest from services; no human principal exists" — true as a
// description of intent, but nothing held callers to it. The app-level
// `serviceAuth` accepts a user session OR a service credential, so any
// bearer token could write telemetry, and the header block above says
// exactly why that matters: a poisoned baseline hides the anomaly
// rather than raising it.
//
// Every real caller already sends `serviceHeaders()` — checked across
// all seven pushMetric implementations — so requiring what the reason
// already claimed costs nothing and closes the gap.
app.post("/api/metrics/ingest", requireCallingService(), (req, res) => {
  const { app: appId, metric, value, timestamp } = req.body || {};
  try {
    const event = ingestMetric(store, { app: appId, metric, value, timestamp });
    res.status(201).json(event);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get("/api/metrics/:app", (req, res) => {
  const { app: appId } = req.params;
  const { metric, limit } = req.query;
  const parsedLimit = limit !== undefined ? Number(limit) : undefined;
  if (limit !== undefined && (!Number.isFinite(parsedLimit) || parsedLimit <= 0)) {
    return res.status(400).json({ error: "'limit' must be a positive number." });
  }
  try {
    const events = getMetrics(store, appId, metric, parsedLimit ? { limit: parsedLimit } : {});
    res.json({ app: appId, metric: metric || null, events });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get("/api/metrics/:app/summary", (req, res) => {
  const { app: appId } = req.params;
  const { metric } = req.query;
  if (!metric) {
    return res.status(400).json({ error: "'metric' query parameter is required." });
  }
  res.json(getSummary(store, appId, metric));
});

app.get("/api/dashboard", (_req, res) => {
  res.json({ apps: getEcosystemSnapshot(store), generatedAt: Date.now() });
});

// Proactive Ecosystem Intelligence Layer (Phase 3): runs the Pattern
// Learning + Notification & Response agents against an app/metric's
// existing telemetry (the Data Collection Agent is just store.events
// from above -- no separate ingestion path).

// -- Alert delivery -----------------------------------------------------
//
// `evaluateMetric` detects an anomaly, pushes it to `store.alerts`, and
// returns. Until now that was the end of it: `GET /api/intelligence/alerts`
// would show you the anomaly if you thought to look, which is the exact
// shape of the gap COMPLETION_AUDIT recorded three times over — recorded,
// and nobody paged.
//
// **Fails soft, deliberately.** Unlike VSAFE's escalation, which reports
// its own delivery failure because the product promise is that somebody
// finds out, a missed analytics alert is a signal. Holding up the
// evaluation because a webhook is slow would be the wrong trade.
//
// Severity is `alert`, never `critical`. Critical is reserved for safety;
// an anomaly detector that pages at the same level as a missed safety
// check-in trains people to ignore both.
const VACO_NOTIFY_URL = process.env.VACO_NOTIFY_URL || "http://localhost:8818";

// Internal services (V3, VACA, Analytics, Notify, VACON) refuse an
// unauthenticated mutating call. This app calls them server-to-server
// with no end-user session, so it presents a service credential. See
// shared/serviceAuth.js.
const VACO_SERVICE_NAME = process.env.VACO_SERVICE_NAME || 'vaco-analytics';
const VACO_SERVICE_TOKEN = process.env.VACO_SERVICE_TOKEN || '';
function serviceHeaders() {
  return VACO_SERVICE_TOKEN
    ? { 'X-Service-Name': VACO_SERVICE_NAME, 'X-Service-Token': VACO_SERVICE_TOKEN }
    : {};
}


async function notifyAnomaly(result) {
  try {
    const direction = result.zScore > 0 ? "above" : "below";
    await fetch(`${VACO_NOTIFY_URL}/api/notify`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...serviceHeaders(), },
      body: JSON.stringify({
        app: "vaco-analytics",
        severity: "alert",
        title: `${result.app}: ${result.metric} is anomalous`,
        body: `Latest value ${result.value} is ${Math.abs(result.zScore).toFixed(1)} standard `
          + `deviations ${direction} a baseline of ${result.baseline.mean.toFixed(2)}.`,
        // The routing category is what a responder needs to know who
        // owns this, and it is already computed — carrying it costs
        // nothing and turns "a number moved" into an assignment.
        context: {
          alertId: result.id,
          sourceApp: result.app,
          metric: result.metric,
          value: result.value,
          zScore: result.zScore,
          baseline: result.baseline,
          routedTo: result.routedTo,
        },
      }),
    });
  } catch {
    // Honest no-op. vaco-notify tracks its own undelivered count; an
    // anomaly evaluation is not the place to surface a channel outage.
  }
}

// **Not stateless, and it was declared as if it were.** This carried
// `audit-route-guards: open -- stateless evaluation over posted
// metrics; writes no record`, and both halves of that were false:
// `evaluateMetric` does `store.alerts.push(result)` and
// `store.nextAlertId++` on every anomaly, `durable(store)` commits it,
// and the handler then pages a responder through vaco-notify.
//
// The app-level `serviceAuth` middleware kept anonymous callers out
// (verified: no credential answers 401), but it only proves *some*
// credential is present — an unvalidated `Authorization: Bearer
// anything` satisfies it, because identifying a caller and authorising
// one are different jobs and this route did the second nowhere. Driven
// against a running server, a fabricated bearer token returned 200 and
// left a persisted alert row behind.
//
// Nothing in the repo calls this route from a UI, and there is no user
// whose session could reasonably authorise "evaluate the whole app's
// telemetry and page whoever owns it" — which is exactly the case
// `requireCallingService` exists for.
app.post("/api/intelligence/evaluate", requireCallingService(), async (req, res) => {
  const { app: appId, metric, category, threshold } = req.body || {};
  if (!appId || !metric) {
    return res.status(400).json({ error: "'app' and 'metric' are required." });
  }
  try {
    const result = evaluateMetric(store, appId, metric, {
      category: category || null,
      threshold: threshold !== undefined ? Number(threshold) : undefined,
    });
    // Only a real anomaly is delivered. Evaluating a healthy metric is
    // the common case by far, and paging on it is how a channel becomes
    // noise nobody reads.
    //
    // **And `!result.suppressed`, which this said nothing about and
    // should have.** The reasoning above was right and was applied to
    // exactly half the problem: a healthy metric paged nobody, and a
    // metric that stepped to a new normal and stayed there paged
    // somebody 125 times for one event — measured. `evaluateMetric`
    // now keeps an ongoing anomaly as one alert with a count on it;
    // this is the line that stops it ringing the phone each time.
    if (result.isAnomaly && !result.suppressed) await notifyAnomaly(result);
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get("/api/intelligence/alerts", (req, res) => {
  const { app: appId, routedTo } = req.query;
  res.json({ alerts: getAlerts(store, { app: appId, routedTo }) });
});

app.listen(PORT, () => {
  console.log(`VACO Analytics listening on http://localhost:${PORT}`);
  console.log(`Health check: curl http://localhost:${PORT}/api/health`);
});
