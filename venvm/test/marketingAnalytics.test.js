// AI Analytics' real half -- a plain event log and real, deterministic
// aggregation over it.

const test = require('node:test');
const assert = require('node:assert');

const { recordAnalyticsEvent, analyticsSummary, generateInsights } = require('../lib/marketingAnalytics');
const { PendingIntegrationError } = require('../lib/pendingIntegration');
const { createVenvmStore } = require('../lib/store');

test('recordAnalyticsEvent requires a real brandId and eventType', () => {
  const store = createVenvmStore();
  assert.throws(() => recordAnalyticsEvent(store, { eventType: 'view' }), /requires a real brandId/);
  assert.throws(() => recordAnalyticsEvent(store, { brandId: 1 }), /requires a non-empty eventType/);
});

test('analyticsSummary counts real events by type and computes a real clickThroughRate', () => {
  const store = createVenvmStore();
  recordAnalyticsEvent(store, { brandId: 1, eventType: 'view' });
  recordAnalyticsEvent(store, { brandId: 1, eventType: 'view' });
  recordAnalyticsEvent(store, { brandId: 1, eventType: 'view' });
  recordAnalyticsEvent(store, { brandId: 1, eventType: 'view' });
  recordAnalyticsEvent(store, { brandId: 1, eventType: 'click' });
  recordAnalyticsEvent(store, { brandId: 2, eventType: 'view' }); // a different brand -- must not leak in

  const summary = analyticsSummary(store, { brandId: 1 });
  assert.strictEqual(summary.totalEvents, 5);
  assert.strictEqual(summary.byEventType.view, 4);
  assert.strictEqual(summary.byEventType.click, 1);
  assert.strictEqual(summary.clickThroughRate, 0.25);
});

test('analyticsSummary scopes to a real campaignId when given', () => {
  const store = createVenvmStore();
  recordAnalyticsEvent(store, { brandId: 1, campaignId: 10, eventType: 'view' });
  recordAnalyticsEvent(store, { brandId: 1, campaignId: 20, eventType: 'view' });
  assert.strictEqual(analyticsSummary(store, { brandId: 1, campaignId: 10 }).totalEvents, 1);
  assert.strictEqual(analyticsSummary(store, { brandId: 1 }).totalEvents, 2);
});

test('analyticsSummary is honestly null for clickThroughRate with no real views', () => {
  const store = createVenvmStore();
  recordAnalyticsEvent(store, { brandId: 1, eventType: 'click' });
  assert.strictEqual(analyticsSummary(store, { brandId: 1 }).clickThroughRate, null);
});

test('generateInsights is an honest, labeled pending integration point', () => {
  assert.throws(() => generateInsights(), PendingIntegrationError);
});
