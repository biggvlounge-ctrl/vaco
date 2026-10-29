// VOKEN — a real, per-user follow-notification inbox, closing a real
// gap: "someone can follow a card now, but nothing ever tells them
// when it moves."
//
// **Deliberately NOT wired to `vaco-notify`.** That app is a real
// ops-alerting/paging service — its own severity scale
// (`signal`/`alert`/`critical`) and subscription matching are keyed
// by `app` + `severity` alone, with no per-user addressing at all
// (see `../vaco-notify/lib/notify.js`). It exists to tell an
// on-call human "this app is unhealthy," not to tell one specific fan
// that one specific card they follow went up. Routing a consumer
// engagement event through an ops-paging system would be exactly the
// kind of wrong-tool integration this codebase's own standing
// discipline refuses — so this is a real, small, VOKEN-internal inbox
// instead, scoped to the one real thing that actually needs it.
//
// The real trigger is a genuine new peak (see `cardFollows.js`'s own
// `listFollowersForCard()`), not every live scoring call -- "a card
// you follow moved" should mean it hit a real new high, not that
// someone merely re-ran the same score and got the same number back.

const { listFollowersForCard } = require('./cardFollows');

function createNotification(store, options = {}) {
  const { userId, cardId, type, message, now = Date.now() } = options;
  if (!userId) throw new Error('createNotification requires a userId');
  if (!cardId) throw new Error('createNotification requires a cardId');
  if (!type) throw new Error('createNotification requires a type');
  if (!message) throw new Error('createNotification requires a message');

  const notification = {
    id: store.nextCardNotificationId++,
    userId, cardId, type, message, read: false, createdAt: now,
  };
  store.cardNotifications.push(notification);
  return notification;
}

// The real fan-out: every current real follower of this card gets
// their own real notification record. Returns the real list created
// (empty when nobody follows the card -- an honest no-op, not an
// error).
function notifyFollowersOfNewPeak(store, options = {}) {
  const { cardId, newPeak, now = Date.now() } = options;
  if (!cardId) throw new Error('notifyFollowersOfNewPeak requires a cardId');
  if (!Number.isFinite(newPeak)) throw new Error('notifyFollowersOfNewPeak requires a real newPeak');

  const followerIds = listFollowersForCard(store, cardId);
  return followerIds.map((userId) => createNotification(store, {
    userId, cardId, type: 'value-increase',
    message: `A card you follow just reached a new real high of ${newPeak}/100.`,
    now,
  }));
}

// The real decision `server.js`'s value-score route needs: only a
// genuine NEW real peak is real news to a follower -- re-running the
// same score and getting the same number back, or a real quiet dip,
// is not. Kept as its own testable function rather than an inline
// comparison in the route, the same split this codebase's own
// established discipline already uses everywhere else.
function notifyFollowersIfNewPeak(store, options = {}) {
  const { cardId, previousPeak, newPeak } = options;
  if (previousPeak !== null && newPeak <= previousPeak) return [];
  return notifyFollowersOfNewPeak(store, { cardId, newPeak });
}

function getNotificationsForUser(store, userId) {
  if (!userId) throw new Error('getNotificationsForUser requires a userId');
  return store.cardNotifications.filter((n) => n.userId === userId);
}

// Idempotent -- marking an already-read notification read again is a
// real no-op, the same posture `followCard`/`unfollowCard` already
// take for their own repeat calls. **Real ownership check, same
// discipline every other per-user resource in this codebase already
// enforces** (`transferEditionOwnership`, `sellBackCard`'s edition
// check): a notification belongs to exactly the one real user it was
// created for, and only they may mark it read -- `server.js`'s route
// proves `userId` against the real session, never trusts it bare.
function markNotificationRead(store, options = {}) {
  const { notificationId, userId } = options;
  const notification = store.cardNotifications.find((n) => n.id === notificationId);
  if (!notification) throw new Error(`markNotificationRead: no notification with id ${notificationId}`);
  if (!userId || notification.userId !== userId) {
    throw new Error(`markNotificationRead: notification ${notificationId} does not belong to ${userId || 'the given user'}`);
  }
  notification.read = true;
  return notification;
}

module.exports = {
  createNotification,
  notifyFollowersOfNewPeak,
  notifyFollowersIfNewPeak,
  getNotificationsForUser,
  markNotificationRead,
};
