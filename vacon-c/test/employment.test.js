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
