// Universal World Layer — the data sources, as data.
//
// **Every free dataset this project has identified, in one place, with
// what it actually gives you and what it costs to use.**
//
// ---------------------------------------------------------------------
// Why this file exists
// ---------------------------------------------------------------------
// `UNIVERSAL_WORLD_LAYER_ARCHITECTURE.md` §8 names six sources "to
// evaluate". `AUTOMATED_HISTORIC_LANDMARK_IMPORT_SYSTEM.md` names three
// more. `OVERTURE_MAPS_DATASET_UPDATED_COST_SAVINGS.md` names a tenth
// with six themes inside it. The cost documents name Cesium's terrain
// and buildings and Google's 3D tiles.
//
// **One of them is wired.** That is not a criticism of the documents —
// they say "evaluate" and mean it — but it does mean the question "what
// can a developer building a region actually pull down for free today?"
// had no answer anywhere, and the answer is most of a world.
//
// The whole point of the project's cost model is that human work is the
// expensive part and automated coverage is the lever. A source nobody
// has written down is a source nobody uses, and every one of those is
// paid human work that did not need to be paid for. So this is a cost
// document as much as a technical one.
//
// ---------------------------------------------------------------------
// What each entry has to carry, and why
// ---------------------------------------------------------------------
//   `licence`   Named, not assumed. `dev-docs/STANDING_INSTRUCTION_
//               ONGOING_EVALUATION.md` is explicit that dataset terms
//               change quietly and must be re-checked at build time
//               rather than trusted from design-phase research. Every
//               entry carries `licenceCheckedAt: null` until somebody
//               actually looks, and `describeSources` counts the nulls.
//   `access`    How you get it. A source with no stated access path is
//               a source nobody can use in practice.
//   `fills`     Which of `locations.js`'s nine data slices it populates.
//               This is what turns the list into a coverage map: a
//               slice no source fills is a slice somebody pays a human
//               for.
//   `tiers`     Which of `LOCATION_TIERS` it serves. §7's whole cost
//               hierarchy is per tier, so a saving can only be counted
//               against the tier it lands in.
//   `wired`     Whether an importer exists in this repository. The
//               difference between a source we HAVE and a source we
//               have READ ABOUT, kept as a field so it cannot blur.
//
// ---------------------------------------------------------------------
// None of them are reachable from this environment
// ---------------------------------------------------------------------
// Checked directly rather than assumed, on 18 Sep 2026: every host
// below returns 403 CONNECT at the agent proxy — Wikidata, UNESCO, the
// NRHP feature service, Overture, Natural Earth, OpenStreetMap,
// Wikimedia Commons, api.weather.gov, USGS and Overpass. Per
// `/root/.ccr/README.md` that is report-do-not-work-around.
//
// So every importer here is the same shape `imports/unescoImport.js`
// established and explains: a real, tested transform from the source's
// record shape into the world layer, plus a `fetch*` that throws with
// the reason. On a network that can reach these, each one is a single
// function away from running, and nothing about the transform changes.

'use strict';

const { LOCATION_TIERS } = require('./locations');

// The nine slices `locations.js` defines, plus the two identity fields
// every location has. Named here so `describeSources` can report which
// of them nothing covers — a gap in this list is a line item in a
// budget.
const WORLD_SLICES = [
  'geographyData',
  'buildingData',
  'businessData',
  'landmarkData',
  'populationData',
  'transportationData',
  'economicData',
  'ownershipData',
  'eventHistoryData',
];

// Slices no free dataset covers, with the reason. **Declared rather
// than left as an absence**, because "no source fills this" and "we
// forgot to look" are different facts and only one of them is a
// budget line. CLAUDE.md's thirteenth rule, applied to a dataset list.
const UNCOVERED_BY_DESIGN = {
  ownershipData: 'Who owns what is simulation state, not world data. VACON-C generates it '
    + '(`ownership_records`); no external dataset could know it for a fictional collapse.',
  eventHistoryData: 'What has happened at a place is produced by the running world, not '
    + 'imported. A real history import would be `historical_records`, which is a different '
    + 'question from this one.',
};

