// Universal World Layer — FEMA National Risk Index import.
//
// **Which disasters a place can actually have, instead of every place
// having the same ones.**
//
// ---------------------------------------------------------------------
// The gap, stated in the engine's own terms
// ---------------------------------------------------------------------
// `vacon-c/server/environment.js` draws weather from `CLIMATES` — four
// profiles, `temperate`, `arid`, `coastal`, `continental` — and turns
// four of its six weathers into running conditions through `SEVERE`:
// drought, heat, freeze and storm. That is a real model and it has one
// blind spot: **a climate profile is not a hazard profile.** Two
// temperate river towns, one on a floodplain and one on a bluff, get
// the same storms and the same consequences, because nothing anywhere
// knows the difference.
//
// The National Risk Index publishes, per U.S. county and census tract,
// an expected-annual-loss and risk score for eighteen named natural
// hazards. It is a FEMA product: a U.S. Government Work, public domain,
// downloadable as CSV with no key.
//
// ---------------------------------------------------------------------
// Eighteen hazards, four the engine models, and the rest are NAMED
// ---------------------------------------------------------------------
// The temptation is to map all eighteen onto the four `SEVERE` entries
// and call it covered. That would be the twentieth rule: a mapping
// dense enough to look complete while inventing most of itself.
//
// So `HAZARD_MAP` maps only the hazards that correspond to something
// `environment.js` already runs, and `UNMODELLED_HAZARDS` names the
// rest with what they would need. A wildfire risk score has nowhere to
// go in this engine today, and saying so is worth more than folding it
// into `storm`.
//
// NETWORK CONSTRAINT, checked directly: `fema.gov` is outside this
// environment's outbound proxy allowlist (403 CONNECT). `fetchRiskIndex`
// throws with that reason; the transform is the tested part.

'use strict';

const { setLocationData, getLocation } = require('../locations');

//: NRI hazards → the `environment.SEVERE` condition they intensify.
//: **Four entries, because the engine runs four severe weathers.**
//: `riverineFlooding` and `coastalFlooding` both land on `storm`
//: because a storm is the only mechanism by which water arrives in
//: this model; that is stated rather than hidden, and it is the reason
//: `sourceHazards` is kept on the row.
const HAZARD_MAP = {
  drought: 'drought',
  heatWave: 'heat',
  coldWave: 'freeze',
  winterWeather: 'freeze',
  riverineFlooding: 'storm',
  coastalFlooding: 'storm',
  hurricane: 'storm',
  strongWind: 'storm',
  tornado: 'storm',
};

//: Hazards the NRI publishes that this engine has no mechanism for.
//: **Named with what each would need**, because "we chose not to model
//: wildfire" and "the importer lost wildfire" are different facts and
//: only one of them is a design decision.
const UNMODELLED_HAZARDS = {
  wildfire: 'no fire mechanic — nothing burns a property or a resource',
  earthquake: 'no structural shock — property.condition falls only to time and stripping',
  tsunami: 'no coastline geometry to run it against',
  volcanicActivity: 'no mechanism, and no U.S. prototype region needs one',
  landslide: 'no terrain slope in the engine — usgsImport adds it to the world layer first',
  avalanche: 'as landslide',
  hail: 'would fold into storm, and folding it in would double-count the same event',
  lightning: 'no point-damage mechanic',
  iceStorm: 'would fold into freeze, same double-count',
};

const HAZARD_NAMES = Object.keys(HAZARD_MAP);
const UNMODELLED_NAMES = Object.keys(UNMODELLED_HAZARDS);

//: NRI's published rating vocabulary, coarse to severe. Kept as
//: published rather than turned into a number here: the rating is what
//: FEMA asserts, a multiplier would be what this file asserts.
const RATINGS = [
  'Very Low', 'Relatively Low', 'Relatively Moderate', 'Relatively High', 'Very High',
];

//: Rating → a 0..1 weight, for the one consumer that needs a number.
//: **Evenly spaced on purpose.** NRI's ratings are percentile bands of
//: a continuous score, so anything other than even spacing would be
//: asserting a shape FEMA did not publish.
const RATING_WEIGHT = {
  'Very Low': 0,
  'Relatively Low': 0.25,
  'Relatively Moderate': 0.5,
  'Relatively High': 0.75,
  'Very High': 1,
};

function conditionFor(hazard) {
  return HAZARD_MAP[hazard] ?? null;
}

function weightFor(rating) {
  return RATING_WEIGHT[rating] ?? null;
}

