// The takeover key — what it takes to hold something, from a
// one-bedroom apartment to an entire country.
//
// ---------------------------------------------------------------------
// What this closes
//
// `COMPOSITION_REQUIREMENTS_TRIBE_COHESION.md` is forty-two lines and
// gives both shapes outright — `ControlKeyComposition` with its
// `requiredRoles`, and `TakeoverAttemptResolution` with
// `compositionRequirementMet`, `tribeCohesionScore` and
// `finalSuccessProbability`. `TRIBE_GROWTH_MISSION_UNLOCK_SYSTEM.md`
// adds the specialist half: "a Hospital needs medical experts", and
// recruiting somebody with water-treatment experience is what makes the
// water plant viable. `VACANCY_SEED.md` records both as unbuilt, and
// `grep -rn "Control Key\|controlKey" server/` agreed.
//
// The two things those documents cite as ALREADY built and which were
// not are separate commits, because each was a dead field:
// `employment_records.position` (written by nothing, so "a Hospital
// needs medical experts" had nothing to ask) and `families.unity` /
// `.conflict` (50 and 0 everywhere, written by nothing, so the cohesion
// multiplier would have been a constant).
//
// ---------------------------------------------------------------------
// Where the numbers come from
//
// The composition is 5:10:1 because that is the document's own example,
// used as a RATIO rather than as counts — and the magnitude comes from
// how many people are holding the target now. So the document's worked
// example is exactly what this produces for something sixteen people
// hold, and no per-scale constants had to be guessed. The only other
// figure is `FORCE_PARITY`, which is 1.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const control = require('../server/control.js');
const occupations = require('../server/occupations.js');
const familyTraits = require('../server/familyTraits.js');
const engine = require('../server/engine.js');
const actions = require('../server/actions.js');

// ---------------------------------------------------------------------
// A world with exactly what the composition check reads.
//
// Constructed rather than generated (standing rule 8): every assertion
// is about a specific role count or a specific occupation.
// ---------------------------------------------------------------------
const YEAR = 365;

function world(options = {}) {
  const { tick = 10000 } = options;
  const age = (years) => tick - Math.round(years * YEAR);
  return {
    tick,
    seed: 'control-test',
    families: [{
      id: 900, surname: 'Vance', unity: 50, conflict: 0, head_npc_id: 1,
    }],
    familyMemberships: [],
    npcs: [],
    relationships: [],
    memories: [],
    employmentRecords: [],
    organizations: [],
    properties: [],
    ownershipRecords: [],
    infrastructure: [],
    communities: [],
    cities: [],
    civilizations: [],
    entityTraits: [],
    entityOrganizationMemberships: [],
    events: [],
    inventory: [],
    barterItems: [],
    age,
  };
}

// **A takeover needs things, not only bodies** — `requiredMateriel` is
// §26 categories, so a fixture that is testing the PEOPLE half has to
// carry kit or every assertion picks up a tools shortfall it is not
// about. One holding of plenty, on the first member, which is what
// `materielOf` sums across a tribe.
function kit(w, entityId, quantity = 200) {
  w.inventory.push({
    id: w.inventory.length + 1,
    holder_entity_id: entityId,
    item_name: 'Hammer',
    quantity,
    condition: 80,
  });
  w.inventory.push({
    id: w.inventory.length + 1,
    holder_entity_id: entityId,
    // §26 `protection` has no sourced item — there is not a weapon
    // among §27's seventeen — so a world that wants one supplies it
    // through `barterItems`, which is the extension point `items.js`
    // documents. Unpriced, like a book: this fixture is not testing
    // barter.
    item_name: 'Shield',
    quantity,
    condition: 80,
  });
  if (!w.barterItems.some((i) => i.name === 'Shield')) {
    w.barterItems.push({ name: 'Shield', category: 'protection' });
  }
}

let nextNpcId = 1;

