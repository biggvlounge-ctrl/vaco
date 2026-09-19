// Universal World Layer — what it would cost to produce this, from zero.
//
// **A different question from `costModel.js`, and the difference is the
// point.**
//
// `costModel.js` prices LOCATIONS: what it costs to populate a world
// with places, against the tier hierarchy §7 sets out. Every figure in
// it descends from one number on file, $420,000–$960,000, and every
// note in it is about not misreading that number.
//
// This file asks the other question: **what would it cost to produce
// what is in this repository, today, if none of it existed and none of
// the figures on file were available?** It shares no constant with
// `costModel.js` on purpose — a derivation that reuses the number it is
// supposed to check independently is not a check.
//
// ---------------------------------------------------------------------
// Two rules this file holds itself to
// ---------------------------------------------------------------------
// **1. Scope is measured, rates are assumed, and the two never blur.**
// `BUILD_SCOPE` is counted from the repository and a test re-counts it.
// `RATE_ASSUMPTIONS` is judgement, carries `checkedAt: null` exactly as
// `sources.js` does for licences, and every function takes its rates as
// an argument so nothing here silently prices anything.
//
// **2. The most expensive mistake available is a category error**, and
// it is the one this file exists to prevent. See `WORLD_KINDS`.

'use strict';

// ---------------------------------------------------------------------
// BUILD_SCOPE — counted, not estimated
// ---------------------------------------------------------------------
//: What is actually in this repository. Every figure here is countable
//: from the tree and `test/build-estimate.test.js` re-counts the ones
//: that can drift, so this cannot quietly become a claim.
const BUILD_SCOPE = {
  engine: {
    modules: 73,
    lines: 36644,
    tables: 63,
    routes: 79,
    tickPhases: 11,
    traitFamilies: 20,
    traitDefinitions: 128,
    occupations: 34,
    keyBuildingCategories: 24,
    statistics: 117,
  },
  worldLayer: {
    modules: 30,
    lines: 6575,
    sources: 24,
    importers: 22,
  },
  tests: {
    files: 70,
    lines: 27329,
    cases: 1335,
  },
  countedAt: '2026-09-19',
};

const TOTAL_LINES = BUILD_SCOPE.engine.lines
  + BUILD_SCOPE.worldLayer.lines
  + BUILD_SCOPE.tests.lines;

// ---------------------------------------------------------------------
// WORLD_KINDS — the category error, named before any arithmetic
// ---------------------------------------------------------------------
//: **"A world" means two completely different products and they differ
//: by roughly an order of magnitude per location.**
//:
//: VACON-C has no renderer. Its dependencies are express, pg, cors and
//: dotenv; there is no three.js, no glTF, no engine integration
//: anywhere in the tree. Cesium and Overture appear in this repository
//: as DATA SOURCES, never as a rendering path. What this project
//: produces is a simulated world — people, economies, buildings as
//: records, law, crime, knowledge — and what a player reads is state,
//: not geometry.
//:
//: That matters for the figure on file. $420K–$960K over ~1,200 Tier 1
//: locations is **$350–$800 each**, which buys four to sixteen hours of
//: skilled time. That is a research-and-curation budget: find the
//: place, verify it, grade its significance, gather reference, write
//: its record. It is a sensible number for a DATA world.
//:
//: It is not a 3D budget. A detailed, game-quality landmark building is
//: commonly 40–120 hours of environment art, which at any real rate is
//: thousands per location, not hundreds. **If somebody reads the figure
//: on file as the cost of a rendered globe, they are under by something
//: like ten times** — and that misreading is far more expensive than
//: the one this project already corrected (quoting a lifetime total as
//: a launch cost).
const WORLD_KINDS = {
  data: {
    label: 'simulated world — records, no geometry',
    whatAHeroLocationBuys: 'research, verification, significance grading, reference '
      + 'gathering, and the written record',
    hoursPerHeroLocation: [4, 16],
    isWhatThisRepoProduces: true,
  },
  rendered: {
    label: 'visually rendered world — 3D geometry a player looks at',
    whatAHeroLocationBuys: 'all of the above, plus modelling, texturing, LODs and '
      + 'integration for a landmark building',
    hoursPerHeroLocation: [40, 120],
    isWhatThisRepoProduces: false,
  },
};