// Turn a county's hazard ratings into a per-condition risk profile.
//
// `ratings` is `{ <hazard>: <rating> }` as the NRI CSV publishes it.
// Returns `{ <severe condition>: weight }` plus what was left out.
//
// **The maximum, not the mean.** Three moderate flood hazards do not
// average into a moderate storm risk — a place that floods from rivers
// AND the coast AND hurricanes is at the risk of its worst one, not at
// their average, and averaging would let extra hazards make a place
// look safer.
function toRiskProfile(ratings = {}) {
  const byCondition = {};
  const sourceHazards = {};
  const unmodelled = [];

  for (const [hazard, rating] of Object.entries(ratings)) {
    const condition = conditionFor(hazard);
    if (condition === null) {
      if (UNMODELLED_HAZARDS[hazard]) {
        unmodelled.push({ hazard, rating, reason: UNMODELLED_HAZARDS[hazard] });
      } else {
        unmodelled.push({ hazard, rating, reason: 'not an NRI hazard this importer knows' });
      }
      continue;
    }
    const weight = weightFor(rating);
    if (weight === null) continue;
    if (!(condition in byCondition) || weight > byCondition[condition]) {
      byCondition[condition] = weight;
    }
    (sourceHazards[condition] ||= []).push({ hazard, rating });
  }

  return { byCondition, sourceHazards, unmodelled };
}

// Attach a hazard profile to a location.
function importRiskIndex(worldLayer, locationId, record = {}) {
  const location = getLocation(worldLayer, locationId);
  if (!location) throw new Error(`importRiskIndex: no location with id ${locationId}`);
  if (!record.countyFips) {
    throw new Error(
      'importRiskIndex requires record.countyFips — an unattributed risk score cannot be '
      + 'checked against the published table.',
    );
  }

  const profile = toRiskProfile(record.ratings ?? {});
  const existing = location.geographyData ?? {};
  setLocationData(worldLayer, locationId, 'geographyData', {
    ...existing,
    source: 'fema-nri',
    licence: 'public-domain',
    countyFips: record.countyFips,
    countyName: record.countyName ?? null,
    // What `environment.js` could read: a weight per severe condition.
    hazardRisk: profile.byCondition,
    // Which real hazards produced each weight, so a consumer can see
    // that a `storm` weight of 1 came from hurricane risk rather than
    // from a generic guess.
    hazardSources: profile.sourceHazards,
    // **What this engine cannot represent**, kept on the row rather
    // than dropped. A county whose dominant risk is wildfire reads as
    // low-risk here, and that is a fact about the model.
    unmodelledHazards: profile.unmodelled,
  });
  return location;
}

// ---------------------------------------------------------------------
// describeHazardCoverage — and how much of the real risk is invisible
// ---------------------------------------------------------------------
function describeHazardCoverage(worldLayer) {
  const byCondition = {};
  let withRisk = 0;
  let unmodelledCount = 0;
  const unmodelledByHazard = {};

  for (const location of worldLayer.locations || []) {
    const data = location.geographyData;
    if (data?.source !== 'fema-nri') continue;
    withRisk += 1;
    for (const [condition, weight] of Object.entries(data.hazardRisk ?? {})) {
      const entry = (byCondition[condition] ||= { places: 0, maxWeight: 0 });
      entry.places += 1;
      if (weight > entry.maxWeight) entry.maxWeight = weight;
    }
    for (const entry of data.unmodelledHazards ?? []) {
      // Only a rating that means something counts as lost coverage —
      // a Very Low wildfire risk is not a gap in the model.
      if ((weightFor(entry.rating) ?? 0) <= 0.25) continue;
      unmodelledCount += 1;
      unmodelledByHazard[entry.hazard] = (unmodelledByHazard[entry.hazard] ?? 0) + 1;
    }
  }

  return {
    withRisk,
    byCondition,
    modelledHazards: HAZARD_NAMES,
    // **The honest counterweight to the coverage figure**: real,
    // material risk at these places that this engine has no mechanism
    // for. A high number is not an import failure, it is the model's
    // scope, measured.
    materialUnmodelledRisks: unmodelledCount,
    unmodelledByHazard,
    unmodelledReasons: UNMODELLED_HAZARDS,
  };
}

function fetchRiskIndex() {
  throw new Error(
    'fetchRiskIndex is not implemented: fema.gov is outside this environment\'s outbound '
    + 'proxy allowlist (403 CONNECT, checked directly). The National Risk Index needs no '
    + 'API — it is a CSV download per county or census tract from hazards.fema.gov/nri. '
    + 'Read the rows and pass { countyFips, countyName, ratings } to '
    + `importRiskIndex(worldLayer, locationId, record). Modelled hazards: ${HAZARD_NAMES.join(', ')}. `
    + `Published but unmodelled here: ${UNMODELLED_NAMES.join(', ')}.`,
  );
}

module.exports = {
  HAZARD_MAP,
  HAZARD_NAMES,
  UNMODELLED_HAZARDS,
  UNMODELLED_NAMES,
  RATINGS,
  RATING_WEIGHT,
  conditionFor,
  weightFor,
  toRiskProfile,
  importRiskIndex,
  describeHazardCoverage,
  fetchRiskIndex,
};
