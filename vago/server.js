// VAGO -- the ecosystem's wagering/prediction/casino platform.
// Source of truth: VAGO_ARCHITECTURE.md, VAGO_CLAUDE.md,
// VAGO_COMPARABLES.md.
//
// Run:
//   npm install
//   npm start
//
// Test:
//   curl http://localhost:8795/api/health

const express = require('express');
const cors = require('cors');
require('dotenv/config');

const { createVagoStore } = require('./lib/store');
const path = require('path');
const { attachStore } = require('./lib/storeBackend');
const { seedDemoData } = require('./lib/seedDemoData');
const { getGoldCoinBalance } = require('./lib/goldCoin');
const { AMOE_GOLD_COIN_GRANT_AMOUNT, AMOE_COOLDOWN_HOURS, submitAmoeEntry, getAmoeHistory } = require('./lib/amoe');
const {
  requireActor, requireSession, requireCallingService,
} = require('./lib/shieldAuth.cjs');
const { createServiceAuth } = require('./lib/serviceAuth.cjs');
const { createDecisionLog } = require('./lib/decisionLog.cjs');
const { createOperatorAuth } = require('./lib/operatorAuth.cjs');
const { traceMiddleware } = require('./lib/tracing.cjs');
const {
  CASINO_GAME_TYPES, CASINO_CURRENCIES, startCasinoSession, getCasinoSession,
} = require('./lib/casinoSession');
const {
  MARKET_SOURCES, MARKET_SIDES, MIN_PRICE, MAX_PRICE,
  createPredictionMarket, getPredictionMarket, listMarketsBySource, buyContract, sellContract, resolveMarket,
  getMarketPrice,
} = require('./lib/predictionMarkets');
const {
  createSportsEvent, getSportsEvent, placeSportsBet, getSportsBet, settleSportsEvent,
  eventProbabilities, eventOverround,
} = require('./lib/sportsbook');
const {
  MATCH_STATUSES, createEsportsMatch, getEsportsMatch, startEsportsMatch, placeStake, resolveEsportsMatch,
} = require('./lib/esportsStaking');
const {
  ORIGINALS_RTP, MIN_MINES_COUNT, MAX_MINES_COUNT, PLINKO_ROWS, HILO_CARD_VALUES,
  getOriginalsRound, startMinesRound, revealMinesTile, cashOutMines, startPlinkoRound, dropPlinkoBall,
  startHiloRound, guessHilo, cashOutHilo,
} = require('./lib/originals');
const {
  MIN_PICKS, MAX_PICKS, FLEX_MIN_PICKS, PERFECT_PAYOUT_TABLE, FLEX_PAYOUT_TABLE,
  createProp, getProp, resolveProp, createFantasyEntry, getFantasyEntry, gradeFantasyEntry, listEntriesForUser,
} = require('./lib/fantasy');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Trace context, mounted before any auth middleware: a request that is
// *refused* still carries a trace id, and a 401 you cannot correlate is
// exactly the one you want to correlate.
app.use(traceMiddleware());

app.use(express.static(path.join(__dirname, 'public')));
const PORT = process.env.PORT || 8795;
const V3_API_URL = process.env.V3_API_URL || 'http://localhost:8811';

// V3 requires every mutating caller to be either a user session or a
// known internal service. This app settles server-to-server, with no
// end-user session to present, so it presents a service credential.
// See v3/lib/serviceAuth.js. Absent in dev, which V3 answers with a
// clear 401 rather than a silent success.
const VACO_SERVICE_NAME = process.env.VACO_SERVICE_NAME || 'vago';
const VACO_SERVICE_TOKEN = process.env.VACO_SERVICE_TOKEN || '';
function serviceHeaders() {
  return VACO_SERVICE_TOKEN
    ? { 'X-Service-Name': VACO_SERVICE_NAME, 'X-Service-Token': VACO_SERVICE_TOKEN }
    : {};
}

