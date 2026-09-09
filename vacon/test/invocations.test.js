// VACON -- the record of who invoked which agent.
//
// **Why this log lives here and not in vaco-audit.** The first wiring
// of this sent every invocation to `decisionLog`, and vaco-audit
// refused it: `agent-invocation` is not one of its six outcome kinds.
// Reading that service's own header, the refusal was right. It holds
// "one row per irreversible decision" and says in as many words that
// it is not a general application log; its vocabulary is deliberately
// small so the log stays queryable.
//
// An agent answering a question is an action, not a decision with a
// loser. Pouring every invocation into the decision log would bury the
// settlements it exists to hold. When an agent can take an action with
// a loser -- authorise a refund, suspend an account -- that belongs in
// vaco-audit, and none of them can yet.
//
// So attribution sits next to `routingLog`, which already does exactly
// this for MIA's routing decisions.

const test = require('node:test');
const assert = require('node:assert');

const { createVaconStore } = require('../lib/store');
const {
  recordInvocation, getInvocationHistory, MAX_INVOCATION_LOG,
} = require('../lib/orchestrator');

test('an invocation is recorded with the agent and the caller', () => {
  const store = createVaconStore();
  const entry = recordInvocation(store, {
    agentId: 'qvan', agentName: 'QVAN', representsApp: 'Internal',
    calledBy: 'vsafe', messageCount: 3,
  }, 1000);

  assert.equal(entry.id, 1);
  assert.equal(entry.agentId, 'qvan');
  assert.equal(entry.calledBy, 'vsafe', 'the calling service was not recorded');
  assert.equal(entry.at, 1000);
  assert.equal(store.invocationLog.length, 1);
});

test('ids do not repeat', () => {
  const store = createVaconStore();
  const ids = [1, 2, 3].map(() => recordInvocation(store, { agentId: 'mia' }).id);
  assert.deepEqual(ids, [1, 2, 3]);
});

test('history is newest first', () => {
  const store = createVaconStore();
  recordInvocation(store, { agentId: 'a' }, 100);
  recordInvocation(store, { agentId: 'b' }, 300);
  recordInvocation(store, { agentId: 'c' }, 200);

  assert.deepEqual(getInvocationHistory(store).map((e) => e.agentId), ['b', 'c', 'a']);
});

test('history does not hand out the live array', () => {
  // The store is persisted to disk on every write. A caller mutating
  // what it got back would be editing the record itself.
  const store = createVaconStore();
  recordInvocation(store, { agentId: 'qvan' });
  getInvocationHistory(store).push({ agentId: 'forged' });
  assert.equal(store.invocationLog.length, 1, 'the log was mutable from outside');
});

test('the log is bounded, and drops the oldest', () => {
  // **This one is the point of the cap.** `routingLog` grows with
  // queries a human typed; this grows every time any service asks any
  // agent anything. Unbounded, it is a memory leak in a process that
  // writes its entire store to disk on every request.
  const store = createVaconStore();
  for (let i = 0; i < MAX_INVOCATION_LOG + 50; i += 1) {
    recordInvocation(store, { agentId: 'qvan', seq: i }, i);
  }

  assert.equal(store.invocationLog.length, MAX_INVOCATION_LOG, 'the cap did not hold');
  assert.equal(store.invocationLog[0].seq, 50, 'the oldest entries were not the ones dropped');
  assert.equal(
    store.invocationLog[store.invocationLog.length - 1].seq,
    MAX_INVOCATION_LOG + 49,
    'the newest entry was dropped instead of kept',
  );
});

test('a fresh store starts with an empty log', () => {
  // Guards the shape: an older store.json without these fields would
  // make `recordInvocation` push onto undefined.
  const store = createVaconStore();
  assert.deepEqual(store.invocationLog, []);
  assert.equal(store.nextInvocationLogId, 1);
});
