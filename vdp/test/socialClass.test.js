// VDP — socialClass.js: a real, derived class read feeding the real
// public-housing relocation gate.

'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';

import { classify, shouldRelocateToProjectHousing, SOCIAL_CLASSES, RELOCATION_UNPAID_TICKET_THRESHOLD } from '../src/lib/socialClass.js';

test('an elite person is always elite, regardless of tickets or income', () => {
  assert.equal(classify({ isElite: true, incomeLevelName: 'low', unpaidTicketCount: 10, isDetained: true }), 'elite');
});

test('a stable, middle-income person with no open tickets is stable', () => {
  assert.equal(classify({ incomeLevelName: 'middle', unpaidTicketCount: 0 }), 'stable');
});

test('an active detention is always at-risk, regardless of everything else', () => {
  assert.equal(classify({ incomeLevelName: 'affluent', unpaidTicketCount: 0, isDetained: true }), 'at-risk');
});

test('crossing the real unpaid-ticket threshold is at-risk even for a high earner', () => {
  assert.equal(classify({ incomeLevelName: 'affluent', unpaidTicketCount: RELOCATION_UNPAID_TICKET_THRESHOLD }), 'at-risk');
  assert.equal(classify({ incomeLevelName: 'affluent', unpaidTicketCount: RELOCATION_UNPAID_TICKET_THRESHOLD - 1 }), 'stable');
});

test('low income combined with even one open ticket is at-risk, but low income alone is not', () => {
  assert.equal(classify({ incomeLevelName: 'low', unpaidTicketCount: 0 }), 'stable');
  assert.equal(classify({ incomeLevelName: 'low', unpaidTicketCount: 1 }), 'at-risk');
});

test('maxAffordablePropertyLevel 0 is a real alternate way to name low income', () => {
  assert.equal(classify({ maxAffordablePropertyLevel: 0, unpaidTicketCount: 1 }), 'at-risk');
});

test('shouldRelocateToProjectHousing is true only for at-risk', () => {
  for (const c of SOCIAL_CLASSES) {
    assert.equal(shouldRelocateToProjectHousing(c), c === 'at-risk');
  }
});
