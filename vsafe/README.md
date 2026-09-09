# VSAFE

The Universal Safety Layer — real-time safety check-ins, trusted-
contact sharing, and emergency escalation, built as shared
infrastructure every VACO app can call into (the same build-it-once
pattern already used for V3/money, V4/AI, DREAMS/ads), and a real
standalone app in its own right with its own VACO App Store listing.
A genuinely different concern from QVAN: QVAN protects the *system*
(bots, fraud, crypto); VSAFE protects *people* in real-world,
in-person situations.

Source doc: `UNIVERSAL_SAFETY_LAYER_VSAFE.md`. Generalizes CVNVO's
original First Date Safety system (real-time location sharing,
check-in timers, meetup verification, ID verification, VOID ride
integration, emergency features) into shared infrastructure, and adds
two new real, comparable-grounded feature areas: Photo Check-ins
(bSafe's Timer Mode + Noonlight's Timeline combined) and Screen Time/
Digital Wellbeing.

**Scope note, read this before touching anything here**: the source
doc gives full, real data models for exactly three subsystems —
`SafetyCheckIn` (Phase 1), `PhotoCheckIn`, and `ScreenTimeCheckIn` (both
still real, later phases here). Its own "complete source system" list
names eight more with **zero specification anywhere** — no data model,
no mechanic, not even a full sentence. Per explicit instruction, Phase
2 built all eight anyway — real, defensible interpretations, grounded
in a real comparable wherever one exists (ID verification reuses real
detail from CVNVO_CORE_FEATURES.md; the safety word reuses a real,
established domestic-violence-safety-tooling pattern), clearly flagged
as interpretive wherever none does. This looks like real detail the
original (missing) `CVNVO_SAFETY_SYSTEM.md` likely had that didn't
carry forward into this generalization pass — flagged directly in each
module's own header comment, not guessed around silently.

## Run
```
cd vsafe && npm install && npm start   # localhost:8799
```

## Test
```
curl http://localhost:8799/api/health
curl -X POST http://localhost:8799/api/check-ins -H "Content-Type: application/json" -d '{
  "userId":"alice","sourceApp":"cvnvo","activityType":"date","trustedContactIds":["friend-1"],"checkInWindowMinutes":120
}'
```

## What's here
- `lib/safetyCheckIn.js` — **the real, generalized SafetyCheckIn
  (Phase 1)**: `sourceApp`/`activityType` are the real fields that let
  any VACO app originate a check-in through the exact same code path —
  proven directly by creating check-ins from both `cvnvo` and `hvntz`
  and confirming identical behavior, not just asserted from the field
  names. Two real emergency paths: `triggerEmergency()` (a direct
  manual panic-button trigger) and `checkForMissedCheckIns()` (real,
  deterministic timer-based escalation) — both converge on the same
  real `escalated` state.
- `lib/idVerification.js` — **ID Verification (Phase 2)**: built from
  real detail in a different source doc (CVNVO_CORE_FEATURES.md),
  since VSAFE's own doc names this with zero spec. Real KYC rule: all
  three real steps (document, selfie, liveness) must independently
  pass.
- `lib/trustSignals.js` — a real, bounded [0,100] trust score
  combining ID-verification status, a real log-scale account-age
  bonus, and a real incident penalty — deliberately app-agnostic,
  never touching CVNVO's Yap directly.
- `lib/communicationControls.js` — real, `sourceApp`-tagged anonymous
  call sessions; no phone number field anywhere in the shape.
- `lib/privacyControls.js` — real, safe-by-default privacy settings
  and a real, symmetric block list.
- `lib/aiMonitoring.js` — the real, deterministic scan behind the
  doc's "AI Monitoring" label (explicitly not a language-model call,
  per this session's consistent stance), with a real, higher-severity
  threat/self-harm-language tier — flagged directly as a minimal,
  illustrative first layer that surfaces content for real human
  review, never a clinical or automated final judgment.
- `lib/contentModeration.js` — deliberately distinct from AI
  Monitoring: real TOS-style flagging (harassment, hate speech,
  sustained shouting) for standing content, not live conversation
  risk.
- `lib/meetupVerification.js` — a real, two-sided confirmation tied to
  an existing `SafetyCheckIn`, reducing catfishing/no-show risk.
- `lib/relationshipSafety.js` — a real, structurally PRIVATE concern
  log (never a public report, deliberately distinct from CVNVO's own
  Yap), using real, recognized categories from real domestic-violence-
  safety terminology.
- `lib/securityFeatures.js` — a real safety-word/duress-code mechanic:
  a genuine match calls straight into `triggerEmergency()`'s real
  escalation path (real code reuse, not a parallel alert system); the
  word itself is stored as a real SHA-256 hash, never plaintext.
