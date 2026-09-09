# Plan — Phase 1: The Real, Generalized SafetyCheckIn

## Goal
Build the one fully-specified subsystem in the source doc first, per
its own explicit instruction: "the main work is extracting the
existing logic into a shared service and giving each app a clean
integration point." This phase builds that shared service as its own
standalone project, deliberately app-agnostic — not a CVNVO-only
implementation with a different name.

## Design
- `lib/safetyCheckIn.js`: matches `UNIVERSAL_SAFETY_LAYER_VSAFE.md`'s
  real `SafetyCheckIn` shape. `sourceApp`/`activityType` are the real
  fields that let any VACO app originate a check-in through the same
  code path — proven directly in verification by creating check-ins
  from both `cvnvo` and `hvntz` and confirming identical, correct
  behavior for both.
- Two real fields beyond the doc's minimal list, flagged as a
  necessary completion, not scope creep: `status` (a real three-state
  lifecycle — the doc only gives a boolean `emergencyTriggered`, with
  no way to represent "confirmed safe" vs. "still pending," which a
  functional check-in system requires) and `confirmedAt` (a real
  audit timestamp). `emergencyTriggered` itself is kept exactly as the
  doc specifies, synced to `status === 'escalated'`.
- Two real emergency paths, both built: `triggerEmergency()` is the
  doc's "emergency/panic features" — a direct, immediate manual
  trigger — and `checkForMissedCheckIns()` is the real, deterministic
  timer-based escalation. Both converge on the same real `escalated`
  state.

## Explicitly NOT in this task
- Photo Check-ins, Fake Call, Screen Time/Digital Wellbeing — all
  fully data-modeled in the source doc, each real enough to be its own
  phase, deliberately deferred to keep this phase focused.
- The eight named-but-unspecified subsystems (ID verification, AI
  monitoring, communication controls, privacy controls, meetup
  verification, background/trust signals, content moderation,
  relationship safety, general security features) — flagged back to
  the user as genuinely undocumented gaps in the source doc itself,
  not invented here.
- Real SMS/push notification delivery for escalations — the real
  trigger logic and real recipient list (`trustedContactIds`) are
  computed; actual delivery is separate infrastructure.
- VSAFE's own standalone-app onboarding/account flow for non-VACO
  users — this phase is the shared-service API only.

## Verification approach
Plain-Node pass first (throwaway `.cjs` script, deleted after — 8
checks). The centerpiece: a check-in created with `sourceApp: 'hvntz'`
behaves identically to one created with `sourceApp: 'cvnvo'` — direct
proof this is genuinely shared infrastructure, not CVNVO relabeled.
Both emergency paths (manual trigger, timer-based escalation) verified
independently, plus a constructed case with one check-in genuinely
past its deadline and one genuinely still within window, confirming
only the correct one escalates. Then a live pass: `vsafe/server.js`
alone — the same cross-app-agnosticism proof run against the actual
running server.

## Done when
- A check-in works identically regardless of which real `sourceApp`
  originates it.
- Both emergency paths (manual, timer-based) are real and correctly
  enforced.
- Live: the running server confirms the same behavior plain Node
  verified.
