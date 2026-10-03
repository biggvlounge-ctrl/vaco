// VDP — talkToNpc's own pure parsing logic. `*Client.js` wrappers are
// deliberately uncovered for the network call itself (this project's
// own stated convention, see `library.js`'s header), but the strict-
// JSON parsing a real model's text has to pass through is pure logic
// worth asserting on, same treatment `parseOutfitJson` already got.

'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';

import { parseTalkJson } from '../src/lib/v4AgentClient.js';

test('a clean strict-JSON reply parses to {reply, topic}', () => {
  const result = parseTalkJson('{"reply": "Nice to meet you!", "topic": "communication"}');
  assert.equal(result.reply, 'Nice to meet you!');
  assert.equal(result.topic, 'communication');
});

test('a reply wrapped in a stray code fence still parses', () => {
  const result = parseTalkJson('```json\n{"reply": "Hey there.", "topic": "none"}\n```');
  assert.equal(result.reply, 'Hey there.');
});

test('an unrecognized topic is refused rather than silently applying an unbounded effect', () => {
  assert.throws(
    () => parseTalkJson('{"reply": "hi", "topic": "literally anything I want"}'),
    /unrecognized topic/,
  );
});

test('a missing reply is refused', () => {
  assert.throws(() => parseTalkJson('{"topic": "none"}'), /missing a reply/);
});

test('non-JSON text is refused rather than crashing with a raw parse error', () => {
  assert.throws(() => parseTalkJson('I am not JSON at all'), /did not return recognizable JSON/);
});
