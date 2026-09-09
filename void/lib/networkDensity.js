// VOID — Network Density Metric.
// Source of truth: VOID_MULTI_STOP_DRONE_ROUTING.md's
// `NetworkDensityMetric` and the "more midpoints benefit everyone
// already in the network" principle: as more stations join a region,
// average inter-station distance should genuinely shrink and real
// routing options should genuinely grow -- not a vanity count, a real
// computation over the actual registered station network.
//
// `maxRelayRangeKm` (default 16km): the source doc cites real drone
// range precedents -- Zipline P2 ~10 miles (~16.09km), Wing ~6 miles
// (~9.66km) -- but doesn't give one canonical relay range for this
// metric. 16km (Zipline P2's real, larger, more conservative figure)
// is used as a flagged, interpretive default a caller can override,
// not a value taken directly from the doc.

const { getStationsByRegion } = require('./stations');
const { haversineDistanceKm } = require('./geo');

const DEFAULT_MAX_RELAY_RANGE_KM = 16;

function round(n) {
  return Math.round(n * 100) / 100;
}

function computeNetworkDensity(store, regionId, options = {}) {
  const { maxRelayRangeKm = DEFAULT_MAX_RELAY_RANGE_KM } = options;
  if (!regionId) {
    throw new Error('computeNetworkDensity requires a regionId');
  }
  if (!Number.isFinite(maxRelayRangeKm) || maxRelayRangeKm <= 0) {
    throw new Error('computeNetworkDensity requires a positive maxRelayRangeKm');
  }

  const stations = getStationsByRegion(store, regionId);
  const activeMidpointCount = stations.length;

  if (activeMidpointCount < 2) {
    return { regionId, activeMidpointCount, averageInterMidpointDistance: null, routingOptionsAvailable: 0 };
  }

  const pairwiseDistances = [];
  let routingOptionsAvailable = 0;
  for (let i = 0; i < stations.length; i++) {
    for (let j = i + 1; j < stations.length; j++) {
      const distanceKm = haversineDistanceKm(stations[i].lat, stations[i].lng, stations[j].lat, stations[j].lng);
      pairwiseDistances.push(distanceKm);
      if (distanceKm <= maxRelayRangeKm) {
        routingOptionsAvailable++;
      }
    }
  }

  const averageInterMidpointDistance = round(
    pairwiseDistances.reduce((sum, d) => sum + d, 0) / pairwiseDistances.length
  );

  return { regionId, activeMidpointCount, averageInterMidpointDistance, routingOptionsAvailable };
}

module.exports = { DEFAULT_MAX_RELAY_RANGE_KM, computeNetworkDensity };
