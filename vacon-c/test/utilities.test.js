// Utilities fail, are felt, and get repaired.
//
// **`infrastructure.failureRisk` was computed, crossed and consumed by
// nothing.** It had exactly two readers: one statistic, and an
// `infrastructure_at_risk` event that fires once when the risk crosses
// 0.5 and then never again. A grid at risk 0.95 behaved identically to
// one at 0.05 — the water kept running either way — and `funding` had
// no reader anywhere in the engine at all.
//
// So four of §7's forty were stuck on it. Energy `slot`, Waste `slot`,
// Fire & Emergency `slot`, Water `partial` on the strength of the
// resource rather than the pipes. `slot` is that file's own label for
// "storage exists and nothing reads it", and the reading all four
// lacked was the same one: failure.
//
// ---------------------------------------------------------------------
// The two things this file is really guarding
//
//   1. **An outage goes through the channel that already exists.**
//      `activeConditions` — city-scoped, temporary, and since 17 Sep it
//      gives back exactly what it took when it expires. A second effect
//      channel is how two systems come to disagree about the world.
//   2. **Repair exists, so this is not the fifth one-way ratchet.**
//      Resources had one (every world ended in famine), habits had one
//      (weekly routines could not form), buildings had one (every
//      building at condition 0 by tick 300), and conditions had one
//      (a drought never ended). That lesson is applied here before the
//      fact rather than after it.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const infrastructure = require('../server/infrastructure.js');
const mortality = require('../server/mortality.js');
const statistics = require('../server/statistics.js');
const tick = require('../server/tick.js');
const engine = require('../server/engine.js');
const worldgen = require('../server/worldgen.js');

function cityWorld() {
  return {
    tick: 0,
    cities: [{ id: 1 }],
    communities: [], npcs: [], entityTraits: [], properties: [],
    infrastructure: [], activeConditions: [], events: [],
    resources: [
      { id: 1, city_id: 1, resource_type: 'water', supply: 100, demand: 50 },
      { id: 2, city_id: 1, resource_type: 'energy', supply: 100, demand: 50 },
    ],
  };
}

// -- every outage effect names something that exists ----------------------

test('every outage effect reaches a mechanism the engine already has', () => {
  const items = require('../server/items.js');
  for (const [type, effect] of Object.entries(infrastructure.OUTAGE_EFFECTS)) {
    assert.ok(infrastructure.INFRASTRUCTURE_TYPES.includes(type),
      `"${type}" is not an infrastructure type`);

    if (effect.disease) {
      // `addDiseaseOutbreak` refuses a multiplier below 1 — "a disease
      // that lowers mortality is not a disease".
      assert.ok(effect.mortalityMultiplier > 1,
        `${type} names a disease that would make people safer`);
      assert.equal(effect.resourceType, undefined,
        `${type} carries both a disease and a resource delta — one effect, one channel`);
      continue;
    }

    assert.ok(items.RESOURCE_TYPES.includes(effect.resourceType),
      `${type} moves "${effect.resourceType}", which is not a resource type`);
    assert.ok(effect.supplyDelta < 0, `${type} failing raises its own supply`);
    // A failure must not quietly start killing people through a channel
    // meant for resources.
    assert.equal(effect.mortalityMultiplier, undefined);
  }
});

test('public_safety has no outage effect, and that is deliberate', () => {
  // `authority.reachTerm` reads a city's public_safety condition
  // directly, so a station falling apart already thins the state's
  // writ. An outage condition on top would count the same fact twice.
  assert.equal(infrastructure.OUTAGE_EFFECTS.public_safety, undefined);

  const authority = require('../server/authority.js');
  const source = require('node:fs')
    .readFileSync(require('node:path').join(__dirname, '..', 'server', 'authority.js'), 'utf8');
  assert.match(source, /public_safety/,
    'nothing reads the condition of a police station, so the double-count argument is void');
  void authority;
});

// -- a failure is felt ----------------------------------------------------

