// Vvltvre Studios — a project cannot raise more than its budget.
//
// **Measured before the fix.** `investInProject` checked
// `budgetRequested - amountRaised`, awaited the settlement, then added
// to `amountRaised`. Five investors each offering the full remaining
// budget at once all passed the check, all settled, and all paid:
// **500.00 raised against a 100.00 budget, and 500.00 of real VCoin
// moved**. Five people had each bought the whole raise.
//
// This is the consequential end of the settlement-race family. A
// double payout costs the house money it can see; an overfunded raise
// creates equity obligations to more investors than there is equity,
// which is not something a later ledger correction can undo.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const projects = require('../lib/projects');
const { createVultureStudiosStore } = require('../lib/store');

function ledger({ delayMs = 15, failFirstCall = false } = {}) {
  const legs = [];
  let refuse = failFirstCall;
  const fn = async (settlementLegs) => {
    if (refuse) { refuse = false; throw new Error('V3 unreachable'); }
    if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
    legs.push(...settlementLegs);
  };
  fn.legs = legs;
  fn.moved = () => Math.round(legs.reduce((n, l) => n + l.amount, 0) * 100) / 100;
  return fn;
}

const greenlit = (store, budgetRequested = 100) => projects.greenlightProject(store, {
  title: 'T', medium: projects.PROJECT_MEDIUMS[0], synopsis: 's', budgetRequested,
});

test('concurrent investors cannot overfund a project', async () => {
  const store = createVultureStudiosStore();
  const project = greenlit(store, 100);
  const fn = ledger();

  await Promise.allSettled(Array.from({ length: 5 }, (_, i) => projects.investInProject(store,
    { projectId: project.id, investorId: `inv${i}`, amount: 100, settleFn: fn })));

  const after = store.projects.find((p) => p.id === project.id);
  assert.ok(after.amountRaised <= after.budgetRequested,
    `raised ${after.amountRaised} against a budget of ${after.budgetRequested}`);
  assert.ok(fn.moved() <= 100,
    `${fn.moved()} VCoin moved into a project that only needed 100`);
});

test('a project still fills from several partial investments', async () => {
  // The fix must not block the ordinary case it exists to bound.
  const store = createVultureStudiosStore();
  const project = greenlit(store, 100);
  const fn = ledger({ delayMs: 0 });

  await projects.investInProject(store, { projectId: project.id, investorId: 'a', amount: 40, settleFn: fn });
  await projects.investInProject(store, { projectId: project.id, investorId: 'b', amount: 60, settleFn: fn });

  const after = store.projects.find((p) => p.id === project.id);
  assert.equal(after.amountRaised, 100);
  assert.equal(after.status, 'funded', 'a fully-subscribed project did not close');
  assert.equal(fn.moved(), 100);
});

test('a failed settlement does not consume the raise', async () => {
  const store = createVultureStudiosStore();
  const project = greenlit(store, 100);
  const fn = ledger({ failFirstCall: true, delayMs: 0 });

  await assert.rejects(() => projects.investInProject(store,
    { projectId: project.id, investorId: 'a', amount: 40, settleFn: fn }), /V3 unreachable/);

  const after = store.projects.find((p) => p.id === project.id);
  assert.equal(after.amountRaised, 0,
    'a failed settlement recorded a raise nobody paid for');
  assert.equal(after.status, 'greenlit', 'the project changed status on a failed settlement');
  assert.equal(store.investments.length, 0, 'a failed settlement left an investment record');

  await projects.investInProject(store, { projectId: project.id, investorId: 'a', amount: 40, settleFn: fn });
  assert.equal(fn.moved(), 40);
});
