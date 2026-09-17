// Employment and payroll — wages that move money rather than making it.
//
// **What this closes.** `employment_records` was one of nine urban
// systems (§7) sitting at `slot`: a table the schema defines and no
// engine code touches. `economy.js` said so in its own header — "NOT
// built here... a natural follow-up". This is the follow-up.
//
// The property that matters most is conservation. Crediting the
// employee and leaving the employer alone would have been half a line
// shorter and would have made every organization an infinite money
// source — and because `getNetWorth` and `getFamilyWealth` both read
// `individual_finances`, that money would have shown up as real
// household wealth across the whole world. So every test below that
// pays a wage also checks where it came from.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const economy = require('../server/economy.js');

function world({ assets = 1000 } = {}) {
  const worldState = {
    tick: 10,
    npcs: [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }],
    organizations: [
      { id: 100, assets, expenses: 0 },
      { id: 200, assets: 0, expenses: 0 },
    ],
    resources: [],
    marketListings: [],
    individualFinances: [],
    employmentRecords: [],
  };
  economy.reseedIds(worldState);
  return worldState;
}

const org = (w, id) => w.organizations.find((o) => o.id === id);

// -- hiring -------------------------------------------------------------

test('a hire records the wage relationship, and the id sequence survives a reseed', () => {
  const w = world();
  const record = economy.hireEntity(w, {
    entityId: 1, employerOrganizationId: 100, wage: 25, position: 'mill hand', tick: 10,
  });

  assert.equal(record.entity_id, 1);
  assert.equal(record.employer_organization_id, 100);
  assert.equal(record.wage, 25);
  assert.equal(record.status, 'active');
  assert.equal(record.start_tick, 10);
  assert.deepEqual(economy.getEmployment(w, 1), record);

  // `reseedIds` is what a restore calls, and an id counter that does
  // not survive it hands out a duplicate primary key on the next hire.
  const seeded = economy.reseedIds(w);
  assert.equal(seeded.nextEmploymentRecordId, record.id + 1);
  const second = economy.hireEntity(w, { entityId: 2, employerOrganizationId: 100, wage: 10 });
  assert.notEqual(second.id, record.id);
});

test('a wage of zero is a real unpaid position; NaN and negative are not', () => {
  const w = world();
  // Zero is deliberately allowed — an unpaid position is a real
  // arrangement, and a truthiness check would have refused it.
  assert.doesNotThrow(() => economy.hireEntity(w, {
    entityId: 1, employerOrganizationId: 100, wage: 0,
  }));

  // NaN is the one that matters: `typeof NaN === 'number'` is true and
  // `NaN < 0` is false, so a `wage > 0` style guard admits it — and
  // then every sum on that employee's finances is NaN forever, with no
  // reversal path. Same guard V3's ledger needed, for the same reason.
  for (const wage of [Number.NaN, -5, Number.POSITIVE_INFINITY, undefined, '25']) {
    assert.throws(() => economy.hireEntity(w, {
      entityId: 2, employerOrganizationId: 100, wage,
    }), /non-negative finite wage/, `wage ${String(wage)} was accepted`);
  }
});

test('hiring into an organization that does not exist is refused', () => {
  const w = world();
  assert.throws(() => economy.hireEntity(w, {
    entityId: 1, employerOrganizationId: 999, wage: 10,
  }), /no organization 999/);
  assert.equal(w.employmentRecords.length, 0, 'a refused hire left a record behind');
});

test('one active job per person, and ending one frees the slot', () => {
  // Two active records would both draw a wage every tick for the same
  // person — which reads as a plausible salary and is not one.
  const w = world();
  const first = economy.hireEntity(w, { entityId: 1, employerOrganizationId: 100, wage: 25 });
  assert.throws(() => economy.hireEntity(w, {
    entityId: 1, employerOrganizationId: 200, wage: 40,
  }), /already holds employment/);

  economy.endEmployment(w, { entityId: 1 });
  assert.equal(first.status, 'ended');
  assert.equal(economy.getEmployment(w, 1), null);

  // And the ended record is kept, not deleted — it is employment
  // history, and `listEmployment` can still find it.
  assert.equal(w.employmentRecords.length, 1);
  assert.equal(economy.listEmployment(w, { status: 'ended' }).length, 1);

  assert.doesNotThrow(() => economy.hireEntity(w, {
    entityId: 1, employerOrganizationId: 200, wage: 40,
  }));
  assert.equal(economy.getEmployment(w, 1).employer_organization_id, 200);
});

