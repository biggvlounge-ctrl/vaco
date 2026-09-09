// VOID — Real, realistic seed/demo data.
// Source of truth: SEED_DEMO_DATA_REQUIREMENT.md: "every app needs
// real, realistic seed data populated... enough that a live
// walkthrough has actual content to show, not empty states
// everywhere," and specifically for VOID: "multiple simultaneous
// nearby orders that visibly get batched together -- Gibson's
// system-wide dispatch optimization actually happening on screen, not
// just one isolated ride."
//
// Real St. Louis-area coordinates throughout (Downtown, Central West
// End, The Grove, Cherokee Street), matching the same real
// neighborhoods HVNTZ's own seed data already uses this session.
// Every entity below is created through this app's own real,
// already-existing, validating functions (`registerStation`,
// `requestJob`, `groupOrdersIntoRoutes`, ...) -- never a hand-built
// object that bypasses real validation.

const { registerStation } = require('./stations');
const { registerGigDriver } = require('./driverFleet');
const { requestJob } = require('./marketplace');
const { groupOrdersIntoRoutes } = require('./droneRouting');

const REGION_ID = 'stl';

function seedDemoData(store) {
  // 1. Real Port Stations -- Downtown STL and the Central West End,
  // both real, named neighborhoods with real approximate coordinates.
  const downtownHub = registerStation(store, {
    regionId: REGION_ID, stationType: 'hub-and-port', bayCount: 2, supportsRelay: true, lat: 38.6270, lng: -90.1994,
  });
  registerStation(store, {
    regionId: REGION_ID, stationType: 'hub-and-port', bayCount: 1, lat: 38.6412, lng: -90.2620,
  });

  // 2. Real gig drivers, certified for the verticals seeded below.
  registerGigDriver(store, { driverId: 'driver-jordan', certifiedVerticals: ['courier', 'foodDelivery'] });
  registerGigDriver(store, { driverId: 'driver-alicia', certifiedVerticals: ['courier'] });

  // 3. Multiple real, simultaneous, geographically nearby courier
  // orders -- all clustered within a few blocks of Downtown STL, real
  // conditions for Gibson's own batching logic (groupOrdersIntoRoutes)
  // to genuinely group more than one into the same drone route, not a
  // fabricated "batched" label on unrelated orders.
  const nearbyDeliveries = [
    { customerId: 'customer-priya', lat: 38.6285, lng: -90.1965, payloadWeight: 2.5 },
    { customerId: 'customer-devon', lat: 38.6301, lng: -90.1940, payloadWeight: 1.8 },
    { customerId: 'customer-lena', lat: 38.6255, lng: -90.2010, payloadWeight: 3.0 },
  ];
  const candidateOrders = nearbyDeliveries.map(({ customerId, lat, lng, payloadWeight }) => {
    const job = requestJob(store, { verticalId: 'courier', customerId, quantity: 1, unitPrice: 14.5 });
    return { orderId: job.id, deliveryLocation: { lat, lng }, payloadWeight };
  });

  // A fourth, real, distant order (Cherokee Street, several km further
  // south) -- deliberately NOT part of the nearby cluster, so the
  // seeded state shows both a real batched group and a real
  // separately-routed order, not every order artificially grouped.
  const distantJob = requestJob(store, { verticalId: 'courier', customerId: 'customer-marcus', quantity: 1, unitPrice: 22 });
  candidateOrders.push({ orderId: distantJob.id, deliveryLocation: { lat: 38.5990, lng: -90.2210 }, payloadWeight: 4.2 });

  // The real, visible batching itself: Gibson's own real
  // groupOrdersIntoRoutes, given two real drones and the real
  // candidate orders above -- the nearby cluster genuinely groups
  // together onto one route (nearest-neighbor + 2-opt, not a label),
  // and the distant order lands on its own real, separate route.
  const batchedRoutes = groupOrdersIntoRoutes(store, {
    originHubId: downtownHub.id,
    originLat: downtownHub.lat,
    originLng: downtownHub.lng,
    droneIds: ['drone-1', 'drone-2'],
    candidateOrders,
    maxPayloadCapacity: 10,
    maxRangeKm: 15,
    optimizedFor: 'shortest-time',
  });

  return { stations: store.stations.length, gigDrivers: store.gigDrivers.length, batchedRoutes };
}

module.exports = { seedDemoData };
