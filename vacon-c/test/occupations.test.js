// What a person does for a living.
//
// ---------------------------------------------------------------------
// What this closes
//
// `employment_records.position` has been in the schema from the first
// day. `economy.hireEntity` accepts it and names it in its signature,
// `migrate.js` writes it and `restore.js` reads it back. Before
// `server/occupations.js`, `grep -rn "position:" server/*.js` returned
// exactly one hit — in `geo.js`, about coordinates. **Every job in
// every world this engine had ever run was untitled.**
//
// It matters more than a blank column, because of who cites it.
// `TRIBE_GROWTH_MISSION_UNLOCK_SYSTEM.md` builds its whole mechanic on
// "the Occupation Taxonomy already tracks exactly what real skill each
// NPC brings", and the takeover key in
// `COMPOSITION_REQUIREMENTS_TRIBE_COHESION.md` is written in roles and
// specialists. Neither is buildable against a column nobody writes.
//
// ---------------------------------------------------------------------
// The mistake this file holds, made here first and measured
//
// The first `drawOccupation` gave everybody the highest-tier post they
// qualified for, on the obvious-sounding reasoning that somebody who
// went to school does not take a labourer's job while a qualified post
// is open. Measured on a generated world: **28 of 54 workers at Tier 4,
// mean tier 3.44, eight engineers and eight navigators in a settlement
// of 153 people, and not one labourer, farmer or carpenter.** A
// civilization three years past a collapse, staffed entirely by
// professionals.
//
// Attainment says what somebody COULD do; the number of posts at a tier
// says how many people actually do it. Reading only the first is
// standing rule 12's third clause — a number chosen from what it sounds
// like. The weight is `1 / tier`, a pyramid whose only input is §25's
// own tier index, and the same world then measures 24 / 17 / 9 / 4
// across Tiers 1-4 with a mean of 1.95.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const occupations = require('../server/occupations.js');
const demographics = require('../server/demographics.js');
const economy = require('../server/economy.js');
const traitDrift = require('../server/traitDrift.js');
const { TRAIT_FAMILIES } = require('../server/traits.js');
const statistics = require('../server/statistics.js');

// ---------------------------------------------------------------------
// The taxonomy holds together
// ---------------------------------------------------------------------

test('every occupation names a tier §25 actually defines', () => {
  const tiers = new Set(occupations.KNOWLEDGE_TIERS.map((t) => t.tier));
  assert.equal(tiers.size, 7, '§25 defines seven tiers');
  for (const [name, def] of Object.entries(occupations.OCCUPATIONS)) {
    assert.ok(tiers.has(def.tier), `${name} sits on a tier §25 does not define`);
  }
});

// Standing rule 6's shape, the same way `trait-drift.test.js` holds
// `EXERCISES`: a renamed skill must fail the suite rather than quietly
// exercising nothing forever.
test('every occupation names a real skills trait', () => {
  const skills = new Set(TRAIT_FAMILIES.skills);
  for (const [name, def] of Object.entries(occupations.OCCUPATIONS)) {
    assert.ok(skills.has(def.skill), `${name} exercises "${def.skill}", which is not a skills trait`);
  }
});

test('every occupation names organization types the schema enumerates', () => {
  // The schema's own comment on `organizations.type`, quoted in
  // engine.js#generateOrganization.
  const known = new Set([
    'business', 'government', 'club', 'religion', 'gang', 'corporation',
    'military', 'school', 'hospital', 'research', 'media', 'sports',
    'library', 'museum',
  ]);
  for (const [name, def] of Object.entries(occupations.OCCUPATIONS)) {
    assert.ok(def.employers.length > 0, `${name} has no employer at all`);
    for (const type of def.employers) {
      assert.ok(known.has(type), `${name} is employed by "${type}", not an organizations.type value`);
    }
  }
});

test('every tier minimum is a real attainment level', () => {
  for (const [tier, level] of Object.entries(occupations.TIER_MINIMUM_LEVEL)) {
    assert.ok(
      demographics.EDUCATION_LEVELS.includes(level),
      `tier ${tier} asks for "${level}", not an EDUCATION_LEVELS rung`,
    );
  }
});

// ---------------------------------------------------------------------
// Unknown attainment is not zero attainment
// ---------------------------------------------------------------------

test('attainment distinguishes unmeasured from none', () => {
  assert.equal(occupations.attainmentOf({ education: 'none' }), 0);
  assert.equal(occupations.attainmentOf({ education: null }), null);
  assert.equal(occupations.attainmentOf({}), null);
  assert.equal(occupations.attainmentOf({ education: 'higher' }), 4);
  // A value that is not on the ladder at all is unknown, not a rung.
  assert.equal(occupations.attainmentOf({ education: 'phd' }), null);
});

