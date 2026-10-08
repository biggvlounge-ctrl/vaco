// The weather, and where a drought actually lives.
//
// `environment_state` was a schema-only table, and the comments around
// it were unusually honest about what that cost. `tick.js` on the
// condition mechanism: "Not a schema table (environment_state is
// city-scoped and City isn't built) — a minimal, real, in-memory
// mechanism". City is built now, and `activeConditions` was still a
// flat global list with no table behind it — so **a world checkpointed
// mid-drought came back with the drought gone and the resources still
// depressed**, which is a durability hole rather than a cosmetic one.
//
// **One defect worth the whole file.** `seededUnit` takes a NUMBER; I
// called it `seededUnit(seed, 'weather', cityId, tick)`. The string
// seed survived `seed || 1`, the bitwise operations coerced it to 0,
// and the function returned 0 — every draw, forever. Measured: 200
// ticks, three cities, every one of them `clear` the entire time and
// not one weather event. Nothing threw. That is standing rule 6 in a
// new place: a call that reads something not there returns the same
// plausible value for the life of the project, and only a measurement
// of a running world finds it.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const environment = require('../server/environment.js');
const engine = require('../server/engine.js');
const worldgen = require('../server/worldgen.js');

function world(extra = {}) {
  return {
    tick: 0, cities: [{ id: 1 }], environmentState: [], activeConditions: [],
    resources: [], properties: [], ...extra,
  };
}

// -- the vocabularies -----------------------------------------------------

test('every climate leans somewhere, and every lean is a real weather', () => {
  // A climate that drew uniformly would be a stored string nothing
  // reads — the distinction between climate and weather is the whole
  // reason the schema has both columns.
  for (const [climate, weights] of Object.entries(environment.CLIMATES)) {
    for (const weather of Object.keys(weights)) {
      assert.ok(environment.WEATHER.includes(weather),
        `${climate} leans toward "${weather}", which is not a weather`);
    }
    const values = Object.values(weights);
    assert.ok(new Set(values).size > 1, `${climate} weights everything equally`);
    assert.ok(values.reduce((a, b) => a + b, 0) > 0, `${climate} can draw nothing`);
  }
});

test('every severe weather names a real effect, and none of them kills', () => {
  for (const [weather, effect] of Object.entries(environment.SEVERE)) {
    assert.ok(environment.WEATHER.includes(weather), `"${weather}" is not a weather`);
    assert.ok(effect.resourceType, `${weather} is severe and affects nothing`);
    assert.ok(effect.ticks > 0);
    // `diseasePressure` reads `mortalityMultiplier`. A storm that
    // carried one would silently start killing people.
    assert.equal(effect.mortalityMultiplier, undefined,
      `${weather} carries a mortalityMultiplier and would be read as an epidemic`);
  }
});

// -- the defect, pinned ---------------------------------------------------

test('a draw actually varies with the tick', () => {
  // **The bug.** `seededUnit(seed, 'weather', cityId, tick)` returned 0
  // for every input, so the first weather in the list came back every
  // time and the sky never changed.
  const draws = new Set(
    [0, 7, 14, 21, 28, 35, 42, 49, 56, 63].map(
      (t) => environment.drawWeather('continental', 'wx', 1, t),
    ),
  );
  assert.ok(draws.size > 1,
    `every draw returned "${[...draws][0]}" — the seeded call is reading nothing`);
});

test('the same seed and tick always draw the same weather', () => {
  // §88. The other half: varying is not enough, it has to be
  // reproducible.
  for (const tick of [0, 13, 99]) {
    assert.equal(
      environment.drawWeather('arid', 'wx', 1, tick),
      environment.drawWeather('arid', 'wx', 1, tick),
    );
  }
  assert.notEqual(
    environment.drawWeather('arid', 'wx', 1, 5),
    environment.drawWeather('arid', 'wx', 2, 5),
    'two cities in the same climate have identical weather on the same day',
  );
});

test('climate decides what a city tends to get', () => {
  // Arid never freezes — its weight is 0 — and sees drought often.
  const arid = [];
  for (let t = 0; t < 400; t += 1) arid.push(environment.drawWeather('arid', 'wx', 1, t));
  assert.equal(arid.includes('freeze'), false, 'an arid city froze');
  assert.ok(arid.filter((w) => w === 'drought').length > 20, 'an arid city never had a drought');
});

// -- climate now reads a real geographic fact -----------------------------

