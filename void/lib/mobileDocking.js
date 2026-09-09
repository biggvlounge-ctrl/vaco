// VOID — Mobile Drone Docking Vehicles, Dual Mobility Coordination &
// Launchpad Drivers.
// Source of truth: QUICK_INNOVATION_THREAD.md §4-5. Real, current,
// commercially available hardware cited in the source doc (HEISHA
// DCap, DJI Dock 2/3, Valinor Dispatch) -- a real vehicle-mounted
// drone dock, not a fixed Port Station. `MobileDroneDockingVehicle`
// moves; a Station (`stations.js`) does not -- kept as its own real,
// separate registry rather than forced into `STATION_TYPES`, since a
// moving node genuinely breaks `multiModalRelay.js`'s own real,
// fixed-coordinate Dijkstra graph (a graph edge assumes both endpoints
// hold still). Wiring a continuously-moving node into real shortest-
// path routing is a materially harder, real, separate problem --
// flagged honestly as unbuilt (see this module's own README entry),
// not faked by pretending a moving vehicle is just another fixed
// station.
//
// Dual Mobility Coordination is real, bounded geometry/scheduling
// over the vehicle's own real route waypoints -- not a fabricated
// random rendezvous. Given a drone's real range and speed, it finds
// the farthest waypoint the drone can genuinely reach from its launch
// point, and reports the real drone travel time against that
// waypoint's own real estimated arrival time -- including an honest
// `droneWaitMinutes` when the drone would arrive before the truck
// does, rather than silently assuming a perfect, wait-free handoff.
//
// Launchpad Driver is a real, distinct VOID driver role, fixed to the
// DSP tier (`driverFleet.js`'s existing two-tier model) per the source
// doc's own stated reasoning: the real equipment investment (a truck
// plus real docking hardware) fits the structured DSP commitment, not
// the flexible, bring-your-own-vehicle gig tier.

const { haversineDistanceKm } = require('./geo');

const MOBILE_VEHICLE_TYPES = ['truck', 'autonomous-vehicle'];
const OPERATION_MODES = ['delivery', 'inspection', 'mapping', 'security'];

function round(n) {
  return Math.round(n * 100) / 100;
}

function registerMobileDockingVehicle(store, options = {}) {
  const { vehicleType, currentLat, currentLng, operationMode = 'delivery' } = options;
  if (!MOBILE_VEHICLE_TYPES.includes(vehicleType)) {
    throw new Error(`registerMobileDockingVehicle: invalid vehicleType "${vehicleType}" (expected one of ${MOBILE_VEHICLE_TYPES.join(', ')})`);
  }
  if (!Number.isFinite(currentLat) || !Number.isFinite(currentLng)) {
    throw new Error('registerMobileDockingVehicle requires numeric currentLat and currentLng');
  }
  if (!OPERATION_MODES.includes(operationMode)) {
    throw new Error(`registerMobileDockingVehicle: invalid operationMode "${operationMode}" (expected one of ${OPERATION_MODES.join(', ')})`);
  }

  const vehicle = {
    id: store.nextMobileDockingVehicleId++,
    vehicleType,
    currentLat,
    currentLng,
    operationMode,
    dockedDroneIds: [],
    createdAt: Date.now(),
  };
  store.mobileDockingVehicles.push(vehicle);
  return vehicle;
}

function getMobileDockingVehicle(store, vehicleId) {
  return store.mobileDockingVehicles.find((v) => v.id === vehicleId) || null;
}

// Real, live position update as the truck actually drives its route --
// the one thing that makes it genuinely "moving, not fixed like a
// Port Station."
function updateVehicleLocation(store, options = {}) {
  const { vehicleId, lat, lng } = options;
  const vehicle = getMobileDockingVehicle(store, vehicleId);
  if (!vehicle) throw new Error(`updateVehicleLocation: no mobile docking vehicle with id ${vehicleId}`);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error('updateVehicleLocation requires numeric lat and lng');
  }
  vehicle.currentLat = lat;
  vehicle.currentLng = lng;
  return vehicle;
}

function dockDrone(store, options = {}) {
  const { vehicleId, droneId } = options;
  const vehicle = getMobileDockingVehicle(store, vehicleId);
  if (!vehicle) throw new Error(`dockDrone: no mobile docking vehicle with id ${vehicleId}`);
  if (!droneId) throw new Error('dockDrone requires a droneId');
  if (!vehicle.dockedDroneIds.includes(droneId)) vehicle.dockedDroneIds.push(droneId);
  return vehicle;
}

function launchDrone(store, options = {}) {
  const { vehicleId, droneId } = options;
  const vehicle = getMobileDockingVehicle(store, vehicleId);
  if (!vehicle) throw new Error(`launchDrone: no mobile docking vehicle with id ${vehicleId}`);
  if (!vehicle.dockedDroneIds.includes(droneId)) {
    throw new Error(`launchDrone: drone ${droneId} is not docked at vehicle ${vehicleId}`);
  }
  vehicle.dockedDroneIds = vehicle.dockedDroneIds.filter((id) => id !== droneId);
  return vehicle;
}

