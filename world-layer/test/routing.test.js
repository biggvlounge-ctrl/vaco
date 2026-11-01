// Universal World Layer — Routing/pathfinding between transport
// nodes. Closes this project's own flagged "routing/pathfinding
// between transport nodes" gap. See routing.js's own header for why
// the graph is built from real, already-existing fields (shared
// vehicleTypes, operationalStatus, controlStatus, haversine distance
// between real lat/lng) rather than a fabricated range/fuel formula.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createWorldLayer, generateLocation } = require('../locations.js');
const { generateTransportNode } = require('../transportation.js');
const { haversineDistanceKm, findRoute } = require('../routing.js');

test('a direct route between two compatible, operational nodes is found with a real distance', () => {
  const w = createWorldLayer();
  const stl = generateLocation(w, { name: 'St. Louis', lat: 38.627, lng: -90.199 });
  const kc = generateLocation(w, { name: 'Kansas City', lat: 39.0997, lng: -94.5786 });
  generateTransportNode(w, { locationId: stl.id, vehicleTypes: ['car'] });
  generateTransportNode(w, { locationId: kc.id, vehicleTypes: ['car'] });

  const route = findRoute(w, { fromLocationId: stl.id, toLocationId: kc.id });
  assert.equal(route.reachable, true);
  assert.equal(route.nodePath.length, 2);
  const expectedKm = haversineDistanceKm(stl.lat, stl.lng, kc.lat, kc.lng);
  assert.ok(Math.abs(route.totalDistanceKm - expectedKm) < 0.01);
});

test('two incompatible-mode nodes are not directly connected -- a real path must pass through an intermodal hub', () => {
  const w = createWorldLayer();
  const carOnly = generateLocation(w, { name: 'Car town', lat: 10, lng: 10 });
  const hub = generateLocation(w, { name: 'Hub', lat: 10, lng: 11 });
  const boatOnly = generateLocation(w, { name: 'Boat town', lat: 10, lng: 12 });

  const nCar = generateTransportNode(w, { locationId: carOnly.id, vehicleTypes: ['car'] });
  const nHub = generateTransportNode(w, { locationId: hub.id, vehicleTypes: ['car', 'boat'] });
  const nBoat = generateTransportNode(w, { locationId: boatOnly.id, vehicleTypes: ['boat'] });

  const route = findRoute(w, { fromLocationId: carOnly.id, toLocationId: boatOnly.id });
  assert.equal(route.reachable, true);
  assert.deepStrictEqual(route.nodePath, [nCar.id, nHub.id, nBoat.id],
    'the real path must route through the intermodal hub, not jump directly between incompatible modes');
});

test('with no bridging node at all, two incompatible-mode locations are honestly unreachable', () => {
  const w = createWorldLayer();
  const carOnly = generateLocation(w, { name: 'Car town', lat: 10, lng: 10 });
  const boatOnly = generateLocation(w, { name: 'Boat town', lat: 10, lng: 12 });
  generateTransportNode(w, { locationId: carOnly.id, vehicleTypes: ['car'] });
  generateTransportNode(w, { locationId: boatOnly.id, vehicleTypes: ['boat'] });

  const route = findRoute(w, { fromLocationId: carOnly.id, toLocationId: boatOnly.id });
  assert.equal(route.reachable, false);
  assert.match(route.reason, /no compatible transport path/);
});

test('a destroyed node is never routed through, even when it would be the shortest hop', () => {
  const w = createWorldLayer();
  const a = generateLocation(w, { name: 'A', lat: 0, lng: 0 });
  const destroyed = generateLocation(w, { name: 'Destroyed waypoint', lat: 0, lng: 1 });
  const b = generateLocation(w, { name: 'B', lat: 0, lng: 2 });

  const nA = generateTransportNode(w, { locationId: a.id, vehicleTypes: ['car'] });
  generateTransportNode(w, {
    locationId: destroyed.id, vehicleTypes: ['car'], operationalStatus: 'destroyed',
  });
  const nB = generateTransportNode(w, { locationId: b.id, vehicleTypes: ['car'] });

  // The only usable nodes are A and B themselves -- still directly
  // connected (both operational, both support car), just not through
  // the destroyed waypoint.
  const route = findRoute(w, { fromLocationId: a.id, toLocationId: b.id });
  assert.equal(route.reachable, true);
  assert.deepStrictEqual(route.nodePath, [nA.id, nB.id]);
});

