# Tasks — Phase 2 (second slice): Digital Waiting Room

- [x] Create `lib/digitalWaitingRoom.js`: `WAITING_ROOM_STATUSES`,
      `enterWaitingRoom`, `getWaitingRoomSession`, `verifyIdentity`
      (real reuse of `bookings.js`'s `checkIn()`), `admitToExperience`,
      `exitExperience`.
- [x] Extend `createVoidMagicStore()` with `waitingRoomSessions`/
      `nextWaitingRoomSessionId`.
- [x] Wire `server.js`: 5 new endpoints (`POST /api/waiting-room/enter`,
      `GET /api/waiting-room/:id`,
      `POST /api/waiting-room/:id/verify-identity`,
      `POST /api/waiting-room/:id/admit`,
      `POST /api/waiting-room/:id/exit`), `waitingRoomStatuses` added
      to the health payload.
- [x] Verify pure logic in plain Node (throwaway `.cjs` script, deleted
      after -- 18 checks): physical-format booking rejected; real
      happy path through all four states; duplicate session rejected;
      wrong credential rejected with both session and booking left
      unchanged; correct credential proven to genuinely call the real
      `checkIn()` (booking status + `checkedInAt` both actually
      changed); admission blocked before identity check; exit blocked
      before admission and blocked twice; hybrid format also allowed.
- [x] Verify live with `voidmagic/server.js` and `venvs-mock-backend`
      running independently: a real digital experience booked, a real
      waiting room entered, a wrong credential genuinely rejected (the
      real `checkIn()` error message surfaced through), the correct
      credential accepted and confirmed to flip the underlying booking
      to `checked-in`, admission and exit both confirmed, and the
      experience's real completion re-run afterward -- host received
      exactly $33.80, platform kept exactly $6.20 (on a $40 booking),
      escrow returned to precisely its starting balance, proving a
      waiting-room booking still settles correctly.
- [x] Shut down both servers cleanly; confirmed via follow-up port
      check.
- [x] Commit as its own change.

## Next
Notifications (Section 33, the real REMINDERS piece this slice
deliberately deferred), Media, Creator analytics, Customer profiles,
Advanced scheduling, Geofencing -- the rest of Phase 2, each its own
real, later slice.
