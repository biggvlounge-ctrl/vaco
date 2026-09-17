// server/environment.js
//
// The weather, and where a drought actually lives.
//
// **`environment_state` was a schema-only table** and the comments
// around it were unusually honest about what that cost. `tick.js`'s
// header on the condition mechanism:
//
//   "Not a schema table (environment_state is city-scoped and City
//    isn't built) — a minimal, real, in-memory mechanism"
//
// City IS built now, and `worldState.activeConditions` is still a flat
// global list with no table behind it. `migrate.js` says so in its own
// list of what a checkpoint does not carry. That is a real durability
// hole rather than a cosmetic one: **a world checkpointed in the middle
// of a drought comes back with the drought gone**, the resources still
// depressed, and nothing to say why.
//
// ---------------------------------------------------------------------
// What this does and does not close
//
// It gives every city a row: what the weather is doing, what climate it
// is doing it in, and which disasters are currently running there —
// `active_disasters` is JSONB and that is exactly what a list of live
// conditions is. So a drought survives a checkpoint.
//
// **It does not close `pollution`.** That statistic is declared
// unavailable on the grounds that "`environment_state` is a schema-only
// table with weather, climate and disasters and no pollution column;
// `cities` has none either. Nothing emits." Building the table answers
// the first clause and none of the others — there is still no column
// and still nothing emitting — so the declaration stands. Closing it by
// deriving pollution from, say, infrastructure condition would be
// inventing a measurement and calling a gap fixed.
//
// ---------------------------------------------------------------------
// Weather turns; climate does not
//
// The distinction is the whole reason the schema has both columns.
// Climate is a property of a place, set when the city is built and
// never changed by this module. Weather is what that climate is doing
// today, and it is the only thing here that moves.
//
// Severe weather does not get its own effect channel. It produces the
// same `activeConditions` entry a drought or an epidemic does, so
// everything that already reads conditions — resource supply in
// `runEnvironmentPhase`, mortality's disease pressure — picks it up
// with no new coupling. A second mechanism doing the same job in
// parallel is how two systems come to disagree.

'use strict';

const { seededDraw } = require('./seeded.js');

// ---------------------------------------------------------------------
// The vocabularies
// ---------------------------------------------------------------------

//: What the weather can be doing. **Flagged interpretive**:
//: `environment_state.weather` is a bare TEXT column with no comment
//: and no enumeration anywhere in the package, unlike
//: `migration_events.migration_type` which the schema enumerates
//: itself.
//:
//: Kept to states that mean something to a system this engine already
//: has — each one either does nothing or produces a condition that
//: moves resources. A vocabulary of twenty weathers that all do nothing
//: would be set dressing.
const WEATHER = ['clear', 'rain', 'storm', 'drought', 'freeze', 'heat'];

//: The climates a city can be in, and which weather each tends toward.
//: Also interpretive, for the same reason.
//:
//: The weights are what make climate matter: a city in `arid` weather
//: sees drought often and freeze never, and that is the entire content
//: of the distinction. A climate that drew uniformly would be a stored
//: string nothing reads.
//: **Weighted so severe weather is roughly one spell in five.** The
//: first version made it three in five, which measured as nine severe
//: spells in 120 ticks for one city — a settlement in drought, freeze
//: or storm more often than not. That is not a harsher world, it is a
//: broken one: every severe spell moves a survival resource, so the
//: knock-on was nine genuine scarcity crossings and ninety fear spikes
//: in the same window, and the regression guard for event-log noise
//: caught it.
//:
//: Each climate keeps its character in WHICH severe weather it gets,
//: not in how much: arid droughts and bakes, continental freezes,
//: coastal storms. That is the whole content of the distinction.
const CLIMATES = {
  temperate: { clear: 10, rain: 6, storm: 2, drought: 1, freeze: 1, heat: 0 },
  arid: { clear: 12, rain: 2, storm: 0, drought: 3, freeze: 0, heat: 3 },
  coastal: { clear: 9, rain: 8, storm: 2, drought: 0, freeze: 1, heat: 0 },
  continental: { clear: 10, rain: 5, storm: 1, drought: 0, freeze: 3, heat: 1 },
};

