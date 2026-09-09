# Universal World Layer — The Final Architecture Consolidation (v2)

The definitive architectural bundling, superseding the earlier
scattered dataset/system documents — one shared world model every
gameplay system reads from, plus real, additional free data sources
worth evaluating.

## The core confirmation — one Universal World Layer, not separate systems

**Direct confirmation**: every system built this session (terrain,
buildings, landmarks, businesses, NPCs, transportation, economy)
should feed one shared, generated Earth model, not operate as
separate generation pipelines.

```
UniversalWorldLayer {
  geographyData, terrainType, buildingData, businessData,
  landmarkData, populationData, transportationData,
  economicData, ownershipData, eventHistoryData
}
```

**Real cost impact, confirmed**: one generation pipeline, one cache,
one database — multiple gameplay systems reading from the same
source, not duplicating world-generation work per system.

## 1. NPC Genesis Engine — one creation system, not seven

**Direct confirmation**: survivors, employees, business founders,
influencers, Tribe members, displaced persons, and NPC skill-holders
should all originate from **one** NPC creation system, not separate
generation paths for each role.

```
NPCGenesisEngine {
  locationId, demographics, occupation, skills, language,
  personality, relationships, goals, migrationStatus, economicRole
}
```

The same generated NPC can *become* any of these roles — no separate
creation cost per category.

## 2. Hero Location Tier — confirmed, formalized as the standing structure

```
HeroTier { unesco, globallyRecognizedLandmarks, premiumHumanCreation }
RegionalTier { cities, universities, stadiums, historicDistricts,
  aiAssistedGenerationPlusLimitedReview }
FillerTier { houses, stores, offices, roads, genericBuildings,
  fullyAutomated }
```

Human artists only touch locations players emotionally recognize —
confirming and formalizing the ~1,200 UNESCO-site cost discipline
already established.

## 3. Real World Commerce Layer — bundled

Overture Places + Cesium OSM Buildings + business data + the property
system, unified:

```
RealWorldCommerceLayer {
  businessId, location, building, owner, industry, employees,
  economicValue, supplyNeeds, securityRequirement
}
```

Directly powers: the Business Founding Pipeline, Territory Control,
Jobs, Economy, HVNTZ hunts, VOID commerce, and NPC goals — one system
instead of multiple separate databases.

## 4. Transportation Network — bundled

Airports, helipads, roads, gas stations, bike shops, ports, and train
stations, unified:

```
TransportationNetwork {
  locationId, vehicleTypes, fuelAvailability, repairDifficulty,
  ownership, controlStatus, operationalStatus
}
```

Powers collapse mobility, fuel scarcity, biker advantages, logistics,
VOID routing, and rebuilding missions — no separate transportation
simulation needed.

## 5. Information Propagation Engine — confirmed as the one, universal mechanism

```
InformationPropagationEngine {
  eventType, origin, distance, connectivity, trustNetwork,
  languageBarrier, timeDelay, spreadProbability
}
```

Used for rumors, disasters, laws, business openings, wars,
discoveries, and player reputation — one system, not separate
mechanisms per event type.

## 6. Persistent Asset Library — AI generation, confirmed with real reuse tracking

```
PersistentAssetLibrary {
  assetType, generatedModel, variants, qualityLevel, usageCount,
  locationHistory
}
```

One generated gas station appears in thousands of towns; one house
family creates millions of real variations; one warehouse gets reused
globally — major reduction in ongoing AI generation cost through
real, tracked reuse.

## 7. Real human cost hierarchy — confirmed

Tier 1 (global icons, ~1,200 UNESCO locations): real, paid human
work. Tier 2 (major cities): AI-assisted refinement only. Tier 3
(everything else): fully automated.

## 8. Additional real, free data sources to evaluate

- **Natural Earth** — free global geographic boundaries (countries,
  states, regions)
- **OpenStreetMap** (direct) — roads, transportation, structures,
  amenities, beyond what Cesium's OSM layer already surfaces
- **Wikidata** — genuinely valuable: real, structured historical
  entities, people, organizations, and locations, free and open
- **USGS** — real terrain/environment data
- **NOAA** — real weather/ocean/coastal data, directly relevant to
  the existing Weather/Climate system
- **OpenWeather historical datasets** — real climate modeling support

All feed the same Universal World Layer.

## Final architecture, confirmed

```
Universal World Layer
        |
+-------+-------+-------+
|       |       |       |
NPC   Economy Transport Information
Engine Engine  Engine   Engine
        |
   Gameplay Systems
```

## Status

The full-world generation cost is further reduced by collapsing
duplicated pipelines into one shared world infrastructure layer. The
largest remaining real human expense is not world creation itself —
it's selective artistic refinement of the roughly 1,200 UNESCO
locations players actually recognize emotionally. The project
continues toward the real, confirmed target: 90%+ automated world
construction, 10% human refinement. This document supersedes the
earlier scattered dataset documents as the single, authoritative
architecture reference.

---

## Cost arithmetic — added 29 Aug 2026, and now measurable

Section 7's tier hierarchy is the whole cost model, and one number was
never derived from it. Doing so changes how the headline figure should
be read:

```
$420,000 - $960,000   the hero-tier figure on file
     ~1,200           UNESCO locations = Tier 1's scope, per §7
--------------------------------------------------------
   $350 - $800        per hero location
```

