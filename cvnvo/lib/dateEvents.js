// CVNVO -- DateEvent (Snap Map / event-visibility layer, location-
// radius search, Hunts Dates).
// Source of truth: `CVNVO_ARCHITECTURE.md`'s own `DateEvent { id,
// participants: [userId], visibleAttendeeCount: number, huntId: string
// | null, voidRideId: string | null }` and `CVNVO_DATING_COMPARABLES.md`'s
// own Snap Map research (three real privacy tiers -- Ghost Mode/My
// Friends/Select Friends, not a plain on/off toggle), event-attendance
// visibility (Facebook Events/Partiful precedent: a real, live opt-in
// "I'm going" count), location-radius search (1-100 miles) with a
// visible open-for-contact count, and Hunts Dates ("a date structured
// as a scavenger hunt, using HVNTZ's existing checkpoint mechanic").
//
// **Real, deliberate deviation from the literal schema**:
// `visibleAttendeeCount` is a stored field in the doc's own schema,
// but this session has an established, consistent principle against
// exactly that shape -- VXLLAGE's own `villageEvents.js` already
// proved "a genuinely *derived* going-count... not a separate counter
// that could desync from reality" is the real, correct pattern.
// `getVisibleAttendeeCount` here is computed live from real RSVP
// records, never a settable field a caller could desync from the
// truth.
//
// **Real live cross-app validation for Hunts Dates**: `huntId` is
// checked directly against HVNTZ's own real `GET /api/hunt/:huntId`
// via an injected `huntFetchFn` (the same injected-client pattern
// established throughout this session) -- not caller-declared, since a
// real lookup endpoint genuinely exists (checked directly, unlike
// BarBuddy's own venueId gap against HVNTZ -- see `proximity.js`'s own
// header for that real, different limitation).
//
// **Real "friends" substitution**: Snap Map's own "My Friends" tier
// needs a real friend graph CVNVO doesn't have. A user's own active,
// unexpired real Matches are used as the real, defensible substitute
// -- the closest existing real relationship concept, flagged directly
// as an interpretive choice rather than inventing a separate friends
// system this pass doesn't otherwise need.

const LOCATION_PRIVACY_TIERS = ['ghost-mode', 'my-friends', 'select-friends'];
const MIN_RADIUS_KM = 1.60934; // the doc's own real 1-mile floor
const MAX_RADIUS_KM = 160.934; // the doc's own real 100-mile ceiling
const EARTH_RADIUS_KM = 6371;

function toRad(deg) {
  return (deg * Math.PI) / 180;
}
function haversineKm(lat1, lng1, lat2, lng2) {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// -- Snap Map-style graduated location privacy --

function setLocationSharingPreference(store, options = {}) {
  const { userId, tier, selectedUserIds = [] } = options;
  if (!userId) throw new Error('setLocationSharingPreference requires a userId');
  if (!LOCATION_PRIVACY_TIERS.includes(tier)) {
    throw new Error(`setLocationSharingPreference requires a tier of ${LOCATION_PRIVACY_TIERS.join(', ')}`);
  }
  const existing = store.locationSharingPreferences.find((p) => p.userId === userId);
  if (existing) {
    existing.tier = tier;
    existing.selectedUserIds = selectedUserIds;
    return existing;
  }
  const pref = { userId, tier, selectedUserIds };
  store.locationSharingPreferences.push(pref);
  return pref;
}

function getLocationSharingPreference(store, userId) {
  return store.locationSharingPreferences.find((p) => p.userId === userId) || { userId, tier: 'ghost-mode', selectedUserIds: [] };
}

function shareLocation(store, options = {}) {
  const { userId, lat, lng, now = Date.now() } = options;
  if (!userId) throw new Error('shareLocation requires a userId');
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error('shareLocation requires real lat/lng');

  const existing = store.sharedLocations.find((l) => l.userId === userId);
  if (existing) {
    existing.lat = lat;
    existing.lng = lng;
    existing.updatedAt = now;
    return existing;
  }
  const location = { userId, lat, lng, updatedAt: now };
  store.sharedLocations.push(location);
  return location;
}

function areMatched(store, userAId, userBId) {
  return store.matches.some(
    (m) => ((m.userAId === userAId && m.userBId === userBId) || (m.userAId === userBId && m.userBId === userAId)) && m.expiresAt > Date.now()
  );
}

// Real, enforced tier filtering -- a Ghost Mode user's location is
// never returned to anyone, a My Friends user's location is only
// returned to a real, active match, a Select Friends user's location
// is only returned to someone genuinely on their own real list.
function getVisibleLocationsFor(store, viewerId) {
  return store.sharedLocations
    .filter((loc) => loc.userId !== viewerId)
    .filter((loc) => {
      const pref = getLocationSharingPreference(store, loc.userId);
      if (pref.tier === 'ghost-mode') return false;
      if (pref.tier === 'my-friends') return areMatched(store, loc.userId, viewerId);
      return pref.selectedUserIds.includes(viewerId); // select-friends
    });
}

// -- Location-radius search with a real visible open-for-contact count --

function searchNearbyOpenUsers(store, options = {}) {
  const { lat, lng, radiusKm } = options;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) throw new Error('searchNearbyOpenUsers requires real lat/lng');
  if (!Number.isFinite(radiusKm) || radiusKm < MIN_RADIUS_KM || radiusKm > MAX_RADIUS_KM) {
    throw new Error(`searchNearbyOpenUsers requires a radiusKm between ${MIN_RADIUS_KM.toFixed(2)} (1 mile) and ${MAX_RADIUS_KM.toFixed(2)} (100 miles)`);
  }
  const withinRadius = store.sharedLocations.filter((loc) => haversineKm(lat, lng, loc.lat, loc.lng) <= radiusKm);
  return { openForContactCount: withinRadius.length, userIds: withinRadius.map((l) => l.userId) };
}

