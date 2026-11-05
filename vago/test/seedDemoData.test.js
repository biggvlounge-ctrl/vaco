// VAGO — Demo seed data. Closes the same gap `groupWagerCompetitions.js`
// and `blindPredictions.js`'s own headers already named: real
// create/view/participate routes existed with no seed data anywhere, so
// a fresh boot showed an empty Competitions/BLIND tab. These seed
// functions call the exact same real lib functions server.js's own
// routes call -- never a hand-built competition/blind-round object that
// skips their validation.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createVagoStore } = require('../lib/store');
const { seedDemoData } = require('../lib/seedDemoData');
const { pointsStandings, findCompetition } = require('../lib/groupWagerCompetitions');
const { findBlindRound } = require('../lib/blindPredictions');

function ledger() {
  const legs = [];
  const fn = async (settlementLegs) => {
    legs.push(...settlementLegs);
    return { settlementId: legs.length };
  };
  fn.legs = legs;
  return fn;
}

test('seedDemoData seeds a real competition with one settled leg showing real points', async () => {
  const store = createVagoStore();
  await seedDemoData(store, { settleFn: ledger() });

  assert.equal(store.competitions.length, 1);
  const competition = findCompetition(store, store.competitions[0].id);
  assert.equal(competition.legs.length, 2);

  const standings = pointsStandings(store, competition);
  assert.ok(standings.length > 0, 'at least one real participant must have real points');
  assert.ok(standings.some((row) => row.points > 0), 'the settled leg must produce a non-zero points row');
});

test('seedDemoData seeds a real resolved BLIND round and a real open Before-the-Answer round', async () => {
  const store = createVagoStore();
  await seedDemoData(store, { settleFn: ledger() });

  assert.equal(store.blindRounds.length, 2);
  const resolved = store.blindRounds.find((r) => r.format === 'blind');
  const open = store.blindRounds.find((r) => r.format === 'before-the-answer');

  assert.ok(resolved, 'a seeded blind round must exist');
  assert.equal(resolved.status, 'resolved');
  assert.equal(findBlindRound(store, resolved.id).realAnswer, 'Cardinals');

  assert.ok(open, 'a seeded before-the-answer round must exist');
  assert.equal(open.status, 'open');
  assert.equal(open.answers.length, 1);
});

test('seeding is idempotent -- calling seedDemoData twice never double-seeds', async () => {
  const store = createVagoStore();
  await seedDemoData(store, { settleFn: ledger() });
  await seedDemoData(store, { settleFn: ledger() });

  assert.equal(store.competitions.length, 1);
  assert.equal(store.blindRounds.length, 2);
});