// Adds somebody to the tribe, with an age and optionally a job.
function member(w, options = {}) {
  const { years = 30, position = null, organizationId = 500 } = options;
  const id = nextNpcId++;
  w.npcs.push({ id, status: 'alive', createdTick: w.age(years) });
  w.familyMemberships.push({
    entity_id: id, family_id: 900, role: 'sibling', generation_number: 1,
  });
  // The tribe's kit rides with its first member. Every assertion below
  // is about people, and a tribe with no tools fails on materiel before
  // the people half is ever reached.
  if (w.inventory.length === 0) kit(w, id);
  if (position) {
    w.employmentRecords.push({
      id, entity_id: id, employer_organization_id: organizationId, status: 'active', wage: 20, position,
    });
  }
  return id;
}

// Somebody holding the target, outside the tribe.
function defender(w, options = {}) {
  const { years = 30, propertyId = null } = options;
  const id = nextNpcId++;
  w.npcs.push({
    id, status: 'alive', createdTick: w.age(years), home_property_id: propertyId,
  });
  return id;
}

// ---------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------

test('the three roles partition a tribe’s adults and nobody else', () => {
  const w = world();
  const child = member(w, { years: 8 });
  const youth = member(w, { years: 22 });
  const worker = member(w, { years: 45 });
  const elder = member(w, { years: 70 });
  const fighter = member(w, { years: 30, position: 'enforcer' });

  const npcOf = (id) => w.npcs.find((n) => n.id === id);
  assert.equal(control.roleOf(w, npcOf(child)), null, 'a child is not labour');
  assert.equal(control.roleOf(w, npcOf(youth)), 'youth-labor');
  assert.equal(control.roleOf(w, npcOf(worker)), 'youth-labor');
  assert.equal(control.roleOf(w, npcOf(elder)), 'elder');
  assert.equal(control.roleOf(w, npcOf(fighter)), 'enforcer');
});

test('an enforcer is a job, not a trait threshold', () => {
  // Every Combat-skill occupation counts, and nothing else does —
  // checked against the taxonomy rather than restated here, so adding
  // a Combat occupation cannot leave this stale.
  const combat = occupations.OCCUPATION_NAMES
    .filter((n) => occupations.skillOf(n) === 'Combat');
  assert.ok(combat.length >= 2, 'the taxonomy has no Combat occupations to check');
  for (const position of combat) {
    const w = world();
    const id = member(w, { years: 30, position });
    assert.equal(control.roleOf(w, w.npcs.find((n) => n.id === id)), 'enforcer', position);
  }
  const w = world();
  const farmer = member(w, { years: 30, position: 'farmer' });
  assert.equal(control.roleOf(w, w.npcs.find((n) => n.id === farmer)), 'youth-labor');
});

test('an undateable person counts as nobody, not as a newborn', () => {
  // The `Number(null)` corollary. An NPC with no `createdTick` has no
  // age, and unknown is not zero.
  const w = world();
  w.npcs.push({ id: 99, status: 'alive' });
  assert.equal(control.roleOf(w, w.npcs.find((n) => n.id === 99)), null);
});

test('the dead are not on the roster', () => {
  const w = world();
  const a = member(w, { years: 30 });
  member(w, { years: 30 });
  assert.equal(control.rosterOf(w, 900).fielded, 2);
  w.npcs = w.npcs.filter((n) => n.id !== a);
  assert.equal(control.rosterOf(w, 900).fielded, 1);
});

// ---------------------------------------------------------------------
// The composition scales with who is holding it
// ---------------------------------------------------------------------

test('a one-bedroom apartment takes one person', () => {
  const w = world();
  w.properties.push({
    id: 10, type: 'residential', operating_organization_id: null, community_id: null,
  });
  defender(w, { propertyId: 10 });

  const composition = control.compositionFor(w, { scale: 'property', locationId: 10 });
  assert.equal(composition.defenders, 1);
  assert.equal(composition.total, 1);
  assert.deepEqual(composition.requiredSpecialists, []);
});

test('sixteen holders produce the document’s own worked example', () => {
  // 5 enforcers, 10 youth-labor, 1 elder. This is the whole reason the
  // ratio is a ratio: the document's example is a consequence of the
  // model rather than a constant copied into it.
  const w = world();
  w.properties.push({
    id: 20, type: 'commercial', operating_organization_id: null, community_id: null,
  });
  for (let i = 0; i < 16; i += 1) defender(w, { propertyId: 20 });

  const composition = control.compositionFor(w, { scale: 'property', locationId: 20 });
  assert.equal(composition.defenders, 16);
  assert.deepEqual(composition.requiredRoles, [
    { role: 'enforcer', count: 5 },
    { role: 'youth-labor', count: 10 },
    { role: 'elder', count: 1 },
  ]);
});

