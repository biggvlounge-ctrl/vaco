'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';

import { colorForWearable } from '../src/lib/avatarRender.js';

test('no wearable equipped renders as null, letting the caller fall back to a default', () => {
  assert.equal(colorForWearable(null), null);
  assert.equal(colorForWearable(undefined), null);
});

test('the same catalog item always renders the same color', () => {
  const jacket = { id: 7, name: 'DEGVCHI Signature Jacket' };
  assert.equal(colorForWearable(jacket), colorForWearable({ ...jacket }));
});

test('two different catalog items usually render different colors', () => {
  assert.notEqual(colorForWearable({ id: 1 }), colorForWearable({ id: 2 }));
});

test('a custom photo item with a real single-word CSS color uses it directly', () => {
  const custom = { id: 99, custom: true, dominantColor: 'Navy' };
  assert.equal(colorForWearable(custom), 'navy');
});

test('a custom photo item whose dominantColor is not a real CSS color falls back to the id hash, not a silently-ignored fillStyle', () => {
  const custom = { id: 42, custom: true, dominantColor: 'a deep forest green' };
  const fallback = colorForWearable({ id: 42 });
  assert.equal(colorForWearable(custom), fallback);
});

test('a custom item with no dominantColor at all also falls back cleanly', () => {
  const custom = { id: 5, custom: true, dominantColor: '' };
  assert.equal(colorForWearable(custom), colorForWearable({ id: 5 }));
});