test('a burst main takes the water off', () => {
  const w = cityWorld();
  const water = infrastructure.generateInfrastructure(w, {
    cityId: 1, type: 'water_systems', condition: 40, funding: 20,
  });

  const failure = infrastructure.failInfrastructure(w, water, { tick: 5 });
  assert.ok(failure.felt);
  assert.equal(infrastructure.isFailed(water), true);

  const [condition] = w.activeConditions;
  assert.equal(condition.conditionType, 'outage');
  assert.equal(condition.resourceType, 'water');
  assert.equal(condition.cityId, 1, 'an outage in one city drained every city');
  assert.equal(condition.mortalityMultiplier, undefined);

  for (let t = 6; t <= 12; t += 1) {
    w.tick = t;
    tick.runEnvironmentPhase(w);
  }
  assert.ok(w.resources[0].supply < 100,
    'the water system failed and the water supply did not move');
});

test('sanitation failing is an epidemic, through the channel that exists', () => {
  const w = cityWorld();
  const waste = infrastructure.generateInfrastructure(w, {
    cityId: 1, type: 'waste_management', condition: 40, funding: 20,
  });
  assert.equal(mortality.diseasePressure(w), 1);

  infrastructure.failInfrastructure(w, waste, { tick: 5 });
  assert.ok(mortality.diseasePressure(w) > 1,
    'a waste system went down and nobody got ill');

  const [condition] = w.activeConditions;
  assert.equal(condition.conditionType, 'disease');
  assert.equal(condition.resourceType, undefined);
  assert.equal(condition.cityId, 1, 'an outbreak in one city sickened every city');
});

test('an outbreak in one city does not sicken another', () => {
  // The same real bug the water test above already guards against
  // (`condition.cityId` on the OUTAGE condition), one channel over —
  // `addDiseaseOutbreak` used to take `communityId` and nothing ever
  // passed one, so every outbreak this function could cause was
  // silently world-wide.
  const w = cityWorld();
  w.cities.push({ id: 2 });
  const waste = infrastructure.generateInfrastructure(w, {
    cityId: 1, type: 'waste_management', condition: 40, funding: 20,
  });

  infrastructure.failInfrastructure(w, waste, { tick: 5 });
  assert.ok(mortality.diseasePressure(w, 1) > 1, 'city 1 has the real outbreak');
  assert.equal(mortality.diseasePressure(w, 2), 1, 'city 2 has no outbreak of its own');
});

// -- §7 Waste, closed: a real volume now flows through it -----------------
//
// The note this entry carried for weeks: "there is no waste VOLUME:
// nothing produces refuse, so the system has a condition and a failure
// and nothing flowing through it." These are the tests for the volume
// itself — `advanceInfrastructure`'s own `waste_backlog` accounting —
// as distinct from the binary outage tests above, which predate it and
// still pass unchanged.

function cityWorldWithResidents(residents) {
  const w = cityWorld();
  w.communities = [{ id: 10, city_id: 1 }];
  w.npcs = Array.from({ length: residents }, (_, i) => ({ id: i + 1, communityId: 10 }));
  return w;
}

test('residentsOfCity counts through the community join, not a city-level list', () => {
  const w = cityWorldWithResidents(7);
  w.cities.push({ id: 2 });
  w.communities.push({ id: 11, city_id: 2 });
  w.npcs.push({ id: 100, communityId: 11 });
  assert.equal(infrastructure.residentsOfCity(w, 1), 7);
  assert.equal(infrastructure.residentsOfCity(w, 2), 1);
  assert.equal(infrastructure.residentsOfCity(w, 999), 0, 'an unknown city has no residents');
});

test('a waste system under capacity carries a real, growing backlog', () => {
  const w = cityWorldWithResidents(100);
  const waste = infrastructure.generateInfrastructure(w, {
    cityId: 1, type: 'waste_management', condition: 100, capacity: 50, maintenanceLevel: 100,
  });
  assert.equal(waste.waste_backlog, 0, 'a freshly built system starts caught up');

  // 100 residents at WASTE_PER_RESIDENT against a capacity of 50 nets
  // a real, positive carry every tick.
  const produced = 100 * infrastructure.WASTE_PER_RESIDENT;
  assert.ok(produced > 50, 'test is not exercising the over-capacity case');

  infrastructure.advanceInfrastructure(w, 1);
  assert.equal(waste.waste_backlog, produced - 50);

  infrastructure.advanceInfrastructure(w, 2);
  assert.equal(waste.waste_backlog, (produced - 50) * 2,
    'the backlog is a real carried stock, not recomputed from scratch each tick');
});

