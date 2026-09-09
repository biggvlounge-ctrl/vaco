// VACANCY — the Property Engine.
//
// Two things this suite exists to hold down, beyond the ordinary
// generate/validate coverage:
//
//   1. **Derived value is never written back.** CLAUDE.md standing rule
//      3 names Property Value alongside Family Wealth as computed and
//      never stored, while the schema gives `properties` a real `value`
//      column. property.js resolves that by treating the column as the
//      assessed value and currentValue() as the derived one. That
//      resolution is only true as long as nothing assigns the derived
//      number back onto the row, which is a thing a test can check.
//
//   2. **Ownership is a read over history, not a field.**
//      ownership_records is append-only by shape. "Who owns this now"
//      must therefore stay a query, and a sale must leave the previous
//      owner's row intact and readable.
//
// Runs against a private world, like the territory tests: these
// functions take `worldState` explicitly, and a private world keeps the
// id arithmetic legible.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const property = require('../server/property.js');
const engine = require('../server/engine.js');

function freshWorld() {
  return { tick: 0, properties: [], ownershipRecords: [], nextEntityId: 1 };
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

test('a property must have a type, and it must be one the schema defines', () => {
  const world = freshWorld();
  assert.throws(() => property.generateProperty(world, { value: 100 }), /type/);
  assert.throws(
    () => property.generateProperty(world, { type: 'spaceship', value: 100 }),
    /not a property type/,
  );
  assert.equal(world.properties.length, 0);
});

test('a property must have an assessed value', () => {
  const world = freshWorld();
  assert.throws(
    () => property.generateProperty(world, { type: 'residential' }),
    /value/,
  );
});

test('a property cannot be generated into a lifecycle stage that does not exist', () => {
  const world = freshWorld();
  assert.throws(
    () => property.generateProperty(world, {
      type: 'residential', value: 100, lifecycleStage: 'demolished',
    }),
    /not a lifecycle stage/,
  );
});

test('a generated property takes the schema defaults', () => {
  const world = freshWorld();
  const home = property.generateProperty(world, { type: 'residential', value: 90000 });

  assert.equal(home.condition, 100);            // schema DEFAULT 100
  assert.equal(home.lifecycle_stage, 'planning'); // schema DEFAULT 'planning'
  assert.equal(home.age, 0);
  assert.deepEqual(world.properties, [home]);
});

// The id question the header settles: ownership_records.entity_id is an
// entities FK, so a property id has to be unique in that space or an
// ownership record is ambiguous. Drawing from the shared counter is
// what makes it unique -- and a local counter would make properties 1,
// 2, 3 collide with NPCs 1, 2, 3.
test('property ids come from the shared entity counter, not a local one', () => {
  const world = freshWorld();
  world.nextEntityId = 41;

  const first = property.generateProperty(world, { type: 'commercial', value: 10 });
  const second = property.generateProperty(world, { type: 'commercial', value: 10 });

  assert.equal(first.id, 41);
  assert.equal(second.id, 42);
  assert.equal(world.nextEntityId, 43);
});

// ---------------------------------------------------------------------------
// Derived value
// ---------------------------------------------------------------------------

test('a property in operation at full condition is worth its assessed value', () => {
  const world = freshWorld();
  const shop = property.generateProperty(world, {
    type: 'commercial', value: 200000, lifecycleStage: 'operation',
  });
  assert.equal(property.currentValue(shop), 200000);
});

test('condition scales the derived value proportionally', () => {
  const world = freshWorld();
  const shop = property.generateProperty(world, {
    type: 'commercial', value: 200000, lifecycleStage: 'operation', condition: 50,
  });
  assert.equal(property.currentValue(shop), 100000);
});

test('lifecycle stage scales the derived value: planning is worth less than operation', () => {
  const world = freshWorld();
  const planned = property.generateProperty(world, {
    type: 'residential', value: 100000, lifecycleStage: 'planning',
  });
  const running = property.generateProperty(world, {
    type: 'residential', value: 100000, lifecycleStage: 'operation',
  });
  const legacy = property.generateProperty(world, {
    type: 'historical_site', value: 100000, lifecycleStage: 'historical_legacy',
  });

  assert.ok(property.currentValue(planned) < property.currentValue(running));
  assert.ok(property.currentValue(legacy) > property.currentValue(running));
});

test('a ruin is worth nothing, however well assessed', () => {
  const world = freshWorld();
  const ruin = property.generateProperty(world, {
    type: 'residential', value: 500000, lifecycleStage: 'operation', condition: 0,
  });
  assert.equal(property.currentValue(ruin), 0);
});

// Standing rule 3, asserted directly.
test('reading the derived value never writes it back to the row', () => {
  const world = freshWorld();
  const home = property.generateProperty(world, {
    type: 'residential', value: 300000, lifecycleStage: 'operation', condition: 40,
  });

  const derived = property.currentValue(home);
  property.currentValue(home);
  property.currentValue(home);

  assert.equal(derived, 120000);
  assert.equal(home.value, 300000, 'the assessed value is an input and must not drift');
  assert.notEqual(home.value, derived);
});

// The drift the rule exists to prevent, shown happening: if the derived
// number had been stored, changing condition would leave it stale.
test('the derived value follows its inputs rather than lagging them', () => {
  const world = freshWorld();
  const home = property.generateProperty(world, {
    type: 'residential', value: 100000, lifecycleStage: 'operation',
  });
  assert.equal(property.currentValue(home), 100000);

  home.condition = 25;
  assert.equal(property.currentValue(home), 25000);
});

// ---------------------------------------------------------------------------
// Ownership
// ---------------------------------------------------------------------------

test('an ownership record needs a thing, an owner, an owner type, and a tick', () => {
  const world = freshWorld();
  const home = property.generateProperty(world, { type: 'residential', value: 100 });

  assert.throws(() => property.recordOwnership(world, {
    ownerEntityId: 7, ownerType: 'individual', tick: 0,
  }), /entityId/);
  assert.throws(() => property.recordOwnership(world, {
    entityId: home.id, ownerType: 'individual', tick: 0,
  }), /ownerEntityId/);
  assert.throws(() => property.recordOwnership(world, {
    entityId: home.id, ownerEntityId: 7, tick: 0,
  }), /ownerType/);
  assert.throws(() => property.recordOwnership(world, {
    entityId: home.id, ownerEntityId: 7, ownerType: 'individual',
  }), /tick/);

  assert.equal(world.ownershipRecords.length, 0);
});

test('owner type and acquisition method must be ones the schema defines', () => {
  const world = freshWorld();
  const home = property.generateProperty(world, { type: 'residential', value: 100 });

  assert.throws(() => property.recordOwnership(world, {
    entityId: home.id, ownerEntityId: 7, ownerType: 'landlord', tick: 0,
  }), /not an owner type/);
  assert.throws(() => property.recordOwnership(world, {
    entityId: home.id, ownerEntityId: 7, ownerType: 'individual',
    acquiredMethod: 'summoned', tick: 0,
  }), /not an acquisition method/);
});

test('the current owner is the most recent acquisition', () => {
  const world = freshWorld();
  const home = property.generateProperty(world, { type: 'residential', value: 100 });

  property.recordOwnership(world, {
    entityId: home.id, ownerEntityId: 7, ownerType: 'individual',
    acquiredMethod: 'built', tick: 0,
  });
  property.recordOwnership(world, {
    entityId: home.id, ownerEntityId: 9, ownerType: 'individual',
    acquiredMethod: 'purchased', tick: 12,
  });

  const owner = property.getCurrentOwner(world, home.id);
  assert.equal(owner.owner_entity_id, 9);
  assert.equal(owner.acquired_method, 'purchased');
  assert.equal(owner.acquired_tick, 12);
});

// Append-only means the sale does not erase the seller.
test('a sale leaves the previous owner in the history, in order', () => {
  const world = freshWorld();
  const home = property.generateProperty(world, { type: 'residential', value: 100 });

  property.recordOwnership(world, {
    entityId: home.id, ownerEntityId: 7, ownerType: 'individual', acquiredMethod: 'built', tick: 0,
  });
  property.recordOwnership(world, {
    entityId: home.id, ownerEntityId: 9, ownerType: 'family', acquiredMethod: 'inherited', tick: 4,
  });
  property.recordOwnership(world, {
    entityId: home.id, ownerEntityId: 11, ownerType: 'organization', acquiredMethod: 'purchased', tick: 9,
  });

  const history = property.getOwnershipHistory(world, home.id);
  assert.equal(history.length, 3);
  assert.deepEqual(history.map((r) => r.owner_entity_id), [7, 9, 11]);
  assert.deepEqual(history.map((r) => r.owner_type),
    ['individual', 'family', 'organization']);
  assert.equal(world.ownershipRecords.length, 3, 'nothing was overwritten');
});

test('two acquisitions in one tick resolve to the one recorded later', () => {
  const world = freshWorld();
  const home = property.generateProperty(world, { type: 'residential', value: 100 });

  property.recordOwnership(world, {
    entityId: home.id, ownerEntityId: 7, ownerType: 'individual', tick: 5,
  });
  property.recordOwnership(world, {
    entityId: home.id, ownerEntityId: 8, ownerType: 'individual', tick: 5,
  });

  assert.equal(property.getCurrentOwner(world, home.id).owner_entity_id, 8);
});

test('an unowned property has no owner and an empty history', () => {
  const world = freshWorld();
  const home = property.generateProperty(world, { type: 'residential', value: 100 });

  assert.equal(property.getCurrentOwner(world, home.id), null);
  assert.deepEqual(property.getOwnershipHistory(world, home.id), []);
});

test('one property changing hands does not disturb another', () => {
  const world = freshWorld();
  const a = property.generateProperty(world, { type: 'residential', value: 100 });
  const b = property.generateProperty(world, { type: 'residential', value: 100 });

  property.recordOwnership(world, { entityId: a.id, ownerEntityId: 7, ownerType: 'individual', tick: 0 });
  property.recordOwnership(world, { entityId: b.id, ownerEntityId: 8, ownerType: 'individual', tick: 0 });
  property.recordOwnership(world, { entityId: a.id, ownerEntityId: 9, ownerType: 'individual', tick: 3 });

  assert.equal(property.getCurrentOwner(world, a.id).owner_entity_id, 9);
  assert.equal(property.getCurrentOwner(world, b.id).owner_entity_id, 8);
});

// ---------------------------------------------------------------------------
// Holdings — the rollup the citizen dashboard needs
// ---------------------------------------------------------------------------

test('holdings sum the derived value of everything an owner currently holds', () => {
  const world = freshWorld();
  const home = property.generateProperty(world, {
    type: 'residential', value: 100000, lifecycleStage: 'operation',
  });
  const shop = property.generateProperty(world, {
    type: 'commercial', value: 50000, lifecycleStage: 'operation', condition: 50,
  });

  property.recordOwnership(world, { entityId: home.id, ownerEntityId: 7, ownerType: 'individual', tick: 0 });
  property.recordOwnership(world, { entityId: shop.id, ownerEntityId: 7, ownerType: 'individual', tick: 0 });

  const holdings = property.getHoldings(world, 7);
  assert.equal(holdings.count, 2);
  assert.equal(holdings.totalValue, 125000); // 100000 + 25000, not 150000
});

test('a property sold on leaves the seller\'s holdings', () => {
  const world = freshWorld();
  const home = property.generateProperty(world, {
    type: 'residential', value: 100000, lifecycleStage: 'operation',
  });

  property.recordOwnership(world, { entityId: home.id, ownerEntityId: 7, ownerType: 'individual', tick: 0 });
  assert.equal(property.getHoldings(world, 7).count, 1);

  property.recordOwnership(world, {
    entityId: home.id, ownerEntityId: 9, ownerType: 'individual', acquiredMethod: 'purchased', tick: 6,
  });

  assert.equal(property.getHoldings(world, 7).count, 0, 'the seller no longer holds it');
  assert.equal(property.getHoldings(world, 9).count, 1);
  assert.equal(property.getHoldings(world, 9).totalValue, 100000);
});

test('an owner with nothing has empty holdings rather than an error', () => {
  const world = freshWorld();
  const holdings = property.getHoldings(world, 999);
  assert.equal(holdings.count, 0);
  assert.equal(holdings.totalValue, 0);
  assert.deepEqual(holdings.properties, []);
});

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

test('a planned property gets built, then opens, and does not decay on the way', () => {
  const world = freshWorld();
  const site = property.generateProperty(world, { type: 'residential', value: 100000 });
  assert.equal(site.lifecycle_stage, 'planning');

  property.advancePropertyLifecycle(world, site, 1);
  assert.equal(site.lifecycle_stage, 'construction');
  assert.equal(site.construction_date, 1);
  assert.equal(site.condition, 100, 'nothing is wearing out yet');

  property.advancePropertyLifecycle(world, site, 2);
  assert.equal(site.lifecycle_stage, 'construction');

  property.advancePropertyLifecycle(world, site, 3);
  assert.equal(site.lifecycle_stage, 'operation');
  assert.equal(site.condition, 100);
});

test('a property in operation ages and wears', () => {
  const world = freshWorld();
  const shop = property.generateProperty(world, {
    type: 'commercial', value: 100000, lifecycleStage: 'operation',
  });

  property.advancePropertyLifecycle(world, shop, 1);
  assert.equal(shop.age, 1);
  assert.ok(shop.condition < 100, 'condition falls');
  assert.ok(shop.condition > 99, 'and falls slowly');
});

// Decay is meant to erode value over time, not push it negative or
// wrap around, which is the failure mode a clamp exists to stop.
test('condition floors at zero however long a property is left standing', () => {
  const world = freshWorld();
  const ruin = property.generateProperty(world, {
    type: 'residential', value: 100000, lifecycleStage: 'operation', condition: 1,
  });

  for (let i = 0; i < 50; i += 1) property.advancePropertyLifecycle(world, ruin, i);

  assert.equal(ruin.condition, 0);
  assert.equal(property.currentValue(ruin), 0);
  assert.ok(property.currentValue(ruin) >= 0);
});

// Time passing must not quietly rewrite the books or demolish anything
// -- both are decisions, not side effects.
test('a tick never changes the assessed value or the owner', () => {
  const world = freshWorld();
  const shop = property.generateProperty(world, {
    type: 'commercial', value: 100000, lifecycleStage: 'operation',
  });
  property.recordOwnership(world, { entityId: shop.id, ownerEntityId: 7, ownerType: 'individual', tick: 0 });

  for (let i = 0; i < 10; i += 1) property.advancePropertyLifecycle(world, shop, i);

  assert.equal(shop.value, 100000);
  assert.equal(world.properties.length, 1);
  assert.equal(world.ownershipRecords.length, 1);
  assert.equal(property.getCurrentOwner(world, shop.id).owner_entity_id, 7);
});

// ---------------------------------------------------------------------------
// Bound to the engine
// ---------------------------------------------------------------------------
// The engine singleton is what server.js actually calls, and a module
// that works against a private world but was never wired is exactly the
// "starved, not unwired" failure the Territory phase already showed.

test('the engine exposes properties bound to its own WorldState', () => {
  const before = engine.WorldState.properties.length;
  const home = engine.generateProperty({
    type: 'residential', value: 80000, lifecycleStage: 'operation',
  });

  assert.equal(engine.WorldState.properties.length, before + 1);
  assert.equal(engine.getProperty(home.id).id, home.id);
  assert.equal(engine.currentPropertyValue(home), 80000);
  assert.ok(engine.listProperties().some((p) => p.id === home.id));
});

test('a property id from the engine cannot collide with an NPC id', () => {
  const npc = engine.generateNPC();
  const home = engine.generateProperty({ type: 'residential', value: 1000 });
  const other = engine.generateNPC();

  assert.notEqual(home.id, npc.id);
  assert.notEqual(home.id, other.id);
});

test('the engine records and reads ownership against its own WorldState', () => {
  const npc = engine.generateNPC();
  const home = engine.generateProperty({
    type: 'residential', value: 60000, lifecycleStage: 'operation',
  });

  engine.recordOwnership({
    entityId: home.id, ownerEntityId: npc.id, ownerType: 'individual',
    acquiredMethod: 'purchased', tick: engine.WorldState.tick,
  });

  assert.equal(engine.getCurrentOwner(home.id).owner_entity_id, npc.id);
  assert.equal(engine.getOwnershipHistory(home.id).length, 1);
  assert.equal(engine.getHoldings(npc.id).totalValue, 60000);
});

// ---------------------------------------------------------------------------
// Inside a real tick
// ---------------------------------------------------------------------------
// The Territory lesson: a module can be correct, bound, and still dead,
// because nothing in the pipeline ever calls it. advancePropertyLifecycle
// runs in the Environment phase, so the only test that proves anything
// is one that advances the world and looks at what moved.

test('a real tick ages property and reports the stage change as an event', () => {
  engine.generateNPC(); // runReemergencePhase divides by the NPC count
  const site = engine.generateProperty({ type: 'residential', value: 100000 });
  const shop = engine.generateProperty({
    type: 'commercial', value: 100000, lifecycleStage: 'operation',
  });
  const owner = engine.generateNPC();
  engine.recordOwnership({
    entityId: site.id, ownerEntityId: owner.id, ownerType: 'individual',
    acquiredMethod: 'built', tick: engine.WorldState.tick,
  });

  const conditionBefore = shop.condition;
  const result = engine.advanceTick();

  assert.equal(site.lifecycle_stage, 'construction', 'the site broke ground on the tick');
  assert.ok(shop.condition < conditionBefore, 'the standing building wore down on the tick');

  const change = result.events.find(
    (e) => e.type === 'property_lifecycle_change' && e.global_effects.propertyId === site.id,
  );
  assert.ok(change, 'the stage change reached the event phase');
  assert.equal(change.global_effects.priorStage, 'planning');
  assert.equal(change.global_effects.newStage, 'construction');
  assert.deepEqual(change.affected_entity_ids, [owner.id],
    'the event names the owner, read out of ownership history');
});

test('three ticks take a site from planning to open, and no further', () => {
  engine.generateNPC();
  const site = engine.generateProperty({ type: 'industrial', value: 50000 });

  engine.advanceTick();
  engine.advanceTick();
  engine.advanceTick();
  assert.equal(site.lifecycle_stage, 'operation');

  engine.advanceTick();
  assert.equal(site.lifecycle_stage, 'operation', 'nothing promotes it past operation on its own');
  assert.ok(site.condition < 100, 'and it starts wearing once it is open');
});

// The citizen has to be able to see it, which is the second half of the
// locked Definition of Done -- "observe and be affected by".
test('a citizen dashboard reports what that citizen owns', () => {
  const npc = engine.generateNPC();
  const player = engine.generatePlayer({ linkedEntityId: npc.id });
  const home = engine.generateProperty({
    type: 'residential', value: 140000, lifecycleStage: 'operation',
  });

  const empty = engine.getCitizenDashboard(player.id);
  assert.equal(empty.propertySummary.count, 0, 'a citizen who owns nothing says so');
  assert.equal(empty.propertySummary.totalValue, 0);

  engine.recordOwnership({
    entityId: home.id, ownerEntityId: npc.id, ownerType: 'individual',
    acquiredMethod: 'purchased', tick: engine.WorldState.tick,
  });

  const held = engine.getCitizenDashboard(player.id);
  assert.equal(held.propertySummary.count, 1);
  assert.equal(held.propertySummary.totalValue, 140000);
  assert.equal(held.propertySummary.properties[0].id, home.id);
  assert.equal(held.propertySummary.properties[0].acquiredMethod, 'purchased');
});

test('wear shows up on the citizen dashboard, not just in the engine', () => {
  const npc = engine.generateNPC();
  const player = engine.generatePlayer({ linkedEntityId: npc.id });
  const home = engine.generateProperty({
    type: 'residential', value: 200000, lifecycleStage: 'operation',
  });
  engine.recordOwnership({
    entityId: home.id, ownerEntityId: npc.id, ownerType: 'individual', tick: engine.WorldState.tick,
  });

  const before = engine.getCitizenDashboard(player.id).propertySummary.totalValue;
  for (let i = 0; i < 5; i += 1) engine.advanceTick();
  const after = engine.getCitizenDashboard(player.id).propertySummary.totalValue;

  assert.ok(after < before, `holdings should lose value as the building wears (${before} -> ${after})`);
  assert.equal(home.value, 200000, 'while the assessed value on the row never moved');
});

// Repeated subtraction of 0.4 in binary floating point drifts into
// 86.39999999999998, which is noise, not precision -- and every screen
// showing a condition would have to round it back.
test('condition stays a clean number however many ticks it wears', () => {
  const world = freshWorld();
  const shop = property.generateProperty(world, {
    type: 'commercial', value: 100000, lifecycleStage: 'operation',
  });

  for (let i = 0; i < 12; i += 1) property.advancePropertyLifecycle(world, shop, i);

  assert.equal(shop.condition, 95.2);
  assert.equal(String(shop.condition).replace('.', '').length <= 4, true,
    `condition should read cleanly, got ${shop.condition}`);
});
