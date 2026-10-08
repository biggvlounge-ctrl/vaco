// §7 system 28, Business — formation, failure and its inverse, and the
// derived figures (`revenue`/`profit`/`market_share`/`industry`) that
// close the reason `snapshots.js` left Business out of the history
// tables. See server/businesses.js's header for the full reasoning.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const businesses = require('../server/businesses.js');
const economy = require('../server/economy.js');
const occupations = require('../server/occupations.js');
const { seededDraw } = require('../server/seeded.js');
const engine = require('../server/engine.js');
const worldgen = require('../server/worldgen.js');
const { generateEntityTraits } = require('../server/entityTraits.js');
const { INDIVIDUAL_DEFINITIONS } = require('../server/traitDefinitions.js');

function world({ tick = 1000, seed = 'biz-test' } = {}) {
  const w = {
    tick,
    seed,
    npcs: [],
    organizations: [],
    employmentRecords: [],
    individualFinances: [],
    entityTraits: [],
    entityOrganizationMemberships: [],
  };
  economy.reseedIds(w);
  return w;
}

// Traits are a CONSTRUCTED fact about each person (standing rule 8),
// not a drawn one — every individual trait set to the same comfortably
// above-break-even value, so `economy.productivityOf` never excludes a
// candidate this file means to be eligible. Same pattern
// test/employment.test.js's `labourWorld` already uses.
function person(w, { id, savings = 0, createdTick = 0, status = 'active', traitValue = 90 } = {}) {
  w.npcs.push({ id, status, createdTick });
  w.entityTraits.push(...generateEntityTraits(id, w.tick, INDIVIDUAL_DEFINITIONS, () => traitValue));
  economy.generateIndividualFinances(w, id, { savings, tick: w.tick });
  return w.npcs[w.npcs.length - 1];
}

// A lightweight stand-in for `engine.generateOrganization` — real
// enough for `businesses.js` to operate on (same fields it reads:
// `id`, `type`, `assets`, `income`, `expenses`), without pulling in the
// full trait-sheet machinery these tests do not need.
function makeGenerateOrganization(w, startId = 5000) {
  let nextId = startId;
  return (options = {}) => {
    const org = {
      id: nextId++,
      entityType: 'organization',
      status: 'active',
      name: options.name || `Org ${nextId}`,
      type: options.type,
      founder_id: options.founderId ?? null,
      leader_id: options.leaderId ?? null,
      members: 0,
      assets: 0,
      income: 0,
      expenses: 0,
      influence: 0,
      security: 0,
      innovation: 0,
      reputation: 50,
      traits: {},
    };
    w.organizations.push(org);
    return org;
  };
}

// Long enough that `drawOccupation` never gates the founder's own hire
// — Tier 1 occupations ask for no schooling at all.
const WORKING_AGE_CREATED_TICK = -(economy.WORKING_AGE + 5) * 365;

// ---------------------------------------------------------------------
// foundBusiness
// ---------------------------------------------------------------------

test('founding moves real capital out of the founder\'s own savings and hires them on the spot', () => {
  const w = world();
  person(w, { id: 1, savings: 10000, createdTick: WORKING_AGE_CREATED_TICK });
  // A going wage for `foundBusiness` to size capital against.
  w.organizations.push({ id: 1, type: 'business', assets: 0, income: 0, expenses: 0 });
  w.employmentRecords.push({
    id: 1, entity_id: 999, employer_organization_id: 1, wage: 50, status: 'active', position: null,
  });
  person(w, { id: 999, savings: 0, createdTick: WORKING_AGE_CREATED_TICK });

  const generateOrganization = makeGenerateOrganization(w);
  const org = businesses.foundBusiness(w, {
    founderId: 1, name: 'Test Co', tick: w.tick, generateOrganization,
  });

  const capital = 50 * businesses.STARTUP_CAPITAL_WAGE_MULTIPLE;
  assert.equal(org.assets, capital);
  assert.equal(org.lifecycleStage, 'startup');
  assert.equal(economy.getLatestFinances(w, 1).savings, 10000 - capital);

  const founderJob = economy.getEmployment(w, 1);
  assert.ok(founderJob, 'the founder holds employment at their own company');
  assert.equal(founderJob.employer_organization_id, org.id);
});

