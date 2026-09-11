// VOKEN — the digital collectibles marketplace (VDAS).
// Source of truth: VOKEN_ARCHITECTURE.md, VOKEN_MASTER_SPEC_PROGRESS.md,
// VOKEN_NEW_VALUE_ALGORITHM.md, VOKEN_VALUE_DISPLAY_CARD_INDUSTRY_COMPARABLES.md.
//
// Real cross-app addition: the value-score endpoint now fetches its
// "VACA-verified authenticity" grade live from VACA (`../vaca/`)
// instead of trusting the request body -- see `fetchAuthenticityGrade`
// below and `lib/valueAlgorithm.js`'s own updated header.
//
// Run:
//   npm install
//   npm start
//
// Test:
//   curl http://localhost:8794/api/health

const express = require('express');
const cors = require('cors');
require('dotenv/config');

const VACA_API_URL = process.env.VACA_API_URL || 'http://localhost:8804';

// The real, live cross-app call into VACA -- confirmed by direct
// investigation that `authenticityGrade` was, until this call existed,
// never actually verified by anything: this endpoint trusted whatever
// grade the request body claimed. Mirrors this session's established
// injected-fetch pattern (CVNVO's voidFetchFn, CHOPZ SHOP's
// requestVoidCourierJob). A card VACA has no verified authenticity
// claim for resolves to grade 'C' -- a real, deliberate, flagged
// default: unverified is treated as the least-privileged tier, not
// silently promoted to a better grade than it's earned.
async function fetchAuthenticityGrade(cardId) {
  const res = await fetch(`${VACA_API_URL}/api/authenticity-grade/voken-card/${encodeURIComponent(cardId)}`);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `fetchAuthenticityGrade failed (${res.status})`);
  return body.grade || 'C';
}

const { createVokenStore } = require('./lib/store');
const path = require('path');
const { attachStore } = require('./lib/storeBackend');
const { getBrandInfo } = require('./lib/brand');
const { CATEGORIES, RARITY_TIERS, TOKENIZATION_TYPES, FORMATS } = require('./lib/cardTypes');
const {
  mintCultureCard, getCultureCard, listCultureCardsByCategory, mintAdditionalEdition, transferEditionOwnership, listEditionsWithSerials} = require('./lib/cultureCards');
const { computeCultureCardValueScore } = require('./lib/valueAlgorithm');
const { assessEstablishedCreator } = require('./lib/establishedCreatorAssessment');
const { PACK_TIER_NAMES, createPackTier, getPackTier, openPack } = require('./lib/cardPacks');
const {
  REFERRAL_TIERS, SPIN_PRIZES, getReferralProgress, recordReferral, spinWheel,
} = require('./lib/referralGrowth');
const { RAFFLE_STATUSES, createRaffle, getRaffle, enterRaffle, drawRaffleWinner } = require('./lib/raffles');
const { TRADE_STATUSES, proposeTrade, getTrade, acceptTrade, rejectTrade, cancelTrade } = require('./lib/trading');
const {
  APPLICATION_PATHS, APPLICATION_STATUSES, submitApplication, getApplication, runKenjiAnalysis,
} = require('./lib/cultureCardApplication');
const { ENGAGEMENT_TYPES, recordEngagementEvent, computeEngagementStats } = require('./lib/cardEngagement');
const { getVokenExplorePage } = require('./lib/exploreVoken');
const { computeCreatorDigitalProfile } = require('./lib/creatorDigitalProfile');
const { GATES, isComplianceCleared, setComplianceStatus } = require('./lib/complianceGate');
const {
  AUCTION_TYPES, createAuction, getAuction, listOpenAuctions, getCurrentDutchPrice, placeBid, endAuction, acceptOffer,
} = require('./lib/auctions');
const { createArtCultureCard, getArtCultureCard, setForSale, recordArtView } = require('./lib/artCultureCard');
const { getVadoExplorePage } = require('./lib/vadoExplore');
const { registerGalleryAccount, getGalleryAccount, getGalleryHoldings } = require('./lib/galleryAccounts');
const {
  createFractionalListing, getFractionalListing, buyShares, getFractionalHoldings,
  createSecondaryListing, getSecondaryListing, listOpenSecondaryListings, cancelSecondaryListing, buySecondaryShares,
} = require('./lib/fractionalOwnership');
const {
  ITEM_TYPES, createMerchListing, getMerchListing, purchaseMerchItem,
} = require('./lib/limitedEditionMerch');
const { registerDigitalArtFrame, getDigitalArtFrame, loadArtworkOntoFrame } = require('./lib/digitalArtFrame');
const {
  requireActor, requireParamActor, requireSession, requireCallingService,
} = require('./lib/shieldAuth.cjs');
const { seedDemoData } = require('./lib/seedDemoData');
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
const PORT = process.env.PORT || 8794;
const V3_API_URL = process.env.V3_API_URL || 'http://localhost:8811';

