// VOKEN -- a real, per-user follow-notification inbox, closing a
// real gap: "someone can follow a card now, but nothing ever tells
// them when it moves." The failure this file exists to catch: a
// real follower never actually getting notified, a notification
// firing for a tie (not a genuine new high), or someone marking a
// notification read that was never theirs.

const test = require('node:test');
const assert = require('node:assert');

const { createVokenStore } = require('../lib/store');
const { followCard, listFollowersForCard } = require('../lib/cardFollows');
const {
  createNotification, notifyFollowersOfNewPeak, notifyFollowersIfNewPeak, getNotificationsForUser, markNotificationRead,
} = require('../lib/cardNotifications');

test('listFollowersForCard returns the real follower ids, not just a count', () => {
  const store = createVokenStore();
  followCard(store, { cardId: 1, followerId: 'ben' });
  followCard(store, { cardId: 1, followerId: 'carla' });
  assert.deepEqual(listFollowersForCard(store, 1).sort(), ['ben', 'carla']);
});

test('a card with no real followers notifies nobody, honestly', () => {
  const store = createVokenStore();
  const result = notifyFollowersOfNewPeak(store, { cardId: 1, newPeak: 80 });
  assert.deepEqual(result, []);
});

test('every real follower of the card gets their own real notification', () => {
  const store = createVokenStore();
  followCard(store, { cardId: 1, followerId: 'ben' });
  followCard(store, { cardId: 1, followerId: 'carla' });
  followCard(store, { cardId: 2, followerId: 'dana' }); // a different card -- must not leak in

  notifyFollowersOfNewPeak(store, { cardId: 1, newPeak: 80 });

  const benInbox = getNotificationsForUser(store, 'ben');
  const carlaInbox = getNotificationsForUser(store, 'carla');
  const danaInbox = getNotificationsForUser(store, 'dana');
  assert.equal(benInbox.length, 1);
  assert.equal(carlaInbox.length, 1);
  assert.equal(danaInbox.length, 0, 'a follower of a different card must never be notified');
  assert.equal(benInbox[0].cardId, 1);
  assert.equal(benInbox[0].type, 'value-increase');
  assert.ok(benInbox[0].message.includes('80'));
  assert.equal(benInbox[0].read, false);
});

test('markNotificationRead only works for the real notification\'s own real recipient', () => {
  const store = createVokenStore();
  const notification = createNotification(store, {
    userId: 'ben', cardId: 1, type: 'value-increase', message: 'test',
  });
  assert.throws(
    () => markNotificationRead(store, { notificationId: notification.id, userId: 'carla' }),
    /does not belong to carla/,
  );
  const read = markNotificationRead(store, { notificationId: notification.id, userId: 'ben' });
  assert.equal(read.read, true);
  assert.equal(getNotificationsForUser(store, 'ben')[0].read, true);
});

test('markNotificationRead is idempotent and refuses an unknown notification', () => {
  const store = createVokenStore();
  const notification = createNotification(store, {
    userId: 'ben', cardId: 1, type: 'value-increase', message: 'test',
  });
  markNotificationRead(store, { notificationId: notification.id, userId: 'ben' });
  const readAgain = markNotificationRead(store, { notificationId: notification.id, userId: 'ben' });
  assert.equal(readAgain.read, true);
  assert.throws(
    () => markNotificationRead(store, { notificationId: 999999, userId: 'ben' }),
    /no notification with id 999999/,
  );
});

test('createNotification requires every real field', () => {
  const store = createVokenStore();
  assert.throws(() => createNotification(store, { cardId: 1, type: 'x', message: 'm' }), /requires a userId/);
  assert.throws(() => createNotification(store, { userId: 'ben', type: 'x', message: 'm' }), /requires a cardId/);
  assert.throws(() => createNotification(store, { userId: 'ben', cardId: 1, message: 'm' }), /requires a type/);
  assert.throws(() => createNotification(store, { userId: 'ben', cardId: 1, type: 'x' }), /requires a message/);
});

// -- notifyFollowersIfNewPeak: the real decision server.js's value-score
// route needs -- only a genuine new high is real news to a follower. ---

test('notifyFollowersIfNewPeak notifies real followers on the very first real score', () => {
  const store = createVokenStore();
  followCard(store, { cardId: 1, followerId: 'ben' });
  const result = notifyFollowersIfNewPeak(store, { cardId: 1, previousPeak: null, newPeak: 40 });
  assert.equal(result.length, 1);
});

test('notifyFollowersIfNewPeak notifies real followers on a genuine new high', () => {
  const store = createVokenStore();
  followCard(store, { cardId: 1, followerId: 'ben' });
  const result = notifyFollowersIfNewPeak(store, { cardId: 1, previousPeak: 40, newPeak: 70 });
  assert.equal(result.length, 1);
});

test('notifyFollowersIfNewPeak stays silent on a tie -- re-running the same score is not real news', () => {
  const store = createVokenStore();
  followCard(store, { cardId: 1, followerId: 'ben' });
  const result = notifyFollowersIfNewPeak(store, { cardId: 1, previousPeak: 70, newPeak: 70 });
  assert.deepEqual(result, []);
  assert.equal(getNotificationsForUser(store, 'ben').length, 0);
});

test('notifyFollowersIfNewPeak stays silent on a real quiet dip', () => {
  const store = createVokenStore();
  followCard(store, { cardId: 1, followerId: 'ben' });
  const result = notifyFollowersIfNewPeak(store, { cardId: 1, previousPeak: 70, newPeak: 30 });
  assert.deepEqual(result, []);
  assert.equal(getNotificationsForUser(store, 'ben').length, 0);
});

test('getNotificationsForUser never mixes up two different real users\' inboxes', () => {
  const store = createVokenStore();
  createNotification(store, { userId: 'ben', cardId: 1, type: 'value-increase', message: 'a' });
  createNotification(store, { userId: 'carla', cardId: 1, type: 'value-increase', message: 'b' });
  assert.equal(getNotificationsForUser(store, 'ben').length, 1);
  assert.equal(getNotificationsForUser(store, 'carla').length, 1);
});