test('a waste system at or above capacity never carries a backlog', () => {
  const w = cityWorldWithResidents(10);
  const waste = infrastructure.generateInfrastructure(w, {
    cityId: 1, type: 'waste_management', condition: 100, capacity: 1000, maintenanceLevel: 100,
  });
  for (let t = 1; t <= 5; t += 1) infrastructure.advanceInfrastructure(w, t);
  assert.equal(waste.waste_backlog, 0);
});

test('a standing backlog scales disease pressure continuously, not as a second on/off flag', () => {
  const w = cityWorldWithResidents(100);
  infrastructure.generateInfrastructure(w, {
    cityId: 1, type: 'waste_management', condition: 100, capacity: 50, maintenanceLevel: 100,
  });

  assert.equal(mortality.diseasePressure(w, 1), 1, 'no backlog yet, no pressure yet');
  for (let t = 1; t <= 10; t += 1) {
    // The real environment phase strips last tick's `ticksRemaining: 1`
    // condition before this tick pushes its own; reproduced by hand here
    // since the test calls `advanceInfrastructure` directly to avoid the
    // unrelated seeded weather/failure draws `runEnvironmentPhase` also
    // makes.
    w.activeConditions = w.activeConditions.filter((c) => c.name !== 'waste backlog');
    infrastructure.advanceInfrastructure(w, t);
  }
  const pressure = mortality.diseasePressure(w, 1);
  assert.ok(pressure > 1, 'a real backlog is standing and nobody is worse for it');
  assert.ok(pressure < 1.4, 'a partial backlog already reads as bad as an outright outage');
});

test('disease pressure from backlog tops out at the same ceiling an outright outage uses', () => {
  const w = cityWorldWithResidents(100);
  const waste = infrastructure.generateInfrastructure(w, {
    cityId: 1, type: 'waste_management', condition: 100, capacity: 50, maintenanceLevel: 100,
  });
  // A backlog many times the days-for-max-pressure span, engineered
  // directly rather than accumulated tick by tick -- this is a test of
  // the CLAMP, not of how long accumulation takes.
  waste.waste_backlog = 100 * infrastructure.WASTE_PER_RESIDENT
    * infrastructure.WASTE_BACKLOG_DAYS_FOR_MAX_PRESSURE * 10;
  infrastructure.advanceInfrastructure(w, 1);
  assert.equal(
    mortality.diseasePressure(w, 1),
    infrastructure.OUTAGE_EFFECTS.waste_management.mortalityMultiplier,
  );
});

test('only one waste-backlog condition for a city exists at any read, not one per tick', () => {
  const w = cityWorldWithResidents(100);
  infrastructure.generateInfrastructure(w, {
    cityId: 1, type: 'waste_management', condition: 100, capacity: 50, maintenanceLevel: 100,
  });
  for (let t = 1; t <= 5; t += 1) {
    w.tick = t;
    tick.runEnvironmentPhase(w);
  }
  const backlogConditions = w.activeConditions.filter((c) => c.name === 'waste backlog');
  assert.equal(backlogConditions.length, 1,
    `expected exactly one standing waste-backlog condition, found ${backlogConditions.length}`);
});

test('an outage stops processing entirely -- backlog grows even faster while failed', () => {
  const w = cityWorldWithResidents(100);
  const waste = infrastructure.generateInfrastructure(w, {
    cityId: 1, type: 'waste_management', condition: 100, capacity: 1000, maintenanceLevel: 100,
  });
  infrastructure.failInfrastructure(w, waste, { tick: 1 });
  infrastructure.advanceInfrastructure(w, 2);
  assert.equal(waste.waste_backlog, 100 * infrastructure.WASTE_PER_RESIDENT,
    'a failed system has zero real processing capacity, even though its stated capacity is 1000');
});

