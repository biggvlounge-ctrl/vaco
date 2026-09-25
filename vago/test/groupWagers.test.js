// VAGO — Group Wagers, the social wrapper around predictionMarkets.js's
// real pooled wagering mechanic.
//
// **Why this wraps rather than reimplements.** The freeze's own §29
// rule: reuse the real pooled-wagering engine, build only the missing
// group-specific functionality (creator/name/deadline/participant cap/
// visibility/thread). Every test here checks that wrapper logic —
// locking, eligibility, capacity — without re-testing
// predictionMarkets.js's own pricing/settlement math, which already has
// its own suite.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  createGroupWager, joinGroupWager, linkGroupWagerThread, resolveGroupWager,
  groupWagerView, findGroupWager, isGroupWagerLocked, VISIBILITIES,
  INVITATION_STATUSES, findInvitation, invitationsForGroupWager,
  inviteToGroupWager, markInvitationViewed, invitationView,
} = require('../lib/groupWagers');
const { createVagoStore } = require('../lib/store');

function ledger() {
  const legs = [];
  const fn = async (settlementLegs) => {
    legs.push(...settlementLegs);
    return { settlementId: legs.length };
  };
  fn.legs = legs;
  return fn;
}

const FUTURE = Date.now() + 60 * 60 * 1000;
const PAST = Date.now() - 1000;

function baseOptions(overrides = {}) {
  return {
    creatorId: 'ada',
    name: '$20 Group Bet — Who wins tonight?',
    entryDeadline: FUTURE,
    question: 'Will the Cardinals win tonight?',
    category: 'sports',
    source: 'real-world',
    ...overrides,
  };
}

// -- createGroupWager --------------------------------------------------------

test('createGroupWager opens a real, unbounded-participant market underneath — §29, reuse not duplicate', async () => {
  const store = createVagoStore();
  const groupWager = await createGroupWager(store, baseOptions());
  assert.equal(store.predictionMarkets.length, 1, 'the group wager must open a real prediction market, not a second engine');
  assert.equal(store.predictionMarkets[0].id, groupWager.marketId);
  assert.equal(groupWager.status, 'open');
});

test('createGroupWager requires the entry deadline to be in the future', async () => {
  const store = createVagoStore();
  await assert.rejects(
    createGroupWager(store, baseOptions({ entryDeadline: PAST })),
    /entryDeadline in the future/,
  );
});

test('every declared VISIBILITIES value is accepted', async () => {
  for (const visibility of VISIBILITIES) {
    const store = createVagoStore();
    const options = baseOptions({ visibility });
    if (visibility === 'private') options.invitedUserIds = ['bob'];
    const groupWager = await createGroupWager(store, options);
    assert.equal(groupWager.visibility, visibility);
  }
});

test('a private group wager requires at least one invited user', async () => {
  const store = createVagoStore();
  await assert.rejects(
    createGroupWager(store, baseOptions({ visibility: 'private', invitedUserIds: [] })),
    /needs at least one invited user/,
  );
});

test('maxParticipants must be an integer of at least 2, or omitted', async () => {
  const store = createVagoStore();
  await assert.rejects(createGroupWager(store, baseOptions({ maxParticipants: 1 })), /at least 2/);
  await assert.rejects(createGroupWager(store, baseOptions({ maxParticipants: 2.5 })), /at least 2/);
  const groupWager = await createGroupWager(store, baseOptions({ maxParticipants: null }));
  assert.equal(groupWager.maxParticipants, null);
});

// -- joinGroupWager (JOIN -> FUND -> CONFIRM -> LOCK) ---------------------------

test('joinGroupWager funds atomically through the real ledger — §5 JOIN+FUND in one step', async () => {
  const store = createVagoStore();
  const groupWager = await createGroupWager(store, baseOptions());
  const settleFn = ledger();
  const result = await joinGroupWager(store, {
    groupWagerId: groupWager.id, userId: 'bob', side: 'yes', quantity: 10, settleFn,
  });
  assert.equal(result.contract.userId, 'bob');
  assert.ok(settleFn.legs.length > 0, 'joining must actually move real money through the real ledger');
});

