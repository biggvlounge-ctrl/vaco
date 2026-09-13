// Does a generated world actually contain the systems this engine has?
//
// **Seventeen tables the engine writes had zero rows in every world it
// had ever built.** Not broken — uncalled. The whole politics stack,
// civilizations, technology eras, cultures, markets, artifacts,
// missions and inventory were each built, tested, green, and reachable
// only by a caller that did not exist.
//
// Two of the per-tick drivers were already wired and idle for want of a
// subject: `runPolitics` snapshotted public opinion every tick with no
// government to have an opinion about, and `runTechnology` climbed the
// era ladder every tick with no civilization to climb it. Neither was
// failing. Both were running on an empty set.
//
// That is the eleventh standing rule — a generator nothing calls is
// indistinguishable from a generator that does not exist — and the
// reason this file tests `worldgen` rather than the modules. Every
// module below already had a green suite while its table was empty in
// every real world, so a test of the module could not have caught it.
// Only a test of the WORLD can.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const engine = require('../server/engine.js');
const worldgen = require('../server/worldgen.js');
const politics = require('../server/politics.js');
const technology = require('../server/technology.js');

// One built world, ticked, shared by every test here — building it is
// the expensive part and each test asks a different question of it.
let built = null;
function world() {
  if (built) return built;
  const w = engine.WorldState;
  const summary = worldgen.generateWorld({
    communitiesPerCity: 2, populationPerCommunity: 20, seed: 'fullness',
  });
  for (let t = 0; t < 40; t += 1) engine.advanceTick();
  built = { w, summary };
  return built;
}

// -- the tables that were empty -----------------------------------------

test('a generated world has a civilization on the technology ladder', () => {
  const { w } = world();
  assert.ok(w.civilizations.length > 0, 'no world has ever had a civilization in it');
  assert.equal(w.technologyEras.length, technology.ERA_NAMES.length,
    'the era ladder was not seeded, so runTechnology has nothing to climb');
  assert.ok(w.civilizationTechnologyProgress.length > 0,
    'a civilization exists and has unlocked nothing — the ladder is unreachable');
});

test('a generated world is governed', () => {
  const { w } = world();
  assert.equal(w.governments.length, 1);

  // Standing rule 4: a government is an organization subtype, so the
  // row must point at a real organization that is actually typed as one.
  const government = w.governments[0];
  const organization = w.organizations.find((o) => o.id === government.organization_id);
  assert.ok(organization, 'the government points at no organization');
  assert.equal(organization.type, 'government');
  assert.ok(politics.SYSTEM_TYPES.includes(government.system_type));

  assert.ok(w.laws.length > 0, 'a government with no law on the books has enacted nothing');
  for (const law of w.laws) {
    assert.ok(politics.LAW_CATEGORIES.includes(law.category),
      `law ${law.id} has category "${law.category}", which the schema does not enumerate`);
  }
});

test('public opinion accumulates once there is something to have an opinion about', () => {
  // `runPolitics` was in the tick the whole time. It had no subject.
  const { w } = world();
  assert.ok(w.publicOpinion.length > 0,
    'runPolitics ran 40 times and recorded no opinion');
});

test('an election is held, and people vote in it', () => {
  const { w } = world();
  assert.ok(w.elections.length > 0, 'no election was ever scheduled');
  assert.ok(w.votes.length > 0, 'an election was held and nobody voted');

  // A closed election with a clear result installs a leader, which is
  // the only thing that makes the vote matter.
  const closed = w.elections.filter((e) => e.status === 'closed');
  assert.ok(closed.length > 0, 'an election opened and never closed');

  // Nobody votes twice — the schema has no unique constraint, so this
  // is the only thing enforcing it.
  for (const election of w.elections) {
    const voters = w.votes.filter((v) => v.election_id === election.id)
      .map((v) => v.voter_entity_id);
    assert.equal(new Set(voters).size, voters.length,
      `somebody voted twice in election ${election.id}`);
  }
});

