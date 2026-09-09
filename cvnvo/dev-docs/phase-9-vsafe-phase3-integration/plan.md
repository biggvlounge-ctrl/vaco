# Plan — Phase 9: Wire CVNVO into VSAFE's Phase 3 endpoints

(Numbered 9, not 8, to stay consistent with `README.md`'s own
cross-app numbering — Phase 8 was the VDP Dating Village, whose real
code changes live in `../vdp/dev-docs/`, not here, since nothing in
this repo structurally changed for that phase.)

## Goal
Close CVNVO's own last remaining flagged gap: VSAFE's Phase 3 endpoints
(Photo Check-ins, Fake Call, Screen Time) are real and built, but
nothing in CVNVO called into them yet.

## Real investigation before any code
Read `lib/firstDateSafety.js` directly first — CVNVO already has a
real, established pattern for calling into VSAFE: injected client
functions (`vsafeCreateFn`/`vsafeConfirmFn`/`vsafeGetFn`), wired to
real live HTTP in `server.js`, the same shape as `transferFn`
elsewhere. The new integration should extend this exact pattern, not
invent a new one.

Checked VSAFE's own three new data shapes directly: `PhotoCheckIn`
takes an optional `checkInId` link to a real `SafetyCheckIn` (added in
VSAFE's own Phase 3 specifically to let a missed photo check-in
escalate a real, existing check-in) — CVNVO's own local
`safetyCheckIns` record already carries the matching real
`vsafeCheckInId`, so linking them is a real, natural fit, not a stretch.
`FakeCall` and `ScreenTimeCheckIn` both take only a bare `userId` (and
`appId` for screen time) — neither has anything for CVNVO to attach
extension data to, unlike the date-scoped check-in.

## Design
- **Photo Check-ins** extend `firstDateSafety.js` (not a new file):
  `schedulePhotoCheckIn` reads the date's own real VSAFE check-in back
  live (`vsafeGetFn`) to reuse its real `trustedContactIds` — asking
  the caller to supply them again would risk a second, silently-
  diverging contact list for the same date — and passes VSAFE's own
  `checkInId` through so a miss can genuinely escalate the same real
  check-in. Only the resulting `vsafePhotoCheckInId` is kept locally,
  matching `vsafeCheckInId`'s own existing minimal-linkage shape.
  `submitPhotoCheckIn` is a thin, real forward using that stored id.
- **Fake Call / Screen Time** get a new, small file
  (`lib/vsafeExtras.js`), kept separate from `firstDateSafety.js`
  deliberately: both are real, validated pass-throughs with no
  CVNVO-side state to add. CVNVO's own real contribution is confirming
  the caller is a real, existing profile (`getUserProfile`) before
  forwarding — not a bare proxy. `appId` is hardcoded `'cvnvo'`, never
  caller-supplied. `isMinorAccount` is real-derived from the profile's
  own verified `age` field rather than trusted as client input (the
  same instinct behind VACA's `verifiedBadge` fix) — flagged directly
  that this always resolves `false` today, since `createUserProfile`
  already enforces an 18+ floor on every real CVNVO profile.

## Explicitly NOT in this task
Any VDP-side UI for these three features (Fake Call/Screen Time have no
district surface, same as most of CVNVO's own Phase 7 formats). Real
SMS/push delivery or client-side incoming-call UI — both remain
VSAFE's own, unrelated, already-flagged gaps.

## Verification approach
13 plain-Node checks with mocked injected VSAFE client functions
(confirming real trustedContactIds/checkInId reuse, rejection of a
second photo check-in per date, both pass-throughs rejecting an unknown
userId, appId/isMinorAccount derivation). A full live pass with `vaca`,
`venvs-mock-backend`, `vsafe`, and `cvnvo` running together: a real date
check-in created, a photo check-in scheduled against it with
`trustedContactIds`/`checkInId` confirmed correctly reused/linked
directly on VSAFE's own server, a real submission confirmed
server-side, and a real missed slot confirmed to genuinely escalate the
linked `SafetyCheckIn` end to end (status flips to `escalated` on
VSAFE's own server). A real Fake Call confirmed transitioning to
`ringing` once genuinely due; a real screen-time session confirmed
crossing the daily limit with the same total independently re-read
directly from VSAFE.

## Done when
- CVNVO can genuinely originate all three VSAFE Phase 3 features, not
  just VSAFE having them available.
- The Photo Check-in ↔ SafetyCheckIn escalation link is proven live,
  not just asserted from the field names.
- Both READMEs (`vsafe/README.md` unchanged this phase, `cvnvo/README.md`)
  reflect the real, current state.
