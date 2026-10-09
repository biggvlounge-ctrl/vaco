// VDP — diseases. The no-inverse bug (a cure that doesn't exactly
// reverse the real penalty) this file asserts against was watched
// failing against a deliberately-wrong pre-fix cure amount before
// being trusted.

'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createDiseaseStore, contractDisease, cureDisease, activeDiseaseFor, casesFor,
  DISEASE_HEALTH_PENALTY,
} from '../src/lib/diseases.js';
import { generateTraitSheet } from '../src/lib/traits.js';
import { HEALTH_TRAITS } from '../src/lib/hospital.js';

test('contractDisease requires a personId, a real name, and the person\'s traits', () => {
  const store = createDiseaseStore();
  const traits = generateTraitSheet(() => 0.5);
  assert.throws(() => contractDisease(store, { name: 'the common cold', traits }), /personId/);
  assert.throws(() => contractDisease(store, { personId: 'alice', traits }), /real disease name/);
  assert.throws(() => contractDisease(store, { personId: 'alice', name: 'the common cold' }), /traits/);
});

test('contractDisease lowers every real health trait by the same flagged-interpretive penalty', () => {
  const store = createDiseaseStore();
  const traits = generateTraitSheet(() => 0.5); // every trait at 50
  const caseRecord = contractDisease(store, { personId: 'alice', name: 'the common cold', traits });

  for (const name of HEALTH_TRAITS) {
    assert.equal(caseRecord.healthEffect.before[name], 50);
    assert.equal(caseRecord.healthEffect.after[name], 50 - DISEASE_HEALTH_PENALTY);
    assert.equal(traits.health[name], 50 - DISEASE_HEALTH_PENALTY);
  }
  assert.equal(activeDiseaseFor(store, 'alice').id, caseRecord.id);
});

test('contractDisease refuses a second active disease for the same real person', () => {
  const store = createDiseaseStore();
  const traits = generateTraitSheet(() => 0.5);
  contractDisease(store, { personId: 'alice', name: 'the common cold', traits });
  assert.throws(
    () => contractDisease(store, { personId: 'alice', name: 'influenza', traits }),
    /already has an active, uncured disease/,
  );
});

test('cureDisease is the exact real inverse of the penalty, never a guessed-at amount', () => {
  const store = createDiseaseStore();
  const traits = generateTraitSheet(() => 0.5);
  contractDisease(store, { personId: 'alice', name: 'the common cold', traits });
  const cured = cureDisease(store, 'alice', { traits });

  for (const name of HEALTH_TRAITS) {
    assert.equal(traits.health[name], 50, 'curing must restore exactly what contracting took');
  }
  assert.ok(cured.curedAt);
  assert.equal(activeDiseaseFor(store, 'alice'), null);
});

test('cureDisease refuses someone with no active disease, and requires real traits', () => {
  const store = createDiseaseStore();
  const traits = generateTraitSheet(() => 0.5);
  assert.throws(() => cureDisease(store, 'never-sick', { traits }), /has no active disease/);

  contractDisease(store, { personId: 'alice', name: 'the common cold', traits });
  assert.throws(() => cureDisease(store, 'alice'), /traits/);
});

test('a cured person can contract a new disease afterward', () => {
  const store = createDiseaseStore();
  const traits = generateTraitSheet(() => 0.5);
  contractDisease(store, { personId: 'alice', name: 'the common cold', traits });
  cureDisease(store, 'alice', { traits });
  const second = contractDisease(store, { personId: 'alice', name: 'influenza', traits });
  assert.equal(second.name, 'influenza');
  assert.equal(casesFor(store, 'alice').length, 2);
});