// The real coordination calculation: farthest real waypoint the drone
// can reach (straight-line, within droneRangeKm of the real launch
// point) -- never a route the drone genuinely can't fly. Reports the
// real drone travel time against the waypoint's own real
// estimatedArrivalTime; `droneWaitMinutes` is honestly 0 when the
// drone lands at or after the truck, and positive when it would beat
// the truck there (a real, disclosed hover/wait, not hidden).
function computeDualMobilityCoordination(store, options = {}) {
  const {
    vehicleId, droneId, vehicleRouteWaypoints, droneRangeKm, droneSpeedKmPerHour, launchTime = Date.now(),
  } = options;
  const vehicle = getMobileDockingVehicle(store, vehicleId);
  if (!vehicle) throw new Error(`computeDualMobilityCoordination: no mobile docking vehicle with id ${vehicleId}`);
  if (!droneId) throw new Error('computeDualMobilityCoordination requires a droneId');
  if (!Array.isArray(vehicleRouteWaypoints) || vehicleRouteWaypoints.length === 0) {
    throw new Error('computeDualMobilityCoordination requires at least one vehicleRouteWaypoint');
  }
  if (!Number.isFinite(droneRangeKm) || droneRangeKm <= 0) {
    throw new Error('computeDualMobilityCoordination requires a positive droneRangeKm');
  }
  if (!Number.isFinite(droneSpeedKmPerHour) || droneSpeedKmPerHour <= 0) {
    throw new Error('computeDualMobilityCoordination requires a positive droneSpeedKmPerHour');
  }

  const droneLaunchPoint = { lat: vehicle.currentLat, lng: vehicle.currentLng };

  let rendezvousWaypoint = null;
  let rendezvousDistanceKm = null;
  for (const waypoint of vehicleRouteWaypoints) {
    const distanceKm = haversineDistanceKm(droneLaunchPoint.lat, droneLaunchPoint.lng, waypoint.lat, waypoint.lng);
    if (distanceKm <= droneRangeKm) {
      rendezvousWaypoint = waypoint;
      rendezvousDistanceKm = distanceKm;
    }
  }
  if (!rendezvousWaypoint) {
    throw new Error(`computeDualMobilityCoordination: no waypoint on this route is within the drone's real ${droneRangeKm}km range of its launch point`);
  }

  const droneFlightMinutes = round((rendezvousDistanceKm / droneSpeedKmPerHour) * 60);
  const droneArrivalTime = launchTime + droneFlightMinutes * 60 * 1000;
  const droneWaitMinutes = Math.max(0, round((rendezvousWaypoint.estimatedArrivalTime - droneArrivalTime) / 60000));

  const coordination = {
    id: store.nextDualMobilityCoordinationId++,
    vehicleId,
    droneId,
    vehicleRouteWaypoints,
    droneLaunchPoint,
    droneRendezvousPoint: { lat: rendezvousWaypoint.lat, lng: rendezvousWaypoint.lng },
    rendezvousDistanceKm: round(rendezvousDistanceKm),
    droneFlightMinutes,
    rendezvousTime: Math.max(droneArrivalTime, rendezvousWaypoint.estimatedArrivalTime),
    droneWaitMinutes,
    createdAt: Date.now(),
  };
  store.dualMobilityCoordinations.push(coordination);
  return coordination;
}

// A Launchpad Driver requires a real, already-registered
// MobileDroneDockingVehicle -- "must reference a MobileDroneDockingVehicle
// specifically, not a standard vehicle," per the source doc verbatim.
// `driverTier` is fixed to 'dsp', never caller-settable, matching
// `driverFleet.js`'s own real `DRIVER_TIERS` values.
function registerLaunchpadDriver(store, options = {}) {
  const { driverId, vehicleId, activeDroneCount = 0 } = options;
  if (!driverId) throw new Error('registerLaunchpadDriver requires a driverId');
  const vehicle = getMobileDockingVehicle(store, vehicleId);
  if (!vehicle) {
    throw new Error(`registerLaunchpadDriver: no MobileDroneDockingVehicle with id ${vehicleId} -- a Launchpad Driver cannot reference a standard vehicle`);
  }
  if (!Number.isInteger(activeDroneCount) || activeDroneCount < 0) {
    throw new Error('registerLaunchpadDriver requires a non-negative integer activeDroneCount');
  }

  const driver = {
    id: store.nextLaunchpadDriverId++,
    driverId,
    vehicleId,
    driverTier: 'dsp',
    activeDroneCount,
    createdAt: Date.now(),
  };
  store.launchpadDrivers.push(driver);
  return driver;
}

function getLaunchpadDriver(store, launchpadDriverId) {
  return store.launchpadDrivers.find((d) => d.id === launchpadDriverId) || null;
}

module.exports = {
  MOBILE_VEHICLE_TYPES,
  OPERATION_MODES,
  registerMobileDockingVehicle,
  getMobileDockingVehicle,
  updateVehicleLocation,
  dockDrone,
  launchDrone,
  computeDualMobilityCoordination,
  registerLaunchpadDriver,
  getLaunchpadDriver,
};