**The hero figure is a per-unit rate, not a launch invoice.** It covers
full global Tier 1 coverage over the life of the project. A first
release built around one deep city plus a handful of recognisable icons
is on the order of 25-50 hero locations — **$9,000-$40,000** — with the
rest of that world coming from Tiers 2 and 3, which nobody is paid per
location for.

Quoting the lifetime figure as a launch cost overstates a first release
by more than an order of magnitude. That is the most expensive
misreading available in this document and it is now guarded by a test
(`test/cost-model.test.js`, "the hero figure is a per-unit rate").

### Both savings claims are now computed, not asserted

`costModel.js` reports them against a running world:

| Claim in this document | Function | What it returns |
|---|---|---|
| "one gas station appears in thousands of towns" | `getReuseReport()` | assets created, placements, **creations avoided**, reuse ratio, and unused inventory kept separate from real reuse |
| "90%+ automated world construction, 10% human refinement" | `getTierCoverage()` | counts per tier, paid-human-work total, automated share, and whether the 90% target is met |
| what a *specific* scope costs | `estimateBuildCost()` | rates supplied by the caller, never assumed — an unpriced tier is named rather than silently totalled as free |

Nothing in `costModel.js` hardcodes a dollar figure. `HERO_RATE_ON_FILE`
carries the $350-$800 rate as data with its derivation attached, so a
caller applies it knowingly rather than inheriting it silently, and a
test multiplies it back up to $420K-$960K across 1,200 locations to
catch the two drifting apart.

### The import that makes Tier 1 cheap is now runnable

`fetchUnescoSites()` still throws in this environment — the outbound
proxy rejects query.wikidata.org and whc.unesco.org, confirmed against
the proxy's own status endpoint. What was missing was any way to run
the real pipeline at all. `scripts/import-unesco.mjs` closes that:

```
node scripts/import-unesco.mjs sites.json      # run the real import
node scripts/import-unesco.mjs --print-query   # the SPARQL to fetch with
```

It accepts a bare array or a raw Wikidata response, maps the bindings,
runs the tested import, and reports tier coverage. On a network that
can reach Wikidata this is one command. Placement is not art — these
locations still need Tier 1 refinement — but nobody has to research or
place them by hand.

## Implementation status (added when this file was placed into the repo)

**This is the parent document `world-layer/` was built from, and it
shows.** Six of its eight numbered systems have a real module, and
several modules cite this document by section number in their own
headers — `propagation.js` opens with "Source of truth:
UNIVERSAL_WORLD_LAYER_ARCHITECTURE.md, section 5."

| # | System | Module |
|---|---|---|
| 1 | NPC Genesis Engine | `npcGenesis.js` |
| 2 | Hero Location Tier | `locations.js` — `LOCATION_TIERS = ['hero','regional','filler']`, validated |
| 3 | Real World Commerce Layer | `commerce.js` |
| 4 | Transportation Network | `transportation.js` |
| 5 | Information Propagation Engine | `propagation.js` |
| 6 | Persistent Asset Library | `assetLibrary.js` |
| 7 | Human cost hierarchy | Encoded as the same tiers, not a separate system |
| 8 | Free data sources | `imports/unescoImport.js` — one of six evaluated |

Plus `schema.sql` and `index.js`. The three-tier model is real enough
that `assetLibrary.js` reuses `LOCATION_TIERS` for its own
`qualityLevel` rather than defining a parallel scale — which is the
"one shared world model" principle holding under pressure.

**The core claim is the one that got built and it is the valuable
one.** "Every system feeds one shared, generated Earth model, not
separate generation pipelines" is real: seven modules, one store, one
tier vocabulary. The NPC Genesis argument — survivors, employees,
founders, influencers, Tribe members all from one creation system
rather than seven — is exactly the kind of consolidation that is cheap
to state and expensive to retrofit, and it was taken seriously.

**On the data sources: one of six is integrated.** UNESCO import is
real. Natural Earth, OpenStreetMap direct, Wikidata, USGS, NOAA, and
OpenWeather are named for evaluation and none are wired. That matches
the document's own framing ("additional real free data sources to
**evaluate**"), so this is accurate rather than behind — but per
`dev-docs/STANDING_INSTRUCTION_ONGOING_EVALUATION.md`, licence terms
and access conditions for all six should be re-checked before use
rather than trusted from research done at design time. Dataset terms
change quietly.

**The 90%/10% automation target is an aspiration with no measurement
behind it.** Nothing counts what fraction of generated locations
needed human refinement, so the target cannot currently be tested. It
would become measurable the moment tier assignment is tracked against
actual artist hours — worth knowing, since ~1,200 UNESCO locations at
"real paid human work" is the one line item here with a genuine
budget attached.

**`world-layer/` is a shared data module, not an app.** It has no HTTP
layer and does not deploy as a service — the skip is documented in
`start-ecosystem.sh`'s own header. Ten apps reference it in comments;
**none import it across a directory boundary**, which is what keeps
the per-app Docker build context valid. See
`dev-docs/DEPLOYMENT_FILE_PLACEMENT.md`.

**Genuinely unbuilt**: the consumers. VACON-C is paused, so the
world model is generated and read by nothing yet. That is the honest
ceiling — this is real infrastructure waiting on the game that uses it.