test('no `end_tick` is written, because the schema has no column for it', () => {
  // The first version set one. `employment_records` is id, entity_id,
  // employer_organization_id, wage, position, start_tick, status — so
  // an end_tick would be dropped on migrate and absent on restore: a
  // field the engine sets and the database cannot hold. CLAUDE.md's
  // bar for adding one is that the engine must READ it, and nothing
  // does.
  const w = world();
  economy.hireEntity(w, { entityId: 1, employerOrganizationId: 100, wage: 25 });
  const ended = economy.endEmployment(w, { entityId: 1 });
  assert.equal('end_tick' in ended, false,
    'end_tick is set but cannot be persisted — it would vanish on the next restore');
});

// -- payroll conserves money -------------------------------------------

test('a paid wage leaves the employer and arrives with the employee', () => {
  const w = world({ assets: 1000 });
  economy.hireEntity(w, { entityId: 1, employerOrganizationId: 100, wage: 25 });
  economy.hireEntity(w, { entityId: 2, employerOrganizationId: 100, wage: 40 });

  const result = economy.runPayroll(w, 11);
  assert.equal(result.paid, 2);
  assert.equal(result.missed, 0);

  // **Conservation, which is the whole point.** 65 left the employer
  // and 65 arrived. An implementation that credited the employees and
  // left the employer alone passes every other assertion in this file.
  assert.equal(org(w, 100).assets, 1000 - 65);
  assert.equal(org(w, 100).expenses, 65);
  assert.equal(economy.getLatestFinances(w, 1).savings, 25);
  assert.equal(economy.getLatestFinances(w, 2).savings, 40);
  assert.equal(economy.getLatestFinances(w, 1).income, 25);
});

test('savings accumulate across ticks and the balance carries forward', () => {
  const w = world({ assets: 1000 });
  economy.hireEntity(w, { entityId: 1, employerOrganizationId: 100, wage: 25 });

  for (const tick of [11, 12, 13]) economy.runPayroll(w, tick);

  // One row per tick, because individual_finances is keyed
  // (entity_id, tick) — that is what makes getLatestFinances mean
  // something rather than being a lucky array order.
  const rows = w.individualFinances.filter((r) => r.entity_id === 1);
  assert.equal(rows.length, 3);
  assert.deepEqual(rows.map((r) => r.tick), [11, 12, 13]);

  const latest = economy.getLatestFinances(w, 1);
  assert.equal(latest.savings, 75, 'the previous balance was not carried forward');
  assert.equal(latest.income, 25, 'income is this tick\'s wage, not the running total');
  assert.equal(org(w, 100).assets, 1000 - 75);
  assert.equal(economy.getNetWorth(w, 1), 75);
});

test('an employer that cannot cover a wage does not pay, and says so', () => {
  const w = world({ assets: 30 });
  economy.hireEntity(w, { entityId: 1, employerOrganizationId: 100, wage: 25 });
  economy.hireEntity(w, { entityId: 2, employerOrganizationId: 100, wage: 25 });

  const result = economy.runPayroll(w, 11);
  assert.equal(result.paid, 1);
  assert.equal(result.missed, 1);

  // Not paid into debt, and not paid partially. The employer's assets
  // never go negative.
  assert.equal(org(w, 100).assets, 5);
  assert.ok(org(w, 100).assets >= 0, 'the employer paid money it did not have');
  assert.equal(economy.getLatestFinances(w, 2), null, 'an unpaid wage was credited anyway');

  // The miss is an event, so the Event phase sees a failing employer
  // rather than it being visible only to whoever reads the numbers.
  assert.equal(result.events.length, 1);
  assert.equal(result.events[0].type, 'payroll_missed');
  assert.equal(result.events[0].organizationId, 100);
  assert.equal(result.events[0].wage, 25);
  assert.equal(result.events[0].tick, 11);
});

test('an ended job stops being paid', () => {
  const w = world({ assets: 1000 });
  economy.hireEntity(w, { entityId: 1, employerOrganizationId: 100, wage: 25 });
  economy.runPayroll(w, 11);
  economy.endEmployment(w, { entityId: 1 });

  const after = economy.runPayroll(w, 12);
  assert.equal(after.paid, 0);
  assert.equal(economy.getLatestFinances(w, 1).savings, 25, 'an ended job kept paying');
  assert.equal(org(w, 100).assets, 975);
});

test('an employer deleted out from under its staff halts pay without hiding it', () => {
  // The record stays `active` on purpose. Somebody removing an
  // organization while it still has staff is a real bug, and silently
  // ending the employment here would make it unfindable.
  const w = world({ assets: 1000 });
  economy.hireEntity(w, { entityId: 1, employerOrganizationId: 100, wage: 25 });
  w.organizations = w.organizations.filter((o) => o.id !== 100);

  const result = economy.runPayroll(w, 11);
  assert.equal(result.paid, 0);
  assert.equal(result.missed, 0, 'a vanished employer is not the same as a broke one');
  assert.equal(economy.getEmployment(w, 1).status, 'active',
    'the record was quietly ended, hiding that its employer disappeared');
});

