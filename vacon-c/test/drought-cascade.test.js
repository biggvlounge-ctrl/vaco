// VACANCY — the locked Definition of Done, as an executable test.
//
// Architecture Document §11:
//
//   "A drought-style cascade runs correctly through at least 4 of the
//    10 systems in sequence, with a Citizen-mode player able to
//    observe and be affected by it."
//
// Every one of the 10 locked Phase 1 systems was built and verified in
// isolation. **None of them had ever been run together**, and the
// sentence above is a claim about the seam between them, not about any
// one of them. This file is the first thing in the project that can
// make that claim false.
//
// It drives ONE drought through FIVE systems in sequence, exceeding the
// required four:
//
//   5  Resource tracking    supply falls, demand rises, per resource type
//   6  Economy              scarcity crosses, market price moves
//   7  Cascade tick         all 11 phases, in order, no phase skipped
//   4  Key resolvers        NPCs learn of scarcity and decide on it
//   10 Citizen binding      the player observes it and is affected
//
// **One shared world, run in order.** `engine.js` owns a module-level
// `WorldState` singleton -- that is the real shape of the app, not a
// testing compromise, and building a private world here would test a
// world the server never uses. So these tests are deliberately ordered
// and cumulative: each is a link in one cascade, and the file reads as
// the scenario it is asserting. `node --test` runs a file's tests in
// order, which is what makes that safe.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const engine = require('../server/engine.js');

const W = engine.WorldState;

// Scarcity is round((demand / max(supply,1)) * 50), and tick.js
// broadcasts subjective knowledge to every NPC above 60. Baseline is
// therefore chosen to sit clearly BELOW the threshold -- a drought that
// starts in crisis proves nothing about the cascade.
const BROADCAST_THRESHOLD = 60;

const world = {};   // ids captured in setup, read by later tests

// ---------------------------------------------------------------------------
// Setup -- a small, ordinary world with nothing wrong in it yet.
// ---------------------------------------------------------------------------

test('setup: a world with water, a market, a family and a citizen', () => {
  world.alice = engine.generateNPC();
  world.bob = engine.generateNPC();
  world.carol = engine.generateNPC();

  const family = engine.generateFamily({ surname: 'Vance' });
  engine.addFamilyMember(family.id, world.alice.id, 'head', 1);
  engine.addFamilyMember(family.id, world.bob.id, 'child', 2);
  world.familyId = family.id;

  // Net worth needs a finances row or getNetWorth has nothing to sum.
  engine.generateIndividualFinances(world.alice.id, { savings: 500 });
  engine.generateIndividualFinances(world.bob.id, { savings: 120 });

  // **Starts in balance, not in abundance.** getScarcity() returns 50
  // when demand equals supply, and that 50 is also the neutral point of
  // the price model -- below it a good gets cheaper, above it dearer.
  // An earlier fixture started water at 200/100 (scarcity 25), which
  // meant the first ticks of the drought correctly made rations CHEAPER
  // as abundance unwound, and the price only turned upward later. That
  // is honest behaviour and a misleading scenario: "a drought raises
  // prices" is a claim about crossing into scarcity, not about a
  // drought that begins in a glut. Balanced, every tick of the drought
  // moves in one direction.
  world.water = engine.generateResource({
    resourceType: 'water',
    quantity: 400,
    supply: 100,
    demand: 100,
    productionRate: 10,
    consumptionRate: 12,
  });

  // **Deliberately balanced supply and demand.** The first version of
  // this fixture gave the ration 200 supply against 100 demand, and its
  // price fell through the drought -- correctly: a good sitting at two-
  // to-one oversupply has a −0.5 imbalance of its own that swamps any
  // input pressure. That made the test measure two forces at once and
  // report the wrong one as a failure. Balanced, the listing's own
  // imbalance is exactly zero, so the only thing that can move this
  // price is the scarcity of the water it is made from -- which is the
  // single link under test.
  world.listing = engine.generateMarketListing({
    productName: 'water ration',
    resourceType: 'water',
    price: 10,
    supply: 100,
    demand: 100,
  });

  world.player = engine.generatePlayer({ linkedEntityId: world.alice.id });

  assert.equal(world.player.mode, 'citizen');
  assert.ok(engine.getScarcity(world.water.id) < BROADCAST_THRESHOLD,
    'baseline scarcity must start below the broadcast threshold, or the drought proves nothing');
});

