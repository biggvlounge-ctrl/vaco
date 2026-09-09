# CVNVO (Convo) — Data Models + API Map (v1)

Translating all eleven established dating formats, Yap, and the
safety system into buildable specs.

## Data models

```
UserProfile {
  id, prompts: [{ question, answer }]  // Hinge-model, feeds matching
  verifiedBadge: boolean
  compatibilityInputs: { ... }  // feeds the Gale-Shapley algorithm
}

Match {
  id, userAId, userBId, compatibilityScore: number  // shown transparently
  matchType: "standard" | "speed-dating" | "blind-ai" | "long-distance" | "group"
  expiresAt: timestamp  // Bumble-model expiration
  unansweredCount: number  // Your Turn Limits — new likes pause above threshold
}

ProximityEvent {  // Happn-model
  userId, otherUserId, lat, lng, timestamp
  // stored only as intersection points, not continuous location history
}

BlindDateSession {  // AI-chosen, one match at a time, photos hidden
  id, userId, aiAssignedMatchId, photosRevealed: boolean
}

SpeedDateSlot {
  id, format: "in-person" | "all-facetime"
  participants: [userId]  // 2 for standard, 3+ for group 2v1/3v1
  durationSec
}

LongDistancePin {  // Bumble Travel-model
  userId, lat, lng, isTravelPin: boolean
}

GiftDatingThreshold {
  userId, minGiftValueVCoin  // recipient-set minimum before a date request
}

DateEvent {
  id, participants: [userId]
  visibleAttendeeCount: number  // Snap Map/event-visibility layer
  huntId: string | null  // Hunts Date — ties to an HVNTZ checkpoint route
  voidRideId: string | null  // transportation tie
}

YapReport {  // decoupled — never affects Match.compatibilityScore
  id, subjectId, reporterId, flag: "green" | "red", details
}
```

## API map

- `POST /cvnvo/matches` — Gale-Shapley match generation
- `GET /cvnvo/proximity` — Happn-style nearby-crossing feed
- `POST /cvnvo/blind-date/assign` — AI assigns one match
- `POST /cvnvo/speed-date/schedule`
- `POST /cvnvo/long-distance/pin`
- `POST /cvnvo/gift-dating/request` — checked against recipient's threshold
- `POST /cvnvo/date-events` — supports `huntId` and `voidRideId` linkage
- `POST /yap/reports` — explicitly does NOT write to CVNVO's match tables

## Status
Ready for Claude Code now. Kevin (V4's dating agent) integration and the
Dating Village VDP presence are separate, already-specified cross-app
hooks, not new design work.

## Cross-references added — systems built later in this project

**VSAFE**: CVNVO's safety system (referenced throughout this document
as YapReport and the general safety architecture) is now generalized
as **VSAFE**, shared infrastructure also powering HVNTZ, VOID, Vault
Studios, and VACAY. CVNVO remains VSAFE's original source system —
this document's safety logic should be built as a call into VSAFE
rather than a CVNVO-only implementation.

**VPLAN**: Kevin's date-planning concierge role (people count, budget,
preferences → a generated plan) is now powered by **VPLAN**, a shared
AI planning engine also powering HVNTZ and VACAY. Kevin remains the
conversational interface; VPLAN is the actual planning/generation
logic underneath.

---

## Implementation status (added when this file was placed into the repo)

**Nearly all of it is built.** `cvnvo/lib/` holds nineteen real
modules, and every data model above has a counterpart:

| Model | Module |
|---|---|
| `UserProfile`, `compatibilityInputs` | `profiles.js`, `compatibility.js` |
| `Match`, `unansweredCount` (Your Turn Limits) | `matching.js` (real Gale-Shapley), `messages.js` |
| `ProximityEvent` | `proximity.js` (Happn-model, intersection points only) |
| `BlindDateSession` | `blindDate.js` |
| `SpeedDateSlot` | `speedDating.js` (both formats, real duration + extension) |
| `LongDistancePin` | `longDistance.js` |
| `GiftDatingThreshold` | `giftDating.js` |
| `DateEvent` (`huntId`, `voidRideId`) | `dateEvents.js` |
| `YapReport` | `cvnvo/yap/lib/yap.js` — separate app, separate store |

**Both cross-references at the bottom of this document were honored,
and that is worth confirming explicitly since they were the parts most
likely to be ignored.**

*VSAFE.* Safety is a real call into VSAFE, not a CVNVO-only
implementation. `firstDateSafety.js` requires `vsafeCreateFn` and
`vsafeConfirmFn`; `server.js` points them at
`VSAFE_API_URL/api/check-ins`. The comment in `confirmSafe` states the
consequence plainly: if VSAFE has already confirmed or escalated a
check-in, VSAFE rejects the call and that rejection propagates —
"rather than CVNVO silently re-deciding safety state on its own."
That is exactly the relationship this document asked for.

*Yap decoupling.* Honored, and `yap.js`'s own header cites this
document's annotation verbatim ("decoupled — never affects
Match.compatibilityScore"). Yap is a separate app with a separate
store. A report cannot silently tank someone's match visibility.

**The "We Met" loop is fully closed** — capture *and* feedback.

*Capture*: `confirmSafe(checkInId, actuallyMet, dateRating)` takes a
boolean and a 1–5 rating, folded into the existing safety check-in
rather than asked separately — precisely the design
`CVNVO_CORE_FEATURES.md` argued for. `getUserDateReliability()`
aggregates it from real confirmed check-ins.

*Feedback*: `matching.js`'s `computePreferenceList()` reads
`getUserDateReliability()` and scales each candidate's compatibility
score by a real reliability multiplier before ranking. Its own header
records that this was "computed for real but never fed back into
matching until now." So outcomes genuinely influence future matches.

Three things about that formula are worth knowing, because each is a
deliberate safeguard rather than an implementation detail:

1. **A candidate with no history gets no adjustment at all**
   (`reliabilityRate === null` → multiplier 1). Lacking data is not
   evidence of unreliability, so new users are not penalized for being
   new.
2. **It is bounded at 50–100% credit** and never zeroes a match out.
   Reliability re-ranks; it cannot make someone invisible.
3. **It uses `actuallyMet`, not `dateRating`.** Follow-through is a
   behavioral fact; a 1–5 rating is a subjective judgment about a
   person. Ranking people by other people's ratings would reintroduce
   exactly the due-process problem the Yap decoupling exists to
   prevent, through a different door. `dateRating` is captured and
   deliberately unused in matching.

A property worth naming, visible once you run it: a perfect record
yields multiplier `1.0` — the same as having no record at all. So the
mechanic is purely a **downside** adjustment. It de-ranks people who
repeatedly do not show up; it never boosts anyone above baseline.
That is arguably the right shape (reliable users are not pushed into
dominating everyone's stack), but it is a real design choice rather
than a consequence of the formula, and it should be a decision rather
than a discovery.

Verified directly: with four identical profiles differing only in
date history, preference order comes back
`newcomer > reliable > unreliable` — newcomer and reliable tie at
`1.0`, unreliable is de-ranked.

One honest limitation: `reliabilityRate` is lifetime, so someone with
early no-shows recovers slowly. A recency window would fix that and is
not built.

**VPLAN remains unbuilt** — see `cvnvo/VPLAN_AI_PLANNING_ENGINE.md`.
Kevin exists as a real VACON agent, so the conversational interface is
there; the planning logic underneath it is not.