test('joinGroupWager refuses once the entry deadline has passed — LOCK', async () => {
  const store = createVagoStore();
  const groupWager = await createGroupWager(store, baseOptions({ entryDeadline: Date.now() + 50 }));
  await new Promise((r) => setTimeout(r, 60));
  await assert.rejects(
    joinGroupWager(store, { groupWagerId: groupWager.id, userId: 'bob', side: 'yes', quantity: 5, settleFn: ledger() }),
    /is locked/,
  );
});

test('joinGroupWager refuses an uninvited user on a private group', async () => {
  const store = createVagoStore();
  const groupWager = await createGroupWager(store, baseOptions({ visibility: 'private', invitedUserIds: ['carol'] }));
  await assert.rejects(
    joinGroupWager(store, { groupWagerId: groupWager.id, userId: 'dave', side: 'yes', quantity: 5, settleFn: ledger() }),
    /not invited/,
  );
  // The invited user, and the creator, both succeed.
  await joinGroupWager(store, { groupWagerId: groupWager.id, userId: 'carol', side: 'yes', quantity: 5, settleFn: ledger() });
  await joinGroupWager(store, { groupWagerId: groupWager.id, userId: 'ada', side: 'no', quantity: 5, settleFn: ledger() });
});

test('joinGroupWager refuses once maxParticipants is reached, but lets an existing participant add to their position', async () => {
  const store = createVagoStore();
  const groupWager = await createGroupWager(store, baseOptions({ maxParticipants: 2 }));
  await joinGroupWager(store, { groupWagerId: groupWager.id, userId: 'bob', side: 'yes', quantity: 5, settleFn: ledger() });
  await joinGroupWager(store, { groupWagerId: groupWager.id, userId: 'carol', side: 'no', quantity: 5, settleFn: ledger() });
  // The group is now full (2/2) — a third distinct user is refused.
  await assert.rejects(
    joinGroupWager(store, { groupWagerId: groupWager.id, userId: 'dave', side: 'yes', quantity: 5, settleFn: ledger() }),
    /is full/,
  );
  // But an existing participant adding to their own position is not a
  // new participant, so it must still succeed.
  await joinGroupWager(store, { groupWagerId: groupWager.id, userId: 'bob', side: 'yes', quantity: 5, settleFn: ledger() });
});

// -- linkGroupWagerThread (§9) --------------------------------------------------

test('linkGroupWagerThread records a real VXLLAGE post id, and requires one', async () => {
  const store = createVagoStore();
  const groupWager = await createGroupWager(store, baseOptions());
  assert.equal(groupWager.threadPostId, null);
  const linked = linkGroupWagerThread(store, { groupWagerId: groupWager.id, threadPostId: 4821 });
  assert.equal(linked.threadPostId, 4821);
  assert.throws(() => linkGroupWagerThread(store, { groupWagerId: groupWager.id, threadPostId: null }), /requires a threadPostId/);
});

// -- resolveGroupWager (§15) -----------------------------------------------------

test('resolveGroupWager pays out through the real solvent pari-mutuel pool and marks the group settled', async () => {
  const store = createVagoStore();
  const groupWager = await createGroupWager(store, baseOptions());
  await joinGroupWager(store, { groupWagerId: groupWager.id, userId: 'bob', side: 'yes', quantity: 10, settleFn: ledger() });
  await joinGroupWager(store, { groupWagerId: groupWager.id, userId: 'carol', side: 'no', quantity: 10, settleFn: ledger() });

  const settleFn = ledger();
  const result = await resolveGroupWager(store, { groupWagerId: groupWager.id, outcome: 'yes', settleFn });
  assert.equal(result.groupWager.status, 'settled');
  assert.ok(result.groupWager.settledAt);
  assert.equal(result.payouts.length, 1, 'only the winning side is paid');
  assert.equal(result.payouts[0].userId, 'bob');
});

test('a settled group wager is locked — joining after resolution is refused', async () => {
  const store = createVagoStore();
  const groupWager = await createGroupWager(store, baseOptions());
  await resolveGroupWager(store, { groupWagerId: groupWager.id, outcome: 'yes', settleFn: ledger() });
  await assert.rejects(
    joinGroupWager(store, { groupWagerId: groupWager.id, userId: 'bob', side: 'yes', quantity: 5, settleFn: ledger() }),
    /is locked/,
  );
});

