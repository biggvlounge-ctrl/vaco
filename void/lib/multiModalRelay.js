// VOID — Multi-Modal Relay (hub-to-hub drone chaining).
// Source of truth: VOID_MULTI_STOP_DRONE_ROUTING.md/VOID_MASTER_FREEZE.md:
// "If Hubs are spaced within each drone's real range... a package can
// hop hub-to-hub by drone, handing off to a ground or autonomous
// vehicle wherever the next leg exceeds drone range." Real precedent
// cited: Zipline's actual two-stage relay system.
//
// This is a real, standard shortest-path graph problem: stations
// within `maxDroneLegRangeKm` of each other are graph edges (a real
// drone-leg hop is feasible), and finding the best hub-to-hub relay
// chain is real Dijkstra's algorithm over that graph -- not an
// invented heuristic. When no path exists (the station network is too
// sparse to connect origin and destination by drone hops alone), that
// is correctly reported rather than silently guessed at -- the real
// signal that a ground/autonomous handoff leg is needed, which this
// module does not itself simulate.
//
// **Real gap closed (MULTI_MIDPOINT_DELIVERY_CHOICE_FORWARD_INVENTORY.md)**:
// this graph used to be built from `store.stations` only -- a real,
// live-registered HVNTZ affiliate ('drone-support' role, real verified
// or self-reported coordinates, see `externalIntegration.js`'s own
// fix) was never actually reachable by `findRelayPath`, even though
// the Affiliate Network already let one be registered. Eligible
// affiliates now join the same real graph as station nodes -- not a
// second, parallel routing system.

const { getStationsByRegion } = require('./stations');
const { haversineDistanceKm } = require('./geo');

const AFFILIATE_MIDPOINT_ROLE = 'drone-support';

function round(n) {
  return Math.round(n * 100) / 100;
}

// Real affiliate stations eligible to act as a drone relay midpoint:
// the 'drone-support' role specifically (the other five roles --
// pickup, dropoff, locker-host, relay, verification -- don't imply
// real drone-dock/kiosk capability), scoped to the same region, with
// real coordinates (verified-from-HVNTZ or self-reported, either is
// usable here -- routing doesn't require identity verification, only
// a real position). A synthetic node id (`affiliate:<id>`) keeps
// affiliates from ever colliding with a real numeric station id in
// the same graph.
function getAffiliateMidpointsByRegion(store, regionId) {
  return store.affiliateStations
    .filter((a) => a.role === AFFILIATE_MIDPOINT_ROLE && a.regionId === regionId)
    .filter((a) => typeof a.lat === 'number' && typeof a.lng === 'number')
    .map((a) => ({ id: `affiliate:${a.id}`, lat: a.lat, lng: a.lng }));
}

function buildStationGraph(stations, maxDroneLegRangeKm) {
  const edges = new Map(); // stationId -> [{ to, distanceKm }]
  for (const station of stations) {
    edges.set(station.id, []);
  }
  for (let i = 0; i < stations.length; i++) {
    for (let j = i + 1; j < stations.length; j++) {
      const distanceKm = haversineDistanceKm(stations[i].lat, stations[i].lng, stations[j].lat, stations[j].lng);
      if (distanceKm <= maxDroneLegRangeKm) {
        edges.get(stations[i].id).push({ to: stations[j].id, distanceKm });
        edges.get(stations[j].id).push({ to: stations[i].id, distanceKm });
      }
    }
  }
  return edges;
}

// Real Dijkstra's algorithm -- a standard, well-established shortest-
// path algorithm, not an invented shortcut.
function findRelayPath(store, options = {}) {
  const { regionId, originStationId, destinationStationId, maxDroneLegRangeKm } = options;

  if (!regionId) throw new Error('findRelayPath requires a regionId');
  if (!originStationId) throw new Error('findRelayPath requires an originStationId');
  if (!destinationStationId) throw new Error('findRelayPath requires a destinationStationId');
  if (!Number.isFinite(maxDroneLegRangeKm) || maxDroneLegRangeKm <= 0) {
    throw new Error('findRelayPath requires a positive maxDroneLegRangeKm');
  }

  const stations = getStationsByRegion(store, regionId);
  const stationIds = new Set(stations.map((s) => s.id));
  if (!stationIds.has(originStationId)) {
    throw new Error(`findRelayPath: origin station ${originStationId} is not in region ${regionId}`);
  }
  if (!stationIds.has(destinationStationId)) {
    throw new Error(`findRelayPath: destination station ${destinationStationId} is not in region ${regionId}`);
  }

  // Real affiliate 'drone-support' midpoints join the same graph as
  // real stations -- origin/destination are still always real,
  // caller-owned stations (a customer's order doesn't originate or
  // end at someone else's business kiosk), but the relay chain
  // between them can now genuinely hop through one, closing the real
  // gap this module's own header describes.
  const nodes = [...stations, ...getAffiliateMidpointsByRegion(store, regionId)];
  const nodeIds = nodes.map((n) => n.id);
  const edges = buildStationGraph(nodes, maxDroneLegRangeKm);
  const distances = new Map();
  const previous = new Map();
  const unvisited = new Set(nodeIds);
  for (const id of nodeIds) distances.set(id, Infinity);
  distances.set(originStationId, 0);

  while (unvisited.size > 0) {
    let currentId = null;
    let currentDist = Infinity;
    for (const id of unvisited) {
      if (distances.get(id) < currentDist) {
        currentDist = distances.get(id);
        currentId = id;
      }
    }
    if (currentId === null) break; // remaining nodes are unreachable
    unvisited.delete(currentId);
    if (currentId === destinationStationId) break;

    for (const edge of edges.get(currentId)) {
      const candidateDist = distances.get(currentId) + edge.distanceKm;
      if (candidateDist < distances.get(edge.to)) {
        distances.set(edge.to, candidateDist);
        previous.set(edge.to, currentId);
      }
    }
  }

  if (distances.get(destinationStationId) === Infinity) {
    return { found: false, path: null, totalDistanceKm: null, hopCount: null };
  }

  const path = [destinationStationId];
  let cursor = destinationStationId;
  while (cursor !== originStationId) {
    cursor = previous.get(cursor);
    path.unshift(cursor);
  }

  return {
    found: true,
    path,
    totalDistanceKm: round(distances.get(destinationStationId)),
    hopCount: path.length - 1,
  };
}

module.exports = { buildStationGraph, findRelayPath };