// ---------------------------------------------------------------------
// SLICE_FIELDS — what is actually IN a slice, and who consumes it
// ---------------------------------------------------------------------
// **A slice marked "covered" was hiding most of its own gaps, and the
// coverage number could no longer move.**
//
// `automationCoverage` counted a slice as automated if ANY wired source
// filled it. Measured against the registry: ten of the twelve unwired
// sources fill only slices already marked covered, so wiring NCES, CMS,
// FBI, CDC, FEMA, the Religion Census, USGS or Natural Earth could not
// move the reported figure by a single point. The only two that could
// fill `transportationData`, which VACON-C defers by policy.
//
// So the number was pinned at 100/86/80 and **the one way to raise it
// was closed on purpose**. That is the twentieth standing rule wearing
// a different hat: a measurement that cannot move is indistinguishable
// from one nobody is improving, and this one was reporting the data
// work as very nearly finished while eight free sources sat unwired
// against real engine gaps.
//
// A slice is not one fact. `populationData` marked covered by Census
// alone still had religion, health prevalence and crime calibration
// unsourced inside it — three columns the ENGINE names as unfilled, in
// its own files, in as many words.
//
// **Every field below names the engine consumer that wants it**, so
// this table cannot drift into a wishlist: a field with no consumer is
// a field nobody asked for, and the test asserts each `source` key
// exists in `SOURCES`.
const SLICE_FIELDS = {
  geographyData: [
    { field: 'climate', consumer: 'regions.climate_key — barter.js names it first among the three §27 price modifiers it cannot model', source: ['noaa', 'openweather'] },
    { field: 'boundaries', consumer: 'migration.generateRegion geographyKey', source: ['naturalEarth', 'overtureDivisions'] },
    { field: 'elevation', consumer: 'geo.js terrain and distance', source: ['usgs'] },
    { field: 'hazardRisk', consumer: 'environment.js — which disasters a region can actually have', source: ['femaNri'] },
  ],
  buildingData: [
    { field: 'footprint', consumer: 'worldgen.js landSize, currently random.range(600, 12000)', source: ['overtureBuildings', 'cesiumBuildings'] },
    { field: 'height', consumer: 'property.js floors and landmarks.js skyscraper classification', source: ['overtureBuildings', 'cesiumBuildings'] },
    { field: 'buildingClass', consumer: 'property.generateProperty type', source: ['overtureBuildings'] },
    { field: 'infrastructureCapacity', consumer: 'landmarks.staffingFor and control.maintenanceFor size a crew from how big a thing is', source: ['hifld', 'cmsProviders', 'nces'] },
  ],
  businessData: [
    { field: 'name', consumer: 'properties.name — anonymous shops before this', source: ['overturePlaces'] },
    { field: 'category', consumer: "COMPREHENSIVE_RETAIL_KEY_LOCATIONS.md's ten store types", source: ['overturePlaces'] },
    { field: 'address', consumer: 'worldgen per-area shop placement', source: ['overturePlaces'] },
  ],
  landmarkData: [
    { field: 'name', consumer: 'landmarks.designate — every landmark was anonymous', source: ['unesco', 'nrhp', 'gnis', 'wikidata'] },
    { field: 'category', consumer: "landmarks.js's 34 Key categories", source: ['nrhp', 'gnis', 'overturePlaces'] },
    { field: 'significance', consumer: 'landmarks.significanceFor — the tier decision that costs or saves the money', source: ['unesco', 'nrhp'] },
    { field: 'referenceImage', consumer: 'Tier 1 reference gathering, which the hero rate pays for', source: ['wikimediaCommons'] },
    { field: 'naturalFeatures', consumer: 'the cave-system and natural-formation categories, which no other source lists', source: ['gnis'] },
  ],
  populationData: [
    { field: 'ageDistribution', consumer: 'worldgen population generation', source: ['census'] },
    { field: 'householdStructure', consumer: 'households.js', source: ['census'] },
    { field: 'attainment', consumer: 'demographics.EDUCATION_LEVELS and statecraft.runSchooling', source: ['census', 'nces'] },
    { field: 'employmentShares', consumer: "occupations.drawOccupation, currently a 1/tier pyramid this project chose", source: ['bls'] },
    { field: 'wages', consumer: 'economy.js, currently a band', source: ['bls'] },
    // The three the engine itself names as unfilled.
    { field: 'religion', consumer: 'npcs.religion — demographics.js calls it "a real TEXT column, set only where a caller supplies one"', source: ['religionCensus'] },
    { field: 'healthPrevalence', consumer: 'mortality.diseasePressure, which multiplies chosen figures', source: ['cdcPlaces'] },
    { field: 'crimeCalibration', consumer: "crime.DANGER_REFERENCE_PER_1K — CLAUDE.md's seventeenth rule cost four wrong thresholds for want of an outside reference", source: ['fbiCrime'] },
  ],
  transportationData: [
    { field: 'roads', consumer: 'infrastructure.js roads — deferred by VACON-C policy', source: ['overtureTransportation', 'openstreetmap'] },
  ],
  economicData: [
    { field: 'income', consumer: 'economy.js and property valuation', source: ['census'] },
    { field: 'labourMarket', consumer: 'blsImport.importOesMetro', source: ['bls'] },
  ],
};

