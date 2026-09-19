// Universal World Layer — CDC PLACES import.
//
// **Health as a fact about a neighbourhood, which is the grain the
// engine's mortality model is missing.**
//
// ---------------------------------------------------------------------
// What it closes
// ---------------------------------------------------------------------
// `vacon-c/server/mortality.js` computes `diseasePressure` by
// multiplying the `mortalityMultiplier` of every running condition. It
// is a clean mechanism with one input nobody supplies: outbreaks are
// added by `addDiseaseOutbreak` with a multiplier somebody chose, and
// the BASELINE — how much illness there is in a place when nothing
// unusual is happening — does not exist. Every neighbourhood in every
// world is equally healthy until something is done to it.
//
// `health` is also one of the five `communities` condition columns that
// `territory.refreshCommunityConditions` writes, and one of the two a
// player reads first.
//
// CDC PLACES publishes model-based prevalence estimates for around
// forty measures — chronic conditions, health behaviours, prevention,
// disability — at **census tract** level for the whole United States,
// annually. Public domain, downloadable as CSV, no key.
//
// ---------------------------------------------------------------------
// The §9 firewall is the whole design constraint, not a footnote
// ---------------------------------------------------------------------
// `VACANCY_CONSOLIDATED_MASTER_SPEC.md` §9 permits demographic
// modelling and **forbids demographics determining morality,
// criminality, intelligence or worth.** Health data is the sharpest
// test of that rule in the registry, because prevalence estimates
// correlate with income and with ethnicity, and a model that let a
// neighbourhood's health rate reach a person's traits would be
// laundering exactly the inference §9 forbids.
//
// So this importer, like `censusImport`, produces **prevalence shares
// for a PLACE and never an attribute of a person.** It sets
// `containsIndividualAttributes: false` and the test asserts it. A
// consumer may raise a place's baseline mortality; nothing here gives
// anything a per-person health fact it did not already generate.
//
// NETWORK CONSTRAINT, checked directly: `data.cdc.gov` is outside this
// environment's outbound proxy allowlist (403 CONNECT). `fetchPlaces`
// throws with that reason; the transform is the tested part.

'use strict';

const { setLocationData, getLocation } = require('../locations');

//: PLACES measure ids → what they mean to this engine. **Only the
//: measures that reach a mechanism.** PLACES publishes around forty and
//: this maps eleven; mapping all of them would produce a rich object
//: nothing reads, which is the eleventh standing rule in data form.
//:
//: `weight` is how much a measure contributes to a place's baseline
//: mortality pressure relative to the others. **Chronic conditions
//: weigh more than behaviours** because the engine's own
//: `mortality.healthMultiplier` already reads a `Chronic Conditions`
//: trait and treats it as the dominant term; this keeps the imported
//: side agreeing with the generated side rather than inventing a second
//: opinion.
const MEASURES = {
  CHD: { label: 'coronary heart disease', kind: 'chronic', weight: 1 },
  STROKE: { label: 'stroke', kind: 'chronic', weight: 1 },
  CANCER: { label: 'cancer (non-skin)', kind: 'chronic', weight: 1 },
  COPD: { label: 'COPD', kind: 'chronic', weight: 1 },
  DIABETES: { label: 'diagnosed diabetes', kind: 'chronic', weight: 1 },
  KIDNEY: { label: 'chronic kidney disease', kind: 'chronic', weight: 1 },
  CASTHMA: { label: 'current asthma', kind: 'chronic', weight: 0.5 },
  BPHIGH: { label: 'high blood pressure', kind: 'chronic', weight: 0.5 },
  CSMOKING: { label: 'current smoking', kind: 'behaviour', weight: 0.5 },
  OBESITY: { label: 'obesity', kind: 'behaviour', weight: 0.5 },
  // **Access, not illness**, and kept separate for that reason: a place
  // where people cannot see a doctor is not a place where people are
  // sicker, it is a place where illness goes further.
  ACCESS2: { label: 'no health insurance', kind: 'access', weight: 0 },
  CHECKUP: { label: 'routine checkup in the past year', kind: 'access', weight: 0 },
};

const MEASURE_IDS = Object.keys(MEASURES);

//: The prevalence at which a place's chronic-illness burden is
//: considered ordinary. **Flagged interpretive, and deliberately a
//: CENTRE rather than a ceiling** — CLAUDE.md's twelfth rule, first
//: clause: a multiplier centred on zero recalibrates the world, so an
//: average place has to come out at exactly 1 and only unusual places
//: move.
//:
//: 10% is the rough order of U.S. tract-level prevalence for the
//: chronic measures above taken singly. It is a reference point, not a
//: claim about any particular place, and a caller with real national
//: figures should pass its own.
const ORDINARY_CHRONIC_PREVALENCE = 10;

//: How far a place's pressure may move from ordinary. Bounded because
//: an unbounded multiplier on mortality is a way to empty a world by
//: arithmetic, and because PLACES prevalence is an estimate with its
//: own confidence interval.
const PRESSURE_BOUNDS = [0.75, 1.5];

function measureFor(id) {
  return MEASURES[id] ?? null;
}

function clamp(value, low, high) {
  return Math.min(high, Math.max(low, value));
}

