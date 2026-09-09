# Tasks — Phase 1: Location schema

- [x] Create `world-layer/locations.js`: `createWorldLayer`,
      `generateLocation`, `getLocation`, `setLocationData`,
      `addLocationEvent`, `LOCATION_TIERS`, `DATA_FIELDS`.
- [x] Create `world-layer/schema.sql`: `world_locations` +
      `world_location_events` tables, matching VACON-C's schema
      conventions.
- [x] Create `world-layer/index.js`, `package.json`, `README.md`.
- [x] Verify (throwaway script, run with `node`, deleted after):
      - `generateLocation` throws on missing `name`.
      - `generateLocation` throws on missing/non-numeric `lat`/`lng`.
      - `generateLocation` throws on an invalid `tier`.
      - Default `tier` is `'filler'` when omitted.
      - A `hero`-tier location generates correctly with real
        coordinates (Gateway Arch, St. Louis: 38.6247, -90.1848).
      - `setLocationData` persists a value and a re-read via
        `getLocation` sees it (`landmarkData`, `businessData` both
        checked).
      - `setLocationData` throws on an invalid field name.
      - `setLocationData` throws on a nonexistent location id.
      - `addLocationEvent` stamps the `WorldLayer`'s current `tick`
        onto the event.
      - Final location count matches expectations (2).
- [x] Commit as its own change.

## Next
The NPC Genesis Engine's connection point (`locationId` on generated
NPCs, and how VACON-C's existing `entities`/`npcs` tables relate to
`world_locations`) is the next task — not started here. No external
data source (Cesium/UNESCO/NRHP/Overture) is wired in yet either;
this phase only defines where that data will land.
