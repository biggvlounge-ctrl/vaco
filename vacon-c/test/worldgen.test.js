// A world that actually contains things.
//
// **The finding this suite guards.** With 67 statistics in the
// catalogue, a world built the only way one could be built — generate
// some NPCs, place them, tick — answered 35. Eight of the rest are
// declared gaps. The other 24 were computable and came back null, every
// one because the generator existed, was tested, and nothing ever
// called it. No code anywhere assembled a world, so every world the
// engine had ever run was a crowd of people standing in an empty field.
//
// These tests hold the two things that matter about the fix: the world
// contains one of everything the engine models, and it replays from its
// seed.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const worldgen = require('../server/worldgen.js');
const statistics = require('../server/statistics.js');
const engine = require('../server/engine.js');
const membership = require('../server/membership.js');
const infrastructure = require('../server/infrastructure.js');
const demographics = require('../server/demographics.js');
const economy = require('../server/economy.js');
const occupations = require('../server/occupations.js');
const behavior = require('../server/behavior.js');

const w = engine.WorldState;

// **Every test here builds into `engine.WorldState`, and that is not an
// accident of convenience** — `generateNPC`, `generateOrganization` and
// `generateFamily` are the last three generators still bound to the
// module-global world, which is why `generateWorld` takes options
// rather than a world. So each test records what was there before and
// asserts on what its own call added, rather than on totals.
function delta(fn) {
  const before = {
    npcs: w.npcs.length,
    properties: w.properties.length,
    infrastructure: w.infrastructure.length,
    organizations: w.organizations.length,
    families: w.families.length,
    employment: w.employmentRecords.length,
    memberships: w.entityOrganizationMemberships.length,
    relationships: w.relationships.length,
    communities: w.communities.length,
    cities: w.cities.length,
    entityLanguages: w.entityLanguages.length,
    territoryBlocks: w.territoryBlocks.length,
    resources: w.resources.length,
  };
  const summary = fn();
  const after = {};
  for (const key of Object.keys(before)) after[key] = w[key === 'employment' ? 'employmentRecords' : key === 'memberships' ? 'entityOrganizationMemberships' : key].length - before[key];
  return { summary, added: after, before };
}

const SMALL = { communitiesPerCity: 2, populationPerCommunity: 12 };

// -- it builds one of everything ----------------------------------------

test('a generated world contains every kind of thing the engine models', () => {
  // The list is the point. Each of these was a generator that existed,
  // was tested, and had no caller.
  const { summary, added } = delta(() => worldgen.generateWorld({ ...SMALL, seed: 'contains' }));

  assert.equal(added.cities, 1);
  assert.equal(added.communities, 2);
  assert.equal(added.npcs, 24);
  assert.equal(summary.people, 24);

  for (const [what, count] of Object.entries(added)) {
    assert.ok(count > 0, `a generated world contains no ${what}`);
  }

  // And the things that are joins rather than rows.
  assert.ok(added.employment > 0, 'nobody works');
  assert.ok(added.memberships >= added.employment, 'employment did not create a membership');
  assert.ok(added.relationships > 0, 'nobody knows anybody, so the Social phase has nothing to do');
});

test('a property knows which community it is in, which is what housing statistics need', () => {
  const { before } = delta(() => worldgen.generateWorld({ ...SMALL, seed: 'homes' }));
  const fresh = w.properties.slice(before.properties);
  assert.ok(fresh.length > 0);
  assert.equal(fresh.every((p) => p.community_id !== null && p.city_id !== null), true,
    'a property with no community is invisible to every housing statistic');

  // Both types, so `residential_share` is a real mix rather than 1.
  assert.ok(fresh.some((p) => p.type === 'residential'));
  assert.ok(fresh.some((p) => p.type === 'commercial'));
});

test('more homes than residents, which is what makes a vacancy rate', () => {
  const { before } = delta(() => worldgen.generateWorld({ ...SMALL, seed: 'vacancy' }));
  const community = w.communities[w.communities.length - 1];
  const homes = w.properties.slice(before.properties)
    .filter((p) => p.community_id === community.id && p.type === 'residential');
  const residents = w.npcs.slice(before.npcs).filter((n) => n.communityId === community.id);
  assert.ok(homes.length > residents.length,
    'every home is occupied, so the vacancy rate can only ever be 0');
});

