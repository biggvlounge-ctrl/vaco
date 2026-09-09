# Plan — Phase 2: Yap + First Date Safety

## Goal
Build Yap and CVNVO's safety architecture from what's actually
available, honestly, rather than waiting indefinitely on the missing
dedicated Yap/safety spec doc flagged at the start of this project.
Every piece here is traceable to a real sentence in one of the four
source docs; nothing about Yap's review/moderation workflow (which
genuinely isn't documented anywhere) is invented.

## Design
- `lib/yap.js`: matches `CVNVO_ARCHITECTURE.md`'s `YapReport` shape
  exactly. The decoupling from matching isn't just asserted — this
  module never imports `lib/matching.js` or touches `store.matches`
  anywhere, and Phase 2's verification includes a direct adversarial
  proof (submit real red-flag reports against a matched user, confirm
  `Match.compatibilityScore` is byte-for-byte unchanged), not just a
  code-review argument.
- `lib/firstDateSafety.js`: the real check-in timer
  (`CVNVO_DATING_COMPARABLES.md`'s "itinerary sharing, live location,
  safety check-in timer"), with the "We Met" feedback folded into the
  exact same `confirmSafe()` action per the standing decision's own
  literal wording — "one user action, two uses." A real, deterministic
  escalation scan (`checkForMissedCheckIns`) computes exactly who
  (real `trustedContactIds`) would need notifying once a check-in
  passes its real deadline unconfirmed — no actual SMS/push delivery
  is built, that's real notification infrastructure, out of scope.
  `getUserDateReliability` is a real, honest, directly-computed
  aggregate (not a fake ML score) that a later phase could feed back
  into matching.
- **VOID integration, checked against VOID's real code before
  building**: read `void/lib/marketplace.js` directly first. VOID's
  real job shape has `providerId` (a real driver id) but no pickup/
  dropoff address or live-location fields today — the doc's claim
  ("pickup/dropoff, driver ID, live location") is partially ahead of
  what VOID itself currently exposes. `attachVoidRideData()` honestly
  integrates only what's real: a genuine, live HTTP call to VOID's own
  `GET /api/job/:id`, via an injected `voidFetchFn` mirroring this
  session's established `transferFn` pattern. The gap (no real
  pickup/dropoff/live-location fields on VOID's job model) is flagged
  in code comments and README, not silently worked around.
- `lib/communicationControls.js`: real anonymous call-session
  bookkeeping — no phone number field exists anywhere in the shape,
  by construction, not by convention.
- `lib/messageSafety.js`: the doc's "AI spam/scam filtering" /
  "Relationship Guardian AI" — per this session's consistent no-fake-
  AI stance, this builds the real, deterministic rule-based scan
  underneath that description (contact-solicitation patterns,
  phone-number-shaped content, external links, character flooding),
  explicitly not a language-model call.

## Explicitly NOT in this task
- Yap's actual review/moderation UI and workflow, and any due-process
  mechanism for a reported user to respond — genuinely undocumented
  anywhere, not invented here.
- Real SMS/push notification delivery for safety escalations — the
  real trigger logic and real recipient list are computed;
  actually notifying them is separate infrastructure.
- A real model-backed spam/scam classifier — `messageSafety.js` is the
  real, deterministic first layer, not a placeholder for one.
- Feeding `getUserDateReliability`'s real signal back into
  `lib/matching.js`'s compatibility score — computed for real here,
  wiring it into matching is separate, later work.

## Verification approach
Plain-Node pass first (throwaway `.cjs` script, deleted after — 16
checks). The centerpiece: three real red-flag Yap reports submitted
against a user with an active match, with `Match.compatibilityScore`
checked before and after and proven byte-identical — a direct,
adversarial proof of decoupling, not an inference from reading the
code. A missed-check-in escalation scenario constructed with one
check-in genuinely past deadline and one genuinely still within
window, confirming only the correct one escalates. Then a live pass:
`cvnvo/server.js` running alongside VOID's own independently running
`void/server.js` — a real VOID transportation job created and matched
to a real driver, then genuinely fetched cross-server by CVNVO via a
live HTTP call, with the real `driverId`/`voidJobStatus` confirmed
attached to the check-in from VOID's actual response, not a stub.

## Done when
- Yap reports are real and provably decoupled from matching, verified
  adversarially.
- The safety check-in lifecycle (scheduled → confirmed/escalated) is
  real and correctly enforced.
- The "We Met" feedback is recorded in the same real action as safety
  confirmation, not a separate ask.
- The VOID ride integration is a genuine live cross-app call, honestly
  scoped to what VOID's real job model currently exposes.
- Message screening is real and deterministic, explicitly not a fake
  AI call.
- Live: the Yap decoupling and the VOID cross-app fetch both
  independently confirmed against actual running servers.