test('a hospital needs medical experts', () => {
  // `TRIBE_GROWTH_MISSION_UNLOCK_SYSTEM.md`'s sentence, as a check.
  const w = world();
  w.organizations.push({ id: 500, type: 'hospital', leader_id: null });
  const composition = control.compositionFor(w, { scale: 'organization', locationId: 500 });
  assert.deepEqual(composition.requiredSpecialists, [{ occupation: 'physician', count: 1 }]);
});

test('the water plant needs somebody who can run it', () => {
  // The document's own example, and the rung where the specialist
  // matters more than the crowd: nobody is holding an unmanned plant,
  // so the composition is one person — but not just any one person.
  const w = world();
  w.infrastructure.push({ id: 700, type: 'water_systems', city_id: 1 });
  const composition = control.compositionFor(w, { scale: 'infrastructure', locationId: 700 });
  assert.equal(composition.defenders, 0);
  assert.equal(composition.total, 1);
  assert.deepEqual(composition.requiredSpecialists, [{ occupation: 'plumber', count: 1 }]);
});

test('a road needs no specialist, because nobody in the taxonomy is a road', () => {
  const w = world();
  w.infrastructure.push({ id: 701, type: 'roads', city_id: 1 });
  const composition = control.compositionFor(w, { scale: 'infrastructure', locationId: 701 });
  assert.deepEqual(composition.requiredSpecialists, []);
});

test('a target that does not exist has no requirement, rather than an empty one', () => {
  assert.equal(control.compositionFor(world(), { scale: 'property', locationId: 999 }), null);
});

test('a scale that is not a scale throws rather than returning nothing', () => {
  assert.throws(
    () => control.compositionFor(world(), { scale: 'planet', locationId: 1 }),
    /is not a scale/,
  );
});

// ---------------------------------------------------------------------
// Resolution — the document's second shape
// ---------------------------------------------------------------------

function tribeAgainstAHospital() {
  const w = world();
  w.organizations.push({ id: 500, type: 'hospital', leader_id: null });
  // One person holding it: a hospital with one member of staff.
  const staff = defender(w);
  w.employmentRecords.push({
    id: 90, entity_id: staff, employer_organization_id: 500, status: 'active', wage: 40, position: 'physician',
  });
  return w;
}

test('meeting the headcount and missing the specialist is not a takeover', () => {
  const w = tribeAgainstAHospital();
  member(w, { years: 30 });
  member(w, { years: 30 });

  const resolution = control.assess(w, { scale: 'organization', locationId: 500, tribeId: 900 });
  assert.equal(resolution.compositionRequirementMet, false);
  assert.equal(resolution.finalSuccessProbability, 0);
  assert.deepEqual(resolution.shortfalls, [{ occupation: 'physician', need: 1, have: 0 }]);
});

test('recruiting the specialist is what opens the door', () => {
  // The unlock chain, as one assertion: the same tribe, the same
  // target, one new member whose occupation matches.
  const w = tribeAgainstAHospital();
  member(w, { years: 30 });
  const before = control.assess(w, { scale: 'organization', locationId: 500, tribeId: 900 });
  assert.equal(before.compositionRequirementMet, false);

  member(w, { years: 40, position: 'physician', organizationId: 501 });
  const after = control.assess(w, { scale: 'organization', locationId: 500, tribeId: 900 });
  assert.equal(after.compositionRequirementMet, true);
  assert.ok(after.finalSuccessProbability > 0);
});

test('cohesion is a multiplier, and a tribe at war with itself fails', () => {
  const w = tribeAgainstAHospital();
  member(w, { years: 30 });
  member(w, { years: 40, position: 'physician', organizationId: 501 });

  const ordinary = control.assess(w, { scale: 'organization', locationId: 500, tribeId: 900 });
  // A family at the schema's defaults scores 0.5, so meeting the
  // requirement exactly is a coin flip.
  assert.equal(ordinary.tribeCohesionScore, 0.5);
  assert.equal(ordinary.finalSuccessProbability, 0.5);

  // The same tribe, the same roster, at each other's throats.
  w.families[0].conflict = 90;
  const feuding = control.assess(w, { scale: 'organization', locationId: 500, tribeId: 900 });
  assert.equal(feuding.compositionRequirementMet, true, 'the requirement is still met');
  assert.ok(
    feuding.finalSuccessProbability < ordinary.finalSuccessProbability / 5,
    `conflict barely mattered: ${feuding.finalSuccessProbability}`,
  );
});