test('founding is refused without enough savings to cover the going wage\'s capital', () => {
  const w = world();
  person(w, { id: 1, savings: 10, createdTick: WORKING_AGE_CREATED_TICK });
  w.organizations.push({ id: 1, type: 'business', assets: 0, income: 0, expenses: 0 });
  w.employmentRecords.push({
    id: 1, entity_id: 999, employer_organization_id: 1, wage: 50, status: 'active', position: null,
  });
  person(w, { id: 999, savings: 0 });

  assert.throws(
    () => businesses.foundBusiness(w, {
      founderId: 1, name: 'Test Co', tick: w.tick, generateOrganization: makeGenerateOrganization(w),
    }),
    /has 10 savings, needs/,
  );
});

test('founding quits whatever job the founder already held, rather than refusing them — '
  + 'most working-age people in a running world already have one', () => {
  const w = world();
  person(w, { id: 1, savings: 10000, createdTick: WORKING_AGE_CREATED_TICK });
  const oldEmployer = { id: 1, type: 'business', assets: 0, income: 0, expenses: 0 };
  w.organizations.push(oldEmployer);
  w.employmentRecords.push({
    id: 1, entity_id: 1, employer_organization_id: 1, wage: 50, status: 'active', position: null,
  });

  const org = businesses.foundBusiness(w, {
    founderId: 1, name: 'Test Co', tick: w.tick, generateOrganization: makeGenerateOrganization(w),
  });

  const oldRecord = w.employmentRecords.find((r) => r.employer_organization_id === oldEmployer.id);
  assert.equal(oldRecord.status, 'ended', 'the old job is really ended, not left dangling');
  const newJob = economy.getEmployment(w, 1);
  assert.equal(newJob.employer_organization_id, org.id, 'the founder now works at their own company');
});

test('founding requires a real generateOrganization, so this module never has to require engine.js', () => {
  const w = world();
  person(w, { id: 1, savings: 10000 });
  assert.throws(
    () => businesses.foundBusiness(w, { founderId: 1, name: 'Test Co', tick: w.tick }),
    /requires options.generateOrganization/,
  );
});

// ---------------------------------------------------------------------
// runBusinessFormation — the seeded gate, pinned exactly rather than
// sampled statistically (standing rule 26: assert the property that
// was claimed). `FOUNDING_CHANCE_PER_TICK` is tiny, so the test finds
// one npc id the draw puts under the chance and one it puts over,
// rather than guessing at a sample size large enough to see it by luck.
// ---------------------------------------------------------------------

function findId(seed, tick, chance, wantBelow) {
  for (let id = 1; id < 200000; id += 1) {
    const draw = seededDraw([seed, 'found-business', tick, id]);
    if (wantBelow ? draw < chance : draw >= chance) return id;
  }
  throw new Error('no id found in range — widen the search or check seededDraw');
}

test('a candidate whose draw clears the founding chance founds a real business', () => {
  const seed = 'biz-formation-hit';
  const tick = 2000;
  const w = world({ tick, seed });
  const id = findId(seed, tick, businesses.FOUNDING_CHANCE_PER_TICK, true);

  w.organizations.push({ id: 1, type: 'business', assets: 0, income: 0, expenses: 0 });
  w.employmentRecords.push({
    id: 1, entity_id: 999, employer_organization_id: 1, wage: 50, status: 'active', position: null,
  });
  person(w, { id: 999, savings: 0, createdTick: WORKING_AGE_CREATED_TICK });
  person(w, { id, savings: 10000, createdTick: WORKING_AGE_CREATED_TICK });

  const result = businesses.runBusinessFormation(w, tick, {
    generateOrganization: makeGenerateOrganization(w),
  });

  assert.equal(result.founded, 1);
  assert.ok(w.organizations.some((o) => o.founder_id === id && o.type === 'business'));
});

test('a candidate whose draw misses the founding chance founds nothing, however rich', () => {
  const seed = 'biz-formation-miss';
  const tick = 2000;
  const w = world({ tick, seed });
  const id = findId(seed, tick, businesses.FOUNDING_CHANCE_PER_TICK, false);

  w.organizations.push({ id: 1, type: 'business', assets: 0, income: 0, expenses: 0 });
  w.employmentRecords.push({
    id: 1, entity_id: 999, employer_organization_id: 1, wage: 50, status: 'active', position: null,
  });
  person(w, { id: 999, savings: 0, createdTick: WORKING_AGE_CREATED_TICK });
  person(w, { id, savings: 1000000, createdTick: WORKING_AGE_CREATED_TICK });

  const result = businesses.runBusinessFormation(w, tick, {
    generateOrganization: makeGenerateOrganization(w),
  });

  assert.equal(result.founded, 0);
});