test('climate is deterministic in latitude, seed and city', () => {
  for (const lat of [0, 20, 45, 65]) {
    assert.equal(
      environment.climateForLatitude(lat, 'wx', 1),
      environment.climateForLatitude(lat, 'wx', 1),
    );
  }
  // Different cities at the SAME latitude are not forced identical —
  // the band weights, it does not dictate.
  const atOneLatitude = new Set(
    Array.from({ length: 30 }, (_, c) => environment.climateForLatitude(20, 'wx', c)),
  );
  assert.ok(atOneLatitude.size > 1,
    'every city at the same latitude drew the exact same climate — the band is not weighting, it is deciding');
});

test('a polar city never reads as arid, and an equatorial city never reads as continental', () => {
  // The two hard zeros `LATITUDE_BANDS` sets, measured over many
  // independent draws rather than trusted from one — §23's own lesson,
  // applied here: assert the DISTRIBUTION, not a single lucky draw.
  const farNorth = Array.from({ length: 200 }, (_, c) => environment.climateForLatitude(68, 'wx', c));
  assert.equal(farNorth.includes('arid'), false, 'a city at 68° latitude drew arid');
  assert.ok(farNorth.filter((c) => c === 'continental').length > farNorth.length / 2,
    'a city beyond the cold belt is not mostly continental');

  const equator = Array.from({ length: 200 }, (_, c) => environment.climateForLatitude(2, 'wx', c));
  assert.equal(equator.includes('continental'), false, 'a city at 2° latitude drew continental');

  const desertBelt = Array.from({ length: 200 }, (_, c) => environment.climateForLatitude(22, 'wx', c));
  assert.equal(desertBelt.includes('continental'), false, 'a city at 22° latitude drew continental');
  assert.ok(desertBelt.filter((c) => c === 'arid').length > desertBelt.length / 2,
    'a city in the subtropical desert belt is not mostly arid');
});

test('latitude is read from the sign, not assumed positive', () => {
  // The southern hemisphere is exactly as real as the northern one.
  const south = Array.from({ length: 200 }, (_, c) => environment.climateForLatitude(-68, 'wx', c));
  assert.equal(south.includes('arid'), false, 'a city at -68° latitude drew arid');
  assert.ok(south.filter((c) => c === 'continental').length > south.length / 2);
});

// -- state ---------------------------------------------------------------

test('one row per city, and generating twice does not make two', () => {
  const w = world();
  const first = environment.generateEnvironmentState(w, { cityId: 1, climate: 'coastal' });
  const second = environment.generateEnvironmentState(w, { cityId: 1 });
  assert.equal(w.environmentState.length, 1);
  assert.equal(first, second);
  assert.equal(first.climate, 'coastal');
});

test('a city is required, and an invented climate is refused', () => {
  const w = world();
  assert.throws(() => environment.generateEnvironmentState(w, {}), /requires a cityId/);
  assert.throws(() => environment.generateEnvironmentState(w, { cityId: 1, climate: 'balmy' }),
    /is not a climate/);
});

test('climate does not change, however long the world runs', () => {
  const w = world();
  const state = environment.generateEnvironmentState(w, { cityId: 1, climate: 'arid', tick: 0 });
  for (let t = 1; t < 300; t += 1) {
    w.tick = t;
    environment.runEnvironment(w, { tick: t, seed: 'wx' });
  }
  assert.equal(state.climate, 'arid', 'the climate of a place moved');
});

// -- crossings ------------------------------------------------------------

test('weather turns on a spell, not every tick', () => {
  // **Standing rule 7.** Weather redrawn daily would put an event in
  // the log every tick for every city forever — the scarcity
  // broadcast's failure exactly.
  const w = world();
  environment.generateEnvironmentState(w, { cityId: 1, climate: 'continental', tick: 0 });

  let events = 0;
  for (let t = 1; t <= 70; t += 1) {
    w.tick = t;
    events += environment.runEnvironment(w, { tick: t, seed: 'wx' }).length;
  }
  // Ten spells in seventy ticks, and an event only when the weather
  // actually differs — so at most ten.
  assert.ok(events <= 10, `${events} weather events in 70 ticks for one city`);
  assert.ok(events > 0, 'the weather never changed at all in ten weeks');
});

// -- effects go through the existing channel ------------------------------

test('severe weather produces an ordinary condition, not a second mechanism', () => {
  // A parallel effect channel is how two systems come to disagree.
  // Everything that reads `activeConditions` picks this up for free.
  const w = world();
  environment.generateEnvironmentState(w, { cityId: 1, climate: 'arid', tick: 0 });

  for (let t = 1; t <= 400; t += 1) {
    w.tick = t;
    environment.runEnvironment(w, { tick: t, seed: 'wx' });
  }
  const fromWeather = w.activeConditions.filter((c) => c.conditionType === 'weather');
  assert.ok(fromWeather.length > 0, 'an arid city ran 400 ticks and produced no severe weather');
  for (const condition of fromWeather) {
    assert.ok(condition.resourceType, 'a weather condition affects no resource');
    assert.ok(condition.ticksRemaining > 0);
    assert.equal(condition.mortalityMultiplier, undefined);
    assert.equal(condition.cityId, 1, 'a city-scoped condition was recorded globally');
  }
});

