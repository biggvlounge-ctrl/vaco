# Tasks — Phase 1: The Core Transaction Loop

- [x] Scaffold the project: `package.json`, `.env.example`,
      `.gitignore`, source brief saved in
      (`VOID_MAGIC_MASTER_BUILD_BRIEF.md` — pasted inline by the user,
      not an uploaded file, saved verbatim under the filename
      originally referenced).
- [x] Create `lib/store.js`: `createVoidMagicStore()`.
- [x] Create `lib/experiences.js`: `EXPERIENCE_TYPES`,
      `EXPERIENCE_FORMATS`, `createExperience`, `getExperience`,
      `discoverExperiences`.
- [x] Create `lib/bookings.js`: `VOID_MAGIC_ESCROW_ACCOUNT`,
      `PLATFORM_TAKE_RATE`, `generateCredential`, `bookExperience`,
      `getBooking`, `checkIn`, `completeExperience`,
      `getPostEventSummary`.
- [x] Wire `server.js`: 8 endpoints (`POST /api/experiences`,
      `GET /api/experiences/:id`, `GET /api/experiences` (filterable
      by `type`/`format`), `POST /api/bookings`,
      `GET /api/bookings/:id`, `POST /api/bookings/:id/check-in`,
      `POST /api/experiences/:id/complete`,
      `GET /api/bookings/:id/post-event-summary`).
- [x] Verify pure logic in plain Node (throwaway `.cjs` script, deleted
      after — 14 checks, all passed clean on first run):
      - `createExperience` creates a real, bookable slot with full
        remaining capacity; rejects an invalid type/format and a
        non-future `scheduledAt`.
      - `discoverExperiences` returns real, open, upcoming experiences,
        correctly filterable by type/format.
      - `bookExperience` charges the real customer via `transferFn`,
        decrements real remaining capacity, issues a real credential;
        the final slot booking correctly marks the experience `full`;
        booking a full or unknown experience is rejected.
      - `checkIn` rejects a wrong credential and a double check-in,
        succeeds with the real one.
      - **The centerpiece**: `completeExperience` pays the real host
        share and the real platform fee, proven to sum EXACTLY to the
        price paid — the escrow account is checked to be fully
        drained to zero after settlement, not just spot-checked;
        booking 2 (never explicitly checked in) still completes
        correctly alongside booking 1; completing an already-completed
        experience is rejected.
      - `getPostEventSummary` returns a real, honest summary only
        after completion; rejects a booking that hasn't completed.
      - A free (price: 0) experience's booking and completion are
        proven to call `transferFn` zero times, via a tracking wrapper.
- [x] Verify live with both `voidmagic/server.js` and
      `venvs-mock-backend` running together: the full 11-step loop run
      end to end against the real running server — experience created,
      discovered, booked (real $100 charge to escrow), checked in
      (wrong credential rejected, correct one accepted), completed
      (real $84.50 host settlement + real $15.50 platform fee, both
      **independently confirmed** via `GET /api/vcoin/balance`, with
      the escrow account confirmed to return to exactly its starting
      balance), and a real post-event summary retrieved.
- [x] Shut down both servers cleanly; confirmed via follow-up process
      check.
- [x] Commit as its own change.

## Next
Phase 2 per Section 40: Security, Transportation, Venue booking, Staff
(all real calls into VOID's existing services via API, per Section
36/47's explicit "don't hard-code into VOID" architecture), Digital
waiting rooms, Hybrid experiences, Media, Creator analytics, Customer
profiles, Advanced scheduling, Geofencing, Notifications.
