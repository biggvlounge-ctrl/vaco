// CVLLEX — VOKEN's star constellation's physical-production app.
//
// Built first as a module inside VOKEN (25 Oct 2026: see VOKEN's own
// commit "physical production orders -- get a real limited run MADE,
// then tokenize it"), extracted into this standalone app the same
// day, by direct decision: the four-member VOKEN square (VOKEN · VEX
// · VADO · CVLTVRE) becomes a five-member star, still named VOKEN,
// with CVLLEX as its fifth member. See README.md for the
// real comparables (Qrates, Printful/Printify, Lulu/Doxzoo,
// Courtyard.io) and for the real precedent (VEX, once extracted from
// VOKEN and folded back in) that shaped how this app talks to VOKEN.
//
// Real flow: order a physical run -> a human operator confirms it was
// actually produced by a real vendor -> the produced run is vaulted
// (a real Cvltvre Card minted through VOKEN's existing, canonical
// mintExternalEntityCard -- CVLLEX never mints its own competing
// token) -> a unit can be redeemed (shipped via VOID's real courier
// vertical).
//
// Run:
//   npm install
//   npm start
//
// Test:
//   curl http://localhost:8822/api/health

const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv/config');

const { createCvllexStore } = require('./lib/store');
const { attachStore } = require('./lib/storeBackend');
const {
  PRODUCTION_ITEM_TYPES, PRESSED_MEDIA_ITEM_TYPES, PRESSED_MEDIA_MINIMUM_UNITS,
  createProductionOrder, getProductionOrder, listProductionOrdersForCreator, advanceProductionOrder,
} = require('./lib/physicalProduction');
const {
  getVaultedCollectible, vaultProducedOrder, redeemUnit, getTotalUnitsRedeemedForCreator,
} = require('./lib/vault');
const { requireActor, requireSession, actorOrService } = require('./lib/shieldAuth.cjs');
const { createServiceAuth } = require('./lib/serviceAuth.cjs');
const { traceMiddleware } = require('./lib/tracing.cjs');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(traceMiddleware());

// A trusted service (Vulture Music, Vulture Flix, VOID MAGIC) can
// place a production order on a real creator/studio/host's behalf
// with no end-user browser session to present — the same real gap
// `serviceAuth` already closes for V3/VACA/VOKEN. Reads are not
// gated; this stops unauthorized writes only.
const serviceAuth = createServiceAuth();
app.use(serviceAuth.middleware);

app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 8822;

// -- cross-app clients, injected rather than hard-wired -----------------
// Same "cross-app calls are injected, not hard-wired" convention this
// whole ecosystem uses — keeps lib/ plain-Node-testable with no live
// network, and keeps CVLLEX a real client of VOKEN/VOID rather than a
// second ledger or a second token.
const VOKEN_API_URL = process.env.VOKEN_API_URL || 'http://localhost:8794';
const VOID_API_URL = process.env.VOID_API_URL || 'http://localhost:8793';

// Mints the real Cvltvre Card for a produced run through VOKEN's
// existing, canonical POST /api/card/external -- see VOKEN's
// lib/cultureCards.js (SOURCE_APPS now includes 'cvllex') and
// server.js (verifyExternalCardOwnership now recognizes it). Requires
// a real session token for the creator who placed the order (VOKEN
// verifies ownership itself by calling back into this app's own
// GET /api/production-orders/:id — see VOKEN's own server.js).
async function mintCultureCardForOrder(order, { sessionToken, cardParams }) {
  const res = await fetch(`${VOKEN_API_URL}/api/card/external`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {}),
    },
    body: JSON.stringify({
      sourceApp: 'cvllex',
      sourceType: 'production-order',
      externalRef: String(order.id),
      ...cardParams,
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `mintCultureCardForOrder failed (${res.status})`);
  return body;
}

