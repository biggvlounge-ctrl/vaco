# Tasks — Phase 6: Persistent Asset Library

- [x] Add `assets: []`, `nextAssetId: 1` to `createWorldLayer()` in
      `locations.js`.
- [x] Create `world-layer/assetLibrary.js`: `registerAsset`,
      `getAsset`, `getAssetsByType`, `useAsset` — importing
      `LOCATION_TIERS` from `locations.js` rather than redefining a
      parallel enum.
- [x] Wire `world-layer/index.js` to also export `assetLibrary.js`.
- [x] Add `world_assets` + `world_asset_usages` to `schema.sql`.
- [x] Verify (throwaway script, run with `node`, deleted after):
      - `registerAsset` throws on missing `assetType`, missing
        `generatedModel`, and an invalid `qualityLevel`.
      - Default `qualityLevel` is `'filler'`.
      - Confirmed directly (not assumed) that the accepted
        `qualityLevel` values are literally `LOCATION_TIERS` —
        `JSON.stringify` equality check against Phase 1's exported
        constant.
      - A new asset starts with `usageCount: 0` and empty
        `locationHistory`.
      - A `qualityLevel: 'hero'` asset registers correctly.
      - Calling `useAsset` 3 times against the same asset at 3
        different real locations correctly brings `usageCount` to 3
        and `locationHistory` to all 3 location ids.
      - `useAsset` throws on a nonexistent asset id or location id.
      - `getAssetsByType` returns the right count per type, and an
        empty array for an unregistered type.
      - Regression: Phase 1 (`generateLocation`) used in the same run,
        unaffected.
- [x] Commit as its own change.

## Next
This completes all six bundled systems from
`UNIVERSAL_WORLD_LAYER_ARCHITECTURE.md`'s "final architecture
consolidation" list (Locations, NPC Genesis, Commerce, Transportation,
Information Propagation, Asset Library). None of it is connected to
any real external data source yet (Cesium/UNESCO/NRHP/Overture Maps —
still just the three source docs, no import code). That, and the
VACON-C reconciliation question flagged back in Phase 2, are the two
largest open items.