test('a term ends and the next election is scheduled, rather than one forever', () => {
  // Standing rule 7's shape. `runElections` drives a cycle; a version
  // that scheduled whenever no election was open would have put one in
  // the log every tick.
  const { w } = world();
  const perGovernment = new Map();
  for (const election of w.elections) {
    const list = perGovernment.get(election.organization_id) ?? [];
    list.push(election);
    perGovernment.set(election.organization_id, list);
  }
  for (const [organizationId, list] of perGovernment) {
    assert.ok(list.length <= 3,
      `government ${organizationId} has ${list.length} elections after 40 ticks — `
      + 'the cycle is firing on a condition rather than a crossing');
    assert.ok(list.filter((e) => e.status === 'open').length <= 1,
      `government ${organizationId} has two elections open at once`);
  }
});

test('a generated world has cultures, and people in them', () => {
  const { w } = world();
  assert.ok(w.cultures.length > 0, 'Culture DNA is built and no world has ever had one');
  assert.ok(w.cultureMemberships.length > 0, 'cultures exist and nobody belongs to one');
});

test('a generated world has a market, priced from the real catalogue', () => {
  const { w } = world();
  assert.ok(w.marketListings.length > 0,
    'market_listings was empty, so resolveMarketPrice had nothing to resolve');
  for (const listing of w.marketListings) {
    assert.ok(Number(listing.price) > 0, `listing ${listing.id} is priced at nothing`);
    assert.ok(listing.product_name, `listing ${listing.id} sells nothing`);
  }
});

test('a generated world has artifacts and missions to take', () => {
  // The engine's only player verb had nothing to act on.
  const { w } = world();
  assert.ok(w.artifacts.length > 0);
  assert.ok(w.missions.length > 0, 'listMissions returned nothing in every world ever built');
  for (const mission of w.missions) {
    assert.ok(w.artifacts.some((a) => a.id === mission.artifact_id),
      `mission ${mission.id} points at an artifact that does not exist`);
  }
});

test('people are carrying something', () => {
  const { w } = world();
  assert.ok(w.inventory.length > 0,
    'inventory was empty, so valueOfHoldings was zero for everybody and a trade moved nothing');
  // `holder_entity_id`, not `entity_id` — `inventory.give` names the
  // column after what it means, and reading the wrong one here reported
  // a single holder for eighty rows.
  const holders = new Set(w.inventory.map((r) => r.holder_entity_id));
  assert.ok(holders.size > w.npcs.length / 2,
    `only ${holders.size} of ${w.npcs.length} people are carrying anything`);
});

// -- and it is still the same world -------------------------------------

test('the world is still reproducible from its seed', () => {
  // §88. Everything added above draws from `makeRandom`, and a
  // generator that reached for Math.random would break determinism
  // silently — the world would look fine and never be the same twice.
  const first = worldgen.generateWorld({
    communitiesPerCity: 1, populationPerCommunity: 10, seed: 'repeat',
  });
  const second = worldgen.generateWorld({
    communitiesPerCity: 1, populationPerCommunity: 10, seed: 'repeat',
  });

  // Compare the shape rather than ids: ids come from counters whose
  // state depends on what was built before, which is the "seed on
  // position, never on identity" rule.
  for (const key of ['laws', 'cultures', 'marketListings', 'artifacts', 'missions',
    'inventoryRows', 'cultureMembers', 'erasUnlocked']) {
    assert.equal(first[key], second[key], `${key} differed between two runs of one seed`);
  }
});

test('generation reports what it built, so a caller can check', () => {
  const { summary } = world();
  for (const key of ['civilizationId', 'governmentId', 'laws', 'cultures',
    'marketListings', 'artifacts', 'missions', 'inventoryRows']) {
    assert.ok(summary[key] !== undefined, `the summary does not mention ${key}`);
  }
});