test('what is running is recorded against the city, which is the durable half', () => {
  // `active_disasters` is a view of the live list, so the two cannot
  // drift — and a checkpoint carries it.
  const w = world();
  const state = environment.generateEnvironmentState(w, { cityId: 1, climate: 'temperate' });
  w.activeConditions.push({
    conditionType: 'disease', name: 'fever', ticksRemaining: 12, startedTick: 3, communityId: null,
  });

  w.tick = 10;
  environment.runEnvironment(w, { tick: 10, seed: 'wx' });

  assert.equal(state.active_disasters.length, 1);
  assert.equal(state.active_disasters[0].name, 'fever');
  assert.equal(state.active_disasters[0].conditionType, 'disease');
});

// -- what it does NOT close -----------------------------------------------

test('pollution stays a declared gap, because the column still does not exist', () => {
  // The declaration says "`environment_state` is a schema-only table
  // with weather, climate and disasters and no pollution column;
  // `cities` has none either. Nothing emits." Building the table
  // answers the first clause and neither of the others. Deriving
  // pollution from something else would be inventing a measurement and
  // calling a gap closed.
  const statistics = require('../server/statistics.js');
  const declared = new Set(statistics.unavailable().map((e) => e.key));
  assert.ok(declared.has('pollution'),
    'pollution was quietly marked answerable without a column to answer from');
});

// -- the real pipeline ----------------------------------------------------

test('a generated world has weather, and it changes', () => {
  const w = engine.WorldState;
  worldgen.generateWorld({
    cities: 3, communitiesPerCity: 2, populationPerCommunity: 12, seed: 'wx',
  });
  assert.equal(w.environmentState.length, 3, 'not every city has weather');

  const before = w.environmentState.map((e) => e.weather).join(',');
  for (let t = 0; t < 200; t += 1) engine.advanceTick();

  const weatherEvents = w.events.filter((e) => /weather/.test(e.type));
  assert.ok(weatherEvents.length > 0,
    'a world ran for 200 ticks across three cities and the sky never changed');

  // And not so many that the log is weather.
  assert.ok(weatherEvents.length < w.events.length / 2,
    `${weatherEvents.length} of ${w.events.length} events are weather`);

  for (const state of w.environmentState) {
    assert.ok(environment.WEATHER.includes(state.weather));
    assert.ok(environment.CLIMATE_NAMES.includes(state.climate));
    assert.ok(Array.isArray(state.active_disasters));
  }
  void before;
});

test('the world can describe its weather', () => {
  const w = engine.WorldState;
  const described = environment.describeEnvironment(w, w.cities[0].id);
  assert.equal(described.cityId, w.cities[0].id);
  assert.ok(environment.WEATHER.includes(described.weather));
  assert.equal(typeof described.severe, 'boolean');

  // Unknown is not mild.
  assert.equal(environment.describeEnvironment(w, 99999), null);
  assert.equal(environment.harshnessIn(w, 99999), null);
});

test('a generated world places cities across real latitudes, and their climate follows', () => {
  // The actual pipeline, not a fixture: `worldgen` now draws a city's
  // GLOBAL position (`geo.globalCityPosition`) before handing its
  // latitude to `climateForLatitude`. Last in the file on purpose: it
  // reads the shared `engine.WorldState` other tests above have
  // already grown, and nothing after this one depends on its count
  // staying small — the same ordering concern `geo.test.js`'s own
  // generated-world tests are built around.
  const w = engine.WorldState;
  const before = w.cities.length;
  worldgen.generateWorld({
    cities: 24, communitiesPerCity: 1, populationPerCommunity: 4, seed: 'climate-geo',
  });

  const rows = w.cities.slice(before).map((city) => ({
    lat: city.latitude,
    climate: w.environmentState.find((e) => e.city_id === city.id).climate,
  }));

  assert.ok(new Set(rows.map((r) => r.lat)).size > 12,
    'cities read as clustered at a handful of latitudes, not drawn independently');

  for (const row of rows) {
    const abs = Math.abs(row.lat);
    if (abs > 55) {
      assert.notEqual(row.climate, 'arid', `a city at ${row.lat}° latitude is arid`);
    }
    if (abs <= 35) {
      assert.notEqual(row.climate, 'continental', `a city at ${row.lat}° latitude is continental`);
    }
  }
});
