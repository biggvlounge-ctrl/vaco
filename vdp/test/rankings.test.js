'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';

import { rankBy, rankByAscending, rankOf } from '../src/lib/rankings.js';

test('rankBy sorts descending by real value', () => {
  const records = [{ id: 'a', value: 10 }, { id: 'b', value: 30 }, { id: 'c', value: 20 }];
  assert.deepEqual(rankBy(records).map((r) => r.id), ['b', 'c', 'a']);
});

test('rankBy excludes a real unranked (null/undefined) value, but includes a real zero by default', () => {
  const records = [{ id: 'a', value: 0 }, { id: 'b', value: null }, { id: 'c', value: undefined }, { id: 'd', value: 5 }];
  const ranked = rankBy(records);
  assert.deepEqual(ranked.map((r) => r.id), ['d', 'a']);
});

test('rankBy excludes a real zero when includeZero is false', () => {
  const records = [{ id: 'a', value: 0 }, { id: 'b', value: 5 }];
  assert.deepEqual(rankBy(records, { includeZero: false }).map((r) => r.id), ['b']);
});

test('rankBy respects a real limit', () => {
  const records = Array.from({ length: 20 }, (_, i) => ({ id: `p${i}`, value: i }));
  assert.equal(rankBy(records, { limit: 5 }).length, 5);
  assert.equal(rankBy(records, { limit: 5 })[0].id, 'p19');
});

test('rankBy refuses anything but a real array', () => {
  assert.throws(() => rankBy(null), /real array/);
  assert.throws(() => rankBy('not an array'), /real array/);
});

test('rankByAscending is the real inverse of rankBy', () => {
  const records = [{ id: 'a', value: 10 }, { id: 'b', value: 30 }, { id: 'c', value: 20 }];
  assert.deepEqual(rankByAscending(records).map((r) => r.id), ['a', 'c', 'b']);
});

test('rankOf reports a 1-indexed real position, from the full population rather than a truncated board', () => {
  const records = Array.from({ length: 20 }, (_, i) => ({ id: `p${i}`, value: i }));
  // p19 has the highest value (19) -- rank 1.
  assert.equal(rankOf(records, 'p19'), 1);
  // p0 has the lowest value (0) -- rank 20, well past any real limit a board would use.
  assert.equal(rankOf(records, 'p0'), 20);
});

test('rankOf returns null for a real id with no measured value at all', () => {
  const records = [{ id: 'a', value: 10 }, { id: 'b', value: null }];
  assert.equal(rankOf(records, 'b'), null);
  assert.equal(rankOf(records, 'nobody'), null);
});