// V3 requires every mutating caller to be either a user session or a
// known internal service. This app settles server-to-server, with no
// end-user session to present, so it presents a service credential.
// See shared/serviceAuth.js. Absent in dev, which V3 answers with a
// clear 401 rather than a silent success.
const VACO_SERVICE_NAME = process.env.VACO_SERVICE_NAME || 'voken';
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
let store = createVokenStore();
attachStore(app, {
  appKey: 'voken',
  createDefault: createVokenStore,
  filePath: path.join(__dirname, 'data', 'store.json'),
  onReady: (loaded) => { store = loaded; },
});

// VOKEN's platform inventory -- pack tiers, raffles, the Kenji
// assessment that gates becoming a card subject -- belongs to VOKEN
// rather than to any user, so those routes use `requireCallingService()`
// and this is what makes that check meaningful. It also puts a floor
// under the app: every mutating route here moves VCoin or a card
// edition, and none has a legitimate anonymous caller.
const serviceAuth = createServiceAuth();
app.use(serviceAuth.middleware);

// Operator-grade decisions are recorded in vaco-audit BEFORE they
// execute, and refuse to execute if the record does not land. See
// shared/decisionLog.js for why this one does not fail soft, and
// dev-docs/DECISION_AUDIT.md for the posture.
const decisionLog = createDecisionLog({ app: 'voken' });
const operatorAuth = createOperatorAuth();
const { requireOperator } = operatorAuth;