// ---------------------------------------------------------------------
// RATE_ASSUMPTIONS — judgement, flagged as judgement
// ---------------------------------------------------------------------
//: **None of this is verified and all of it is mine.** It is held here
//: as data with `checkedAt: null`, the same discipline `sources.js`
//: applies to licences, because a rate typed into prose is a rate
//: nobody re-checks. Anyone using these should replace them with quotes
//: they actually hold.
//:
//: `deliveredLinesPerDay` is the one worth arguing about. It is not
//: typing speed — it is design, implementation, test, review and rework
//: divided by calendar days, sustained over a project. Published
//: estimates for non-trivial systems cluster well below 100; this
//: codebase is unusually comment-dense (the comments carry the design
//: reasoning and the measurements behind each constant), which lowers
//: raw throughput and reduces rework. The band is wide because the
//: honest uncertainty is wide.
const RATE_ASSUMPTIONS = {
  deliveredLinesPerDay: [60, 120],
  engineerDayCost: {
    inHouseSenior: [700, 1000],
    nearshore: [300, 500],
    agencyContract: [1200, 2000],
  },
  artistHourCost: [30, 80],
  researcherHourCost: [25, 60],
  workingDaysPerYear: 220,
  checkedAt: null,
  note: 'Unverified assumptions, not quotes. Replace before relying on any total.',
};

function band(low, high) {
  return { low: Math.round(low), high: Math.round(high) };
}

// ---------------------------------------------------------------------
// The software: what it would cost to write this again
// ---------------------------------------------------------------------
// **Lines are a proxy and a poor one**, which is why the band is wide
// and why `estimateEngineering` reports the day count as well as the
// money — the day count is the part worth sanity-checking against
// somebody's own experience of building a system with 63 tables, 79
// routes and an eleven-phase deterministic pipeline.
//
// Note the direction of the error: fewer lines is not cheaper here.
// Roughly 40% of this tree is tests, and they are the reason the
// measured defects in this project were found at all.
function estimateEngineering(options = {}) {
  const {
    lines = TOTAL_LINES,
    linesPerDay = RATE_ASSUMPTIONS.deliveredLinesPerDay,
    dayCost = null,
  } = options;

  if (!Array.isArray(linesPerDay) || linesPerDay.length !== 2) {
    throw new Error('estimateEngineering requires linesPerDay as [low, high]');
  }
  // Fast rate gives the LOW day count, so the bands invert.
  const days = band(lines / linesPerDay[1], lines / linesPerDay[0]);
  const years = {
    low: Math.round((days.low / RATE_ASSUMPTIONS.workingDaysPerYear) * 10) / 10,
    high: Math.round((days.high / RATE_ASSUMPTIONS.workingDaysPerYear) * 10) / 10,
  };

  if (dayCost === null) {
    // **No rate supplied is not a rate of zero.** Same rule
    // `costModel.estimateBuildCost` holds.
    return { lines, days, engineerYears: years, cost: null, ratesSupplied: false };
  }
  if (!Array.isArray(dayCost) || dayCost.length !== 2) {
    throw new Error('estimateEngineering requires dayCost as [low, high]');
  }
  return {
    lines,
    days,
    engineerYears: years,
    cost: band(days.low * dayCost[0], days.high * dayCost[1]),
    ratesSupplied: true,
  };
}