// -- groupWagerView / isGroupWagerLocked -----------------------------------------

test('groupWagerView reports a live, computed lock state and participant count, not a stored flag', async () => {
  const store = createVagoStore();
  const groupWager = await createGroupWager(store, baseOptions());
  let view = groupWagerView(store, groupWager.id);
  assert.equal(view.locked, false);
  assert.equal(view.participantCount, 0);

  await joinGroupWager(store, { groupWagerId: groupWager.id, userId: 'bob', side: 'yes', quantity: 5, settleFn: ledger() });
  await joinGroupWager(store, { groupWagerId: groupWager.id, userId: 'carol', side: 'no', quantity: 5, settleFn: ledger() });
  view = groupWagerView(store, groupWager.id);
  assert.equal(view.participantCount, 2);

  view = groupWagerView(store, groupWager.id, { now: groupWager.entryDeadline + 1 });
  assert.equal(view.locked, true, 'a view computed past the deadline must report locked without any stored mutation');
});

test('groupWagerView returns null for an unknown id, rather than throwing', () => {
  const store = createVagoStore();
  assert.equal(groupWagerView(store, 999999), null);
});

test('findGroupWager finds by id', async () => {
  const store = createVagoStore();
  const groupWager = await createGroupWager(store, baseOptions());
  assert.equal(findGroupWager(store, groupWager.id).id, groupWager.id);
  assert.equal(findGroupWager(store, 999999), null);
});

test('isGroupWagerLocked treats a missing market as locked', () => {
  const groupWager = { entryDeadline: Date.now() + 100000 };
  assert.equal(isGroupWagerLocked(groupWager, null), true);
});

// -- §13 invitation state machine (Invited -> Viewed -> Funded) -----------------

test('createGroupWager creates a real invited-status invitation for every name on the initial list', async () => {
  const store = createVagoStore();
  const groupWager = await createGroupWager(store, baseOptions({ visibility: 'private', invitedUserIds: ['bob', 'carol'] }));
  const invitations = invitationsForGroupWager(store, groupWager.id);
  assert.equal(invitations.length, 2);
  assert.ok(invitations.every((i) => i.status === 'invited'));
  assert.ok(invitations.every((i) => i.invitedAt !== null));
  assert.ok(invitations.every((i) => i.viewedAt === null && i.fundedAt === null));
});

test('INVITATION_STATUSES is invited -> viewed -> funded, not the freeze\'s literal six names', () => {
  assert.deepEqual(INVITATION_STATUSES, ['invited', 'viewed', 'funded']);
});

test('inviteToGroupWager only lets the creator invite, and only on a private group wager', async () => {
  const store = createVagoStore();
  const open = await createGroupWager(store, baseOptions());
  assert.throws(
    () => inviteToGroupWager(store, { groupWagerId: open.id, userId: 'dave', invitedBy: 'ada' }),
    /not private/,
  );

  const priv = await createGroupWager(store, baseOptions({ visibility: 'private', invitedUserIds: ['bob'] }));
  assert.throws(
    () => inviteToGroupWager(store, { groupWagerId: priv.id, userId: 'dave', invitedBy: 'bob' }),
    /only the creator may invite/,
  );

  const invitation = inviteToGroupWager(store, { groupWagerId: priv.id, userId: 'dave', invitedBy: 'ada' });
  assert.equal(invitation.status, 'invited');
  assert.ok(priv.invitedUserIds.includes('dave'), 'inviting later must also extend the group wager\'s own invitedUserIds');
});

test('inviteToGroupWager refuses inviting the same user twice', async () => {
  const store = createVagoStore();
  const groupWager = await createGroupWager(store, baseOptions({ visibility: 'private', invitedUserIds: ['bob'] }));
  assert.throws(
    () => inviteToGroupWager(store, { groupWagerId: groupWager.id, userId: 'bob', invitedBy: 'ada' }),
    /already invited/,
  );
});

