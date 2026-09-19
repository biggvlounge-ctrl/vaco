# Bringing the world-build cost down — what data can pay for

**The question**: the hero-tier figure on file is **$420,000–$960,000**
for full global Tier 1 coverage. How far can free, structured data push
that down, and what specifically has to be built to collect the saving?

**The short answer**: the largest single lever is not a discount, it is
a **reclassification** — every location a free dataset can describe
completely is a location that moves out of the tier that costs money.
Sixteen sources are now registered in `sources.js`, ten have importers,
and `costModel.automationCoverage()` reports what that covers. This
document is the reasoning; the numbers come from a command.

---

## 1. Read the figure correctly first, because it is usually not

`$420,000–$960,000` is a **per-unit rate wearing a total's clothes**:

```
$420,000 - $960,000   hero-tier total on file
     ~1,200           UNESCO sites = Tier 1's entire scope, per §7
--------------------------------------------------------
   $350 - $800        per hero location
```

It covers **full global Tier 1 coverage over the life of the project**.
A first release built around one deep city plus recognisable icons is on
the order of 25–50 hero locations — **$9,000–$40,000** — with the rest
of that world coming from Tiers 2 and 3, which nobody is paid per
location for.

Quoting the lifetime figure as a launch cost overstates a first release
by more than an order of magnitude. `costModel.HERO_RATE_ON_FILE` holds
the rate as data with its derivation attached, and a test multiplies it
back up to catch the two drifting apart. **Before optimising the number,
make sure it is the number you mean.**

---

## 2. The real lever: move locations out of the paid tier

§7's hierarchy is the cost model:

| Tier | What it is | What it costs |
|---|---|---|
| 1 — hero | global icons, ~1,200 UNESCO locations | real, paid human work |
| 2 — regional | major cities, universities, stadiums, historic districts | AI-assisted refinement only |
| 3 — filler | houses, stores, offices, roads, generic buildings | fully automated |

A location's tier is a judgement about **how much human attention it
needs**, and that judgement depends on how much is already known about
it. A building with a footprint, a height, a category, a heritage
grading, a real name and a reference photograph needs a fraction of the
research a bare coordinate does.

So every wired dataset does two things, and the second is worth more:

1. it fills a data slice (the direct saving), and
2. it lets a location be honestly classified down a tier (the large one).

**This is why the coverage report is per tier rather than a single
percentage.** Measured today:

| Tier | Slices its sources speak to | Automated | Share |
|---|---|---|---|
| hero | landmark, population | 2 | **100%** |
| regional | landmark, business, geography, transportation, building, population, economic | 5 | **71%** |
| filler | geography, building, transportation, business | 3 | **75%** |

*(Ten of sixteen sources wired. The first pass measured 100/43/25 with
five; Overture Divisions, Overture Buildings and NOAA took it to
100/57/75, and Census ACS and BLS took regional to 71%. Run
`costModel.automationCoverage()` rather than trusting this table — it is
generated from the registry and this is a snapshot.)*

Hero being fully covered is the finding rather than a coincidence:
UNESCO, NRHP, Wikidata and Commons all aim at exactly that tier, and
between them they give a hero location its name, its grading, its
coordinates and a freely licensed photograph of it before an artist
starts.

---

## 3. What each source is actually worth, in the order it pays

### Already wired

**National Register of Historic Places** — the biggest single win, and
it is not close. UNESCO gives ~1,200 sites for the planet; NRHP gives
~100,000 for one country at the grain a city is made of. It is a U.S.
Government Work: public domain, no conditions. It carries a **published
significance grading** (National Historic Landmark / national / state /
local), which means hero-versus-regional classification comes from the
people who assess historic buildings rather than from a guess — and that
classification is the tier decision that costs or saves the money.

**Overture Maps Places** — every one of
`COMPREHENSIVE_RETAIL_KEY_LOCATIONS.md`'s ten store types is an Overture
category. Real businesses, real names, real addresses, CDLA-Permissive.
Its own cost document credits it with 10–15% off content population;
that claim is now checkable rather than asserted, because there is an
importer behind it.

**Wikidata + Wikimedia Commons** — names, coordinates, inception dates,
heritage status, and **a reference photograph**. Reference gathering is
part of what the hero rate buys, and this does it for free. Wikidata is
CC0 — the cleanest licence of any source here. Commons is licensed
**per file**, which the importer carries per image rather than assuming.

**UNESCO** — the top of the significance hierarchy and Tier 1's defined
scope. Already wired before this pass.

**Overture Divisions** — real administrative boundaries, which is where
neighbourhood NAMES come from. `vacon-c/server/landmarkPacks.js` matches
an imported landmark to an area by name, so without this the only source
of those names was somebody typing them.

**Overture Buildings** — footprint area, height and class for global
building stock. This is what `worldgen` currently draws from
`random.range(600, 12000)`, and filler is the overwhelming bulk of a
city by count — §7 prices it as "fully automated", so describing it
completely is what keeps it there.

