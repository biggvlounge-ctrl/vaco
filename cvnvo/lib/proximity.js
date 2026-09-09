// CVNVO -- real-world proximity dating (Happn-model) + BarBuddy +
// FlashNotes.
// Source of truth: `CVNVO_ARCHITECTURE.md`'s own `ProximityEvent {
// userId, otherUserId, lat, lng, timestamp }` ("stored only as
// intersection points, not continuous location history") and
// `CVNVO_DATING_COMPARABLES.md`'s own Happn research: GPS detects two
// users physically crossing paths within a real 250-meter radius, and
// that person appears on a chronological timeline -- privacy-
// preserving by design, only the intersection point saved. FlashNotes
// (a message sent *before* a match is confirmed) and BarBuddy (a
// venue-specific narrowing of this same mechanic, per
// `CVNVO_BARBUDDY_FEATURE.md`'s own "a specific, venue-focused version
// of CVNVO's already-existing Happyn-style proximity dating format")
// live here too, since both are real applications of the same
// crossing-paths idea, not separate systems.
//
// Real, reused math: the same Haversine great-circle formula already
// established in `compatibility.js` (not cross-imported -- this
// session's own established posture is to reimplement real shared
// math per-module rather than share a package).
//
// **BarBuddy's HVNTZ tie -- previously flagged as blocked, now real**:
// `CVNVO_BARBUDDY_FEATURE.md` says a venue "ties directly to a real
// HVNTZ-partnered bar/venue." This header used to record that HVNTZ
// had no `GET /api/business/:id` route to validate against, so
// `venueId` was caller-declared only. That route now exists, and
// `checkInAtVenue`'s `verifyAgainstHvntz` + `hvntzFetchFn` path is
// wired live in `server.js` (`POST /api/barbuddy/check-in` passes
// `fetchBusiness`). A verified venue records the real HVNTZ business
// name on `venue.hvntzBusinessName`.
//
// Validation stays **opt-in per check-in rather than mandatory**, and
// that is a real choice, not leftover caution: a hard requirement
// would make every BarBuddy check-in fail whenever HVNTZ is
// unreachable, turning a social feature into a hard dependency on
// another service's uptime. Same "fail soft on signals" posture used
// for VACA verification signals elsewhere -- the venue link is a
// signal, not money.
//
// **Real, deliberate trust-first default**: `isVisibleToOthersAtVenue`
// defaults to `false` (opt-in, not opt-out) -- CVNVO's own established
// safety-first positioning (per `CVNVO_CORE_FEATURES.md`'s own
// framing) argues for requiring an explicit real action to become
// visible at a venue, not defaulting a user into being seen.

const EARTH_RADIUS_KM = 6371;
const HAPPN_CROSSING_RADIUS_KM = 0.25; // Happn's own real, published 250m radius

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// A real crossing -- only recorded if the two real coordinate pairs
// are genuinely within Happn's own real radius; only the intersection
// point itself is stored, never a continuous location trail.
function recordProximityEvent(store, options = {}) {
  const {
    userId, otherUserId, lat, lng, otherLat, otherLng, now = Date.now(),
  } = options;
  if (!userId || !otherUserId) throw new Error('recordProximityEvent requires userId and otherUserId');
  if (userId === otherUserId) throw new Error('recordProximityEvent: userId and otherUserId must differ');
  if ([lat, lng, otherLat, otherLng].some((n) => !Number.isFinite(n))) {
    throw new Error('recordProximityEvent requires real lat/lng for both users');
  }

  const distanceKm = haversineKm(lat, lng, otherLat, otherLng);
  if (distanceKm > HAPPN_CROSSING_RADIUS_KM) {
    throw new Error(`recordProximityEvent: users are ${Math.round(distanceKm * 1000)}m apart, outside the real ${HAPPN_CROSSING_RADIUS_KM * 1000}m crossing radius`);
  }

  const event = {
    id: store.nextProximityEventId++, userId, otherUserId, lat, lng, distanceKm: Math.round(distanceKm * 1000) / 1000, timestamp: now,
  };
  store.proximityEvents.push(event);
  return event;
}

// Happn's own real chronological-timeline feed -- every real crossing
// involving this user, most recent first.
function getProximityFeed(store, userId) {
  return store.proximityEvents
    .filter((e) => e.userId === userId || e.otherUserId === userId)
    .sort((a, b) => b.timestamp - a.timestamp);
}

// FlashNotes -- a real icebreaker sent before any match exists, so it
// deliberately doesn't touch `lib/messages.js`'s own match-scoped
// store (that module requires a real, existing Match; this is
// pre-match by definition).
function sendFlashNote(store, options = {}) {
  const { senderId, recipientId, text, now = Date.now() } = options;
  if (!senderId || !recipientId) throw new Error('sendFlashNote requires senderId and recipientId');
  if (senderId === recipientId) throw new Error('sendFlashNote: senderId and recipientId must differ');
  if (typeof text !== 'string' || text.trim().length === 0) throw new Error('sendFlashNote requires non-empty text');

  const note = {
    id: store.nextFlashNoteId++, senderId, recipientId, text, createdAt: now,
  };
  store.flashNotes.push(note);
  return note;
}

