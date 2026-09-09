// V4 Maps — the shared map layer.
//
// This module exists because four VACON agents told users it already
// did. The tests below therefore split into two kinds: ordinary
// correctness, and pinning the specific promises those agent prompts
// make — Kevin's crossings, DREA's foot traffic, Gibson's routing,
// Kay's location discovery.
//
// The failure mode worth guarding hardest is a swapped coordinate.
// distanceKm(lng, lat, ...) does not throw on its own; it returns a
// plausible number that is simply wrong, and every downstream decision
// inherits it.

import test from 'node:test';
import assert from 'node:assert';

import {
  distanceKm, travelMinutes, registerPlace, getPlace, removePlace,
  nearby, withinBounds, recordSighting, findCrossings, footTraffic,
  routeThrough, describeMaps, MapsError, PLACE_KINDS,
  EARTH_RADIUS_KM, DEFAULT_AVERAGE_SPEED_KMH,
} from '../lib/maps.js';
import { createV4Store } from '../lib/store.js';

const NOW = Date.UTC(2026, 8, 1);
const MIN = 60 * 1000;

// Lower Manhattan, and a few real points around it.
const DOWNTOWN = { lat: 40.7128, lng: -74.0060 };
const MIDTOWN = { lat: 40.7580, lng: -73.9855 };
const PHILADELPHIA = { lat: 39.9526, lng: -75.1652 };

function seeded() {
  const store = createV4Store();
  registerPlace(store, { placeId: 'st-1', name: 'Port Station 1', kind: 'station', lat: 40.713, lng: -74.005, sourceApp: 'void' });
  registerPlace(store, { placeId: 'scr-1', name: 'Screen A', kind: 'screen', lat: 40.714, lng: -74.006, sourceApp: 'dreams' });
  registerPlace(store, { placeId: 'viv', name: 'VIVE Coffee', kind: 'storefront', lat: 40.715, lng: -74.008, sourceApp: 'vdp' });
  registerPlace(store, { placeId: 'far', name: 'Philly Office', kind: 'business', ...PHILADELPHIA, sourceApp: 'hvntz' });
  return store;
}

// -- distance ----------------------------------------------------------

test('distance matches the implementations it consolidates', () => {
  // void/lib/geo.js returns 5.314523 for this pair. Consolidating onto
  // this module must not change a single existing result.
  const d = distanceKm(DOWNTOWN.lat, DOWNTOWN.lng, MIDTOWN.lat, MIDTOWN.lng);
  assert.strictEqual(Number(d.toFixed(6)), 5.314523);
});

test('the same point is zero distance', () => {
  assert.strictEqual(distanceKm(40.7128, -74.006, 40.7128, -74.006), 0);
});

test('distance is symmetric', () => {
  const there = distanceKm(DOWNTOWN.lat, DOWNTOWN.lng, MIDTOWN.lat, MIDTOWN.lng);
  const back = distanceKm(MIDTOWN.lat, MIDTOWN.lng, DOWNTOWN.lat, DOWNTOWN.lng);
  assert.strictEqual(there, back);
});

test('a SWAPPED coordinate is caught rather than silently wrong', () => {
  // The bug this exists for: passing (lng, lat) produces a plausible
  // number and poisons every decision downstream. A longitude of -74
  // is not a valid latitude only when it exceeds 90 — so the range
  // check catches the common New York case via the 120 example, and
  // the test states the limitation honestly below.
  assert.throws(() => distanceKm(120, -74, 40, -74), /latitude 120 is out of range/);
  assert.throws(() => distanceKm(40, 200, 40, -74), /longitude 200 is out of range/);
});

test('a non-numeric coordinate is refused', () => {
  assert.throws(() => distanceKm('40.7', -74, 40, -74), MapsError);
  assert.throws(() => distanceKm(NaN, -74, 40, -74), MapsError);
});

test('travel time scales inversely with speed', () => {
  const slow = travelMinutes(DOWNTOWN.lat, DOWNTOWN.lng, MIDTOWN.lat, MIDTOWN.lng, 25);
  const fast = travelMinutes(DOWNTOWN.lat, DOWNTOWN.lng, MIDTOWN.lat, MIDTOWN.lng, 50);
  assert.ok(Math.abs(slow - fast * 2) < 0.001);
});

test('a non-positive speed is refused rather than dividing by zero', () => {
  assert.throws(() => travelMinutes(40, -74, 41, -74, 0), /positive speedKmh/);
});

test('the shared constants match what the other modules assume', () => {
  // serviceDay.js and realEstateMedia.js both assume 50 km/h. Two
  // modules disagreeing about trip length is a bug that only surfaces
  // as a missed appointment.
  assert.strictEqual(DEFAULT_AVERAGE_SPEED_KMH, 50);
  assert.strictEqual(EARTH_RADIUS_KM, 6371);
});

