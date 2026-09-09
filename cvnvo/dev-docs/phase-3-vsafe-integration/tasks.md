# Tasks — Phase 3: Real Integration with VSAFE

- [x] Refactor `lib/firstDateSafety.js`: removed the local
      `status`/`checkInDeadline`/`checkedInAt` safety-state fields and
      the local `checkForMissedCheckIns()` scan entirely.
      `createSafetyCheckIn` now calls a real, injected `vsafeCreateFn`
      and stores a local record referencing the real
      `vsafeCheckInId`. `confirmSafe` now calls a real, injected
      `vsafeConfirmFn` before recording local We-Met feedback. Added
      `getFullCheckInStatus()` — a real, live combined read via a
      third injected `vsafeGetFn`. `getUserDateReliability` and
      `attachVoidRideData` unchanged (neither touches safety state).
- [x] Wire `server.js`: added `vsafeCreate`/`vsafeConfirm`/`vsafeGet`
      real HTTP clients (mirroring the existing `fetchVoidJob`
      pattern) hitting VSAFE's real running server; added
      `GET /api/safety/check-ins/:id/full-status`; removed the stale
      `POST /api/safety/check-missed` endpoint (now genuinely VSAFE's
      own responsibility).
- [x] Verify pure logic in plain Node (throwaway `.cjs` script, deleted
      after — 7 checks, all passed clean on first run) using a real,
      stateful fake VSAFE client:
      - `createSafetyCheckIn` makes a real call into the injected
        VSAFE client and stores a local record referencing the
        returned id; requires a real `vsafeCreateFn`.
      - `getFullCheckInStatus` combines the real local record with a
        live VSAFE fetch.
      - `confirmSafe` calls the real VSAFE confirm and records real
        local We-Met feedback in the same action; a genuine VSAFE-side
        rejection (double confirmation) is proven to propagate rather
        than being silently absorbed.
      - `getUserDateReliability`/`attachVoidRideData` confirmed
        unaffected by the refactor.
- [x] Verify live with three genuinely independent servers running
      together — `cvnvo/server.js`, `vsafe/server.js`,
      `void/server.js`: a check-in created via CVNVO's API
      independently confirmed to exist, correctly tagged
      `sourceApp: "cvnvo"`, on VSAFE's own server via a direct `GET`;
      confirmation via CVNVO's API independently confirmed on VSAFE's
      server; the combined full-status view confirmed live; and a
      double-confirmation attempt via CVNVO's API confirmed to
      surface VSAFE's own real rejection message, not a CVNVO-side
      re-check.
- [x] Shut down all three servers cleanly; confirmed via follow-up
      process check.
- [x] Commit as its own change.

## Next
Extend the same real integration pattern to other real VSAFE-eligible
CVNVO surfaces as they're built (e.g., BarBuddy's venue check-ins), and
to other apps entirely (HVNTZ hunt checkpoints, VOID rides) once
they're ready to adopt VSAFE the same way.
