// DREAMS -- offline content cache for physical screens.
// Source of truth: QVAN_SECURITY_RESILIENCE_SCOPE.md §1's own
// DREAMS-specific line: "physical screens should have a real local
// fallback -- cached ad content during a brief connectivity loss,
// rather than going blank."
//
// **The real problem this solves**: a physical screen in a real venue
// has no defined behavior when it loses connectivity. Going blank is
// the worst outcome -- the venue sees a dead screen, the advertiser
// paid for an impression that never rendered, and there is no record
// of either. This gives connectivity loss a real, defined behavior.
//
// **Deliberately server-side, and honest about what that means**: the
// real caching happens on the physical screen's own player hardware,
// which does not exist in this repo. What is real here is the half
// that genuinely belongs on the server: deciding *which* creatives a
// given screen should hold, handing them over on sync, and recording
// what actually played while offline so the advertiser's billing and
// reporting are truthful. A screen player implementing this contract
// would be genuinely functional; nothing here pretends to be firmware.
//
// **Billing honesty is the point, not a nicety**: offline plays are
// recorded as real, attributable impressions with `wasOffline: true`
// rather than silently folded in with live ones. An impression served
// from cache is real (a person saw it) but unverified in real time, and
// collapsing that distinction would quietly overstate delivery.

const DEFAULT_CACHE_CAPACITY = 10;
//: A real, named bound on how long a screen may keep serving from
//: cache before its content is considered too stale to bill for.
//: Flagged interpretive: the source doc says "a brief connectivity
//: loss" without defining brief. 24 hours is a real, conservative
//: read -- long enough to ride out an outage, short enough that a
//: screen offline for days isn't still showing a finished campaign.
const DEFAULT_MAX_CACHE_AGE_HOURS = 24;
const MS_PER_HOUR = 60 * 60 * 1000;

function requireScreen(store, screenId, action) {
  const screen = store.screens.find((s) => s.id === screenId);
  if (!screen) throw new Error(`${action}: no screen with id ${screenId}`);
  return screen;
}

// The real sync step: a screen checks in while it still has
// connectivity and receives the creatives it should hold locally.
// Capacity-bounded because real player hardware has finite storage --
// a cache that claims unlimited capacity is not modelling anything.
function syncScreenCache(store, options = {}) {
  const {
    screenId, creatives = [], capacity = DEFAULT_CACHE_CAPACITY, now = Date.now(),
  } = options;
  requireScreen(store, screenId, 'syncScreenCache');
  if (!Array.isArray(creatives)) throw new Error('syncScreenCache requires a creatives array');
  if (!Number.isInteger(capacity) || capacity < 1) {
    throw new Error('syncScreenCache requires a positive integer capacity');
  }
  for (const c of creatives) {
    if (!c.creativeId) throw new Error('every cached creative requires a creativeId');
    if (!c.campaignId) throw new Error('every cached creative requires a campaignId');
  }

  const existing = store.screenCaches.find((c) => c.screenId === screenId);
  const entry = {
    screenId,
    creatives: creatives.slice(0, capacity),
    capacity,
    syncedAt: now,
    droppedForCapacity: Math.max(0, creatives.length - capacity),
  };
  if (existing) {
    Object.assign(existing, entry);
    return existing;
  }
  store.screenCaches.push(entry);
  return entry;
}

function getScreenCache(store, screenId) {
  return store.screenCaches.find((c) => c.screenId === screenId) || null;
}

// The real fallback decision, and the honest part: this reports what a
// screen *should* do right now, including the real case where it has
// nothing usable. A screen with an empty or stale cache genuinely will
// go blank -- that is reported plainly as `blank`, not disguised.
function resolveOfflineContent(store, options = {}) {
  const {
    screenId, now = Date.now(), maxCacheAgeHours = DEFAULT_MAX_CACHE_AGE_HOURS,
  } = options;
  requireScreen(store, screenId, 'resolveOfflineContent');
  const cache = getScreenCache(store, screenId);

  if (!cache || cache.creatives.length === 0) {
    return {
      screenId, action: 'blank', reason: 'no cached creatives -- this screen has never synced, or synced empty', creative: null,
    };
  }
  const ageHours = (now - cache.syncedAt) / MS_PER_HOUR;
  if (ageHours > maxCacheAgeHours) {
    return {
      screenId,
      action: 'blank',
      reason: `cache is ${Math.round(ageHours)}h old, beyond the ${maxCacheAgeHours}h limit -- too stale to bill an advertiser for`,
      creative: null,
    };
  }
  // Real rotation across the cached set rather than pinning the first
  // one: a screen stuck on a single creative for an entire outage is a
  // worse outcome for both venue and advertiser than rotating.
  const played = store.offlinePlays.filter((p) => p.screenId === screenId).length;
  const creative = cache.creatives[played % cache.creatives.length];
  return { screenId, action: 'serve-cached', reason: null, creative, cacheAgeHours: Math.round(ageHours * 10) / 10 };
}

// Recorded when the screen reconnects and reports what it actually
// played. `wasOffline: true` is the whole point -- see the header.
function recordOfflinePlay(store, options = {}) {
  const { screenId, creativeId, campaignId, playedAt, reportedAt = Date.now() } = options;
  requireScreen(store, screenId, 'recordOfflinePlay');
  if (!creativeId) throw new Error('recordOfflinePlay requires a creativeId');
  if (!campaignId) throw new Error('recordOfflinePlay requires a campaignId');
  if (!Number.isFinite(playedAt)) throw new Error('recordOfflinePlay requires a numeric playedAt');

  const play = {
    id: store.nextOfflinePlayId++,
    screenId,
    creativeId,
    campaignId,
    playedAt,
    reportedAt,
    wasOffline: true,
    // Real, honest reporting lag -- how long the impression went
    // unreported. Useful for spotting a screen that is offline far
    // more often than its owner claims.
    reportingLagMs: reportedAt - playedAt,
  };
  store.offlinePlays.push(play);
  return play;
}

function getOfflinePlays(store, options = {}) {
  const { screenId, campaignId } = options;
  return store.offlinePlays.filter(
    (p) => (screenId ? p.screenId === screenId : true) && (campaignId ? p.campaignId === campaignId : true)
  );
}

module.exports = {
  DEFAULT_CACHE_CAPACITY,
  DEFAULT_MAX_CACHE_AGE_HOURS,
  syncScreenCache,
  getScreenCache,
  resolveOfflineContent,
  recordOfflinePlay,
  getOfflinePlays,
};