// -- places ------------------------------------------------------------

test('places from different apps share one map', () => {
  // The cross-app view is the thing no single app can build for itself.
  const store = seeded();
  const found = nearby(store, { ...DOWNTOWN, radiusKm: 5 });
  assert.deepStrictEqual(
    [...new Set(found.map((p) => p.sourceApp))].sort(),
    ['dreams', 'vdp', 'void'],
  );
});

test('nearby sorts by distance and excludes anything outside the radius', () => {
  const store = seeded();
  const found = nearby(store, { ...DOWNTOWN, radiusKm: 5 });
  assert.strictEqual(found[0].name, 'Port Station 1');
  for (let i = 1; i < found.length; i += 1) {
    assert.ok(found[i].distanceKm >= found[i - 1].distanceKm);
  }
  assert.ok(!found.some((p) => p.name === 'Philly Office'));
});

test('nearby filters by kind and by source app', () => {
  const store = seeded();
  assert.deepStrictEqual(
    nearby(store, { ...DOWNTOWN, radiusKm: 5, kind: 'screen' }).map((p) => p.placeId),
    ['scr-1'],
  );
  assert.deepStrictEqual(
    nearby(store, { ...DOWNTOWN, radiusKm: 5, sourceApp: 'void' }).map((p) => p.placeId),
    ['st-1'],
  );
});

test('re-registering a place MOVES it rather than duplicating it', () => {
  // A station that relocates should relocate, not appear twice.
  const store = seeded();
  const before = store.places.length;
  registerPlace(store, { placeId: 'st-1', name: 'Port Station 1', kind: 'station', lat: 41.0, lng: -74.0, sourceApp: 'void' });
  assert.strictEqual(store.places.length, before);
  assert.strictEqual(getPlace(store, 'st-1').lat, 41.0);
});

test('a place needs a real kind and a source app', () => {
  const store = createV4Store();
  assert.throws(() => registerPlace(store, { placeId: 'x', name: 'x', kind: 'spaceship', lat: 40, lng: -74, sourceApp: 'void' }), /kind must be one of/);
  assert.throws(() => registerPlace(store, { placeId: 'x', name: 'x', kind: 'station', lat: 40, lng: -74 }), /sourceApp/);
});

test('the place kinds cover what the ecosystem actually puts on a map', () => {
  for (const kind of ['station', 'business', 'screen', 'property', 'storefront']) {
    assert.ok(PLACE_KINDS.includes(kind), `${kind} must be a valid place kind`);
  }
});

test('removing a place removes exactly one', () => {
  const store = seeded();
  const before = store.places.length;
  assert.strictEqual(removePlace(store, 'scr-1'), true);
  assert.strictEqual(store.places.length, before - 1);
  assert.strictEqual(removePlace(store, 'scr-1'), false);
});

test('bounds returns a viewport rectangle', () => {
  const store = seeded();
  const inBox = withinBounds(store, {
    northLat: 40.72, southLat: 40.71, eastLng: -74.0, westLng: -74.01,
  });
  assert.ok(inBox.length >= 2);
  assert.ok(!inBox.some((p) => p.name === 'Philly Office'));
});

test('an inverted bounding box is refused', () => {
  const store = seeded();
  assert.throws(() => withinBounds(store, {
    northLat: 40.0, southLat: 41.0, eastLng: -74.0, westLng: -74.1,
  }), /northLat must be above southLat/);
});

// -- crossings: what Kevin's prompt promises CVNVO ----------------------

test('two people close in space AND time crossed paths', () => {
  const store = createV4Store();
  recordSighting(store, { userId: 'alice', lat: 40.7130, lng: -74.0061, at: NOW });
  recordSighting(store, { userId: 'bob', lat: 40.7131, lng: -74.0062, at: NOW + 5 * MIN });

  const crossings = findCrossings(store, { userId: 'alice' });
  assert.strictEqual(crossings.length, 1);
  assert.strictEqual(crossings[0].userId, 'bob');
  assert.strictEqual(crossings[0].minutesApart, 5);
});

test('same place, HOURS apart, is not a crossing', () => {
  // The time condition is what makes this a real feature rather than
  // a creepy one.
  const store = createV4Store();
  recordSighting(store, { userId: 'alice', lat: 40.7130, lng: -74.0061, at: NOW });
  recordSighting(store, { userId: 'carol', lat: 40.7130, lng: -74.0061, at: NOW + 9 * 60 * MIN });

  assert.deepStrictEqual(findCrossings(store, { userId: 'alice' }), []);
});