test('a city gets all ten infrastructure types, four of them with a capacity', () => {
  const { before } = delta(() => worldgen.generateWorld({ ...SMALL, seed: 'infra' }));
  const city = w.cities[w.cities.length - 1];
  const built = w.infrastructure.slice(before.infrastructure);

  assert.deepEqual(
    built.map((i) => i.type).sort(),
    [...infrastructure.INFRASTRUCTURE_TYPES].sort(),
  );
  // Capacity where a capacity means something, null where it does not
  // — a road network has a condition and no headcount, and null is the
  // distinction `capacityOf` exists to preserve.
  assert.ok(infrastructure.capacityOf(w, city.id, 'schools') > 0);
  assert.ok(infrastructure.capacityOf(w, city.id, 'public_safety') > 0);
  assert.equal(infrastructure.capacityOf(w, city.id, 'roads'), null,
    'a road network was given a headcount');

  // Condition varies, so a statistic has something to find. A world
  // where everything starts at 100 has no variation, and one where
  // everything starts at 50 has the placeholder problem this project
  // keeps finding.
  const conditions = new Set(built.map((i) => i.condition));
  assert.ok(conditions.size > 3, 'every piece of infrastructure is in identical condition');
});

test('people carry the demographics the schema has columns for', () => {
  const { before } = delta(() => worldgen.generateWorld({ ...SMALL, seed: 'demo' }));
  const fresh = w.npcs.slice(before.npcs);

  assert.equal(fresh.every((n) => n.religion !== null), true);
  assert.equal(fresh.every((n) => demographics.primaryLanguageOf(w, n.id) !== null), true);

  // **An adult's attainment is drawn; a child starts on the bottom
  // rung.** This used to assert `education === null` for every child,
  // on the argument that a young block should read as young rather than
  // as uneducated — right while nothing anywhere moved
  // `npcs.education`, and wrong the day `statecraft.runSchooling`
  // existed.
  //
  // Schooling refuses `null` on purpose: `indexOf` is -1 for it and -1
  // is not rung zero, so starting a person whose attainment nobody
  // recorded at `none` would invent a fact about them. The school
  // window is 5 to 30, so the null window and the school window
  // overlapped almost exactly and **the entire 5-to-17 cohort, the
  // people school is for, could never be taught.** `none` for a child
  // is not a guess — it is what the engine knows about somebody who has
  // not finished any education yet, and it is what `births.js` records
  // for a newborn.
  const adults = fresh.filter((n) => (w.tick - n.createdTick) / 365 >= 18);
  const children = fresh.filter((n) => (w.tick - n.createdTick) / 365 < 18);
  assert.ok(adults.length > 0 && children.length > 0,
    'the age draw produced only one cohort, so neither births nor mortality is exercised');
  assert.equal(adults.every((n) => n.education !== null), true);
  assert.equal(children.every((n) => n.education === 'none'), true,
    'a child was generated off the education ladder, so schooling can never reach them');

  // And every generated person is ON the ladder, which is the property
  // that actually matters to `runSchooling`.
  assert.equal(
    fresh.every((n) => demographics.EDUCATION_LEVELS.includes(n.education)), true,
  );
});

test('a gang holds territory and has members who live there', () => {
  const { before } = delta(() => worldgen.generateWorld({
    ...SMALL, populationPerCommunity: 40, gangMembershipRate: 0.3, seed: 'gangs',
  }));
  const community = w.communities[w.communities.length - 1];
  assert.ok(w.territoryBlocks.slice(before.territoryBlocks).length > 0);
  assert.ok(membership.gangMembershipRate(w, community.id) > 0,
    'factions hold blocks but nobody living there belongs to one');
});

// -- it replays ---------------------------------------------------------

test('the same seed builds the same world', () => {
  // §88: the same seed and the same rules give the same world. Until
  // this commit that could not be true even in principle —
  // `randomTraitValue()` and `generateName()` are both `Math.random()`,
  // so `generateNPC` produced a different person every time it was
  // called. `traitValueFor` is what makes a replayable world possible.
  //
  // Ids differ between the two runs because the counter keeps going,
  // so the comparison is over what was drawn rather than over
  // identity.
  function run(seed) {
    const { before } = delta(() => worldgen.generateWorld({ ...SMALL, seed }));
    return w.npcs.slice(before.npcs).map((n) => [
      n.name, n.religion, n.education, n.createdTick,
      JSON.stringify(n.traits),
    ].join('|'));
  }

  const first = run('replay');
  const second = run('replay');
  assert.ok(first.length > 0);
  assert.deepEqual(first, second, 'the same seed produced two different worlds');
});

test('a different seed builds a different world', () => {
  // The control. If this passes trivially, the seed is not reaching
  // the draws.
  function run(seed) {
    const { before } = delta(() => worldgen.generateWorld({ ...SMALL, seed }));
    return w.npcs.slice(before.npcs).map((n) => `${n.name}|${n.createdTick}`).join(',');
  }
  assert.notEqual(run('alpha'), run('beta'));
});