test('markInvitationViewed transitions invited -> viewed, and is idempotent past that point', async () => {
  const store = createVagoStore();
  const groupWager = await createGroupWager(store, baseOptions({ visibility: 'private', invitedUserIds: ['bob'] }));
  let invitation = markInvitationViewed(store, { groupWagerId: groupWager.id, userId: 'bob' });
  assert.equal(invitation.status, 'viewed');
  assert.ok(invitation.viewedAt !== null);

  // Funding, then viewing again, must not regress the status backward.
  await joinGroupWager(store, { groupWagerId: groupWager.id, userId: 'bob', side: 'yes', quantity: 5, settleFn: ledger() });
  invitation = markInvitationViewed(store, { groupWagerId: groupWager.id, userId: 'bob' });
  assert.equal(invitation.status, 'funded', 'viewing after funding must not undo the funded status');
});

test('markInvitationViewed throws for a user with no invitation', async () => {
  const store = createVagoStore();
  const groupWager = await createGroupWager(store, baseOptions());
  assert.throws(
    () => markInvitationViewed(store, { groupWagerId: groupWager.id, userId: 'nobody' }),
    /has no invitation/,
  );
});

test('joinGroupWager advances a real invitation straight to funded — no separate joined-not-funded state', async () => {
  const store = createVagoStore();
  const groupWager = await createGroupWager(store, baseOptions({ visibility: 'private', invitedUserIds: ['bob'] }));
  await joinGroupWager(store, { groupWagerId: groupWager.id, userId: 'bob', side: 'yes', quantity: 5, settleFn: ledger() });
  const invitation = findInvitation(store, groupWager.id, 'bob');
  assert.equal(invitation.status, 'funded');
  assert.ok(invitation.fundedAt !== null);
});

test('joinGroupWager on an OPEN group wager creates no invitation record for the joiner', async () => {
  const store = createVagoStore();
  const groupWager = await createGroupWager(store, baseOptions());
  await joinGroupWager(store, { groupWagerId: groupWager.id, userId: 'bob', side: 'yes', quantity: 5, settleFn: ledger() });
  assert.equal(findInvitation(store, groupWager.id, 'bob'), null, 'an OPEN group has no guest list, so joining it creates no invitation');
});

test('joinGroupWager by the creator (never invited to their own group) creates no invitation record', async () => {
  const store = createVagoStore();
  const groupWager = await createGroupWager(store, baseOptions({ visibility: 'private', invitedUserIds: ['bob'] }));
  await joinGroupWager(store, { groupWagerId: groupWager.id, userId: 'ada', side: 'yes', quantity: 5, settleFn: ledger() });
  assert.equal(findInvitation(store, groupWager.id, 'ada'), null);
});

test('invitationView merges the invitation\'s own state with the group wager\'s live locked/settled state, never a stored copy', async () => {
  const store = createVagoStore();
  const groupWager = await createGroupWager(store, baseOptions({ visibility: 'private', invitedUserIds: ['bob'] }));

  let view = invitationView(store, groupWager.id, 'bob');
  assert.equal(view.status, 'invited');
  assert.equal(view.groupWagerLocked, false);
  assert.equal(view.groupWagerStatus, 'open');

  await resolveGroupWager(store, { groupWagerId: groupWager.id, outcome: 'yes', settleFn: ledger() });
  view = invitationView(store, groupWager.id, 'bob');
  assert.equal(view.status, 'invited', 'never funding leaves the invitation\'s own status alone');
  assert.equal(view.groupWagerLocked, true, 'but the group\'s own live state still reflects that it settled');
  assert.equal(view.groupWagerStatus, 'settled');
});

test('invitationView returns null for a user with no invitation', async () => {
  const store = createVagoStore();
  const groupWager = await createGroupWager(store, baseOptions());
  assert.equal(invitationView(store, groupWager.id, 'nobody'), null);
});

test('reseedIds picks up the invitation id sequence too', async () => {
  const { reseedIds } = require('../lib/groupWagers');
  const store = createVagoStore();
  await createGroupWager(store, baseOptions({ visibility: 'private', invitedUserIds: ['bob', 'carol'] }));
  store.nextGroupWagerInvitationId = 1;
  const seeded = reseedIds(store);
  assert.equal(seeded.nextGroupWagerInvitationId, 3);
});
