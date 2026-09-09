// VDP / VACANCY -- backdrop simulation, and the trigger that decides
// where human artists are worth spending on next.
//
// Per `vdp/VDP_DESIGNER_AND_VACANCY_GLOBAL_COST.md`: "the world's
// population and economy can genuinely grow everywhere from day one,
// while the expensive, human-artist visual build-out only happens
// where the simulation itself shows real, organic demand."
//
// **The separation this module exists to enforce.** Simulation and
// visual environment are two layers. An area with no hand-built art is
// still a real place with a real population and a real economy -- it
// simply renders as Cesium backdrop. `isVisuallyPlayable` therefore
// changes *nothing* about how the simulation runs, and there is a test
// asserting exactly that, because the moment backdrop areas simulate
// differently the trigger below is measuring the wrong thing.
//
// **Why `realGrowthSignal` is derived and not settable.** It decides
// where $3,000-$5,000 of environment art gets spent (the document's own
// figure). A field anyone can assign is a field anyone can use to
// justify a spend -- so growth is computed from observed deltas across
// recorded samples, and an area with no history has no signal rather
// than a default one. This is the same shape as `isTableOpen` in
// `venusResort.js` being derived from a dealer standing there: a stored
// flag and the underlying facts can disagree, and then the flag wins
// for the wrong reason.
//
// **What this module does not do.** It does not commission anything,
// spend anything, or promote an area by itself. It reports that a
// threshold was crossed and what that would cost. The decision to fund
// a city stays with a person -- the document is explicit that this is
// "funded by real, proven revenue as the game grows," and an automatic
// trigger that spent money would be exactly the wrong reading of it.

export class ExpansionError extends Error {}

// The document's own per-city figure for bringing an area to the same
// human-refined playable standard as the St. Louis launch districts.
export const COST_PER_CITY_LOW = 3000;
export const COST_PER_CITY_HIGH = 5000;

// How many samples before growth means anything. Two points are a line
// through noise; a trigger that fires on the first tick would fire
// everywhere at once on day one.
export const MIN_SAMPLES = 4;

// Defaults, overridable per call. Named rather than buried, per the
// repo's "any value inferred rather than specified is a named,
// overridable constant" convention -- none of these came from data yet.
export const DEFAULT_THRESHOLDS = {
  minPopulation: 25000,
  minEconomicActivity: 0.55,
  minGrowthSignal: 0.08,
};

function requireString(value, field, action) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ExpansionError(`${action} requires a non-empty ${field}`);
  }
  return value.trim();
}

function requireFinite(value, field, action) {
  if (!Number.isFinite(value)) {
    throw new ExpansionError(`${action}: ${field} must be a finite number, got ${value}`);
  }
  return value;
}

export function createArea(options = {}) {
  const a = 'createArea';
  const {
    areaId,
    isVisuallyPlayable = false,
    simulatedPopulation = 0,
    economicActivityLevel = 0,
  } = options;

  if (typeof isVisuallyPlayable !== 'boolean') {
    throw new ExpansionError(`${a}: isVisuallyPlayable must be a boolean`);
  }
  requireFinite(simulatedPopulation, 'simulatedPopulation', a);
  requireFinite(economicActivityLevel, 'economicActivityLevel', a);
  if (simulatedPopulation < 0) throw new ExpansionError(`${a}: simulatedPopulation cannot be negative`);
  if (economicActivityLevel < 0 || economicActivityLevel > 1) {
    throw new ExpansionError(`${a}: economicActivityLevel is a 0-1 ratio, got ${economicActivityLevel}`);
  }

  return {
    areaId: requireString(areaId, 'areaId', a),
    isVisuallyPlayable,
    simulatedPopulation,
    economicActivityLevel,
    // Observed history. `realGrowthSignal` is read off this, never
    // written -- see the header.
    samples: [],
  };
}

// One observation. The simulation runs identically whether or not an
// artist has ever touched the area -- that is the whole design, and
// `isVisuallyPlayable` is deliberately not consulted here.
export function recordSample(area, options = {}) {
  const a = 'recordSample';
  const { simulatedPopulation, economicActivityLevel, at = Date.now() } = options;

  requireFinite(simulatedPopulation, 'simulatedPopulation', a);
  requireFinite(economicActivityLevel, 'economicActivityLevel', a);
  if (simulatedPopulation < 0) throw new ExpansionError(`${a}: simulatedPopulation cannot be negative`);
  if (economicActivityLevel < 0 || economicActivityLevel > 1) {
    throw new ExpansionError(`${a}: economicActivityLevel is a 0-1 ratio, got ${economicActivityLevel}`);
  }

  area.simulatedPopulation = simulatedPopulation;
  area.economicActivityLevel = economicActivityLevel;
  area.samples.push({ simulatedPopulation, economicActivityLevel, at });
  return area;
}

