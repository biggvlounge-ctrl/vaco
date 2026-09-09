# Plan — Phase 2 (third slice): Notifications

## Goal
Section 33's real notification system. Consistent with this session's
standing treatment of notification-adjacent systems (VSAFE's own
safety escalations): compute real, correct trigger logic and a real
recipient; actual delivery (push/SMS/email) is separate
infrastructure, not built here.

## Design
- `lib/notifications.js`: a real, generic `Notification { id,
  recipientId, type, subject, message, relatedId, read, createdAt }`
  and `createNotification`/`getNotifications`/`markAsRead`, validating
  against the doc's own real 14-type list.
- Of the 14 real types, four are wired to genuine, already-built state
  transitions rather than left as inert entries:
  - `bookExperience` fires `booking-confirmation` always, and
    `payment-confirmation` additionally when the experience is priced
    (mirrors the doc's own distinction between the two as separate
    types).
  - `digitalWaitingRoom.js`'s `admitToExperience` fires
    `experience-starting`.
  - `completeExperience` fires both `experience-ending` and
    `post-event-follow-up` per completed booking (deliberately inside
    the completion function itself, not `getPostEventSummary`, since a
    GET is not the right place for a one-time side effect -- it can be
    called repeatedly and would duplicate the notification).
- The remaining ten types (schedule/travel/venue/check-in reminders,
  security instructions, host updates, delay notifications,
  transportation updates, media ready) have no automatic trigger built
  yet -- reminders genuinely need a time-based scheduler, delay/
  transportation updates need a live poll of VOID Event Services' job
  status, security-instructions/host-updates have no concrete trigger
  point agreed yet, and media-ready depends on Section 13 (Media),
  itself unbuilt. All ten remain real and constructible via the
  general `createNotification` (verified with a manual
  `security-instructions` notification), just not auto-triggered --
  flagged directly, not silently faked.

## Explicitly NOT in this task
Real delivery (push/SMS/email) -- infrastructure this codebase
doesn't have, same standing caveat as VSAFE's own escalation delivery.
Time-based reminder scheduling. Live polling of VOID Event Services
job status for delay/transportation-update triggers.

## Verification approach
Plain-Node pass first (throwaway `.cjs` script, deleted after -- 18
checks): invalid type and missing recipientId rejected; a manual
notification of an un-auto-triggered type still works; a free booking
fires exactly one notification (no payment-confirmation); a priced
booking fires both, carrying the real booking id as `relatedId`,
sorted newest-first; no `experience-starting` before admission, fired
correctly on admission; completion fires both `experience-ending` and
`post-event-follow-up`, five real notifications total across the whole
lifecycle; `unreadOnly` filtering and `markAsRead` both proven correct;
markAsRead rejects an unknown id; one user's notifications proven
unaffected by another's activity. Then a live pass: a real booking,
waiting-room admission, and completion run end to end against the
actual running server, with the real notification list fetched after
each step and confirmed to grow exactly as expected, plus `markAsRead`
and the `unreadOnly` query filter both confirmed live.

## Done when
- All four real trigger points fire the correct notification type(s)
  with the correct recipient and `relatedId`.
- The full 14-type vocabulary is real and usable via the general
  endpoint even where no automatic trigger exists yet.
