# Tasks — Phase 2: Villages (deliberately lighter, secondary)

- [x] Create `lib/villages.js`: `createVillage`, `getVillage`,
      `listVillages`, `joinVillage`, `leaveVillage`,
      `getVillageMembers`.
- [x] Create `lib/villageEvents.js`: `createVillageEvent`,
      `getVillageEvent`, `listVillageEvents`, `rsvpToEvent`,
      `unrsvpFromEvent`, `getGoingCount`.
- [x] Create `lib/villageRooms.js`: `ROOM_TYPES`, `createVillageRoom`,
      `getVillageRoom`, `listVillageRooms`, `joinRoom`, `leaveRoom`.
- [x] Extend `createVxllageStore()` with `villages`/`nextVillageId`,
      `villageEvents`/`nextVillageEventId`, `villageRooms`/
      `nextVillageRoomId`.
- [x] Wire `server.js`: 13 new endpoints (`POST`/`GET /api/villages[/:id]`,
      `POST /api/villages/:id/join`, `POST /api/villages/:id/leave`,
      `GET /api/villages/:id/members`, `POST`/`GET /api/village-events[/:id]`,
      `GET /api/villages/:id/events`, `POST /api/village-events/:id/rsvp`,
      `POST /api/village-events/:id/unrsvp`,
      `POST`/`GET /api/village-rooms[/:id]`,
      `GET /api/villages/:id/rooms`, `POST /api/village-rooms/:id/join`,
      `POST /api/village-rooms/:id/leave`).
- [x] Verify pure logic in plain Node (throwaway `.cjs` script, deleted
      after — 14 checks, all passed clean on first run):
      - `createVillage` auto-adds the real owner as first member;
        requires a name and an ownerId.
      - `joinVillage` adds a real member, rejects a duplicate join;
        `leaveVillage` structurally rejects the owner leaving their
        own village, succeeds for a real member, rejects a non-member.
      - `createVillageEvent` requires a real village, title, and
        scheduledAt.
      - `rsvpToEvent`/`unrsvpFromEvent` are real and idempotent; the
        going-count is proven to be a genuinely derived value (checked
        directly against the real attendee array), not a separate
        counter.
      - `createVillageRoom` rejects a non-member owner and an invalid
        `roomType`; creates a real, permanent, creator-owned room with
        a real recurrence field.
      - `joinRoom`/`leaveRoom` are real, idempotent live-participant
        tracking.
- [x] Verify live with `vxllage/server.js` running alone: a village
      created and joined, an event RSVP'd by two real users with the
      derived `goingCount` confirmed via `GET`, and a permanent
      creator-owned room created and joined, all confirmed against the
      actual running server.
- [x] Shut down the server cleanly; confirmed via follow-up process
      check.
- [x] Commit as its own change.

## Next
Channels (text/voice) and the boost economy/cosmetics shop, once
VCoin/V3 reconciliation is in scope — both deliberately deferred this
phase per §0's "shrink" instruction. Also open: whether to build the
VDP Village District's own real estate (a VENVS-side concern) before
or after Home/Villages reach further depth.
