// DREAMS -- government emergency broadcast override.
//
// Per direct instruction: "these screens can all be controlled as
// once by the government to give out one message" for a real weather
// emergency, a wanted/missing-person alert, or an off-grid search --
// distinct from "this is also a way for people to promote an album, a
// song, a product... it's similar to how the dreams is used," which
// is already real: an ordinary advertiser's campaign (`campaigns.js`)
// is exactly that channel, and nothing new was needed for it. What is
// new here is the government's own single, overriding message.
//
// No end-user session can author this. The AI-run government this
// world's own docs describe has no browser session of its own to
// present to DREAMS, so the route this module backs
// (`POST /api/emergency-broadcast` in server.js) is
// service-credential-only (`requireCallingService`) -- the same shape
// VOID's own government job postings and VDP's own book-purchase
// effect already use for an internal service acting with no human
// behind it.
//
// **Exactly one active broadcast, ecosystem-wide, by design.** "One
// message" is the direct instruction -- `activeEmergencyBroadcastId`
// is a single slot, not a queue, so a second real push replaces the
// first outright rather than layering messages a screen would have to
// pick between.

const { resolveOfflineContent } = require('./offlineCache');

//: Flagged interpretive: the direct instruction names weather, a
//: wanted criminal, a missing person, and an off-grid search by
//: example, not as an exhaustive enum. "other" is kept open for a
//: real category this instruction did not enumerate, rather than
//: refusing a real emergency that doesn't fit the four named ones.
const EMERGENCY_BROADCAST_TYPES = ['weather', 'wanted', 'missing-person', 'off-grid-search', 'other'];

function pushEmergencyBroadcast(store, options = {}) {
  const { issuedBy, type, message, now = Date.now() } = options;
  if (!issuedBy) throw new Error('pushEmergencyBroadcast requires issuedBy');
  if (!EMERGENCY_BROADCAST_TYPES.includes(type)) {
    throw new Error(`pushEmergencyBroadcast: type must be one of ${EMERGENCY_BROADCAST_TYPES.join(', ')}`);
  }
  if (!message) throw new Error('pushEmergencyBroadcast requires a message');

  const broadcast = {
    id: store.nextEmergencyBroadcastId++,
    issuedBy,
    type,
    message,
    issuedAt: now,
    clearedAt: null,
    clearedBy: null,
  };
  store.emergencyBroadcasts.push(broadcast);
  store.activeEmergencyBroadcastId = broadcast.id;
  return broadcast;
}

function getActiveEmergencyBroadcast(store) {
  if (!store.activeEmergencyBroadcastId) return null;
  return store.emergencyBroadcasts.find((b) => b.id === store.activeEmergencyBroadcastId) || null;
}

function clearEmergencyBroadcast(store, options = {}) {
  const { clearedBy = null, now = Date.now() } = options;
  const active = getActiveEmergencyBroadcast(store);
  if (!active) throw new Error('clearEmergencyBroadcast: no active emergency broadcast');
  active.clearedAt = now;
  active.clearedBy = clearedBy;
  store.activeEmergencyBroadcastId = null;
  return active;
}

function listEmergencyBroadcasts(store) {
  return store.emergencyBroadcasts;
}

// The one real "what should this screen show right now" question,
// asked network-wide. An active broadcast overrides every real
// screen at once -- live, cached, mid-campaign, all the same -- which
// is the literal ask. No broadcast active defers to the one other
// real per-screen resolver that already exists, `offlineCache.js`'s
// own connectivity-loss fallback -- this never invents a second,
// competing idea of what an *online*, non-emergency screen should be
// showing, since nothing in this app decides that today;
// `recordImpression` is still what actually bills and logs a real ad
// run.
function resolveScreenContent(store, options = {}) {
  const { screenId, now = Date.now() } = options;
  // A broadcast overrides every real screen -- but "every real
  // screen" is the operative word. Checked here rather than left to
  // whichever branch runs, since skipping it on the broadcast path
  // would report a resolved override for a screenId that was never
  // actually registered.
  if (!store.screens.find((s) => s.id === screenId)) {
    throw new Error(`resolveScreenContent: no screen with id ${screenId}`);
  }
  const broadcast = getActiveEmergencyBroadcast(store);
  if (broadcast) {
    return { screenId, action: 'serve-emergency-broadcast', broadcast, creative: null };
  }
  return resolveOfflineContent(store, { screenId, now });
}

module.exports = {
  EMERGENCY_BROADCAST_TYPES,
  pushEmergencyBroadcast,
  getActiveEmergencyBroadcast,
  clearEmergencyBroadcast,
  listEmergencyBroadcasts,
  resolveScreenContent,
};
