// VEX -- real Robinhood-style Cvltvre Card brokerage, standalone.
// Extracted from VOKEN (Phase 1, dev-docs/phase-1-extracted-from-voken)
// per direct instruction: VEX becomes its own app, a sibling of Vex
// Business inside the Vex Trading shell, no longer a module living
// inside VOKEN. Cvltvre Cards themselves stay VOKEN's own real
// product -- this app calls VOKEN's live API for card data
// (lib/vokenClient.js) rather than keeping its own copy.
//
// Run:
//   npm install
//   npm start
//
// Test:
//   curl http://localhost:8816/api/health

const express = require('express');
const cors = require('cors');
require('dotenv/config');
const path = require('path');

const { createVexStore } = require('./lib/store');
const { createPersistentStore, durable } = require('./lib/persistence');
const { GATES, isComplianceCleared, setComplianceStatus } = require('./lib/complianceGate');
const {
  NET_CAPITAL_MODELS, ORDER_TYPES, openBrokerAccount, getBrokerAccount, placeTradeOrder, getTradeOrder,
} = require('./lib/brokerage');

const { requireActor, requireSession } = require('./lib/shieldAuth.cjs');
const { createServiceAuth } = require('./lib/serviceAuth.cjs');
const { createDecisionLog } = require('./lib/decisionLog.cjs');
const { createOperatorAuth } = require('./lib/operatorAuth.cjs');
const { traceMiddleware } = require('./lib/tracing.cjs');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Trace context, mounted before any auth middleware: a request that is
// *refused* still carries a trace id, and a 401 you cannot correlate is
// exactly the one you want to correlate.
app.use(traceMiddleware());


app.use(express.static(path.join(__dirname, 'public')));

// -- Authorization ------------------------------------------------------
//
// **This app is a brokerage and had almost none.** Three routes chained
// into a real exploit, found by running it rather than reading it:
//
//   1. `compliance-gate/:gateName` was `requireActor('operatorId')`,
//      which proves the session belongs to whoever the *body names* --
//      so any account holder could name themselves and clear the
//      brokerage interlock. Same shape as VOID's licensing bug: a claim
//      may be self-service, a credential never is.
//   2. `POST /api/account` was anonymous: open a broker account for any
//      userId.
//   3. `POST /api/order` had no actor check and takes `accountId` from
//      the body without comparing an owner.
//
// The only thing left standing between an anonymous caller and a trade
// on somebody else's account was V3 refusing the transfer -- another
// app's guard, which this one has no business relying on. lib/brokerage
// already makes that argument about prices: "a brokerage should not be
// relying on its ledger to catch a price it never validated."
//
// The floor, so no route here has a legitimate anonymous caller.
const serviceAuth = createServiceAuth();
app.use(serviceAuth.middleware);

const decisionLog = createDecisionLog({ app: 'vex' });
const operatorAuth = createOperatorAuth();
const { requireOperator } = operatorAuth;

// A trade order names an accountId -- a *thing*, not an actor. The
// third guard shape: resolve it and compare its stored owner, because
// the body cannot be trusted to say who owns it.
function requireAccountOwner(field = 'accountId') {
  const session = requireSession();
  return (req, res, next) => session(req, res, () => {
    const account = getBrokerAccount(store, Number((req.body || {})[field]));
    if (!account) {
      return res.status(404).json({ error: `no broker account with id ${(req.body || {})[field]}` });
    }
    if (account.userId !== req.sessionUserId) {
      return res.status(403).json({ error: 'only the account holder may trade on this account' });
    }
    return next();
  });
}
const PORT = process.env.PORT || 8816;
const V3_API_URL = process.env.V3_API_URL || 'http://localhost:8811';

// V3 requires every mutating caller to be either a user session or a
// known internal service. This app settles server-to-server, with no
// end-user session to present, so it presents a service credential.
// See v3/lib/serviceAuth.js. Absent in dev, which V3 answers with a
// clear 401 rather than a silent success.
const VACO_SERVICE_NAME = process.env.VACO_SERVICE_NAME || 'vex';
const VACO_SERVICE_TOKEN = process.env.VACO_SERVICE_TOKEN || '';
function serviceHeaders() {
  return VACO_SERVICE_TOKEN
    ? { 'X-Service-Name': VACO_SERVICE_NAME, 'X-Service-Token': VACO_SERVICE_TOKEN }
    : {};
}

const store = createPersistentStore(path.join(__dirname, 'data', 'store.json'), createVexStore);
app.use(durable(store));  // commit before responding -- see lib/persistence.js

async function transferVCoin(fromUserId, toUserId, amount, reason) {
  const res = await fetch(`${V3_API_URL}/api/vcoin/transfer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...serviceHeaders() },
    body: JSON.stringify({ fromUserId, toUserId, amount, reason }),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.error || `transferVCoin failed (${res.status})`);
  }
  return body;
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'vex', netCapitalModels: NET_CAPITAL_MODELS, orderTypes: ORDER_TYPES, gates: GATES });
});

app.get('/api/compliance-gate/:gateName', (req, res) => {
  try {
    res.json({ gateName: req.params.gateName, cleared: isComplianceCleared(store, req.params.gateName) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// **A compliance gate is not a routine toggle.** `lib/complianceGate.js`
// says so in its own header: the setter "fires only after actual
// broker-dealer registration/legal work clears, not as a routine
// toggle". Until now this route had no auth of any kind — an
// unauthenticated POST opened it, verified against a running instance.
//
// For VEX that gate holds live trading closed pending broker-dealer
// registration. For VOKEN it holds fractional ownership closed on a
// securities posture, and `influencer-culture-card-rewards` closed
// pending a named review. All three were openable by anyone.
//
// `requireActor('operatorId')` ties the change to a Shield session that
// IS the operator named in the body. It cannot be a routine toggle if
// nobody can perform it anonymously.
app.post('/api/compliance-gate/:gateName', requireOperator('vex:compliance'), async (req, res) => {
  try {
    await decisionLog.record({
      route: 'POST /api/compliance-gate/:gateName',
      outcomeKind: 'state-change',
      subjectType: 'complianceGate',
      subjectId: req.params.gateName,
      decidedBy: req.operator.operatorName,
      decidedByKind: 'operator',
      inputs: { cleared: (req.body || {}).cleared },
      reason: (req.body || {}).reason || null,
    });
  } catch (err) {
    return res.status(503).json({ error: err.message });
  }
  try {
    return res.json(setComplianceStatus(store, req.params.gateName, (req.body || {}).cleared));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

app.post('/api/account', requireActor('userId'), (req, res) => {
  try {
    res.status(201).json(openBrokerAccount(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/account/:id', (req, res) => {
  const account = getBrokerAccount(store, Number(req.params.id));
  if (!account) return res.status(404).json({ error: `no broker account with id ${req.params.id}` });
  res.json(account);
});

app.post('/api/order', requireAccountOwner('accountId'), async (req, res) => {
  try {
    res.status(201).json(await placeTradeOrder(store, { ...req.body, transferFn: transferVCoin }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/order/:id', (req, res) => {
  const order = getTradeOrder(store, Number(req.params.id));
  if (!order) return res.status(404).json({ error: `no trade order with id ${req.params.id}` });
  res.json(order);
});

app.listen(PORT, () => {
  console.log(`vex listening on :${PORT}`);
});

module.exports = app;