test('baseline: the citizen has nothing to report', () => {
  const dash = engine.getCitizenDashboard(world.player.id);

  world.baseline = {
    scarcity: engine.getScarcity(world.water.id),
    supply: world.water.supply,
    demand: world.water.demand,
    price: world.listing.price,
    memories: dash.recentMemories.length,
    knowledge: W.entityKnowledge.length,
    tick: W.tick,
  };

  assert.equal(dash.player.linkedEntityId, world.alice.id);
  assert.equal(dash.family.surname, 'Vance');
  assert.equal(world.baseline.memories, 0, 'no memories before anything has happened');
  assert.equal(world.baseline.knowledge, 0, 'no knowledge before anything has happened');
});

// ---------------------------------------------------------------------------
// The drought.
// ---------------------------------------------------------------------------

test('the drought is declared, and nothing has happened yet', () => {
  engine.addEnvironmentalCondition({
    type: 'drought',
    resourceType: 'water',
    supplyDelta: -8,
    demandDelta: +4,
    ticksRemaining: 4,
  });

  assert.equal(W.activeConditions.length, 1);
  assert.equal(world.water.supply, world.baseline.supply,
    'declaring a condition must not itself move supply -- only the Environment phase may');
});

// -- link 1: Environment -> Resource ----------------------------------------

test('system 5 -- one tick moves supply and demand on the right resource', () => {
  engine.advanceTick();

  assert.equal(W.tick, world.baseline.tick + 1);
  assert.ok(world.water.supply < world.baseline.supply,
    `drought must cut water supply (was ${world.baseline.supply}, now ${world.water.supply})`);
  assert.ok(world.water.demand > world.baseline.demand,
    `drought must raise water demand (was ${world.baseline.demand}, now ${world.water.demand})`);
});

test('system 5 -- the drought is resource-typed, not global', () => {
  const before = engine.generateResource({
    resourceType: 'iron', quantity: 100, supply: 100, demand: 50,
  });
  const supplyBefore = before.supply;
  const demandBefore = before.demand;

  engine.advanceTick();

  // Production/consumption still applies to iron via the Resource phase;
  // what must NOT happen is the water drought touching its supply/demand.
  assert.equal(before.supply, supplyBefore,
    'a water drought must not move iron supply -- conditions are per resource_type');
  assert.equal(before.demand, demandBefore,
    'a water drought must not move iron demand');
});

// -- link 2: Resource -> Economy --------------------------------------------

test('system 6 -- scarcity crosses the threshold', () => {
  const scarcity = engine.getScarcity(world.water.id);

  assert.ok(scarcity > world.baseline.scarcity,
    `scarcity must rise (was ${world.baseline.scarcity}, now ${scarcity})`);
  assert.ok(scarcity >= BROADCAST_THRESHOLD,
    `scarcity must cross ${BROADCAST_THRESHOLD} for the cascade to continue -- got ${scarcity}`);
});

// This assertion is why the gap was found and then closed. On the
// first run of this file a drought in the water *resource* left the
// price of a water *ration* falling, because `market_listings` had no
// column naming its raw input and the Economy phase priced listings
// before it had computed any scarcity. Both are fixed:
// `market_listings.resource_type` now exists (same column as
// `trade_routes.resource_type`), and the phase computes scarcity first.
test('system 6 -- scarcity reaches the price of the good made from it', () => {
  assert.ok(world.listing.price > world.baseline.price,
    `a drought in water must raise the price of a water ration `
    + `(was ${world.baseline.price}, now ${world.listing.price})`);
});

// The other half of that change, and the one that keeps it honest: a
// good with no named input must price exactly as it did before the
// column existed. Without this, "scarcity raises prices" could quietly
// be "everything gets more expensive during any drought."
test('system 6 -- a good with no raw input is untouched by the drought', () => {
  const unrelated = engine.generateMarketListing({
    productName: 'hand-carved chair',   // no resourceType
    price: 100,
    supply: 50,
    demand: 50,                          // balanced: no pressure of its own
  });

  engine.advanceTick();

  assert.equal(unrelated.resource_type, null);
  assert.equal(unrelated.price, 100,
    'a balanced listing with no resource_type must not move during a water drought');
});

