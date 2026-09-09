# Tasks — Phase 2 (third slice): Notifications

- [x] Create `lib/notifications.js`: `NOTIFICATION_TYPES`,
      `createNotification`, `getNotifications` (with `unreadOnly`
      filter, newest-first), `markAsRead`.
- [x] Wire `bookings.js`: `bookExperience` fires
      `booking-confirmation` (+`payment-confirmation` if priced);
      `completeExperience` fires `experience-ending` +
      `post-event-follow-up` per completed booking.
- [x] Wire `digitalWaitingRoom.js`: `admitToExperience` fires
      `experience-starting`.
- [x] Extend `createVoidMagicStore()` with `notifications`/
      `nextNotificationId`.
- [x] Wire `server.js`: 3 new endpoints (`POST /api/notifications`,
      `GET /api/notifications/:recipientId` with `?unreadOnly=true`,
      `POST /api/notifications/:id/read`), `notificationTypes` added
      to the health payload.
- [x] Verify pure logic in plain Node (throwaway `.cjs` script, deleted
      after -- 18 checks): invalid type/missing recipientId rejected;
      manual notification of an un-auto-triggered type works; free
      booking fires exactly one notification; priced booking fires
      both real types with the correct `relatedId`, sorted
      newest-first; `experience-starting` fires only on admission, not
      before; completion fires both `experience-ending` and
      `post-event-follow-up`; five total real notifications across the
      full lifecycle; `unreadOnly` filter and `markAsRead` both
      correct; markAsRead rejects an unknown id; per-user isolation
      confirmed.
- [x] Verify live with `voidmagic/server.js` and `venvs-mock-backend`
      running independently: a real booking, waiting-room admission,
      and completion run end to end, with the real notification list
      fetched after each step and confirmed to grow exactly as
      expected (2 -> 3 -> 5), `markAsRead` and the `unreadOnly` query
      filter both confirmed live.
- [x] Shut down both servers cleanly; confirmed via follow-up port
      check.
- [x] Commit as its own change.

## Next
Media, Creator analytics, Customer profiles, Advanced scheduling,
Geofencing -- the rest of Phase 2, each its own real, later slice.
Once Media/Event-Services-status-polling exist, wire `media-ready` and
`transportation-update`/`delay-notification` to their own real
triggers instead of manual-only.
