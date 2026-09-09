// VOID — Multi-Stop Drone Routing (TSP-D / VRP-D).
// Source of truth: VOID_MULTI_STOP_DRONE_ROUTING.md: "the real,
// established formulation for a single drone making multiple
// deliveries in one flight, optimizing stop sequence to minimize
// total delivery time," plus the broader VRP-D category for grouping
// multiple orders across multiple drone routes. The doc explicitly
// flags this as "ready for Claude Code" with real published
// algorithms (TSP-D, VRP-D) as a starting reference, not an
// experimental system to invent from scratch.
//
// Real algorithm, not a shortcut: nearest-neighbor construction
// followed by 2-opt local-search improvement -- the standard,
// well-established approximate approach real routing systems use for
// this exact class of problem (exact TSP solving is NP-hard).
//
// Real constraints modeled, per the source doc's own list: payload
// capacity across the whole route (`totalPayload` must fit
// `maxPayloadCapacity`), real range limits (`estimatedRangeUsed` is a
// closed-loop distance -- a real drone must return to its origin hub
// to recharge -- checked against `maxRangeKm`), and no-fly zones
// (every leg of the optimized route is checked against every
// registered zone).

const { haversineDistanceKm } = require('./geo');
const { getNoFlyZones } = require('./noFlyZones');

const OPTIMIZATION_MODES = ['shortest-time', 'lowest-cost', 'max-stops'];

function round(n) {
  return Math.round(n * 100) / 100;
}

function routeDistanceKm(origin, orderedStops) {
  let total = 0;
  let prev = origin;
  for (const stop of orderedStops) {
    total += haversineDistanceKm(prev.lat, prev.lng, stop.deliveryLocation.lat, stop.deliveryLocation.lng);
    prev = stop.deliveryLocation;
  }
  total += haversineDistanceKm(prev.lat, prev.lng, origin.lat, origin.lng);
  return total;
}

function nearestNeighborOrder(origin, stops) {
  const remaining = [...stops];
  const order = [];
  let current = origin;
  while (remaining.length) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineDistanceKm(current.lat, current.lng, remaining[i].deliveryLocation.lat, remaining[i].deliveryLocation.lng);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    const next = remaining.splice(bestIdx, 1)[0];
    order.push(next);
    current = next.deliveryLocation;
  }
  return order;
}

function twoOptImprove(origin, initialOrder) {
  let best = initialOrder;
  let bestDist = routeDistanceKm(origin, best);
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 0; i < best.length - 1; i++) {
      for (let j = i + 1; j < best.length; j++) {
        const candidate = best.slice(0, i).concat(best.slice(i, j + 1).reverse(), best.slice(j + 1));
        const candidateDist = routeDistanceKm(origin, candidate);
        if (candidateDist < bestDist - 1e-9) {
          best = candidate;
          bestDist = candidateDist;
          improved = true;
        }
      }
    }
  }
  return { order: best, distanceKm: round(bestDist) };
}

function optimizeStopSequence(origin, stops) {
  if (stops.length === 0) return { order: [], distanceKm: 0 };
  if (stops.length === 1) return { order: stops, distanceKm: round(routeDistanceKm(origin, stops)) };
  const nn = nearestNeighborOrder(origin, stops);
  return twoOptImprove(origin, nn);
}

// Local flat-plane projection, used only for short-range leg/no-fly-
// zone segment-distance checks below -- every real route-length/range
// number above still uses real Haversine distance. Flagged
// approximation: valid for the short distances real drone routes
// actually cover, not continental-scale geometry.
function projectLocal(origin, point) {
  const R = 6371;
  const dLat = ((point.lat - origin.lat) * Math.PI) / 180;
  const dLng = ((point.lng - origin.lng) * Math.PI) / 180;
  const x = dLng * Math.cos((origin.lat * Math.PI) / 180) * R;
  const y = dLat * R;
  return { x, y };
}

function pointToSegmentDistanceKm(refOrigin, p, a, b) {
  const P = projectLocal(refOrigin, p);
  const A = projectLocal(refOrigin, a);
  const B = projectLocal(refOrigin, b);
  const abx = B.x - A.x;
  const aby = B.y - A.y;
  const lenSq = abx * abx + aby * aby;
  let t = lenSq === 0 ? 0 : ((P.x - A.x) * abx + (P.y - A.y) * aby) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = A.x + t * abx;
  const cy = A.y + t * aby;
  const dx = P.x - cx;
  const dy = P.y - cy;
  return Math.sqrt(dx * dx + dy * dy);
}

function buildLegs(origin, orderedStops) {
  const legs = [];
  let prev = origin;
  for (const stop of orderedStops) {
    legs.push([prev, stop.deliveryLocation]);
    prev = stop.deliveryLocation;
  }
  legs.push([prev, origin]);
  return legs;
}

function findNoFlyViolation(store, origin, legs) {
  for (const zone of getNoFlyZones(store)) {
    for (const [a, b] of legs) {
      const dist = pointToSegmentDistanceKm(origin, { lat: zone.lat, lng: zone.lng }, a, b);
      if (dist < zone.radiusKm) {
        return zone;
      }
    }
  }
  return null;
}