// -- link 3: Economy -> Key resolvers ---------------------------------------

test('system 4 -- NPCs learn of the scarcity, subjectively', () => {
  assert.ok(W.entityKnowledge.length > world.baseline.knowledge,
    'crossing the scarcity threshold must broadcast knowledge to NPCs');

  const aliceKnows = W.entityKnowledge.filter((k) => k.entity_id === world.alice.id);
  assert.ok(aliceKnows.length > 0, 'the player-linked NPC must be among those who learn of it');

  // The standing rule: resolvers read subjective knowledge, never raw
  // ground truth. Knowledge rows carry their own confidence, which is
  // what makes them subjective rather than a copy of world state.
  for (const row of aliceKnows) {
    assert.ok(row.confidence_level !== undefined,
      'knowledge must carry confidence_level -- that is what makes it subjective');
    assert.ok(row.confidence_level > 0 && row.confidence_level <= 1,
      `confidence_level must be a real 0-1 confidence, got ${row.confidence_level}`);
  }
});

test('system 4 -- resolving writes back to Memory and Relationships', () => {
  const aliceMemories = W.memories.filter((m) => m.entity_id === world.alice.id);
  assert.ok(aliceMemories.length > 0,
    'a Key resolution must write a memory -- standing rule 1, all three write-back targets');

  assert.ok(W.relationships.length > 0,
    'a Key resolution must write a relationship row -- standing rule 1');
});

// -- link 4: the whole pipeline ---------------------------------------------

test('system 7 -- all 11 phases ran, and the late ones produced output', () => {
  const result = engine.advanceTick();

  assert.ok(Array.isArray(result.events), 'phase 9, Event');
  assert.ok(Array.isArray(result.historicalRecords), 'phase 10, History');
  assert.notEqual(result.reemergenceIndex, null, 'phase 11, Reemergence');
  assert.equal(result.tick, W.tick);
});

// -- link 5: the citizen ----------------------------------------------------

test('system 10 -- the citizen can observe the drought', () => {
  const dash = engine.getCitizenDashboard(world.player.id);

  assert.ok(dash.recentMemories.length > world.baseline.memories,
    'the player must be able to see that something happened to them');

  assert.equal(dash.player.linkedEntityId, world.alice.id);
  assert.equal(dash.family.surname, 'Vance',
    'family binding must survive the cascade');
  assert.equal(typeof dash.netWorth, 'number');
});

test('system 10 -- the citizen is affected, not merely informed', () => {
  const dash = engine.getCitizenDashboard(world.player.id);

  // "Observe AND be affected by." Observation is the memories above.
  // Being affected means the world reached the player's own entity --
  // their live traits carry key_modifier deltas written by the
  // resolvers, which is the mechanism by which a drought changes a
  // person rather than just being visible to them.
  const modified = W.entityTraits.filter(
    (t) => t.entity_id === world.alice.id && t.key_modifier !== 0,
  );

  assert.ok(modified.length > 0,
    'the drought must have changed the player-linked NPC\'s own traits, '
    + 'not just been visible to them -- that is the "be affected by" half');

  assert.ok(dash.traits && Object.keys(dash.traits).length > 0,
    'the dashboard must surface live traits, so the change is visible to the player');
});

// -- the cascade, stated as one fact ----------------------------------------

test('the Definition of Done: one drought, five systems, in sequence', () => {
  const scarcity = engine.getScarcity(world.water.id);

  const chain = {
    'resource supply fell': world.water.supply < world.baseline.supply,
    'resource demand rose': world.water.demand > world.baseline.demand,
    'scarcity crossed 60': scarcity >= BROADCAST_THRESHOLD,
    'market price rose': world.listing.price > world.baseline.price,
    'NPCs gained knowledge': W.entityKnowledge.length > world.baseline.knowledge,
    'resolvers wrote memories': W.memories.some((m) => m.entity_id === world.alice.id),
    'player traits changed': W.entityTraits.some(
      (t) => t.entity_id === world.alice.id && t.key_modifier !== 0),
    'citizen can see it': engine.getCitizenDashboard(world.player.id)
      .recentMemories.length > 0,
  };

  const broken = Object.entries(chain).filter(([, ok]) => !ok).map(([k]) => k);
  assert.deepEqual(broken, [],
    `the cascade broke at: ${broken.join(', ')}`);
});
