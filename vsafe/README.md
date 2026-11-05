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

## Frontend coverage pass (30 Oct 2026)

An audit found `public/index.html` making real calls against only 7 of
this app's 43 routes, and two of those seven were themselves broken --
the Check-ins "Start a check-in" form posted fields
(`expectedReturnAt`, `note`) that `createSafetyCheckIn` doesn't read,
so it 400'd every time; the Exit calls "Schedule one" form had the
same problem (posted `scheduledFor`, but `scheduleFakeCall` requires a
real `callerName` and a bounded `delaySeconds`); the Check-ins lookup
called a `/full-status` route that exists nowhere in `server.js`; and
the Identity tab's Screen Time summary read `t.totalMinutes` against a
response field actually named `dailyTotalMinutes`, so it silently
always showed 0m. All four were fixed as part of this pass, each
confirmed against the real route and response shape by curling the
live server directly, not assumed from the handler source alone.

Three of the existing tabs were extended and seven new ones added, ten
tabs in total — every field checked against the real route handler and
its `lib/*.js` function first, and the create/action pairs re-verified
live end to end (not just syntax-checked) before each was committed:

- **Check-ins tab** — fixed the two bugs above, and added the two real
  actions this app's own panic-button story depends on: Confirm safe
  (`POST /api/check-ins/:id/confirm-safe`) and Trigger emergency
  (`POST /api/check-ins/:id/emergency`), the latter showing the real
  notification-delivery outcome honestly (vaco-notify unreachable
  renders as "not delivered," never a false "contacts notified").
- **Identity tab** — added ID verification submission
  (`POST /api/id-verification`, all three real KYC steps
  independently selectable) alongside the existing verified-only
  badge, the full record (`GET /api/id-verification/:userId`), and a
  trust-score calculator (`POST /api/trust-score`).
- **Exit calls tab** — fixed the bugs above, and added the real
  lifecycle actions it never exposed: Cancel (scheduled-only), Answer
  and Dismiss (ringing-only), both as a lookup-by-id card and as
  inline buttons on the Due now table.
- **Photo check-ins tab** (new) — Phase 3's headline addition had zero
  frontend exposure. Schedules a real recurring check-in (interval,
  trusted contacts, `missedCheckInAction`, an optional real link to an
  existing check-in id), looks one up, submits a photo for the current
  pending slot, and stops it.
- **Meetup verification tab** (new) — requests a real, two-sided
  confirmation tied to an existing check-in, looks one up, and lets a
  participant who hasn't yet confirmed do so.
- **Safety word tab** (new) — sets the real duress code
  (`POST /api/safety-word`, stored as a SHA-256 hash) and tests it
  (`POST /api/safety-word/check`) as a genuine action, not a
  simulation: a correct match really escalates the user's most recent
  active check-in, and the page says so before anyone uses it. Also
  covers the structurally private relationship-safety concern log
  (log + view-your-own-only).
- **Privacy & blocking tab** (new) — editable privacy settings
  (`POST /api/privacy-settings`, the Identity tab's own summary stayed
  read-only) plus the real symmetric block list (block, unblock, and a
  block-status lookup) that had no frontend at all.
- **Screen time tab** (new) — records a session
  (`POST /api/screen-time/sessions`), shows the day's real check-in
  record, and dismisses its prompt -- verified live that a minor
  account's third dismissal flips `promptSeverity` from `standard` to
  `reinforced`, the genuinely harder-to-dismiss mechanic the source
  doc calls for.
- **Content safety tab** (new) — AI Monitoring and Content Moderation
  (`POST /api/monitor/screen`, `POST /api/moderation/check`) had no
  frontend at all. Both are stated directly as real, deterministic
  keyword layers, not language-model calls, surfacing content for
  human review rather than making an automated final judgment.
- **Anonymous calls tab** (new) — communication controls
  (`POST /api/calls`, `GET /api/calls/:id`, `POST /api/calls/:id/end`)
  had no frontend at all. Either party can end a call, matching
  `requireCallParty`'s own rule.

Consistently left backend-only, by design: `POST /api/check-missed`
and `POST /api/photo-check-ins/check-missed`, both gated to
`requireCallingService()` — real internal-scheduler sweeps with no
end-user session to authorize them. This frontend has no service
credential, so those stay real backend capabilities rather than a fake
"admin" UI pretending to hold one. `GET /api/health` is introspection
metadata, not a feature, and stays uncalled by any tab for the same
reason none of this ecosystem's other frontends expose it.

## Not yet built
- Real SMS/push delivery for escalations, and any actual incoming-call
  UI/ringtone behind Fake Call's own real scheduling — the real trigger
  logic, real recipient lists, and real ring/due state are computed;
  actual client-side delivery is separate infrastructure/frontend work,
  not built here.
- VSAFE's own standalone-app onboarding/account flow for non-VACO
  users.
- ~~Migrating CVNVO's own local `communicationControls.js`/
  `messageSafety.js` copies to call into these real, shared VSAFE
  versions instead of their current real, parallel duplicates.~~ Half
  done, 2026-11-05: `messageSafety.js` is gone -- CVNVO's `sendMessage`
  (`lib/messages.js`) and its `/api/messages/screen` preview route now
  call this app's own real, open `POST /api/monitor/screen`
  (`lib/aiMonitoring.js`'s `screenContent`, which already generalized
  that exact pattern set plus a real threat/self-harm category CVNVO's
  copy never had) via an injected `vsafeScreenMessageFn`, the same
  real-cross-app-call shape CVNVO already used for check-ins, photo
  check-ins, fake calls and screen time. Live-verified: with this app
  down, CVNVO's send fails closed (no message stored, no silent
  unscreened pass-through) rather than falling back to a local copy.
  **`communicationControls.js` stays a real, deliberate duplicate.**
  Checked directly rather than assumed: CVNVO's `requireCallParty()`
  guard does a synchronous local `store.callSessions.find(...)` lookup
  in `server.js`, and migrating the call-session logic itself to a
  remote call here would mean rebuilding that guard as async -- a real
  architectural change, not a drop-in swap like the stateless
  classifier above was.
- Real background-check data sourcing and real image/video content
  moderation (no ML available in this environment) — both real,
  separate integrations, not built here.