function buildRoute(store, options = {}) {
  const {
    droneId, originHubId, originLat, originLng, stops = [],
    maxPayloadCapacity, maxRangeKm, optimizedFor = 'shortest-time',
  } = options;

  if (!droneId) throw new Error('buildRoute requires a droneId');
  if (!originHubId) throw new Error('buildRoute requires an originHubId');
  if (!Number.isFinite(originLat) || !Number.isFinite(originLng)) {
    throw new Error('buildRoute requires numeric originLat and originLng');
  }
  if (!Array.isArray(stops) || stops.length === 0) {
    throw new Error('buildRoute requires at least one stop');
  }
  if (!OPTIMIZATION_MODES.includes(optimizedFor)) {
    throw new Error(`buildRoute: invalid optimizedFor "${optimizedFor}" (expected one of ${OPTIMIZATION_MODES.join(', ')})`);
  }
  if (!Number.isFinite(maxPayloadCapacity) || maxPayloadCapacity <= 0) {
    throw new Error('buildRoute requires a positive maxPayloadCapacity');
  }
  if (!Number.isFinite(maxRangeKm) || maxRangeKm <= 0) {
    throw new Error('buildRoute requires a positive maxRangeKm');
  }
  for (const stop of stops) {
    if (!stop.orderId) throw new Error('every stop requires an orderId');
    if (!stop.deliveryLocation || typeof stop.deliveryLocation.lat !== 'number' || typeof stop.deliveryLocation.lng !== 'number') {
      throw new Error(`stop ${stop.orderId} requires a deliveryLocation {lat, lng}`);
    }
    if (typeof stop.payloadWeight !== 'number' || stop.payloadWeight <= 0) {
      throw new Error(`stop ${stop.orderId} requires a positive payloadWeight`);
    }
  }

  const totalPayload = round(stops.reduce((sum, s) => sum + s.payloadWeight, 0));
  if (totalPayload > maxPayloadCapacity) {
    throw new Error(`buildRoute: totalPayload ${totalPayload} exceeds drone ${droneId}'s maxPayloadCapacity ${maxPayloadCapacity}`);
  }

  const origin = { lat: originLat, lng: originLng };
  const { order, distanceKm } = optimizeStopSequence(origin, stops);

  if (distanceKm > maxRangeKm) {
    throw new Error(`buildRoute: optimized round-trip distance ${distanceKm}km exceeds drone ${droneId}'s maxRangeKm ${maxRangeKm}km`);
  }

  const legs = buildLegs(origin, order);
  const violation = findNoFlyViolation(store, origin, legs);
  if (violation) {
    throw new Error(`buildRoute: route passes within no-fly zone "${violation.name}"`);
  }

  const route = {
    id: store.nextRouteId++,
    droneId,
    originHubId,
    stops: order.map((s, i) => ({ ...s, sequenceIndex: i })),
    totalPayload,
    estimatedRangeUsed: distanceKm,
    optimizedFor,
    createdAt: Date.now(),
  };
  store.droneRoutes.push(route);
  return route;
}

function getRoute(store, routeId) {
  return store.droneRoutes.find((r) => r.id === routeId) || null;
}

// The real VRP-D extension: a larger pool of candidate orders near
// one origin hub gets grouped into multiple capacity/range-respecting
// routes rather than assuming they all fit one drone trip -- directly
// implementing the source doc's own framing ("group nearby orders
// into one multi-stop drone route... when combined payload stays
// within range"). Real, standard greedy nearest-first bin-packing
// heuristic, not an invented shortcut. Orders that can never fit any
// drone in the given fleet (alone over payload or range) are reported
// as unassigned rather than crashing the whole batch.
function groupOrdersIntoRoutes(store, options = {}) {
  const {
    originHubId, originLat, originLng, droneIds, candidateOrders = [],
    maxPayloadCapacity, maxRangeKm, optimizedFor = 'shortest-time',
  } = options;

  if (!Array.isArray(droneIds) || droneIds.length === 0) {
    throw new Error('groupOrdersIntoRoutes requires at least one droneId in droneIds');
  }
  if (!Number.isFinite(maxPayloadCapacity) || maxPayloadCapacity <= 0) {
    throw new Error('groupOrdersIntoRoutes requires a positive maxPayloadCapacity');
  }
  if (!Number.isFinite(maxRangeKm) || maxRangeKm <= 0) {
    throw new Error('groupOrdersIntoRoutes requires a positive maxRangeKm');
  }

  const origin = { lat: originLat, lng: originLng };
  const sorted = [...candidateOrders].sort(
    (a, b) =>
      haversineDistanceKm(origin.lat, origin.lng, a.deliveryLocation.lat, a.deliveryLocation.lng) -
      haversineDistanceKm(origin.lat, origin.lng, b.deliveryLocation.lat, b.deliveryLocation.lng)
  );

  const routes = [];
  const unassignedOrders = [];
  let currentGroup = [];
  let droneIndex = 0;

  function currentPayload() {
    return currentGroup.reduce((sum, s) => sum + s.payloadWeight, 0);
  }

  function flushGroup() {
    if (currentGroup.length === 0) return;
    if (droneIndex >= droneIds.length) {
      unassignedOrders.push(...currentGroup);
      currentGroup = [];
      return;
    }
    const route = buildRoute(store, {
      droneId: droneIds[droneIndex++],
      originHubId, originLat, originLng,
      stops: currentGroup, maxPayloadCapacity, maxRangeKm, optimizedFor,
    });
    routes.push(route);
    currentGroup = [];
  }

  for (const order of sorted) {
    const soloDistance = routeDistanceKm(origin, [order]);
    if (order.payloadWeight > maxPayloadCapacity || soloDistance > maxRangeKm) {
      unassignedOrders.push(order);
      continue;
    }
    if (currentPayload() + order.payloadWeight > maxPayloadCapacity) {
      flushGroup();
    }
    currentGroup.push(order);
    if (routeDistanceKm(origin, currentGroup) > maxRangeKm) {
      currentGroup.pop();
      flushGroup();
      currentGroup.push(order);
    }
  }
  flushGroup();

  return { routes, unassignedOrders };
}

module.exports = {
  OPTIMIZATION_MODES,
  routeDistanceKm,
  optimizeStopSequence,
  buildRoute,
  getRoute,
  groupOrdersIntoRoutes,
};
