# Getting the most accurate land and map data

**What this answers.** How a developer gets real, accurate land and map
data into this world, and how each dataset lands on a schema column
that already exists.

**Two things stated first, because they change how to read everything
below.**

**I cannot reach any of these datasets from this environment**, and
`world-layer/README.md:150` already records the same limit for the
importer that lives there ("stub — this environment cannot reach that
network"). Nothing here has been fetched, downloaded or validated. It
is a map of where to go, assembled from the sources this repo already
names plus the standard public ones — **every licence, price, URL and
API shape has to be verified against the provider before you build on
it**, because all four change.

**This extends the existing stack rather than replacing it.**
`world-layer/` already documents a real data stack — Cesium World
Terrain, Cesium OSM Buildings, UNESCO World Heritage, the National
Register of Historic Places, and the Overture Maps Foundation
(CDLA-Permissive-2.0, six themes, `overturemaps download`, monthly
GeoParquet). See `world-layer/OVERTURE_MAPS_DATASET_UPDATED_COST_SAVINGS.md`,
`world-layer/AUTOMATED_HISTORIC_LANDMARK_IMPORT_SYSTEM.md` and
`world-layer/UNIVERSAL_WORLD_LAYER_ARCHITECTURE.md`. **What follows is
the four things that stack does not cover**, plus the part nobody
usually writes down: how the data attaches to VACON-C's tables.

---

## 1. Where the geography actually lands — the schema hooks

This is the short section that makes the rest usable, and it is worth
reading before any dataset. **The engine already has the columns. They
are almost all empty.**

| Column | Type | Written by | Read by |
|---|---|---|---|
| `cities.real_world_geo_ref` | TEXT | `territory.generateCity` from an option | nothing yet; `statistics.environmentFor` reports it |
| `regions.geography_key` | TEXT | **nothing** | nothing |
| `regions.climate_key` | TEXT | **nothing** | nothing |
| `properties.community_id` | BIGINT FK | `property.generateProperty` | `statistics.propertiesIn` — every housing statistic |
| `properties.city_id` | BIGINT FK | `property.generateProperty` | — |
| `communities.city_id` | BIGINT FK | `territory.generateCommunity` | `statistics.contextFor` |
| `territory_blocks.community_id` | BIGINT FK | `territory.generateTerritoryBlock` | territory control |

Three of those are free-text keys with no format, no parser and no
reader. **That is the single most important thing to fix before
importing anything**, because a geo reference nothing can parse is a
string, not a location — the same "set by something, read by nothing"
shape this repo keeps finding. Decide the format first and write the
resolver, then import.

### The tier mapping, which is the whole trick

VACON-C's spatial tiers line up with the US Census hierarchy almost
exactly, and that correspondence is what makes "duplicate this
anywhere" tractable at all — **every area in the country has the same
tier structure, so the same importer runs everywhere and the same
statistics come out comparable.**

| VACON-C tier | US Census unit | Typical size |
|---|---|---|
| `regions` | State, or county | — |
| `cities` | Census **Place** (incorporated place / CDP) | a municipality |
| `communities` | **Block group** or **tract** | ~600–3,000 people |
| `territory_blocks` | **Census block** | a city block |
| `properties` | Parcel / building footprint | one lot |

Use the Census GEOID as the geo reference and the whole problem of
"which area is this" disappears: a 15-digit block GEOID contains its
block group, tract, county and state, so a property knows its
community, its city and its region by string prefix. Store it, index
it, and let `real_world_geo_ref` / `geography_key` hold it.

Outside the US the equivalents are in §5 below. The tier shapes hold;
only the identifier changes.

---

## 2. The four gaps in the existing stack

### Gap 1 — Land and parcels

Overture gives addresses, buildings and administrative divisions. **It
does not give parcel boundaries** — the legal lot lines that
`properties.land_size` actually describes. In the US there is no free
national parcel dataset, because parcels are maintained county by
county.

- **County assessor open data** is the authoritative and free source.
  For the prototype's own scope, the City of St. Louis and St. Louis
  County both run open-data portals carrying parcel geometry with
  assessed value, land use code, year built, lot size and improvement
  value. That set maps onto `properties` almost column for column:
  `land_size`, `type`, `value`, `age`, `construction_date`.
- **Commercial national parcel aggregators** exist (Regrid is the
  usual one) and sell a normalised nationwide layer. Licensed per
  county or per seat; check the terms against a game that ships derived
  data.
- **Building footprints** where parcels are unavailable: Overture
  Buildings, or Microsoft's US Building Footprints. A footprint is not
  a parcel — it is the structure, not the lot — and conflating them
  makes every `land_size` wrong in the same direction.

### Gap 2 — Block-level statistics

**This is the gap that matters most to this engine**, because
`server/statistics.js` declares sixteen statistics unavailable and a
real import fills several of them outright. See §3 for the mapping.

- **TIGER/Line shapefiles** (US Census Bureau) — the geometry for
  states, counties, places, tracts, block groups and blocks. Public
  domain. This is what `communities` and `territory_blocks` get their
  shapes and GEOIDs from.
- **American Community Survey 5-year estimates** — poverty rate,
  employment, median household income, educational attainment, housing
  tenure and vacancy, at block-group resolution. Public domain, served
  by the Census API. 5-year rather than 1-year because only the 5-year
  release goes down to block groups.
- **Decennial Census** — actual population counts at block level, where
  ACS only estimates.

A caution that is easy to skip and expensive to skip: **ACS figures are
estimates with margins of error**, and at block-group resolution the
margins are often large relative to the estimate. If a poverty rate is
0.21 ± 0.09, storing 0.21 as a fact and then z-scoring it against other
blocks produces a ranking that is mostly noise. Carry the margin, or
carry the coarser tract-level figure and say so.

### Gap 3 — Terrain, water and land cover

Cesium World Terrain is global and roughly 30 m. For anything
neighbourhood-scale that is a hillshade, not a terrain.

- **USGS 3DEP** — 1 m lidar-derived elevation where it has been flown,
  10 m nationally. Public domain. This is the real answer for slope,
  drainage and buildable land.
- **National Hydrography Dataset (NHD)** — rivers, streams, lakes,
  and the watershed boundaries they sit in. Public domain. §9's
  ENVIRONMENT block asks for "woods, rivers, lakes, flood zones" and
  this is three of the four.
- **NLCD (National Land Cover Database)** — the fourth: woodland,
  developed, cultivated, wetland, at 30 m.
- **FEMA National Flood Hazard Layer** — the flood zones specifically.
- **NOAA/NCEI climate normals** — what `regions.climate_key` would
  hold if anything wrote it.

### Gap 4 — Crime data

`server/crime.js` records eight typed categories. Real crime data is
available and **does not map onto them cleanly**, which is a genuine
modelling problem rather than a formatting one.

- **FBI Crime Data Explorer / NIBRS** — national, incident-level, with
  offence codes, at agency resolution rather than block.
- **Local police open data** — many departments, St. Louis
  Metropolitan Police among them, publish incident files with a date
  and a block-level address. That is the resolution `crime_incidents`
  wants.

**The mapping problem, stated:** NIBRS uses dozens of offence codes
across Group A and Group B; `crime.CRIME_CATEGORIES` has eight. A
crosswalk is a set of judgement calls — is a burglary `property` or
`theft`, is an aggravated assault with a firearm `violent` or `gun` or
both — and whichever calls you make have to be written down beside the
importer, because two areas crosswalked differently are not
comparable, and that is the entire point of the catalogue. Also note
that reported crime is not crime: clearance and reporting rates vary
by area and by offence, which makes a crime rate partly a measure of
policing. That is worth modelling explicitly rather than importing as
if it were ground truth.

---

## 3. Each declared gap, and the dataset that closes it

`server/statistics.js` says in code what it cannot compute and why.
This table says where the missing substrate would come from. The
reasons are quoted from `statistics.unavailable()` — run it rather
than trusting this table to stay current.

| Statistic | Declared reason | Real-world source |
|---|---|---|
| `demographic_composition` | no demographic fields on an NPC | ACS tables B02001 / B03002 (composition only — §9 forbids demographics predicting behaviour, and an import must not become the back door to that) |
| `school_dropout_rate` | no students, no enrolment | NCES Common Core of Data for schools and enrolment; EDFacts for graduation and dropout |
| `school_capacity_per_1k`, `hospital_capacity_per_1k`, `infrastructure_condition` | `infrastructure` is a schema-only table | NCES (schools), HIFLD / CMS (hospitals), ASCE and state DOT condition reporting |
| `pollution` | no pollution column anywhere | EPA AirNow, EPA EJScreen |
| `terrain_and_water` | `regions.geography_key`/`climate_key` written by nothing | USGS 3DEP, NHD, NLCD, FEMA NFHL |
| `migration_rate` | `migration_events` schema-only, nobody moves | ACS migration flows; IRS county-to-county migration |
| `birth_rate`, `teenage_pregnancy_rate` | no birth driver | CDC WONDER natality; CDC PLACES for area health |
| `camera_coverage`, `street_lighting`, `private_security_presence` | nothing in the schema | mostly municipal open data where it exists at all; expect this to stay unavailable |
| `patrol_frequency` | no patrols; the policing half of the Security phase does nothing | not an import problem — this is the "heat" model `vacon-c/GAME_LANGUAGE_AND_REFERENCES.md` names, and it has to be built |
| `informal_economy_share` | nothing is off the books | no dataset measures this directly; leave unavailable |
| `police_trust` | no institution to trust | survey data (Gallup, local surveys) is national or city-level at best |

**Read the last three rows as the useful ones.** They are the cases
where no import helps: `patrol_frequency` needs engine work, and
`informal_economy_share` and `police_trust` have no honest source at
area resolution. A document that listed a dataset for all sixteen
would be padding.

---

## 4. Licensing — the traps, in the order they bite

**This is the section to read before the technical ones.** Getting it
wrong is not a bug you fix later.

- **US federal government works are public domain.** Census/TIGER,
  ACS, USGS, NOAA, FEMA, EPA, FBI, NCES, CDC. This is the safest
  possible footing and it covers most of §2 and §3. Prefer it.
- **OpenStreetMap is ODbL, and ODbL has share-alike on derived
  DATABASES.** If you import OSM into a world database and distribute
  that database, ODbL may require you to offer the derived database
  under the same terms. For a commercial game that is a real decision,
  not a formality. Note that "produced work" (a rendered map, a
  screenshot) is treated differently from the database itself — get
  advice rather than reasoning it out from the licence text.
- **Overture is not uniformly CDLA-Permissive.** The foundation's
  headline licence is CDLA-Permissive-2.0, and some themes incorporate
  OSM-derived data that carries ODbL attribution and share-alike
  obligations. **Check the licence per theme, per release**, rather
  than treating "Overture is permissive" as settled. The repo's own
  Overture document records the CDLA-Permissive-v2 headline; it does
  not record a per-theme audit, and one is needed before shipping.
- **Google Maps and Mapbox terms restrict creating derived datasets
  and caching.** Their geocoders in particular typically forbid storing
  the results. Do not geocode a world's addresses through a service
  whose terms say you may not keep the answers — use Census Geocoder
  (public domain) or a self-hosted geocoder over open data.
- **Cesium ion** has its own terms and quotas for hosted terrain and
  the OSM Buildings tileset. Already in this stack; check the tier.
- **Commercial parcel aggregators** license per county or per seat and
  generally restrict redistribution of the geometry.

A practical rule that avoids most of this: **keep public-domain and
permissively-licensed data in one pipeline and share-alike data in
another, and know which one every column came from.** Which is the next
section.

---

## 5. Provenance, and why it is not optional here

**This is the part that connects directly to the statistics
catalogue.** `server/statistics.js` exists so that any two areas can be
compared. Two areas imported from different vintages, at different
resolutions, or crosswalked by different rules **are not comparable**,
and nothing downstream can detect that — the numbers will line up
perfectly and mean different things.

So every import writes, per record:

- **source** — the dataset and the specific product (`ACS 5-year`, not
  `Census`)
- **vintage** — the release year and the period it covers
- **resolution** — block, block group, tract, county
- **licence** — so a later distribution decision can be made without
  re-deriving it
- **retrieved** — the date, because these products are revised
- **crosswalk** — for anything mapped onto engine categories (crime
  especially), the version of the mapping used

`statistics.compare` already refuses to rank a statistic with no
variance and reports `n` per statistic. Provenance is the same
discipline one level up: a comparison across areas whose data does not
share a vintage should be refused or flagged, not computed.

---

## 6. Outside the United States

"Duplicate all over the world" is the requirement, and the US stack
above does not travel. The tier structure does; the identifiers and
sources change.

| Need | Global / non-US source |
|---|---|
| Administrative boundaries | Overture **Divisions**; GADM; national mapping agencies |
| EU statistics & geography | Eurostat NUTS and LAU; GISCO; national statistics offices |
| Population, gridded | WorldPop; GHSL (Global Human Settlement Layer); Meta/CIESIN HRSL |
| Terrain | Copernicus DEM (30 m global); SRTM; ALOS AW3D30 |
| Land cover | ESA WorldCover (10 m); Copernicus |
| Roads and buildings | Overture Transportation/Buildings; OSM (mind the ODbL) |
| Addresses & places | Overture Addresses and Places |
| Crime | almost nowhere comparable — national statistics offices publish at region level at best, and definitions differ by country, which makes cross-country crime comparison the hardest item on this page |

**Expect statistical coverage to fall off sharply outside North America
and Western Europe.** That is not a reason to build a US-only
importer — it is a reason the catalogue reports `known: false` with a
reason rather than a zero, so an area in a country with no block-level
statistics is visibly thin rather than quietly wrong.

---

## 7. A workable order of operations

1. **Decide the geo-reference format and write the resolver.** Census
   GEOID is the recommendation for the US; whatever you choose,
   `real_world_geo_ref` and `geography_key` need a parser before they
   need data.
2. **Pick coordinate systems.** Store in EPSG:4326. Measure — area,
   distance, density — in a projected CRS appropriate to the region
   (UTM, or a state plane zone). Computing an area in degrees is the
   classic silent error and it is wrong by a factor that varies with
   latitude.
3. **Import boundaries first**, top down: region → city → community →
   block. Every later import attaches to one of these.
4. **Import parcels**, attaching each to its community and city — the
   two columns added to `properties` in `server/schema-extensions.sql`.
5. **Import statistics**, attaching each to its community, with
   provenance.
6. **Validate.** Reconcile population against the published total per
   tract; check for overlapping parcels and orphan geometry; check a
   fixed random sample by eye against imagery. A silent import failure
   looks exactly like a sparse neighbourhood.
7. **Only then wire the engine to read it**, and note that
   `world-layer/README.md` is explicit that nothing consumes that layer
   yet and that VACON-C reading it is a scoped, deferred integration
   decision (`dev-docs/phase-8-vacon-c-reconciliation/plan.md`), not
   something that has quietly happened.

---

## What this does not do

No code here, and no import has been run. The nearest working thing in
the repo is `world-layer/imports/unescoImport.js`, and its own README
marks it a stub for the same network reason.

And the honest scope limit: `vacon-c/CLAUDE.md` defers Transportation,
so roads, routes and movement stay out regardless of how good the
transportation data is. The Overture Transportation theme and the
whole road network are downloadable today and there is nothing in the
engine to put them into.
