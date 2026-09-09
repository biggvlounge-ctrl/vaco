# Plan — Phase 3: Photo Check-ins, Fake Call, Screen Time

## Goal
Close VSAFE's own three remaining, named "Not yet built" gaps —
`UNIVERSAL_SAFETY_LAYER_VSAFE.md`'s own two real additions beyond
CVNVO's original system (Photo Check-ins, Screen Time/Digital
Wellbeing) plus the doc's own named Fake Call feature. This also
unblocks CVNVO's own README, which separately flags being blocked on
exactly these three.

## Real investigation before any code
Read the source doc's own real data models directly.
`PhotoCheckIn { id, userId, intervalMinutes, scheduledCheckIns: [{
dueAt, photoUrl, submittedAt, status }], trustedContactIds,
missedCheckInAction }` and `ScreenTimeCheckIn { userId, appId,
sessionDurationMinutes, dailyTotalMinutes, isMinorAccount, promptShown,
promptDismissalCount }` are both real and fully specified. Fake Call
has **no data model anywhere** — only a one-line description ("bSafe's
'Fake Call' feature: simulates an incoming call, giving a user a real,
simple way to exit an uncomfortable situation"). Confirmed by reading
the doc's entire "Photo check-ins" section directly, not assumed from
its absence elsewhere.

## Design
- **Photo Check-ins**: rather than pre-generating a fixed
  `scheduledCheckIns` list (the doc doesn't say how many ahead), keep
  one real, live "current" slot per record and roll it forward from
  its own real resolution time as it's submitted or missed — a genuine
  recurring timer. `missedCheckInAction: "escalate-emergency"` reuses
  `safetyCheckIn.js`'s own `triggerEmergency()` directly, the same
  real-code-reuse shape `securityFeatures.js`'s safety word already
  established, via a new, real, optional `checkInId` link field (a
  necessary completion beyond the doc's literal shape, flagged the
  same way `safetyCheckIn.js`'s own header already flagged its own
  extra fields).
- **Fake Call**: since no spec exists, built as a real, flagged
  interpretation. No fabricated default caller identity — `callerName`
  is required. `delaySeconds` bounded 5-300s (a real, flagged
  interpretive range, not left unbounded). Real, deterministic
  ring-polling (`getDueFakeCalls`), matching `checkForMissedCheckIns`'s
  own established shape — no push infra exists in this project.
- **Screen Time**: `dailyTotalMinutes` built as a real *derived* sum
  over the user's own real session records for the real calendar day,
  not a stored field that could desync — this session's own
  established principle (VXLLAGE's `villageEvents.js`, CVNVO's
  `visibleAttendeeCount`). `promptDismissalCount` stays a real,
  deliberately-mutated counter — an actual dismissal-event count, not
  derivable from anything else. Real enforcement asymmetry per the
  doc's own instruction: a minor account's *repeated* dismissal
  escalates `promptSeverity` to `'reinforced'`; a non-minor account's
  dismissals are counted (real transparency) but never escalate
  severity. No exact thresholds are given in the doc —
  `DEFAULT_DAILY_LIMIT_MINUTES` (120) and `MINOR_DAILY_LIMIT_MINUTES`
  (60) are real, flagged interpretive defaults.

## Explicitly NOT in this task
Real SMS/push delivery, or any actual client-side incoming-call UI/
ringtone behind Fake Call's own scheduling — both separate
infrastructure/frontend work. CVNVO's own integration into these three
new endpoints — a real, separate, remaining gap, tracked in CVNVO's own
README, not closed by building the shared service itself.

## Verification approach
27 plain-Node checks across all three modules (rolling photo check-in
schedule, real escalation via a linked `SafetyCheckIn`, fake call's
bounded validation and full lifecycle, screen time's derived total and
the real minor-vs-non-minor severity asymmetry). A live pass against
the real running `vsafe/server.js`: a photo check-in scheduled and
submitted with a real rolling next-slot confirmed; a fake call
scheduled, confirmed not due early, confirmed ringing once genuinely
due, and answered; a screen-time session crossing the real daily limit
with a real prompt and dismissal confirmed.

## Done when
- All three modules are real, tested, and wired into `server.js`.
- Fake Call's own lack of a real spec is documented directly, not
  silently filled in.
- Both READMEs (`vsafe/README.md`, `cvnvo/README.md`) reflect the real,
  current state — VSAFE's own gap closed, CVNVO's own separate
  integration gap re-flagged accurately rather than left stale.
