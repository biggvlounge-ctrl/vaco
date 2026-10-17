# World Layer

Shared "Universal World Layer" data module. One generated record per
real-world location, so that consuming apps read one city instead of
each generating its own separate copy.

> **This line used to say "nothing consumes it yet." That is no longer
> true, and the correction is kept here rather than quietly dropped.**
> `require('world-layer')` is still never allowed across the directory
> boundary — see `dev-docs/phase-8-vacon-c-reconciliation/plan.md` and
> `dev-docs/DEPLOYMENT_FILE_PLACEMENT.md` — so the real integration is
> by DATA, as a pack VACON-C's own reader modules validate and read:
> `exportRegion.js` → `vacon-c/server/landmarkPacks.js` (real named
> places), and `exportRegionStats.js` → `vacon-c/server/
> populationPacks.js` (real Census ACS age/attainment shares, plus a
> real CDC PLACES health baseline), `labourPacks.js` (real BLS OES
> employment shares and wages), `infrastructurePacks.js` (real HIFLD
> facility capacities), `businessPacks.js` (real Overture Places
> retail businesses, named and categorized), `climatePacks.js` (a
> real NOAA-derived Köppen-Geiger climate key, one per region), and
> `riskPacks.js` (real FEMA National Risk Index hazard weights, which
> narrow a city's weather draw within its climate's own possibilities),
> and `natalityPacks.js` (a real CDC/NCHS age-specific fertility rate,
> for a curve `births.js` itself calls invented). `populationPacks.js`
> also now carries `overdoseBaselineFor` — a real CDC/NCHS drug-
> overdose death rate, as a SECOND baseline that compounds with the
> CDC PLACES one in `mortality.diseasePressure` rather than a new
> mechanism; this engine has no drug/substance mechanic of any kind,
> and that was a deliberate line not to cross. Each of these eight is
> optional and a world with none of them still generates exactly as it
> always did — these are enrichments, never a requirement.
>
> **One more, `religionPacks.js` (real U.S. Religion Census shares,
> onto `npcs.religion`), is a different kind of pack and says so in its
> own header.** Every pack above replaces an invented NUMBER with a
> real one; this one replaces an invented VOCABULARY — VACON-C's
> `worldgen.js` deliberately uses fictional religion names for the same
> stated reason it uses fictional ethnicities, and this pack's real
> labels go onto people also subject to simulated crime, death and
> disease mechanics. It exists on explicit instruction, against the
> recommendation given when it was proposed. A world with no religion
> pack keeps the fictional vocabulary, unchanged.
>
> **`cdcImport.js` now maps DEPRESSION and BINGE too** — the only two
> measures CDC PLACES actually publishes at tract level for mental
> health and alcohol use. No specific drug is estimated at this grain
> by CDC at all, which is exactly why overdose mortality is a separate,
> county-level source instead of a third measure here.
>
> **`imports/fbiImport.js` exists, is tested, and is deliberately left
> unwired — because the bug it was built to fix is already fixed, a
> better way.** Its own header describes `crime.DANGER_REFERENCE_PER_1K`
> reading "crime: 100" in most areas because the reference was 40; a
> direct read of `crime.js` found that constant is now 280, corrected
> through an internally-measured method ("the 95th percentile of the
> SHRUNK distribution... Measured, not chosen") that is EXACTLY what
> the seventeenth standing rule asks for — the right reference for an
> internal mechanic came from inside the model. Recalibrating against
> real FBI rates now would not fix a bug; it would reintroduce the one
> already corrected, with an external number standing in for an
> internal measurement that already exists and is better-suited to a
> world where every area can read as `contested`.
>
> **`cmsImport.js` and `ncesImport.js` are REFRESH sources for
> `infrastructurePacks.js`, not new packs** — a real CMS bed count and
> a real NCES pupil count fill the same `hospitals`/`schools` capacity
> HIFLD fills, and the exporter now reads all three. `gnisImport.js`
> and `overtureImport.js`'s `importOvertureDivisions()` needed **no
> new code at all**: both already write onto the exact fields
> `exportRegion.js` and `landmarkPacks.js` already read.
>
> **Genuinely not wired, and that is a stated choice, not an
> oversight.** `usgsImport.js` (elevation/terrain) has no existing
> VACON-C consumer — nothing in the engine reads a terrain fact today
> — and wiring real data into a field nothing decides anything from
> would be the eleventh standing rule read backwards: a real import
> nothing reads is indistinguishable from not importing it. Closing it
> for real means a design decision about what terrain should DO first,
> not a pack reader. `overtureImport.js`'s `importOvertureBuildings()`
> (real footprint/height/floor data) would mean matching every
> ordinary generated home, not one per city or community — a materially
> bigger structural change than anything above, left for its own round
> rather than rushed into this one. `wikidataImport.js` and
> `wikimediaCommons` overlap UNESCO/NRHP/GNIS landmark coverage with
> little marginal value, and Commons is images this engine has no
> renderer to use. `naturalEarthImport.js` and `openweatherImport.js`
> sit at a grain (country boundaries; historical weather events) this
> engine's city/community model does not currently ask for.
>
> This module is the layer the global-coverage cost argument rests on:
> the architecture document's target is "90%+ automated world
> construction, 10% human refinement", and this is the 90%. It is real
> code, genuinely consumed now, not just tested in isolation.

See `UNIVERSAL_WORLD_LAYER_ARCHITECTURE.md` (project root) for the
full architecture. For the four things this stack does NOT cover —
parcels, block-level statistics, high-resolution terrain and
hydrography, and crime data — plus the licensing traps and how each
dataset lands on a VACON-C column, see `dev-docs/LAND_AND_MAP_DATA.md`. All six bundled systems from that doc's "final
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
- `imports/censusImport.js`, `imports/blsImport.js`, `imports/hifldImport.js`
  — real U.S. government open-data importers: Census Bureau ACS (age/
  household/attainment/income distributions, per tract), BLS OES
  (employment shares and median/mean wages, per metro, mapped onto
  this engine's occupations by SOC major group), and HIFLD Open (real
  facility capacities — hospital beds, water systems served, power
  plant megawatts — for VACON-C's own ten infrastructure types). All
  three write onto a `Location`'s `populationData`/`economicData`/
  `buildingData`; none fetch live (the real government hosts are
  outside this sandboxed environment's outbound proxy, confirmed
  directly rather than assumed, same as UNESCO below) — each importer's
  transform is the tested part, ready for real rows from wherever they
  end up being fetched.
- `imports/overtureImport.js`, `imports/cdcImport.js`, `imports/noaaImport.js`
  — three more real sources, same posture as the three above.
  `importOverturePlaces()` turns real Overture Places records into
  named retail businesses (mapped onto VACON-C's ten retail types) and
  hero-tier landmarks, onto `landmarkData` — the same field the UNESCO
  importer writes, with `exportRegionStats.js`'s `exportBusinessPack`
  reading back only the retail half (the hero half is
  `exportRegion.js`'s own `KEY_CATEGORIES`). `importOvertureDivisions()`
  and `importOvertureBuildings()` round out the same source with real
  administrative area names and building footprints.
  `importPlacesTract()` turns real CDC PLACES chronic-disease
  prevalence into a baseline mortality-pressure multiplier, centred on
  1 — a share for a place, never a per-person fact (§9's firewall).
  `importClimateNormals()` classifies real NOAA climate normals into
  the published Köppen-Geiger vocabulary. All three are real,
  tested transforms with no live fetch (same outbound-proxy block as
  the rest of this list).
- `imports/femaImport.js` — real FEMA National Risk Index county
  ratings, turned into a weight per `environment.SEVERE` condition
  (`exportRegionStats.js`'s `exportRiskPack`) — and, named rather than
  folded in, the published hazards (wildfire, earthquake, and so on)
  this engine genuinely has no mechanism for. No live fetch (same
  outbound-proxy block).
- `imports/religionImport.js` — the U.S. Religion Census, the one
  source in `sources.js` that is licence-encumbered rather than public
  domain, carrying that warning on every row it writes. `importReligionCensus()`
  turns real county adherent counts into shares over a closed,
  stated tradition vocabulary plus `unaffiliated`. Unlike every other
  source here, wiring this into VACON-C was a genuine design tension
  rather than a default — see `religionPacks.js`'s own header on the
  VACON-C side.
- `imports/cmsImport.js`, `imports/ncesImport.js` — two more REFRESH
  sources for the same `infrastructurePacks.js` consumer HIFLD already
  fills, not new pack types. `importProvider()` is CMS's quarterly,
  legally-required bed count — fresher than HIFLD's own, decided by
  collection date (`preferByDate`) rather than by which source is
  "the" winner. `importInstitution()` turns a real NCES pupil count
  into a school's capacity the same way HIFLD gives a hospital one.
  `exportRegionStats.js`'s `exportInfrastructurePack` reads all three
  sources now — gating it on `'hifld-open'` alone would have silently
  dropped every CMS-refreshed or NCES-sourced facility, the same bug
  class `exportPopulationPack` had for a CDC-only tract.
- `imports/gnisImport.js`, `imports/overtureImport.js`'s
  `importOvertureDivisions()` — **both needed zero new exporter or
  reader code.** GNIS writes real natural features (caves, summits,
  bluffs — the two Key categories nothing else in this registry names)
  onto `landmarkData` with a category already in `exportRegion.js`'s
  own `KEY_CATEGORIES`, so `exportRegion` already reads them; its
  `places` output (real populated-place names) and Overture Divisions'
  `byLevel.community` are both already the exact shape a landmark
  pack's `areas` field wants. `test/exportRegion.test.js` locks this in
  rather than leaving it as something to re-derive later.
- `imports/natalityImport.js` — real CDC/NCHS age-specific fertility
  rates, per county, per the six standard five-year bands —
  `exportRegionStats.js`'s `exportNatalityPack`. A rate, not a share:
  several age bands do not sum to 1, unlike every other demographic
  source in this registry.
- `imports/overdoseImport.js` — real CDC/NCHS drug-overdose mortality,
  turned into a SECOND baseline mortality multiplier that compounds
  with CDC PLACES' chronic-disease one rather than replacing it or
  introducing a new mechanism — `exportPopulationPack` now reads
  either, or both, independently. Its own header explains at length
  why this folds into the existing mechanism instead of inventing a
  drug/substance mechanic that does not otherwise exist here.
- `imports/censusImport.js`'s Gini/income extension — `importAcsTract`
  had been writing real `medianHouseholdIncome`/`incomeQuantiles`
  since round 1, with zero VACON-C consumer; `giniIndex` (bounded
  `[0, 1]`, dropped rather than coerced if out of range — the
  `Number(null)` corollary applies here exactly as it does everywhere
  else in this registry) closes the same gap `exportIncomePack`
  reads, via `incomePacks.js` on the VACON-C side.
- `imports/hudPitImport.js` — real HUD Point-in-Time per-capita
  homelessness rates, per Continuum of Care, turned into the opposite
  condition VACON-C's invented `homesPerResident` margin (always above
  1) can never express on its own — `exportPopulationPack`'s
  `hasHomelessness` branch, read via `populationPacks.
  homelessnessRateFor` on the VACON-C side.
- `imports/nygsImport.js` — OJJDP's National Youth Gang Survey, the
  one real, public, structured gang-count source after FBI NGIC
  (qualitative/PDF), GangNET and CalGang (both restricted, non-public)
  were checked and ruled out. Its own header documents exactly what
  was checked. Deliberately not current: `LAST_SURVEY_YEAR = 2012` is
  enforced (the importer throws on a later year) and a `staleness`
  string is carried on every row — `exportGangPack`, read via
  `gangPacks.js` on the VACON-C side.
- `imports/electionImport.js` — real MIT Election Lab county
  presidential returns (CC0), turned into a two-party Democratic vote
  share — `exportPoliticalPack`, read via `politicalPacks.js` on the
  VACON-C side. **Deliberately the one source in this registry with no
  behavioral consumer.** VACON-C has no invented political-lean
  constant to replace, and inventing one (a crime-rate bias, a
  policing-intensity term) from a real vote share would be fabricating
  a causal claim, not closing a gap — see that module's own header.
  Read only, as a reported `statistics.js` entry.
- `exportRegion.js` / `exportRegionStats.js` — the consumer join: turn
  a region's real imported data into the eleven packs VACON-C's own
  reader modules validate and read (see the note at the top of this
  file), plus the sources above that need no pack of their own.
  Plain JSON, never a cross-directory `require`.
- **`imports/overtureTransportationImport.js` (roads) remains
  deliberately unconsumed, by explicit project policy rather than
  oversight.** Its own header opens "VACON-C DEFERS TRANSPORTATION BY
  POLICY. READ THIS FIRST" and every row carries a `DEFERRED_BY` field.
  This was proposed as a join twice in this project's history and
  excluded both times on reading that header — recorded here so a
  future pass checks the policy before writing the reader, not after.
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

## Data sources — added 18 Sep 2026

`sources.js` is the registry: sixteen free datasets, each with its
licence, access path, the slice of the world model it fills and the
tier it serves. Five have importers — UNESCO, the National Register of
Historic Places, Overture Places, Wikidata and Wikimedia Commons; the
other eleven are identified with a named payoff each.

`costModel.automationCoverage()` reports what that covers per tier, and
`COST_REDUCTION_THROUGH_DATA.md` is the reasoning behind it: how far
free data can push the $420,000-$960,000 hero-tier figure down, what it
can never pay for, and why the biggest lever is reclassification rather
than discount.

**Every source host is blocked from the build environment** (403
CONNECT at the agent proxy, checked directly). Each importer is a real,
tested transform plus a `fetch*` that throws naming the block and the
genuine access path — so on a reachable network each is one function
away and no transform changes.
