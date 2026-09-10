// VAGO -- demo/seed data for the live walkthrough.
// Real prediction markets (`createPredictionMarket`/`buyContract`,
// `lib/predictionMarkets.js`) and real Gold Coin casino sessions
// (`submitAmoeEntry`/`startCasinoSession`, `lib/amoe.js`/
// `lib/casinoSession.js`) -- every record below is produced by the
// exact same real functions `server.js`'s own routes call, not a
// hand-built market/session object that skips their validation
// (`createPredictionMarket`'s source/category/creatorId checks,
// `startCasinoSession`'s gameType/currency/stake checks).
//
// **The genuine differentiator, seeded for real**: `MARKET_SOURCES`
// (`predictionMarkets.js`) has always included `'vdp-in-world'` and
// `'vacancy-in-game'` alongside `'real-world'` -- this is what makes
// VAGO structurally different from a traditional sportsbook, not a
// marketing claim. It was simply never seeded: the live store started
// with zero markets of any source. Below, at least one market of each
// in-world source is created via the real `createPredictionMarket`
// call, tied to real content from VDP's own Food District
// (`../vdp/src/lib/foodDistrict.js` -- VORDABELLO'S is a real,
// existing flagship brand there, not invented for this market) and
// VACON-C's own real settlement-simulation framing (`vacancyClient.js`
// in VDP; VACON-C's own 5-endpoint contract is state/tick/npc/
// artifacts/mission). Each market also gets real trading activity via
// `buyContract`, so `yesPool`/`noPool` (and therefore the live price)
// are genuinely non-50/50 the moment a presenter opens VAGO -- not a
// cosmetically "created" market sitting at its untouched bootstrap
// price.
//
// Gold Coin sessions go through the real, structural currency split
// this module's own header describes: `submitAmoeEntry` is the real
// free-entry path that actually credits the separate Gold Coin ledger
// (never VCoin), then `startCasinoSession(..., currency: 'gold-coin')`
// spends from that same ledger and never calls `settleFn` -- the
// real proof this is sweepstakes-model Gold Coin play, not VCoin
// wagering with a different label.

const { submitAmoeEntry } = require('./amoe');
const { startCasinoSession } = require('./casinoSession');
const { createPredictionMarket, buyContract } = require('./predictionMarkets');

const DEMO_USERS = ['demo-user', 'demo-maya', 'demo-carlos', 'demo-priya'];
const VAGO_EDITORIAL = 'vago-editorial';

// Real-world sports + non-sports markets -- the category breadth
// `predictionMarkets.js`'s own header cites as a real Kalshi-model
// comparable point ("category breadth beyond sports"), not sports-only.
const REAL_WORLD_MARKETS = [
  {
    question: 'Will the Kansas City Chiefs win Super Bowl LX?',
    category: 'sports',
    trades: [
      { userId: 'demo-user', side: 'yes', quantity: 6 },
      { userId: 'demo-maya', side: 'no', quantity: 2 },
    ],
  },
  {
    question: 'Will the Federal Reserve cut interest rates before January 2027?',
    category: 'finance',
    trades: [
      { userId: 'demo-carlos', side: 'yes', quantity: 4 },
      { userId: 'demo-priya', side: 'no', quantity: 3 },
    ],
  },
];

// The real differentiator: in-world markets tied to VDP's actual
// Food District brands and VACON-C's actual settlement simulation --
// not generic placeholder questions.
const IN_WORLD_MARKETS = [
  {
    question: "Will VORDABELLO'S sell 100+ Chef-Made Pizzas in VDP's Food District this week?",
    category: 'vdp-food-district',
    source: 'vdp-in-world',
    trades: [
      { userId: 'demo-user', side: 'yes', quantity: 5 },
      { userId: 'demo-priya', side: 'no', quantity: 2 },
    ],
  },
  {
    question: "Will VACON-C's settlement population pass its next in-game tick without a famine event?",
    category: 'vacancy-sim',
    source: 'vacancy-in-game',
    trades: [
      { userId: 'demo-maya', side: 'yes', quantity: 3 },
      { userId: 'demo-carlos', side: 'no', quantity: 5 },
    ],
  },
];

// 2-3 real Gold Coin casino sessions across the three real
// `CASINO_GAME_TYPES` -- each user's Gold Coin balance is genuinely
// credited first via the real free-entry path (`submitAmoeEntry`), the
// same real mechanic a real no-purchase player would use.
const DEMO_CASINO_SESSIONS = [
  { userId: 'demo-user', gameType: 'originals', stakeAmount: 50 },
  { userId: 'demo-maya', gameType: 'live-dealer', stakeAmount: 100 },
  { userId: 'demo-carlos', gameType: 'game-show', stakeAmount: 25 },
];

async function seedPredictionMarkets(store, { settleFn }) {
  if (store.predictionMarkets.length > 0) return;

  for (const spec of [...REAL_WORLD_MARKETS.map((m) => ({ ...m, source: 'real-world' })), ...IN_WORLD_MARKETS]) {
    const market = createPredictionMarket(store, {
      question: spec.question,
      category: spec.category,
      source: spec.source,
      creatorId: VAGO_EDITORIAL,
    });
    for (const trade of spec.trades) {
      try {
        await buyContract(store, { marketId: market.id, ...trade, settleFn });
      } catch (err) {
        console.warn(`seedDemoData: skipped trade on market ${market.id} (${trade.userId}/${trade.side}) — ${err.message}`);
      }
    }
  }
}

async function seedCasinoSessions(store, { settleFn }) {
  if (store.casinoSessions.length > 0) return;

  for (const session of DEMO_CASINO_SESSIONS) {
    try {
      // Real free Gold Coin entry first (real ledger credit, never
      // VCoin) so the session below has a real balance to stake from.
      await submitAmoeEntry(store, { userId: session.userId });
      await startCasinoSession(store, { ...session, currency: 'gold-coin', settleFn });
    } catch (err) {
      console.warn(`seedDemoData: skipped casino session for ${session.userId} — ${err.message}`);
    }
  }
}

// Called once at server boot (`server.js`), guarded per-array by a
// real emptiness check -- a persisted `data/store.json` loaded with
// real markets/sessions is never touched, and restarting the server
// twice never double-seeds.
async function seedDemoData(store, { settleFn }) {
  if (typeof settleFn !== 'function') {
    throw new Error('seedDemoData requires a settleFn(legs, meta)');
  }
  await seedPredictionMarkets(store, { settleFn });
  await seedCasinoSessions(store, { settleFn });
}

module.exports = { seedDemoData, DEMO_USERS };