const SOURCES = {
  // -------------------------------------------------------------------
  // Landmarks and heritage
  // -------------------------------------------------------------------
  unesco: {
    name: 'UNESCO World Heritage List',
    licence: 'UNESCO open data / Wikidata CC0 when queried via SPARQL',
    licenceCheckedAt: null,
    access: 'SPARQL at query.wikidata.org, or the WHC XML export',
    host: 'query.wikidata.org',
    fills: ['landmarkData'],
    tiers: ['hero'],
    scale: '~1,200 sites globally',
    wired: 'imports/unescoImport.js',
    note: 'The globally significant tier, and §7\'s entire Tier 1 scope. Inscription is '
      + 'treated as maximal historical importance by the importer, which is an interpretive '
      + 'call it states rather than hides.',
  },
  nrhp: {
    name: 'National Register of Historic Places',
    licence: 'U.S. Government Work — public domain, no restriction on non-restricted listings',
    licenceCheckedAt: null,
    access: 'NPS GIS data downloads, or the ArcGIS feature service',
    host: 'services1.arcgis.com',
    fills: ['landmarkData'],
    tiers: ['hero', 'regional'],
    scale: '~100,000 listed U.S. properties',
    wired: 'imports/nrhpImport.js',
    note: '**This is the one that answers a region rather than a planet.** UNESCO would '
      + 'never list a Masonic temple or a neighbourhood historic district, which is exactly '
      + 'what a city is made of — AUTOMATED_HISTORIC_LANDMARK_IMPORT_SYSTEM.md makes this '
      + 'point in its own words. 100,000 properties against UNESCO\'s 1,200.',
  },

  // -------------------------------------------------------------------
  // Places, buildings and boundaries
  // -------------------------------------------------------------------
  overturePlaces: {
    name: 'Overture Maps — Places theme',
    licence: 'CDLA-Permissive-2.0',
    licenceCheckedAt: null,
    access: 'overturemaps CLI, or GeoParquet from the cloud buckets',
    host: 'overturemaps.org',
    fills: ['businessData'],
    tiers: ['regional', 'filler'],
    scale: 'part of 3.7-4.2 billion features across all themes',
    wired: 'imports/overtureImport.js',
    note: '**The retail Key locations, populated from real businesses.** '
      + 'COMPREHENSIVE_RETAIL_KEY_LOCATIONS.md names ten store types and every one of them '
      + 'is an Overture Places category. This is the source its own cost document credits '
      + 'with 10-15% off content population, and it is the reason that claim is now '
      + 'checkable rather than asserted.',
  },
  overtureDivisions: {
    name: 'Overture Maps — Divisions theme',
    licence: 'CDLA-Permissive-2.0',
    licenceCheckedAt: null,
    access: 'overturemaps CLI',
    host: 'overturemaps.org',
    fills: ['geographyData'],
    tiers: ['regional', 'filler'],
    scale: 'global administrative boundaries',
    wired: 'imports/overtureImport.js',
    note: 'Real city/county/state boundaries. Directly feeds the neighbourhood NAMES a '
      + 'landmark pack needs — `vacon-c/server/landmarkPacks.js` matches a place to an area '
      + 'by name, and that name has to come from somewhere.',
  },
  overtureBuildings: {
    name: 'Overture Maps — Buildings theme',
    licence: 'CDLA-Permissive-2.0',
    licenceCheckedAt: null,
    access: 'overturemaps CLI',
    host: 'overturemaps.org',
    fills: ['buildingData'],
    tiers: ['filler'],
    scale: 'global building footprints',
    wired: 'imports/overtureImport.js',
    note: 'Footprint, height and class. What `properties.land_size`, `.floors` and `.type` '
      + 'are currently drawn at random for.',
  },
  overtureTransportation: {
    name: 'Overture Maps — Transportation theme',
    licence: 'CDLA-Permissive-2.0',
    licenceCheckedAt: null,
    access: 'overturemaps CLI',
    host: 'overturemaps.org',
    fills: ['transportationData'],
    tiers: ['regional', 'filler'],
    scale: 'global road and rail network',
    wired: 'imports/overtureTransportationImport.js',
    note: 'Roads and rail. **Deliberately not consumed by VACON-C**, which defers '
      + 'Transportation in CLAUDE.md — this is here for `transportation.js` in this layer, '
      + 'and wiring it into the game would cross a locked scope boundary.',
  },
  cesiumBuildings: {
    name: 'Cesium OSM Buildings',
    licence: 'ODbL (OpenStreetMap) via Cesium ion',
    licenceCheckedAt: null,
    access: 'Cesium ion asset, requires an ion access token',
    host: 'assets.ion.cesium.com',
    fills: ['buildingData'],
    tiers: ['filler'],
    scale: '350+ million buildings globally',
    wired: null,
    note: '**Attribution is not optional under ODbL** and that is a licence obligation on '
      + 'the shipped product, not a build-time detail. Flagged here rather than discovered '
      + 'later.',
  },
  naturalEarth: {
    name: 'Natural Earth',
    licence: 'Public domain',
    licenceCheckedAt: null,
    access: 'direct download, shapefile or GeoJSON',
    host: 'naturalearthdata.com',
    fills: ['geographyData'],
    tiers: ['regional'],
    scale: 'countries, states, regions, physical features',
    wired: 'imports/naturalEarthImport.js',
    note: 'The coarsest and simplest of the boundary sources, and the only one with no '
      + 'licence conditions at all. Worth using for the top of the hierarchy even where '
      + 'Overture Divisions covers the detail.',
  },
  openstreetmap: {
    name: 'OpenStreetMap (direct, via Overpass)',
    licence: 'ODbL — share-alike, attribution required',
    licenceCheckedAt: null,
    access: 'Overpass API, or a regional .pbf extract',
    host: 'overpass-api.de',
    fills: ['buildingData', 'transportationData', 'businessData'],
    tiers: ['regional', 'filler'],
    scale: 'global, tag-level detail',
    wired: null,
    note: '**Mostly redundant now, and that is worth saying.** Overture is built largely '
      + 'FROM OSM, ships as GeoParquet rather than needing a query per area, and carries a '
      + 'permissive licence instead of a share-alike one. Kept for the tags Overture drops '
      + '— amenity-level detail on individual buildings — rather than as a primary source.',
  },

  // -------------------------------------------------------------------
  // Names, descriptions and pictures
  // -------------------------------------------------------------------
  wikidata: {
    name: 'Wikidata',
    licence: 'CC0 — public domain dedication',
    licenceCheckedAt: null,
    access: 'SPARQL at query.wikidata.org',
    host: 'query.wikidata.org',
    fills: ['landmarkData', 'populationData'],
    tiers: ['hero', 'regional'],
    scale: '~110 million structured entities',
    wired: 'imports/wikidataImport.js',
    note: 'Names, coordinates, inception dates, heritage designations, population figures, '
      + 'and the link to a Commons image. CC0 makes it the least encumbered of all of them.',
  },
  wikimediaCommons: {
    name: 'Wikimedia Commons',
    licence: 'Per-file — CC0, CC-BY, CC-BY-SA, or public domain',
    licenceCheckedAt: null,
    access: 'Commons API, usually reached via a Wikidata P18 image claim',
    host: 'commons.wikimedia.org',
    fills: ['landmarkData'],
    tiers: ['hero', 'regional'],
    scale: '~100 million freely licensed media files',
    wired: 'imports/wikidataImport.js',
    note: '**Pictures, and the reason a reference photograph matters to the budget.** §7 '
      + 'prices hero locations as "real, paid human work" — an artist modelling the '
      + 'Cathedral Basilica needs reference, and sourcing it is part of what that money '
      + 'buys. Per-file licensing is the catch: attribution and share-alike vary by FILE, '
      + 'so the importer carries each file\'s own licence rather than the collection\'s.\n'
      + '**Not named in any document on file** — added on the ongoing-evaluation standing '
      + 'instruction, flagged here rather than slipped in.',
  },

  // -------------------------------------------------------------------
  // Names, and the things a map is actually made of
  //
  // **Added 19 Sep 2026 and named in no document on file.** The owner
  // asked for whatever further sources would help, so these are
  // research rather than recovery — chosen against gaps the ENGINE
  // has, not against a list. Each entry says which guess it replaces.
  // -------------------------------------------------------------------
  gnis: {
    name: 'USGS Geographic Names Information System (GNIS)',
    licence: 'U.S. Government Work — public domain',
    licenceCheckedAt: null,
    access: 'direct download, pipe-delimited national or per-state files',
    host: 'usgs.gov',
    fills: ['landmarkData', 'geographyData'],
    tiers: ['regional', 'filler'],
    scale: '~2.3 million named U.S. places and physical features',
    wired: 'imports/gnisImport.js',
    note: '**The naming problem, solved for a whole country.** Every named summit, valley, '
      + 'cave, stream, church, school, hospital, cemetery and populated place in the United '
      + 'States, each with a feature class and coordinates. Two of the Key\'s categories — '
      + '`cave-system` and `natural-formation` — have no other source at all: UNESCO does '
      + 'not list a local cave and the National Register does not list a bluff. This is also '
      + 'the cheapest possible fix for the anonymous-landmark problem, because it is a flat '
      + 'file with no API key and no rate limit.',
  },
  hifld: {
    name: 'Homeland Infrastructure Foundation-Level Data (HIFLD Open)',
    licence: 'U.S. Government Work — public domain for the open layers',
    licenceCheckedAt: null,
    access: 'ArcGIS Open Data portal, per-layer GeoJSON or shapefile',
    host: 'hifld-geoplatform.hub.arcgis.com',
    fills: ['buildingData', 'landmarkData'],
    tiers: ['regional', 'filler'],
    scale: 'hundreds of open national infrastructure layers',
    wired: 'imports/hifldImport.js',
    note: '**It publishes the engine\'s own ten infrastructure types, as layers.** '
      + '`vacon-c/server/infrastructure.js` enumerates roads, bridges, rail, water systems, '
      + 'electricity, internet, hospitals, schools, public safety and waste management — and '
      + 'HIFLD has an open national layer for almost every one, with real capacity figures. '
      + 'A hospital arrives with its bed count, which is what `landmarks.staffingFor` and '
      + '`control.maintenanceFor` currently size from a band.',
  },
  nces: {
    name: 'National Center for Education Statistics (CCD and IPEDS)',
    licence: 'U.S. Government Work — public domain',
    licenceCheckedAt: null,
    access: 'NCES data files, and the Urban Institute Education Data API',
    host: 'nces.ed.gov',
    fills: ['buildingData', 'populationData'],
    tiers: ['regional'],
    scale: 'every U.S. public school and postsecondary institution',
    wired: 'imports/ncesImport.js',
    note: 'Enrolment and staff counts per school. Feeds the `school` Key category directly — '
      + 'added on 18 Sep from two documents disagreeing — and gives '
      + '`statecraft.runSchooling` a real pupil-to-teacher ratio instead of a chosen one.',
  },
  cmsProviders: {
    name: 'CMS Provider of Services file',
    licence: 'U.S. Government Work — public domain',
    licenceCheckedAt: null,
    access: 'data.cms.gov, quarterly flat files',
    host: 'data.cms.gov',
    fills: ['buildingData'],
    tiers: ['regional'],
    scale: 'every Medicare-certified U.S. hospital and facility',
    wired: 'imports/cmsImport.js',
    note: 'Certified bed count per hospital — the single number that decides a hospital\'s '
      + 'crew in `landmarks.staffingFor` and its maintenance requirement in '
      + '`control.maintenanceFor`. Overlaps HIFLD\'s hospital layer and is more current; '
      + 'prefer whichever was refreshed last rather than merging both.',
  },
  fbiCrime: {
    name: 'FBI Crime Data Explorer (UCR / NIBRS)',
    licence: 'U.S. Government Work — public domain',
    licenceCheckedAt: null,
    access: 'FBI CDE API (free key), or the bulk NIBRS extracts',
    host: 'api.usa.gov',
    fills: ['populationData'],
    tiers: ['regional'],
    scale: 'incident-level reporting from most U.S. agencies',
    wired: 'imports/fbiImport.js',
    note: '**Calibration, not content — and that is the valuable part.** NIBRS breaks '
      + 'offences down close to `crime.CRIME_CATEGORIES`\' own eight. CLAUDE.md\'s '
      + 'seventeenth standing rule records FOUR wrong thresholds in a row for the '
      + 'aggression escalation floor, each measured against the wrong population; real '
      + 'rates per 100,000 are the outside reference that argument lacked. Its own caveat, '
      + 'from that rule: a real rate imports a society with a functioning state, and every '
      + 'area in a generated world measures as `contested`. Use it to sanity-check ratios '
      + 'between categories, not to set absolute levels.',
  },
  cdcPlaces: {
    name: 'CDC PLACES',
    licence: 'U.S. Government Work — public domain',
    licenceCheckedAt: null,
    access: 'data.cdc.gov (Socrata API), tract and county levels',
    host: 'data.cdc.gov',
    fills: ['populationData'],
    tiers: ['regional'],
    scale: 'model-based health estimates for every U.S. census tract',
    wired: 'imports/cdcImport.js',
    note: 'Chronic condition and health-behaviour prevalence per tract. `vacon-c` already '
      + 'carries obesity, chronic-condition and nutrition statistics, and '
      + '`mortality.diseasePressure` scales death rates from a modelled figure. **Note what '
      + 'PLACES actually is**: small-area estimates produced by a model, not counts. It is '
      + 'the right shape for a simulation and the wrong thing to cite as observation.',
  },
  femaNri: {
    name: 'FEMA National Risk Index',
    licence: 'U.S. Government Work — public domain',
    licenceCheckedAt: null,
    access: 'hazards.fema.gov, county and tract tables',
    host: 'hazards.fema.gov',
    fills: ['geographyData'],
    tiers: ['regional'],
    scale: 'eighteen natural hazards, every U.S. county and tract',
    wired: 'imports/femaImport.js',
    note: 'Expected annual loss and risk rating per hazard per county. '
      + '`vacon-c/server/weather.js` draws disasters from bands this project chose; this '
      + 'says which hazards a given region actually faces, so a river town floods and a '
      + 'plains town does not. Pairs with NOAA: NOAA gives the ordinary climate, FEMA gives '
      + 'the tail.',
  },
  religionCensus: {
    name: 'U.S. Religion Census (ASARB, via ARDA)',
    licence: '**Not public domain — ARDA terms, free for research, verify before shipping**',
    licenceCheckedAt: null,
    access: 'thearda.com data archive, decennial county-level files',
    host: 'thearda.com',
    fills: ['populationData'],
    tiers: ['regional'],
    scale: 'congregations and adherents by tradition, every U.S. county',
    wired: 'imports/religionImport.js',
    note: '**Closes a gap this project measured and named.** `worldgen`\'s own history '
      + 'records five demographic statistics returning null "because nothing set religion, '
      + 'language or education", and `demographics.js` says `npcs.religion` is a real column '
      + 'set only where a caller supplies one. This is the caller — real adherence shares '
      + 'per county, which also decide how many churches, mosques, synagogues and temples a '
      + 'region should have.\n'
      + '**The one entry here whose licence is not public domain.** ARDA is an academic '
      + 'archive with its own terms; treat it as unverified until somebody reads them, '
      + 'which `describeSources` already counts it among.',
  },

  // -------------------------------------------------------------------
  // People, work and money
  // -------------------------------------------------------------------
  census: {
    name: 'U.S. Census Bureau — American Community Survey',
    licence: 'U.S. Government Work — public domain',
    licenceCheckedAt: null,
    access: 'Census Data API, or bulk table download',
    host: 'api.census.gov',
    fills: ['populationData', 'economicData'],
    tiers: ['regional'],
    scale: 'every U.S. census tract, annually',
    wired: 'imports/censusImport.js',
    note: '**Real demographics per neighbourhood, at the grain a community actually is.** '
      + 'VACON-C generates age, household, education and income distributions from bands '
      + 'this project chose; ACS publishes the real ones per tract, free. §9 permits '
      + 'demographic modelling and forbids demographics determining morality, criminality, '
      + 'intelligence or worth — real data does not change that firewall, it only replaces '
      + 'invented distributions with measured ones.',
  },
  bls: {
    name: 'U.S. Bureau of Labor Statistics',
    licence: 'U.S. Government Work — public domain',
    licenceCheckedAt: null,
    access: 'BLS Public Data API (OES, QCEW series)',
    host: 'api.bls.gov',
    fills: ['economicData'],
    tiers: ['regional'],
    scale: 'occupational employment and wages, per metro area',
    wired: 'imports/blsImport.js',
    note: '**The occupation taxonomy\'s missing evidence.** '
      + '`REBUILD_OCCUPATION_REQUIREMENTS_BLS_SOURCED.md` — named by the master index, '
      + 'recorded as written, and not in this repository — was the BLS methodology '
      + 'document. OES gives real employment counts and wages per occupation per metro, '
      + 'which is exactly what `vacon-c/server/occupations.js` draws from a 1/tier pyramid '
      + 'and what `economy.js` pays from a band. The lost document cannot be recovered; the '
      + 'data it was about is free and still there.',
  },

  // -------------------------------------------------------------------
  // Terrain, weather and environment
  // -------------------------------------------------------------------
  usgs: {
    name: 'USGS (3DEP elevation, and the National Map)',
    licence: 'U.S. Government Work — public domain',
    licenceCheckedAt: null,
    access: 'The National Map services, or direct DEM download',
    host: 'usgs.gov',
    fills: ['geographyData'],
    tiers: ['regional', 'filler'],
    scale: 'U.S. elevation at 1m-10m',
    wired: 'imports/usgsImport.js',
    note: 'Real terrain for the U.S., which is where the prototype region is. '
      + '`vacon-c/server/geo.js` has a terrain concept and no elevation behind it.',
  },
  noaa: {
    name: 'NOAA',
    licence: 'U.S. Government Work — public domain',
    licenceCheckedAt: null,
    access: 'api.weather.gov, and the NCEI climate archives',
    host: 'api.weather.gov',
    fills: ['geographyData'],
    tiers: ['regional'],
    scale: 'U.S. weather and climate normals',
    wired: 'imports/noaaImport.js',
    note: 'Feeds `vacon-c/server/weather.js`, whose climate is currently drawn from bands '
      + 'this project chose. **`regions.climate_key` is TEXT written by nothing** — '
      + '`barter.js` names that gap in its own header as one of three modifiers it cannot '
      + 'model. This is the source that closes it.',
  },
  openweather: {
    name: 'OpenWeather historical datasets',
    licence: 'Commercial — free tier is rate-limited and attribution-bound',
    licenceCheckedAt: null,
    access: 'REST API, requires a key',
    host: 'api.openweathermap.org',
    fills: ['geographyData'],
    tiers: ['regional'],
    scale: 'global historical weather',
    wired: 'imports/openweatherImport.js',
    note: '**The only entry here that is not free**, and the only one with a per-call cost, '
      + 'so it is the one to reach for last. NOAA covers the U.S. prototype region at no '
      + 'cost; this is for the global tier if that is ever built out.',
  },
};

