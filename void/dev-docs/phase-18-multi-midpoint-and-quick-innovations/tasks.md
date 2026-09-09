# Tasks — Phase 18: Multi-Midpoint Delivery Choice, Forward Inventory & the Quick Innovation Thread

- [x] Fix `registerAffiliateStation`'s stale mandatory `stationId` —
      make it optional, require real coordinates (self-reported or
      HVNTZ-verified) instead
- [x] Add `getLocationsForBusiness` + `GET /api/business/:id/locations`
      to HVNTZ (`lib/revenueStack.js`, `server.js`)
- [x] Wire eligible `'drone-support'` affiliates into
      `multiModalRelay.js`'s real Dijkstra graph
- [x] Live-verify: two stations 12km apart, unreachable at 7km range
      alone, reachable through a registered affiliate midpoint
      (`[1, "affiliate:1", 2]`, confirmed via curl)
- [x] Build `lib/deliveryChoice.js` — bike/car/drone quote + pickup
      option; wire routes
- [x] Build `lib/businessLockers.js` — BusinessLocker,
      SellerInventoryPlacement, DroneLoadingEvent; wire routes
- [x] Live-verify: register locker, place inventory, load a drone,
      confirm inventory count decrements
- [x] Build `lib/regulatedBoxes.js` — chain-of-custody + VACA
      recipient check (`void-recipient` subject type); wire routes
- [x] Live-verify: custody log records a real `'refused'` entry on a
      real (fail-soft) unverified VACA lookup
- [x] Build `lib/staffing.js` — VOID Staffing (formalized) + HUNT
      Staffing; wire routes
- [x] Build `lib/mobileDocking.js` — MobileDroneDockingVehicle,
      DualMobilityCoordination, LaunchpadDriver; wire routes
- [x] Live-verify: dual mobility coordination computes a real
      rendezvous point/time against real waypoints; Launchpad Driver
      registration rejected against a non-mobile-docking vehicle id
- [x] Build `lib/taas.js` — TaaSSubscription, fixed `vaco` branding;
      wire routes
- [x] Confirm "proactive hardware suggestions" dependency
      (proactive business suggestion engine) doesn't exist in code —
      deferred, documented in README
- [x] Add new store fields (`store.js`)
- [x] Build `lib/seedDemoData.js` — real stations/drivers/jobs, real
      `groupOrdersIntoRoutes` batching
- [x] Live-verify: 3 nearby orders land on one real drone route (3
      stops), 1 distant order gets its own route
- [x] Update README (Phase 18 entry)
- [x] `node --check` on every new/changed file