test('nobody too poor to cover the capital is even offered the draw', () => {
  const w = world({ tick: 2000 });
  w.organizations.push({ id: 1, type: 'business', assets: 0, income: 0, expenses: 0 });
  w.employmentRecords.push({
    id: 1, entity_id: 999, employer_organization_id: 1, wage: 50, status: 'active', position: null,
  });
  person(w, { id: 999, savings: 0, createdTick: WORKING_AGE_CREATED_TICK });
  person(w, { id: 1, savings: 1, createdTick: WORKING_AGE_CREATED_TICK });

  const result = businesses.runBusinessFormation(w, w.tick, {
    generateOrganization: makeGenerateOrganization(w),
  });
  assert.equal(result.founded, 0);
});

test('runBusinessFormation is a no-op with no going wage anywhere (no labour market yet)', () => {
  const w = world();
  person(w, { id: 1, savings: 1000000, createdTick: WORKING_AGE_CREATED_TICK });
  const result = businesses.runBusinessFormation(w, w.tick, {
    generateOrganization: makeGenerateOrganization(w),
  });
  assert.deepEqual(result, { events: [], founded: 0 });
});

// ---------------------------------------------------------------------
// advanceBusinessLifecycle — failure, and the one rescue a tick
// ---------------------------------------------------------------------

test('a staffed business stays put, and a pre-existing one with no lifecycle_stage defaults to startup rather than idea', () => {
  const w = world();
  const org = { id: 1, type: 'business', assets: 1000, income: 0, expenses: 0 };
  w.organizations.push(org);
  w.employmentRecords.push({
    id: 1, entity_id: 2, employer_organization_id: 1, wage: 20, status: 'active', position: null,
  });
  person(w, { id: 2 });

  businesses.advanceBusinessLifecycle(w, w.tick);
  assert.equal(org.lifecycleStage, 'startup');
});

test('losing every employee moves a business to decline, with a real event', () => {
  const w = world();
  const org = { id: 1, type: 'business', assets: 0, income: 0, expenses: 0, lifecycleStage: 'startup' };
  w.organizations.push(org);
  w.employmentRecords.push({
    id: 1, entity_id: 2, employer_organization_id: 1, wage: 20, status: 'ended', position: null,
  });
  person(w, { id: 2 });

  const events = businesses.advanceBusinessLifecycle(w, w.tick);
  assert.equal(org.lifecycleStage, 'decline');
  assert.equal(org.vacantSinceTick, w.tick);
  assert.ok(events.some((e) => e.type === 'business_declined'));
});

test('a declined business that can still afford the going wage rescues itself — the inverse rule 13 asks for', () => {
  const w = world();
  const org = {
    id: 1, type: 'business', assets: 500, income: 0, expenses: 0,
    lifecycleStage: 'decline', vacantSinceTick: w.tick - 3,
  };
  w.organizations.push(org);
  // The going wage this org can afford — somebody else, employed
  // elsewhere, sets the market rate.
  w.organizations.push({ id: 2, type: 'business', assets: 0, income: 0, expenses: 0 });
  w.employmentRecords.push({
    id: 1, entity_id: 50, employer_organization_id: 2, wage: 40, status: 'active', position: null,
  });
  person(w, { id: 50, createdTick: WORKING_AGE_CREATED_TICK });
  person(w, { id: 60, createdTick: WORKING_AGE_CREATED_TICK });

  const events = businesses.advanceBusinessLifecycle(w, w.tick);
  assert.equal(org.lifecycleStage, 'startup');
  assert.equal(org.vacantSinceTick, null);
  assert.ok(events.some((e) => e.type === 'business_recovered'));
  assert.ok(economy.getEmployment(w, 60), 'the rescued hire actually holds the job');
});