test('bringing three times what is needed is not three times as likely', () => {
  // The document's argument: "keeps the game from becoming a simple
  // recruitment-counting exercise."
  const w = tribeAgainstAHospital();
  member(w, { years: 40, position: 'physician', organizationId: 501 });
  const bare = control.assess(w, { scale: 'organization', locationId: 500, tribeId: 900 });
  for (let i = 0; i < 20; i += 1) member(w, { years: 30 });
  const mob = control.assess(w, { scale: 'organization', locationId: 500, tribeId: 900 });
  assert.equal(mob.finalSuccessProbability, bare.finalSuccessProbability);
});

test('a tribe that does not exist has no resolution', () => {
  assert.equal(
    control.assess(tribeAgainstAHospital(), { scale: 'organization', locationId: 500, tribeId: 1 }),
    null,
  );
});

// ---------------------------------------------------------------------
// attempt — the write-backs
// ---------------------------------------------------------------------

test('a successful takeover is recorded where the schema has a place for it', () => {
  const w = world();
  w.properties.push({
    id: 30, type: 'residential', operating_organization_id: null, community_id: null,
  });
  defender(w, { propertyId: 30 });
  member(w, { years: 30 });
  // Certainty, so the assertion is about the write-back and not the
  // draw: unity and cooperation at the top, no conflict.
  w.families[0].unity = 100;
  w.entityTraits = [];
  const resolution = control.attempt(w, {
    scale: 'property', locationId: 30, tribeId: 900, seed: 'certain',
  });
  assert.equal(resolution.compositionRequirementMet, true);
  if (resolution.succeeded) {
    assert.equal(w.ownershipRecords.length, 1);
    assert.equal(w.ownershipRecords[0].owner_entity_id, 900);
    assert.equal(w.ownershipRecords[0].owner_type, 'family');
    assert.equal(w.ownershipRecords[0].acquired_method, 'stolen');
  }
  // Standing rule 1's three write-backs, whichever way the draw went.
  assert.equal(w.memories.length, 1, 'the participant does not remember it');
  assert.equal(w.memories[0].expiration, 'permanent');
  assert.equal(resolution.events.length, 1);
  assert.match(resolution.events[0].type, /^takeover_(succeeded|failed)$/);
});

test('taking an organization installs the tribe’s head as its leader', () => {
  const w = world();
  w.organizations.push({ id: 500, type: 'club', leader_id: 7777 });
  member(w, { years: 30 });
  w.families[0].unity = 100;
  // A club has no defining post, so the requirement is headcount only,
  // and nobody is holding it — one person is enough.
  let result = null;
  for (let t = 0; t < 40 && (result === null || !result.succeeded); t += 1) {
    result = control.attempt(w, {
      scale: 'organization', locationId: 500, tribeId: 900, tick: 10000 + t, seed: 's',
    });
  }
  assert.ok(result.succeeded, 'forty attempts at p=1.0 cohesion never succeeded');
  assert.equal(w.organizations[0].leader_id, w.families[0].head_npc_id);
});

test('where the schema has no control column, the attempt says so', () => {
  // Rather than inventing one. `territory_blocks.faction_id` references
  // `factions(organization_id)` specifically, so a FAMILY taking a
  // block has nowhere to be written.
  const w = world();
  w.communities.push({ id: 400, city_id: 1 });
  member(w, { years: 30 });
  w.families[0].unity = 100;
  let result = null;
  for (let t = 0; t < 40 && (result === null || !result.succeeded); t += 1) {
    result = control.attempt(w, {
      scale: 'community', locationId: 400, tribeId: 900, tick: 10000 + t, seed: 's',
    });
  }
  assert.ok(result.succeeded);
  assert.equal(result.seized.recorded, null);
  assert.match(result.seized.declared, /territory_blocks/);
});

