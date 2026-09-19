# Bringing the world-build cost down — what data can pay for

**The question**: the hero-tier figure on file is **$420,000–$960,000**
for full global Tier 1 coverage. How far can free, structured data push
that down, and what specifically has to be built to collect the saving?

**The short answer**: the largest single lever is not a discount, it is
a **reclassification** — every location a free dataset can describe
completely is a location that moves out of the tier that costs money.
Twenty-four sources are registered in `sources.js`, **twenty-two have
importers**, and the two that do not are the two recommended against on
licence grounds. This document is the reasoning; the numbers come from a
command.

**And the honest counterweight, first, because every figure below is
downstream of it**: `sources.realisedCoverage()` reports **zero**. Not
one record has passed through any of the twenty-two transforms, because
every source host returns 403 CONNECT at this environment's proxy (§7).
Coverage figures in this document measure whether a transform EXISTS.
They are a statement about readiness, not about data.

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
percentage.** Measured today, all three tiers are at **100%**.

*(Progression: 100/43/25 with five sources → 100/57/75 with Overture
Divisions, Overture Buildings and NOAA → 100/71/75 with Census and BLS
→ 100/86/80 with GNIS and HIFLD → **100/100/100** with the final ten.
Run `costModel.automationCoverage()` rather than trusting this table.)*

### Three measurements, and each one replaced the last when it saturated

This is worth recording as a pattern rather than a footnote, because it
happened twice in two days and the second time was self-inflicted.

**Slice coverage** counted a slice automated if any wired source filled
it. It reached 100/86/80 and then **could not move**: ten of the twelve
then-unwired sources filled only slices already marked covered, and the
two that would have moved it filled `transportationData`, which VACON-C
defers by policy. The one road upward was closed on purpose, so the
number read as very nearly finished while eight free sources sat
unwired against real engine gaps. CLAUDE.md's twentieth rule — a
measurement that cannot move is indistinguishable from one nobody is
improving.

**Field depth** (`sources.fieldDepth()`) replaced it: a slice is not one
fact, so each is broken into the fields the engine actually consumes,
each naming its consumer. It opened the number back up at 78% — 21 of
27 — and named five closable gaps: elevation, hazard risk, religion,
health prevalence and crime calibration.

**Then the ten importers landed and field depth hit 100% too**, in a
single pass, which is the same saturation one level up. It measures
whether a transform exists. It cannot fall unless somebody deletes code,
and it says nothing about whether a record ever arrived.

**`sources.realisedCoverage(worldLayer)` is the third**, and it is the
one that cannot be raised by writing more code: how much of a real world
layer actually carries imported data. It is **zero**, and it stays zero
until a network that can reach these hosts runs the `fetch*` half.

The lesson generalises past this repository: *a coverage number that
your own next commit can move is measuring you, not the world.*

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

**GNIS** — every named place and physical feature in the United States,
about 2.3 million of them, as a flat file with no API key and no rate
limit. **Two Key categories have no other source in the registry at
all**: UNESCO does not list a local cave and the National Register does
not list a bluff, so `cave-system` and `natural-formation` could be
generated and never named. It is the cheapest fix available for the
anonymous-landmark problem.

**HIFLD Open** — publishes the engine's own ten infrastructure types as
open national layers, eight of which are mapped. A hospital arrives with
its real bed count, a plant with its megawatts, a treatment works with
its throughput — which is precisely the number `landmarks.staffingFor`
and `control.maintenanceFor` currently size a crew from a band.

### The final ten, wired in one pass

Each was an importer against a known free source with a known record
shape. Against a five-figure art budget, a day of work per source is the
best-value engineering available in this project — and these ten are
done.

| Source | Closes | Why it matters |
|---|---|---|
| Natural Earth | `geographyData.boundaries` | Public domain outright, the only boundary source with no conditions at all |
| USGS 3DEP | `geographyData.elevation` | Writes `locations.terrainType` — a field accepted since the world layer was built and passed `null` by every caller |
| FEMA National Risk Index | `geographyData.hazardRisk` | So a river town floods and a plains town does not. Maps only the four hazards `environment.SEVERE` runs; names the other nine |
| NCES (CCD, IPEDS) | school enrolment and staff | A real pupil-to-teacher ratio for `statecraft.runSchooling`, and which rungs of the ladder a school serves |
| CMS Provider of Services | hospital bed counts | A *refresh* source: decides against HIFLD by collection date, so neither is declared the winner |
| FBI CDE (UCR/NIBRS) | `populationData.crimeCalibration` | The outside reference CLAUDE.md's seventeenth rule lacked through four wrong thresholds — see below |
| CDC PLACES | tract health prevalence | A baseline for `mortality.diseasePressure`, centred so an ordinary place reads exactly 1 |
| U.S. Religion Census | `npcs.religion` | The only source for a real column no generated world has ever written. The one licence-encumbered entry |
| OpenWeather | climate outside NOAA's coverage | The only per-call-cost source. Refuses to overwrite a free NOAA classification |
| Overture Transportation | `transportationData.roads` | Fills the world-layer slice. **VACON-C defers Transportation by policy and nothing consumes it** — stated on every row |

