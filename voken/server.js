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
  SOURCE_APPS, MINTED_BY_ROLES,
  mintCultureCard, mintExternalEntityCard, mintHistoricCard, listHistoricCards, getCultureCard, listCultureCardsByCategory, mintAdditionalEdition, transferEditionOwnership, listEditionsWithSerials, recordPeakValueScore, getCardValueHistory, verifySubjectIdentity, updateCardStatistics, describeCardForQuestion, recordCardPredictionMarket} = require('./lib/cultureCards');
const {
  HISTORIC_SUBJECT_TYPES, listHistoricEntries, getHistoricEntry, genuineSignificanceInputsFor, rankHistoricEntries,
} = require('./lib/historicRegistry');
const { getHistoricExplorePage } = require('./lib/historicExplore');
const { computeCultureCardValueScore } = require('./lib/valueAlgorithm');
const {
  assessEstablishedCreator, computeExternalScore, getLatestAssessmentForCreator,
} = require('./lib/establishedCreatorAssessment');
const { PACK_TIER_NAMES, createPackTier, getPackTier, openPack, getPackOdds } = require('./lib/cardPacks');
const { RECOMMENDED_MINT_COUNTS_BY_RARITY, recommendedMintCountsFor } = require('./lib/mintCountGuidance');
const { SELLBACK_VALUE_RANGES, computeSellBackValue, sellBackCard } = require('./lib/sellBack');
const {
  REFERRAL_TIERS, SPIN_PRIZES, getReferralProgress, recordReferral, spinWheel,
} = require('./lib/referralGrowth');
const { RAFFLE_STATUSES, createRaffle, getRaffle, enterRaffle, drawRaffleWinner } = require('./lib/raffles');
const { TRADE_STATUSES, proposeTrade, getTrade, acceptTrade, rejectTrade, cancelTrade } = require('./lib/trading');
const {
  APPLICATION_PATHS, APPLICATION_STATUSES, submitApplication, getApplication, runKenjiAnalysis, reviewNomination,
} = require('./lib/cultureCardApplication');
const {
  CLAIM_STATUSES, submitFamilyRepresentativeClaim, getFamilyRepresentativeClaim, reviewFamilyRepresentativeClaim,
} = require('./lib/familyRepresentativeClaims');
const { ENGAGEMENT_TYPES, recordEngagementEvent, computeEngagementStats } = require('./lib/cardEngagement');
const { followCard, unfollowCard, isFollowing, getFollowerCount } = require('./lib/cardFollows');
const { notifyFollowersIfNewPeak, getNotificationsForUser, markNotificationRead } = require('./lib/cardNotifications');
const { computeCardMarketPrice } = require('./lib/cardMarketPrice');
const { computeVehicleCardValue } = require('./lib/vehicleCardValue');
const { getCardFullDetail } = require('./lib/cardFullDetail');
const { filterProducedOrders } = require('./lib/cvllexCollectibles');
const { createCarClub, getCarClub, joinCarClub, leaveCarClub, getCarClubLeaderboard } = require('./lib/carClubs');
const { computeWalletValue } = require('./lib/walletValue');
const {
  submitPlaceNomination, getPlaceNomination, reviewPlaceNomination,
  listApprovedCustomHistoricEntries, genuineSignificanceInputsForCustomEntry,
} = require('./lib/placeNominations');
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
  ITEM_TYPES, createMerchListing, getMerchListing, purchaseMerchItem, listMerchForCard,
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
// Real ownership check for a Vavlt Stvdios casino-event external card
// -- same env var name hvntz/server.js already established for calling
// this app.
const VAVLT_STVDIOS_API_URL = process.env.VAVLT_STVDIOS_API_URL || 'http://localhost:8808';
// Same real ownership-check pattern, for CVLLEX's production orders.
const CVLLEX_API_URL = process.env.CVLLEX_API_URL || 'http://localhost:8822';
// The real cross-app achievement sources -- by direct instruction
// ("check all their social media platforms... get all the
// information from everything we can so we can duplicate this and
// use it for all of our participants"), generic across every real
// creatorId/artistId, not hardcoded to any one person.
const VULTURE_MUSIC_API_URL = process.env.VULTURE_MUSIC_API_URL || 'http://localhost:8806';
const VULTURE_PODS_API_URL = process.env.VULTURE_PODS_API_URL || 'http://localhost:8810';
const VULTURE_FLIX_API_URL = process.env.VULTURE_FLIX_API_URL || 'http://localhost:8807';
const VAGO_API_URL = process.env.VAGO_API_URL || 'http://localhost:8795';