// ---------------------------------------------------------------------
// The content: what a hero location costs, derived from hours
// ---------------------------------------------------------------------
// Independent of the $420K–$960K on file, so the two can be compared
// rather than one restated as the other. `compareToFigureOnFile` does
// that comparison and is the reason this function exists.
function estimateHeroLocation(kind, options = {}) {
  const definition = WORLD_KINDS[kind];
  if (!definition) {
    throw new Error(
      `estimateHeroLocation: "${kind}" is not a world kind (${Object.keys(WORLD_KINDS).join(', ')}). `
      + 'The distinction is the whole point of this file — see WORLD_KINDS.',
    );
  }
  const { hourCost = null } = options;
  const [lowHours, highHours] = definition.hoursPerHeroLocation;
  if (hourCost === null) {
    return { kind, hours: band(lowHours, highHours), perLocation: null, ratesSupplied: false };
  }
  if (!Array.isArray(hourCost) || hourCost.length !== 2) {
    throw new Error('estimateHeroLocation requires hourCost as [low, high]');
  }
  return {
    kind,
    hours: band(lowHours, highHours),
    perLocation: band(lowHours * hourCost[0], highHours * hourCost[1]),
    ratesSupplied: true,
  };
}

// ---------------------------------------------------------------------
// compareToFigureOnFile — does the archived number price what people
// think it prices?
// ---------------------------------------------------------------------
// Takes the on-file per-location band as an argument rather than
// importing `costModel.HERO_RATE_ON_FILE`, so this file has no opinion
// about that number until a caller hands it over. The answer it gives
// is the useful one: the figure on file is consistent with a DATA
// world and roughly an order of magnitude short of a RENDERED one.
function compareToFigureOnFile(onFilePerLocation, options = {}) {
  if (!Array.isArray(onFilePerLocation) || onFilePerLocation.length !== 2) {
    throw new Error('compareToFigureOnFile requires the on-file band as [low, high]');
  }
  const { hourCost = RATE_ASSUMPTIONS.researcherHourCost } = options;
  const midOnFile = (onFilePerLocation[0] + onFilePerLocation[1]) / 2;

  const byKind = {};
  for (const kind of Object.keys(WORLD_KINDS)) {
    const estimate = estimateHeroLocation(kind, { hourCost });
    const mid = (estimate.perLocation.low + estimate.perLocation.high) / 2;
    byKind[kind] = {
      derivedPerLocation: estimate.perLocation,
      // Above 1 means the figure on file is SHORT of what this kind of
      // world would cost.
      shortfallFactor: Math.round((mid / midOnFile) * 10) / 10,
      consistent: mid <= onFilePerLocation[1] * 1.5 && mid >= onFilePerLocation[0] * 0.5,
    };
  }
  return {
    onFilePerLocation,
    hourCost,
    byKind,
    note: 'The figure on file prices research and curation. It is consistent with a data '
      + 'world and short of a rendered one. Which kind is being built is a product '
      + 'decision, not an estimating detail.',
  };
}

// ---------------------------------------------------------------------
// describeEstimate — everything at once, with the caveats attached
// ---------------------------------------------------------------------
function describeEstimate(options = {}) {
  const { dayCost = null, hourCost = null } = options;
  return {
    scope: BUILD_SCOPE,
    totalLines: TOTAL_LINES,
    // **Roughly 40% of the tree is tests**, and that is reported rather
    // than netted off: they are why the defects in this project were
    // found, and an estimate that treats them as overhead is pricing a
    // different and worse product.
    testShare: Math.round((BUILD_SCOPE.tests.lines / TOTAL_LINES) * 100) / 100,
    engineering: estimateEngineering({ dayCost }),
    heroLocation: Object.fromEntries(
      Object.keys(WORLD_KINDS).map((k) => [k, estimateHeroLocation(k, { hourCost })]),
    ),
    rateAssumptions: RATE_ASSUMPTIONS,
    ratesVerified: RATE_ASSUMPTIONS.checkedAt !== null,
  };
}

module.exports = {
  BUILD_SCOPE,
  TOTAL_LINES,
  WORLD_KINDS,
  RATE_ASSUMPTIONS,
  estimateEngineering,
  estimateHeroLocation,
  compareToFigureOnFile,
  describeEstimate,
};
