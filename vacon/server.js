// VACON -- the ecosystem's real operating network.
// Source of truth: V4Prototype.jsx's own "VACON -> MIA -> agents"
// Command Center UI and `vacon-c/VACANCY_MASTER_SESSION_INDEX.md`'s
// §13 framing (every named agent is "a specialized AI executive
// operating inside VACON... accessed through V4... with MIA as
// executive orchestrator"). Confirmed directly this did not exist as
// real, callable code anywhere -- V4Prototype.jsx's own AGENTS array
// is real, frontend-only display/prompt data with no backend registry
// behind it, and neither v4-proxy (a key-holding LLM passthrough) nor
// v4-search (a search adapter) implement any of this. This is that
// real, missing piece.
//
// Real, deliberate split: VACON owns agent *identity* (the roster,
// MIA's real routing decision) and V4 (v4-proxy) stays exactly what
// it already is -- the interface layer that actually holds the
// Anthropic key and makes the LLM call. VACON's own invoke endpoint
// looks up the agent's real systemPrompt from its own registry, then
// calls straight into v4-proxy for the completion, rather than
// re-implementing the Anthropic call a second time.
//
// Run:
//   npm install
//   npm start
//
// Test:
//   curl http://localhost:8805/api/health

const express = require('express');
const cors = require('cors');
require('dotenv/config');

const { createVaconStore } = require('./lib/store');
const path = require('path');
const { createPersistentStore, durable } = require('./lib/persistence');
const { ALL_AGENTS, listAgents, getAgent } = require('./lib/agents');
const {
  routeQuery, recordRouting, getRoutingHistory, recordInvocation, getInvocationHistory,
} = require('./lib/orchestrator');

const { createServiceAuth } = require('./lib/serviceAuth.cjs');
const { traceMiddleware, traceHeaders } = require('./lib/tracing.cjs');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Mounted before the auth middleware on purpose: a request that
// serviceAuth *refuses* still gets a trace id, and a 401 you cannot
// correlate is exactly the one you want to correlate.
app.use(traceMiddleware());


// -- Trusted-service allowlist ------------------------------------------
//
// Invoking an agent is a real action taken on the ecosystem's behalf.
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


app.use(express.static(path.join(__dirname, 'public')));
const PORT = process.env.PORT || 8805;
const V4_PROXY_URL = process.env.V4_PROXY_URL || 'http://localhost:8787';

// This app's own service identity, presented to V4 the same way it
// is presented to V3. Empty by default so a dev machine with no
// tokens configured still boots; `serviceAuth` in enforce mode is
// what makes it required, not this line.
const VACO_SERVICE_NAME = process.env.VACO_SERVICE_NAME || 'vacon';
const VACO_SERVICE_TOKEN = process.env.VACO_SERVICE_TOKEN || '';
const store = createPersistentStore(path.join(__dirname, 'data', 'store.json'), createVaconStore);
app.use(durable(store));  // commit before responding -- see lib/persistence.js

// Real, live call into V4's own interface layer -- VACON never talks
// to Anthropic directly, it only ever supplies the real systemPrompt
// from its own registry and forwards the caller's messages.
async function invokeViaV4Proxy(systemPrompt, messages, req) {
  const res = await fetch(`${V4_PROXY_URL}/api/agent`, {
    method: 'POST',
    // V4 now requires a principal on this route: a signed-in person or
    // a named internal service. This caller is the latter, and the
    // same credential it already presents to V3 identifies it here.
    headers: {
      'Content-Type': 'application/json',
      ...(VACO_SERVICE_TOKEN
        ? { 'X-Service-Name': VACO_SERVICE_NAME, 'X-Service-Token': VACO_SERVICE_TOKEN }
        : {}),
      // Same trace as the request that caused this call, so the two
      // halves of one agent invocation line up in a log.
      ...traceHeaders(req),
    },
    body: JSON.stringify({ system: systemPrompt, messages }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `invokeViaV4Proxy failed (${res.status})`);
  return body;
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true, service: 'vacon', agentCount: ALL_AGENTS.length,
    serviceAuth: serviceAuth.describe(),
    invocations: store.invocationLog.length,
  });
});