const SOURCE_NAMES = Object.keys(SOURCES);

function sourceFor(key) {
  return SOURCES[key] ?? null;
}

// Every source that fills a given slice of the world model.
function sourcesFilling(slice) {
  return SOURCE_NAMES.filter((key) => SOURCES[key].fills.includes(slice));
}

// Every source with a working importer in this repository.
function wiredSources() {
  return SOURCE_NAMES.filter((key) => SOURCES[key].wired !== null);
}

// ---------------------------------------------------------------------
// describeSources — the coverage map, and the licence debt
// ---------------------------------------------------------------------
// Three things a person planning a build needs and could not previously
// get from anywhere:
//
//   what is covered      slices with at least one source behind them
//   what is not          slices nothing covers, minus the two that are
//                        uncovered on purpose
//   what is unverified   sources whose licence nobody has re-checked.
//                        The standing instruction says terms change
//                        quietly; this counts how much trust is
//                        currently being extended to design-phase
//                        research.
function describeSources() {
  const covered = [];
  const uncovered = [];
  for (const slice of WORLD_SLICES) {
    if (UNCOVERED_BY_DESIGN[slice]) continue;
    (sourcesFilling(slice).length > 0 ? covered : uncovered).push(slice);
  }

  const byTier = {};
  for (const tier of LOCATION_TIERS) {
    byTier[tier] = SOURCE_NAMES.filter((key) => SOURCES[key].tiers.includes(tier));
  }

  return {
    sources: SOURCE_NAMES.length,
    wired: wiredSources(),
    unwired: SOURCE_NAMES.filter((key) => SOURCES[key].wired === null),
    coveredSlices: covered,
    uncoveredSlices: uncovered,
    uncoveredByDesign: Object.keys(UNCOVERED_BY_DESIGN),
    byTier,
    // A licence nobody has checked is a licence nobody can rely on.
    licencesUnverified: SOURCE_NAMES.filter((key) => SOURCES[key].licenceCheckedAt === null),
    // The ones with conditions that reach the SHIPPED product rather
    // than the build. Named because they are the ones that can cost
    // money or force a change late.
    encumbered: SOURCE_NAMES.filter(
      (key) => /ODbL|share-alike|Commercial|Not public domain/i.test(SOURCES[key].licence),
    ),
  };
}

