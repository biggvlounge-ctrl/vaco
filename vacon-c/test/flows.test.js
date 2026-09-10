// VACANCY — Named Flow Templates.
//
// **This suite exists to hold down one claim, and everything else here
// is support for it.**
//
// The architecture document does not merely ask for ten flows. It says
// how: *"implemented as data (`flow_templates` table), **not one
// hardcoded function per flow**."* A system can satisfy the first half
// and fail the second completely — ten functions in a lookup object
// would list ten flow names and be exactly what the document rules out.
//
// The test that separates the two is "a flow that exists nowhere in the
// source produces behaviour anyway". It is `a flow defined entirely as
// data fires inside a real tick, with no code that knows about it`
// below. If that test ever needs a change to `flows.js` to pass, this
// system has quietly become ten hardcoded functions again and the
// document's requirement is no longer met.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const flows = require('../server/flows.js');
const engine = require('../server/engine.js');

function freshWorld(overrides = {}) {
  return {
    tick: 0,
    npcs: [], organizations: [], families: [], resources: [], marketListings: [],
    relationships: [], migrationRisk: [], territoryBlocks: [], communities: [],
    properties: [], cultures: [], flowTemplates: [],
    reemergenceIndex: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// The claim
// ---------------------------------------------------------------------------

test('a flow defined entirely as data fires inside a real tick, with no code that knows about it', () => {
  // `grep -r "brittle-households" server/` returns nothing. This flow
  // exists only in this test, as a row.
  engine.WorldState.flowTemplates.length = 0;
  engine.generateNPC();
  const family = engine.generateFamily({ surname: 'Brittle' });
  family.unity = 5;

  engine.addFlowTemplate({
    id: 'brittle-households',
    name: 'Brittle Households',
    signal: 'family.meanUnity',
    comparator: 'below',
    threshold: 20,
    severity: 'high',
    note: 'invented by a test, understood by no function',
  });

  const result = engine.advanceTick();
  const fired = result.events.find(
    (e) => e.type === 'flow' && e.global_effects.flowId === 'brittle-households',
  );

  assert.ok(fired, 'a template added as data reached the event phase');
  assert.equal(fired.global_effects.flowName, 'Brittle Households');
  assert.equal(fired.global_effects.value, 5);
  assert.equal(fired.severity, 'high');

  engine.WorldState.flowTemplates.length = 0;
});

// ---------------------------------------------------------------------------
// Firing rules
// ---------------------------------------------------------------------------

test('a flow fires when its signal crosses and stays quiet when it does not', () => {
  const template = {
    id: 't', name: 'T', signal: 'resource.maxScarcity', comparator: 'above', threshold: 60,
  };

  // Asserts on THIS flow, not on the total: the built-in ten run
  // alongside a world's own templates, so a total count would be
  // measuring them too.
  const firedIds = (world) => flows.resolveFlows(world).map((e) => e.global_effects.flowId);

  const calm = freshWorld({
    resources: [{ resource_type: 'water', supply: 100, demand: 60 }], // scarcity 30
    flowTemplates: [template],
  });
  assert.ok(!firedIds(calm).includes('t'));

  const strained = freshWorld({
    resources: [{ resource_type: 'water', supply: 100, demand: 160 }], // scarcity 80
    flowTemplates: [template],
  });
  const fired = flows.resolveFlows(strained).find((e) => e.global_effects.flowId === 't');
  assert.ok(fired);
  assert.equal(fired.global_effects.value, 80);
});

test('every comparator means what it says', () => {
  const at = (comparator) => {
    const world = freshWorld({
      // scarcity is computed from supply and demand, never stored.
      resources: [{ resource_type: 'water', supply: 100, demand: 100 }], // scarcity 50
      flowTemplates: [{ id: 'c', name: 'C', signal: 'resource.maxScarcity', comparator, threshold: 50 }],
    });
    return flows.resolveFlows(world).some((e) => e.global_effects.flowId === 'c');
  };

  assert.equal(at('above'), false, '50 is not above 50');
  assert.equal(at('atLeast'), true, '50 is at least 50');
  assert.equal(at('below'), false, '50 is not below 50');
  assert.equal(at('atMost'), true, '50 is at most 50');
});

// The unknown-is-not-a-zero rule, in the place it matters most: a world
// with no families has not got low family unity.
test('a signal with nothing to read does not fire, rather than firing on zero', () => {
  const world = freshWorld({
    families: [],
    flowTemplates: [{
      id: 'unity', name: 'Unity', signal: 'family.meanUnity', comparator: 'below', threshold: 40,
    }],
  });

  assert.ok(!flows.resolveFlows(world).some((e) => e.global_effects.flowId === 'unity'),
    'an empty world has no opinion about family unity, and 0 < 40 would be the wrong one');

  const described = flows.describeFlows(world).find((f) => f.id === 'unity');
  assert.equal(described.value, null);
  assert.equal(described.readable, false);
  assert.equal(described.firing, false);
});

test('a count signal legitimately reads zero and fires on it', () => {
  // The distinction the previous test rests on: "no families" is
  // unreadable for a mean, but "no businesses" is a real count of zero.
  const world = freshWorld({
    organizations: [],
    flowTemplates: [{
      id: 'biz', name: 'Biz', signal: 'business.count', comparator: 'atMost', threshold: 0,
    }],
  });

  const fired = flows.resolveFlows(world).find((e) => e.global_effects.flowId === 'biz');
  assert.ok(fired);
  assert.equal(fired.global_effects.value, 0);
  assert.equal(flows.describeFlows(world).find((f) => f.id === 'biz').readable, true);
});

// ---------------------------------------------------------------------------
// The boundary: flows observe, they do not mutate
// ---------------------------------------------------------------------------

test('resolving flows changes nothing in the world', () => {
  const world = freshWorld({
    resources: [{ resource_type: 'water', supply: 10, demand: 100 }],
    marketListings: [{ product_name: 'ration', price: 12 }],
    families: [{ id: 1, surname: 'Vance', unity: 10 }],
    communities: [{ id: 1, crime: 80, safety: 20 }],
    territoryBlocks: [{ id: 1, status: 'contested' }],
  });
  const before = JSON.stringify(world);

  const events = flows.resolveFlows(world);

  assert.ok(events.length > 0, 'several flows should be firing on a world this strained');
  assert.equal(JSON.stringify(world), before,
    'flows report; the phases are what change the world');
});

test('describing flows does not advance anything either', () => {
  const world = freshWorld({ resources: [{ resource_type: 'water', supply: 10, demand: 100 }] });
  const before = JSON.stringify(world);
  flows.describeFlows(world);
  flows.describeFlows(world);
  assert.equal(JSON.stringify(world), before);
});

// ---------------------------------------------------------------------------
// Validation — a template that cannot work is refused, not ignored
// ---------------------------------------------------------------------------

test('a template naming a signal this engine cannot read is refused', () => {
  assert.throws(() => flows.validateTemplate({
    id: 'x', signal: 'moon.phase', comparator: 'above', threshold: 1,
  }), /not a signal this engine reads/);
});

test('a template with an unknown comparator or a non-numeric threshold is refused', () => {
  assert.throws(() => flows.validateTemplate({
    id: 'x', signal: 'family.count', comparator: 'approximately', threshold: 1,
  }), /not a comparator/);
  assert.throws(() => flows.validateTemplate({
    id: 'x', signal: 'family.count', comparator: 'above', threshold: 'a lot',
  }), /finite number/);
});

test('a template with no id is refused', () => {
  assert.throws(() => flows.validateTemplate({ signal: 'family.count' }), /needs an id/);
});

// Silently skipping a broken template is worse than refusing it: the
// flow would simply never fire and nobody would know why.
test('one broken template stops the run rather than being skipped quietly', () => {
  const world = freshWorld({
    families: [{ id: 1, unity: 10 }],
    flowTemplates: [
      { id: 'ok', name: 'OK', signal: 'family.count', comparator: 'atLeast', threshold: 1 },
      { id: 'broken', name: 'Broken', signal: 'nonsense', comparator: 'above', threshold: 1 },
    ],
  });
  assert.throws(() => flows.resolveFlows(world), /not a signal/);
});

// ---------------------------------------------------------------------------
// The ten named flows
// ---------------------------------------------------------------------------

test('the ten flows the architecture document names are all present, by name', () => {
  const named = [
    'Economic Flow', 'Social Flow', 'Family Flow', 'Education Flow', 'Business Flow',
    'Political Flow', 'Security Flow', 'Crime Flow', 'Transportation Flow', 'Resource Flow',
  ];
  const built = flows.FLOW_TEMPLATES.map((f) => f.name);

  assert.equal(built.length, 10);
  for (const name of named) {
    assert.ok(built.includes(name), `${name} is missing`);
  }
});

test('every built-in template is valid against the resolver that runs it', () => {
  // A template shipped in this file that the validator rejects would be
  // a flow that throws the first time a tick touched it.
  for (const template of flows.FLOW_TEMPLATES) {
    flows.validateTemplate(template);
  }
});

test('a world with nothing in it fires no flow that needs something to read', () => {
  const world = freshWorld();
  const fired = flows.resolveFlows(world);
  // business.count is the one honest zero — an empty world genuinely
  // has no businesses.
  assert.deepEqual(fired.map((f) => f.global_effects.flowId), ['business-flow']);
});

test('a world\'s own templates are added to the ten, not swapped for them', () => {
  // The first version replaced the ten as soon as this array had one
  // row, so adding a flow silently switched ten others off. The ten are
  // named in the architecture document; they are not defaults.
  const world = freshWorld({
    flowTemplates: [{ id: 'extra', name: 'Extra', signal: 'family.count', comparator: 'atLeast', threshold: 0 }],
  });
  const listed = flows.listFlowTemplates(world);

  assert.equal(listed.length, 11);
  assert.ok(listed.some((t) => t.id === 'extra'));
  assert.ok(listed.some((t) => t.id === 'economic-flow'), 'the built-in ten are still there');
});

test('a template sharing an id with a built-in replaces that one and only that one', () => {
  const world = freshWorld({
    flowTemplates: [{
      id: 'crime-flow', name: 'Crime Flow (local)', signal: 'community.meanCrime',
      comparator: 'above', threshold: 90,
    }],
  });
  const listed = flows.listFlowTemplates(world);

  assert.equal(listed.length, 10, 'still ten — one was replaced, not appended');
  const crime = listed.find((t) => t.id === 'crime-flow');
  assert.equal(crime.threshold, 90, 'the world\'s version wins');
  assert.equal(crime.name, 'Crime Flow (local)');
});

test('an empty flowTemplates array falls back to the built-in ten', () => {
  assert.equal(flows.listFlowTemplates(freshWorld()).length, 10);
});

// ---------------------------------------------------------------------------
// Inside the pipeline
// ---------------------------------------------------------------------------

test('flow events reach the event phase on a real tick and carry the tick they describe', () => {
  engine.WorldState.flowTemplates.length = 0;
  engine.generateNPC();

  const result = engine.advanceTick();
  const flowEvents = result.events.filter((e) => e.type === 'flow');

  assert.ok(flowEvents.length > 0, 'the built-in flows run on a real tick');
  for (const event of flowEvents) {
    assert.equal(event.tick, engine.WorldState.tick,
      'a flow describes the tick it ran in, not the one before');
  }
});

test('two firings of the same flow on different ticks are distinguishable', () => {
  engine.WorldState.flowTemplates.length = 0;
  engine.generateNPC();

  const first = engine.advanceTick().events.filter((e) => e.type === 'flow');
  const second = engine.advanceTick().events.filter((e) => e.type === 'flow');

  assert.ok(first.length && second.length);
  assert.notEqual(first[0].global_effects.firing, second[0].global_effects.firing);
});

// ---------------------------------------------------------------------------
// The guard against a dead signal
// ---------------------------------------------------------------------------
// **Three signals were dead when this file was first written**, and no
// test above caught it, because every fixture in this file builds its
// rows by hand and so encoded the same wrong assumption the code did:
// `{ resource_type: 'water', scarcity: 80 }` is not what a real
// resource row looks like. `scarcity` is computed by
// economy.getScarcity() and never stored (standing rule 3), and an
// organization's `power` lives in its trait sheet, not as a field. So
// resource.maxScarcity, resource.meanScarcity and
// organization.meanPower always read undefined, and Economic, Resource
// and Political Flow could never fire on any real world.
//
// What found it was seeding a world with a drought running at scarcity
// 77 and noticing that Economic Flow stayed silent.
//
// This test is the generalisation: build a world with the REAL
// generators, then require every signal to read something. A signal
// that returns null here is either reading a field that does not exist
// or watching a system this world genuinely lacks — and the second case
// has to be named explicitly, so a new dead signal cannot hide.

test('every signal reads something on a realistically populated world', () => {
  const world = engine.WorldState;
  engine.generateNPC();
  engine.generateNPC();
  engine.generateOrganization({ name: 'Signal Mill', type: 'business' });
  const faction = engine.generateFaction({ name: 'Signal Gang', type: 'gang' });
  const family = engine.generateFamily({ surname: 'Signal' });
  engine.generateResource({
    resourceType: 'signal-water', quantity: 100, supply: 20, demand: 90,
  });
  engine.generateMarketListing({ productName: 'signal ration', price: 9, supply: 10, demand: 10 });
  const city = engine.generateCity({ name: 'Signalton' });
  engine.generateCommunity({ cityId: city.id, crime: 20, safety: 60 });
  engine.generateTerritoryBlock({ factionId: faction.id, cityId: city.id });
  engine.generateProperty({ type: 'residential', value: 1000, lifecycleStage: 'operation' });
  engine.generateCulture({ name: 'Signal Culture', traits: { education: 50 } });
  engine.addFamilyMember(family.id, engine.generateNPC().id, 'head', 1);
  engine.advanceTick(); // populates reemergenceIndex and migrationRisk

  // Signals that legitimately read nothing in this world, each with the
  // reason. Anything not on this list MUST read a value.
  const legitimatelyUnreadable = {
    // Relationships are written by Key resolvers, and no Key was
    // resolved here. A world where nobody has interacted has no
    // average trust — that is the unknown-is-not-a-zero rule, not a
    // dead signal.
    'social.meanTrust': 'no Key resolver has run, so no relationship exists yet',
    // Migration risk only records NPCs above the threshold, and
    // randomly-generated traits usually clear it.
    'population.migrationRiskCount': 'a count, so it reads 0 rather than null — listed for completeness',
  };

  const dead = [];
  for (const [name, read] of Object.entries(flows.SIGNALS)) {
    const value = read(world);
    if (value === null || value === undefined) {
      if (!legitimatelyUnreadable[name]) dead.push(name);
    } else if (!Number.isFinite(value)) {
      dead.push(`${name} (returned ${value}, not a finite number)`);
    }
  }

  assert.deepEqual(dead, [],
    'these signals read nothing on a real world — they are watching a field that does not exist');
});

test('the three signals that were dead now read real values', () => {
  // Named individually so a regression points straight at the cause
  // rather than at a list.
  const world = engine.WorldState;
  engine.generateResource({
    resourceType: 'regression-water', quantity: 100, supply: 20, demand: 90,
  });
  engine.generateOrganization({ name: 'Regression Co', type: 'business' });

  const scarcity = flows.SIGNALS['resource.maxScarcity'](world);
  assert.ok(Number.isFinite(scarcity) && scarcity > 0,
    'scarcity is computed by economy.getScarcity(), not stored on the row');

  const power = flows.SIGNALS['organization.meanPower'](world);
  assert.ok(Number.isFinite(power),
    'organization power lives in the trait sheet, not as a field on the row');

  const meanScarcity = flows.SIGNALS['resource.meanScarcity'](world);
  assert.ok(Number.isFinite(meanScarcity));
});

test('a drought makes Economic Flow fire, which is the whole point of it', () => {
  // End to end against the built-in template rather than a fixture:
  // this is the assertion the seeded world failed silently.
  const world = engine.WorldState;
  world.flowTemplates.length = 0;
  engine.generateResource({
    resourceType: 'drought-water', quantity: 50, supply: 5, demand: 120,
  });

  const economic = engine.describeFlows().find((f) => f.id === 'economic-flow');
  assert.equal(economic.readable, true);
  assert.ok(economic.value > 60, `scarcity should be past the threshold, got ${economic.value}`);
  assert.equal(economic.firing, true);
});

test('a trait signal follows the live value, not the entity\'s birth value', () => {
  // `npc.traits` and `org.traits` are a sheet built once in
  // generateNPC()/generateOrganization() and never refreshed; the live
  // values are the entity_traits rows that ticks and Key modifiers
  // write to. Two signals read the sheet until 10 Sep 2026, so two of
  // the ten named flows reported birth values forever.
  //
  // This is the sibling of the failure this file's header already
  // records: that one read a field that did not exist and returned
  // null, which is at least visible. This one returns a plausible
  // number that never moves.
  const engine = require('../server/engine.js');
  const W = engine.WorldState;
  for (const k of Object.keys(W)) if (Array.isArray(W[k])) W[k] = [];
  W.tick = 0;

  const npc = engine.generateNPC();
  const org = engine.generateOrganization({ type: 'gang' });

  const volatilityBefore = flows.SIGNALS['population.meanVolatility'](W);
  const powerBefore = flows.SIGNALS['organization.meanPower'](W);
  assert.ok(Number.isFinite(volatilityBefore), 'the volatility signal reads nothing at all');
  assert.ok(Number.isFinite(powerBefore), 'the power signal reads nothing at all');

  // Move the live values without touching the denormalised sheets.
  engine.applyKeyModifier(npc.id, 'emotional', 'Volatility', 25, 0);
  engine.applyKeyModifier(org.id, 'organization', 'power', -20, 0);

  // The sheets are deliberately checked to still be stale — that is
  // what makes this a test of the signal rather than of the engine.
  assert.equal(npc.traits.emotional.Volatility, volatilityBefore,
    'the denormalised sheet updated, so this test no longer proves the signal reads live');

  const volatilityAfter = flows.SIGNALS['population.meanVolatility'](W);
  const powerAfter = flows.SIGNALS['organization.meanPower'](W);

  assert.notEqual(volatilityAfter, volatilityBefore,
    'population.meanVolatility did not move after a Key modifier changed the live trait — '
    + 'it is reading npc.traits, which is frozen at generation');
  assert.notEqual(powerAfter, powerBefore,
    'organization.meanPower did not move after a Key modifier changed the live trait — '
    + 'it is reading org.traits, which is frozen at generation');
});