const CLIMATE_NAMES = Object.keys(CLIMATES);

//: Which weathers are severe enough to do something, and what they do
//: to which resource. The deltas are per tick while the condition runs,
//: and they are the SAME shape `mortality.addDiseaseOutbreak` and the
//: drought scenario already use — see the header on why there is no
//: second channel.
//:
//: `conditionType` is `weather` so `diseasePressure` ignores these:
//: that function reads `mortalityMultiplier`, which none of these
//: carry, so a storm does not silently start killing people.
//: Durations are shorter than the first version's too, and for the
//: same reason: a 30-tick drought drawn every fifth 7-tick spell leaves
//: a city in drought most of the time, which compounds the weighting
//: error rather than being independent of it.
const SEVERE = {
  drought: { resourceType: 'water', supplyDelta: -3, demandDelta: 2, ticks: 14 },
  heat: { resourceType: 'water', supplyDelta: -2, demandDelta: 3, ticks: 7 },
  freeze: { resourceType: 'food', supplyDelta: -3, demandDelta: 1, ticks: 10 },
  storm: { resourceType: 'food', supplyDelta: -2, demandDelta: 0, ticks: 4 },
};

//: How long a spell of weather lasts before it is redrawn. Flagged
//: interpretive. A tick is a day, so a week is long enough that the
//: weather is not noise and short enough that a season is not a
//: lifetime.
//:
//: **Redrawn on a crossing, not every tick** — the seventh standing
//: rule. Weather that changed daily would put an event in the log every
//: tick for every city forever, which is exactly the failure the
//: scarcity broadcast had.
const SPELL_TICKS = 7;

// ---------------------------------------------------------------------
// State
// ---------------------------------------------------------------------

function stateOf(worldState, cityId) {
  return (worldState.environmentState || []).find((e) => e.city_id === cityId) ?? null;
}

// One row per city, which is what the `city_id PRIMARY KEY` asks for.
//
// `climate` is set here and never changed by this module — it is a
// property of the place. A caller may pass one; otherwise it is drawn
// from the seed so the same world always has the same climate.
function generateEnvironmentState(worldState, options = {}) {
  const {
    cityId, climate = null, weather = null, seed = worldState.seed ?? 'environment',
    tick = worldState.tick ?? 0,
  } = options;

  if (cityId === undefined || cityId === null) {
    throw new Error('environment.generateEnvironmentState requires a cityId (environment_state.city_id is the primary key)');
  }
  if (climate !== null && !CLIMATE_NAMES.includes(climate)) {
    throw new Error(
      `environment: "${climate}" is not a climate (one of: ${CLIMATE_NAMES.join(', ')})`,
    );
  }
  const existing = stateOf(worldState, cityId);
  if (existing) return existing;

  // **`seededDraw` takes ONE array of parts**, not variadic arguments.
  // Calling it `seededDraw(CLIMATE_NAMES, seed, ...)` passes the
  // climate list as the parts and silently ignores the rest.
  const chosen = climate
    ?? CLIMATE_NAMES[Math.floor(seededDraw([seed, 'climate', cityId]) * CLIMATE_NAMES.length)];
  const row = {
    city_id: cityId,
    climate: chosen,
    weather: weather ?? drawWeather(chosen, seed, cityId, tick),
    // JSONB. The live conditions affecting THIS city — which is what
    // gives a drought somewhere to live across a checkpoint.
    active_disasters: [],
    tick,
    // Not a schema column: when the current spell started, so the next
    // redraw is a crossing rather than a per-tick coin flip.
    spell_started_tick: tick,
  };
  (worldState.environmentState || (worldState.environmentState = [])).push(row);
  return row;
}