// Turn tract prevalences into a baseline mortality pressure for a place.
//
// `prevalences` is `{ <measure id>: <percent> }` as PLACES publishes
// them. Returns a multiplier centred on 1 for an ordinary place, the
// measures that produced it, and the ones that were ignored.
//
// **An ordinary place returns exactly 1.** The test holds that, because
// it is the difference between a health model and a world-wide
// recalibration nobody asked for.
function toHealthPressure(prevalences = {}, options = {}) {
  const { ordinary = ORDINARY_CHRONIC_PREVALENCE } = options;

  let weighted = 0;
  let weight = 0;
  const used = [];
  const ignored = [];

  for (const [id, value] of Object.entries(prevalences)) {
    const measure = measureFor(id);
    // **`Number(null)` is 0 and 0 is finite**, so testing the raw value
    // has to come first. PLACES suppresses an estimate it cannot model
    // reliably, and the first version of this read a suppressed
    // measure as a place with none of that condition — dragging the
    // mean down and reporting an unmeasured neighbourhood as unusually
    // healthy. Caught by its own test.
    const missing = value === null || value === undefined || value === '';
    const percent = missing ? NaN : Number(value);
    if (!measure) {
      ignored.push({ measure: id, reason: 'not a measure this importer maps' });
      continue;
    }
    if (!Number.isFinite(percent)) {
      // PLACES suppresses an estimate where the model is not reliable.
      // Unknown is not zero — a suppressed measure must not read as a
      // place with none of that condition.
      ignored.push({ measure: id, reason: 'suppressed or unparseable' });
      continue;
    }
    if (measure.weight === 0) {
      ignored.push({ measure: id, reason: `${measure.kind} — carried, but not a mortality term` });
      continue;
    }
    weighted += percent * measure.weight;
    weight += measure.weight;
    used.push({ measure: id, label: measure.label, percent });
  }

  if (weight === 0) {
    // **Null, not 1.** A place with no usable measure has no known
    // health baseline, and returning the ordinary multiplier would say
    // it had been measured and found average.
    return { pressure: null, used, ignored, meanPrevalence: null };
  }

  const meanPrevalence = weighted / weight;
  return {
    pressure: Math.round(clamp(meanPrevalence / ordinary, ...PRESSURE_BOUNDS) * 1000) / 1000,
    meanPrevalence: Math.round(meanPrevalence * 100) / 100,
    used,
    ignored,
  };
}

// Attach a tract's health profile to a location.
function importPlacesTract(worldLayer, locationId, record = {}) {
  const location = getLocation(worldLayer, locationId);
  if (!location) throw new Error(`importPlacesTract: no location with id ${locationId}`);
  if (!record.tractId) {
    throw new Error(
      'importPlacesTract requires record.tractId — an unattributed prevalence estimate '
      + 'cannot be checked against the published table.',
    );
  }

  const health = toHealthPressure(record.prevalences ?? {});
  const access = {};
  for (const [id, value] of Object.entries(record.prevalences ?? {})) {
    const measure = measureFor(id);
    if (measure?.kind === 'access' && Number.isFinite(Number(value))) {
      access[id] = Number(value);
    }
  }

  const existing = location.populationData ?? {};
  setLocationData(worldLayer, locationId, 'populationData', {
    ...existing,
    healthPrevalence: {
      source: 'cdc-places',
      licence: 'public-domain',
      tractId: record.tractId,
      year: record.year ?? null,
      // The multiplier a mortality model could read, centred on 1.
      baselinePressure: health.pressure,
      meanChronicPrevalence: health.meanPrevalence,
      measures: health.used,
      ignoredMeasures: health.ignored,
      // Carried separately because it is not illness. See the note on
      // ACCESS2 above.
      access,
    },
    // §9. This is a share for a place; there is no per-person health
    // fact anywhere in it, and the test asserts so.
    containsIndividualAttributes: false,
  });
  return location;
}

function describeHealthCoverage(worldLayer) {
  const pressures = [];
  let places = 0;
  let unmeasured = 0;
  for (const location of worldLayer.locations || []) {
    const health = location.populationData?.healthPrevalence;
    if (health?.source !== 'cdc-places') continue;
    places += 1;
    if (health.baselinePressure === null) unmeasured += 1;
    else pressures.push(health.baselinePressure);
  }
  pressures.sort((a, b) => a - b);
  return {
    places,
    // **A place with every measure suppressed is counted here, not
    // averaged in at 1.** Otherwise the coverage figure would rise
    // while the information fell.
    unmeasured,
    lowest: pressures[0] ?? null,
    median: pressures.length ? pressures[Math.floor(pressures.length / 2)] : null,
    highest: pressures[pressures.length - 1] ?? null,
    measuresMapped: MEASURE_IDS.length,
  };
}

function fetchPlaces() {
  throw new Error(
    'fetchPlaces is not implemented: data.cdc.gov is outside this environment\'s outbound '
    + 'proxy allowlist (403 CONNECT, checked directly). PLACES is published on the CDC open '
    + 'data portal as a Socrata dataset — a CSV download per release, or the SODA API with '
    + 'no key for modest volumes. Pass { tractId, year, prevalences: { MEASURE: percent } } '
    + `to importPlacesTract(worldLayer, locationId, record). Mapped measures: ${MEASURE_IDS.join(', ')}.`,
  );
}

module.exports = {
  MEASURES,
  MEASURE_IDS,
  ORDINARY_CHRONIC_PREVALENCE,
  PRESSURE_BOUNDS,
  measureFor,
  toHealthPressure,
  importPlacesTract,
  describeHealthCoverage,
  fetchPlaces,
};
