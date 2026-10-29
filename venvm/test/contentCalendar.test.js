// Content Calendar -- a real, scheduled publish slot with a real,
// enforced status machine.

const test = require('node:test');
const assert = require('node:assert');

const { createBrand } = require('../lib/brandManagement');
const {
  scheduleContent, getContentCalendarEntry, markPublished, cancelScheduledContent,
  listUpcoming, suggestContentSlots,
} = require('../lib/contentCalendar');
const { PendingIntegrationError } = require('../lib/pendingIntegration');
const { createVenvmStore } = require('../lib/store');

function mkBrand(store) {
  return createBrand(store, { name: 'Vvltvre', ownerApp: 'dreams' });
}

test('scheduleContent refuses an unknown brand', () => {
  const store = createVenvmStore();
  assert.throws(() => scheduleContent(store, { brandId: 999999, platform: 'tiktok', scheduledAt: Date.now() }), /no brand with id/);
});

test('scheduleContent creates a real entry, starting scheduled', () => {
  const store = createVenvmStore();
  const brand = mkBrand(store);
  const entry = scheduleContent(store, { brandId: brand.id, platform: 'tiktok', scheduledAt: Date.now() + 1000 });
  assert.strictEqual(entry.status, 'scheduled');
  assert.strictEqual(getContentCalendarEntry(store, entry.id).platform, 'tiktok');
});

test('markPublished and cancelScheduledContent both refuse a non-scheduled entry', () => {
  const store = createVenvmStore();
  const brand = mkBrand(store);
  const entry = scheduleContent(store, { brandId: brand.id, platform: 'tiktok', scheduledAt: Date.now() });
  markPublished(store, { entryId: entry.id });
  assert.throws(() => markPublished(store, { entryId: entry.id }), /expected "scheduled"/);
  assert.throws(() => cancelScheduledContent(store, { entryId: entry.id }), /expected "scheduled"/);
});

test('listUpcoming only returns real, still-scheduled entries at or after fromTime, in order', () => {
  const store = createVenvmStore();
  const brand = mkBrand(store);
  const now = Date.now();
  const soon = scheduleContent(store, { brandId: brand.id, platform: 'tiktok', scheduledAt: now + 1000 });
  const later = scheduleContent(store, { brandId: brand.id, platform: 'tiktok', scheduledAt: now + 2000 });
  const pastButStillScheduled = scheduleContent(store, { brandId: brand.id, platform: 'tiktok', scheduledAt: now - 1000 });
  const cancelled = scheduleContent(store, { brandId: brand.id, platform: 'tiktok', scheduledAt: now + 500 });
  cancelScheduledContent(store, { entryId: cancelled.id });

  const upcoming = listUpcoming(store, { brandId: brand.id, fromTime: now });
  assert.deepEqual(upcoming.map((e) => e.id), [soon.id, later.id], 'a past-dated or cancelled entry must not appear as upcoming');
  assert.ok(!upcoming.some((e) => e.id === pastButStillScheduled.id));
});

test('suggestContentSlots is an honest, labeled pending integration point', () => {
  assert.throws(() => suggestContentSlots(), PendingIntegrationError);
});