// Weather drawn against the climate's own weights.
function drawWeather(climate, seed, cityId, tick) {
  const weights = CLIMATES[climate] ?? CLIMATES.temperate;
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  if (total <= 0) return 'clear';

  // **`seededUnit` takes a NUMBER, not the parts of a draw.** Calling
  // it `seededUnit(seed, 'weather', cityId, tick)` passes a string as
  // the seed, `'environment' || 1` keeps the string, the bitwise
  // operations coerce it to 0, and the function returns 0 — every
  // draw, forever. Measured: 200 ticks, three cities, every one of them
  // `clear` the entire time and not a single weather event.
  //
  // Standing rule 6's exact shape in a new place: a call that reads a
  // thing that is not there returns the same plausible value forever
  // and nothing throws. `seededDraw` is the one that takes parts, and
  // it takes them as ONE array.
  let roll = seededDraw([seed, 'weather', cityId, tick]) * total;
  for (const [weather, weight] of Object.entries(weights)) {
    roll -= weight;
    if (roll <= 0) return weather;
  }
  return 'clear';
}

// ---------------------------------------------------------------------
// The pass
// ---------------------------------------------------------------------

// One tick of weather.
//
// Returns events. A spell turning is worth one event per city per week,
// which is a rate a log can carry; a severe spell starting is worth
// saying louder.
function runEnvironment(worldState, options = {}) {
  const {
    tick = worldState.tick ?? 0, seed = worldState.seed ?? 'environment',
  } = options;
  const events = [];

  for (const city of worldState.cities || []) {
    const state = stateOf(worldState, city.id) ?? generateEnvironmentState(worldState, {
      cityId: city.id, seed, tick,
    });

    // Keep `active_disasters` true to what is actually running. Read
    // from `activeConditions` rather than maintained separately, so the
    // two cannot drift — the column is a durable VIEW of the live list,
    // which is what makes a checkpoint carry it.
    state.active_disasters = (worldState.activeConditions || [])
      .filter((c) => c.cityId === undefined || c.cityId === null || c.cityId === city.id)
      .map((c) => ({
        conditionType: c.conditionType ?? 'condition',
        name: c.name ?? null,
        ticksRemaining: c.ticksRemaining ?? null,
        startedTick: c.startedTick ?? null,
      }));
    state.tick = tick;

    // **A crossing.** The spell runs its length before anything is
    // redrawn, so this produces one event a week per city rather than
    // one a tick.
    if (tick - (state.spell_started_tick ?? 0) < SPELL_TICKS) continue;

    const previous = state.weather;
    state.weather = drawWeather(state.climate, seed, city.id, tick);
    state.spell_started_tick = tick;
    if (state.weather === previous) continue;

    const severe = SEVERE[state.weather];
    if (severe) {
      // The same condition shape a drought or an epidemic uses, so
      // `runEnvironmentPhase` ages it and resources move — no second
      // effect channel. See the header.
      (worldState.activeConditions || (worldState.activeConditions = [])).push({
        conditionType: 'weather',
        name: state.weather,
        resourceType: severe.resourceType,
        supplyDelta: severe.supplyDelta,
        demandDelta: severe.demandDelta,
        ticksRemaining: severe.ticks,
        cityId: city.id,
        communityId: null,
        startedTick: tick,
      });
    }

    events.push({
      type: severe ? 'severe_weather' : 'weather_change',
      severity: severe ? 'moderate' : 'low',
      note: `city ${city.id}: ${previous} turned to ${state.weather}`,
      tick,
      affected_entity_ids: [],
      global_effects: {
        cityId: city.id, from: previous, to: state.weather, climate: state.climate,
      },
    });
  }

  return events;
}

// ---------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------

function describeEnvironment(worldState, cityId) {
  const state = stateOf(worldState, cityId);
  if (!state) return null;
  return {
    cityId,
    climate: state.climate,
    weather: state.weather,
    severe: Boolean(SEVERE[state.weather]),
    running: state.active_disasters.map((d) => d.name ?? d.conditionType),
    tick: state.tick,
  };
}

// How harsh a city's weather currently is, 0..1. Null when the city has
// no environment state — unknown is not mild.
function harshnessIn(worldState, cityId) {
  const state = stateOf(worldState, cityId);
  if (!state) return null;
  return SEVERE[state.weather] ? 1 : 0;
}

module.exports = {
  WEATHER,
  CLIMATES,
  CLIMATE_NAMES,
  SEVERE,
  SPELL_TICKS,
  stateOf,
  generateEnvironmentState,
  drawWeather,
  runEnvironment,
  describeEnvironment,
  harshnessIn,
};