test('an unmeasured person reaches what an unschooled one reaches, and no more', () => {
  const unknown = { id: 1, education: null };
  const none = { id: 2, education: 'none' };
  assert.deepEqual(
    occupations.qualifiedFor(unknown, 'business'),
    occupations.qualifiedFor(none, 'business'),
  );
  assert.equal(occupations.tierReachable(unknown, 3), false);
});

// ---------------------------------------------------------------------
// The gate decides which job, never whether there is one
// ---------------------------------------------------------------------

test('education widens what is reachable without ever closing it', () => {
  const unschooled = occupations.qualifiedFor({ id: 1, education: 'none' }, 'business');
  const schooled = occupations.qualifiedFor({ id: 1, education: 'higher' }, 'business');
  assert.ok(unschooled.length > 0, 'an unschooled person can hold no job at all');
  assert.ok(schooled.length > unschooled.length, 'schooling opened nothing');
  for (const name of unschooled) {
    assert.ok(schooled.includes(name), `schooling took ${name} away`);
  }
});

test('somebody who qualifies for nothing still gets the employer’s lowest post', () => {
  // A hospital's posts are cook (1), orderly (3), manager (4) and
  // physician (4). An unschooled person reaches only the cook — and
  // must still be given it rather than null, because `runLabour` hires
  // on productivity and a null position would silently un-title the
  // hire the fix exists to title.
  const drawn = occupations.drawOccupation({
    npc: { id: 7, education: 'none' },
    organizationType: 'hospital',
    seed: 'test',
  });
  assert.equal(drawn, 'cook');
});

test('an organization type that employs nobody draws null rather than throwing', () => {
  assert.equal(occupations.drawOccupation({ npc: { id: 1 }, organizationType: 'corporation' }) !== null, true);
  assert.equal(occupations.drawOccupation({ npc: { id: 1 }, organizationType: 'nonsense' }), null);
  assert.equal(occupations.drawOccupation({ npc: { id: 1 }, organizationType: null }), null);
});

// ---------------------------------------------------------------------
// The pyramid, which is the whole correction
// ---------------------------------------------------------------------

