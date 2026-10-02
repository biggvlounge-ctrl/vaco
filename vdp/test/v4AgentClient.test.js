// VDP — V4 agent client's own parsing logic, the one piece that isn't
// a thin fetch wrapper. The fetch wrapper itself (`analyzeOutfitPhoto`'s
// network call) is deliberately uncovered here, same convention
// `commerce.test.js`'s own header states for every `*Client.js` module
// — testing it would be testing `fetch`. What IS tested is the real
// failure mode a model response actually has: it is not a parser, and
// "strict JSON" is a request, not a guarantee.

'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';

import { parseOutfitJson } from '../src/lib/v4AgentClient.js';

test('a clean strict-JSON response parses into the expected shape', () => {
  const text = '{"name": "Rooftop Blazer", "category": "clothing", "dominantColor": "charcoal", "description": "a tailored blazer"}';
  const result = parseOutfitJson(text);
  assert.deepEqual(result, {
    name: 'Rooftop Blazer', category: 'clothing', dominantColor: 'charcoal', description: 'a tailored blazer',
  });
});

test('JSON wrapped in a stray code fence or prose is still extracted', () => {
  const text = 'Sure, here is the catalogue entry:\n```json\n{"name": "Street Jacket", "category": "accessories"}\n```\nHope that helps!';
  const result = parseOutfitJson(text);
  assert.equal(result.name, 'Street Jacket');
  assert.equal(result.category, 'accessories');
});

test('missing dominantColor/description default to empty strings, not undefined', () => {
  const result = parseOutfitJson('{"name": "Plain Tee", "category": "clothing"}');
  assert.equal(result.dominantColor, '');
  assert.equal(result.description, '');
});

test('a response with no JSON object at all is refused, not silently empty', () => {
  assert.throws(() => parseOutfitJson('I cannot help with that.'), /did not return recognizable JSON/);
});

test('a response missing a usable name is refused', () => {
  assert.throws(() => parseOutfitJson('{"category": "clothing"}'), /missing a name/);
  assert.throws(() => parseOutfitJson('{"name": "", "category": "clothing"}'), /missing a name/);
});

test('a response with an invented category is refused, not forwarded as real', () => {
  assert.throws(() => parseOutfitJson('{"name": "X", "category": "weaponry"}'), /unrecognized category/);
});
