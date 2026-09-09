# Tasks — Phase 1: The Real, Generalized SafetyCheckIn

- [x] Scaffold the project: `package.json`, `.env.example`,
      `.gitignore`, source doc copied in
      (`UNIVERSAL_SAFETY_LAYER_VSAFE.md`).
- [x] Create `lib/store.js`: `createVsafeStore()`.
- [x] Create `lib/safetyCheckIn.js`: `SOURCE_APPS`,
      `CHECKIN_STATUSES`, `createSafetyCheckIn`, `getSafetyCheckIn`,
      `confirmSafe`, `triggerEmergency`, `checkForMissedCheckIns`.
- [x] Wire `server.js`: 5 endpoints (`POST`/`GET /api/check-ins[/:id]`,
      `POST /api/check-ins/:id/confirm-safe`,
      `POST /api/check-ins/:id/emergency`, `POST /api/check-missed`).
- [x] Verify pure logic in plain Node (throwaway `.cjs` script, deleted
      after — 8 checks, all passed clean on first run):
      - Check-in creation works for CVNVO, and identically for HVNTZ —
        the direct proof this is genuinely shared, not app-specific.
      - Invalid `sourceApp`, missing `activityType`, and zero trusted
        contacts all rejected.
      - `confirmSafe` real-transitions status, rejects double-
        confirmation.
      - `triggerEmergency` real-escalates immediately regardless of
        the timer; rejects a check-in already confirmed safe.
      - `checkForMissedCheckIns` real-escalates only a check-in
        genuinely past its deadline, correctly leaves one still within
        window untouched; the escalated record carries the real
        `trustedContactIds` a notification layer would act on.
- [x] Verify live with `vsafe/server.js` running alone: a check-in
      created from HVNTZ, confirmed safe; a second check-in from VOID,
      manually escalated via the real emergency endpoint — both
      confirmed against the actual running server.
- [x] Shut down the server cleanly; confirmed via follow-up process
      check.
- [x] Commit as its own change.

## Next
Refactor CVNVO's existing `lib/firstDateSafety.js` to call into this
real service (rather than keeping its own local, CVNVO-only
duplicate) — the actual "used in combo" requirement. Then Photo
Check-ins, Fake Call, and Screen Time as their own later phases.