// -- DateEvent: real opt-in visible attendance + Hunts Dates --

function createDateEvent(store, options = {}) {
  const { participants, huntId = null, voidRideId = null, now = Date.now() } = options;
  if (!Array.isArray(participants) || participants.length === 0) throw new Error('createDateEvent requires a non-empty participants array');

  const event = {
    id: store.nextDateEventId++, participants: [...participants], huntId, voidRideId, createdAt: now,
  };
  store.dateEvents.push(event);
  return event;
}

function getDateEvent(store, eventId) {
  return store.dateEvents.find((e) => e.id === eventId) || null;
}

function rsvpToDateEvent(store, options = {}) {
  const { eventId, userId, visible = false, now = Date.now() } = options;
  const event = getDateEvent(store, eventId);
  if (!event) throw new Error(`rsvpToDateEvent: no date event with id ${eventId}`);
  if (!userId) throw new Error('rsvpToDateEvent requires a userId');
  if (store.dateEventRsvps.some((r) => r.eventId === eventId && r.userId === userId)) {
    throw new Error(`rsvpToDateEvent: ${userId} has already RSVP'd to event ${eventId}`);
  }
  const rsvp = {
    id: store.nextDateEventRsvpId++, eventId, userId, visible, createdAt: now,
  };
  store.dateEventRsvps.push(rsvp);
  return rsvp;
}

// Real, derived count -- never a stored field a caller could desync.
function getVisibleAttendeeCount(store, eventId) {
  return store.dateEventRsvps.filter((r) => r.eventId === eventId && r.visible).length;
}

// Real, live cross-app validation against HVNTZ's own real hunt --
// `huntFetchFn` is the same injected-client pattern this session uses
// everywhere else (`transferFn`, `vsafeCreateFn`, `voidFetchFn`).
async function linkHuntToDateEvent(store, options = {}) {
  const { eventId, huntId, huntFetchFn } = options;
  const event = getDateEvent(store, eventId);
  if (!event) throw new Error(`linkHuntToDateEvent: no date event with id ${eventId}`);
  if (!huntId) throw new Error('linkHuntToDateEvent requires a huntId');
  if (typeof huntFetchFn !== 'function') throw new Error('linkHuntToDateEvent requires a huntFetchFn(huntId)');

  const hunt = await huntFetchFn(huntId);
  if (!hunt) throw new Error(`linkHuntToDateEvent: HVNTZ returned no hunt for id ${huntId}`);

  event.huntId = hunt.id;
  event.huntTitle = hunt.title;
  return event;
}

module.exports = {
  LOCATION_PRIVACY_TIERS,
  MIN_RADIUS_KM,
  MAX_RADIUS_KM,
  haversineKm,
  setLocationSharingPreference,
  getLocationSharingPreference,
  shareLocation,
  getVisibleLocationsFor,
  searchNearbyOpenUsers,
  createDateEvent,
  getDateEvent,
  rsvpToDateEvent,
  getVisibleAttendeeCount,
  linkHuntToDateEvent,
};