// Atomic settlement: every leg moves, or none does.
//
// **Every multi-party payment in this app used to be consecutive
// transfers.** The second leg can fail on its own -- often precisely
// because the first just drew down the account it pays from -- and the
// record that would mark the work done is written afterwards. So a
// partial failure left one party paid, another not, and a retry that
// paid the first one again.
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
// a real fractional-shares purchase is never held up by VACO Analytics
// being down.
async function pushMetric(metric, value) {
  try {
    await fetch(`${VACO_ANALYTICS_URL}/api/metrics/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...serviceHeaders(), },
      body: JSON.stringify({ app: 'voken', metric, value }),
    });
  } catch {
    // real, honest no-op -- VACO Analytics is optional telemetry, not a dependency.
  }
}

app.get('/api/health', (_req, res) => {
  res.json({
    // The decision log's own state, so an `observe` window with real
    // gaps in it is visible from outside rather than only in a log.
    decisionLog: decisionLog.describe(),
    operatorAuth: operatorAuth.describe(),
    ok: true, brand: getBrandInfo(), categories: CATEGORIES, rarityTiers: RARITY_TIERS, tokenizationTypes: TOKENIZATION_TYPES, formats: FORMATS,
    packTierNames: PACK_TIER_NAMES, raffleStatuses: RAFFLE_STATUSES, tradeStatuses: TRADE_STATUSES,
    applicationPaths: APPLICATION_PATHS, applicationStatuses: APPLICATION_STATUSES,
    engagementTypes: ENGAGEMENT_TYPES,
    complianceGates: GATES,
    auctionTypes: AUCTION_TYPES,
    merchItemTypes: ITEM_TYPES,
    referralTiers: REFERRAL_TIERS, spinPrizes: SPIN_PRIZES,
  });
});

app.get('/api/brand', (_req, res) => {
  res.json(getBrandInfo());
});

// Minting a Cvltvre card creates real property and mints edition #1 to
// the subject. `subjectPersonId` is the person the card is *about*, so
// it is the field that must be the caller -- a card minted about
// somebody else without their session is the likeness problem in its
// most direct form.
app.post('/api/card', requireActor('subjectPersonId'), (req, res) => {
  try {
    res.status(201).json(mintCultureCard(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/card/:id', (req, res) => {
  const card = getCultureCard(store, Number(req.params.id));
  if (!card) return res.status(404).json({ error: `no card with id ${req.params.id}` });
  res.json(card);
});

app.get('/api/cards/category/:category', (req, res) => {
  res.json({ cards: listCultureCardsByCategory(store, req.params.category) });
});

app.post('/api/card/:id/edition', requireActor('ownerId'), (req, res) => {
  try {
    res.status(201).json(mintAdditionalEdition(store, { ...req.body, cardId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/card/:id/transfer', requireActor('fromOwnerId'), (req, res) => {
  try {
    res.json(transferEditionOwnership(store, { ...req.body, cardId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Scoring reads a card and returns a number; it writes nothing and
// names no user. The app-level credential still refuses an anonymous
// caller, which is the whole check that applies here.
app.post('/api/card/:id/value-score', requireSession(), async (req, res) => {
  try {
    const cardId = Number(req.params.id);
    const options = req.body || {};
    // The real authenticity grade comes from VACA, live -- never from
    // the request body, which is exactly the gap that made
    // "VACA-verified authenticity" a real claim with nothing actually
    // verifying it.
    const authenticityGrade = await fetchAuthenticityGrade(cardId);
    const traditional = { ...(options.traditional || {}), authenticityGrade };
    res.json(computeCultureCardValueScore(cardId, { ...options, traditional }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/established-creator-assessment', requireActor('creatorId'), (req, res) => {
  try {
    res.status(201).json(assessEstablishedCreator(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Pack tiers and raffles are platform inventory: VOKEN sets the price
// and the odds. No user's session can own that write, so both are
// operator surfaces guarded as service calls until there is a staff
// role. Drawing a raffle winner is the sharpest of the three -- it
// settles a prize, and an open draw route lets anyone pick the moment.
app.post('/api/pack-tier', requireCallingService(), (req, res) => {
  try {
    res.status(201).json(createPackTier(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/pack-tier/:id', (req, res) => {
  const tier = getPackTier(store, Number(req.params.id));
  if (!tier) return res.status(404).json({ error: `no pack tier with id ${req.params.id}` });
  res.json(tier);
});

app.post('/api/pack-tier/:id/open', requireActor('buyerId'), async (req, res) => {
  try {
    res.status(201).json(await openPack(store, {
      ...req.body, packTierId: Number(req.params.id), settleFn: settleVCoin,
    }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/raffle', requireCallingService(), (req, res) => {
  try {
    res.status(201).json(createRaffle(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/raffle/:id', (req, res) => {
  const raffle = getRaffle(store, Number(req.params.id));
  if (!raffle) return res.status(404).json({ error: `no raffle with id ${req.params.id}` });
  res.json(raffle);
});

app.post('/api/raffle/:id/enter', requireActor('userId'), (req, res) => {
  try {
    res.json(enterRaffle(store, { ...req.body, raffleId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/raffle/:id/draw', requireOperator('voken:settle'), async (req, res) => {
  try {
    await decisionLog.record({
      route: 'POST /api/raffle/:id/draw',
      outcomeKind: 'settlement',
      subjectType: 'raffle',
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
    res.json(drawRaffleWinner(store, { raffleId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// **The rest of VOKEN's ownership shapes.** `requireTradeParty` below
// covered the four trade routes; thirty more mutating routes named a
// card, an auction, a listing or a frame and checked nothing at all.
// Every one of them either moves VCoin or moves a card edition, which
// is real property with a real resale market.
function requireRecordOwner(label, lookup, ownerOf, param = 'id') {
  const session = requireSession();
  return (req, res, next) => session(req, res, () => {
    const record = lookup(req);
    if (!record) return res.status(404).json({ error: `no ${label} with id ${req.params[param]}` });
    const owner = ownerOf(record);
    const allowed = Array.isArray(owner) ? owner.includes(req.sessionUserId) : owner === req.sessionUserId;
    if (!allowed) {
      return res.status(403).json({ error: `only the owner of this ${label} may act on it` });
    }
    return next();
  });
}

const requireAuctionSeller = () => requireRecordOwner(
  'auction', (req) => getAuction(store, Number(req.params.id)), (a) => a.sellerId,
);
const requireArtCardArtist = () => requireRecordOwner(
  'art card', (req) => getArtCultureCard(store, Number(req.params.cardId)), (c) => c.artistId, 'cardId',
);
const requireFractionalSeller = () => requireRecordOwner(
  'fractional listing', (req) => getFractionalListing(store, Number(req.params.id)), (l) => l.sellerId,
);
const requireSecondarySeller = () => requireRecordOwner(
  'secondary listing', (req) => getSecondaryListing(store, Number(req.params.id)), (l) => l.sellerId,
);
const requireFrameOwner = () => requireRecordOwner(
  'art frame', (req) => getDigitalArtFrame(store, Number(req.params.id)), (f) => f.ownerId,
);

// A trade moves card editions — real property with a real resale
// market — so all four routes below need authorization, and until now
// none of them had any.
//
// `requireActor` covers propose, where the body names the actor. It
// cannot cover accept/reject/cancel: those identify the acting party
// by looking the trade up, not by a body field. So this is the
// ownership-lookup shape those need — a session first, then a check
// against the party the *stored record* says is entitled to act.
//
// Without it, `POST /api/trade/:id/accept` was executable by anyone
// who knew a trade id, and it transfers editions in both directions.
function requireTradeParty(side) {
  const session = requireSession();
  return (req, res, next) => session(req, res, () => {
    const trade = getTrade(store, Number(req.params.id));
    if (!trade) return res.status(404).json({ error: `no trade with id ${req.params.id}` });
    if (trade[side] !== req.sessionUserId) {
      return res.status(403).json({
        error: `only the trade's ${side === 'toUserId' ? 'recipient' : 'proposer'} may do this`,
      });
    }
    return next();
  });
}