test('the draw is a pyramid, not the best job you qualify for', () => {
  // Two hundred identically-schooled people at the same employer. If
  // the draw took the top reachable tier, every one of them would land
  // on the same one or two occupations. Weighted by `1 / tier`, the low
  // tiers have to dominate.
  const counts = new Map();
  for (let id = 1; id <= 200; id += 1) {
    const name = occupations.drawOccupation({
      npc: { id, education: 'higher' },
      organizationType: 'business',
      seed: 'pyramid',
    });
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const byTier = new Map();
  for (const [name, count] of counts) {
    const tier = occupations.tierOf(name);
    byTier.set(tier, (byTier.get(tier) ?? 0) + count);
  }
  assert.ok(counts.size >= 6, `only ${counts.size} occupations drawn across 200 people`);
  assert.ok(
    (byTier.get(1) ?? 0) > (byTier.get(4) ?? 0),
    `Tier 1 ${byTier.get(1) ?? 0} should outnumber Tier 4 ${byTier.get(4) ?? 0}`,
  );
});

test('the draw is seeded on the person and repeats exactly', () => {
  const npc = { id: 42, education: 'secondary' };
  const first = occupations.drawOccupation({ npc, organizationType: 'business', seed: 'same' });
  const again = occupations.drawOccupation({ npc, organizationType: 'business', seed: 'same' });
  assert.equal(first, again);
  // §88: a different seed is a different world.
  const elsewhere = [];
  for (let id = 1; id <= 40; id += 1) {
    elsewhere.push(occupations.drawOccupation({ npc: { id, education: 'secondary' }, organizationType: 'business', seed: 'a' })
      === occupations.drawOccupation({ npc: { id, education: 'secondary' }, organizationType: 'business', seed: 'b' }));
  }
  assert.ok(elsewhere.some((same) => !same), 'two seeds produced identical occupations for everybody');
});

// ---------------------------------------------------------------------
// Reading it back off a world
// ---------------------------------------------------------------------

function worldWithJobs() {
  return {
    tick: 10,
    npcs: [
      { id: 1, communityId: 500, education: 'higher', createdTick: -8000 },
      { id: 2, communityId: 500, education: 'none', createdTick: -8000 },
      { id: 3, communityId: 501, education: 'basic', createdTick: -8000 },
    ],
    communities: [
      { id: 500, city_id: 900 },
      { id: 501, city_id: 901 },
    ],
    employmentRecords: [
      {
        id: 1, entity_id: 1, employer_organization_id: 100, status: 'active', wage: 40, position: 'physician',
      },
      {
        id: 2, entity_id: 2, employer_organization_id: 100, status: 'active', wage: 10, position: 'cook',
      },
      // A record from before the column was written: untitled, and it
      // has to stay untitled rather than be reported as some default.
      {
        id: 3, entity_id: 3, employer_organization_id: 101, status: 'active', wage: 20, position: null,
      },
    ],
  };
}

test('an untitled job stays untitled rather than becoming a default', () => {
  const w = worldWithJobs();
  assert.equal(occupations.occupationOf(w, 1), 'physician');
  assert.equal(occupations.occupationOf(w, 3), null);
  // Somebody who holds no job at all is also null, and the two are
  // deliberately the same answer: neither has an occupation.
  assert.equal(occupations.occupationOf(w, 99), null);
});

test('holders can be narrowed to an area, because distant specialists do not help', () => {
  const w = worldWithJobs();
  assert.equal(occupations.holdersOf(w, 'physician').length, 1);
  assert.equal(occupations.holdersOf(w, 'physician', { communityId: 500 }).length, 1);
  assert.equal(occupations.holdersOf(w, 'physician', { communityId: 501 }).length, 0);
  assert.equal(occupations.holdersOf(w, 'physician', { cityId: 900 }).length, 1);
  assert.equal(occupations.holdersOf(w, 'physician', { cityId: 901 }).length, 0);
});

test('describeOccupations reports the untitled rather than hiding them', () => {
  const described = occupations.describeOccupations(worldWithJobs());
  assert.equal(described.titled, 2);
  assert.equal(described.untitled, 1);
  assert.equal(described.held, 2);
  assert.equal(described.meanTier, 2.5);
});

test('an empty world reports no mean tier rather than a zero', () => {
  const described = occupations.describeOccupations({ employmentRecords: [] });
  assert.equal(described.titled, 0);
  assert.equal(described.meanTier, null);
});

// ---------------------------------------------------------------------
// The hire writes it
// ---------------------------------------------------------------------

test('hireEntity records the position it is given', () => {
  const w = {
    tick: 3,
    organizations: [{ id: 100, type: 'hospital' }],
    npcs: [{ id: 1, status: 'alive' }],
    employmentRecords: [],
    entities: [],
  };
  const record = economy.hireEntity(w, {
    entityId: 1, employerOrganizationId: 100, wage: 30, position: 'physician', tick: 3,
  });
  assert.equal(record.position, 'physician');
  assert.equal(occupations.occupationOf(w, 1), 'physician');
});

// ---------------------------------------------------------------------
// Working at a trade grows that trade
// ---------------------------------------------------------------------

test('work exercises the occupation’s own skill, not everybody’s Management', () => {
  const w = worldWithJobs();
  const physician = traitDrift.occupationExercise(w, 1, 'work');
  assert.deepEqual(physician[0], ['skills', 'Medicine']);
  // The other two pairs are unchanged, so the total drift pressure on a
  // working person is what it was before occupations existed — standing
  // rule 12's first clause.
  assert.equal(physician.length, traitDrift.EXERCISES.work.length);
  assert.deepEqual(physician.slice(1), traitDrift.EXERCISES.work.slice(1));

  // An untitled job keeps the default, which is the honest reading of a
  // restored world.
  assert.deepEqual(traitDrift.occupationExercise(w, 3, 'work'), traitDrift.EXERCISES.work);
  // Somebody with no job at all keeps it too.
  assert.deepEqual(traitDrift.occupationExercise(w, 99, 'work'), traitDrift.EXERCISES.work);
  // Every other habit is untouched by any of this.
  assert.deepEqual(traitDrift.occupationExercise(w, 1, 'rest'), traitDrift.EXERCISES.rest);
  assert.equal(traitDrift.occupationExercise(w, 1, 'not-a-habit'), null);
});

// ---------------------------------------------------------------------
// The statistics
// ---------------------------------------------------------------------

test('the catalogue can answer what share of work is titled', () => {
  for (const key of ['titled_employment', 'occupation_variety', 'mean_knowledge_tier']) {
    assert.ok(statistics.KEYS.includes(key), `${key} is not in the catalogue`);
  }
  const tier = statistics.CATALOGUE.find((s) => s.key === 'mean_knowledge_tier');
  assert.equal(tier.unit, 'tier');
  assert.ok(statistics.UNITS.tier, 'the tier unit is not declared');
});

// ---------------------------------------------------------------------
// Aptitude — who gets which job, which the pyramid never said
// ---------------------------------------------------------------------
// The pyramid above fixed HOW MANY people hold each tier. It left WHICH
// people entirely to the seeded cut, and measured on a 300-tick world
// that showed: the mean skill value of the job somebody actually held
// was 59.1 out of 100, in a population where one person's best skill
// beats their worst by 75.7 points. Everybody was a specialist and
// almost nobody was doing their speciality.

function sheetWorld(entityId, skills) {
  // Live trait rows, not `npc.traits` — the ninth standing rule. The
  // draw reads through `getLiveEntity`, so the fixture has to supply
  // what that reads: `current_value` on a row whose `trait_id` comes
  // from the module registry.
  const { getTraitId } = require('../server/traitDefinitions.js');
  const w = { tick: 0, npcs: [{ id: entityId, status: 'active' }], organizations: [], families: [], entityTraits: [] };
  for (const [name, value] of Object.entries(skills)) {
    w.entityTraits.push({
      entity_id: entityId, trait_id: getTraitId('skills', name),
      base_value: value, key_modifier: 0, current_value: value,
    });
  }
  return w;
}

test('a person flat at 50 draws exactly the distribution they drew before aptitude existed', () => {
  // **Standing rule 12's first clause, held mechanically.** A modifier
  // centred anywhere but the trait scale's own centre recalibrates the
  // whole world the day it starts being read — the same failure as the
  // evasion term that made every ordinary criminal 25% harder to catch.
  // Here the check is exact rather than statistical: an entirely
  // average person's weight is 1 for every occupation, so the draw is
  // bit-identical to the tier-only pyramid.
  const flat = Object.fromEntries(TRAIT_FAMILIES.skills.map((t) => [t.name ?? t, 50]));
  for (let id = 1; id <= 60; id += 1) {
    const npc = { id, education: 'higher' };
    const w = sheetWorld(id, flat);
    const withTraits = occupations.drawOccupation({
      npc, worldState: w, organizationType: 'business', seed: 'centre',
    });
    const without = occupations.drawOccupation({
      npc, organizationType: 'business', seed: 'centre',
    });
    assert.equal(withTraits, without,
      `an average person at id ${id} drew ${withTraits} with traits and ${without} without`);
  }
});

test('aptitude moves which job somebody gets, and does not dismantle the pyramid', () => {
  // The claim is that people tend toward what they are good at. It is
  // false if the measured skill of the job held does not rise, and it
  // has overreached if the tier distribution stops being a pyramid —
  // the file's own correction was about exactly that, a town of
  // engineers and navigators with no labourers in it.
  const specialists = [];
  const generalists = [];
  for (let id = 1; id <= 120; id += 1) {
    // One strong skill each, rotated through the sixteen so no single
    // trade is being tested; everything else well below average.
    const names = TRAIT_FAMILIES.skills.map((t) => t.name ?? t);
    const strong = names[id % names.length];
    const sheet = Object.fromEntries(names.map((n) => [n, n === strong ? 95 : 25]));
    const npc = { id, education: 'higher' };
    const w = sheetWorld(id, sheet);
    const got = occupations.drawOccupation({
      npc, worldState: w, organizationType: 'business', seed: 'apt',
    });
    const flatGot = occupations.drawOccupation({
      npc, organizationType: 'business', seed: 'apt',
    });
    if (got) specialists.push({ got, held: sheet[occupations.definitionOf(got).skill] });
    if (flatGot) generalists.push({ got: flatGot, held: sheet[occupations.definitionOf(flatGot).skill] });
  }
  const mean = (xs) => xs.reduce((a, b) => a + b.held, 0) / xs.length;
  assert.ok(mean(specialists) > mean(generalists) + 5,
    `aptitude barely moved the skill of the job held: ${mean(specialists).toFixed(1)} `
    + `with it against ${mean(generalists).toFixed(1)} without. A term that changes `
    + 'nothing is decoration — standing rule 20.');

  // And the pyramid survives. Tier 1 must still outnumber Tier 4.
  const byTier = new Map();
  for (const { got } of specialists) {
    const tier = occupations.tierOf(got);
    byTier.set(tier, (byTier.get(tier) ?? 0) + 1);
  }
  assert.ok((byTier.get(1) ?? 0) > (byTier.get(4) ?? 0),
    `aptitude overturned the pyramid: Tier 1 ${byTier.get(1) ?? 0} against Tier 4 ${byTier.get(4) ?? 0}`);
});

test('a worldState is optional and its absence changes nothing', () => {
  // Two callers pass one and every existing test does not. Without it
  // the aptitude term is 1 for everything, which is the old behaviour
  // rather than a person with no skills at all.
  const npc = { id: 9, education: 'secondary' };
  assert.equal(
    occupations.drawOccupation({ npc, organizationType: 'business', seed: 'none' }),
    occupations.drawOccupation({ npc, worldState: null, organizationType: 'business', seed: 'none' }),
  );
});
