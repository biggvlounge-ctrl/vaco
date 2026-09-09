// V4 Maps — the shared map layer.
//
// **This closes an asserted-but-unbuilt gap, and a loud one.** Four
// VACON agents already tell users this exists:
//
//   Kevin  — "the proximity/crossing-paths features Convo surfaces
//             through V4's shared map layer"
//   Kay    — "location discovery through V4's shared map layer"
//   Gibson — "dispatch, live routing... all built on V4's shared map
//             layer"
//   DREA   — "real foot-traffic data through V4's shared map layer"
//
// Before this file, V4 had no map code of any kind. Four agents were
// describing a product that did not exist — the same asserted-but-
// unbuilt pattern found elsewhere in this repo, but worse, because
// these claims are made directly to a user in conversation.
//
// **The duplication this consolidates.** Seventeen files across five
// apps implement their own distance math: void (9 modules), cvnvo (3),
// hvntz (3), voidmagic, vavlt-stvdios. Each carries its own Haversine
// copy, and the comment in `void/lib/geo.js` says so explicitly —
// "each project keeping its own copy rather than a forced cross-project
// shared-code dependency."
//
// That was the right call when no shared layer existed. It is the wrong
// call now that one does, and this is the canonical implementation.
//
// **What this is NOT.** Not a tile server, not turn-by-turn navigation,
// and not road-network routing. Distances here are great-circle, which
// under-estimates real driving time — more so in dense cities. Good
// enough to rank, filter, and reject an infeasible plan; not good
// enough to promise a customer an arrival time. Real road routing is a
// vendor decision, and this module is the seam it would slot into.

//: Earth's mean radius. The standard value used by every Haversine
//: implementation already in this repo, kept identical so consolidating
//: onto this module changes no existing result.
export const EARTH_RADIUS_KM = 6371;

//: Assumed average travel speed, matching `void/lib/serviceDay.js` and
//: `void/lib/realEstateMedia.js` exactly. Kept the same on purpose:
//: two modules quietly disagreeing about how long the same trip takes
//: is a bug that only surfaces as a missed appointment.
export const DEFAULT_AVERAGE_SPEED_KMH = 50;

//: What counts as "nearby" when nobody says. Matches VOID's provider
//: service radius default.
export const DEFAULT_NEARBY_RADIUS_KM = 25;

//: How close two people must be to count as a crossing. Small on
//: purpose — this powers CVNVO's proximity feature, and a generous
//: radius turns "you crossed paths" into "you were in the same
//: postcode," which is not the same product.
export const DEFAULT_CROSSING_RADIUS_KM = 0.5;

//: How close in time a crossing must be. Two people in the same place
//: six hours apart did not cross paths.
export const DEFAULT_CROSSING_WINDOW_MINUTES = 30;

const MS_PER_MINUTE = 60 * 1000;

export class MapsError extends Error {}

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

function assertCoordinate(lat, lng, label) {
  // `Number.isFinite` rather than typeof-plus-isNaN. This guard was
  // already safe — Infinity would have failed the range check below —
  // but that made its correctness depend on a later line. One predicate
  // that rejects NaN and both infinities says it here.
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new MapsError(`${label} requires numeric lat and lng`);
  }
  // Catches the single most common geo bug: swapped arguments. A
  // latitude of 120 is not a latitude, and silently computing a
  // distance from it produces a plausible-looking wrong answer.
  if (lat < -90 || lat > 90) throw new MapsError(`${label}: latitude ${lat} is out of range (-90..90)`);
  if (lng < -180 || lng > 180) throw new MapsError(`${label}: longitude ${lng} is out of range (-180..180)`);
}

// -- distance ----------------------------------------------------------

