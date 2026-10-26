// VAGO -- real prediction markets on VOKEN's own Cvltvre Card market,
// by direct instruction: "let's also add in our predictions on the
// culture card market as well." The failure this file exists to
// catch: a 'voken-culture-card' market either refused by
// createPredictionMarket (the source list never actually updated) or
// mixed into another source's listing.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { MARKET_SOURCES, createPredictionMarket, listMarketsBySource } = require('../lib/predictionMarkets');
const { createVagoStore } = require('../lib/store');

test('voken-culture-card is a real, accepted market source', () => {
  assert.ok(MARKET_SOURCES.includes('voken-culture-card'));
});

test('a real voken-culture-card market can be opened and is listed only under its own source', () => {
  const store = createVagoStore();
  const market = createPredictionMarket(store, {
    question: "Will the Ada Lovelace Cvltvre Card's market price exceed $500 by 2027-01-01?",
    category: 'culture-cards',
    source: 'voken-culture-card',
    creatorId: 'voken-service',
  });
  assert.equal(market.source, 'voken-culture-card');

  const vokenMarkets = listMarketsBySource(store, 'voken-culture-card');
  assert.equal(vokenMarkets.length, 1);
  assert.equal(vokenMarkets[0].id, market.id);

  const realWorldMarkets = listMarketsBySource(store, 'real-world');
  assert.equal(realWorldMarkets.length, 0, 'a voken-culture-card market must never show up under a different source');
});