// VOID's real courier vertical -- same shape VENVS's own
// voidClient.createShipment already established
// (POST /api/job, verticalId: 'courier', quantity 1, unitPrice =
// the real quoted shipping cost).
async function requestVoidShipment(customerId, shippingCost) {
  const res = await fetch(`${VOID_API_URL}/api/job`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      verticalId: 'courier', customerId, quantity: 1, unitPrice: shippingCost,
    }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `requestVoidShipment failed (${res.status})`);
  return body;
}

let store = createCvllexStore();
attachStore(app, {
  appKey: 'cvllex',
  createDefault: createCvllexStore,
  filePath: path.join(__dirname, 'data', 'store.json'),
  onReady: (loaded) => { store = loaded; },
});

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'cvllex',
    productionItemTypes: PRODUCTION_ITEM_TYPES,
    pressedMediaItemTypes: PRESSED_MEDIA_ITEM_TYPES,
    pressedMediaMinimumUnits: PRESSED_MEDIA_MINIMUM_UNITS,
    productionOrders: store.productionOrders.length,
    vaultedCollectibles: store.vaultedCollectibles.length,
    serviceAuth: serviceAuth.describe(),
  });
});

// -- Record ownership guard, same shape VOKEN's own server.js uses ---

function requireOrderCreator() {
  const session = requireSession();
  return (req, res, next) => session(req, res, () => {
    const order = getProductionOrder(store, Number(req.params.id));
    if (!order) return res.status(404).json({ error: `no production order with id ${req.params.id}` });
    if (order.creatorId !== req.sessionUserId) {
      return res.status(403).json({ error: 'only the creator who placed this production order may act on it' });
    }
    req.order = order;
    return next();
  });
}

// -- production orders -------------------------------------------------

app.post('/api/production-orders', actorOrService(requireActor('creatorId')), (req, res) => {
  try {
    res.status(201).json(createProductionOrder(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/production-orders/:id', (req, res) => {
  const order = getProductionOrder(store, Number(req.params.id));
  if (!order) return res.status(404).json({ error: `no production order with id ${req.params.id}` });
  res.json(order);
});

app.get('/api/production-orders/creator/:creatorId', (req, res) => {
  res.json({ orders: listProductionOrdersForCreator(store, req.params.creatorId) });
});

app.post('/api/production-orders/:id/advance', requireOrderCreator(), (req, res) => {
  try {
    res.json(advanceProductionOrder(store, { ...req.body, orderId: req.order.id }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// -- vaulting + redemption ----------------------------------------------

app.post('/api/production-orders/:id/vault', requireOrderCreator(), async (req, res) => {
  try {
    const vault = await vaultProducedOrder(store, {
      order: req.order,
      mintCultureCardFn: (order) => mintCultureCardForOrder(order, {
        sessionToken: (req.headers.authorization || '').replace(/^Bearer\s+/i, ''),
        cardParams: req.body || {},
      }),
    });
    res.status(201).json(vault);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/vault/:id', (req, res) => {
  const vault = getVaultedCollectible(store, Number(req.params.id));
  if (!vault) return res.status(404).json({ error: `no vaulted collectible with id ${req.params.id}` });
  res.json(vault);
});

app.post('/api/vault/:id/redeem', requireActor('redeemerId'), async (req, res) => {
  try {
    const result = await redeemUnit(store, {
      ...req.body, vaultId: Number(req.params.id), voidRequestFn: requestVoidShipment,
    });
    res.status(201).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// The real "sales" number for one creator -- VOKEN's real
// cross-platform achievement score reads this live, by direct
// instruction ("check the sales of what they've done").
app.get('/api/creators/:creatorId/units-redeemed', (req, res) => {
  res.json({ creatorId: req.params.creatorId, totalUnitsRedeemed: getTotalUnitsRedeemedForCreator(store, req.params.creatorId) });
});

app.listen(PORT, () => {
  console.log(`CVLLEX listening on http://localhost:${PORT}`);
  console.log(`Health check: curl http://localhost:${PORT}/api/health`);
});