test('the draw is seeded on the occasion and repeats exactly', () => {
  // §88. The attempt is the subject of the draw — target, tribe, tick —
  // and not anybody's identity.
  const make = () => {
    nextNpcId = 1;
    const w = world();
    w.organizations.push({ id: 500, type: 'club', leader_id: null });
    member(w, { years: 30 });
    return w;
  };
  const first = control.attempt(make(), {
    scale: 'organization', locationId: 500, tribeId: 900, tick: 12345, seed: 'same',
  });
  const again = control.attempt(make(), {
    scale: 'organization', locationId: 500, tribeId: 900, tick: 12345, seed: 'same',
  });
  assert.equal(first.draw, again.draw);
  assert.equal(first.succeeded, again.succeeded);
});

test('doing it together moves the people who did it', () => {
  // Which then feeds `familyTraits.unityTarget`, so a tribe that wins
  // together is more cohesive for the next attempt and one that fails
  // is less. The loop the document's cohesion factor needs to be more
  // than a fixed number.
  const w = world();
  w.organizations.push({ id: 500, type: 'club', leader_id: null });
  const a = member(w, { years: 30 });
  const b = member(w, { years: 30 });
  control.attempt(w, {
    scale: 'organization', locationId: 500, tribeId: 900, tick: 10000, seed: 'together',
  });
  const rel = w.relationships.find(
    (r) => (r.entity_a_id === a && r.entity_b_id === b) || (r.entity_a_id === b && r.entity_b_id === a),
  );
  assert.ok(rel, 'no relationship between two people who attempted a takeover together');
  assert.ok(rel.trust >= 0 && rel.trust <= 100, `trust left the scale: ${rel.trust}`);
  assert.notEqual(rel.trust, 0);
});

// ---------------------------------------------------------------------
// viableTargetsFor — TribeGrowthOptionsExpansion
// ---------------------------------------------------------------------

test('a tribe is offered what it can actually take, best odds first', () => {
  const w = world();
  w.communities.push({ id: 400, city_id: 1 });
  w.cities.push({ id: 1, name: 'Testburgh' });
  w.organizations.push({ id: 500, type: 'hospital', leader_id: null });
  w.properties.push({
    id: 30, type: 'residential', operating_organization_id: null, community_id: 400,
  });
  defender(w, { propertyId: 30 });
  member(w, { years: 30 });

  const offered = control.viableTargetsFor(w, { tribeId: 900, cityId: 1 });
  assert.ok(offered.length > 0, 'nothing at all is takeable');
  // The hospital is not offered: no physician in the tribe.
  assert.ok(!offered.some((t) => t.scale === 'organization' && t.locationId === 500));
  // And sorted.
  for (let i = 1; i < offered.length; i += 1) {
    assert.ok(offered[i - 1].finalSuccessProbability >= offered[i].finalSuccessProbability);
  }
});

test('the unmet targets can be asked for, because that is the roadmap', () => {
  const w = world();
  w.organizations.push({ id: 500, type: 'hospital', leader_id: null });
  member(w, { years: 30 });
  const all = control.viableTargetsFor(w, { tribeId: 900, includeUnmet: true });
  const hospital = all.find((t) => t.locationId === 500);
  assert.ok(hospital);
  assert.equal(hospital.compositionRequirementMet, false);
  assert.deepEqual(hospital.shortfalls, [{ occupation: 'physician', need: 1, have: 0 }]);
});

// ---------------------------------------------------------------------
// The player verb
// ---------------------------------------------------------------------

test('a player takes a place for their own tribe, never for a named one', () => {
  const listed = actions.listActions('citizen').map((a) => a.action);
  assert.ok(listed.includes('assess-takeover'));
  assert.ok(listed.includes('attempt-takeover'));

  const npc = engine.generateNPC();
  const family = engine.generateFamily({ surname: 'Osei' });
  engine.addFamilyMember(family.id, npc.id, 'founder', 1);
  const player = engine.generatePlayer({ linkedEntityId: npc.id });

  // A body that names a tribe is not refused — `tribeId` is not an
  // actor field — it is simply never read, so this asserts the tribe
  // that came back is the actor's own.
  const org = engine.generateOrganization({ name: 'A Club', type: 'club' });
  const response = engine.dispatchAction(player.id, {
    action: 'assess-takeover', scale: 'organization', locationId: org.id, tribeId: 1,
  });
  assert.equal(response.result.resolution.tribeId, family.id);
});