// "let's also add in our predictions on the culture card market as
// well." The exact same real pattern VDP already established for
// opening a VAGO market (vdp/server.cjs's own `openVagoMarket`):
// server-to-server, the same `X-Service-Name`/`X-Service-Token` pair
// every other cross-app call in this file already uses, never a
// player's own session -- opening a market curates a real question
// about this app's own market, it is not a player action. Fails soft
// (returns null) the same way `fetchRealTotal` already does: VAGO may
// not be running in every dev environment, and a missing prediction
// market must never take VOKEN's own server down.
async function openVagoMarket({ question, category, creatorId, openingYesPrice } = {}) {
  try {
    const res = await fetch(`${VAGO_API_URL}/api/markets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...serviceHeaders() },
      body: JSON.stringify({
        question, category, source: 'voken-culture-card', creatorId, openingYesPrice,
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      let message = `openVagoMarket failed (${res.status})`;
      try { message = JSON.parse(text).error || message; } catch { /* not JSON */ }
      throw new Error(message);
    }
    return await res.json();
  } catch (err) {
    console.warn(`VOKEN: could not open a VAGO prediction market (VAGO may not be running): ${err.message}`);
    return null;
  }
}

// A single real total from one connected app -- fail-soft, same
// posture `pushMetric` already takes elsewhere in this ecosystem for
// optional signals: a scoring request should never 503 because one of
// four unrelated apps happens to be down, and an unreachable app
// honestly contributes 0 rather than blocking the other three real
// numbers from counting.
async function fetchRealTotal(url, field) {
  try {
    const res = await fetch(url, { headers: serviceHeaders() });
    if (!res.ok) return 0;
    const body = await res.json();
    return Number.isInteger(body[field]) ? body[field] : 0;
  } catch {
    return 0;
  }
}

// The real, live list of a creator's own CVLLEX production orders --
// their real collectibles -- fail-soft the same way `fetchRealTotal`
// already is: CVLLEX may not be running, and that must never break a
// card's commerce page. See `GET /api/card/:id/commerce` below, by
// direct instruction: "it should link directly to their merch
// involved with them, or their merch involved with collects... this
// is an opportunity for them to sell or promote their collectibles."
// See `lib/cvllexCollectibles.js`'s own header for the real bug
// `filterProducedOrders` fixes -- an `ordered`/`in-production`/
// `cancelled` CVLLEX order is not a real collectible yet.
async function fetchRealCreatorCollectibles(creatorId) {
  try {
    const res = await fetch(`${CVLLEX_API_URL}/api/production-orders/creator/${encodeURIComponent(creatorId)}`, {
      headers: serviceHeaders(),
    });
    if (!res.ok) return [];
    const body = await res.json();
    return filterProducedOrders(body.orders);
  } catch {
    return [];
  }
}

// The real, live sum across every connected app's own real per-creator
// total -- streams, listens, views, units sold -- for whichever real
// id this card's subject actually has on each app (the same
// creatorId/artistId string, by this ecosystem's own cross-app
// convention). Works identically for any participant; nothing here
// names a specific person.
async function fetchRealContentConsumptionCount(id) {
  const [streams, listens, views, unitsSold] = await Promise.all([
    fetchRealTotal(`${VULTURE_MUSIC_API_URL}/api/artists/${encodeURIComponent(id)}/stream-count`, 'totalStreamCount'),
    fetchRealTotal(`${VULTURE_PODS_API_URL}/api/creators/${encodeURIComponent(id)}/listen-count`, 'totalListenCount'),
    fetchRealTotal(`${VULTURE_FLIX_API_URL}/api/creators/${encodeURIComponent(id)}/view-count`, 'totalViewCount'),
    fetchRealTotal(`${CVLLEX_API_URL}/api/creators/${encodeURIComponent(id)}/units-redeemed`, 'totalUnitsRedeemed'),
  ]);
  return streams + listens + views + unitsSold;
}
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

// -- External-entity card authority: real owner, or an operator -------
//
// `requireActor('subjectPersonId')` on /api/card exists so nobody
// mints a card about another real person without that person's own
// session -- the likeness problem. A World Layer location or a Vavlt
// Stvdios casino event is not a person and has no session to require.
// Founder's own call: "anyone with standing, operator or owner
// (either)."
//
// **The owner branch is verified against the owning app's own data,
// never merely claimed.** For a Vavlt Stvdios casino event, that means
// a real `GET /api/casino-events/:id` call confirming the caller's own
// session matches the event's real `hostId` -- the same field
// `createCasinoEvent` itself already enforces.
//
// **World Layer has no owner to verify at all.** Confirmed directly
// against `world-layer/sources.js` and `locations.js`: a `Location`'s
// `ownershipData` is always `null` there by design ("who owns what is
// simulation state, not world data... VACON-C generates it"), and
// World Layer itself exposes no HTTP API to call in the first place --
// it is a pure library nothing in this ecosystem currently consumes.
// So a world-layer card can only ever go through the operator branch
// below; the owner branch always refuses it, honestly, rather than
// inventing an ownership check against data that does not exist.
async function verifyExternalCardOwnership({ sourceApp, sourceType, externalRef, userId }) {
  if (sourceApp === 'vavlt-stvdios' && sourceType === 'casino-event') {
    const res = await fetch(`${VAVLT_STVDIOS_API_URL}/api/casino-events/${encodeURIComponent(externalRef)}`);
    if (res.status === 404) return false;
    if (!res.ok) throw new Error(`vavlt-stvdios answered ${res.status}`);
    const event = await res.json();
    return event.hostId === userId;
  }
  // CVLLEX's production orders -- the caller must be the real creator
  // who placed the order, same ownership shape as every other external
  // source above, just a different real app answering it.
  if (sourceApp === 'cvllex' && sourceType === 'production-order') {
    const res = await fetch(`${CVLLEX_API_URL}/api/production-orders/${encodeURIComponent(externalRef)}`);
    if (res.status === 404) return false;
    if (!res.ok) throw new Error(`cvllex answered ${res.status}`);
    const order = await res.json();
    return order.creatorId === userId;
  }
  return false;
}

// Fails closed like `requireOperator` itself -- an unreachable owning
// app, or an unverifiable subject, is refused rather than treated as
// permission, because this gate decides whether a card gets minted at
// all, not a soft signal.
function requireExternalCardAuthority(verifyOwnershipFn) {
  const operatorGuard = requireOperator('voken:mint-external-card');
  const sessionGuard = requireSession();
  return (req, res, next) => {
    if (req.headers['x-operator-credential']) {
      return operatorGuard(req, res, () => {
        // `req.operator` is only set on a verdict vaco-operator itself
        // returned (enforce, or observe's own 'unverified' stand-in).
        // `VACO_OPERATOR_MODE=off` skips straight to `next()` and sets
        // nothing at all -- found by a live boot in that mode, which
        // crashed the whole process on `req.operator.operatorName`
        // rather than answering the request.
        req.mintedByRole = 'operator';
        req.mintedByUserId = req.operator ? req.operator.operatorName : 'operator (VACO_OPERATOR_MODE=off)';
        return next();
      });
    }
    return sessionGuard(req, res, async () => {
      const { sourceApp, sourceType, externalRef } = req.body || {};
      let owns;
      try {
        owns = await verifyOwnershipFn({ sourceApp, sourceType, externalRef, userId: req.sessionUserId });
      } catch (err) {
        return res.status(503).json({
          error: `requireExternalCardAuthority: cannot verify ownership of ${sourceApp}:${sourceType}:${externalRef} (${err.message}). Refusing rather than assuming permission.`,
        });
      }
      if (!owns) {
        return res.status(403).json({
          error: `requireExternalCardAuthority: session user is not the verified owner/host of ${sourceApp}:${sourceType}:${externalRef} -- an operator credential (X-Operator-Credential) is required for a subject with no verifiable single owner`,
        });
      }
      req.mintedByRole = 'owner';
      req.mintedByUserId = req.sessionUserId;
      return next();
    });
  };
}

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
      ...(meta.reason ? { 'Idempotency-Key': `settle:${encodeURIComponent(meta.reason)}` } : {}),
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
    sourceApps: SOURCE_APPS, mintedByRoles: MINTED_BY_ROLES,
    sellBackValueRanges: SELLBACK_VALUE_RANGES,
    historicSubjectTypes: HISTORIC_SUBJECT_TYPES,
  });
});

// The fixed historic register itself -- browsable before minting, so
// a caller can see what real entries exist (and their slugs) rather
// than guessing. See lib/historicRegistry.js for why this is fixed
// rather than free-text.
app.get('/api/historic-register', (req, res) => {
  const { subjectType } = req.query;
  try {
    res.json({ entries: listHistoricEntries(subjectType || null) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// "find a way also to rank those things. The age, the rarity of these
// places." Ranked from each entry's own real earliestYear and
// recognitions -- see rankHistoricEntries()'s own header. Registered
// before the "/:slug" route below so "rank" is never swallowed as a
// literal slug.
app.get('/api/historic-register/rank', (req, res) => {
  const { subjectType } = req.query;
  try {
    res.json({ ranked: rankHistoricEntries({ subjectType: subjectType || null }) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/historic-register/:slug', (req, res) => {
  const entry = getHistoricEntry(req.params.slug);
  if (!entry) return res.status(404).json({ error: `no historic entry "${req.params.slug}"` });
  res.json(entry);
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

// Real commerce links on a card's own page, by direct instruction:
// "it should link directly to their merch involved with them, or
// their merch involved with collects, or anything that they have
// that's a collectible or merch that's involved. This also is an
// opportunity for them to sell or promote their collectibles as
// well." `merch` is VOKEN's own real `limitedEditionMerch` listings
// (see `listMerchForCard()`'s own header for the two real ways a
// listing counts as theirs); `collectibles` is a live, fail-soft
// fetch of the same real subject's own CVLLEX production orders --
// an unreachable CVLLEX contributes an honest empty list rather than
// breaking the page. A card with no real `subjectPersonId` (a place,
// an invention, an external entity with no owner) has no "them" to
// fetch collectibles for, so that lookup is skipped rather than
// guessed at.
app.get('/api/card/:id/commerce', async (req, res) => {
  const cardId = Number(req.params.id);
  const card = getCultureCard(store, cardId);
  if (!card) return res.status(404).json({ error: `no card with id ${cardId}` });

  try {
    const merch = listMerchForCard(store, cardId);
    const collectibles = card.subjectPersonId ? await fetchRealCreatorCollectibles(card.subjectPersonId) : [];
    res.json({ cardId, merch, collectibles });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// A real, unified card page -- see cardFullDetail.js's own header for
// why this collapses ~8 separate real calls into one, and why
// marketPrice/vehicleValue are honestly null rather than erroring the
// whole page when they don't yet apply.
app.get('/api/card/:id/full', async (req, res) => {
  try {
    res.json(await getCardFullDetail(store, { cardId: Number(req.params.id), fetchCollectibles: fetchRealCreatorCollectibles }));
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
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

// A Cvltvre Card about a non-person subject -- a World Layer location
// or a Vavlt Stvdios casino event. See `requireExternalCardAuthority`
// above for the real owner-or-operator authorization this runs
// through instead of `requireActor('subjectPersonId')`.
app.post('/api/card/external', requireExternalCardAuthority(verifyExternalCardOwnership), async (req, res) => {
  if (req.mintedByRole === 'operator') {
    try {
      await decisionLog.record({
        route: 'POST /api/card/external',
        outcomeKind: 'mint',
        subjectType: 'cultureCard',
        subjectId: `${(req.body || {}).sourceApp}:${(req.body || {}).sourceType}:${(req.body || {}).externalRef}`,
        decidedBy: req.mintedByUserId,
        decidedByKind: 'operator',
        inputs: req.body || {},
        reason: (req.body || {}).reason || null,
      });
    } catch (err) {
      return res.status(503).json({ error: err.message });
    }
  }

  try {
    res.status(201).json(mintExternalEntityCard(store, {
      ...req.body, mintedByUserId: req.mintedByUserId, mintedByRole: req.mintedByRole,
    }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// A Cvltvre Card about a real historic place, person, invention, or
// book -- operator-only, since nobody on this platform has standing
// to mint a card about the printing press the way a creator has
// standing to mint one about themselves. Guarded directly by
// `requireOperator` rather than `requireExternalCardAuthority`: there
// is no owner path here at all, only the operator one.
app.post('/api/card/historic', requireOperator('voken:mint-historic-card'), async (req, res) => {
  const mintedByUserId = req.operator ? req.operator.operatorName : 'operator (VACO_OPERATOR_MODE=off)';
  try {
    await decisionLog.record({
      route: 'POST /api/card/historic',
      outcomeKind: 'mint',
      subjectType: 'cultureCard',
      subjectId: (req.body || {}).historicSlug || null,
      decidedBy: mintedByUserId,
      decidedByKind: 'operator',
      inputs: req.body || {},
      reason: (req.body || {}).reason || null,
    });
  } catch (err) {
    return res.status(503).json({ error: err.message });
  }

  try {
    res.status(201).json(mintHistoricCard(store, { ...req.body, mintedByUserId }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/cards/historic', (req, res) => {
  res.json({ cards: listHistoricCards(store, req.query.subjectType || null) });
});

// The Instagram-Explore-style browsing surface for historic cards --
// one section per real subjectType, ranked within each by real, live
// engagement, with the real genuineSignificanceScore shown alongside
// so value is visible in the feed itself. See lib/historicExplore.js.
app.get('/api/explore/historic', (req, res) => {
  res.json(getHistoricExplorePage(store));
});

app.post('/api/card/:id/transfer', requireActor('fromOwnerId'), (req, res) => {
  try {
    res.json(transferEditionOwnership(store, { ...req.body, cardId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Real subject self-verification, by direct instruction: "I want
// people to be able to verify their own cards to show that that is
// them and they verify it." `requireActor('verifierId')` proves this
// really is that session's own real user id -- `verifySubjectIdentity`
// then refuses unless that id is literally the card's own
// `subjectPersonId`, never merely trusted from the request body.
app.post('/api/card/:id/verify', requireActor('verifierId'), (req, res) => {
  try {
    res.json(verifySubjectIdentity(store, { ...req.body, cardId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Real, owner-updatable accomplishment statistics, by direct
// instruction: "the owner of the card, the verified owner of the
// card, can update the statistics on the card." `requireActor('updaterId')`
// proves this really is that session's own real user id --
// `updateCardStatistics` then refuses unless that id is the card's
// real verified subject, approved family representative, or verified
// owner, never merely trusted from the request body.
app.post('/api/card/:id/statistics', requireActor('updaterId'), (req, res) => {
  try {
    res.json(updateCardStatistics(store, { ...req.body, cardId: Number(req.params.id) }));
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

    // Same discipline again, applied to the new cross-platform
    // influence term: "how many people view it... the algorithm of
    // all of their social media put together, their influence" is a
    // real, checkable fact about the card's own subject, not
    // something a caller gets to assert in the request body. The
    // subject is whoever has a real claim to the card -- the person
    // it's about, or the real owner who minted it -- and their most
    // recent `establishedCreatorAssessment` (if any) already holds
    // their real cross-platform social-following/press/recognition
    // numbers. No assessment on file means no real external-influence
    // data exists for them yet, so that part is honestly 0, never
    // guessed.
    //
    // **The real content-consumption half is live, not snapshotted**,
    // by direct instruction: "every time if something happens in
    // their career, their card will be affected by that." A follower
    // count is only knowable from a self-reported assessment because
    // no live social API exists here -- but real streams/listens/
    // views/units-sold genuinely are knowable, continuously, from
    // this ecosystem's own connected apps, so they are fetched live on
    // every scoring call rather than frozen at onboarding time. Works
    // identically for any real participant -- `fetchRealContentConsumptionCount`
    // names no one.
    const card = getCultureCard(store, cardId);
    const influenceSubjectId = card
      ? (card.subjectPersonId || (card.mintedByRole === 'owner' ? card.mintedByUserId : null))
      : null;
    const latestAssessment = influenceSubjectId ? getLatestAssessmentForCreator(store, influenceSubjectId) : null;
    // `realAlbumCount` is live too, same reasoning as content
    // consumption: a real discography keeps growing, so it is fetched
    // fresh from vulture-music rather than frozen at onboarding.
    const [realContentConsumptionCount, realAlbumCount] = influenceSubjectId
      ? await Promise.all([
        fetchRealContentConsumptionCount(influenceSubjectId),
        fetchRealTotal(`${VULTURE_MUSIC_API_URL}/api/artists/${encodeURIComponent(influenceSubjectId)}/album-count`, 'albumCount'),
      ])
      : [0, 0];
    let externalInfluenceScore = 0;
    if (latestAssessment || realContentConsumptionCount > 0 || realAlbumCount > 0) {
      const scored = computeExternalScore({
        realSocialFollowing: 0, realPressCoverageCount: 0, realIndustryRecognition: false,
        ...(latestAssessment ? latestAssessment.existingExternalMetrics : {}),
        realContentConsumptionCount, realAlbumCount,
      });
      externalInfluenceScore = scored.externalScore;
    }

    const traditional = { ...(options.traditional || {}), authenticityGrade, externalInfluenceScore };

    // Same discipline, applied to the Genuine Significance Score: a
    // historic card's real longevity/recognition facts are already
    // knowable from the historic register it was minted against (see
    // historicRegistry.js's own header), so they are computed from
    // there rather than trusted from the request body -- the same gap
    // this route already closed for authenticityGrade, closed again
    // here for the one other score a caller could otherwise just
    // assert. Non-historic cards are unaffected: no register exists
    // to defer to, so `options.genuineSignificance` still applies.
    // A historic card minted against a real, operator-approved
    // community place nomination isn't in the fixed register at all --
    // falls back to the same real math applied to the nomination's
    // own stored facts (placeNominations.js).
    const genuineSignificance = card && card.category === 'historic' && card.historicSlug
      ? (getHistoricEntry(card.historicSlug)
        ? genuineSignificanceInputsFor(card.historicSlug)
        : genuineSignificanceInputsForCustomEntry(store, card.historicSlug))
      : options.genuineSignificance;

    const scoreResult = computeCultureCardValueScore(cardId, { ...options, traditional, genuineSignificance });

    // The real "only ever goes up" floor, by direct instruction: "it
    // really can't really lower, it just won't raise [further]."
    // `peakValueScore` is this card's own real high-water mark,
    // updated here on every live call -- a real dip in today's
    // underlying numbers can never pull the card's effective value
    // below the highest real score it has already earned.
    const previousPeak = card ? card.peakValueScore : null;
    const peakValueScore = recordPeakValueScore(store, { cardId, combinedRealValueScore: scoreResult.combinedRealValueScore });

    // Real follow notifications, closing a real gap: "someone can
    // follow a card now, but nothing ever tells them when it moves."
    // See cardNotifications.js's own header for why this is a real,
    // VOKEN-internal inbox rather than routed through vaco-notify (an
    // ops-alerting app with no per-user addressing at all), and its
    // own `notifyFollowersIfNewPeak` for why only a genuine new real
    // peak counts as "moved."
    notifyFollowersIfNewPeak(store, { cardId, previousPeak, newPeak: peakValueScore });

    // The real, tradeable market price -- a different real number
    // from peakValueScore above, by direct instruction: "it could
    // lower, though, if their following drops or if more cards are
    // added... that Bill Cosby card will go up [as lower-scoring
    // cards join]." Built from the LIVE score (so a real following
    // drop can genuinely pull it down) and this card's real standing
    // against every other real card's peak on file (so the market's
    // own growth genuinely moves it). See cardMarketPrice.js's own
    // header for why this and peakValueScore are deliberately two
    // different real numbers.
    const marketPrice = computeCardMarketPrice(store, { cardId, liveCombinedRealValueScore: scoreResult.combinedRealValueScore });

    res.json({ ...scoreResult, peakValueScore, marketPrice });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// A lightweight real lookup for a card already scored at least once,
// using its stored peakValueScore rather than requiring a fresh
// live re-score -- the same real market comparison the value-score
// route above runs inline, available on its own for a card's detail
// page or a wallet total (see getWalletValue below).
app.get('/api/card/:id/market-price', (req, res) => {
  try {
    res.json(computeCardMarketPrice(store, { cardId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Real value-history time series -- every real scoring call ever
// recorded for this card, oldest first, so a real card page can
// actually chart value over time instead of only ever showing today's
// number.
app.get('/api/card/:id/value-history', (req, res) => {
  try {
    res.json({ cardId: Number(req.params.id), valueHistory: getCardValueHistory(store, Number(req.params.id)) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Culture Cars -- a real, separate vehicle attribute-based valuation,
// by direct instruction: "most of it will be based on value, miles,
// engine, the thing." Real attributes are set via the existing
// `POST /api/card/:id/statistics` route (no new "owner can insert
// data" mechanic needed); this is a read-only lookup.
app.get('/api/card/:id/vehicle-value', (req, res) => {
  try {
    res.json(computeVehicleCardValue(store, { cardId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Real Culture Car Clubs, by direct instruction: "also add in groups
// where people could have car clubs... see who has the most value in
// the car club through cards and cars."
app.post('/api/car-club', requireActor('creatorId'), (req, res) => {
  try {
    res.status(201).json(createCarClub(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/car-club/:id', (req, res) => {
  const club = getCarClub(store, Number(req.params.id));
  if (!club) return res.status(404).json({ error: `no car club with id ${req.params.id}` });
  res.json(club);
});

app.post('/api/car-club/:id/join', requireActor('userId'), (req, res) => {
  try {
    res.json(joinCarClub(store, { ...req.body, clubId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/car-club/:id/leave', requireActor('userId'), (req, res) => {
  try {
    res.json(leaveCarClub(store, { ...req.body, clubId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/car-club/:id/leaderboard', (req, res) => {
  try {
    res.json({ leaderboard: getCarClubLeaderboard(store, Number(req.params.id)) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Real VAGO prediction markets on a card's own real market price, by
// direct instruction: "let's also add in our predictions on the
// culture card market as well." Opening a market curates a real
// question about VOKEN's own market -- the same real `voken:grade`-
// shaped curatorial decision this app already gates behind a named
// operator authority elsewhere, decision-logged the same way.
app.post('/api/card/:id/prediction-market', requireOperator('voken:predict'), async (req, res) => {
  const cardId = Number(req.params.id);
  const { thresholdPrice, byDate } = req.body || {};

  try {
    await decisionLog.record({
      route: 'POST /api/card/:id/prediction-market',
      outcomeKind: 'grade',
      subjectType: 'cultureCard',
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
    const card = getCultureCard(store, cardId);
    if (!card) return res.status(404).json({ error: `no card with id ${cardId}` });
    if (!Number.isFinite(thresholdPrice) || thresholdPrice < 0) {
      return res.status(400).json({ error: 'requires a non-negative thresholdPrice' });
    }
    if (!byDate) return res.status(400).json({ error: 'requires a byDate' });

    const { marketPrice } = computeCardMarketPrice(store, { cardId });
    const question = `Will ${describeCardForQuestion(card)}'s VOKEN market price exceed $${thresholdPrice} by ${byDate}? (currently $${marketPrice})`;
    const market = await openVagoMarket({
      question, category: 'culture-cards', creatorId: req.operator.operatorName,
    });

    res.status(201).json(recordCardPredictionMarket(store, {
      cardId, question, thresholdPrice, byDate, vagoMarketId: market ? market.id : null,
    }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Real wallet value, by direct instruction: "when people get the
// cards, they will know how much their wallet is worth." Sums the
// same real market price above across every edition this real owner
// holds -- genuine reuse of computeCardMarketPrice, not a second
// pricing formula.
app.get('/api/wallet/:ownerId/value', (req, res) => {
  try {
    res.json(computeWalletValue(store, { ownerId: req.params.ownerId }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// A real, no-commitment quote -- the same `combinedRealValueScore`
// the sell-back route itself will use to price the payout, surfaced
// first so a seller can see the number before giving up the card.
app.post('/api/card/:id/sell-back-quote', requireSession(), (req, res) => {
  try {
    const card = getCultureCard(store, Number(req.params.id));
    if (!card) return res.status(404).json({ error: `no card with id ${req.params.id}` });
    res.json(computeSellBackValue({ rarityTier: card.rarityTier, combinedRealValueScore: req.body.combinedRealValueScore }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Real instant buyback, matching PrizePicks' real "Sell Back" --
// pays the seller a flagged, interpretive fair market value (see
// lib/sellBack.js) and moves the edition to the platform account.
// `combinedRealValueScore` is supplied by the caller (run the
// value-score route above first), the same injected-signal posture
// valueAlgorithm.js itself takes.
app.post('/api/card/:id/sell-back', requireActor('sellerId'), async (req, res) => {
  try {
    res.json(await sellBackCard(store, { ...req.body, cardId: Number(req.params.id), settleFn: settleVCoin }));
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

// Real pre-purchase odds disclosure, matching the gap against
// PrizePicks' Packs (odds shown before buying, not after). Read-only
// and computed from the real candidate pool the request names, so a
// session is enough -- same posture as the value-score route below.
app.post('/api/pack-tier/:id/odds', requireSession(), (req, res) => {
  try {
    res.json(getPackOdds(store, { ...req.body, packTierId: Number(req.params.id) }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// "make sure we have the numbers correct... how many physical cards.
// How many digital cards?" -- a real, flagged default recommendation
// per rarity tier, grounded against the existing scarcity curve. See
// lib/mintCountGuidance.js's own header for why there is deliberately
// no single global count instead.
app.get('/api/mint-count-guidance', (_req, res) => {
  res.json({ recommendedMintCountsByRarity: RECOMMENDED_MINT_COUNTS_BY_RARITY });
});

app.get('/api/mint-count-guidance/:rarityTier', (req, res) => {
  try {
    res.json(recommendedMintCountsFor(req.params.rarityTier));
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

// A community nomination is never auto-accepted by score -- a real
// named operator decides, the same real "voken:grade" authority
// `analyze` above already requires, recorded in the decision log the
// same way. See lib/cultureCardApplication.js's own header for why.
app.post('/api/application/:id/review-nomination', requireOperator('voken:grade'), async (req, res) => {
  try {
    await decisionLog.record({
      route: 'POST /api/application/:id/review-nomination',
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
    res.json(reviewNomination(store, {
      ...req.body, applicationId: Number(req.params.id), operatorName: req.operator.operatorName,
    }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// The real family claim behind a historic person card's master
// edition, by direct instruction: "for the people who aren't living,
// the initial card... the master card, goes to the family." See
// lib/familyRepresentativeClaims.js's own header for why this is a
// real, operator-reviewed claim rather than something anyone can
// simply assert about a stranger.
app.post('/api/family-representative-claim', requireActor('claimantId'), (req, res) => {
  try {
    res.status(201).json(submitFamilyRepresentativeClaim(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/family-representative-claim/:id', (req, res) => {
  const claim = getFamilyRepresentativeClaim(store, Number(req.params.id));
  if (!claim) return res.status(404).json({ error: `no family-representative claim with id ${req.params.id}` });
  res.json(claim);
});

app.post('/api/family-representative-claim/:id/review', requireOperator('voken:grade'), async (req, res) => {
  try {
    await decisionLog.record({
      route: 'POST /api/family-representative-claim/:id/review',
      outcomeKind: 'grade',
      subjectType: 'familyRepresentativeClaim',
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
    res.json(reviewFamilyRepresentativeClaim(store, {
      ...req.body, claimId: Number(req.params.id), operatorName: req.operator.operatorName,
    }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Real community place nominations, by direct instruction: "we will
// do a lot of the places ourselves. And then we will let people
// nominate places as well." See placeNominations.js's own header for
// why a nomination is never auto-added to the register the way a
// self-initiated application can self-qualify.
app.post('/api/place-nomination', requireActor('nominatorId'), (req, res) => {
  try {
    res.status(201).json(submitPlaceNomination(store, req.body || {}));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/place-nomination/:id', (req, res) => {
  const nomination = getPlaceNomination(store, Number(req.params.id));
  if (!nomination) return res.status(404).json({ error: `no place nomination with id ${req.params.id}` });
  res.json(nomination);
});

app.post('/api/place-nomination/:id/review', requireOperator('voken:grade'), async (req, res) => {
  try {
    await decisionLog.record({
      route: 'POST /api/place-nomination/:id/review',
      outcomeKind: 'grade',
      subjectType: 'placeNomination',
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
    res.json(reviewPlaceNomination(store, {
      ...req.body, nominationId: Number(req.params.id), operatorName: req.operator.operatorName,
    }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Real, operator-approved community-nominated places, browsable
// alongside the fixed register above -- real entries, just not
// hand-curated into historicRegistry.js itself.
app.get('/api/place-nomination/approved/list', (req, res) => {
  try {
    res.json({ entries: listApprovedCustomHistoricEntries(store, req.query.subjectType || null) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// A "view" event's `viewerId` is taken from the real session, never
// the request body -- the whole point of deduping views per viewer
// (by direct instruction: "we'll use it like YouTube. You can only
// view the card once") is that the identity being deduplicated
// against is real, not whatever a caller claims.
app.post('/api/card/:id/engagement', requireSession(), (req, res) => {
  try {
    const body = { ...req.body, cardId: Number(req.params.id) };
    if (body.type === 'view') body.viewerId = req.sessionUserId;
    res.status(201).json(recordEngagementEvent(store, body));
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

// Real card follows, by direct instruction: "you can follow that card
// and you can like that card." `followerId` comes from the real
// session, never the request body -- same discipline as the view
// event above, since a follow is a real relationship tied to a real
// identity.
app.post('/api/card/:id/follow', requireSession(), (req, res) => {
  try {
    res.status(201).json(followCard(store, { cardId: Number(req.params.id), followerId: req.sessionUserId }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/card/:id/follow', requireSession(), (req, res) => {
  try {
    const unfollowed = unfollowCard(store, { cardId: Number(req.params.id), followerId: req.sessionUserId });
    res.json({ unfollowed });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/card/:id/follow', (req, res) => {
  try {
    const cardId = Number(req.params.id);
    const result = { cardId, followerCount: getFollowerCount(store, cardId) };
    if (req.query.followerId) result.isFollowing = isFollowing(store, { cardId, followerId: req.query.followerId });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// A real, per-user follow-notification inbox -- see
// cardNotifications.js's own header for why this exists and why it
// is not routed through vaco-notify.
app.get('/api/notifications/:userId', (req, res) => {
  try {
    res.json({ notifications: getNotificationsForUser(store, req.params.userId) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/notifications/:id/read', requireActor('userId'), (req, res) => {
  try {
    res.json(markNotificationRead(store, { notificationId: Number(req.params.id), userId: req.body.userId }));
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
// `endAuction`/`acceptOffer` take the same `settleFn(legs, meta)`
// convention as every other settlement path in this app, so they're
// wired to `settleVCoin` directly, the same as `placeBid`'s route
// below. These two used to build an injected `transferFn(from, to,
// amount, reason)` closure instead -- a calling convention
// `settleVCoin` stopped supporting when the consecutive-transfer
// helper it replaced was removed (see `settleVCoin`'s own header).
// `lib/auctions.js` has only ever destructured `settleFn`, so that
// option was always undefined and every real auction close or offer
// acceptance threw before any money moved or any card changed hands
// -- the two mechanics that actually pay out a seller were
// unreachable through the real HTTP API, even though
// `test/money.test.js` calls the lib functions directly with the
// right key and stayed green throughout. `settle()` in
// lib/auctions.js already builds a `reason` keyed by `auction.id`
// that is unique and stable across retries, so no wrapping is needed
// here.
app.post('/api/auction/:id/end', requireAuctionSeller(), async (req, res) => {
  try {
    res.json(await endAuction(store, { auctionId: Number(req.params.id), settleFn: settleVCoin }));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/auction/:id/accept-offer', requireAuctionSeller(), async (req, res) => {
  try {
    // Also once-only: accepting an offer settles that auction.
    res.json(await acceptOffer(store, { ...req.body, auctionId: Number(req.params.id), settleFn: settleVCoin }));
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
  res.json(getVadoExplorePage(store));
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
