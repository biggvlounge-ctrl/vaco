# Tasks — Phase 2 (seventh slice): Media

- [x] Create `lib/media.js`: `MEDIA_TYPES`, `orderMedia`,
      `getMediaOrder`, `listMediaOrders`, `deliverMedia`,
      `getMagicMemoryPackage` -- reusing `bookings.js`'s own
      `VOID_MAGIC_ESCROW_ACCOUNT`/`PLATFORM_TAKE_RATE` rather than
      redefining them.
- [x] Extend `createVoidMagicStore()` with `mediaOrders`/
      `nextMediaOrderId`.
- [x] Wire `server.js`: 5 new endpoints (`POST /api/media-orders`,
      `GET /api/media-orders/:id`,
      `GET /api/bookings/:id/media-orders`,
      `POST /api/media-orders/:id/deliver`,
      `GET /api/bookings/:id/magic-memory`), `mediaTypes` added to the
      health payload.
- [x] Verify pure logic in plain Node (throwaway `.cjs` script, deleted
      after -- shared 27-check run with Geofencing, one real test bug
      caught and fixed, see below): magic-memory rejected pre-
      completion; real order charge; invalid type rejected; empty
      assetUrl rejected at delivery; real host/platform split paid
      only at delivery; escrow drains to zero; double-delivery
      rejected; package assembly correct.
- [x] Verify live with `voidmagic/server.js` and `venvs-mock-backend`
      running independently: a real magic-photo order, delivery, and
      resulting magic-memory package all confirmed against the actual
      server and the real V3 mock ledger balances.
- [x] Shut down both servers cleanly; confirmed via follow-up port
      check.
- [x] Commit as its own change (combined with Geofencing).

## Bug fixed during verification
The verification script's own escrow-drained-to-zero assertion used a
strict `=== 0` comparison, which failed on ~2.66e-15 IEEE754 float
dust from repeated real subtraction across separately-rounded
transfers -- the same class of issue this session already hit and
fixed in VAGO's own ledger tests. Not a real production bug (the
actual settled cent amounts sum exactly); fixed by comparing with a
tolerance instead of strict equality.

## Next
Real photo/video capture and storage infrastructure -- genuinely
separate, later work.
