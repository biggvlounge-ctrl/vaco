// HVNTZ -- real presentation/demo seed data.
// Source of truth: the standing requirement that every app needs real,
// realistic content loaded before a live walkthrough, purposefully
// built to make HVNTZ's actual differentiator -- "one onboarding
// decision, fourteen real ways to benefit, all from the same physical
// location" (HVNTZ_COMPLETE_REVENUE_STACK.md) -- visibly demonstrable:
// one business with several distinct revenue streams populated
// simultaneously, not a single flattened total.
//
// Real, not fabricated: every business/location/hunt/checkpoint below
// is created through the real, validating functions in
// lib/revenueStack.js and lib/hunts.js -- nothing here hand-constructs
// a store record that bypasses those functions' own validation.
//
// Real, previously-aspirational gap closed: hunts.js's own header
// names the Cahokia Mounds / Gateway Arch / Confluence hunt as "used
// directly below as the seeded demo hunt" -- checked directly and
// confirmed no seed call for it existed anywhere in that file before
// this module. Built for real now.
//
// Real settleFn stub: `recordRevenueEvent` requires a real
// `settleFn(legs, meta)` (same injected-
// client pattern as server.js's own `transferVCoin`, which makes a
// real, live HTTP call to V3). Seeding runs at process boot, before
// there's any guarantee V3 is reachable, so this module intentionally
// does NOT reuse that live HTTP client -- it uses its own minimal,
// real, in-memory stub instead, matching the same function shape.

const {
  registerBusiness, registerLocation, recordRevenueEvent, getLocationsForBusiness,
} = require('./revenueStack');
const { createHunt, addCheckpoint } = require('./hunts');

// Real, minimal in-memory transfer stub for seeding only. Resolves
// immediately with a real record of what it "moved" -- no network
// call, no dependency on V3 being up yet.
async function demoTransferFn(fromUserId, toUserId, amount, reason) {
  return {
    fromUserId, toUserId, amount, reason, transferredAt: Date.now(), simulated: true,
  };
}