// ---------------------------------------------------------------------
// fieldDepth — coverage that can still move
// ---------------------------------------------------------------------
// Per slice: how many of its FIELDS have a wired source behind them,
// which fields do not, and which registry source would close each one.
//
// **This is the number to quote, not the slice count.** A slice counts
// as covered the moment one field in it is filled, which is how
// `populationData` read as done with religion, health prevalence and
// crime calibration all unsourced inside it.
function fieldDepth() {
  const bySlice = {};
  for (const [slice, fields] of Object.entries(SLICE_FIELDS)) {
    const filled = [];
    const open = [];
    for (const entry of fields) {
      const wired = entry.source.filter((key) => SOURCES[key] && SOURCES[key].wired !== null);
      if (wired.length > 0) filled.push({ ...entry, wiredBy: wired });
      else open.push({ ...entry, wouldClose: entry.source });
    }
    bySlice[slice] = {
      fields: fields.length,
      filled: filled.length,
      open,
      depth: fields.length === 0 ? null : Math.round((filled.length / fields.length) * 100) / 100,
    };
  }

  // Everything still open, flattened, so the cheapest remaining work is
  // one list rather than a walk through nine.
  const openFields = [];
  for (const [slice, entry] of Object.entries(bySlice)) {
    for (const field of entry.open) openFields.push({ slice, ...field });
  }

  const total = Object.values(bySlice).reduce((sum, s) => sum + s.fields, 0);
  const filled = Object.values(bySlice).reduce((sum, s) => sum + s.filled, 0);
  return {
    bySlice,
    openFields,
    fields: total,
    filled,
    // The honest headline. Slice coverage says 7 of 7; this does not.
    depth: total === 0 ? null : Math.round((filled / total) * 100) / 100,
  };
}