const VACO_ANALYTICS_URL = process.env.VACO_ANALYTICS_URL || 'http://localhost:8790';
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
let store = createVagoStore();
attachStore(app, {
  appKey: 'vago',
  createDefault: createVagoStore,
  filePath: path.join(__dirname, 'data', 'store.json'),
  onReady: (loaded) => { store = loaded; },
});

// Atomic settlement: every leg moves, or none does.
//
// **The one multi-leg path here is a prediction-market purchase**: the
// contract cost and the trading fee both leave the buyer's account,
// and the market pools and the contract record are written only after
// both. Split into consecutive transfers, the fee leg could fail after
// the cost leg had moved -- the buyer paid and held nothing, no pool
// grew, no contract existed -- and the retry charged the cost again.
//
// Everything else in this app is genuinely one leg (a stake in, a
// payout out), and each is sent as a single-leg settlement so the app
// has one money interface rather than two.
//
// `POST /api/vcoin/settle` validates every leg against running balances
// and writes nothing unless all of them pass. `settleVCoin` is
// removed rather than kept beside it: a working single-transfer helper
// is what the next money path gets written with, and consecutive calls
// to it are the defect.
async function settleVCoin(legs, meta = {}) {
  const res = await fetch(`${V3_API_URL}/api/vcoin/settle`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...serviceHeaders(),
      // The settlement reason uniquely names what is being
      // settled, so it doubles as the idempotency key: a retried
      // settlement replays V3's first answer rather than paying
      // twice. Atomicity stops a *partial* settlement; this stops
      // a *duplicate* one.
      ...(meta.reason ? { 'Idempotency-Key': `settle:${meta.reason}` } : {}),
    },
    body: JSON.stringify({ legs, reason: meta.reason ?? null }),
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.error || `settleVCoin failed (${res.status})`);
  }
  return body;
}