// -- the rate is computed, never stored --------------------------------

test('the employment rate is derived from active records', () => {
  const w = world({ assets: 1000 });
  assert.equal(economy.getEmploymentRate(w), 0);

  economy.hireEntity(w, { entityId: 1, employerOrganizationId: 100, wage: 10 });
  economy.hireEntity(w, { entityId: 2, employerOrganizationId: 100, wage: 10 });
  assert.equal(economy.getEmploymentRate(w), 0.5, '2 of 4 NPCs employed');

  economy.endEmployment(w, { entityId: 2 });
  assert.equal(economy.getEmploymentRate(w), 0.25, 'an ended job still counted as employed');

  // No people is unknown, not zero — the same distinction `moodFor()`
  // got wrong when `Number(null)` made an unobserved value read as a
  // real zero.
  assert.equal(economy.getEmploymentRate({ npcs: [], employmentRecords: [] }), null);
});

test('nothing writes communities.employment from here', () => {
  // Standing rule 3: never duplicate a computable rollup.
  // `communities.employment` is a separate stored field seeded at 50,
  // and two sources of truth for one concept is exactly what that rule
  // exists to prevent. If this module ever starts writing it, the
  // rollup and the record will disagree and nothing will say which is
  // right.
  const source = require('node:fs').readFileSync(
    require.resolve('../server/economy.js'), 'utf8',
  ).replace(/^\s*\/\/.*$/gm, '');
  assert.equal(/\.employment\s*=/.test(source), false,
    'economy.js assigns to an `employment` field — check it is not communities.employment');
});

// -- the labour market --------------------------------------------------
//
// **`hireEntity` was called exactly once in the whole engine**, by
// `worldgen`, at generation. `justice.imprison` ends a contract and
// death takes a person out of `npcs`, so employment could only ever
// shrink: a child born into the world could never hold a job and a
// released prisoner could never work again. Measured on a 400-tick
// playtest before this existed — 55 jobs at generation, 51 at the end,
// and the only direction was down.
//
// The tests below are about the two properties that make it a market
// rather than a second ratchet pointing the other way: **who is hired
// is decided by whether they can cover their own wage, and nothing
// else**, and **an employer that cannot pay lets somebody go.**

const { getLiveEntity } = require('../server/entityTraits.js');
const { INDIVIDUAL_DEFINITIONS } = require('../server/traitDefinitions.js');
const { generateEntityTraits } = require('../server/entityTraits.js');

// A world where productivity is a CONSTRUCTED fact about each person
// rather than a drawn one — standing rule 8, because the whole point of
// every assertion here is which side of break-even somebody sits on.
function labourWorld({ assets = 10000, traitValue = 90, tick = 36500 } = {}) {
  const worldState = {
    tick,
    npcs: [],
    organizations: [{ id: 100, assets, expenses: 0, income: 0 }],
    entityOrganizationMemberships: [],
    employmentRecords: [],
    individualFinances: [],
    entityTraits: [],
    resources: [],
    marketListings: [],
  };
  const add = (id, value, age = 30) => {
    worldState.npcs.push({
      id, status: 'active', createdTick: tick - Math.round(age * 365),
    });
    worldState.entityTraits.push(
      ...generateEntityTraits(id, tick, INDIVIDUAL_DEFINITIONS, () => value),
    );
  };
  // One incumbent, so the employer is a going concern with a wage scale.
  add(1, traitValue);
  economy.hireEntity(worldState, {
    entityId: 1, employerOrganizationId: 100, wage: 20, tick,
  });
  return { worldState, add };
}

test('somebody who can cover their own wage gets hired; somebody who cannot does not', () => {
  const { worldState: w, add } = labourWorld();
  add(2, 90);   // well above break-even
  add(3, 5);    // well below it

  const result = economy.runLabour(w, w.tick, []);

  assert.equal(result.hired.length, 1, 'more or fewer than one vacancy was filled');
  assert.equal(result.hired[0].entityId, 2);
  assert.equal(economy.getEmployment(w, 3), null,
    'somebody who costs their employer money was hired anyway');

  // The new hire is paid what the person at the next desk is paid —
  // no invented wage constant.
  assert.equal(result.hired[0].wage, economy.goingWage(w, 100));
  assert.equal(result.hired[0].wage, 20);

  // A hire is a membership as well as a contract. `worldgen` has always
  // written both, and writing only one leaves every per-area
  // organization statistic disagreeing with the labour market.
  assert.ok(w.entityOrganizationMemberships.some(
    (m) => m.entity_id === 2 && m.organization_id === 100,
  ), 'the new hire joined no organization');
});