// ---------------------------------------------------------------------
// realisedCoverage — an importer is not an import
// ---------------------------------------------------------------------
// **Field depth reached 100% the day the last ten importers landed, and
// nothing about the world got better.** That is the same failure
// `fieldDepth` was added to fix, one level up: a number that measures
// the CODE and is quoted as though it measured the DATA.
//
// Every source host in this registry returns 403 CONNECT at this
// environment's proxy. Not one record has passed through any transform
// here. So the honest headline is not 100% and not 78% — it is zero,
// and it stays zero until a network that can reach these hosts runs the
// `fetch*` half.
//
// This reads a real world layer and reports how much of it actually
// carries imported data. It is the only figure in this file that cannot
// be raised by writing more code.
function realisedCoverage(worldLayer) {
  const locations = worldLayer?.locations ?? [];
  const sliceNames = Object.keys(SLICE_FIELDS);

  let fieldsWithData = 0;
  let possible = 0;
  const bySlice = {};

  for (const slice of sliceNames) {
    const withData = locations.filter((l) => {
      const value = l[slice];
      if (value === null || value === undefined) return false;
      if (Array.isArray(value)) return value.length > 0;
      if (typeof value === 'object') return Object.keys(value).length > 0;
      return true;
    }).length;
    bySlice[slice] = { locations: withData, of: locations.length };
    fieldsWithData += withData;
    possible += locations.length;
  }

  return {
    locations: locations.length,
    bySlice,
    fieldsWithData,
    possible,
    // **Null for an empty world, not zero.** A world with no locations
    // has not achieved 0% coverage; it has nothing to have covered.
    // The `Number(null)` corollary, in the one number somebody would
    // quote.
    realisedDepth: possible === 0
      ? null
      : Math.round((fieldsWithData / possible) * 1000) / 1000,
    note: 'What has actually been imported. Field depth measures whether a transform '
      + 'exists; this measures whether data arrived. Every source host in this registry is '
      + 'blocked at this environment\'s proxy, so on this machine it is zero by '
      + 'construction — which is the honest number, not a failure of the importers.',
  };
}