test('waste_backlog_forming and waste_backlog_cleared are crossings, not conditions', () => {
  const w = cityWorldWithResidents(100);
  infrastructure.generateInfrastructure(w, {
    cityId: 1, type: 'waste_management', condition: 100, capacity: 50, maintenanceLevel: 100,
  });

  const events1 = infrastructure.advanceInfrastructure(w, 1);
  assert.ok(events1.some((e) => e.type === 'waste_backlog_forming'));

  // Standing-up, not forming again, for as long as the backlog holds.
  const events2 = infrastructure.advanceInfrastructure(w, 2);
  assert.ok(!events2.some((e) => e.type === 'waste_backlog_forming'));

  // Draining the backlog to zero in one tick fires the clear crossing
  // exactly once.
  w.infrastructure[0].capacity = 1_000_000;
  const events3 = infrastructure.advanceInfrastructure(w, 3);
  assert.ok(events3.some((e) => e.type === 'waste_backlog_cleared'));
  const events4 = infrastructure.advanceInfrastructure(w, 4);
  assert.ok(!events4.some((e) => e.type === 'waste_backlog_cleared'));
});

test('a type nothing consumes fails quietly, and says so', () => {
  // `roads` has no outage effect because Transportation is on
  // CLAUDE.md's do-not-touch list. The failure still happens — it just
  // does not pretend to be felt.
  const w = cityWorld();
  const roads = infrastructure.generateInfrastructure(w, { cityId: 1, type: 'roads' });
  const failure = infrastructure.failInfrastructure(w, roads, { tick: 5 });
  assert.equal(failure.felt, false);
  assert.equal(w.activeConditions.length, 0);
  assert.equal(infrastructure.isFailed(roads), true);
});

// -- repair, so this is not the fifth ratchet -----------------------------

test('what funds the repair is the column nothing read', () => {
  // `funding` had no reader anywhere in the engine. A well-funded
  // system in a capable city comes back quickly; an unfunded one does
  // not.
  const w = cityWorld();
  const rich = infrastructure.generateInfrastructure(w, {
    cityId: 1, type: 'water_systems', funding: 100,
  });
  const poor = infrastructure.generateInfrastructure(w, {
    cityId: 1, type: 'electricity', funding: 0,
  });
  assert.ok(infrastructure.repairTicks(w, rich) < infrastructure.repairTicks(w, poor),
    'funding makes no difference to how long a repair takes');

  // Unknown funding is not zero funding — a system nobody recorded a
  // budget for reads as the midpoint rather than as abandoned.
  const unknown = infrastructure.generateInfrastructure(w, {
    cityId: 1, type: 'internet', funding: null,
  });
  const middle = infrastructure.repairTicks(w, unknown);
  assert.ok(middle > infrastructure.repairTicks(w, rich));
  assert.ok(middle < infrastructure.repairTicks(w, poor));

  // Bounded at both ends: nothing is fixed the same afternoon and
  // nothing takes forever.
  for (const row of [rich, poor, unknown]) {
    const ticks = infrastructure.repairTicks(w, row);
    assert.ok(ticks >= infrastructure.MIN_OUTAGE_TICKS);
    assert.ok(ticks <= infrastructure.MAX_OUTAGE_TICKS);
  }
});

