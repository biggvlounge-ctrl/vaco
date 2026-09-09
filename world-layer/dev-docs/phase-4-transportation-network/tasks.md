# Tasks — Phase 4: Transportation Network

- [x] Add `transportNodes: []`, `nextTransportNodeId: 1` to
      `createWorldLayer()` in `locations.js`.
- [x] Create `world-layer/transportation.js`: `generateTransportNode`,
      `getTransportNode`, `getTransportNodesAtLocation`,
      `setFuelAvailability`, `setOperationalStatus`,
      `setControlStatus`, `REPAIR_DIFFICULTIES`, `CONTROL_STATUSES`,
      `OPERATIONAL_STATUSES`.
- [x] Wire `world-layer/index.js` to also export `transportation.js`.
- [x] Add `world_transport_nodes` to `schema.sql`.
- [x] Verify (throwaway script, run with `node`, deleted after):
      - `generateTransportNode` throws on missing/nonexistent
        `locationId`, out-of-range `fuelAvailability` (both >100 and
        <0), each of the three invalid enums, and a nonexistent
        `ownerId`.
      - A node generated with a real `ownerId` does NOT add any role
        to that NPC — confirmed directly by re-reading `roles` after
        generation, not assumed.
      - Defaults correct: `repairDifficulty: 'moderate'`,
        `controlStatus: 'uncontrolled'`, `operationalStatus:
        'operational'`.
      - `setFuelAvailability` updates correctly and rejects
        out-of-range values.
      - `setOperationalStatus` / `setControlStatus` update correctly
        and reject invalid values or a nonexistent node id.
      - `getTransportNodesAtLocation` returns 2 for two nodes at the
        same location.
      - Regression: Phase 1 (`generateLocation`) and Phase 2
        (`generateNPC`) both used in the same run, unaffected.
- [x] Commit as its own change.

## Next
Information Propagation Engine and Persistent Asset Library (sections
5-6 of the architecture doc) are the remaining bundled systems, not
started here. Wiring `controlStatus` to an actual VACON-C faction, and
a fuel-scarcity cascade through the tick pipeline, are both believable
next steps but explicitly not done in this phase.
