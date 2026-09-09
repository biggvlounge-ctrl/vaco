# World Layer

Shared "Universal World Layer" data module. One generated record per
real-world location, so that consuming apps read one city instead of
each generating its own separate copy.

> **Nothing consumes it yet.** An earlier version of this line said the
> module is "read by VACON-C, VENVS, and HVNTZ". It is not, and was
> not: a repo-wide search finds no `require` of this package from any
> app. Every hit is a code comment citing it as a *pattern*. VACON-C
> reading this layer is a real, scoped integration decision — see
> `dev-docs/phase-8-vacon-c-reconciliation/plan.md`, which deliberately
> deferred it — not something that has quietly happened.
>
> That matters more than a wording fix, because this module is the
> layer the global-coverage cost argument rests on: the architecture
> document's target is "90%+ automated world construction, 10% human
> refinement", and this is the 90%. It is real code and it is now
> tested (28 tests, `npm test`) — it is simply not plugged in.

See `UNIVERSAL_WORLD_LAYER_ARCHITECTURE.md` (project root) for the
full architecture. All six bundled systems from that doc's "final
architecture consolidation" are implemented.

**Relationship to VACON-C**: linked, not replaced. This package is a
separate, shared data layer; VACON-C's own `entities`/`npcs`/
`organizations` tables remain untouched and authoritative for VACON-C
specifically. See `dev-docs/phase-8-vacon-c-reconciliation/plan.md`
for the full reasoning.

## What's here
- `locations.js` — the module: `createWorldLayer()`,
  `generateLocation()`, `getLocation()`, `setLocationData()`,
  `addLocationEvent()`.
- `npcGenesis.js` — the NPC Genesis Engine: `generateNPC()`,
  `getNPC()`, `getNPCsAtLocation()`, `assignRole()`, `relocateNPC()`.
  One shared creation system for every NPC role (survivor, employee,
  business founder, influencer, Tribe member, displaced person,
  skill-holder) — role is assigned after generation, not baked in, so
  one generated person can hold several roles at once.
- `commerce.js` — the Real World Commerce Layer:
  `generateBusiness()`, `getBusiness()`, `getBusinessesAtLocation()`,
  `addEmployee()`, `setBusinessEconomicValue()`. Generating a business
  with an owner auto-assigns that NPC the `business_founder` role;
  `addEmployee()` auto-assigns `employee` — real calls into the NPC
  Genesis Engine, not just a shared `locationId` convention.
- `transportation.js` — the Transportation Network:
  `generateTransportNode()`, `getTransportNode()`,
  `getTransportNodesAtLocation()`, `setFuelAvailability()`,
  `setOperationalStatus()`, `setControlStatus()`. Unlike Commerce,
  ownership here does not auto-assign an NPC role — no role in the
  Genesis Engine's list fits it.
- `propagation.js` — the Information Propagation Engine:
  `originateEvent()`, `getInformationEvent()`,
  `calculatePropagation()` (pure function), `propagateEvent()`,
  `getPropagationsForLocation()`. One mechanism for rumors, disasters,
  laws, business openings, wars, discoveries, and reputation —
  `eventType` is a free-form string, not an enum, since the whole
  point is the mechanism doesn't branch on it.
- `assetLibrary.js` — the Persistent Asset Library:
  `registerAsset()`, `getAsset()`, `getAssetsByType()`, `useAsset()`.
  `qualityLevel` reuses `LOCATION_TIERS` from `locations.js` directly
  (not a parallel enum) — the same hero/regional/filler tiering the
  architecture doc applies to both locations and assets.
- `imports/unescoImport.js` — the first real external-data import:
  `importUnescoSites()` (real, tested) creates `hero`-tier locations
  with `landmarkData` from UNESCO World Heritage site records;
  `fetchUnescoSites()` is a documented stub — **this sandboxed
  environment's outbound proxy cannot reach query.wikidata.org or
  UNESCO's own site (confirmed directly, not assumed)**, so the live
  fetch isn't implemented, but the import pipeline itself is real code
  ready to receive real data from wherever it ends up being fetched.
- `schema.sql` — the literal Postgres shape (`world_locations`,
  `world_location_events`, `world_npcs`, `world_businesses`,
  `world_business_employees`, `world_transport_nodes`,
  `world_information_events`, `world_information_propagations`,
  `world_assets`, `world_asset_usages`), same conventions as VACON-C's
  schema.
- `dev-docs/` — per-phase plan/tasks, same convention as
  `vacon-c/dev-docs/`.

## Location record shape
```js
{
  id, name, lat, lng,
  tier,              // 'hero' | 'regional' | 'filler' (default)
  terrainType,
  geographyData, buildingData, businessData, landmarkData,
  populationData, transportationData, economicData, ownershipData,
  eventHistoryData,  // array, appended via addLocationEvent()
  createdTick,
}
```

The nine data slices (`geographyData` through `ownershipData`) start
`null` — nothing populates them yet. `setLocationData()` validates the
field name against the known list so a typo fails immediately instead
of silently creating a stray property.

## NPC Genesis Engine shape
```js
{
  id, locationId, demographics, occupation, skills, language,
  personality, relationships, goals, migrationStatus, economicRole,
  roles,      // array, empty at creation — assigned via assignRole()
  createdTick,
}
```

## Business record shape
```js
{
  id, locationId, building, ownerId, industry,
  employees,           // array of npc ids, deduped via addEmployee()
  economicValue, supplyNeeds, securityRequirement,
  createdTick,
}
```

## Transport node shape
```js
{
  id, locationId, vehicleTypes, fuelAvailability, repairDifficulty,
  ownerId, controlStatus, operationalStatus,
  createdTick,
}
```

## Information event shape
```js
{
  id, eventType, originLocationId, description,
  propagations,  // [{ locationId, spreadProbability, timeDelay, arrivesTick }]
  createdTick,
}
```

## Asset shape
```js
{
  id, assetType, generatedModel, variants,
  qualityLevel,       // 'hero' | 'regional' | 'filler' (default), reused from LOCATION_TIERS
  usageCount, locationHistory,  // [{ locationId, tick }], built up by useAsset()
  createdTick,
}
```

## Not yet built
- The live UNESCO/Wikidata fetch itself (`fetchUnescoSites()` is a
  stub — this environment cannot reach that network), and any Cesium/
  NRHP/Overture Maps import at all (same network constraint applies).
- Supply chain resolution against `supplyNeeds`; property system
  (explicitly deferred, same as VACON-C's own `CLAUDE.md`); routing/
  pathfinding between transport nodes; actual pass/fail resolution of
  `spreadProbability` into a real propagation outcome; automatic
  reuse-vs-generate decisions in the Asset Library.
- Deriving a location's `populationData`/`economicData` slices from
  `getNPCsAtLocation()`/business data — currently separate,
  manually-reconciled things.
- Postgres wiring (schema exists, no driver code yet — will follow
  `vacon-c/server/db.js` + `migrate.js`'s pattern when that's next).