test('a declined business that cannot afford anyone closes to legacy after the full window, and stays there', () => {
  const w = world({ tick: 1000 });
  const org = {
    id: 1, type: 'business', assets: 0, income: 0, expenses: 0,
    lifecycleStage: 'decline', vacantSinceTick: 1000 - businesses.LEGACY_AFTER_TICKS,
  };
  w.organizations.push(org);

  let events = businesses.advanceBusinessLifecycle(w, w.tick);
  assert.equal(org.lifecycleStage, 'legacy');
  assert.ok(events.some((e) => e.type === 'business_closed'));

  // Legacy is terminal — a second pass does nothing further to it.
  events = businesses.advanceBusinessLifecycle(w, w.tick + 1);
  assert.equal(org.lifecycleStage, 'legacy');
  assert.deepEqual(events, []);
});

test('a declined business short of the window stays in decline, not yet legacy', () => {
  const w = world({ tick: 1000 });
  const org = {
    id: 1, type: 'business', assets: 0, income: 0, expenses: 0,
    lifecycleStage: 'decline', vacantSinceTick: 1000 - (businesses.LEGACY_AFTER_TICKS - 1),
  };
  w.organizations.push(org);

  businesses.advanceBusinessLifecycle(w, w.tick);
  assert.equal(org.lifecycleStage, 'decline');
});

test('non-business organizations are untouched', () => {
  const w = world();
  const gov = { id: 1, type: 'government', assets: 0, income: 0, expenses: 0 };
  w.organizations.push(gov);
  businesses.advanceBusinessLifecycle(w, w.tick);
  assert.equal(gov.lifecycleStage, undefined);
});

// ---------------------------------------------------------------------
// Derived figures — never stored, computed from the organization's own
// real income/expenses/employment history (standing rule 3)
// ---------------------------------------------------------------------

test('revenueOf and profitOf read the organization\'s own real, already-accumulated income/expenses', () => {
  const org = { income: 500, expenses: 300 };
  assert.equal(businesses.revenueOf(org), 500);
  assert.equal(businesses.profitOf(org), 200);
});

test('profitOf is negative when expenses outrun income — a real business can actually be failing', () => {
  const org = { income: 100, expenses: 900 };
  assert.equal(businesses.profitOf(org), -800);
});

test('industryOf derives the real, named occupation from employment history, not an invented label', () => {
  const w = world();
  w.organizations.push({ id: 1, type: 'business' });
  w.employmentRecords.push({
    id: 1, entity_id: 2, employer_organization_id: 1, wage: 20, status: 'active', position: 'carpenter',
  });
  assert.equal(businesses.industryOf(w, 1), occupations.definitionOf('carpenter').source);
});

test('industryOf is null for a business with no employment history at all', () => {
  const w = world();
  assert.equal(businesses.industryOf(w, 999), null);
});

test('marketShareOf is this business\'s income against every business\'s, and null with no denominator', () => {
  const w = world();
  w.organizations.push({ id: 1, type: 'business', income: 300 });
  w.organizations.push({ id: 2, type: 'business', income: 100 });
  assert.equal(businesses.marketShareOf(w, 1), 0.75);
  assert.equal(businesses.marketShareOf(w, 2), 0.25);

  const empty = world();
  assert.equal(businesses.marketShareOf(empty, 1), null);
});

// ---------------------------------------------------------------------
// On a real generated world — the sixteenth standing rule
// ---------------------------------------------------------------------

test('a generated world actually founds and can lose businesses over real ticks', () => {
  const w = engine.WorldState;
  worldgen.generateWorld({ seed: 'businesses-integration' });

  const TICKS = 300;
  for (let t = 0; t < TICKS; t += 1) engine.advanceTick();

  const biz = w.organizations.filter((o) => o.type === 'business');
  assert.ok(biz.length > 0, 'worldgen should have founded at least the starting businesses');
  for (const org of biz) {
    assert.ok(
      ['idea', 'startup', 'decline', 'legacy'].includes(org.lifecycleStage),
      `business ${org.id} has an unrecognised lifecycle_stage: ${org.lifecycleStage}`,
    );
  }

  // Not asserted as a specific count — only that the mechanism this
  // session built actually ran on a real world rather than only in a
  // hand-built fixture.
  const founded = biz.filter((o) => o.founder_id !== null);
  assert.ok(founded.length > 0,
    'FOUNDING_CHANCE_PER_TICK should have produced at least one new business over 300 ticks '
    + 'in a populated world — if this fails, the rate needs remeasuring, not re-asserting');
});
