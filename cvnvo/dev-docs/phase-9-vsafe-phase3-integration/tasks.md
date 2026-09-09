# Tasks — Phase 9: Wire CVNVO into VSAFE's Phase 3 endpoints

- [x] Investigate: read `lib/firstDateSafety.js`'s own established
      injected-client pattern directly; read VSAFE's own `PhotoCheckIn`/
      `FakeCall`/`ScreenTimeCheckIn` shapes to confirm which one has a
      real `checkInId` link worth reusing.
- [x] `lib/firstDateSafety.js` — `schedulePhotoCheckIn` (real
      `trustedContactIds` reuse via `vsafeGetFn`, real `checkInId` link
      passed through, rejects a second schedule for the same date),
      `submitPhotoCheckIn` (thin real forward using the stored
      `vsafePhotoCheckInId`).
- [x] `lib/vsafeExtras.js` — new file. `triggerFakeCall`,
      `recordScreenTimeSession` (both validate a real, existing CVNVO
      profile first; `appId` hardcoded; `isMinorAccount` real-derived
      from profile age).
- [x] `server.js` — 4 new real live HTTP client functions
      (`vsafePhotoSchedule`, `vsafePhotoSubmit`, `vsafeFakeCall`,
      `vsafeScreenTime`), 4 new routes (`POST
      /api/safety/check-ins/:id/photo-check-in`, `.../submit`, `POST
      /api/safety/fake-call`, `POST /api/safety/screen-time`).
- [x] 13 plain-Node checks — all passing.
- [x] Live pass against real running `vaca` + `venvs-mock-backend` +
      `vsafe` + `cvnvo`: real profiles created; a real date
      `SafetyCheckIn` created; a photo check-in scheduled against it
      with `trustedContactIds: ["bob"]` and `checkInId: 1` confirmed
      correctly reused/linked by reading VSAFE's own server directly; a
      real photo submitted and confirmed server-side on both ends; a
      real missed slot (VSAFE's own future-time `check-missed` scan)
      confirmed to genuinely flip the linked `SafetyCheckIn`'s own
      status from `active` to `escalated` on VSAFE's side — the full
      cross-app escalation chain, proven, not asserted. A real Fake
      Call scheduled for alice, rejected for an unknown user, and
      confirmed transitioning to `ringing` once genuinely due. A real
      screen-time session confirmed crossing the daily limit
      (`dailyTotalMinutes: 150`, `promptShown: true`) with the same
      real total independently re-read from VSAFE directly.
- [x] Shut down all test servers; confirmed via port checks.
- [x] Update `cvnvo/README.md` (What's here, Verified, Not yet built).
- [x] Write this plan/tasks pair.

## Next
Any VDP-side UI surface for Fake Call/Screen Time (neither has a
district today). Migrating CVNVO's own local
`communicationControls.js`/`messageSafety.js` copies to the shared
VSAFE versions — a separate, already-flagged gap, unrelated to this
phase.