**NOAA climate normals** — closes a column the engine itself names as
unmodellable. `barter.js` lists three §27 price modifiers it cannot
model and puts `regions.climate_key` first; `migration.generateRegion`
accepts a `climateKey`, has never been passed one, and says inventing a
climate vocabulary "would be the mistake the weather table is still open
for". It was right, and the vocabulary is not invented here either: it
is **Köppen-Geiger**, the published standard, validated in the tests
against the literature's own answers for St. Louis (Cfa), Phoenix (BWh)
and Singapore (Af).

**Census ACS** — real age, household, attainment and income
distributions per census TRACT, which is roughly a neighbourhood and
therefore the one source whose grain matches what the engine calls a
community. It produces distributions only and never a person: §9 permits
demographic modelling and forbids demographics determining morality,
criminality, intelligence or worth, and importing real numbers makes
that firewall more important rather than less.

**BLS (OES)** — the dataset the lost
`REBUILD_OCCUPATION_REQUIREMENTS_BLS_SOURCED.md` was about. Real
employment counts and wages per occupation per metro, replacing
`drawOccupation`'s `1/tier` pyramid and `economy.js`'s wage bands. The
methodology document cannot be recovered; the data it reasoned about is
free and still published.

### Identified, not yet wired — the cheapest work left

Each of these is an importer against a known free source with a known
record shape. Against a five-figure art budget, a day of work per source
is the best-value engineering available in this project.

| Source | Closes | Why it matters |
|---|---|---|
| Natural Earth | regional `geographyData` | Public domain, no conditions, the top of the boundary hierarchy |
| USGS 3DEP | `geographyData` | Real elevation for the U.S. prototype region |

### Use last, or not at all

**Cesium OSM Buildings** and **OpenStreetMap direct** are ODbL —
share-alike and attribution obligations that bind the *shipped product*,
not the build. Overture is built largely from OSM, ships as GeoParquet
rather than needing a query per area, and carries a permissive licence
instead. **Prefer Overture; keep OSM for the tags Overture drops.**

**OpenWeather** is the only entry with a per-call cost. NOAA covers the
U.S. prototype region for free.

---

## 4. The second lever, already built and already measurable

`costModel.getReuseReport()` counts **creations avoided** through the
Persistent Asset Library: one generated gas station appearing in
thousands of towns. It separates real reuse from unused inventory, so
the saving cannot be inflated by assets nobody placed.

Data reduces what must be *researched*; reuse reduces what must be
*made*. They are independent and they multiply: an imported filler
building that resolves to an existing asset variant costs neither
research nor modelling.

---

## 5. What free data can never pay for

Stated plainly, because a cost model that implies everything is
automatable is worse than one that admits a floor:

- **`ownershipData`** — who owns what is simulation state. No dataset
  knows it for a fictional collapse.
- **`eventHistoryData`** — what has happened at a place is produced by
  the running world.
- **Artistic judgement at Tier 1.** A photograph is reference, not a
  model. §7's "real, paid human work" is real.
- **The prototype's own fiction.** A collapsed St. Louis is not a
  dataset of St. Louis.

---

## 6. The honest bottom line

**Do not expect the $420K–$960K figure to fall to zero, and do not
believe a percentage that arrives without a measurement behind it.**
What is now true and was not before:

1. The figure is understood as a **per-unit rate**, so a first release
   is scoped at $9,000–$40,000 rather than the lifetime total.
2. **Sixteen sources are registered** with licence, access path, the
   slice each fills and the tier each serves — so nothing is
   named-but-unusable, which was the state of ten of them.
3. **Ten have importers.** The other six are a known, small amount of
   work with a named payoff each — and five were wired in the passes
   after this document was first written, taking regional from 43% to
   71% and filler from 25% to 75%. That is what "importers, not a
   negotiation" looks like when somebody actually does them.
4. **Coverage is measured per tier by a command**, closing the
   architecture document's own admission that the 90%/10% automation
   target "is an aspiration with no measurement behind it".
5. **Licence exposure is counted** — three sources carry conditions that
   reach the shipped product, and all sixteen licences are flagged
   unverified until somebody re-checks them, per the standing
   instruction that dataset terms change quietly.

The next real saving is not a negotiation. It is the remaining six importers — and two of those (Cesium OSM Buildings, OpenStreetMap) are ones to skip rather than build, since Overture covers the same ground without ODbL's share-alike.

---

## 7. Everything here is blocked from this environment, and that is reported

`query.wikidata.org`, `whc.unesco.org`, `services1.arcgis.com`,
`overturemaps.org`, `naturalearthdata.com`, `openstreetmap.org`,
`commons.wikimedia.org`, `api.weather.gov`, `usgs.gov` and
`overpass-api.de` all return **403 CONNECT** at this environment's agent
proxy — checked directly on 18 Sep 2026, not inferred from an older
note. Per `/root/.ccr/README.md` that is report-do-not-work-around.

Every importer is therefore the shape `imports/unescoImport.js`
established: a **real, tested transform** from the source's record shape,
plus a `fetch*` that throws naming the block, the genuine access path,
and the import function to call once records are in hand. On a network
that can reach these hosts, each is one function away and **no transform
changes**.
