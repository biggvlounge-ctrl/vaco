# Plan — Phase 4: Transportation Network

## Goal
Fourth bundled system from `UNIVERSAL_WORLD_LAYER_ARCHITECTURE.md`,
section 4: "Airports, helipads, roads, gas stations, bike shops,
ports, and train stations, unified." Doc's field list: `locationId,
vehicleTypes, fuelAvailability, repairDifficulty, ownership,
controlStatus, operationalStatus`.

## Design
- `world-layer/transportation.js`: `generateTransportNode(worldLayer,
  options)` builds one node with exactly those fields (`ownerId` in
  place of `ownership`, matching this project's `*Id` convention).
  Multiple nodes can exist at one location (a block can have both a
  gas station and a bike shop), so it's a plain array keyed by
  `locationId`, same pattern as businesses.
- **Deliberately does NOT auto-assign an NPC role on ownership**,
  unlike Phase 3's `generateBusiness`. Checked this directly: none of
  the seven roles from the architecture doc's NPC Genesis Engine
  section (survivor/employee/business_founder/influencer/
  tribe_member/displaced_person/skill_holder) describes "owns a gas
  station" any better than "owns a business" already does via
  `business_founder`. Inventing an eighth role not named anywhere in
  any source doc would be scope creep dressed up as consistency —
  flagged here explicitly so it doesn't read as an oversight.
- Three enums, all interpretive (none specified by any source doc,
  same honesty as every other undocumented enum in this project):
  - `repairDifficulty`: `easy`/`moderate`/`hard`/`extreme`, defaults
    `'moderate'` — a neutral middle, no stronger rationale available.
  - `controlStatus`: `uncontrolled`/`contested`/`controlled`, defaults
    `'uncontrolled'`. Named similarly to VACON-C's own
    `territory.js#resolveTerritoryControl` statuses
    (`contested`/`controlled`/`fortified`) since both describe
    faction-style contest over infrastructure, but deliberately not
    reusing that exact enum — a transport node isn't necessarily
    faction property the way a `territory_blocks` row is, so
    `'fortified'` doesn't apply and `'uncontrolled'` (no faction
    involved at all) is added instead.
  - `operationalStatus`: `operational`/`damaged`/`destroyed`, defaults
    `'operational'`.
- `fuelAvailability` is a 0-100 numeric scale, validated on both
  generation and update (`setFuelAvailability`) — chosen to match the
  0-100 scale VACON-C's own scarcity/threshold systems already use
  elsewhere (e.g. `SCARCITY_BROADCAST_THRESHOLD`), for consistency
  across the two codebases even though they don't share code.
  Defaults to `0` (not full), consistent with this project's standing
  rule of never assuming abundance that hasn't been explicitly set.

## Explicitly NOT in this task
- No Cesium/Overture import — `vehicleTypes` stays an opaque
  caller-provided list.
- No routing/pathfinding logic — nodes are unconnected points, not a
  graph. "VOID routing" (mentioned in the architecture doc) would need
  edges between nodes, not built here.
- No connection from `controlStatus` to VACON-C's actual faction
  system — the naming is intentionally parallel to
  `resolveTerritoryControl()`'s statuses, but no code calls between
  the two; wiring an actual faction to a transport node's control is a
  believable next step, not done here.
- No fuel-scarcity cascade — `setFuelAvailability` is a manual setter,
  same as every other threshold-adjacent field in this project until a
  tick-pipeline phase is explicitly told to drive it.

## Done when
- `generateTransportNode` validates `locationId` (present, real),
  `fuelAvailability` (0-100), all three enums, and (when provided)
  `ownerId` (must reference a real NPC).
- Generating a node with an owner does NOT touch that NPC's `roles` —
  verified directly, not just assumed.
- `setFuelAvailability`, `setOperationalStatus`, `setControlStatus`
  each validate their input and the target node's existence.
- `getTransportNodesAtLocation` reflects multiple nodes per location.
- Regression: Phases 1-3 (`locations.js`, `npcGenesis.js`) unaffected,
  verified by reusing both in the same test run.
