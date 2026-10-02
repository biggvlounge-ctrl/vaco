// V4 — POST /api/agent's content-block validation, in isolation.
//
// server.js spawns a real process in its own test file rather than
// being imported (see that file's own header), and every spawn-based
// /api/agent call there is refused by auth before reaching this
// validation at all. So this is tested directly against the pure
// function instead, the same way `lib/maps.js` already is.

'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';

import { isValidContentBlocks, VALID_IMAGE_MEDIA_TYPES } from '../lib/agentContent.js';

const realImageBlock = () => ({
  type: 'image',
  source: { type: 'base64', media_type: 'image/jpeg', data: 'c3ViYmVk' },
});
const realTextBlock = (text = 'describe this outfit') => ({ type: 'text', text });

test('a real text-plus-image pair is accepted — the real vision-call shape', () => {
  assert.equal(isValidContentBlocks([realTextBlock(), realImageBlock()]), true);
});

test('a plain text-only block array is still accepted', () => {
  assert.equal(isValidContentBlocks([realTextBlock()]), true);
});

test('an empty array is refused — a message needs real content', () => {
  assert.equal(isValidContentBlocks([]), false);
});

test('a non-array content value is refused', () => {
  assert.equal(isValidContentBlocks('just a string'), false);
  assert.equal(isValidContentBlocks(null), false);
  assert.equal(isValidContentBlocks(undefined), false);
  assert.equal(isValidContentBlocks({ type: 'image' }), false);
});

test('an image block missing its base64 data is refused', () => {
  const block = realImageBlock();
  delete block.source.data;
  assert.equal(isValidContentBlocks([block]), false);
});

test('an image block with an empty-string data field is refused, not treated as present', () => {
  const block = realImageBlock();
  block.source.data = '';
  assert.equal(isValidContentBlocks([block]), false);
});

test('an image block with an unsupported media type is refused', () => {
  const block = realImageBlock();
  block.source.media_type = 'image/svg+xml';
  assert.equal(isValidContentBlocks([block]), false);
});

test('an image block whose source is not base64-encoded is refused', () => {
  const block = realImageBlock();
  block.source.type = 'url';
  assert.equal(isValidContentBlocks([block]), false);
});

test('a text block with a non-string or empty text field is refused', () => {
  assert.equal(isValidContentBlocks([{ type: 'text', text: '' }]), false);
  assert.equal(isValidContentBlocks([{ type: 'text', text: 42 }]), false);
  assert.equal(isValidContentBlocks([{ type: 'text' }]), false);
});

test('a block of an unrecognized type is refused, not silently forwarded', () => {
  assert.equal(isValidContentBlocks([{ type: 'tool_use', id: 'x' }]), false);
});

test('one bad block anywhere in the array refuses the whole message', () => {
  assert.equal(isValidContentBlocks([realTextBlock(), { type: 'image', source: {} }]), false);
});

test('every real media type Anthropic accepts is itself accepted here', () => {
  for (const mediaType of VALID_IMAGE_MEDIA_TYPES) {
    const block = realImageBlock();
    block.source.media_type = mediaType;
    assert.equal(isValidContentBlocks([block]), true, `${mediaType} should be accepted`);
  }
});
