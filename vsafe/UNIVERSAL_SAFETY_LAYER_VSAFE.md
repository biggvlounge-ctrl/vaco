# Universal Safety Layer — "VSAFE" (v1, proposed name)

Generalizes CVNVO's existing First Date Safety system into shared
infrastructure every VACO app can call into — the same
"build-it-once, shared-service" pattern already used for V3 (money),
V4 (AI), DREAMS (ads), and VACA (identity).

## Naming note

Proposing **VSAFE**, matching VACO's established naming convention
(VASH, VOID, VOKEN, VAGO). A genuinely different concern from
**QVAN** (platform/cyber security — bots, fraud, disaster recovery,
post-quantum cryptography) — QVAN protects the *system*, VSAFE
protects *people* in real-world, in-person situations. Worth keeping
these clearly separate rather than merging them, the same way every
other shared service in this ecosystem has a distinct, single
responsibility. Open to a different name if preferred — this is a
placeholder, not a final decision.

## What CVNVO's First Date Safety already includes (the source system)

Real-time location sharing with trusted contacts, check-in timers,
meetup verification, ID verification, driver/pickup data integration
(VOID rides feeding into the safety system), emergency/panic features.

## Generalized, shared architecture

```
SafetyCheckIn {
  id, userId, sourceApp: "cvnvo" | "hvntz" | "void" | "vault-studios" |
    "vacay" | "vxllage"  // any app can originate a check-in
  activityType: string  // "date", "hunt-checkpoint", "ride",
                          // "fan-meetup", "stay-checkin", etc.
  trustedContactIds: [userId]
  locationSharingActive: boolean
  checkInTimerExpiresAt: timestamp
  emergencyTriggered: boolean
}
```

## Real fit per app — why this is genuinely useful beyond CVNVO

- **CVNVO** — already the source system, unchanged.
- **HVNTZ** — real hunts send people to real, sometimes unfamiliar
  physical locations; check-in timers and trusted-contact sharing
  apply directly.
- **VOID** — riders/drivers already need real-time trip sharing and
  emergency features (standard in real rideshare apps); VSAFE gives
  VOID this without building a separate system.
- **Vavlt Stvdios** — real-world creator/fan meetups (a real, growing
  use case as the platform scales) benefit from the same meetup-
  verification mechanic already built for CVNVO's dates.
- **VACAY** — checking into a real stay/host meetup is structurally
  the same safety need as a first date.
- **VXLLAGE** — in-person meetups arranged from VDP's Village live
  rooms.

## What CVNVO's full safety system already includes (the complete source system)

Consolidating everything already established, not just the location/
check-in subset: ID verification, AI monitoring, communication
controls, privacy controls, First Date Safety, meetup verification,
background/trust signals, content moderation, location safety,
relationship safety, security features, and emergency features. VSAFE
generalizes this complete set, not a partial one.

## Photo check-ins — new addition, real comparables identified

**Honest finding**: no single real app offers exactly "auto-send a
photo every hour" as one named feature — but it's a genuine, sensible
combination of two real, separately-proven patterns:

- **bSafe's real "Timer Mode"**: set an expected check-in time; if you
  don't check in, your contacts are automatically alerted.
