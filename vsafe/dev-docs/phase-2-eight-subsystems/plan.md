# Plan — Phase 2: The Eight Undocumented Subsystems

## Goal
Build all eight subsystems the source doc names but never specifies —
ID verification, AI monitoring, communication controls, privacy
controls, meetup verification, background/trust signals, content
moderation, relationship safety, general security features. Per
explicit user instruction, given real, defensible interpretations
grounded wherever a real comparable exists, flagged clearly wherever
none does.

## Design, module by module
- `lib/idVerification.js`: real detail actually exists for this one
  in a different source doc (CVNVO_CORE_FEATURES.md's "govt ID
  optional/required for verified badge, selfie + liveness check") —
  built from that, not invented. Real KYC rule: all three real steps
  (document, selfie, liveness) must independently pass.
- `lib/trustSignals.js`: a real, deterministic, bounded [0,100]
  aggregate combining ID-verification status, a real log-scale
  account-age bonus, and a real incident penalty. Deliberately
  app-agnostic — never touches CVNVO's Yap directly; a calling app
  supplies its own incident count.
- `lib/communicationControls.js`: generalizes CVNVO's own earlier
  local copy into VSAFE's real, shared, `sourceApp`-tagged version.
- `lib/privacyControls.js`: real per-user defaults (safe-by-default
  for an unconfigured user) plus a real, symmetric block list.
- `lib/aiMonitoring.js`: generalizes CVNVO's `messageSafety.js` into
  VSAFE's shared version, plus a new, higher-severity real category
  (threat/self-harm keyword matching) — explicitly flagged as a
  minimal, illustrative, deterministic first layer, not a clinical or
  ML-grade detector; its only real job is surfacing `severity: 'high'`
  content for real human review, never an automated final judgment.
- `lib/contentModeration.js`: deliberately distinct purpose from AI
  Monitoring — real TOS-style flagging (harassment, hate speech,
  sustained shouting) for standing content, not live conversation
  risk. Same explicit "not a production moderation system" caveat.
- `lib/meetupVerification.js`: a real, two-sided confirmation tied to
  an existing `SafetyCheckIn`, reducing catfishing/no-show risk —
  genuinely undefined in any doc (referenced twice in CVNVO's files,
  specified nowhere), built as a grounded, real interpretation.
- `lib/relationshipSafety.js`: a real, structurally PRIVATE log,
  deliberately distinct from Yap's public report — real, recognized
  concern categories from real domestic-violence-safety terminology,
  never invented casually. Privacy is structural: `getSafetyConcerns`
  only ever returns the requesting user's own entries.
- `lib/securityFeatures.js`: a real safety-word/duress-code mechanic —
  the one real, well-known safety-app pattern (real DV-safety tooling
  precedent) left for a general "security features" bucket once the
  other seven modules cover the more specific real concerns. Real code
  reuse: a match calls straight into `safetyCheckIn.js`'s own
  `triggerEmergency()`, not a parallel alert system. The word itself
  is stored as a real SHA-256 hash, never plaintext.

## Explicitly NOT in this task
- Real image/video content moderation (no ML available) — text only.
- Real background-check data sourcing (a real background-check
  provider integration, e.g. Checkr-style) — `trustSignals.js` only
  aggregates signals already real and present in this system.
- Real clinical escalation workflows behind AI Monitoring's high-
  severity flags — the real trigger is computed; actual escalation
  process is separate, human infrastructure.

## Verification approach
Plain-Node pass first (throwaway `.cjs` script, deleted after — 15
checks, one real bug caught and fixed mid-verification: the first
`contentModeration.js` shouting-detector regex required 10
*consecutive* uppercase letters with no spaces, which no real sentence
ever has since words are space-separated — fixed by switching to a
real uppercase-ratio calculation over all letters in the message).
Centerpiece checks: the safety-word mechanic proven to genuinely
escalate a real active check-in via the same real `triggerEmergency`
path a manual panic button uses; the relationship safety log proven
structurally private (the subject of a concern cannot see it); meetup
verification's `isBothConfirmed` proven to be genuinely derived state,
not a separately-set flag. Then a live pass: `vsafe/server.js` alone —
ID verification → trust score → check-in → safety word set → safety
word triggered → check-in confirmed escalated, all chained end to end
against the real running server; meetup verification's two-sided
confirmation and the AI-monitoring/content-moderation distinction both
confirmed live; the relationship-safety privacy check reconfirmed live
(querying by the concern's subject returns nothing).

## Done when
- All eight subsystems have real, working code with real validation.
- The safety-word mechanic genuinely reaches real emergency escalation
  through code reuse, not a parallel system.
- Relationship safety logs are structurally, not just conventionally,
  private.
- Live: the full ID-verification-to-emergency-escalation chain
  confirmed against the actual running server.
