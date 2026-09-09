// VOID MAGIC -- Notifications (Section 33, Phase 2's third real
// slice). Source of truth: VOID_MAGIC_MASTER_BUILD_BRIEF.md SS33's
// real, named list: booking confirmation, payment confirmation,
// schedule reminder, travel reminder, venue reminder, check-in
// reminder, security instructions, host updates, delay notifications,
// transportation updates, experience starting, experience ending,
// media ready, post-event follow-up.
//
// Honest scoping, consistent with this session's standing treatment
// of notification-adjacent systems (VSAFE's own safety escalations):
// this module computes real, correct trigger logic and a real
// recipient -- actual delivery (push/SMS/email) is separate
// infrastructure, not built here. Of the 14 real types, four are
// wired to genuine, already-built state transitions in this codebase
// (`booking-confirmation`/`payment-confirmation` at booking,
// `experience-starting` at waiting-room admission,
// `experience-ending`/`post-event-follow-up` at completion) --
// the rest (schedule/travel/venue/check-in reminders, delay
// notifications, transportation updates) genuinely need a
// time-based scheduler or a live poll of VOID Event Services' job
// status, neither of which exists in this codebase yet, so they're
// not faked here; `host-updates`/`security-instructions`/
// `media-ready` have no automatic trigger point built yet either
// (Media itself, Section 13, is still unbuilt) -- all fourteen types
// remain real and constructible via the general `createNotification`,
// just not all auto-triggered.

const NOTIFICATION_TYPES = [
  'booking-confirmation', 'payment-confirmation', 'schedule-reminder', 'travel-reminder',
  'venue-reminder', 'check-in-reminder', 'security-instructions', 'host-updates',
  'delay-notification', 'transportation-update', 'experience-starting', 'experience-ending',
  'media-ready', 'post-event-follow-up',
  // Real, flagged 15th type, added by `cancelBooking` (Phase 3):
  // SS33's own real list has no cancellation-notice type at all, and
  // none of the 14 fit the meaning (`booking-confirmation` confirms, it
  // doesn't un-confirm) -- same "necessary, minimal, flagged addition"
  // precedent as this session's other doc-shape extensions.
  'booking-cancellation',
];

function createNotification(store, options = {}) {
  const {
    recipientId, type, subject, message, relatedId = null, now = Date.now(),
  } = options;

  if (!recipientId) throw new Error('createNotification requires a recipientId');
  if (!NOTIFICATION_TYPES.includes(type)) {
    throw new Error(`createNotification: invalid type "${type}" (expected one of ${NOTIFICATION_TYPES.join(', ')})`);
  }
  if (!subject) throw new Error('createNotification requires a subject');
  if (!message) throw new Error('createNotification requires a message');

  const notification = {
    id: store.nextNotificationId++, recipientId, type, subject, message, relatedId, read: false, createdAt: now,
  };
  store.notifications.push(notification);
  return notification;
}

function getNotifications(store, recipientId, options = {}) {
  const { unreadOnly = false } = options;
  if (!recipientId) throw new Error('getNotifications requires a recipientId');
  return store.notifications
    .filter((n) => n.recipientId === recipientId)
    .filter((n) => !unreadOnly || !n.read)
    .sort((a, b) => b.createdAt - a.createdAt);
}

function markAsRead(store, notificationId) {
  const notification = store.notifications.find((n) => n.id === notificationId);
  if (!notification) throw new Error(`markAsRead: no notification with id ${notificationId}`);
  notification.read = true;
  return notification;
}

module.exports = {
  NOTIFICATION_TYPES, createNotification, getNotifications, markAsRead,
};
