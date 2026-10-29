// VENVM -- Content Calendar: a real, scheduled publish slot for a
// catalogued asset, under a brand and optionally a campaign. The real
// mechanic is scheduling and status tracking -- a plain, enforced
// status machine (`scheduled` -> `published` or `cancelled`, both
// terminal) -- never the generation of the content itself, which
// stays `assetLibrary.js`'s job.
//
// `suggestContentSlots` (AI-driven scheduling/timing recommendations)
// is this module's one real generative sliver -- stubbed via
// `pendingIntegration.js`.

const { getBrand } = require('./brandManagement');
const { getAsset } = require('./assetLibrary');
const { pendingGenerationCall } = require('./pendingIntegration');

const CONTENT_CALENDAR_STATUSES = ['scheduled', 'published', 'cancelled'];

function requireString(value, field, action) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${action} requires a non-empty ${field}`);
  }
  return value.trim();
}

function scheduleContent(store, options = {}) {
  const {
    brandId, campaignId = null, assetId = null, platform, scheduledAt, now = Date.now(),
  } = options;
  if (!getBrand(store, brandId)) throw new Error(`scheduleContent: no brand with id ${brandId}`);
  if (assetId !== null && !getAsset(store, assetId)) {
    throw new Error(`scheduleContent: no asset with id ${assetId}`);
  }
  requireString(platform, 'platform', 'scheduleContent');
  if (!Number.isFinite(scheduledAt)) throw new Error('scheduleContent requires a real scheduledAt timestamp');

  const entry = {
    id: store.nextContentCalendarEntryId++,
    brandId,
    campaignId,
    assetId,
    platform: platform.trim(),
    scheduledAt,
    status: 'scheduled',
    publishedAt: null,
    createdAt: now,
  };
  store.contentCalendarEntries.push(entry);
  return entry;
}

function getContentCalendarEntry(store, entryId) {
  return store.contentCalendarEntries.find((e) => e.id === entryId) || null;
}

function requireScheduled(entry, action) {
  if (entry.status !== 'scheduled') {
    throw new Error(`${action}: entry ${entry.id} is "${entry.status}", expected "scheduled"`);
  }
}

function markPublished(store, options = {}) {
  const { entryId, now = Date.now() } = options;
  const entry = getContentCalendarEntry(store, entryId);
  if (!entry) throw new Error(`markPublished: no content calendar entry with id ${entryId}`);
  requireScheduled(entry, 'markPublished');
  entry.status = 'published';
  entry.publishedAt = now;
  return entry;
}

function cancelScheduledContent(store, options = {}) {
  const { entryId } = options;
  const entry = getContentCalendarEntry(store, entryId);
  if (!entry) throw new Error(`cancelScheduledContent: no content calendar entry with id ${entryId}`);
  requireScheduled(entry, 'cancelScheduledContent');
  entry.status = 'cancelled';
  return entry;
}

// Real, still-pending publish slots for a brand -- `fromTime` lets a
// caller ask "what's upcoming from now," never a guess about the
// current time baked into this module.
function listUpcoming(store, options = {}) {
  const { brandId, fromTime = Date.now() } = options;
  return store.contentCalendarEntries
    .filter((e) => e.brandId === brandId && e.status === 'scheduled' && e.scheduledAt >= fromTime)
    .sort((a, b) => a.scheduledAt - b.scheduledAt);
}

function suggestContentSlots() {
  return pendingGenerationCall('AI content-calendar scheduling suggestions');
}

module.exports = {
  CONTENT_CALENDAR_STATUSES,
  scheduleContent, getContentCalendarEntry, markPublished, cancelScheduledContent,
  listUpcoming, suggestContentSlots,
};
