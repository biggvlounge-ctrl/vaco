'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createCustomsStore, declareImport, declareExport, payCustomsDuty, declarationsFor, isCleared,
  declarationsByDirection, seizeSmuggledGoods, seizuresFor, listSeizures, CUSTOMS_DUTY_RATE,
} from '../src/lib/customs.js';

test('declareImport records a real declaration with a computed duty', () => {
  const store = createCustomsStore();
  const declaration = declareImport(store, { personId: 'alice', itemName: 'books', quantity: 3, declaredValue: 100 });
  assert.equal(declaration.personId, 'alice');
  assert.equal(declaration.itemName, 'books');
  assert.equal(declaration.quantity, 3);
  assert.equal(declaration.dutyOwed, Math.round(100 * CUSTOMS_DUTY_RATE));
  assert.equal(declaration.paid, false);
  assert.equal(declarationsFor(store, 'alice').length, 1);
});

test('declareImport refuses a missing personId/itemName/quantity/declaredValue', () => {
  const store = createCustomsStore();
  assert.throws(() => declareImport(store, { itemName: 'books', declaredValue: 10 }), /personId/);
  assert.throws(() => declareImport(store, { personId: 'alice', declaredValue: 10 }), /itemName/);
  assert.throws(() => declareImport(store, { personId: 'alice', itemName: 'books', quantity: 0, declaredValue: 10 }), /quantity/);
  assert.throws(() => declareImport(store, { personId: 'alice', itemName: 'books', declaredValue: -5 }), /declaredValue/);
});

test('payCustomsDuty claims before paying, and clears the declaration on success', async () => {
  const store = createCustomsStore();
  const declaration = declareImport(store, { personId: 'alice', itemName: 'books', declaredValue: 50 });
  let transferredArgs = null;
  const cleared = await payCustomsDuty(store, declaration.id, {
    transferFn: async (args) => { transferredArgs = args; },
  });
  assert.equal(cleared.paid, true);
  assert.ok(cleared.clearedAt);
  assert.equal(transferredArgs.fromUserId, 'alice');
  assert.equal(transferredArgs.amount, declaration.dutyOwed);
  assert.equal(isCleared(store, declaration.id), true);
});

test('payCustomsDuty rolls back the claim if the real transfer fails', async () => {
  const store = createCustomsStore();
  const declaration = declareImport(store, { personId: 'alice', itemName: 'books', declaredValue: 50 });
  await assert.rejects(
    payCustomsDuty(store, declaration.id, { transferFn: async () => { throw new Error('insufficient funds'); } }),
    /insufficient funds/,
  );
  assert.equal(declaration.paid, false);
  assert.equal(declaration.clearedAt, null);
});

test('payCustomsDuty refuses to pay an unknown or already-paid declaration', async () => {
  const store = createCustomsStore();
  await assert.rejects(payCustomsDuty(store, 999, { transferFn: async () => {} }), /no declaration/);

  const declaration = declareImport(store, { personId: 'alice', itemName: 'books', declaredValue: 50 });
  await payCustomsDuty(store, declaration.id, { transferFn: async () => {} });
  await assert.rejects(payCustomsDuty(store, declaration.id, { transferFn: async () => {} }), /already paid/);
});

test('seizeSmuggledGoods records a real, separate enforcement action', () => {
  const store = createCustomsStore();
  const seizure = seizeSmuggledGoods(store, { personId: 'bob', itemName: 'guns', quantity: 2, seizedBy: 'patrol-1' });
  assert.equal(seizure.personId, 'bob');
  assert.equal(seizure.itemName, 'guns');
  assert.equal(seizure.quantity, 2);
  assert.equal(seizure.seizedBy, 'patrol-1');
  assert.equal(seizuresFor(store, 'bob').length, 1);
  assert.equal(listSeizures(store).length, 1);
});

test('seizeSmuggledGoods refuses a missing personId/itemName/quantity', () => {
  const store = createCustomsStore();
  assert.throws(() => seizeSmuggledGoods(store, { itemName: 'guns' }), /personId/);
  assert.throws(() => seizeSmuggledGoods(store, { personId: 'bob' }), /itemName/);
  assert.throws(() => seizeSmuggledGoods(store, { personId: 'bob', itemName: 'guns', quantity: -1 }), /quantity/);
});

test('a declaration and a seizure of the same good stay real and separate records', () => {
  const store = createCustomsStore();
  declareImport(store, { personId: 'alice', itemName: 'books', declaredValue: 50 });
  seizeSmuggledGoods(store, { personId: 'alice', itemName: 'guns', seizedBy: 'patrol-2' });
  assert.equal(declarationsFor(store, 'alice').length, 1);
  assert.equal(seizuresFor(store, 'alice').length, 1);
});

// -- the real, symmetric export declaration (14 Oct 2026) ----------------

test('declareExport records a real declaration with a computed duty, same as declareImport', () => {
  const store = createCustomsStore();
  const declaration = declareExport(store, { personId: 'alice', itemName: 'crop', quantity: 5, declaredValue: 60 });
  assert.equal(declaration.direction, 'export');
  assert.equal(declaration.dutyOwed, Math.round(60 * CUSTOMS_DUTY_RATE));
  assert.equal(declaration.paid, false);
});

test('declareExport refuses a missing personId/itemName/quantity/declaredValue', () => {
  const store = createCustomsStore();
  assert.throws(() => declareExport(store, { itemName: 'crop', declaredValue: 10 }), /personId/);
  assert.throws(() => declareExport(store, { personId: 'alice', declaredValue: 10 }), /itemName/);
  assert.throws(() => declareExport(store, { personId: 'alice', itemName: 'crop', quantity: 0, declaredValue: 10 }), /quantity/);
  assert.throws(() => declareExport(store, { personId: 'alice', itemName: 'crop', declaredValue: -5 }), /declaredValue/);
});

test('payCustomsDuty clears a real export declaration exactly like an import one', async () => {
  const store = createCustomsStore();
  const declaration = declareExport(store, { personId: 'alice', itemName: 'crop', declaredValue: 50 });
  const cleared = await payCustomsDuty(store, declaration.id, { transferFn: async () => {} });
  assert.equal(cleared.paid, true);
  assert.equal(isCleared(store, declaration.id), true);
});

test('declarationsByDirection splits real imports from real exports', () => {
  const store = createCustomsStore();
  declareImport(store, { personId: 'alice', itemName: 'books', declaredValue: 50 });
  declareImport(store, { personId: 'bob', itemName: 'guns', declaredValue: 80 });
  declareExport(store, { personId: 'alice', itemName: 'crop', declaredValue: 60 });
  assert.equal(declarationsByDirection(store, 'import').length, 2);
  assert.equal(declarationsByDirection(store, 'export').length, 1);
});
