// Universal World Layer — cost model reporting.
//
// **Why this file exists.** Two savings are claimed by
// `UNIVERSAL_WORLD_LAYER_ARCHITECTURE.md` and neither could be checked
// against a running world:
//
//   1. *"One generated gas station appears in thousands of towns; one
//      house family creates millions of real variations; one warehouse
//      gets reused globally — major reduction in ongoing AI generation
//      cost through real, tracked reuse."*
//   2. *"Tier 1 (global icons, ~1,200 UNESCO locations): real, paid
//      human work. Tier 2 (major cities): AI-assisted refinement only.
//      Tier 3 (everything else): fully automated."*
//
// `assetLibrary.js` does track `usageCount` per asset, so (1) is real
// per-asset — but nothing rolled it up, and a saving nobody totals is a
// saving nobody can put in front of an investor or check a quote
// against. Same for (2): every location carries a tier, and nothing
// counted them.
//
// **These functions report. They do not price.** Every rate here comes
// from a document in this repository and is passed in, never assumed —
// there is no hardcoded dollar figure below, deliberately, because a
// number invented in code is indistinguishable from a number someone
// agreed to.
//
// ---------------------------------------------------------------------
// **The arithmetic that matters most, stated once.**
//
// The hero-tier figure on file is $420,000-$960,000, and the
// architecture document scopes Tier 1 at ~1,200 UNESCO locations. That
// is **$350-$800 per hero location** — a per-unit rate, not a lump sum.
//
// A launch does not include 1,200 hero locations. `estimateBuildCost()`
// exists so the question "what does THIS scope cost" can be answered
// from the tiers actually present in a world, rather than by quoting a
// lifetime figure as if it were a launch invoice.

'use strict';

const { LOCATION_TIERS } = require('./locations');

// ---------------------------------------------------------------------------
// Reuse — the automation saving, totalled
// ---------------------------------------------------------------------------
// `placements` is how many times assets were used; `assetsCreated` is
// how many distinct things had to be generated to serve them. The gap
// between the two IS the saving, and `reuseRatio` is the multiplier the
// architecture document is claiming when it says one gas station serves
// thousands of towns.
function getReuseReport(worldLayer) {
  const assets = worldLayer.assets || [];
  const placements = assets.reduce((sum, a) => sum + (a.usageCount || 0), 0);

  const byType = {};
  for (const asset of assets) {
    const entry = byType[asset.assetType] || { assetsCreated: 0, placements: 0 };
    entry.assetsCreated += 1;
    entry.placements += asset.usageCount || 0;
    byType[asset.assetType] = entry;
  }
  for (const entry of Object.values(byType)) {
    entry.reuseRatio = entry.assetsCreated ? round2(entry.placements / entry.assetsCreated) : 0;
  }

  // An asset registered and never placed is not a saving, it is
  // inventory. Reported separately because the two are easy to conflate
  // and only one of them is worth money.
  const unused = assets.filter((a) => !a.usageCount).length;

  return {
    assetsCreated: assets.length,
    placements,
    // How many creations the reuse avoided. Placing 500 buildings from
    // 20 assets avoided 480 creations.
    creationsAvoided: Math.max(0, placements - assets.length),
    reuseRatio: assets.length ? round2(placements / assets.length) : 0,
    unusedAssets: unused,
    byType,
    byTier: countBy(assets, (a) => a.qualityLevel),
  };
}

// ---------------------------------------------------------------------------
// Tier coverage — what a quote should actually be for
// ---------------------------------------------------------------------------
// The document's target is "90%+ automated world construction, 10%
// human refinement". `automatedShare` is that claim, measured: the
// proportion of locations in tiers nobody is paid per-unit for.
function getTierCoverage(worldLayer) {
  const locations = worldLayer.locations || [];
  const byTier = countBy(locations, (l) => l.tier);
  for (const tier of LOCATION_TIERS) {
    if (!(tier in byTier)) byTier[tier] = 0;
  }

  const total = locations.length;
  const humanTier = byTier.hero;
  const automated = total - humanTier;

  return {
    total,
    byTier,
    // Tier 1 is the only tier priced per location. Tier 2 is
    // AI-assisted and Tier 3 is fully automated, so both are pipeline
    // output rather than commissioned work.
    paidHumanWork: humanTier,
    automated,
    automatedShare: total ? round2((automated / total) * 100) : null,
    // null rather than 0 for an empty world: an empty world has not got
    // 0% automation, it has no locations to have a share of.
    meetsAutomationTarget: total ? (automated / total) >= 0.9 : null,
  };
}

// ---------------------------------------------------------------------------
// estimateBuildCost() — this scope, not the lifetime figure
// ---------------------------------------------------------------------------
// rates: { hero: [low, high], regional: [low, high], filler: [low, high] }
//
// Every rate is supplied by the caller. Nothing here knows what a hero
// location costs, and that is on purpose — see the header. Rates
// derived from documents on file are exported as HERO_RATE_ON_FILE
// below, with their derivation, so a caller can use them knowingly
// rather than inherit them silently.
function estimateBuildCost(worldLayer, rates = {}) {
  const coverage = getTierCoverage(worldLayer);
  const lines = [];
  let low = 0;
  let high = 0;

  for (const tier of LOCATION_TIERS) {
    const count = coverage.byTier[tier] || 0;
    const rate = rates[tier];
    if (!rate) {
      // No rate given is not a rate of zero. A tier priced at nothing
      // and a tier nobody priced look identical in a total, which is
      // exactly the confusion this whole file exists to stop.
      lines.push({ tier, count, rate: null, low: null, high: null, note: 'no rate supplied — not counted as free' });
      continue;
    }
    const [rLow, rHigh] = rate;
    lines.push({ tier, count, rate, low: count * rLow, high: count * rHigh });
    low += count * rLow;
    high += count * rHigh;
  }

  return {
    locations: coverage.total,
    lines,
    low,
    high,
    unpricedTiers: lines.filter((l) => l.rate === null).map((l) => l.tier),
  };
}

// The hero-tier rate, derived rather than invented, with the working
// shown so it can be checked or replaced:
//
//   $420,000-$960,000   hero-tier total on file
//   ~1,200              UNESCO locations = Tier 1 scope
//   -> $350-$800 per hero location
//
// Exported as data, not applied as a default, so nothing in this module
// silently prices a world.
const HERO_RATE_ON_FILE = {
  perLocation: [350, 800],
  derivedFrom: {
    tierTotal: [420000, 960000],
    tierScope: 1200,
    source: 'UNIVERSAL_WORLD_LAYER_ARCHITECTURE.md §7 + the hero-location figure in '
      + 'VACANCY_MASTER_SESSION_INDEX.md',
  },
  note: 'A per-unit rate. The $420K-$960K total covers full global hero coverage over the '
    + 'life of the project, not a launch.',
};

// ---------------------------------------------------------------------------

function countBy(items, key) {
  const out = {};
  for (const item of items) {
    const k = key(item);
    out[k] = (out[k] || 0) + 1;
  }
  return out;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

module.exports = {
  HERO_RATE_ON_FILE,
  getReuseReport,
  getTierCoverage,
  estimateBuildCost,
};
