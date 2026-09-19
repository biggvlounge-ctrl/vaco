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

**On the data sources: one of six was integrated, and that is now
sixteen registered and ten wired — 18-19 Sep 2026.** `sources.js` holds
every dataset this project has identified, each with its licence, its
access path, the slice of the world model it fills and the tier it
serves. Importers exist for UNESCO, the National Register of Historic
Places, Overture Places, Overture Divisions, Overture Buildings,
Wikidata, Wikimedia Commons, NOAA climate normals, Census ACS and BLS.

NOAA is worth singling out because it closes a column the game engine
names as unmodellable. `vacon-c/server/barter.js` lists three §27 price
modifiers it cannot model and puts `regions.climate_key` first — "TEXT
written by nothing" — and `migration.generateRegion` accepts a
`climateKey`, has never been passed one, and says inventing a climate
vocabulary "would be the mistake the weather table is still open for".
It was right to refuse: the vocabulary used is Köppen-Geiger, the
published standard, and the tests check the classifier against the
literature's own answers rather than against itself.

Two of the sixteen are not named in any surviving document here. Census
ACS and BLS were added from this project's OWN lost document titles —
`REBUILD_OCCUPATION_REQUIREMENTS_BLS_SOURCED.md` was the BLS
methodology document, recorded as written and gone. Wikimedia Commons
was added under `dev-docs/STANDING_INSTRUCTION_ONGOING_EVALUATION.md`,
flagged in `sources.js` rather than slipped in, because it is the image
store Wikidata already points into and reference art is part of what
the hero rate pays for.

**The licence point that paragraph made still stands and is now
counted.** Every entry carries `licenceCheckedAt: null` until somebody
actually looks, `describeSources` reports how many that is (sixteen of
sixteen), and it separately names the three whose conditions reach the
shipped product rather than the build: Cesium OSM Buildings and
OpenStreetMap are ODbL share-alike, and OpenWeather is commercial.

**The 90%/10% automation target was an aspiration with no measurement
behind it. It has one now, from the data side.**
`costModel.automationCoverage()` reports, per tier, which slices of the
world model have a working importer behind them and which specific
sources would close the rest. Measured today: **hero 100%** (2 of 2
slices — UNESCO, NRHP, Wikidata and Commons all aim at exactly this
tier), **regional 71%**, **filler 75%**. The first measurement was
100/43/25 with five sources wired; five more moved it, which is the
report doing its job.

That is not the same measurement as artist hours, and it is not
presented as one. It reports SHARES and deliberately never money:
turning "6 of 7 slices automated" into a percentage off would invent
the one figure nobody has measured, the labour cost per slice. A test
asserts the function quotes no currency, on the same principle
`estimateBuildCost` already holds — a rate nobody supplied is not a
rate of zero.

The reasoning, the per-source payoff and what free data can never buy
are in `COST_REDUCTION_THROUGH_DATA.md`. Its headline: the largest
lever is not a discount but a **reclassification** — a location a free
dataset can describe completely is a location that moves out of the
tier that costs money — and the next real saving is eleven importers,
not a negotiation.

**`world-layer/` is a shared data module, not an app.** It has no HTTP
layer and does not deploy as a service — the skip is documented in
`start-ecosystem.sh`'s own header. Ten apps reference it in comments;
**none import it across a directory boundary**, which is what keeps
the per-app Docker build context valid. See
`dev-docs/DEPLOYMENT_FILE_PLACEMENT.md`.

**Genuinely unbuilt**: the consumers. VACON-C is paused, so the
world model is generated and read by nothing yet. That is the honest
ceiling — this is real infrastructure waiting on the game that uses it.

---

## The consumer arrived — 18 Sep 2026

**That paragraph above went stale in the one direction nothing prompts
you to re-check.** VACON-C is not paused; it is the most built thing in
this repo. And while it was being built it wrote its own
`server/landmarks.js` — thirty-three Key categories, its own
significance model, its own per-city placement, every landmark
anonymous — **without anybody finding `locations.js`**, which already
had `landmarkData`, the tier model and an import path for real named
sites. Two disagreeing answers to the same question, for months, with
neither side's documentation listing the integration as outstanding.

`exportRegion.js` is the join, and it is deliberately a FILE rather
than an import: `dev-docs/DEPLOYMENT_FILE_PLACEMENT.md` records that
ten apps reference this directory in comments and none require it
across the boundary, which is what keeps each app's Docker build
context valid. So this produces a pack — plain JSON — and
`vacon-c/server/landmarkPacks.js` validates and reads it. Neither app
requires the other, and `vacon-c/test/landmark-packs.test.js` asserts
the two copies of the Key category list are identical so the
duplication cannot become drift.

Measured on the first world built this way: **38 landmarks across six
named St. Louis areas, every one named**, with the Gateway Arch in
Downtown and the Cathedral Basilica in the Central West End because
that is where they are. Before it: 11 landmarks, all anonymous, 11 of
33 categories, and two neighbourhoods out of five with nothing in them.

The data sources are still unreachable and that is still reported
rather than worked around — `query.wikidata.org`, `whc.unesco.org` and
`services1.arcgis.com` (the NRHP feature service) each return 403
CONNECT at the agent proxy, re-checked directly rather than trusted
from `imports/unescoImport.js`'s older note. So
`vacon-c/data/st-louis.landmarks.json` declares `source: "sample"`,
which is the honest label rather than a placeholder: a hand-made pack
claiming to be an NRHP import is exactly what
AUTOMATED_HISTORIC_LANDMARK_IMPORT_SYSTEM.md was written to stop. A
reachable network makes it one fetch and no code change.
