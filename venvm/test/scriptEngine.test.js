// VENVM -- script generation settles (invokes Jake) exactly once.
//
// **Why this file exists.** `generateScript` had no test coverage at
// all, while calling a real, billed completion endpoint
// (invokeFn -> v4-proxy -> Anthropic). It checked `request.status`,
// awaited that real call, and only then wrote the terminal status
// ('generated' or 'failed') -- so two concurrent calls for the same
// request (a retry on a slow response, or two callers racing) both
// passed the 'requested' guard and both triggered a real, billed
// completion for one logical request, with whichever resolved last
// silently winning the final write.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createVenvmStore } = require('../lib/store');
const { submitScriptRequest, getScriptRequest, generateScript } = require('../lib/scriptEngine');

function deferredInvoker() {
  const calls = [];
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const fn = async (systemPrompt, messages) => {
    calls.push({ systemPrompt, messages });
    await gate;
    return { text: 'a real script' };
  };
  fn.calls = calls;
  fn.release = () => release();
  return fn;
}

function immediateInvoker(text = 'a real script') {
  const calls = [];
  const fn = async (systemPrompt, messages) => {
    calls.push({ systemPrompt, messages });
    return { text };
  };
  fn.calls = calls;
  return fn;
}

test('a request is generated once, taking the brief and platform into the prompt', async () => {
  const store = createVenvmStore();
  const request = submitScriptRequest(store, { requesterApp: 'void', brief: 'a 30s ad for a coffee shop', platform: 'tiktok' });
  const invokeFn = immediateInvoker('Hook: ...');

  const result = await generateScript(store, { requestId: request.id, invokeFn });

  assert.equal(result.status, 'generated');
  assert.equal(result.script, 'Hook: ...');
  assert.equal(invokeFn.calls.length, 1);
  assert.match(invokeFn.calls[0].messages[0].content, /a 30s ad for a coffee shop/);
  assert.match(invokeFn.calls[0].messages[0].content, /tiktok/);
});

test('a failed completion marks the request failed with the real error, not a fabricated script', async () => {
  const store = createVenvmStore();
  const request = submitScriptRequest(store, { requesterApp: 'void', brief: 'a brief' });
  const invokeFn = async () => { throw new Error('v4-proxy unreachable'); };

  const result = await generateScript(store, { requestId: request.id, invokeFn });

  assert.equal(result.status, 'failed');
  assert.equal(result.error, 'v4-proxy unreachable');
  assert.equal(result.script, null, 'a failed generation must not leave a script behind');
});

test('generating an already-decided request is refused', async () => {
  const store = createVenvmStore();
  const request = submitScriptRequest(store, { requesterApp: 'void', brief: 'a brief' });
  await generateScript(store, { requestId: request.id, invokeFn: immediateInvoker() });

  await assert.rejects(
    () => generateScript(store, { requestId: request.id, invokeFn: immediateInvoker() }),
    /is "generated", expected "requested"/,
  );
});

test('a request cannot be generated twice at once -- the real completion call is not duplicated', async () => {
  const store = createVenvmStore();
  const request = submitScriptRequest(store, { requesterApp: 'void', brief: 'a brief' });
  const invokeFn = deferredInvoker();

  // Pre-fix, this is exactly the sequence that broke: both calls read
  // status 'requested' before either call's completion resolves, so
  // both pass the guard and both invoke a real, billed completion for
  // one logical request.
  const first = generateScript(store, { requestId: request.id, invokeFn });
  const second = generateScript(store, { requestId: request.id, invokeFn });

  // Attach settlement handling immediately: post-fix, the second call
  // rejects synchronously (before either call's own first await), and
  // without a handler attached right away that rejection would sit
  // unhandled for a full event-loop turn and fail the test spuriously.
  const settled = Promise.allSettled([first, second]);

  // Give both calls a chance to run their synchronous prefix (up to
  // their own first await) before releasing the gate.
  await new Promise((r) => setTimeout(r, 0));
  invokeFn.release();

  const results = await settled;
  const fulfilled = results.filter((r) => r.status === 'fulfilled');

  assert.equal(invokeFn.calls.length, 1,
    `generateScript invoked the real completion ${invokeFn.calls.length} times for one request`);
  assert.equal(fulfilled.length, 1, 'more than one concurrent generateScript call was told it succeeded');
  assert.equal(getScriptRequest(store, request.id).status, 'generated');
});