app.post('/api/trade', requireActor('fromUserId'), (req, res) => {
  try {
    res.status(201).json(proposeTrade(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/trade/:id', (req, res) => {
  const trade = getTrade(store, Number(req.params.id));
  if (!trade) return res.status(404).json({ error: `no trade with id ${req.params.id}` });
  res.json(trade);
});

app.post('/api/trade/:id/accept', requireTradeParty('toUserId'), (req, res) => {
  try {
    res.json(acceptTrade(store, { tradeId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/trade/:id/reject', requireTradeParty('toUserId'), (req, res) => {
  try {
    res.json(rejectTrade(store, Number(req.params.id)));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/trade/:id/cancel', requireTradeParty('fromUserId'), (req, res) => {
  try {
    res.json(cancelTrade(store, { ...req.body, tradeId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/application', requireActor('applicantId'), (req, res) => {
  try {
    res.status(201).json(submitApplication(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/application/:id', (req, res) => {
  const application = getApplication(store, Number(req.params.id));
  if (!application) return res.status(404).json({ error: `no application with id ${req.params.id}` });
  res.json(application);
});

// Kenji's analysis is the gate on becoming a card subject. It is run
// by VOKEN, not by the applicant -- an applicant who could trigger
// their own assessment could retry it until it passed.
app.post('/api/application/:id/analyze', requireOperator('voken:grade'), async (req, res) => {
  try {
    await decisionLog.record({
      route: 'POST /api/application/:id/analyze',
      outcomeKind: 'grade',
      subjectType: 'cultureCardApplication',
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
    res.json(runKenjiAnalysis(store, { applicationId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/card/:id/engagement', requireSession(), (req, res) => {
  try {
    res.status(201).json(recordEngagementEvent(store, { ...req.body, cardId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/card/:id/engagement', (req, res) => {
  try {
    res.json(computeEngagementStats(store, { cardId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/explore', (_req, res) => {
  res.json({ surfaced: getVokenExplorePage(store) });
});

app.get('/api/creator-digital-profile/:creatorId', (req, res) => {
  try {
    res.json(computeCreatorDigitalProfile(store, { creatorId: req.params.creatorId }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
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
app.post('/api/compliance-gate/:gateName', requireOperator('voken:compliance'), (req, res) => {
  try {
    res.json(setComplianceStatus(store, req.params.gateName, (req.body || {}).cleared));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/auction', requireActor('sellerId'), (req, res) => {
  try {
    res.status(201).json(createAuction(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/auction/:id', (req, res) => {
  const auction = getAuction(store, Number(req.params.id));
  if (!auction) return res.status(404).json({ error: `no auction with id ${req.params.id}` });
  res.json(auction);
});

app.get('/api/auctions/open', (_req, res) => {
  res.json({ auctions: listOpenAuctions(store) });
});

app.get('/api/auction/:id/dutch-price', (req, res) => {
  try {
    const auction = getAuction(store, Number(req.params.id));
    if (!auction) return res.status(404).json({ error: `no auction with id ${req.params.id}` });
    res.json({ auctionId: auction.id, currentPrice: getCurrentDutchPrice(auction) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/auction/:id/bid', requireActor('bidderId'), async (req, res) => {
  try {
    res.json(await placeBid(store, { ...req.body, auctionId: Number(req.params.id), settleFn: settleVCoin }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// **Why this route gets an idempotency key and most do not.**
//
// The key must identify a logical operation, so that a retry replays
// and a genuinely new operation does not. Deriving one automatically
// from (from, to, amount, reason) is tempting and wrong: those are the
// same fields V3 already fingerprints, so it would add nothing, and it
// would silently collapse two real identical purchases -- buying the
// same pack twice at the same price -- into one. Blocking a customer's
// second purchase is as bad as double-charging their first.
//
// An auction ending is different: it is once-only by nature. Auction
// 7 settles exactly once, so `voken:auction-end:7` is stable across
// retries and can never collide with a different operation.
//
// The injected-transferFn pattern makes this free -- the key is bound
// at the call site by wrapping the function, and no lib module changes.
app.post('/api/auction/:id/end', requireAuctionSeller(), async (req, res) => {
  try {
    const auctionId = Number(req.params.id);
    res.json(await endAuction(store, {
      auctionId,
      transferFn: (from, to, amount, reason) => settleVCoin(
        from, to, amount, reason, `voken:auction-end:${auctionId}`,
      ),
    }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/auction/:id/accept-offer', requireAuctionSeller(), async (req, res) => {
  try {
    // Also once-only: accepting an offer settles that auction.
    const auctionId = Number(req.params.id);
    res.json(await acceptOffer(store, {
      ...req.body,
      auctionId,
      transferFn: (from, to, amount, reason) => settleVCoin(
        from, to, amount, reason, `voken:auction-accept-offer:${auctionId}`,
      ),
    }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/art-card', requireActor('artistId'), (req, res) => {
  try {
    res.status(201).json(createArtCultureCard(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/art-card/:cardId', (req, res) => {
  const record = getArtCultureCard(store, Number(req.params.cardId));
  if (!record) return res.status(404).json({ error: `no art Cvltvre card record for cardId ${req.params.cardId}` });
  res.json(record);
});

app.post('/api/art-card/:cardId/for-sale', requireArtCardArtist(), (req, res) => {
  try {
    res.json(setForSale(store, { ...req.body, cardId: Number(req.params.cardId) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/art-card/:cardId/view', requireSession(), (req, res) => {
  try {
    res.status(201).json(recordArtView(store, { cardId: Number(req.params.cardId) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/vado/explore', (_req, res) => {
  res.json({ surfaced: getVadoExplorePage(store) });
});

app.post('/api/gallery-account', requireActor('userId'), (req, res) => {
  try {
    res.status(201).json(registerGalleryAccount(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/gallery-account/:id', (req, res) => {
  const account = getGalleryAccount(store, Number(req.params.id));
  if (!account) return res.status(404).json({ error: `no gallery account with id ${req.params.id}` });
  res.json(account);
});

app.get('/api/gallery-account/:userId/holdings', (req, res) => {
  try {
    res.json(getGalleryHoldings(store, { userId: req.params.userId }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/fractional/listing', requireActor('sellerId'), (req, res) => {
  try {
    res.status(201).json(createFractionalListing(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/fractional/listing/:id', (req, res) => {
  const listing = getFractionalListing(store, Number(req.params.id));
  if (!listing) return res.status(404).json({ error: `no fractional listing with id ${req.params.id}` });
  res.json(listing);
});

app.post('/api/fractional/listing/:id/buy', requireActor('buyerId'), async (req, res) => {
  try {
    const purchase = await buyShares(store, { ...req.body, listingId: Number(req.params.id), settleFn: settleVCoin });
    await pushMetric('resale_trade_volume', purchase.amountPaid);
    res.status(201).json(purchase);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/fractional/holdings/:userId', (req, res) => {
  try {
    res.json(getFractionalHoldings(store, { userId: req.params.userId }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/fractional/secondary-listing', requireActor('sellerId'), (req, res) => {
  try {
    res.status(201).json(createSecondaryListing(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/fractional/secondary-listing/:id', (req, res) => {
  const listing = getSecondaryListing(store, Number(req.params.id));
  if (!listing) return res.status(404).json({ error: `no secondary listing with id ${req.params.id}` });
  res.json(listing);
});

app.get('/api/fractional/listing/:id/secondary-listings', (req, res) => {
  res.json({ secondaryListings: listOpenSecondaryListings(store, Number(req.params.id)) });
});

app.post('/api/fractional/secondary-listing/:id/cancel', requireSecondarySeller(), (req, res) => {
  try {
    res.json(cancelSecondaryListing(store, { ...req.body, secondaryListingId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/fractional/secondary-listing/:id/buy', requireActor('buyerId'), async (req, res) => {
  try {
    res.status(201).json(await buySecondaryShares(store, { ...req.body, secondaryListingId: Number(req.params.id), settleFn: settleVCoin }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/merch', requireActor('creatorId'), (req, res) => {
  try {
    res.status(201).json(createMerchListing(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/merch/:id', (req, res) => {
  const listing = getMerchListing(store, Number(req.params.id));
  if (!listing) return res.status(404).json({ error: `no merch listing with id ${req.params.id}` });
  res.json(listing);
});

app.post('/api/merch/:id/purchase', requireActor('buyerId'), async (req, res) => {
  try {
    res.status(201).json(await purchaseMerchItem(store, { ...req.body, listingId: Number(req.params.id), settleFn: settleVCoin }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/art-frame', requireActor('ownerId'), (req, res) => {
  try {
    res.status(201).json(registerDigitalArtFrame(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/art-frame/:id', (req, res) => {
  const frame = getDigitalArtFrame(store, Number(req.params.id));
  if (!frame) return res.status(404).json({ error: `no art frame with id ${req.params.id}` });
  res.json(frame);
});

app.post('/api/art-frame/:id/load', requireActor('requesterId'), requireFrameOwner(), (req, res) => {
  try {
    res.json(loadArtworkOntoFrame(store, { ...req.body, frameId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/referrals', requireActor('referrerId'), async (req, res) => {
  try {
    res.status(201).json(await recordReferral(store, { ...req.body, settleFn: settleVCoin }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/referrals/:userId/progress', (req, res) => {
  res.json(getReferralProgress(store, req.params.userId));
});

// The spin pays out VCoin, and the wheel is provably fair against a
// client seed -- so the person spinning must be the person credited.
app.post('/api/referrals/:userId/spin', requireParamActor('userId'), async (req, res) => {
  try {
    res.status(201).json(await spinWheel(store, { ...req.body, userId: req.params.userId, settleFn: settleVCoin }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Real demo seed data, gated on `store.auctions.length` -- the app's
// own real, structural array that was genuinely empty (unlike
// `cultureCards`, which already held real persisted test data this
// seed deliberately never touches or deletes). A second boot against
// an already-seeded `data/store.json` never double-seeds; a store
// that already has real auctions in it is never clobbered.
async function start() {
  if (store.auctions.length === 0) {
    await seedDemoData(store);
  }
  // Serial-numbered editions -- "Rookie Card #12/500" rendered from the
// ordinal that has always been captured at mint time.
app.get('/api/card/:id/editions', (req, res) => {
  try { res.json({ editions: listEditionsWithSerials(store, Number(req.params.id)) }); }
  catch (err) { res.status(404).json({ error: err.message }); }
});

app.listen(PORT, () => {
    console.log(`VOKEN listening on http://localhost:${PORT}`);
    console.log(`Health check: curl http://localhost:${PORT}/api/health`);
  });
}

start();