function getFlashNotesForUser(store, userId) {
  return store.flashNotes.filter((n) => n.recipientId === userId).sort((a, b) => b.createdAt - a.createdAt);
}

// -- BarBuddy: venue-specific narrowing of the same crossing-paths idea --

function getOrCreateVenue(store, venueId) {
  let venue = store.barBuddyVenues.find((v) => v.venueId === venueId);
  if (!venue) {
    venue = {
      venueId, currentCheckedInUsers: [], hvntzVerified: false, hvntzBusinessName: null,
    };
    store.barBuddyVenues.push(venue);
  }
  return venue;
}

// Real, opt-in live validation against HVNTZ (`verifyAgainstHvntz` +
// an injected `hvntzFetchFn`), deliberately not the default: `venueId`
// is also used for VDP's Dating Village (a real, fixed, synthetic
// venue id, `vdp-dating-village`, never an actual HVNTZ business) --
// forcing validation on every check-in would break that already-live
// integration. Real-world BarBuddy check-ins can opt in; VDP's own
// call into this same function never does, unaffected. Once verified,
// the venue's own real HVNTZ business name is stored and reused for
// every later check-in at the same venueId, not re-fetched each time.
async function checkInAtVenue(store, options = {}) {
  const {
    userId, venueId, isVisibleToOthersAtVenue = false, verifyAgainstHvntz = false, hvntzFetchFn, now = Date.now(),
  } = options;
  if (!userId) throw new Error('checkInAtVenue requires a userId');
  if (!venueId) throw new Error('checkInAtVenue requires a venueId');
  if (store.barBuddyCheckIns.some((c) => c.userId === userId && c.venueId === venueId && c.checkedOutAt === null)) {
    throw new Error(`checkInAtVenue: ${userId} is already checked in at venue ${venueId}`);
  }

  const venue = getOrCreateVenue(store, venueId);

  if (verifyAgainstHvntz && !venue.hvntzVerified) {
    if (typeof hvntzFetchFn !== 'function') throw new Error('checkInAtVenue: verifyAgainstHvntz requires an hvntzFetchFn(venueId)');
    const business = await hvntzFetchFn(venueId);
    if (!business) throw new Error(`checkInAtVenue: HVNTZ has no real business with id ${venueId}`);
    venue.hvntzVerified = true;
    venue.hvntzBusinessName = business.name;
  }

  const checkIn = {
    id: store.nextBarBuddyCheckInId++, userId, venueId, isVisibleToOthersAtVenue, checkedInAt: now, checkedOutAt: null,
  };
  store.barBuddyCheckIns.push(checkIn);

  if (!venue.currentCheckedInUsers.includes(userId)) venue.currentCheckedInUsers.push(userId);

  return checkIn;
}

function checkOutOfVenue(store, options = {}) {
  const { userId, venueId, now = Date.now() } = options;
  const checkIn = store.barBuddyCheckIns.find((c) => c.userId === userId && c.venueId === venueId && c.checkedOutAt === null);
  if (!checkIn) throw new Error(`checkOutOfVenue: ${userId} is not currently checked in at venue ${venueId}`);
  checkIn.checkedOutAt = now;

  const venue = getOrCreateVenue(store, venueId);
  venue.currentCheckedInUsers = venue.currentCheckedInUsers.filter((id) => id !== userId);

  return checkIn;
}

function setVenueVisibility(store, options = {}) {
  const { userId, venueId, isVisibleToOthersAtVenue } = options;
  const checkIn = store.barBuddyCheckIns.find((c) => c.userId === userId && c.venueId === venueId && c.checkedOutAt === null);
  if (!checkIn) throw new Error(`setVenueVisibility: ${userId} is not currently checked in at venue ${venueId}`);
  if (typeof isVisibleToOthersAtVenue !== 'boolean') throw new Error('setVenueVisibility requires a boolean isVisibleToOthersAtVenue');
  checkIn.isVisibleToOthersAtVenue = isVisibleToOthersAtVenue;
  return checkIn;
}

// Real, enforced privacy filter -- only checked-in users who have
// genuinely opted in are ever returned, never every checked-in user
// regardless of their own toggle.
function getVisibleUsersAtVenue(store, venueId) {
  return store.barBuddyCheckIns
    .filter((c) => c.venueId === venueId && c.checkedOutAt === null && c.isVisibleToOthersAtVenue)
    .map((c) => c.userId);
}

module.exports = {
  HAPPN_CROSSING_RADIUS_KM,
  haversineKm,
  recordProximityEvent,
  getProximityFeed,
  sendFlashNote,
  getFlashNotesForUser,
  checkInAtVenue,
  checkOutOfVenue,
  setVenueVisibility,
  getVisibleUsersAtVenue,
};