test('somebody with no family cannot attempt a takeover, and is told why', () => {
  const npc = engine.generateNPC();
  const player = engine.generatePlayer({ linkedEntityId: npc.id });
  const org = engine.generateOrganization({ name: 'Another Club', type: 'club' });
  assert.throws(
    () => engine.dispatchAction(player.id, {
      action: 'attempt-takeover', scale: 'organization', locationId: org.id,
    }),
    /belongs to no family/,
  );
});

test('a player’s takeover lands in the event log like any other event', () => {
  const npc = engine.generateNPC();
  const family = engine.generateFamily({ surname: 'Brennan' });
  engine.addFamilyMember(family.id, npc.id, 'founder', 1);
  // Old enough to count as labour at all.
  npc.createdTick = engine.WorldState.tick - 30 * YEAR;
  const player = engine.generatePlayer({ linkedEntityId: npc.id });
  const org = engine.generateOrganization({ name: 'Third Club', type: 'club' });

  const before = engine.WorldState.events.length;
  const { result } = engine.dispatchAction(player.id, {
    action: 'attempt-takeover', scale: 'organization', locationId: org.id,
  });
  assert.equal(engine.WorldState.events.length, before + 1);
  assert.equal(result.events[0].id > 0, true, 'the event has no id, so it never went through the Event phase');
  assert.match(result.events[0].type, /^takeover_(succeeded|failed)$/);
});

// ---------------------------------------------------------------------
// The constants are traceable
// ---------------------------------------------------------------------

test('every constant here comes from the document or from the engine', () => {
  // The ratio is the document's, verbatim.
  assert.deepEqual(control.COMPOSITION_RATIO, { enforcer: 5, 'youth-labor': 10, elder: 1 });
  assert.equal(control.RATIO_TOTAL, 16);
  // Parity, so nothing was tuned.
  assert.equal(control.FORCE_PARITY, 1);
  // The severity cut is the document's example composition, not a
  // feeling about scale.
  assert.equal(control.SIGNIFICANT_FORCE, control.RATIO_TOTAL);
  // And the elder age is `statistics.elder_share`'s own.
  assert.equal(control.ELDER_AGE, 65);
});

test('the specialist vocabulary lives in one file', () => {
  // `occupations.DEFINING_POST` is read by `worldgen` to staff an
  // institution and by `control` as a takeover requirement. Every post
  // it names has to be a real occupation, or a requirement can never be
  // met (standing rule 6).
  for (const [type, post] of Object.entries(occupations.DEFINING_POST)) {
    assert.ok(occupations.definitionOf(post), `${type} requires "${post}", which is not an occupation`);
  }
  for (const [type, post] of Object.entries(occupations.INFRASTRUCTURE_POST)) {
    assert.ok(occupations.definitionOf(post), `${type} requires "${post}", which is not an occupation`);
  }
});

test('cohesion comes from the family fields the document names', () => {
  // Not restated here — the point is that `control` reads
  // `familyTraits.cohesionOf` rather than composing unity and conflict
  // a second way.
  const w = world();
  w.organizations.push({ id: 500, type: 'club', leader_id: null });
  member(w, { years: 30 });
  const resolution = control.assess(w, { scale: 'organization', locationId: 500, tribeId: 900 });
  assert.equal(resolution.tribeCohesionScore, familyTraits.cohesionOf(w, 900));
});

// ---------------------------------------------------------------------
// Materiel — a takeover needs things, not only bodies
// ---------------------------------------------------------------------