test('a repair restores service and does not make the pipe new', () => {
  // **Two wrong answers before this one.** A repair that restored 25
  // condition points made a neglected bridge climb from 55 to 100 over
  // 6,000 ticks — it got BETTER the more often it broke — and
  // `infrastructure-demographics.test.js`'s at-risk crossing started
  // firing zero times because the bridge could no longer reach the
  // band. Five points was the same defect smaller and still climbed.
  //
  // Any gain is coupled to the failure rate, because the failure rate
  // depends on the condition the gain changes. So there is no gain, and
  // the inverse of wear is the maintenance model that already existed.
  const w = cityWorld();
  const water = infrastructure.generateInfrastructure(w, {
    cityId: 1, type: 'water_systems', condition: 30, funding: 100,
  });
  infrastructure.failInfrastructure(w, water, { tick: 0 });
  const brokeAt = water.condition;
  const due = water.repair_ticks;

  // Not a tick early.
  infrastructure.advanceInfrastructure(w, due - 1);
  assert.equal(infrastructure.isFailed(water), true);

  infrastructure.advanceInfrastructure(w, due);
  assert.equal(infrastructure.isFailed(water), false, 'the repair never came due');
  assert.equal(water.repair_ticks, null);
  assert.ok(water.condition <= brokeAt,
    `repaired from ${brokeAt} to ${water.condition} — a system that gets better every time it `
    + 'breaks is an inverse ratchet, which is not an improvement on a ratchet');
  assert.equal(infrastructure.REPAIR_CONDITION_GAIN, undefined,
    'the repair gain is back; see repairInfrastructure for the two measurements that killed it');
});

test('a neglected system declines however often it is repaired', () => {
  // The property the gain was trying to buy, bought instead by not
  // having one: wear is one-way and maintenance is its inverse, so a
  // city that funds nothing ends up with everything broken.
  const w = cityWorld();
  w.seed = 'decline';
  const bridge = infrastructure.generateInfrastructure(w, {
    cityId: 1, type: 'bridges', condition: 55, age: 40, maintenanceLevel: 0,
  });
  const started = bridge.condition;
  for (let t = 1; t <= 6000; t += 1) infrastructure.advanceInfrastructure(w, t);

  assert.ok(bridge.condition < started,
    `an unmaintained bridge went from ${started} to ${bridge.condition} over sixteen years`);
  assert.ok(infrastructure.failureRisk(bridge) > 0.43,
    'it never got any more likely to fail');
});

test('a failed system does not fail again while it is already down', () => {
  const w = cityWorld();
  const water = infrastructure.generateInfrastructure(w, {
    cityId: 1, type: 'water_systems', condition: 10, funding: 0,
  });
  infrastructure.failInfrastructure(w, water, { tick: 1 });
  assert.equal(infrastructure.failInfrastructure(w, water, { tick: 2 }), null);
  assert.equal(w.activeConditions.length, 1, 'one outage produced two conditions');
  assert.equal(infrastructure.repairInfrastructure(w, { id: 99 }, { tick: 3 }), null);
});

// -- the real pipeline ----------------------------------------------------

test('a generated world has outages, and they are rare and they end', () => {
  const w = engine.WorldState;
  worldgen.generateWorld({
    cities: 2, communitiesPerCity: 2, populationPerCommunity: 10, seed: 'util',
  });
  for (let t = 0; t < 600; t += 1) engine.advanceTick();

  const failures = w.events.filter((e) => e.type === 'infrastructure_failure');
  const repairs = w.events.filter((e) => e.type === 'infrastructure_repaired');
  assert.ok(failures.length > 0,
    'twenty systems ran for six hundred ticks and not one of them ever broke');

  // **Unreliable, not broken.** A daily draw straight against the risk
  // would take everything down constantly; the rate is chosen against a
  // measured risk rather than from what a number sounds like.
  assert.ok(failures.length < 40,
    `${failures.length} failures in 600 ticks across twenty systems — the rate is a crisis, `
    + 'not a utility');
  assert.ok(failures.length < w.events.length / 20,
    `${failures.length} of ${w.events.length} events are utility failures`);

  // Everything that broke came back, or the outage is permanent after
  // all.
  assert.ok(repairs.length >= failures.length - w.infrastructure.filter(
    infrastructure.isFailed,
  ).length, 'more systems failed than were ever repaired or are still down');

  // And no outage condition outlived its repair.
  for (const condition of w.activeConditions || []) {
    if (condition.conditionType !== 'outage') continue;
    assert.ok(condition.ticksRemaining > 0);
  }
});