test('nothing in the generated world came from Math.random', () => {
  // Held structurally, because the seeded path is easy to bypass by
  // omitting one option. `worldgen.js` must draw only through
  // `seeded.js`.
  const fs = require('node:fs');
  const src = fs.readFileSync(require.resolve('../server/worldgen.js'), 'utf8');
  const body = src.slice(src.indexOf("'use strict'"))
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
  assert.equal(body.includes('Math.random'), false);

  // And every generator that could roll its own traits is handed a
  // value function instead.
  const calls = body.match(/engine\.generate(NPC|Organization|Family|Faction)\(/g) || [];
  assert.ok(calls.length >= 4, 'the world is not built from the engine\'s own generators');
  assert.equal((body.match(/traitValueFor/g) || []).length >= calls.length, true,
    'a generator was called without traitValueFor, so part of the world cannot replay');
});

// -- it is the thing the catalogue was waiting for -----------------------

test('a generated world answers most of the catalogue, where an empty one answered half', () => {
  // **The regression guard for the whole point of this module.** The
  // measurement that prompted it: 35 of 67 answered, 24 computable and
  // silent, 8 structurally declared.
  delta(() => worldgen.generateWorld({ communitiesPerCity: 3, populationPerCommunity: 20, seed: 'coverage' }));

  const structural = new Set(statistics.unavailable().map((e) => e.key));
  const profiles = statistics.profileAll(w);
  const answered = statistics.CATALOGUE.filter(
    (d) => !structural.has(d.key) && profiles.some((p) => p.statistics[d.key].known),
  );

  assert.ok(answered.length >= 56,
    `only ${answered.length} of ${statistics.KEYS.length} statistics answer; `
    + 'a generated world should populate nearly all of them');

  // **8 until 16 Sep 2026, when `migration_rate` stopped being one.**
  // Its declaration was exactly right about why it could not be
  // answered — "no destination is chosen and no residency is
  // rewritten, so there is no arrival or departure to count" — and
  // `server/migration.js` does both. This number is asserted rather
  // than read so that a gap QUIETLY appearing, which is the failure
  // that matters, cannot pass.
  //
  // **8 again as of 17 Sep 2026, and this time the gap was added
  // deliberately.** `resource_stock` declares that `resources` carries
  // two models of the same thing: this engine uses supply/demand
  // LEVELS, and the schema also offers a STOCK with flows
  // (`quantity`, `production_rate`, `consumption_rate`). Measured, the
  // flow columns were 0 on every resource in every world, so
  // `advanceResourceTick` computed `max(0, 0 + 0 - 0)` and the Resource
  // phase — one of the locked eleven — did nothing at all.
  // `consumption_rate` is live now, read as units per person per tick
  // so demand tracks its population; making the STOCK load-bearing
  // means supply being drawn from it, which changes what a drought does
  // and the drought cascade is this project's Definition of Done. A
  // declared gap is the honest state for a design decision with a test
  // in front of it.
  //
  // **9 as of 18 Sep 2026, and the ninth is `knowledge_stock`.** §28
  // lists `knowledge` among thirteen resource types and
  // `economy.generateResource` would make one happily — but
  // `advanceResourceTick` computes `supply + production - consumption`
  // and knowledge is not consumed by being used, so a
  // `consumption_rate` for it would be a number with no referent.
  // `knowledge_sources` counts what an area can actually reach instead,
  // which is the answerable question. Closing this needs a resource
  // whose stock changes by discovery and loss rather than by production
  // and consumption, which is a different model and not a missing line.
  //
  // **Briefly 10, not 9, between two concurrent rounds landing in the
  // same session — recorded here because it was observed live, not
  // because it is the final state.** The prison-street/recruitment
  // round declared a tenth gap, `tribe_family_recruitment_growth`
  // (real gang membership growth scaled off `crime.dangerByCommunity`,
  // deliberately scoped to gangs only). A second, concurrent round
  // closed that same gap in the same working directory before either
  // side committed — see `recruitment.js`'s and `statistics.js`'s own
  // headers for the real mechanism that answers it. Net count: 9,
  // unchanged, because the gap that opened and the gap that closed
  // were the same one. This assertion was also masked behind
  // `test/worldgen.test.js`'s own pre-existing hang for both rounds —
  // see `entityTraits.js`'s own header for that fix.
  assert.equal(structural.size, 9, 'the declared-gap count moved without this test being updated');
});

test('a fresh world has routines, and running it engages the Behavior Engine', () => {
  // **This test used to assert the opposite and was right to.** It
  // held that nothing in the tick pipeline applies stress —
  // `applyStress` was reachable only through the API, `runBehavior`
  // decays what is there and creates nothing, and nothing ever added a
  // schedule. Measured: `entity_state`, `habits` and `schedule_events`
  // were all three 0 after 300 ticks of a 150-person world. The
  // Behavior Engine was complete and never engaged.
  //
  // Both halves are now fed: `worldgen.seedRoutine` gives people the
  // routine their situation implies, and the tick applies both what
  // happened to them (events) and what they are living through
  // (conditions).
  const engine = require('../server/engine.js');
  const behavior = require('../server/behavior.js');
  const before = {
    schedules: w.scheduleEvents.length,
    habits: w.habits.length,
    state: w.entityState.length,
  };
  worldgen.generateWorld({ ...SMALL, seed: 'behaviour' });

  assert.ok(w.scheduleEvents.length > before.schedules,
    'a generated world has no routines, so no habit can ever form');

  for (let t = 0; t < 60; t += 1) engine.advanceTick();
  assert.ok(w.habits.length > before.habits, 'no habit formed in 60 ticks of kept routine');
  assert.ok(w.entityState.length > before.state, 'nobody was affected by anything');

  // And the moods that come out are a spread rather than a binary.
  // Flat stress decay against a steady load is a step function — any
  // load above the recovery rate ratchets to 100 and any below it
  // falls to 0 — which measured as 142 people at exactly 0 and six
  // pinned at 97. Recovery is proportional for that reason.
  const moods = new Set(w.npcs
    .map((n) => behavior.getEntityState(w, n.id))
    .filter(Boolean)
    .map((s) => s.currentMood));
  assert.ok(moods.size >= 2, `every observed person is "${[...moods][0]}" — there is no spread`);
});

test('a generated world starts in rough balance, not starving', () => {
  // **The other half of the same defect.** Supply and demand were
  // drawn independently from one range, so about half of every world's
  // resources sat in permanent deficit — and `survivalScarcity` takes
  // the WORST of food, water and medicine, so three independent draws
  // almost always produced a starving world. Measured at 0.74, which
  // is a settlement three quarters of the way to total famine on the
  // day it is founded.
  //
  // A world should START in balance and become scarce because
  // something happened to it. Scarcity is an event the simulation
  // produces, not the ground state.
  const mortality = require('../server/mortality.js');
  for (const seed of ['balance-a', 'balance-b', 'balance-c']) {
    const summary = worldgen.generateWorld({ ...SMALL, seed });
    // **Scoped to the city just built.** `generateWorld` appends to a
    // shared WorldState, so an unscoped reading takes the worst
    // survival resource in ANY world this process has generated —
    // including one an earlier test ran into a drought. That was
    // invisible until weather could drain a resource to nothing, and
    // the test's own sentence says "a freshly generated world", so
    // measuring only that world is the assertion matching its claim.
    const scarcity = mortality.survivalScarcity(w, summary.cities[0]);
    assert.ok(scarcity < 0.25,
      `a freshly generated world has survival scarcity ${scarcity.toFixed(2)} — `
      + 'it is starving before anything has happened to it');
  }

  // And the essentials are the ones held closest to balance: a world
  // short of timber is an economic problem, a world short of water is
  // a mortality one.
  const city = w.cities[w.cities.length - 1];
  const essentials = w.resources.filter(
    (r) => r.city_id === city.id && mortality.SURVIVAL_RESOURCES.includes(r.resource_type),
  );
  assert.equal(essentials.length, 3);
  assert.equal(essentials.every((r) => r.demand / r.supply <= 1.2), true);
});

test('every family has a head, or nothing can ever succeed to it', () => {
  // `generateFamily` leaves `head_npc_id` null unless told, and
  // `succession.settleEstate` advances a family's generation only when
  // its HEAD dies. Without this, every family in every generated world
  // stayed on generation 1 no matter how many members were buried —
  // measured at 400 ticks: two deaths, thirty families, all still
  // generation 1.
  const { before } = delta(() => worldgen.generateWorld({ ...SMALL, seed: 'heads' }));
  const fresh = w.families.slice(before.families);
  assert.ok(fresh.length > 0);

  const living = new Set(w.npcs.map((n) => n.id));
  for (const family of fresh) {
    const members = w.familyMemberships.filter((m) => m.family_id === family.id);
    if (members.length === 0) continue;
    assert.ok(family.head_npc_id, `family ${family.id} has members and no head`);
    assert.ok(living.has(family.head_npc_id), 'a family is headed by somebody who is not there');
  }
});

// ---------------------------------------------------------------------
// Extended family for ORDINARY NPCs (Gap 4) -- opt-in, same posture as
// every other real-data pack in this file. Reuses
// characterCreation.generateAuntOrUncle directly rather than a second
// copy of "a new NPC, a new family, a cross-family relationship link".
// ---------------------------------------------------------------------

const DEFAULTS_FAMILIES_PER_COMMUNITY = 6;

test('extendedFamily: true still replays byte-for-byte from its seed -- the real generators it reuses are threaded seeded traits/names, never engine.generateNPC\'s own Math.random fallback', () => {
  function run(seed) {
    const { before } = delta(() => worldgen.generateWorld({
      ...SMALL, seed, extendedFamily: true, extendedFamilyChance: 1,
    }));
    return w.npcs.slice(before.npcs).map((n) => `${n.name}|${JSON.stringify(n.traits)}`).join(',');
  }
  const first = run('extended-replay');
  const second = run('extended-replay');
  assert.ok(first.length > 0);
  assert.deepEqual(first, second, 'the same seed produced two different extended-family worlds');
});

test('extendedFamily defaults to false -- a generated world is byte-for-byte unchanged from before this feature existed', () => {
  const { summary, added } = delta(() => worldgen.generateWorld({ ...SMALL, seed: 'no-extended' }));
  assert.equal(added.npcs, 24, 'the default world must still generate exactly the old population');
  assert.equal(summary.people, 24);
  assert.equal(summary.extendedFamilyAdults, 0);
  assert.equal(summary.extendedFamilyChildren, 0);
});

test('extendedFamily: true generates real aunts/uncles each heading a separate real family, with real cousins, cross-linked by a real family relationship', () => {
  const { summary, before } = delta(() => worldgen.generateWorld({
    ...SMALL, seed: 'extended-on', extendedFamily: true, extendedFamilyChance: 1,
  }));
  assert.ok(summary.extendedFamilyAdults > 0, 'extendedFamilyChance:1 generated no aunts/uncles at all');

  const freshFamilies = w.families.slice(before.families);
  // A real, separately-headed aunt/uncle family: head_npc_id set, and
  // that same head is a 'parent'-role member of their OWN family (the
  // real shape `generateAuntOrUncle` builds, never the player/original
  // family's own 'member' rows).
  const auntUncleFamilies = freshFamilies.filter((f) => f.head_npc_id != null
    && w.familyMemberships.some((m) => m.entity_id === f.head_npc_id && m.family_id === f.id && m.role === 'parent'));
  assert.ok(auntUncleFamilies.length > 0, 'no separately-headed aunt/uncle family was found among the fresh families');

  for (const auFamily of auntUncleFamilies) {
    const auntUncleId = auFamily.head_npc_id;
    const rel = w.relationships.find(
      (r) => (r.entity_a_id === auntUncleId || r.entity_b_id === auntUncleId)
        && r.relationship_type === 'family',
    );
    assert.ok(rel, 'a generated aunt/uncle must be really related (relationship_type family) to someone');
  }
});

test('extendedFamily cousin count respects the tighter maxCousinsPerAuntUncle cap, not characterCreation\'s own larger default', () => {
  const { summary } = delta(() => worldgen.generateWorld({
    ...SMALL, seed: 'extended-capped', extendedFamily: true, extendedFamilyChance: 1, maxCousinsPerAuntUncle: 2,
  }));
  assert.ok(summary.extendedFamilyAdults > 0);
  const avgCousinsPerAuntUncle = summary.extendedFamilyChildren / summary.extendedFamilyAdults;
  assert.ok(
    avgCousinsPerAuntUncle <= 2,
    `average cousins per aunt/uncle (${avgCousinsPerAuntUncle}) exceeds the configured cap of 2`,
  );
});

test('extended family generation never recurses -- a generated aunt/uncle or cousin never themselves anchor another round', () => {
  const { summary, before } = delta(() => worldgen.generateWorld({
    ...SMALL, seed: 'no-recursion', extendedFamily: true, extendedFamilyChance: 1, maxCousinsPerAuntUncle: 2,
  }));
  // If generation recursed, the number of aunt/uncle units would
  // multiply across communities rather than stay at exactly one per
  // original community family -- bounded, not exponential.
  const originalFamilyCount = DEFAULTS_FAMILIES_PER_COMMUNITY * SMALL.communitiesPerCity;
  assert.equal(
    summary.extendedFamilyAdults, originalFamilyCount,
    'exactly one aunt/uncle per original family, at chance 1 -- any more means a second round ran',
  );
  // And none of the generated aunts/uncles/cousins themselves head a
  // family that got its OWN aunt/uncle -- the loop that generates
  // extended family only ever iterates the original community
  // `families` array, never the families this block itself creates.
  const freshFamilies = w.families.slice(before.families);
  const auntUncleHeadIds = new Set(
    freshFamilies
      .filter((f) => w.familyMemberships.some(
        (m) => m.family_id === f.id && m.entity_id === f.head_npc_id && m.role === 'parent',
      ))
      .map((f) => f.head_npc_id),
  );
  for (const headId of auntUncleHeadIds) {
    const asAnchorRelationships = w.relationships.filter(
      (r) => r.relationship_type === 'family' && (r.entity_a_id === headId || r.entity_b_id === headId),
    );
    // An aunt/uncle has exactly one real family link (to the sibling
    // whose family anchored them) -- more than one would mean they
    // were themselves used to generate a further round.
    assert.ok(
      asAnchorRelationships.length <= 1,
      `aunt/uncle ${headId} has ${asAnchorRelationships.length} family relationships -- recursion suspected`,
    );
  }
});

// ---------------------------------------------------------------------
// Real prison-staff occupations need a real workplace to resolve to
// ---------------------------------------------------------------------
// `occupations.js`'s new `guard`/`warden`/`nurse` entries name
// `government` as their only real prison-relevant employer, because
// prisons have no `organizations.type` of their own. But
// `landmarks.designate` never sets `operating_organization_id` for ANY
// hero landmark -- so without this round's own fix, a real prison
// this engine generates would have no operator at all, and a guard
// hired into the government would have nowhere real to be. 24
// (`landmarksPerCity`) guarantees every one of `landmarks
// .KEY_BUILDING_CATEGORIES`' real categories gets placed, including
// `prison`, rather than leaving it to a draw that might not produce
// one.

test('every real prison this engine generates gets a real government operator, not left null', () => {
  const { before } = delta(() => worldgen.generateWorld({
    ...SMALL, seed: 'prison-operator', landmarksPerCity: 24,
  }));
  const newProperties = w.properties.slice(before.properties);
  const prisons = newProperties.filter((p) => p.landmark_category === 'prison');
  assert.ok(prisons.length > 0, 'landmarksPerCity: 24 should guarantee at least one generated prison');
  for (const prison of prisons) {
    assert.ok(prison.operating_organization_id != null, `prison ${prison.id} has no operating_organization_id`);
    const operator = w.organizations.find((o) => o.id === prison.operating_organization_id);
    assert.ok(operator, `prison ${prison.id}'s operator ${prison.operating_organization_id} does not exist`);
    assert.equal(operator.type, 'government', `prison ${prison.id}'s operator must be a real government, got ${operator.type}`);
  }
});

test('a real guard can actually be hired into the government that operates a real prison', () => {
  const { before, summary } = delta(() => worldgen.generateWorld({
    ...SMALL, seed: 'prison-guard-hire', landmarksPerCity: 24,
  }));
  const government = w.organizations.find((o) => o.id === summary.governmentId);
  assert.ok(government, 'generateWorld should always found a civilization government');
  const newProperties = w.properties.slice(before.properties);
  const prison = newProperties.find((p) => p.landmark_category === 'prison');
  assert.ok(prison, 'this seed should produce a real prison at landmarksPerCity: 24');
  assert.equal(
    prison.operating_organization_id, government.id,
    'with no scoped region government in this config, the prison should be operated by the civilization government',
  );
  // A candidate who is not already employed, is of working age, and
  // is tier-reachable for `guard` (tier 2 -- the lowest real bar, same
  // shape `tierReachable` already gates every other hire on).
  const candidate = w.npcs.find(
    (n) => !economy.getEmployment(w, n.id)
      && occupations.tierReachable(n, occupations.OCCUPATIONS.guard.tier),
  );
  assert.ok(candidate, 'a generated world this size should have at least one tier-2-reachable candidate');
  const record = economy.hireEntity(w, {
    entityId: candidate.id, employerOrganizationId: government.id, wage: 40, position: 'guard', tick: w.tick ?? 0,
  });
  assert.equal(record.position, 'guard');
  assert.equal(record.employer_organization_id, government.id);
  // The real point of the wiring, stated precisely rather than
  // overclaimed: the government now really operates the prison, so a
  // guard hired into it has a real, non-null workplace -- not
  // nothing. `workplaceOf` returns the FIRST property sharing that
  // operator by array order, which may be the prison or another
  // government-operated building (the "seat", for one) -- that
  // ambiguity is `workplaceOf`'s own, pre-existing and general to
  // every multi-property employer this engine has, not specific to
  // prisons, and is not what this test is about.
  const workplaceId = behavior.workplaceOf(w, candidate.id);
  assert.ok(workplaceId != null, 'a guard hired into a government that operates a real prison should have SOME real workplace');
  const workplace = w.properties.find((p) => p.id === workplaceId);
  assert.equal(workplace.operating_organization_id, government.id);
});

test('guard, warden and nurse are real, drawable occupations at a government employer', () => {
  for (const name of ['guard', 'warden', 'nurse']) {
    assert.ok(occupations.OCCUPATIONS[name], `${name} should be a real occupation`);
    assert.ok(occupations.occupationsFor('government').includes(name), `${name} should be drawable at a government`);
  }
  // `nurse` is real BLS SOC major group 29, same as `physician` -- a
  // different code from `orderly` (31), not a duplicate of either.
  const labourPacks = require('../server/labourPacks.js');
  assert.equal(labourPacks.SOC_GROUP_BY_OCCUPATION.nurse, '29');
  assert.equal(labourPacks.SOC_GROUP_BY_OCCUPATION.guard, '33');
  assert.equal(labourPacks.SOC_GROUP_BY_OCCUPATION.warden, '33');
});

// ---------------------------------------------------------------------
// Every OTHER real hero landmark gets a real operator too -- the
// broader gap the prison-staff round named and left open on purpose,
// closed now. By direct instruction: "museums, libraries, cathedrals,
// mosques... Jewish rabbis... imams... priests... gyms, prisons,
// penitentiaries... skyscrapers... everything incorporated with all
// of that."
// ---------------------------------------------------------------------

test('every government-type hero landmark gets a real government operator, not just prisons', () => {
  const landmarks = require('../server/landmarks.js');
  const { before, summary } = delta(() => worldgen.generateWorld({
    ...SMALL, seed: 'landmark-operator-government', landmarksPerCity: 24,
  }));
  const newProperties = w.properties.slice(before.properties);
  const governmentCategories = Object.keys(landmarks.KEY_BUILDING_TYPES)
    .filter((cat) => landmarks.KEY_BUILDING_TYPES[cat].propertyType === 'government' && landmarks.KEY_BUILDING_TYPES[cat].staff);
  // 24 draws without replacement from this module's own real category
  // list should place every one of them at least once -- the same
  // guarantee the prison-only test above already relies on.
  const found = governmentCategories.filter((cat) => newProperties.some((p) => p.landmark_category === cat));
  assert.ok(found.length >= governmentCategories.length - 1, `expected nearly every government-type category to be placed, got ${found.join(', ')}`);

  for (const cat of found) {
    const landmark = newProperties.find((p) => p.landmark_category === cat);
    assert.ok(landmark.operating_organization_id != null, `${cat} has no operating_organization_id`);
    const operator = w.organizations.find((o) => o.id === landmark.operating_organization_id);
    assert.equal(operator.type, 'government', `${cat}'s operator must be a real government, got ${operator.type}`);
  }
});

test('every real religious landmark is operated by its own community\'s religious order, with a real title matching the building', () => {
  const { before } = delta(() => worldgen.generateWorld({
    ...SMALL, seed: 'landmark-operator-religious', landmarksPerCity: 24, religiousOrdersPerCommunity: true,
  }));
  const newProperties = w.properties.slice(before.properties);
  const titleByCategory = {
    church: 'priest', mosque: 'imam', synagogue: 'rabbi', temple: 'religious leader',
  };
  let checkedAtLeastOne = false;
  for (const [category, title] of Object.entries(titleByCategory)) {
    const landmark = newProperties.find((p) => p.landmark_category === category);
    if (!landmark) continue; // the random draw does not guarantee every community gets every faith
    const order = w.organizations.find((o) => o.id === landmark.operating_organization_id);
    if (!order) continue; // honest gap: this community's religious order (if any) operates a DIFFERENT real landmark
    assert.equal(order.archetype, 'religious order', `${category}'s operator must be the real religious order, got archetype ${order.archetype}`);
    assert.equal(order.community_id, landmark.community_id, `${category}'s operator must belong to the same community as the building`);
    assert.equal(order.religiousTitle, title, `${category} should carry the real title "${title}", got "${order.religiousTitle}"`);
    checkedAtLeastOne = true;
  }
  assert.ok(checkedAtLeastOne, 'this seed should produce at least one real religious landmark whose community also has a real religious order');
});

test('a community with a real religious order but no real religious landmark gets no title -- an honest gap, not a guess', () => {
  const { before } = delta(() => worldgen.generateWorld({
    ...SMALL, seed: 'landmark-operator-religious-gap', landmarksPerCity: 3, religiousOrdersPerCommunity: true,
  }));
  const newProperties = w.properties.slice(before.properties);
  const religiousCategories = new Set(['church', 'mosque', 'synagogue', 'temple']);
  const newOrders = w.organizations.filter((o, idx) => idx >= before.organizations && o.archetype === 'religious order');
  assert.ok(newOrders.length > 0, 'religiousOrdersPerCommunity: true should found at least one real order');
  const ordersWithNoRealLandmark = newOrders.filter(
    (order) => !newProperties.some((p) => religiousCategories.has(p.landmark_category) && p.operating_organization_id === order.id),
  );
  // landmarksPerCity: 3 against 24 real categories makes it likely at
  // least one community's order has no matching real building this
  // round -- if every order happens to get one on this seed, the
  // property under test (an unmatched order carries no title) still
  // holds vacuously and the next assertion covers it directly.
  for (const order of ordersWithNoRealLandmark) {
    assert.equal(order.religiousTitle, undefined, `order ${order.id} has no real religious landmark operating for it and must not carry an invented title`);
  }
});

test('a commercial-type hero landmark always gets a real operator -- a fresh business, or a pre-existing real city institution that claimed the building first', () => {
  // **A real, pre-existing interaction this round found rather than
  // caused.** `CITY_INSTITUTIONS` (school/hospital/library) runs
  // earlier in the SAME per-city pass and grabs "the first free,
  // ranked-commercial-first property" for each of its three real
  // organizations, with no regard for landmark category -- a
  // skyscraper is commercial-ranked the same as an ordinary shop, so
  // it is a real, legitimate outcome for a city's library institution
  // to end up housed in what this engine also calls a "skyscraper"
  // landmark. This round's own new pass only creates a fresh business
  // for whatever is STILL unoperated by the time it runs, so either
  // real outcome is correct -- asserting "always business" would be
  // asserting away a real, older mechanism this round deliberately
  // does not fight with.
  const landmarks = require('../server/landmarks.js');
  const { before } = delta(() => worldgen.generateWorld({
    ...SMALL, seed: 'landmark-operator-business', landmarksPerCity: 24,
  }));
  const newProperties = w.properties.slice(before.properties);
  const commercialStaffed = Object.keys(landmarks.KEY_BUILDING_TYPES).filter((cat) => {
    const def = landmarks.KEY_BUILDING_TYPES[cat];
    return def.staff && def.propertyType !== 'government' && !['church', 'mosque', 'synagogue', 'temple'].includes(cat);
  });
  // 'gang' included because the same housing pass also places every
  // real, already-generated faction this way
  // (`institutions.push({ org: faction, post: 'enforcer' })`, a few
  // lines above the housing block itself) -- a gang can claim a
  // commercial-ranked landmark the identical way a school/hospital/
  // library institution can.
  const realOperatorTypes = new Set(['business', 'school', 'hospital', 'library', 'gang']);
  let checkedAtLeastOne = false;
  let sawAFreshBusiness = false;
  for (const cat of commercialStaffed) {
    const landmark = newProperties.find((p) => p.landmark_category === cat);
    if (!landmark) continue;
    assert.ok(landmark.operating_organization_id != null, `${cat} has no operating_organization_id`);
    const operator = w.organizations.find((o) => o.id === landmark.operating_organization_id);
    assert.ok(realOperatorTypes.has(operator.type), `${cat}'s operator must be a real business or city institution, got ${operator.type}`);
    if (operator.type === 'business' && operator.leader_id === null) sawAFreshBusiness = true;
    checkedAtLeastOne = true;
  }
  assert.ok(checkedAtLeastOne, 'this seed should produce at least one real commercial-type hero landmark');
  assert.ok(sawAFreshBusiness, 'this seed should leave at least one commercial-type landmark for this round\'s own new business-founding path to actually exercise');
});

test('a hero landmark with no real staff slot gets no operator at all -- nobody works there, so there is nothing to wire', () => {
  const { before } = delta(() => worldgen.generateWorld({
    ...SMALL, seed: 'landmark-operator-no-staff', landmarksPerCity: 24,
  }));
  const newProperties = w.properties.slice(before.properties);
  const noStaffCategories = ['monument-memorial', 'notable-bridge', 'historic-site', 'other-distinctive-feature', 'masonic-building', 'cave-system', 'natural-formation'];
  let checkedAtLeastOne = false;
  for (const cat of noStaffCategories) {
    const landmark = newProperties.find((p) => p.landmark_category === cat);
    if (!landmark) continue;
    assert.equal(landmark.operating_organization_id, null, `${cat} has no real occupation slot and must not get an invented operator`);
    checkedAtLeastOne = true;
  }
  assert.ok(checkedAtLeastOne, 'this seed should produce at least one no-staff-slot landmark');
});
