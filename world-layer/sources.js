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
    wired: null,
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
    wired: null,
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
    wired: null,
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
    wired: null,
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
    wired: null,
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
    wired: null,
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
    wired: null,
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
    wired: null,
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
    wired: null,
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
    wired: null,
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

module.exports = {
  WORLD_SLICES,
  UNCOVERED_BY_DESIGN,
  SOURCES,
  SOURCE_NAMES,
  sourceFor,
  sourcesFilling,
  wiredSources,
  describeSources,
};