test('the same seed breaks the same pipes on the same day', () => {
  // §88. A failure is a seeded draw, so a world can be replayed.
  //
  // Run against a fixture rather than a second `generateWorld`:
  // generation APPENDS to the shared WorldState, so a second one would
  // be measuring a world of twice the size — and would take long enough
  // to put this file over the suite's own timeout, which is how that
  // was found.
  const run = () => {
    const w = cityWorld();
    w.seed = 'replay';
    for (const type of ['water_systems', 'electricity', 'waste_management', 'roads']) {
      infrastructure.generateInfrastructure(w, {
        cityId: 1, type, condition: 20, age: 60, maintenanceLevel: 0, funding: 10,
      });
    }
    const broke = [];
    for (let t = 1; t <= 4000; t += 1) {
      w.tick = t;
      for (const event of infrastructure.advanceInfrastructure(w, t)) {
        if (event.type === 'infrastructure_failure') {
          broke.push(`${t}:${event.global_effects.type}`);
        }
      }
    }
    return broke;
  };

  const first = run();
  assert.ok(first.length > 0, 'four neglected systems ran eleven years and none of them broke');
  assert.deepEqual(run(), first,
    'the same seed and the same systems broke different things on different days');
});

test('a city can say what it has down', () => {
  const w = engine.WorldState;
  const profile = statistics.profileFor(w, w.communities[0].id);
  const cell = profile.statistics.utilities_down;
  assert.ok(cell, 'utilities_down is not in the catalogue');
  assert.equal(cell.known, true);
  assert.equal(cell.unit, 'count');
  assert.ok(cell.value >= 0);
  assert.equal(
    cell.value,
    infrastructure.failedIn(w, w.communities[0].city_id).length,
  );
});

// -- §7's own levels ------------------------------------------------------

test('the four systems this was for are levelled to what the code does', () => {
  const urbanSystems = require('../server/urbanSystems.js');
  const level = (n) => urbanSystems.SYSTEMS.find((s) => s.n === n).level;

  // Water is the one felt end to end: a resource, a need that reads it,
  // and pipes that can take it away.
  assert.equal(level(11), 'modelled');

  // **Energy moved to modelled, 24 Sep 2026 — this guard caught its
  // own prediction coming true.** It used to assert NO consumer read
  // the resource; `economy.energyFactor` is now exactly that consumer,
  // folded into `productivityOf` as an economic input the same way
  // health and focus already are. The check is flipped rather than
  // deleted: it still fails if a THIRD, undocumented file starts
  // reading `'energy'` without this system's level being reconsidered.
  assert.equal(level(9), 'modelled');
  const consumers = require('node:fs').readdirSync(
    require('node:path').join(__dirname, '..', 'server'),
  ).filter((f) => f.endsWith('.js'))
    // `investments.js` carries `'energy'` too — one of its nine
    // `CATEGORIES`, an investment SECTOR a person can put money into,
    // not a reader of `resources.resource_type = 'energy'`. A different
    // "energy" sharing the same word, the same reason `worldgen.js` and
    // the others below are already excluded.
    .filter((f) => !['worldgen.js', 'items.js', 'infrastructure.js', 'urbanSystems.js',
      'investments.js'].includes(f))
    .filter((f) => /'energy'/.test(require('node:fs').readFileSync(
      require('node:path').join(__dirname, '..', 'server', f), 'utf8',
    ).replace(/^\s*\/\/.*$/gm, '')));
  assert.deepEqual(consumers, ['economy.js'],
    `energy is read by [${consumers.join(', ')}], not exactly economy.js as expected — `
    + 'a new or missing consumer means this system\'s level needs re-checking');

  // Waste: closed to modelled 8 Oct 2026 -- a real volume now flows
  // through it (see the backlog tests above).
  assert.equal(level(12), 'modelled');

  // Fire & Emergency stays slot, and the note has to say why — it
  // shares the public_safety row and the schema's ten types do not
  // separate them.
  assert.equal(level(21), 'slot');
  assert.match(urbanSystems.SYSTEMS.find((s) => s.n === 21).note, /public_safety/);
});