test('avoidControlStatuses excludes a contested node from the graph entirely', () => {
  const w = createWorldLayer();
  const a = generateLocation(w, { name: 'A', lat: 0, lng: 0 });
  const contested = generateLocation(w, { name: 'Contested waypoint', lat: 0, lng: 1 });
  const b = generateLocation(w, { name: 'B', lat: 0, lng: 2 });

  generateTransportNode(w, { locationId: a.id, vehicleTypes: ['car'] });
  generateTransportNode(w, { locationId: contested.id, vehicleTypes: ['car'], controlStatus: 'contested' });
  generateTransportNode(w, { locationId: b.id, vehicleTypes: ['car'] });

  // Both are still directly car-compatible even without the waypoint,
  // so this must stay reachable -- the exclusion is proven by the
  // next test, where no bypass exists.
  const route = findRoute(w, {
    fromLocationId: a.id, toLocationId: b.id, avoidControlStatuses: ['contested'],
  });
  assert.equal(route.reachable, true);
});

test('avoidControlStatuses can make an otherwise-reachable route honestly unreachable', () => {
  const w = createWorldLayer();
  const car = generateLocation(w, { name: 'Car town', lat: 10, lng: 10 });
  const contestedHub = generateLocation(w, { name: 'Contested hub', lat: 10, lng: 11 });
  const boat = generateLocation(w, { name: 'Boat town', lat: 10, lng: 12 });

  generateTransportNode(w, { locationId: car.id, vehicleTypes: ['car'] });
  generateTransportNode(w, {
    locationId: contestedHub.id, vehicleTypes: ['car', 'boat'], controlStatus: 'contested',
  });
  generateTransportNode(w, { locationId: boat.id, vehicleTypes: ['boat'] });

  const withoutAvoiding = findRoute(w, { fromLocationId: car.id, toLocationId: boat.id });
  assert.equal(withoutAvoiding.reachable, true, 'the hub is usable when nothing is avoided');

  const avoiding = findRoute(w, {
    fromLocationId: car.id, toLocationId: boat.id, avoidControlStatuses: ['contested'],
  });
  assert.equal(avoiding.reachable, false, 'with the only bridge avoided, the route is honestly impossible');
});

test('no usable transport node at the origin or destination is reported honestly, not as a path', () => {
  const w = createWorldLayer();
  const empty = generateLocation(w, { name: 'Nowhere', lat: 0, lng: 0 });
  const somewhere = generateLocation(w, { name: 'Somewhere', lat: 1, lng: 1 });
  generateTransportNode(w, { locationId: somewhere.id, vehicleTypes: ['car'] });

  const fromEmpty = findRoute(w, { fromLocationId: empty.id, toLocationId: somewhere.id });
  assert.equal(fromEmpty.reachable, false);
  assert.match(fromEmpty.reason, /origin/);

  const toEmpty = findRoute(w, { fromLocationId: somewhere.id, toLocationId: empty.id });
  assert.equal(toEmpty.reachable, false);
  assert.match(toEmpty.reason, /destination/);
});

test('the same origin and destination, both with a usable node, is trivially reachable at zero distance', () => {
  const w = createWorldLayer();
  const place = generateLocation(w, { name: 'Place', lat: 5, lng: 5 });
  generateTransportNode(w, { locationId: place.id, vehicleTypes: ['car'] });

  const route = findRoute(w, { fromLocationId: place.id, toLocationId: place.id });
  assert.equal(route.reachable, true);
  assert.equal(route.totalDistanceKm, 0);
});

test('findRoute refuses an unknown location id', () => {
  const w = createWorldLayer();
  const place = generateLocation(w, { name: 'Place', lat: 5, lng: 5 });
  assert.throws(() => findRoute(w, { fromLocationId: 9999, toLocationId: place.id }), /no location/i);
  assert.throws(() => findRoute(w, { fromLocationId: place.id, toLocationId: 9999 }), /no location/i);
});

test('haversineDistanceKm returns zero for identical coordinates and a sane real-world figure for a known pair', () => {
  assert.equal(haversineDistanceKm(10, 10, 10, 10), 0);
  // St. Louis to Kansas City is a real, well-known distance: ~380-400km.
  const km = haversineDistanceKm(38.627, -90.199, 39.0997, -94.5786);
  assert.ok(km > 350 && km < 420, `expected ~380km, got ${km}`);
});