// Fail-soft, same posture as cvnvo/server.js's own fetchYapSignal --
// a real casino payout is never held up by VACO Analytics being down.
async function pushMetric(metric, value) {
  try {
    await fetch(`${VACO_ANALYTICS_URL}/api/metrics/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...serviceHeaders(), },
      body: JSON.stringify({ app: 'vago', metric, value }),
    });
  } catch {
    // real, honest no-op -- VACO Analytics is optional telemetry, not a dependency.
  }
}

// -- Authorization ------------------------------------------------------
//
// **Every mutating route here moves real money and 24 of 25 had no
// guard.** A gambling app is the sharpest possible version of the
// problem: an unauthenticated caller could stake somebody else's
// balance, cash out somebody else's winning round into their own
// bankroll, or -- worst -- settle a sports event or resolve a
// prediction market and decide who won.
//
// Three shapes:
//
//   the body names the player       -> requireActor('userId')
//   the path names a ROUND or hand  -> resolve it back to its session's
//                                      user and compare
//   the route decides an OUTCOME    -> requireOperator('vago:<action>'),
//                                      because no player may ever grade
//                                      their own bet -- and neither may
//                                      a service token
//
// That third one is the important one and it is not a formality. Prop
// resolution, entry grading, market resolution, event settlement and
// esports resolution all pay out; whoever can call them can pick the
// result.
//
// Those six routes were closed with `requireCallingService()` first,
// which proved the *caller* was a known service but still could not say
// which **person** decided. They now demand an operator credential
// holding a specific scope, and there is deliberately no service-token
// fallback (scope doc §3.6): a compromised service must not carry
// operator authority. The six audit rows they write now name a person.
//
// The setup routes beside them -- creating a prop, a market, an event,
// a match -- keep `requireCallingService()`. Creating an event decides
// nothing; settling it does.
const serviceAuth = createServiceAuth();
app.use(serviceAuth.middleware);

// Operator-grade decisions are recorded in vaco-audit BEFORE they
// execute, and refuse to execute if the record does not land. See
// shared/decisionLog.js for why this one does not fail soft, and
// dev-docs/DECISION_AUDIT.md for the posture.
const decisionLog = createDecisionLog({ app: 'vago' });
// One instance: `describe()` counts allowed/refused/unreachable, and two
// instances would split those counters across objects while both looked
// correct.
const operatorAuth = createOperatorAuth();
const { requireOperator } = operatorAuth;

// A casino round belongs to whoever owns the session it was started
// from. `revealMinesTile`, `cashOutMines`, `dropPlinkoBall`, `guessHilo`
// and `cashOutHilo` all name only a roundId, so the session is the only
// place the player's identity lives.
function requireRoundPlayer() {
  const session = requireSession();
  return (req, res, next) => session(req, res, () => {
    const round = getOriginalsRound(store, Number(req.params.id));
    if (!round) return res.status(404).json({ error: `no round with id ${req.params.id}` });
    const casinoSession = getCasinoSession(store, round.sessionId);
    if (!casinoSession || casinoSession.userId !== req.sessionUserId) {
      return res.status(403).json({ error: 'only the player who started this round may act on it' });
    }
    return next();
  });
}

// Starting a round names a sessionId rather than a user, so the same
// lookup applies one level up.
function requireCasinoSessionOwner() {
  const session = requireSession();
  return (req, res, next) => session(req, res, () => {
    const casinoSession = getCasinoSession(store, Number((req.body || {}).sessionId));
    if (!casinoSession) {
      return res.status(404).json({ error: `no casino session with id ${(req.body || {}).sessionId}` });
    }
    if (casinoSession.userId !== req.sessionUserId) {
      return res.status(403).json({ error: 'only the owner of this casino session may start a round on it' });
    }
    return next();
  });
}

app.get('/api/health', (_req, res) => {
  res.json({
    // The decision log's own state, so an `observe` window with real
    // gaps in it is visible from outside rather than only in a log.
    decisionLog: decisionLog.describe(),
    operatorAuth: operatorAuth.describe(),
    ok: true,
    casinoGameTypes: CASINO_GAME_TYPES,
    casinoCurrencies: CASINO_CURRENCIES,
    amoeGoldCoinGrantAmount: AMOE_GOLD_COIN_GRANT_AMOUNT,
    amoeCooldownHours: AMOE_COOLDOWN_HOURS,
    marketSources: MARKET_SOURCES,
    marketSides: MARKET_SIDES,
    marketPriceBounds: { min: MIN_PRICE, max: MAX_PRICE },
    esportsMatchStatuses: MATCH_STATUSES,
    originalsRtp: ORIGINALS_RTP,
    minesCountBounds: { min: MIN_MINES_COUNT, max: MAX_MINES_COUNT },
    plinkoRows: PLINKO_ROWS,
    hiloCardValues: HILO_CARD_VALUES,
    fantasyPickBounds: { min: MIN_PICKS, max: MAX_PICKS },
    fantasyFlexMinPicks: FLEX_MIN_PICKS,
    fantasyPerfectPayoutTable: PERFECT_PAYOUT_TABLE,
    fantasyFlexPayoutTable: FLEX_PAYOUT_TABLE,
  });
});

app.get('/api/gold-coin/balance/:userId', (req, res) => {
  try {
    res.json({ userId: req.params.userId, balance: getGoldCoinBalance(store, req.params.userId) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/amoe-entry', requireActor('userId'), (req, res) => {
  try {
    res.status(201).json(submitAmoeEntry(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/amoe-entry/:userId', (req, res) => {
  try {
    res.json({ userId: req.params.userId, entries: getAmoeHistory(store, req.params.userId) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/casino/sessions', requireActor('userId'), async (req, res) => {
  try {
    res.status(201).json(await startCasinoSession(store, { ...req.body, settleFn: settleVCoin }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/casino/sessions/:id', (req, res) => {
  const session = getCasinoSession(store, Number(req.params.id));
  if (!session) return res.status(404).json({ error: `no casino session with id ${req.params.id}` });
  res.json(session);
});

app.post('/api/casino/mines/start', requireCasinoSessionOwner(), (req, res) => {
  try {
    res.status(201).json(startMinesRound(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/casino/mines/:id/reveal', requireRoundPlayer(), (req, res) => {
  try {
    res.json(revealMinesTile(store, { ...req.body, roundId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/casino/mines/:id/cash-out', requireRoundPlayer(), async (req, res) => {
  try {
    const round_ = await cashOutMines(store, { roundId: Number(req.params.id), settleFn: settleVCoin });
    await pushMetric('casino_payout', round_.payout);
    res.json(round_);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/casino/plinko/start', requireCasinoSessionOwner(), (req, res) => {
  try {
    res.status(201).json(startPlinkoRound(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/casino/plinko/:id/drop', requireRoundPlayer(), async (req, res) => {
  try {
    const round_ = await dropPlinkoBall(store, { roundId: Number(req.params.id), settleFn: settleVCoin });
    await pushMetric('casino_payout', round_.payout);
    res.json(round_);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/casino/hilo/start', requireCasinoSessionOwner(), (req, res) => {
  try {
    res.status(201).json(startHiloRound(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/casino/hilo/:id/guess', requireRoundPlayer(), (req, res) => {
  try {
    res.json(guessHilo(store, { ...req.body, roundId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/casino/hilo/:id/cash-out', requireRoundPlayer(), async (req, res) => {
  try {
    const round_ = await cashOutHilo(store, { roundId: Number(req.params.id), settleFn: settleVCoin });
    await pushMetric('casino_payout', round_.payout);
    res.json(round_);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/casino/rounds/:id', (req, res) => {
  const round = getOriginalsRound(store, Number(req.params.id));
  if (!round) return res.status(404).json({ error: `no originals round with id ${req.params.id}` });
  res.json(round);
});

app.post('/api/fantasy/props', requireCallingService(), (req, res) => {
  try {
    res.status(201).json(createProp(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/fantasy/props/:id', (req, res) => {
  const prop = getProp(store, Number(req.params.id));
  if (!prop) return res.status(404).json({ error: `no prop with id ${req.params.id}` });
  res.json(prop);
});

app.post('/api/fantasy/props/:id/resolve', requireOperator('vago:grade'), async (req, res) => {
  try {
    await decisionLog.record({
      route: 'POST /api/fantasy/props/:id/resolve',
      outcomeKind: 'grade',
      subjectType: 'fantasyProp',
      subjectId: req.params.id,
      decidedBy: req.operator.operatorName,
      decidedByKind: 'operator',
      inputs: req.body || {},
      reason: (req.body || {}).reason || null,
    });
  } catch (err) {
    return res.status(503).json({ error: err.message });
  }

  try {
    res.json(resolveProp(store, { ...req.body, propId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/fantasy/entries', requireActor('userId'), async (req, res) => {
  try {
    res.status(201).json(await createFantasyEntry(store, { ...req.body, settleFn: settleVCoin }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/fantasy/entries/:id', (req, res) => {
  const entry = getFantasyEntry(store, Number(req.params.id));
  if (!entry) return res.status(404).json({ error: `no entry with id ${req.params.id}` });
  res.json(entry);
});

app.post('/api/fantasy/entries/:id/grade', requireOperator('vago:grade'), async (req, res) => {
  try {
    await decisionLog.record({
      route: 'POST /api/fantasy/entries/:id/grade',
      outcomeKind: 'grade',
      subjectType: 'fantasyEntry',
      subjectId: req.params.id,
      decidedBy: req.operator.operatorName,
      decidedByKind: 'operator',
      inputs: req.body || {},
      reason: (req.body || {}).reason || null,
    });
  } catch (err) {
    return res.status(503).json({ error: err.message });
  }

  try {
    res.json(await gradeFantasyEntry(store, { entryId: Number(req.params.id), settleFn: settleVCoin }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/fantasy/users/:userId/entries', (req, res) => {
  res.json({ entries: listEntriesForUser(store, req.params.userId) });
});

app.post('/api/markets', requireCallingService(), (req, res) => {
  try {
    res.status(201).json(createPredictionMarket(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/markets/:id', (req, res) => {
  const market = getPredictionMarket(store, Number(req.params.id));
  if (!market) return res.status(404).json({ error: `no market with id ${req.params.id}` });
  res.json(market);
});

app.post('/api/markets/:id/buy', requireActor('userId'), async (req, res) => {
  try {
    res.status(201).json(await buyContract(store, { ...req.body, marketId: Number(req.params.id), settleFn: settleVCoin }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/markets/:id/sell', requireActor('userId'), async (req, res) => {
  try {
    res.json(await sellContract(store, { ...req.body, marketId: Number(req.params.id), settleFn: settleVCoin }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/markets/:id/resolve', requireOperator('vago:settle'), async (req, res) => {
  try {
    await decisionLog.record({
      route: 'POST /api/markets/:id/resolve',
      outcomeKind: 'settlement',
      subjectType: 'predictionMarket',
      subjectId: req.params.id,
      decidedBy: req.operator.operatorName,
      decidedByKind: 'operator',
      inputs: req.body || {},
      reason: (req.body || {}).reason || null,
    });
  } catch (err) {
    return res.status(503).json({ error: err.message });
  }

  try {
    res.json(await resolveMarket(store, { ...req.body, marketId: Number(req.params.id), settleFn: settleVCoin }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/predictions/vdp', (_req, res) => {
  res.json({ markets: listMarketsBySource(store, 'vdp-in-world') });
});

app.get('/api/predictions/vacancy', (_req, res) => {
  res.json({ markets: listMarketsBySource(store, 'vacancy-in-game') });
});

// **The house line and the market, on one event.**
//
// The two mechanics were built deliberately apart — a bookmaker that
// takes the other side, and a peer market that prices itself — and they
// stay apart. What was missing was any connection at all: an event and
// a market were unrelated records, so the market on a game nobody
// thinks is even still opened at 50c.
//
// `withMarket: true` opens a paired market whose starting price is the
// **de-vigged** probability of the first outcome. De-vigged matters: the
// posted odds carry the house margin, and seeding with it baked in
// would open every market tilted toward the favorite by the book's own
// edge.
//
// The seeding is a starting price and nothing else. It puts no money in
// the pool, so `resolveMarket` still distributes only real stake and
// stays solvent by construction. The bookmaker's number is a first
// opinion; the first real trade is entitled to disagree with it.
//
// The wiring lives here rather than inside either module, so neither
// has to know the other exists.
app.post('/api/sports/events', requireCallingService(), (req, res) => {
  try {
    const { withMarket, ...eventOptions } = req.body || {};
    const event = createSportsEvent(store, eventOptions);

    let market = null;
    if (withMarket) {
      const [first] = eventProbabilities(event.outcomes);
      market = createPredictionMarket(store, {
        question: `${event.description} — will ${first.label} win?`,
        category: 'sports',
        source: 'real-world',
        creatorId: 'vago-house',
        openingYesPrice: first.fairProbability,
        linkedEventId: event.eventId,
      });
    }

    res.status(201).json({ ...event, market });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// The event, with its odds expressed as percentages and the house
// margin stated rather than buried. `probabilities` is derived on read
// rather than stored, so a line that changes cannot leave a stale
// percentage behind it.
app.get('/api/sports/events/:eventId', (req, res) => {
  const event = getSportsEvent(store, req.params.eventId);
  if (!event) return res.status(404).json({ error: `no event with id ${req.params.eventId}` });
  const market = store.predictionMarkets.find((m) => m.linkedEventId === event.eventId) || null;
  res.json({
    ...event,
    probabilities: eventProbabilities(event.outcomes),
    houseMargin: eventOverround(event.outcomes),
    market: market ? { id: market.id, question: market.question, ...getMarketPrice(market) } : null,
  });
});

app.post('/api/sports/:eventId/bet', requireActor('userId'), async (req, res) => {
  try {
    res.status(201).json(await placeSportsBet(store, { ...req.body, eventId: req.params.eventId, settleFn: settleVCoin }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/sports/bets/:id', (req, res) => {
  const bet = getSportsBet(store, Number(req.params.id));
  if (!bet) return res.status(404).json({ error: `no bet with id ${req.params.id}` });
  res.json(bet);
});

app.post('/api/sports/events/:eventId/settle', requireOperator('vago:settle'), async (req, res) => {
  try {
    await decisionLog.record({
      route: 'POST /api/sports/events/:eventId/settle',
      outcomeKind: 'settlement',
      subjectType: 'sportsEvent',
      subjectId: req.params.eventId,
      decidedBy: req.operator.operatorName,
      decidedByKind: 'operator',
      inputs: req.body || {},
      reason: (req.body || {}).reason || null,
    });
  } catch (err) {
    return res.status(503).json({ error: err.message });
  }

  try {
    res.json(await settleSportsEvent(store, { ...req.body, eventId: req.params.eventId, settleFn: settleVCoin }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/esports/matches', requireCallingService(), (req, res) => {
  try {
    res.status(201).json(createEsportsMatch(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/esports/matches/:matchId', (req, res) => {
  const match = getEsportsMatch(store, req.params.matchId);
  if (!match) return res.status(404).json({ error: `no match with id ${req.params.matchId}` });
  res.json(match);
});

app.post('/api/esports/matches/:matchId/start', requireOperator('vago:state'), async (req, res) => {
  try {
    await decisionLog.record({
      route: 'POST /api/esports/matches/:matchId/start',
      outcomeKind: 'state-change',
      subjectType: 'esportsMatch',
      subjectId: req.params.matchId,
      decidedBy: req.operator.operatorName,
      decidedByKind: 'operator',
      inputs: req.body || {},
      reason: (req.body || {}).reason || null,
    });
  } catch (err) {
    return res.status(503).json({ error: err.message });
  }

  try {
    res.json(startEsportsMatch(store, { matchId: req.params.matchId }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/esports/:matchId/stake', requireActor('userId'), async (req, res) => {
  try {
    res.status(201).json(await placeStake(store, { ...req.body, matchId: req.params.matchId, settleFn: settleVCoin }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/esports/matches/:matchId/resolve', requireOperator('vago:settle'), async (req, res) => {
  try {
    await decisionLog.record({
      route: 'POST /api/esports/matches/:matchId/resolve',
      outcomeKind: 'settlement',
      subjectType: 'esportsMatch',
      subjectId: req.params.matchId,
      decidedBy: req.operator.operatorName,
      decidedByKind: 'operator',
      inputs: req.body || {},
      reason: (req.body || {}).reason || null,
    });
  } catch (err) {
    return res.status(503).json({ error: err.message });
  }

  try {
    res.json(await resolveEsportsMatch(store, { ...req.body, matchId: req.params.matchId, settleFn: settleVCoin }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Real seed/demo data for the live walkthrough -- sample prediction
// markets (real-world AND in-world) and sample Gold Coin casino
// sessions, via the real functions above (see `lib/seedDemoData.js`'s
// own header). Awaited before the server starts accepting requests, so
// a presenter curling the API right after boot never sees a half-
// seeded store; internally guarded per-array, so a persisted
// `data/store.json` with real data is never clobbered.
(async () => {
  try {
    await seedDemoData(store, { settleFn: settleVCoin });
  } catch (err) {
    console.error('seedDemoData failed:', err.message);
  }
  app.listen(PORT, () => {
    console.log(`VAGO listening on http://localhost:${PORT}`);
    console.log(`Health check: curl http://localhost:${PORT}/api/health`);
  });
})();