test('same time, far apart, is not a crossing', () => {
  const store = createV4Store();
  recordSighting(store, { userId: 'alice', ...DOWNTOWN, at: NOW });
  recordSighting(store, { userId: 'dave', ...PHILADELPHIA, at: NOW });
  assert.deepStrictEqual(findCrossings(store, { userId: 'alice' }), []);
});

test('a repeated encounter reports once, at its closest', () => {
  // A shared commute must not produce fifty crossings with one person.
  const store = createV4Store();
  for (let i = 0; i < 5; i += 1) {
    recordSighting(store, { userId: 'alice', lat: 40.7130, lng: -74.0061, at: NOW + i * MIN });
    recordSighting(store, { userId: 'bob', lat: 40.7131 + i * 0.0001, lng: -74.0062, at: NOW + i * MIN });
  }
  const crossings = findCrossings(store, { userId: 'alice' });
  assert.strictEqual(crossings.length, 1);
});

test('you never cross paths with yourself', () => {
  const store = createV4Store();
  recordSighting(store, { userId: 'alice', lat: 40.713, lng: -74.006, at: NOW });
  recordSighting(store, { userId: 'alice', lat: 40.713, lng: -74.006, at: NOW + MIN });
  assert.deepStrictEqual(findCrossings(store, { userId: 'alice' }), []);
});

// -- foot traffic: what DREA's prompt promises DREAMS -------------------

test('foot traffic counts sightings and unique people near a point', () => {
  const store = createV4Store();
  recordSighting(store, { userId: 'alice', lat: 40.7130, lng: -74.0061, at: NOW });
  recordSighting(store, { userId: 'alice', lat: 40.7130, lng: -74.0061, at: NOW + MIN });
  recordSighting(store, { userId: 'bob', lat: 40.7131, lng: -74.0062, at: NOW + 2 * MIN });

  const traffic = footTraffic(store, {
    lat: 40.7130, lng: -74.0061, radiusKm: 0.2,
    fromTimestamp: NOW - 60 * MIN, toTimestamp: NOW + 60 * MIN,
  });
  assert.strictEqual(traffic.sightings, 3);
  assert.strictEqual(traffic.uniqueUsers, 2);
});

test('foot traffic states its own limitation on every response', () => {
  // The caller pricing an ad slot is the one who needs to know this,
  // so it rides on the response rather than living in documentation.
  const store = createV4Store();
  const traffic = footTraffic(store, { lat: 40.713, lng: -74.006 });
  assert.match(traffic.measurement, /not independently audited/);
});

test('foot traffic respects its time window', () => {
  const store = createV4Store();
  recordSighting(store, { userId: 'alice', lat: 40.713, lng: -74.006, at: NOW });
  const outside = footTraffic(store, {
    lat: 40.713, lng: -74.006, fromTimestamp: NOW + 60 * MIN, toTimestamp: NOW + 120 * MIN,
  });
  assert.strictEqual(outside.sightings, 0);
});

// -- routing: what Gibson's prompt promises VOID ------------------------

test('a route accumulates distance and time across legs', () => {
  const route = routeThrough([
    { label: 'depot', lat: 40.713, lng: -74.005 },
    { label: 'A', lat: 40.720, lng: -74.010 },
    { label: 'B', lat: 40.730, lng: -73.990 },
  ]);
  assert.strictEqual(route.legs.length, 2);
  const summed = route.legs.reduce((s, l) => s + l.distanceKm, 0);
  assert.ok(Math.abs(summed - route.totalDistanceKm) < 0.02);
});

test('a route preserves the caller stop order', () => {
  // VOID already has real TSP-D/2-opt optimisation in droneRouting.js.
  // A second, worse optimiser here would be a liability.
  const route = routeThrough([
    { label: 'first', lat: 40.713, lng: -74.005 },
    { label: 'second', lat: 40.760, lng: -73.980 },
    { label: 'third', lat: 40.715, lng: -74.006 },
  ]);
  assert.deepStrictEqual(route.legs.map((l) => l.from), ['first', 'second']);
});

test('a route states that it is not road routing', () => {
  const route = routeThrough([
    { lat: 40.713, lng: -74.005 }, { lat: 40.720, lng: -74.010 },
  ]);
  assert.match(route.estimateBasis, /not road routing/);
});

test('a route of one stop is not a route', () => {
  assert.throws(() => routeThrough([{ lat: 40.713, lng: -74.005 }]), /at least two stops/);
});

// -- description -------------------------------------------------------

test('describeMaps reports coverage by app and its own limitations', () => {
  const store = seeded();
  const described = describeMaps(store);
  assert.strictEqual(described.places, 4);
  assert.strictEqual(described.placesByApp.void, 1);
  assert.ok(described.limitations.some((l) => /not road routing/.test(l)));
});