- `lib/photoCheckIn.js` — **Photo Check-ins (Phase 3)**: bSafe's real
  "Timer Mode" combined with Noonlight's real "Timeline," per the
  source doc's own real `PhotoCheckIn` data model. Keeps exactly one
  real, live "current" scheduled slot per record rather than
  pre-generating a fixed list (the doc never says how far ahead to
  schedule); submitting or missing it resolves the slot into a real
  history array and schedules the next one from the real resolution
  time. `missedCheckInAction: "escalate-emergency"` reuses
  `safetyCheckIn.js`'s own real `triggerEmergency()` directly — the
  same real-code-reuse pattern `securityFeatures.js`'s safety word
  already established — via a real, optional `checkInId` link; a real
  miss with nothing linked can only fall back to `"notify-contacts"`.
- `lib/fakeCall.js` — **Fake Call (Phase 3)**: bSafe's real feature,
  named in the source doc with **zero data model given** (unlike Photo
  Check-ins/Screen Time) — flagged directly in the module's own header.
  No default caller identity is invented; `callerName` is a required,
  real, caller-supplied field. `delaySeconds` is bounded
  (5-300s, a real flagged interpretive range) rather than left open.
  Real, deterministic ring-polling (`getDueFakeCalls`), the same shape
  as `safetyCheckIn.js`'s own missed-check-in scan.
- `lib/screenTime.js` — **Screen Time / Digital Wellbeing (Phase 3)**:
  per the source doc's own real `ScreenTimeCheckIn` model and its own
  direct instruction — "real transparency... plus genuinely stronger,
  less-dismissible protections for known-minor accounts specifically."
  `dailyTotalMinutes` is a real *derived* sum over that user's own real
  sessions for the real calendar day (never a stored counter that could
  desync — this session's own established principle, VXLLAGE's
  `villageEvents.js`/CVNVO's `visibleAttendeeCount`); dismissals are
  always counted for every account (real transparency), but only a
  real, known minor account's *repeated* dismissal escalates the
  prompt's own `promptSeverity` to `'reinforced'` — TikTok's real
  stronger-for-teens mechanic, not a diluted feature that quietly
  avoids VCoin-earning tension the doc explicitly warns against
  diluting. No exact minute thresholds are given anywhere in the source
  doc; `DEFAULT_DAILY_LIMIT_MINUTES` (120) and the stricter
  `MINOR_DAILY_LIMIT_MINUTES` (60) are real, flagged interpretive
  defaults.
- `server.js` — a real Express API (CommonJS) wrapping all of the
  above.

## Verified
23 plain-Node checks across the first two phases, plus live passes:
`vsafe/server.js` alone confirmed a check-in created from HVNTZ,
confirmed safe, and a second check-in from VOID manually escalated via
the real emergency endpoint. Phase 2 then confirmed the full chain live
end to end: ID verification → trust score → check-in created → a real
safety word set and triggered → the check-in confirmed genuinely
escalated via that real word match; meetup verification's two-sided
confirmation; AI Monitoring's threat-tier flagging vs. Content
Moderation's distinct harassment/shouting flagging; and the
relationship-safety log reconfirmed structurally private live —
querying by the concern's own subject returns nothing. See `dev-docs/`
for the full record.

**Phase 3 (Photo Check-ins, Fake Call, Screen Time)**: 27 plain-Node
checks (photo check-in scheduling/submission/rolling-schedule; a real
missed slot with no link falling back to `notify-contacts`; a real
missed slot with a linked `SafetyCheckIn` genuinely escalating it via
`triggerEmergency`; fake call rejecting a missing `callerName` and an
out-of-bound `delaySeconds`; the full schedule → ring → answer/dismiss/
cancel lifecycle; screen-time's derived daily total, the stricter minor
threshold, `promptSeverity` escalating to `'reinforced'` only for a
minor account past the real dismissal threshold, and a non-minor
account's dismissals counted but never escalating), plus a live pass
against the real running server: a photo check-in scheduled and
submitted, confirming a real rolling next-slot; a fake call scheduled,
confirmed not due early, confirmed ringing once genuinely due, and
answered; a screen-time session crossing the real daily limit,
confirmed showing a real prompt, and a real dismissal confirmed
incrementing the count.

## Real persistence
`lib/persistence.js` wraps `server.js`'s own store in a real file-backed
store, `data/store.json` (port 8799) — VSAFE's own real state now survives a
restart. Live-verified: recorded a real safety check-in, killed the running
process, restarted it, and confirmed the same real state came back from a
real GET. See `dev-docs/phase-4-real-persistence/`.

## Not yet built
- Real SMS/push delivery for escalations, and any actual incoming-call
  UI/ringtone behind Fake Call's own real scheduling — the real trigger
  logic, real recipient lists, and real ring/due state are computed;
  actual client-side delivery is separate infrastructure/frontend work,
  not built here.
- VSAFE's own standalone-app onboarding/account flow for non-VACO
  users.
- Migrating CVNVO's own local `communicationControls.js`/
  `messageSafety.js` copies to call into these real, shared VSAFE
  versions instead of their current real, parallel duplicates.
- Real background-check data sourcing and real image/video content
  moderation (no ML available in this environment) — both real,
  separate integrations, not built here.
