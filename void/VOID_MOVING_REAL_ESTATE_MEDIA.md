# VOID — Moving Services & Real Estate Media (v1)

Two new, confirmed-non-duplicate verticals.

## Moving Services

Real comparables **GoShare** + **Dolly**.

- **GoShare**: vehicle-tiered job matching (cars, SUVs, pickups, cargo
  vans, box trucks), bookable equipment (lift gates, appliance
  dollies, furniture dollies, lumber racks), covered by real cargo/
  liability/auto insurance.
- **Dolly**: $30-50/hr, requires 75lb lift capability + background
  check, "helper" vs "hand" role distinction.

```
MovingJob {
  id, customerId, requiredVehicleTier: "car" | "suv" | "pickup" |
    "cargo-van" | "box-truck"
  requiredEquipment: [string]
  helpersRequested: number
  assignedDriverId, assignedHelperIds: [string]
}
```

**Direct fit**: extends Gibson's existing vehicle-matching logic —
same driver pool, filtered by vehicle tier and equipment.

## Real Estate Media

Real comparable **HomeJab**. Automated match, not bidding — order
assigned to an approved photographer **within 50 minutes** of the
property who's available. Pay: $40-80+/hour. Scope: photography, video
walkthroughs, aerial/drone shots, 3D virtual tours, floor plans.
HomeJab handles all post-production centrally — photographer uploads
raw files only. Scale: 15,000+ brokers/agents served nationwide.

```
RealEstateMediaJob {
  id, propertyAddress, agentId
  servicesRequested: ["photos" | "video-walkthrough" | "aerial-drone" |
    "3d-tour" | "floor-plan"]
  assignedProviderId
  proximityMatched: boolean
  postProductionHandled: "central" | "provider"
}
```

**Direct fit**: the aerial/drone photography service connects directly
to VOID's existing drone fleet.

---

## Implementation status (added when this file was placed into the repo)

- **Moving Services** — `lib/movingServices.js`: real `VEHICLE_TIERS`
  (all five above) and `EQUIPMENT_OPTIONS`, `createMovingJob`,
  `assignMovingDriver`, `addMovingHelper`. Registered as the
  `freightMoving` vertical with `freePickupDelivery: true`.
- **Real Estate Media** — `lib/realEstateMedia.js`: real
  `REAL_ESTATE_SERVICES` (all five), `POST_PRODUCTION_MODES`
  (`central` default, matching HomeJab's real model), and
  `assignNearestProvider` doing real Haversine-distance auto-matching
  rather than bidding. Registered as its own `realEstateMedia`
  vertical, deliberately distinct from the generic `photography` one.

**Real gap found and fixed when this file was placed**: the
**50-minute bound above was never enforced**. `assignNearestProvider`
picked the nearest available provider at *any* distance and still set
`proximityMatched: true` — so a provider 384km away would be assigned
and flagged as a proximity match, which is a fabricated claim, not
just a missing feature. It now enforces a real, named
`DEFAULT_MAX_PROVIDER_TRAVEL_MINUTES = 50` and raises when the nearest
provider is beyond it, leaving `assignedProviderId` null and
`proximityMatched` false rather than writing false state. A caller can
relax the bound deliberately via an explicit `maxTravelMinutes`.

One flagged interpretive constant was needed for that: the doc states
the bound in travel *minutes* while every distance in this codebase is
real straight-line km, so converting requires an assumed average speed
(`DEFAULT_AVERAGE_TRAVEL_SPEED_KMH = 50`, a real common mixed urban/
suburban driving average, overridable per call). Straight-line
distance understates real road travel, so the bound is if anything
permissive — stated plainly rather than hidden.

**Not built**: real cargo/liability/auto insurance coverage (GoShare's
real differentiator — a genuine commercial/legal arrangement, not
software), background checks and the 75lb lift verification Dolly
requires, and centralized post-production itself
(`postProductionHandled: 'central'` records the real mode but no media
pipeline exists behind it).