**Three real bugs were caught by these tests before anything shipped**,
and two were the same one: `per1kFrom100k(null)` returned a crime rate
of **0** rather than null, and a suppressed CDC measure read as a
neighbourhood with none of that condition — `Number(null)` is 0 and 0 is
finite, the corollary CLAUDE.md already records, in a function about to
calibrate a constant. The third: OpenWeather's guard against overwriting
free NOAA data read `geographyData.source`, a field NOAA never writes,
so the guard could never fire.

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

**Realised saving today: nothing**, and the reason is §7 rather than
the importers. What exists is twenty-two tested transforms and a
`fetch*` that throws naming the block. A saving is realised when records
reach an importer, not when one compiles.

**Projected, with the only rate on file**: Overture's own document
claims 10–15% off the content-population portion — North America
$280K–$350K → $240K–$315K, full world $2.58M–$6.48M → $2.3M–$5.8M.
That is roughly **$35K–$40K on North America and $280K–$680K globally**,
and it is one source of twenty-two. **That percentage is deliberately
not extended to the other twenty-one.** Nothing in this repository
establishes a labour cost per slice, so multiplying 100% coverage into
"100% cheaper" would put an invented number where a measured one
belongs — the same mistake `estimateBuildCost` refuses to make when it
declines to treat an unsupplied rate as a rate of zero. **The coverage
figure reaching 100% changes the readiness, not the bill.**


**Do not expect the $420K–$960K figure to fall to zero, and do not
believe a percentage that arrives without a measurement behind it.**
What is now true and was not before:

1. The figure is understood as a **per-unit rate**, so a first release
   is scoped at $9,000–$40,000 rather than the lifetime total.
2. **Twenty-four sources are registered** with licence, access path, the
   slice each fills and the tier each serves — so nothing is
   named-but-unusable, which was the state of ten of them. (This bullet
   read "sixteen" after the registry grew and the sentence did not; the
   count comes from `sources.SOURCE_NAMES.length`, so run it rather than
   trusting a number typed into prose.)
3. **Twenty-two have importers**, out of twenty-four. Ten of the
   twenty-four are named in no surviving document and were added by
   research against gaps the ENGINE has — Census, BLS, GNIS, HIFLD,
   NCES, CMS, FBI, CDC, FEMA and the Religion Census. Seventeen were
   wired in the passes after this document was first written, taking
   every tier to 100%. That is what "importers, not a negotiation"
   looks like when somebody actually does them.
4. **Coverage is measured by three commands, not one**, closing the
   architecture document's own admission that the 90%/10% automation
   target "is an aspiration with no measurement behind it" — and then
   closing the two ways that measurement went on to flatter itself.
   `automationCoverage()` for the tiers, `fieldDepth()` for what is in
   them, `realisedCoverage(worldLayer)` for what has actually arrived.
   The third is zero and is the one to quote.
5. **Licence exposure is counted** — four sources carry conditions that
   reach the shipped product (Cesium and OSM are ODbL share-alike,
   OpenWeather is commercial, and the U.S. Religion Census is an
   academic archive with its own terms rather than public domain), and
   all twenty-four licences are flagged unverified until somebody
   re-checks them, per the standing instruction that dataset terms
   change quietly.

**The next real saving is no longer an importer.** Twenty-two of
twenty-four are built, and the two that are not are the two to SKIP:
Cesium OSM Buildings and OpenStreetMap carry ODbL share-alike for ground
Overture already covers permissively. Knowing which sources not to wire
is part of the saving, and it is now the whole of what is left to
decide.

What remains is not engineering at all. It is **a network that can
reach these hosts**, and then the licence re-check that
`licenceCheckedAt: null` has been asking for on all twenty-four entries
since the registry was written. Both are somebody's decision rather than
somebody's commit.

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