test('a tribe with the people and no tools cannot take anything', () => {
  // `assess` read only people until this existed: a tribe of twenty
  // could take a government building barehanded.
  const w = world();
  w.organizations.push({ id: 500, type: 'club', leader_id: null });
  member(w, { years: 30 });
  // Strip the kit the fixture rides with, so this is the same tribe
  // with nothing in its hands.
  w.inventory = [];

  const barehanded = control.assess(w, { scale: 'organization', locationId: 500, tribeId: 900 });
  assert.equal(barehanded.compositionRequirementMet, false);
  assert.ok(
    barehanded.shortfalls.some((s) => s.category === 'tools'),
    `no tools shortfall: ${JSON.stringify(barehanded.shortfalls)}`,
  );

  kit(w, w.npcs[0].id);
  const armed = control.assess(w, { scale: 'organization', locationId: 500, tribeId: 900 });
  assert.equal(armed.compositionRequirementMet, true);
});

test('requirements are §26 categories, not invented items', () => {
  // §27 gives values for seventeen items and not one of them is a
  // weapon. Naming one would put a fabricated item in the one table
  // that exists to hold sourced ones.
  const items = require('../server/items.js');
  const w = world();
  w.organizations.push({ id: 500, type: 'club', leader_id: null });
  member(w, { years: 30 });
  const composition = control.compositionFor(w, { scale: 'organization', locationId: 500 });
  assert.ok(composition.requiredMateriel.length > 0);
  for (const requirement of composition.requiredMateriel) {
    assert.ok(
      items.TRADE_CATEGORIES.includes(requirement.category),
      `"${requirement.category}" is not one of §26's twenty categories`,
    );
    assert.ok(requirement.count > 0);
  }
});

test('what a tribe carries is summed across its members, by quantity', () => {
  const w = world();
  const a = member(w, { years: 30 });
  const b = member(w, { years: 30 });
  w.inventory = [];
  kit(w, a, 3);
  kit(w, b, 4);
  const carried = control.materielOf(w, 900);
  assert.equal(carried.tools, 7, 'five hammers in one holding is five tools');
  assert.equal(carried.protection, 7);
  // Somebody outside the tribe carries nothing for it.
  const outsider = defender(w);
  kit(w, outsider, 99);
  assert.equal(control.materielOf(w, 900).tools, 7);
});

// ---------------------------------------------------------------------
// The crew — it is not the amount of people, it is the type
// ---------------------------------------------------------------------

test('a place is kept by named posts, not by interchangeable bodies', () => {
  // The correction. The first maintain key asked for ONE specialist and
  // split the rest across the generic 5:10:1 role ratio, so a hospital
  // needed "1 physician" and thirty anybodies.
  const landmarks = require('../server/landmarks.js');
  const w = world();
  for (let i = 0; i < 12; i += 1) {
    w.properties.push({
      id: 7000 + i, type: 'residential', land_size: 400, floors: 2, units: 1, occupants: [],
    });
  }
  w.properties.push({
    id: 8000, type: 'government', land_size: 9000, floors: 4, units: 1, occupants: [],
    landmark_category: 'government-building', history_ref: null,
  });

  const maintain = control.maintenanceFor(w, { scale: 'property', locationId: 8000 });
  assert.ok(Array.isArray(maintain.crew), 'a government building has no crew');
  const posts = maintain.crew.map((p) => p.occupation);
  // The request's own worked example: cooks, security, an engineer.
  assert.ok(posts.includes('cook'));
  assert.ok(posts.includes('officer'));
  assert.ok(posts.includes('engineer'));
  // Security is counted from the crew's Combat posts, not from a share
  // of a generic ratio.
  assert.ok(maintain.security > 0);
  assert.equal(
    maintain.security,
    maintain.crew.filter((p) => occupations.skillOf(p.occupation) === 'Combat')
      .reduce((sum, p) => sum + p.count, 0),
  );
  // And the crew IS the requirement.
  assert.equal(maintain.total, maintain.crew.reduce((sum, p) => sum + p.count, 0));
  void landmarks;
});

test('a place with no crew still has a requirement', () => {
  // An ordinary house is not a category and never will be, so the
  // generic role composition remains the answer for it.
  const w = world();
  w.properties.push({
    id: 9000, type: 'residential', land_size: 400, floors: 2, units: 1, occupants: [],
  });
  const maintain = control.maintenanceFor(w, { scale: 'property', locationId: 9000 });
  assert.equal(maintain.crew, null);
  assert.ok(maintain.requiredRoles.length > 0);
  assert.equal(maintain.total, 1);
});