test('break-even is WAGE_TO_OUTPUT\'s own reciprocal, not a chosen threshold', () => {
  // Standing rule 12's third clause says a threshold picked from what a
  // number sounds like is a guess. This one is not picked at all:
  // output is `wage * WAGE_TO_OUTPUT * productivity`, so a worker pays
  // for themselves at exactly 1 / WAGE_TO_OUTPUT and the unemployment
  // rate falls out of the population's trait distribution.
  assert.equal(economy.BREAK_EVEN_PRODUCTIVITY, 1 / 1.3);

  const { worldState: w, add } = labourWorld();
  add(2, 50);   // an exactly average person
  economy.runLabour(w, w.tick, []);
  // An average worker produces 1.3x their wage, so they are hired.
  assert.ok(economy.getEmployment(w, 2), 'an average worker was turned away');
});

test('nobody is hired or refused for anything but what they can do', () => {
  // §9 permits demographic modelling and forbids demographics deciding
  // what a person is worth. A labour market is where that line is
  // easiest to cross by accident, so it is asserted rather than
  // assumed: two people identical in capability and different in every
  // demographic fact get the same answer.
  const { worldState: w, add } = labourWorld();
  add(2, 80);
  add(3, 80);
  Object.assign(w.npcs.find((n) => n.id === 2),
    { religion: 'one', ethnicity: 'a', education: 'advanced', name: 'A' });
  Object.assign(w.npcs.find((n) => n.id === 3),
    { religion: 'other', ethnicity: 'b', education: 'none', name: 'B' });

  // Two ticks, so both vacancies come up.
  economy.runLabour(w, w.tick, []);
  economy.runLabour(w, w.tick + 1, []);
  assert.ok(economy.getEmployment(w, 2) && economy.getEmployment(w, 3),
    'two equally capable people got different answers');
});

test('somebody serving a sentence is not in the labour market', () => {
  const { worldState: w, add } = labourWorld();
  add(2, 90);
  w.npcs.find((n) => n.id === 2).status = 'imprisoned';
  economy.runLabour(w, w.tick, []);
  assert.equal(economy.getEmployment(w, 2), null,
    're-hiring a prisoner undoes what justice.imprison did');
});

test('a child is not in the labour market', () => {
  const { worldState: w, add } = labourWorld();
  add(2, 90, 9);
  economy.runLabour(w, w.tick, []);
  assert.equal(economy.getEmployment(w, 2), null);
  assert.equal(economy.WORKING_AGE, 16, 'worldgen offers work at 16; this has to agree');
});

test('an employer that cannot cover a wage lets that person go — the inverse', () => {
  // A mechanism with no inverse has no equilibrium (standing rule 13),
  // and hiring without firing is the same ratchet pointing the other
  // way. The signal is the one `runPayroll` already produces, read
  // rather than re-derived.
  const { worldState: w } = labourWorld();
  const missed = [{
    type: 'payroll_missed', organizationId: 100, entityId: 1, wage: 20, assets: 0, tick: w.tick,
  }];

  const result = economy.runLabour(w, w.tick, missed);
  assert.equal(result.laidOff.length, 1);
  assert.equal(economy.getEmployment(w, 1), null, 'an unpayable job stayed open');
  assert.equal(result.events[0].type, 'laid_off');

  // And a broke employer does not hire on the same tick it failed to
  // pay somebody.
  assert.equal(result.hired.length, 0);
});

test('the same person is not let go twice', () => {
  // A `payroll_missed` for a contract something else already ended
  // would otherwise throw out of `endEmployment` and take the tick
  // with it — the shape of bug that stopped the world in justice.js.
  const { worldState: w } = labourWorld();
  economy.endEmployment(w, { entityId: 1 });
  const missed = [{
    type: 'payroll_missed', organizationId: 100, entityId: 1, wage: 20, assets: 0, tick: w.tick,
  }];
  assert.doesNotThrow(() => economy.runLabour(w, w.tick, missed));
});

test('an employer that cannot afford the wage bill does not take anybody on', () => {
  const { worldState: w, add } = labourWorld({ assets: 25 });
  add(2, 90);
  // 20 already committed to the incumbent, 20 more for the new hire,
  // against 25 in the bank.
  assert.equal(economy.runLabour(w, w.tick, []).hired.length, 0);
});

test('an employer with nobody left is not in the market', () => {
  // It has no wage scale of its own and no evidence it can pay. This is
  // what keeps a dead business dead rather than resurrecting it the
  // moment somebody becomes available.
  const { worldState: w, add } = labourWorld();
  economy.endEmployment(w, { entityId: 1 });
  add(2, 90);
  assert.equal(economy.runLabour(w, w.tick, []).hired.length, 0);
});