- **Noonlight's real "Timeline"**: users log real activity details,
  including photos (e.g., a date's profile photo), viewable by their
  Safety Network if something goes wrong.

**VSAFE's version combines both into a real, scheduled, recurring
mechanic**: a user sets an interval (e.g., every hour while traveling
or on a date), the app prompts a photo check-in at each interval, and
it's automatically sent to designated trusted contacts — proactive
proof-of-safety, not just passive logging.

**Two additional real features worth adopting directly**, found in
this research:
- **Noonlight's "Safety Network" model**: designated contacts can view
  check-ins and respond **without needing the app installed
  themselves** — real, important friction reduction.
- **bSafe's "Fake Call" feature**: simulates an incoming call, giving
  a user a real, simple way to exit an uncomfortable situation.

```
PhotoCheckIn {
  id, userId, intervalMinutes  // e.g., 60 for hourly
  scheduledCheckIns: [{ dueAt, photoUrl, submittedAt, status:
    "on-time" | "missed" | "auto-escalated" }]
  trustedContactIds: [userId]  // per Safety Network model — contacts
                                 // can view/respond without the app
  missedCheckInAction: "notify-contacts" | "escalate-emergency"
}
```

## Status
Ready for Claude Code — this is a real, direct generalization of an
already-fully-specified system (CVNVO's complete safety feature set),
extended with two real, comparable-grounded additions (scheduled photo
check-ins, Fake Call). The main work is extracting the existing logic
into a shared service and giving each app a clean integration point.

## Dual role confirmed — standalone app + shared infrastructure

Same pattern already established for V4 and V3: VSAFE is not only
shared infrastructure other VACO apps call into — it's also a real,
standalone, first-party app in its own right, listed in Vaco's own
App Store (see VACO_APP_STORE.md) alongside VultureFlix and other
first-party listings.

**Why this is a sound, not just convenient, decision**: the real
comparables VSAFE is built on (Noonlight, bSafe, Life360) are all
genuinely successful **standalone** safety apps with real, proven
paid-subscription demand (Noonlight's real $5-10/month premium tier
for deeper integrations). VSAFE has real, independent commercial
viability outside the VACO ecosystem, not just value as internal
plumbing.

**Practical structure**:
- **Standalone**: VSAFE is downloadable and usable on its own, the
  same way Noonlight or bSafe are — real, independent safety features
  for anyone, VACO user or not.
- **Shared infrastructure**: VACO apps (CVNVO, HVNTZ, VOID, Vault
  Studios, VACAY, VXLLAGE) call into the same underlying VSAFE service
  for their own safety features, rather than each building a separate
  system — identical to how V4 powers Shell's agent layer while also
  existing as its own app.

## Status
Ready for Claude Code — this is a real, direct generalization of an
already-fully-specified system (CVNVO's complete safety feature set),
extended with two real, comparable-grounded additions (scheduled photo
check-ins, Fake Call), and now confirmed as both a standalone App
Store listing and shared cross-app infrastructure. The main work is
extracting the existing logic into a shared service, giving each app
a clean integration point, and building the standalone app's own
independent onboarding/account flow for non-VACO users.

## Screen time / digital wellbeing feature — added to VSAFE's scope

Real, established comparables exist: Apple Screen Time, Google Digital
Wellbeing (both free, built-in, track per-app usage and pickups, allow
limits). **Real, important honest limitation**: these are documented
as "trivially easy to override" — a single tap dismisses a limit — and
real behavioral research shows 68% of deleted apps are reinstalled
within 11 days, meaning weak interventions don't produce real change.

**Real, more effective approaches worth modeling this on**:
- **TikTok's real, current feature**: a screen time dashboard plus
  genuinely stronger, harder-to-dismiss mental wellbeing prompts
  specifically for teen accounts (13-17).
- **Friction-based tools** (One Sec — forces a pause before opening;
  Repscroll — requires real physical exercise to unlock, real reported
  40-60% reduction) — effective specifically because they're harder to
  bypass than a single dismissible tap.
- **Real behavioral insight**: the most effective intervention
  understands *when and why* someone reaches for an app (boredom,
  anxiety, a specific time of day) rather than blanket time limits.

### The honest tension worth naming directly

VCoin's existing "earn rewards for time spent" mechanic is
structurally in tension with a feature meant to flag excessive time.
**Recommendation: don't resolve this by making the feature toothless.**
It should genuinely inform and protect users, even when that means
surfacing a check-in at a point where more time would have earned more
VCoin — the same principle already applied to every other safety
feature in this ecosystem (real protection over engagement metrics).

### Data model addition

```
ScreenTimeCheckIn {
  userId, appId, sessionDurationMinutes, dailyTotalMinutes
  isMinorAccount: boolean  // triggers stronger, less-dismissible
                             // prompts, per TikTok's real model
  promptShown: boolean, promptDismissalCount: number  // tracks if
    // dismissal is becoming a pattern, unlike a single-tap override
}
```

**Direct recommendation**: real transparency (showing actual time-spent
data, not hiding it) plus genuinely stronger, less-dismissible
protections for known-minor accounts specifically — the honest, real
version of this feature, not a diluted one designed to avoid tension
with VCoin's earning mechanic.

---

## Implementation status (added when this file was placed into the repo)

**Built, and one of the most complete extractions in the ecosystem.**
`vsafe/` is a real standalone service — 15 modules, 43 routes, disk
persistence, its own port (8799), its own entry in the deployment
manifest.

**The dual role this document describes is real in both directions.**
As shared infrastructure: `vsafe`'s health endpoint reports **6 source
apps**, matching the six named here. As a service others call into:
CVNVO's `firstDateSafety.js` requires injected `vsafeCreateFn` and
`vsafeConfirmFn` clients rather than reimplementing safety locally,
and its own comment records the consequence — if VSAFE has already
confirmed or escalated a check-in, that rejection propagates "rather
than CVNVO silently re-deciding safety state on its own."

That is the extraction working as intended: the source system became a
client of the shared service rather than keeping a private copy.

**Photo check-ins are real** — `schedulePhotoCheckIn()` and
`submitPhotoCheckIn()` exist, with `checkInId` linking a photo
check-in to the same underlying VSAFE record so a missed photo genuinely
escalates the real check-in via `missedCheckInAction:
"escalate-emergency"`. Trusted contacts are read back live from VSAFE
rather than re-collected, which avoids two silently diverging contact
lists for one date.

**The Fake Call and screen-time features are real** —
`cvnvo/lib/vsafeExtras.js` provides `triggerFakeCall()` and
`recordScreenTimeSession()`.

**The honest tension this document names is worth preserving
verbatim**, because it is the kind of thing that quietly disappears
from a spec: VCoin's "earn rewards for time spent" is structurally at
odds with flagging excessive screen time. The recommendation — keep
the feature protective even when that costs engagement — is the right
call and matches how every other safety decision in this ecosystem was
made (BarBuddy invisible by default, licensing gates that throw,
consent as a hard gate).

It is also not yet tested against real pressure. No revenue depends on
screen time today. The moment it does, this is the line that gets
argued about.

**QVAN vs VSAFE stayed distinct**, as insisted here. QVAN is a real
VACON agent handling platform security; VSAFE handles people in
physical situations. Neither absorbed the other.

**Genuinely unbuilt:** the Safety Network model where contacts can
view and respond *without the app installed* (Noonlight's real
differentiator — it needs an external notification path VSAFE does not
have), and the standalone consumer app's own onboarding for non-VACO
users. VSAFE today is a service with routes, reachable by sibling apps;
the paid-subscription standalone product the comparables describe is
not built.

**Real-time location sharing is listed in the source feature set and
is not implemented.** It depends on continuous location, which nothing
in this ecosystem has — see `v4-proxy/VACO_GEOFENCING_GEO_ENGINE.md`
for why that capability is bigger than it looks.