export function distanceKm(lat1, lng1, lat2, lng2) {
  assertCoordinate(lat1, lng1, 'distanceKm origin');
  assertCoordinate(lat2, lng2, 'distanceKm destination');

  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Travel time, stated as an estimate because that is what it is.
export function travelMinutes(lat1, lng1, lat2, lng2, speedKmh = DEFAULT_AVERAGE_SPEED_KMH) {
  if (!Number.isFinite(speedKmh) || speedKmh <= 0) {
    throw new MapsError('travelMinutes requires a positive speedKmh');
  }
  return (distanceKm(lat1, lng1, lat2, lng2) / speedKmh) * 60;
}

// -- places ------------------------------------------------------------
//
// A place is anything on the map: a VOID station, an HVNTZ business, a
// VACAY property, a DREAMS screen, a food district storefront. Apps
// register what they own; the map layer answers questions across all of
// it. That cross-app view is the thing no single app can build for
// itself, and the reason this belongs in V4.

export const PLACE_KINDS = [
  'station', 'business', 'screen', 'property', 'venue', 'storefront', 'user', 'other',
];

export function registerPlace(store, options = {}) {
  const {
    placeId, name, kind, lat, lng, sourceApp,
    attributes = {}, now = Date.now(),
  } = options;

  if (!placeId) throw new MapsError('registerPlace requires a placeId');
  if (!name) throw new MapsError('registerPlace requires a name');
  if (!PLACE_KINDS.includes(kind)) {
    throw new MapsError(`registerPlace: kind must be one of ${PLACE_KINDS.join(', ')}`);
  }
  if (!sourceApp) throw new MapsError('registerPlace requires a sourceApp');
  assertCoordinate(lat, lng, 'registerPlace');

  const existing = store.places.find((p) => p.placeId === placeId);
  if (existing) {
    // Re-registering updates rather than duplicating. A station that
    // moves should move, not appear twice.
    Object.assign(existing, { name, kind, lat, lng, sourceApp, attributes, updatedAt: now });
    return existing;
  }

  const place = { placeId, name, kind, lat, lng, sourceApp, attributes, createdAt: now, updatedAt: now };
  store.places.push(place);
  return place;
}

export function getPlace(store, placeId) {
  return store.places.find((p) => p.placeId === placeId) || null;
}

export function removePlace(store, placeId) {
  const idx = store.places.findIndex((p) => p.placeId === placeId);
  if (idx === -1) return false;
  store.places.splice(idx, 1);
  return true;
}

// The core query, and the one every app currently reimplements:
// what is near here?
export function nearby(store, options = {}) {
  const {
    lat, lng, radiusKm = DEFAULT_NEARBY_RADIUS_KM,
    kind = null, sourceApp = null, limit = 50,
  } = options;

  assertCoordinate(lat, lng, 'nearby');
  if (!Number.isFinite(radiusKm) || radiusKm <= 0) {
    throw new MapsError('nearby requires a positive radiusKm');
  }

  return store.places
    .filter((p) => (kind === null || p.kind === kind))
    .filter((p) => (sourceApp === null || p.sourceApp === sourceApp))
    .map((p) => ({ ...p, distanceKm: distanceKm(lat, lng, p.lat, p.lng) }))
    .filter((p) => p.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit);
}

// A bounding box, for a viewport rather than a radius. Cheaper than
// computing distance to every place when the caller is rendering a map
// rectangle rather than asking "what is near me."
export function withinBounds(store, options = {}) {
  const { northLat, southLat, eastLng, westLng, kind = null } = options;
  if ([northLat, southLat, eastLng, westLng].some((v) => !Number.isFinite(v))) {
    throw new MapsError('withinBounds requires numeric northLat, southLat, eastLng, westLng');
  }
  if (northLat < southLat) throw new MapsError('withinBounds: northLat must be above southLat');

  return store.places.filter((p) => (kind === null || p.kind === kind)
    && p.lat <= northLat && p.lat >= southLat
    && p.lng <= eastLng && p.lng >= westLng);
}

// -- crossings ---------------------------------------------------------
//
// What Kevin's system prompt promises CVNVO. Two people crossed paths
// if they were close in space AND close in time. Both conditions are
// required, and the time one is what makes it meaningful rather than
// creepy — being in the same place a day apart is not a crossing.

export function recordSighting(store, options = {}) {
  const { userId, lat, lng, at = Date.now(), sourceApp = 'unknown' } = options;
  if (!userId) throw new MapsError('recordSighting requires a userId');
  assertCoordinate(lat, lng, 'recordSighting');

  const sighting = { userId, lat, lng, at, sourceApp };
  store.sightings.push(sighting);
  return sighting;
}

export function findCrossings(store, options = {}) {
  const {
    userId,
    radiusKm = DEFAULT_CROSSING_RADIUS_KM,
    windowMinutes = DEFAULT_CROSSING_WINDOW_MINUTES,
    since = 0,
  } = options;

  if (!userId) throw new MapsError('findCrossings requires a userId');

  const mine = store.sightings.filter((s) => s.userId === userId && s.at >= since);
  const others = store.sightings.filter((s) => s.userId !== userId && s.at >= since);
  const windowMs = windowMinutes * MS_PER_MINUTE;

  const crossings = new Map();
  for (const m of mine) {
    for (const o of others) {
      if (Math.abs(o.at - m.at) > windowMs) continue;
      const km = distanceKm(m.lat, m.lng, o.lat, o.lng);
      if (km > radiusKm) continue;

      const existing = crossings.get(o.userId);
      // Keep the closest crossing per person rather than every one,
      // so a shared commute does not report fifty crossings.
      if (!existing || km < existing.distanceKm) {
        crossings.set(o.userId, {
          userId: o.userId,
          distanceKm: km,
          at: o.at,
          minutesApart: Math.round(Math.abs(o.at - m.at) / MS_PER_MINUTE),
        });
      }
    }
  }
  return [...crossings.values()].sort((a, b) => a.distanceKm - b.distanceKm);
}

// -- foot traffic ------------------------------------------------------
//
// What DREA's system prompt promises DREAMS. Counts sightings near a
// place over a window — the signal that makes traffic-based dynamic
// screen pricing real rather than asserted.
//
// **Honest scope:** this counts what apps report, and nothing more. It
// is not independent measurement, and no advertiser would accept it as
// audited. DREAMS' own comparables document names that gap; this
// module does not close it.

export function footTraffic(store, options = {}) {
  const {
    lat, lng, radiusKm = 0.2, fromTimestamp = 0, toTimestamp = Date.now(),
  } = options;
  assertCoordinate(lat, lng, 'footTraffic');

  const inRange = store.sightings.filter((s) => s.at >= fromTimestamp
    && s.at <= toTimestamp
    && distanceKm(lat, lng, s.lat, s.lng) <= radiusKm);

  return {
    sightings: inRange.length,
    uniqueUsers: new Set(inRange.map((s) => s.userId)).size,
    radiusKm,
    fromTimestamp,
    toTimestamp,
    //: Stated on every response rather than in documentation, because
    //: the caller pricing an ad slot is the one who needs to know.
    measurement: 'self-reported by ecosystem apps; not independently audited',
  };
}

// -- route -------------------------------------------------------------
//
// A multi-stop route with cumulative distance and time. Deliberately
// preserves the caller's stop order rather than optimising it: VOID
// already has real TSP-D/2-opt optimisation in `droneRouting.js`, and a
// second, worse optimiser here would be a liability rather than a
// feature.

export function routeThrough(stops, options = {}) {
  const { speedKmh = DEFAULT_AVERAGE_SPEED_KMH } = options;
  if (!Array.isArray(stops) || stops.length < 2) {
    throw new MapsError('routeThrough requires at least two stops');
  }
  stops.forEach((s, i) => assertCoordinate(s.lat, s.lng, `routeThrough stop ${i}`));

  const legs = [];
  let totalKm = 0;
  for (let i = 1; i < stops.length; i += 1) {
    const from = stops[i - 1];
    const to = stops[i];
    const km = distanceKm(from.lat, from.lng, to.lat, to.lng);
    totalKm += km;
    legs.push({
      from: from.label || i - 1,
      to: to.label || i,
      distanceKm: Math.round(km * 100) / 100,
      travelMinutes: Math.round((km / speedKmh) * 60),
    });
  }

  return {
    legs,
    totalDistanceKm: Math.round(totalKm * 100) / 100,
    totalTravelMinutes: Math.round((totalKm / speedKmh) * 60),
    estimateBasis: 'great-circle distance at an assumed average speed; not road routing',
  };
}

export function describeMaps(store) {
  const byApp = {};
  for (const p of store.places) byApp[p.sourceApp] = (byApp[p.sourceApp] || 0) + 1;
  return {
    places: store.places.length,
    placesByApp: byApp,
    sightings: store.sightings.length,
    defaults: {
      averageSpeedKmh: DEFAULT_AVERAGE_SPEED_KMH,
      nearbyRadiusKm: DEFAULT_NEARBY_RADIUS_KM,
      crossingRadiusKm: DEFAULT_CROSSING_RADIUS_KM,
      crossingWindowMinutes: DEFAULT_CROSSING_WINDOW_MINUTES,
    },
    limitations: [
      'great-circle distance, not road routing',
      'foot traffic is self-reported, not independently audited',
      'no tile serving or turn-by-turn navigation',
    ],
  };
}