// Growth per sample across the recorded window, as a ratio. Derived on
// every read so it cannot go stale, and `null` -- not zero -- when
// there is not enough history, because "no signal" and "no growth" are
// different facts and only one of them is a reason to decline.
export function realGrowthSignal(area) {
  if (area.samples.length < MIN_SAMPLES) return null;
  const first = area.samples[0];
  const last = area.samples[area.samples.length - 1];
  if (first.simulatedPopulation <= 0) return null;   // no baseline to grow from
  const total = (last.simulatedPopulation - first.simulatedPopulation) / first.simulatedPopulation;
  return total / (area.samples.length - 1);
}

export function expansionCostEstimate(cityCount) {
  const a = 'expansionCostEstimate';
  if (!Number.isInteger(cityCount) || cityCount < 0) {
    throw new ExpansionError(`${a}: cityCount must be a non-negative integer`);
  }
  return { cities: cityCount, low: cityCount * COST_PER_CITY_LOW, high: cityCount * COST_PER_CITY_HIGH };
}

// The trigger. Returns a verdict with a reason either way -- "why is
// this city not being built" is the question the World/Level Designer
// role in the source document will actually be asking.
export function evaluateExpansion(area, options = {}) {
  const thresholds = { ...DEFAULT_THRESHOLDS, ...(options.thresholds || {}) };

  // An area that already has hand-built art is not an expansion
  // candidate. Without this the trigger would keep recommending spend
  // on the places that already had it -- they are, by construction,
  // the ones with the most activity.
  if (area.isVisuallyPlayable) {
    return { warranted: false, reason: 'already visually playable — nothing to expand', signal: realGrowthSignal(area) };
  }

  const signal = realGrowthSignal(area);
  if (signal === null) {
    return {
      warranted: false,
      signal: null,
      reason: `not enough observed history yet (${area.samples.length}/${MIN_SAMPLES} samples) — `
        + 'no signal is not the same as no growth',
    };
  }

  const failures = [];
  if (area.simulatedPopulation < thresholds.minPopulation) {
    failures.push(`population ${Math.round(area.simulatedPopulation)} < ${thresholds.minPopulation}`);
  }
  if (area.economicActivityLevel < thresholds.minEconomicActivity) {
    failures.push(`economic activity ${area.economicActivityLevel.toFixed(2)} < ${thresholds.minEconomicActivity}`);
  }
  if (signal < thresholds.minGrowthSignal) {
    failures.push(`growth ${signal.toFixed(3)} < ${thresholds.minGrowthSignal}`);
  }

  if (failures.length > 0) {
    return { warranted: false, signal, reason: failures.join('; ') };
  }

  return {
    warranted: true,
    signal,
    reason: `population ${Math.round(area.simulatedPopulation)}, activity `
      + `${area.economicActivityLevel.toFixed(2)}, growth ${signal.toFixed(3)} — all thresholds met`,
    // Reported, never spent. See the header.
    estimatedCost: expansionCostEstimate(1),
  };
}

// Ranked candidates, so a designer picks the next city from measured
// demand rather than from whichever area someone mentioned last.
export function expansionQueue(areas, options = {}) {
  return areas
    .map((area) => ({ area, verdict: evaluateExpansion(area, options) }))
    .filter((row) => row.verdict.warranted)
    .sort((x, y) => y.verdict.signal - x.verdict.signal)
    .map((row, i) => ({
      rank: i + 1,
      areaId: row.area.areaId,
      signal: row.verdict.signal,
      population: row.area.simulatedPopulation,
      estimatedCost: row.verdict.estimatedCost,
    }));
}

export function describeArea(area) {
  const verdict = evaluateExpansion(area);
  return {
    areaId: area.areaId,
    tier: area.isVisuallyPlayable ? 'playable' : 'backdrop',
    population: area.simulatedPopulation,
    economicActivityLevel: area.economicActivityLevel,
    growthSignal: verdict.signal,
    expansionWarranted: verdict.warranted,
    reason: verdict.reason,
  };
}