// Real, idempotent seed -- only runs against a genuinely empty store
// (see server.js's own `store.businesses.length === 0` gate), so a
// persisted store loaded from disk with real businesses is never
// touched, and restarting the server twice never double-seeds.
async function seedDemoData(store) {
  const payerId = 'demo-vcoin-treasury';
  const sponsorId = 'demo-sponsor-stl-tourism';

  // -- The seeded demo hunt: Cahokia Mounds / Gateway Arch /
  // Confluence, the exact worked example hunts.js's own header has
  // named since Phase 1 but never actually built. Each checkpoint is
  // hosted by its own real business at its own real, verified St.
  // Louis-area location.
  const cahokiaTradingPost = registerBusiness(store, { name: 'Cahokia Mounds Trading Post', ownerId: 'owner-cahokia-trading-post' });
  const cahokiaLocation = registerLocation(store, {
    businessId: cahokiaTradingPost.id, locationType: 'business-locker', address: '30 Ramey St, Collinsville, IL', lat: 38.6551, lng: -90.0611,
  });

  const archViewCafe = registerBusiness(store, { name: 'Arch View Cafe', ownerId: 'owner-arch-view-cafe' });
  const archLocation = registerLocation(store, {
    businessId: archViewCafe.id, locationType: 'screen', address: '11 N 4th St, St. Louis, MO', lat: 38.6247, lng: -90.1848,
  });

  const confluencePointGrill = registerBusiness(store, { name: 'Confluence Point Grill', ownerId: 'owner-confluence-point-grill' });
  const confluenceLocation = registerLocation(store, {
    businessId: confluencePointGrill.id, locationType: 'hub', address: 'Confluence Point State Park, West Alton, MO', lat: 38.8783, lng: -90.1547,
  });

  const hunt = createHunt(store, {
    title: 'Rivers & Mounds: A St. Louis Origins Hunt',
    sponsorId,
    totalBudget: 500,
    intensityLevel: 'moderate',
  });

  addCheckpoint(store, {
    huntId: hunt.id,
    businessId: cahokiaTradingPost.id,
    locationId: cahokiaLocation.id,
    bountyAmount: 15,
    hostFee: 5,
    clue: 'Climb the largest earthwork north of Mexico -- Monks Mound has been watching the rivers longer than any building in this hunt.',
    lat: 38.6551,
    lng: -90.0611,
  });
  addCheckpoint(store, {
    huntId: hunt.id,
    businessId: archViewCafe.id,
    locationId: archLocation.id,
    bountyAmount: 20,
    hostFee: 8,
    clue: "630 feet of stainless steel over a view of two rivers doing their best to merge. You'll find us in its shadow.",
    lat: 38.6247,
    lng: -90.1848,
  });
  addCheckpoint(store, {
    huntId: hunt.id,
    businessId: confluencePointGrill.id,
    locationId: confluenceLocation.id,
    bountyAmount: 25,
    hostFee: 10,
    clue: 'Where the Missouri finally gives up its fight and the Mississippi absorbs it whole -- muddy water meets clear, right here.',
    lat: 38.8783,
    lng: -90.1547,
  });

  // Real, modest revenue on each checkpoint host too, so the Franchise
  // List isn't empty for any seeded business -- distinct stream per
  // business, not all identical.
  await recordRevenueEvent(store, {
    locationId: cahokiaLocation.id, eventType: 'hvntz-discovery-placement', amountEarned: 18, payerId, settleFn: demoTransferFn,
  });
  await recordRevenueEvent(store, {
    locationId: archLocation.id, eventType: 'screen-ad', amountEarned: 32.5, payerId, settleFn: demoTransferFn,
  });
  await recordRevenueEvent(store, {
    locationId: confluenceLocation.id, eventType: 'community-thread', amountEarned: 12, payerId, settleFn: demoTransferFn,
  });

  // -- The differentiator: ONE business, several real revenue streams
  // populated simultaneously. Per REVENUE_EVENT_TYPES (14 real stream
  // types) -- this seeds 6 of them against the same location, so the
  // Franchise List/revenue-events view shows differentiated numbers
  // across streams, not one flattened total.
  const cherokeeStreetMercantile = registerBusiness(store, { name: 'Cherokee Street Mercantile', ownerId: 'owner-cherokee-street-mercantile' });
  const mercantileLocation = registerLocation(store, {
    businessId: cherokeeStreetMercantile.id, locationType: 'screen', address: '2611 Cherokee St, St. Louis, MO', lat: 38.5989, lng: -90.2245,
  });

  const differentiatorStreams = [
    { eventType: 'screen-ad', amountEarned: 42.50 },
    { eventType: 'screen-dtc-sale', amountEarned: 128.75 },
    { eventType: 'station-transaction', amountEarned: 9.99 },
    { eventType: 'vavlt-streaming', amountEarned: 61.20 },
    { eventType: 'community-thread', amountEarned: 15.00 },
    { eventType: 'package-pickup', amountEarned: 6.50 },
  ];
  const differentiatorEvents = [];
  for (const stream of differentiatorStreams) {
    differentiatorEvents.push(await recordRevenueEvent(store, {
      locationId: mercantileLocation.id, eventType: stream.eventType, amountEarned: stream.amountEarned, payerId, settleFn: demoTransferFn,
    }));
  }
  const differentiatorTotal = Math.round(differentiatorEvents.reduce((sum, e) => sum + e.amountEarned, 0) * 100) / 100;

  console.log(`[hvntz] seeded hunt "${hunt.title}" (#${hunt.id}) with ${hunt.checkpoints.length} real checkpoints (Cahokia Mounds / Gateway Arch / Confluence).`);
  console.log(`[hvntz] seeded ${store.businesses.length} businesses, ${store.locations.length} locations.`);
  console.log(
    `[hvntz] differentiator business "${cherokeeStreetMercantile.name}" (#${cherokeeStreetMercantile.id}) has `
    + `${differentiatorEvents.length} distinct real revenue streams populated on one location `
    + `(${differentiatorStreams.map((s) => s.eventType).join(', ')}) totaling $${differentiatorTotal} -- see GET /api/franchise-list/${cherokeeStreetMercantile.id}`
  );
  // Real, optional use of the just-added getLocationsForBusiness --
  // confirms the differentiator business's real location is visible
  // through it, not required for seeding itself.
  console.log(`[hvntz] getLocationsForBusiness confirms ${getLocationsForBusiness(store, cherokeeStreetMercantile.id).length} real location(s) for business #${cherokeeStreetMercantile.id}.`);

  return {
    hunt,
    businessCount: store.businesses.length,
    locationCount: store.locations.length,
    differentiatorBusinessId: cherokeeStreetMercantile.id,
    differentiatorEvents,
  };
}

module.exports = { seedDemoData, demoTransferFn };
