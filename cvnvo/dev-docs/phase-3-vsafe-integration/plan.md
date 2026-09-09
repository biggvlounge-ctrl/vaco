# Plan — Phase 3: Real Integration with VSAFE

## Goal
Per CVNVO_ARCHITECTURE.md's own cross-reference ("this document's
safety logic should be built as a call into VSAFE rather than a
CVNVO-only implementation") and the user's explicit instruction to
make sure VSAFE "can be used in combo" with CVNVO: refactor
`lib/firstDateSafety.js` from a full local duplicate of safety state
into a real, thin client of VSAFE's now-real, standalone service.

## Design
Real ownership split, not a cosmetic wrapper:
- **VSAFE owns safety-critical state** — is this person genuinely
  safe, the check-in timer, emergency status. CVNVO no longer tracks
  `status`, `checkInDeadline`, or escalation locally at all; those
  fields are gone from the local record.
- **CVNVO owns dating-specific extension data** — which match a
  check-in belongs to, the itinerary, the real "We Met" match-quality
  feedback (`actuallyMet`/`dateRating`), and the VOID ride link — on a
  local record that references VSAFE's real check-in by id
  (`vsafeCheckInId`), not a second copy of the safety state.
- Three real, injected VSAFE client functions
  (`vsafeCreateFn`/`vsafeConfirmFn`/`vsafeGetFn`), mirroring this
  session's established `transferFn` pattern, with `server.js` wiring
  the real, live HTTP calls to VSAFE's own running server (port 8799).
- A new `getFullCheckInStatus()` — a real, live combined read: CVNVO's
  own local data plus a genuine, current fetch of VSAFE's real status,
  proving this is a real cross-service read, not a cached local copy
  that could drift.
- `checkForMissedCheckIns()` is removed from CVNVO entirely — that
  scan is now genuinely VSAFE's own responsibility
  (`POST /api/check-missed` on VSAFE's server), not duplicated.

## Explicitly NOT in this task
- VSAFE's Photo Check-ins, Fake Call, and Screen Time — CVNVO doesn't
  integrate with any of those yet, since VSAFE itself hasn't built
  them yet either.
- Real SMS/push delivery for escalations — still VSAFE's own,
  separately-scoped future work.

## Verification approach
Plain-Node pass first (throwaway `.cjs` script, deleted after — 7
checks) using a real, stateful fake VSAFE client (genuinely enforces
rejection on double-confirmation, not just canned responses — same
discipline as this session's `fakeTransferFn`). Then the real test:
`cvnvo/server.js`, `vsafe/server.js`, and `void/server.js` running as
three genuinely independent processes — a check-in created via
CVNVO's API, then independently verified to exist on VSAFE's own
server via a direct `GET`; confirmation via CVNVO's API independently
verified on VSAFE's server; and the centerpiece — attempting to
double-confirm via CVNVO's API and confirming the rejection message is
VSAFE's own real rejection, propagated through CVNVO, not a
CVNVO-side re-implementation of the same check.

## Done when
- CVNVO's local check-in record no longer duplicates any safety-state
  field VSAFE now owns.
- A check-in created via CVNVO is independently visible and correct
  on VSAFE's own server.
- A rejection from VSAFE (e.g., double confirmation) genuinely
  propagates through CVNVO rather than being silently absorbed or
  re-decided locally.
- Live: all three servers (CVNVO, VSAFE, VOID) running independently,
  full loop confirmed end to end.
