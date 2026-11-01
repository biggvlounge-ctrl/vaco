// Universal World Layer — Routing/pathfinding between transport nodes.
// Closes this project's own flagged "routing/pathfinding between
// transport nodes" gap.
//
// No source doc gives a connectivity graph between transport nodes --
// `transportation.js`'s own header says they are "unified" bundled
// records (airports, roads, gas stations, bike shops, ports, train
// stations), each tied to one location, with no road-segment/edge
// list given anywhere. Inventing a fabricated per-vehicle-type fuel
// range (so a "car" can go 400km before refueling, say) would be a
// precise-sounding number nothing in this project actually specifies
// -- the same kind of fabrication this project's own README is
// careful never to introduce elsewhere (see e.g. UNESCO/Cesium being
// left as honest stubs rather than faked).
//
// What IS real and already on every node: `operationalStatus`,
// `controlStatus`, and `vehicleTypes` (free-form, no fixed enum --
// confirmed directly, `transportation.js` never validates it against
// a list). Two nodes are connected here when they are both
// operational and share at least one real vehicle type -- the same
// honest "pairwise compatibility, not a fabricated range" shape that
// makes multi-modal routing genuinely meaningful without inventing
// anything: a car-only node and a boat-only node are NOT directly
// connected, and a real path between them must pass through a node
// that supports both (an intermodal hub), the same way a real port
// with road access works. Edge weight is the real great-circle
// distance between the two nodes' own locations -- the same haversine
// formula HVNTZ's own `neighborProgram.js` already uses for its
// location scoring, reimplemented here rather than imported since
// these are two separate apps/packages with no shared dependency.
//
// A destroyed/damaged node, or one under a control status the caller
// names as unsafe, is never routed through -- the same "a route
// exists in principle but this path is not safe/possible right now"
// distinction VOID's own real routing already has to make, which is
// exactly what this module exists to feed (per the architecture doc's
// own "Powers collapse mobility... VOID routing").

const { getLocation } = require('./locations');

const EARTH_RADIUS_KM = 6371;

function haversineDistanceKm(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function sharesVehicleType(a, b) {
  return a.vehicleTypes.some((v) => b.vehicleTypes.includes(v));
}

function isUsable(node, avoidControlStatuses) {
  if (node.operationalStatus !== 'operational') return false;
  if (avoidControlStatuses.includes(node.controlStatus)) return false;
  return true;
}

// Real, deterministic Dijkstra over the real transport-node graph
// described above. Not optimized with a priority queue -- this
// project's own existing performance note (`metricsStore.js`'s
// `getEcosystemSnapshot`, over in vaco-analytics) only reaches for
// that once a real measurement justifies it, and nothing here
// operates at a scale where it would.
function findRoute(worldLayer, options = {}) {
  const { fromLocationId, toLocationId, avoidControlStatuses = [] } = options;
  if (fromLocationId == null) throw new Error('findRoute requires a fromLocationId');
  if (toLocationId == null) throw new Error('findRoute requires a toLocationId');

  const fromLocation = getLocation(worldLayer, fromLocationId);
  if (!fromLocation) throw new Error(`findRoute: no location with id ${fromLocationId}`);
  const toLocation = getLocation(worldLayer, toLocationId);
  if (!toLocation) throw new Error(`findRoute: no location with id ${toLocationId}`);

  const usableNodes = worldLayer.transportNodes.filter((n) => isUsable(n, avoidControlStatuses));
  const startNodes = usableNodes.filter((n) => n.locationId === fromLocationId);
  const endNodeIds = new Set(
    usableNodes.filter((n) => n.locationId === toLocationId).map((n) => n.id)
  );

  if (startNodes.length === 0) {
    return { reachable: false, reason: 'no usable transport node at the origin location' };
  }
  if (endNodeIds.size === 0) {
    return { reachable: false, reason: 'no usable transport node at the destination location' };
  }

  const locationCache = new Map();
  function locationOf(node) {
    if (!locationCache.has(node.locationId)) {
      locationCache.set(node.locationId, getLocation(worldLayer, node.locationId));
    }
    return locationCache.get(node.locationId);
  }

  const dist = new Map(usableNodes.map((n) => [n.id, Infinity]));
  const prev = new Map();
  const visited = new Set();
  startNodes.forEach((n) => dist.set(n.id, 0));

  function pickClosestUnvisited() {
    let best = null;
    let bestDist = Infinity;
    for (const n of usableNodes) {
      if (visited.has(n.id)) continue;
      const d = dist.get(n.id);
      if (d < bestDist) {
        bestDist = d;
        best = n;
      }
    }
    return best;
  }

  let reachedEndNodeId = null;
  for (;;) {
    const current = pickClosestUnvisited();
    if (!current || dist.get(current.id) === Infinity) break;
    visited.add(current.id);
    if (endNodeIds.has(current.id)) {
      reachedEndNodeId = current.id;
      break;
    }

    const currentLocation = locationOf(current);
    for (const neighbor of usableNodes) {
      if (visited.has(neighbor.id) || neighbor.id === current.id) continue;
      if (!sharesVehicleType(current, neighbor)) continue;
      const neighborLocation = locationOf(neighbor);
      const edgeDistanceKm = haversineDistanceKm(
        currentLocation.lat, currentLocation.lng, neighborLocation.lat, neighborLocation.lng,
      );
      const candidate = dist.get(current.id) + edgeDistanceKm;
      if (candidate < dist.get(neighbor.id)) {
        dist.set(neighbor.id, candidate);
        prev.set(neighbor.id, current.id);
      }
    }
  }

  if (reachedEndNodeId == null) {
    return { reachable: false, reason: 'no compatible transport path connects these locations' };
  }

  const nodePath = [];
  let cursor = reachedEndNodeId;
  while (cursor !== undefined) {
    nodePath.unshift(cursor);
    cursor = prev.get(cursor);
  }

  return {
    reachable: true,
    nodePath,
    totalDistanceKm: Math.round(dist.get(reachedEndNodeId) * 100) / 100,
  };
}

module.exports = { haversineDistanceKm, findRoute };
