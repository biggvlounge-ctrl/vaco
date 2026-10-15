// VACO -- the personal AI assistant.
//
// The one real decision this module makes is which of two paths a
// message takes, and both paths are asserted here with injected
// insightFn/invokeFn (same real pattern as venvm/lib/scriptEngine.js's
// own invokeFn) rather than a real network call -- deterministic, and
// honest about never fabricating a completion.

import test from 'node:test';
import assert from 'node:assert';

import { createShellStore } from '../lib/store.js';
import {
  TONE_OPTIONS, setProfile, getProfile, buildSystemPrompt, getHistory, sendMessage,
} from '../lib/personalAssistant.js';

function recordingInsight(result) {
  const calls = [];
  const fn = async (options) => {
    calls.push(options);
    return result;
  };
  fn.calls = calls;
  return fn;
}

function recordingInvoke(text) {
  const calls = [];
  const fn = async (system, messages) => {
    calls.push({ system, messages });
    return { text };
  };
  fn.calls = calls;
  return fn;
}

test('setProfile requires a non-empty name and a valid tone', () => {
  const store = createShellStore();
  assert.throws(() => setProfile(store, { userId: 'u1', name: '' }), /name cannot be empty/);
  assert.throws(() => setProfile(store, { userId: 'u1', tone: 'sarcastic' }), /tone must be one of/);
  assert.ok(TONE_OPTIONS.includes('friendly'));
});

test('getProfile returns the honest default for a person who never set one up', () => {
  const store = createShellStore();
  const profile = getProfile(store, 'never-configured');
  assert.equal(profile.name, 'Vaco');
  assert.equal(profile.tone, 'friendly');
  assert.equal(profile.lifestyle, '');
});

test('setProfile upserts -- a second call updates the same record, not a duplicate', () => {
  const store = createShellStore();
  setProfile(store, { userId: 'u1', name: 'Sunny', tone: 'motivational', lifestyle: 'marathon training' });
  setProfile(store, { userId: 'u1', name: 'Sunny', tone: 'direct', lifestyle: 'marathon training, now also cooking' });
  assert.equal(store.assistantProfiles.length, 1);
  assert.equal(getProfile(store, 'u1').tone, 'direct');
});

test("buildSystemPrompt carries this one user's own name, tone, and lifestyle -- not a shared generic prompt", () => {
  const promptA = buildSystemPrompt({ name: 'Sunny', tone: 'motivational', lifestyle: 'marathon training' });
  const promptB = buildSystemPrompt({ name: 'Rex', tone: 'direct', lifestyle: 'running a small VENVS shop' });
  assert.match(promptA, /Sunny/);
  assert.match(promptA, /motivational/);
  assert.match(promptA, /marathon training/);
  assert.notEqual(promptA, promptB, 'two different users must not get the same system prompt');
});

test('a domain-matched message is relayed to the real VACON specialist, not answered generically', async () => {
  const store = createShellStore();
  const insightFn = recordingInsight({
    matchedAgents: [{ agentId: 'leslie', score: 3 }],
    completion: { text: 'Leslie here: your balance is 100 VCoin.' },
    completionError: null,
  });
  const invokeFn = recordingInvoke('should not be called');

  const reply = await sendMessage(store, { userId: 'u1', content: 'what is my vcoin balance', insightFn, invokeFn });

  assert.equal(reply.content, 'Leslie here: your balance is 100 VCoin.');
  assert.equal(reply.routedTo, 'leslie');
  assert.equal(invokeFn.calls.length, 0, 'the general path must not run when a specialist answered');
});

test('a specialist match whose completion fails surfaces the real error rather than falling back silently', async () => {
  const store = createShellStore();
  const insightFn = recordingInsight({
    matchedAgents: [{ agentId: 'leslie', score: 3 }],
    completion: null,
    completionError: 'completion failed: no ANTHROPIC_API_KEY configured',
  });
  const invokeFn = recordingInvoke('should not be called');

  await assert.rejects(
    sendMessage(store, { userId: 'u1', content: 'what is my balance', insightFn, invokeFn }),
    /no ANTHROPIC_API_KEY configured/,
  );
  assert.equal(invokeFn.calls.length, 0, 'a real infra failure must surface, not be hidden by a fallback');
});

test('no domain match falls back to this user\'s own personalized assistant', async () => {
  const store = createShellStore();
  setProfile(store, { userId: 'u1', name: 'Sunny', tone: 'motivational', lifestyle: 'marathon training' });
  const insightFn = recordingInsight({ matchedAgents: [], completion: null, completionError: null });
  const invokeFn = recordingInvoke('You got this -- six miles today, same as last week.');

  const reply = await sendMessage(store, { userId: 'u1', content: 'how many miles should I run today', insightFn, invokeFn });

  assert.equal(reply.content, 'You got this -- six miles today, same as last week.');
  assert.equal(reply.routedTo, null);
  assert.equal(invokeFn.calls.length, 1);
  assert.match(invokeFn.calls[0].system, /Sunny/);
  assert.match(invokeFn.calls[0].system, /marathon training/);
});

test('a VACON outage is treated as no match, not as a hard failure of the whole assistant', async () => {
  const store = createShellStore();
  const insightFn = async () => { throw new Error('VACON unreachable'); };
  const invokeFn = recordingInvoke('I can still help even without the specialist network right now.');

  const reply = await sendMessage(store, { userId: 'u1', content: 'anything general', insightFn, invokeFn });

  assert.equal(reply.content, 'I can still help even without the specialist network right now.');
  assert.equal(invokeFn.calls.length, 1);
});

test('real conversation history rides along on the general path, most recent last', async () => {
  const store = createShellStore();
  const insightFn = recordingInsight({ matchedAgents: [], completion: null, completionError: null });
  const invokeFn = recordingInvoke('reply one');
  await sendMessage(store, { userId: 'u1', content: 'first message', insightFn, invokeFn });

  const invokeFn2 = recordingInvoke('reply two');
  await sendMessage(store, { userId: 'u1', content: 'second message', insightFn, invokeFn: invokeFn2 });

  const sentMessages = invokeFn2.calls[0].messages;
  assert.equal(sentMessages[sentMessages.length - 1].content, 'second message');
  assert.ok(sentMessages.some((m) => m.content === 'first message'), 'prior turns must ride along');
  assert.ok(sentMessages.some((m) => m.content === 'reply one'), "the assistant's own prior reply must ride along too");
});

test('getHistory records both the user turn and the real assistant reply, in order', async () => {
  const store = createShellStore();
  const insightFn = recordingInsight({ matchedAgents: [], completion: null, completionError: null });
  const invokeFn = recordingInvoke('a real reply');
  await sendMessage(store, { userId: 'u1', content: 'hello', insightFn, invokeFn });

  const history = getHistory(store, 'u1');
  assert.equal(history.length, 2);
  assert.equal(history[0].role, 'user');
  assert.equal(history[0].content, 'hello');
  assert.equal(history[1].role, 'assistant');
  assert.equal(history[1].content, 'a real reply');
});

test('sendMessage requires a userId and non-empty content', async () => {
  const store = createShellStore();
  await assert.rejects(sendMessage(store, { content: 'hi' }), /requires a userId/);
  await assert.rejects(sendMessage(store, { userId: 'u1', content: '   ' }), /requires content/);
});
