'use strict';

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createJusticeStore, issueTicket, ticketsFor, unpaidTicketsFor, payTicket, TICKET_FINE,
  detainPerson, releasePerson, isDetained, activeDetentionFor, listActiveDetentions,
} from '../src/lib/justice.js';

function fakeTransfer(calls, { shouldFail = false } = {}) {
  return async (args) => {
    calls.push(args);
    if (shouldFail) throw new Error('transfer failed');
    return { ok: true };
  };
}

test('issueTicket lands a real citation on the person it is about', () => {
  const store = createJusticeStore();
  const ticket = issueTicket(store, { personId: 'alice', reason: 'unauthorized building', issuedBy: 'patrol-1' });
  assert.equal(ticket.personId, 'alice');
  assert.equal(ticket.amountOwed, TICKET_FINE);
  assert.equal(ticket.paid, false);
  assert.deepEqual(ticketsFor(store, 'alice'), [ticket]);
  assert.deepEqual(unpaidTicketsFor(store, 'alice'), [ticket]);
});

test('issueTicket requires a personId and a reason', () => {
  const store = createJusticeStore();
  assert.throws(() => issueTicket(store, { reason: 'x' }), /requires a personId/);
  assert.throws(() => issueTicket(store, { personId: 'alice' }), /requires a reason/);
});

test('payTicket claims paid before the transfer, and rolls back on failure', async () => {
  const store = createJusticeStore();
  const ticket = issueTicket(store, { personId: 'alice', reason: 'jaywalking' });
  const calls = [];
  const paid = await payTicket(store, ticket.id, { transferFn: fakeTransfer(calls) });
  assert.equal(paid.paid, true);
  assert.equal(calls[0].fromUserId, 'alice');
  assert.equal(calls[0].amount, TICKET_FINE);
  assert.equal(unpaidTicketsFor(store, 'alice').length, 0);
});

test('a failed payTicket rolls back -- the fine is still owed', async () => {
  const store = createJusticeStore();
  const ticket = issueTicket(store, { personId: 'alice', reason: 'jaywalking' });
  await assert.rejects(
    payTicket(store, ticket.id, { transferFn: fakeTransfer([], { shouldFail: true }) }),
  );
  assert.equal(unpaidTicketsFor(store, 'alice').length, 1);
});

test('payTicket refuses an unknown ticket and an already-paid one', async () => {
  const store = createJusticeStore();
  const ticket = issueTicket(store, { personId: 'alice', reason: 'x' });
  await payTicket(store, ticket.id, { transferFn: fakeTransfer([]) });
  await assert.rejects(payTicket(store, ticket.id, { transferFn: fakeTransfer([]) }), /already paid/);
  await assert.rejects(payTicket(store, 9999, { transferFn: fakeTransfer([]) }), /no ticket/);
});

test('detainPerson and releasePerson track a real, named detention', () => {
  const store = createJusticeStore();
  const detention = detainPerson(store, { personId: 'bob', reason: 'unauthorized settlement', detainedBy: 'patrol-1' });
  assert.equal(isDetained(store, 'bob'), true);
  assert.equal(activeDetentionFor(store, 'bob').id, detention.id);
  assert.deepEqual(listActiveDetentions(store), [detention]);

  const released = releasePerson(store, detention.id, { releasedBy: 'patrol-1' });
  assert.ok(released.releasedAt);
  assert.equal(isDetained(store, 'bob'), false);
  assert.equal(listActiveDetentions(store).length, 0);
});

test('detainPerson refuses to detain someone already detained', () => {
  const store = createJusticeStore();
  detainPerson(store, { personId: 'bob', reason: 'x' });
  assert.throws(() => detainPerson(store, { personId: 'bob', reason: 'y' }), /already detained/);
});

test('releasePerson refuses an unknown detention and an already-released one', () => {
  const store = createJusticeStore();
  const detention = detainPerson(store, { personId: 'bob', reason: 'x' });
  releasePerson(store, detention.id);
  assert.throws(() => releasePerson(store, detention.id), /already released/);
  assert.throws(() => releasePerson(store, 9999), /no detention/);
});

test('a citizen with full legal standing can still be detained -- detention is not immigration-only', () => {
  const store = createJusticeStore();
  const detention = detainPerson(store, { personId: 'citizen-carol', reason: 'disturbance' });
  assert.equal(detention.personId, 'citizen-carol');
});
