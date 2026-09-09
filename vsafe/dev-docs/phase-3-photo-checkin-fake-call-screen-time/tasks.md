# Tasks — Phase 3: Photo Check-ins, Fake Call, Screen Time

- [x] Investigate: read the source doc's own `PhotoCheckIn`/
      `ScreenTimeCheckIn` data models directly; confirm Fake Call has
      zero data model anywhere in the doc.
- [x] `lib/photoCheckIn.js` — `schedulePhotoCheckIn`, `getPhotoCheckIn`,
      `submitPhotoCheckIn` (rolls the current slot forward),
      `stopPhotoCheckIn`, `checkMissedPhotoCheckIns` (real escalation
      via a linked `SafetyCheckIn`, matching `securityFeatures.js`'s
      own real-code-reuse pattern).
- [x] `lib/fakeCall.js` — `scheduleFakeCall` (required `callerName`, no
      fabricated default; bounded `delaySeconds`), `getFakeCall`,
      `cancelFakeCall`, `getDueFakeCalls` (real deterministic
      ring-poll), `answerFakeCall`, `dismissFakeCall`.
- [x] `lib/screenTime.js` — `recordSession` (real derived
      `dailyTotalMinutes`), `getDailyTotalMinutes`,
      `getScreenTimeCheckIn`, `dismissPrompt` (real minor-vs-non-minor
      severity asymmetry).
- [x] `lib/store.js` — added `photoCheckIns`/`nextPhotoCheckInId`,
      `fakeCalls`/`nextFakeCallId`, `screenTimeSessions`/
      `nextScreenTimeSessionId`, `screenTimeCheckIns`.
- [x] `server.js` — wired all three modules' imports, 13 new routes,
      health endpoint extended with `missedCheckInActions`,
      `fakeCallStatuses`, and the two real screen-time limit constants.
- [x] 27 plain-Node checks — all passing (rolling photo-check-in
      schedule; missed-with-no-link vs. missed-with-linked-escalation;
      fake call's required-callerName and bounded-delay validation, and
      its full schedule → ring → answer/dismiss/cancel lifecycle;
      screen time's derived daily total, the stricter minor threshold,
      `promptSeverity` only escalating for a minor account past the
      real dismissal threshold, non-minor dismissals counted but never
      escalating).
- [x] Live pass against the real running `vsafe/server.js`: a photo
      check-in scheduled and submitted (real rolling next-slot
      confirmed); a fake call scheduled, confirmed not due early,
      confirmed ringing once genuinely due, and answered; a
      screen-time session crossing the real daily limit, confirmed
      showing a real prompt, and a real dismissal confirmed
      incrementing the count.
- [x] Shut down the test server; confirmed via port check.
- [x] Update `vsafe/README.md` (What's here, Verified, Not yet built).
- [x] Update `cvnvo/README.md` — re-flagged its own VSAFE-integration
      gap accurately (VSAFE has built these now; CVNVO doesn't call
      into them yet — a different, narrower gap than before).
- [x] Write this plan/tasks pair.

## Next
CVNVO's own integration into these three new VSAFE endpoints. Real SMS/
push delivery for escalations, and any actual client-side incoming-call
UI/ringtone for Fake Call. VSAFE's own standalone-app onboarding flow.
Migrating CVNVO's local `communicationControls.js`/`messageSafety.js`
copies to the shared VSAFE versions.