app.get('/api/agents', (req, res) => {
  res.json({ agents: listAgents({ tier: req.query.tier, app: req.query.app }) });
});

// Who invoked which agent. A service credential is required to read
// it: it names internal callers, which is not public information.
//
// Checked inline rather than with shieldAuth's `requireCallingService`:
// VACON has no Shield dependency and no user-facing routes, so pulling
// one in to read a property `serviceAuth` already set would add a
// module to an app that needs nothing else from it. `req.callingService`
// is only set on reads because of the serviceAuth fix in this same
// change -- before it, this route could not have been written this way.
//
// **Registered before `/api/agents/:id`, and that ordering is load-
// bearing.** Express matches in registration order, so with this one
// second the parameterised route swallowed it and the response was
// `no agent with id invocations`. Same lesson as middleware order:
// declaration order is composition, not style.
app.get('/api/agents/invocations', (req, res) => {
  if (!req.callingService) {
    return res.status(403).json({
      error: 'this route names internal callers and requires a service credential '
        + '(X-Service-Name + X-Service-Token)',
    });
  }
  return res.json({ invocations: getInvocationHistory(store) });
});

app.get('/api/agents/:id', (req, res) => {
  const agent = getAgent(req.params.id);
  if (!agent) return res.status(404).json({ error: `no agent with id ${req.params.id}` });
  res.json(agent);
});

// audit-route-guards: open -- routes a request to an agent; the calling service is the principal
app.post('/api/route', (req, res) => {
  try {
    const { query } = req.body || {};
    const result = routeQuery(query);
    const logged = recordRouting(store, query, result);
    res.json({ ...result, loggedAs: logged.id });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/route/history', (_req, res) => {
  res.json({ history: getRoutingHistory(store) });
});

// Attribution for this route lives in `invocationLog`, readable at
// GET /api/agents/invocations. The marker below is kept to three lines
// on purpose: the audit script reads the four lines above a route, and
// the last of those is the route's own partial line.
// audit-route-guards: open -- service-to-service agent invocation with no
// end-user session; the app-level serviceAuth floor is what authorizes it,
// and every invocation is attributed in this app's own invocationLog
app.post('/api/agents/:id/invoke', async (req, res) => {
  const agent = getAgent(req.params.id);
  if (!agent) return res.status(404).json({ error: `no agent with id ${req.params.id}` });

  const { messages } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "invoke requires a non-empty 'messages' array" });
  }

  // **Attribution, in this app's own store rather than in vaco-audit.**
  //
  // The first version of this recorded to vaco-audit, and vaco-audit
  // refused it: `agent-invocation` is not one of its six outcome
  // kinds. Reading its header, that refusal was correct and the wiring
  // was wrong. That service holds "one row per irreversible decision"
  // and says in as many words that it is *not* a general application
  // log; its vocabulary is deliberately small so the log stays
  // queryable. An agent answering a question is an action, not a
  // decision with a loser, and pouring every invocation into the
  // decision log would bury the settlements it exists to hold.
  //
  // So attribution lives here, next to `routingLog`, which already
  // does exactly this for MIA's routing. When an agent can take an
  // action with a loser -- authorise a refund, suspend an account --
  // *that* belongs in vaco-audit, and none of them can yet.
  recordInvocation(store, {
    agentId: agent.id,
    agentName: agent.name,
    representsApp: agent.app ?? null,
    calledBy: req.callingService || null,
    messageCount: messages.length,
  });

  try {
    const result = await invokeViaV4Proxy(agent.systemPrompt, messages, req);
    return res.json({ agentId: agent.id, ...result });
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`VACON listening on http://localhost:${PORT}`);
  console.log(`Health check: curl http://localhost:${PORT}/api/health`);
});