// ---------------------------------------------------------------------
// licenceReviewOrder — the unbudgeted legal line, sequenced
// ---------------------------------------------------------------------
// **All twenty-four entries carry `licenceCheckedAt: null`**, and
// `dev-docs/STANDING_INSTRUCTION_ONGOING_EVALUATION.md` says dataset
// terms change quietly and must be re-checked at build time. Nobody has
// costed that review, and it is the one line in the data budget that is
// somebody's hourly rate rather than free.
//
// It does not have to be paid all at once. A source is **load-bearing**
// if removing it leaves some field in `SLICE_FIELDS` with no wired
// source at all; otherwise another wired source already covers
// everything it does, and its review can wait.
//
// **Redundant does not mean worthless, and reading it that way would be
// an expensive mistake.** UNESCO is redundant by this measure because
// NRHP, GNIS and Wikidata also supply landmark names — but UNESCO IS
// §7's definition of Tier 1 scope, and NRHP carries the published
// significance grading that decides which locations cost money. Both
// are cheap to keep and the coverage matrix cannot see why they matter.
// This function sequences REVIEW; it does not recommend deletion.
//
// The exception worth acting on is a source that is both redundant and
// encumbered: it carries conditions somebody has to clear, and nothing
// depends on it.
function licenceReviewOrder() {
  const wired = SOURCE_NAMES.filter((key) => SOURCES[key].wired !== null);

  const leavesAGap = (excluded) => {
    for (const fields of Object.values(SLICE_FIELDS)) {
      for (const field of fields) {
        const live = field.source.filter(
          (key) => key !== excluded && SOURCES[key] && SOURCES[key].wired !== null,
        );
        if (live.length === 0) return true;
      }
    }
    return false;
  };

  const loadBearing = [];
  const deferrable = [];
  for (const key of wired) (leavesAGap(key) ? loadBearing : deferrable).push(key);

  const { encumbered } = describeSources();
  return {
    // Review these first: a licence problem here is a coverage gap.
    loadBearing,
    // These can wait. Keeping them is still usually right — see above.
    deferrable,
    // **Both encumbered and load-bearing**: a licence problem here
    // blocks a field with no alternative, so it is a decision rather
    // than a review. Today that is the Religion Census, the only
    // source for `npcs.religion`.
    blockingLicenceRisk: loadBearing.filter((key) => encumbered.includes(key)),
    // **Encumbered and depended on by nothing**: conditions to clear
    // for no coverage. The cheapest thing in the registry to drop.
    droppable: deferrable.filter((key) => encumbered.includes(key)),
    unreviewed: wired.filter((key) => SOURCES[key].licenceCheckedAt === null).length,
  };
}

module.exports = {
  WORLD_SLICES,
  SLICE_FIELDS,
  realisedCoverage,
  licenceReviewOrder,
  UNCOVERED_BY_DESIGN,
  SOURCES,
  SOURCE_NAMES,
  sourceFor,
  sourcesFilling,
  wiredSources,
  describeSources,
  fieldDepth,
};
