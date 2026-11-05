# CVNVO

The ecosystem's dating app ("Convo"). Yap, its safety-focused
report app, used to live inside this codebase as `lib/yap.js` — per
explicit instruction it's now split out into its own separate,
standalone app: `yap/` (own `package.json`, own store, own server on
port 8802), the same real split just applied to CHOPZ/CHOPZ SHOP. See
`yap/README.md`. Deliberately trust/safety-first rather than swipe-volume
first: the standing decision is to model Hinge's real, Nobel-Prize-
winning Gale-Shapley stable-matching algorithm (mutual compatibility —
who you'll like AND who's likely to like you back), not Tinder's
one-sided ELO/volume model. A large set of real, distinct dating
formats (Happn-style real-world proximity and its venue-specific
BarBuddy narrowing, Speed Dating, Long-Distance Mode, Blind Date/AI-
random pairing, Group Dating, Gift Dating, a Snap Map-style social
layer, Hunts Dates via HVNTZ) all sit on top of this same core
matching engine and CVNVO's existing First Date Safety system, not as
bolted-on parallel systems.

Source docs: `CVNVO_ARCHITECTURE.md` (data models + API map),
`CVNVO_CORE_FEATURES.md` (the real feature definition built from the
Hinge/Tinder/Bumble research), `CVNVO_DATING_COMPARABLES.md` (the real
research underlying every mechanic — Hinge, Bumble, Happn, Snap Map,
Speed Dating, Long-Distance Mode, Blind Date apps, Gift Dating, and the
"sugar dating" compliance flag), `CVNVO_BARBUDDY_FEATURE.md` (venue-
specific real-time proximity discovery, tied to HVNTZ/VSAFE/VOID).

**Scope note, read this before touching anything here**: a dedicated
`CVNVO_SAFETY_SYSTEM.md` and a full Yap specification were never
actually provided, despite being referenced throughout the four docs
above as "already established." Phase 2 built Yap and First Date
Safety anyway, honestly, from everything that actually is documented
across the four real source files — nothing about Yap's actual
moderation/review workflow is invented, since that genuinely isn't
documented anywhere. **Phase 3 update**: VSAFE (the Universal Safety
Layer `CVNVO_ARCHITECTURE.md` already said this logic should
eventually route through) now exists as its own real, standalone
project (`../vsafe/`), and `lib/firstDateSafety.js` was refactored
into a real client of it — CVNVO no longer tracks safety state
(status/timer/escalation) locally at all; VSAFE owns that, CVNVO keeps
only its own dating-specific extension data (itinerary, the "We Met"
feedback, the VOID ride link) referencing VSAFE's real check-in by id.
VPLAN is still referenced as shared infrastructure Kevin's date-
planning role should route through, but doesn't exist as code
anywhere in this repo yet. **Yap split note**: `yap/` now fetches
CVNVO's `verifiedBadge` live over HTTP via an injected
`profileFetchFn` rather than reading it in-process — the same real
cross-app pattern already established for VOID/VSAFE, just pointed the
other direction since Yap is the side that doesn't own the data.
**VACA identity note**: `verifiedBadge` itself is no longer trusted
from the client at profile-creation time — `POST /api/profiles` now
calls `../vaca/server.js` live (`fetchIdentityStatus`) and overrides
whatever the client sent with VACA's own real, reviewed identity-claim
status. See `../vaca/README.md`'s own "Real cross-app integration:
CVNVO" section.

## Run
Four processes — VACA (real identity verification on profile
creation), V3 (real VCoin for Gift Dating/Blind Date tokens), HVNTZ
(real hunt validation for Hunts Dates), and this service:
```
cd ../vaca && npm install && npm start                 # localhost:8804
cd ../venvs-mock-backend && npm install && npm start     # localhost:8791
cd ../hvntz && npm install && npm start                  # localhost:8792
cd cvnvo && npm install && npm start                      # localhost:8798
```

## Test
```
curl http://localhost:8798/api/health
curl -X POST http://localhost:8798/api/profiles -H "Content-Type: application/json" -d '{
  "userId":"alice","prompts":[{"question":"Best travel story","answer":"Got lost in Kyoto"}],
  "compatibilityInputs":{"age":28,"interests":["music","hiking"],"seekingAgeMin":25,"seekingAgeMax":35,"lat":40.0,"lng":-74.0}
}'
curl -X POST http://localhost:8798/api/matches -H "Content-Type: application/json" -d '{
  "groupAIds":["alice"],"groupBIds":["dave"]
}'
curl -X POST http://localhost:8798/api/matches/1/messages -H "Content-Type: application/json" -d '{
  "senderId":"alice","text":"hey!"
}'
curl -X POST http://localhost:8798/api/proximity -H "Content-Type: application/json" -d '{
  "userId":"alice","otherUserId":"bob","lat":38.627,"lng":-90.199,"otherLat":38.628,"otherLng":-90.199
}'
```

## What's here
- `lib/profiles.js` — **Hinge-model profiles (Phase 1)**: at least one
  real prompt with a non-empty answer is required (Hinge's real
  differentiator over Tinder's photo-only format), since prompts are
  what actually feed the compatibility algorithm meaningful signal.
- `lib/compatibility.js` — a real, deterministic, bounded [0,100]
  compatibility score: real shared-interest overlap, a real MUTUAL
  age-preference check (both directions — the literal implementation
  of "who you'll like AND who's likely to like you back"), and real
  Haversine-based proximity. No exact formula exists in any source
  doc; the weights are flagged interpretive choices.
- `lib/matching.js` — **the real Gale-Shapley matching engine**, the
  one piece the source docs themselves flag as "a genuine backend/
  algorithm build, not a UI decision." `stableMatch()` is the literal,
  textbook proposer-optimal algorithm, verified against a hand-
  computed 3x3 case with a known-correct result and independently
  re-proven stable via a direct blocking-pair check — not just
  implemented and trusted. `runGaleShapley()` derives real preference
  rankings from the real compatibility score; `generateAndCreateMatches()`
  persists real, Bumble-model-expiring Match records.
- **Yap moved to `yap/`** — see that project's own README. Originally
  built here in Phase 2 matching the architecture doc's real
  `YapReport` shape; the decoupling from matching was never just a
  comment — proven independently, adversarially: three real red-flag
  reports submitted against a matched user left
  `Match.compatibilityScore` byte-for-byte unchanged, checked directly
  before and after, both in plain Node and live (still true — Yap's
  reports still can't touch CVNVO's matching, now enforced by being in
  a different process entirely, not just a different module).
- `lib/firstDateSafety.js` — **now a real client of VSAFE (Phase 3)**,
  not a local safety-state duplicate: `createSafetyCheckIn`/
  `confirmSafe` make real, injected calls into VSAFE (mirroring this
  session's established `transferFn` pattern, wired to real live HTTP
  in `server.js`), with CVNVO keeping only its own dating-specific
  extension data (itinerary, the "We Met" feedback folded into the
  same `confirmSafe()` action per the standing decision's literal
  "one user action, two uses" wording, the VOID ride link) referencing
  VSAFE's real check-in by id. `getFullCheckInStatus()` is a real, live
  combined read — CVNVO's local data plus a genuine current fetch of
  VSAFE's own status, proven live to reflect VSAFE-side state changes,
  not a stale local copy. The VOID ride integration is unchanged and
  still genuinely live: checked against VOID's actual job model first
  (`void/lib/marketplace.js`) rather than assumed, pulling only what
  VOID's real API currently exposes (`providerId` as a real driver id,
  real job status) — VOID doesn't have pickup/dropoff/live-location
  fields on its job model yet, flagged honestly rather than papered
  over. **VSAFE's Phase 3 endpoints wired in (Phase 9)**:
  `schedulePhotoCheckIn`/`submitPhotoCheckIn` are real Photo Check-in
  integration for an existing date's own check-in, not a bare
  pass-through — the real `trustedContactIds` are read back live from
  VSAFE (`vsafeGetFn`) rather than asked of the caller a second time
  (they were already given once, when the date's check-in was
  created), and VSAFE's own `checkInId` link is passed through so a
  missed photo check-in genuinely escalates the same real
  `SafetyCheckIn` — proven live end to end (a real missed slot flipped
  the linked check-in's own status to `escalated`).
- `lib/vsafeExtras.js` — **Fake Call + Screen Time (Phase 9)**, kept
  separate from `firstDateSafety.js` on purpose: neither VSAFE feature
  is tied to a specific date's own check-in, so there's no CVNVO-side
  state to add — both are real, validated pass-throughs. CVNVO's own
  contribution is confirming the caller is a real, existing profile
  before forwarding (`triggerFakeCall`, `recordScreenTimeSession`);
  `appId` is hardcoded to `'cvnvo'`, never caller-supplied, and
  `isMinorAccount` is real-derived from the caller's own verified
  profile age rather than trusted as client input (the same instinct
  behind VACA's `verifiedBadge` fix) — in practice this always resolves
  `false` today since `createUserProfile` already enforces an 18+
  floor, flagged directly rather than silently hardcoded.
- `lib/messages.js` — **real messages + Your Turn Limits (Phase 4)**,
  Hinge's real named anti-ghosting mechanic. No message/conversation
  storage existed anywhere in this codebase before this file. Each
  message is real-screened on every send per the doc's own "AI spam/
  scam filtering runs on every conversation" -- **migrated 2026-11-05**
  from a local `messageSafety.js` duplicate (now deleted) to a real
  injected `vsafeScreenMessageFn(text)` that calls VSAFE's own open
  `POST /api/monitor/screen` (`lib/aiMonitoring.js`'s `screenContent`,
  which already generalized that exact pattern plus a real threat/
  self-harm category this app's local copy never had). `sendMessage`
  is async now and fails closed -- with VSAFE unreachable, nothing is
  stored, never a silent unscreened pass-through. Each match tracks a real
  `awaitingReplyFromUserId` (whose turn it is) and `unansweredCount`
  (how many messages have piled up waiting) — sending the awaited
  reply resets the stall and flips the turn; messaging again without
  one grows it. `isUserOverTurnLimit` counts real, distinct stalled
  conversations against `MAX_UNANSWERED_CONVERSATIONS` (a real, flagged
  3 — no source doc gives Hinge's own actual number). **Real, deliberate
  mapping onto CVNVO's own algorithmic matching**, documented directly
  in the module's own header: CVNVO has no individual swipe/like the
  way Hinge's real mechanic pauses — matches are generated in batches
  by Gale-Shapley, so `matching.js`'s own `runGaleShapley` now excludes
  an over-limit user from that round's candidate pool entirely, live,
  the real translation of "new likes pause."
- `lib/matching.js` — **the reliability signal is now wired in
  (Phase 4)**, closing the other named gap: `firstDateSafety.js`'s own
  `getUserDateReliability` was computed for real but never fed back
  into ranking until now. `computePreferenceList` scales a candidate's
  raw compatibility score by a real, bounded, flagged interpretive
  multiplier — a new candidate with no date history gets no
  adjustment at all (lacking data isn't evidence of unreliability), a
  real, known reliability rate scales between 50% credit (confirmed
  unreliable) and 100% credit (confirmed reliable), proven live in
  ranking order across three otherwise-identical candidates with
  different real track records.
- `lib/communicationControls.js` — real anonymous call-session
  tracking; no phone number field exists anywhere in its shape.
  **Deliberately still a real, local duplicate of VSAFE's own copy**,
  checked directly rather than assumed: `server.js`'s own
  `requireCallParty()` guard does a synchronous local
  `store.callSessions.find(...)` lookup, so calling VSAFE's remote
  version instead would mean rebuilding that guard as async first — a
  real architectural change, unlike the message-screening migration
  below.
- `lib/proximity.js` — **Happn-style proximity + BarBuddy + FlashNotes
  (Phase 7)**. `recordProximityEvent` only ever stores a real
  intersection point when two real coordinate pairs are genuinely
  within Happn's own real, published 250m crossing radius (reused
  Haversine, same posture as every other geo module this session) —
  storing continuous location history was never on the table.
  `getProximityFeed` is the real chronological-crossing timeline.
  FlashNotes (`sendFlashNote`) deliberately doesn't touch
  `messages.js`'s own match-scoped store — a pre-match icebreaker by
  definition. BarBuddy's own venue check-ins default
  `isVisibleToOthersAtVenue` to **false** — a real, deliberate opt-in-
  not-opt-out choice matching CVNVO's own established trust-first
  positioning. **Live HVNTZ venue validation, now real (Phase 10)**:
  HVNTZ's own server has a real `GET /api/business/:id` lookup route
  now (it didn't before — confirmed directly, not assumed still true).
  `checkInAtVenue` gained an opt-in `verifyAgainstHvntz` + injected
  `hvntzFetchFn` — deliberately **not** the default, since `venueId` is
  also VDP's Dating Village's own real, fixed, synthetic id
  (`vdp-dating-village`), never an actual HVNTZ business; forcing
  validation on every check-in would have broken that already-live
  integration. A verified venue's real HVNTZ business name is cached
  on first check-in and reused, not re-fetched every time.
- `lib/speedDating.js` — **Speed Dating + Group Dating (Phase 7)**, one
  real `SpeedDateSlot` entity for both, per the architecture doc's own
  schema (`participants` already real-supports 2 for standard, 3+ for
  group 2v1/3v1). Requires real `verifiedBadge` participants — the
  closest real, already-built proxy for the doc's own "verified
  profile photos" requirement, since `UserProfile` has no photo field
  at all. A real, one-time extension past the doc's own cited 3-minute
  default. `generateRotationSchedule` is a real, deterministic round-
  robin generator — every participant meets every other exactly once.
- `lib/giftDating.js` — **Gift Dating (Phase 7)**, built exactly as
  `CVNVO_DATING_COMPARABLES.md`'s own compliance section recommends in
  place of a "sugar dating" feature (a real, documented legal-exposure
  risk it flags directly). A real recipient-set VCoin threshold
  genuinely gates whether a date-request record is even created — the
  gift is a real, injected `transferFn` payment, not a documented
  intention.
- `lib/longDistance.js` — **Long-Distance Mode (Phase 7)**: a real
  Bumble Travel-style pin (`setLongDistancePin`), Coffee Meets Bagel's
  real "slow-dating" model as an actual daily rate limit
  (`getDailyCuratedMatch` returns the exact same real match on a
  second same-day call, reusing `matching.js`'s own reliability-aware
  ranking), and a real, flagged interpretive "closing the distance"
  roadmap — a one-directional, four-stage progression grounded in the
  doc's own language, since no exact stages are named anywhere.
- `lib/blindDate.js` — **Blind Date Mode (Phase 7)**. Per this
  session's consistent no-fake-AI stance, "AI-driven interview" isn't
  simulated — `assignBlindDate` uses the same real, deterministic,
  reliability-aware ranking as ordinary matching, one candidate at a
  time. `aiAssignedMatchId` is a real `Match` id (not a bare candidate
  id), so photo reveal genuinely gates on `messages.js`'s own real
  conversation count (`MIN_MESSAGES_BEFORE_REVEAL`) rather than a
  separate, parallel signal. The real commitment mechanic reuses
  Amata's own cited real numbers directly: a $20 `DATE_TOKEN_PRICE_VCOIN`
  and a block after `MAX_CONSECUTIVE_CANCELLATIONS = 2` — both grounded
  in the source doc's own real figures, not invented.
- `lib/dateEvents.js` — **Snap Map location privacy + location-radius
  search + Hunts Dates (Phase 7)**. Real, enforced three-tier privacy
  (`ghost-mode`/`my-friends`/`select-friends`) — "friends" is a real,
  flagged substitution for a friend graph CVNVO doesn't have, using a
  user's own active Matches instead. `getVisibleAttendeeCount` is a
  real *derived* count on `DateEvent`, a deliberate deviation from the
  architecture doc's own stored-field schema — the same "never a
  separate counter that could desync from reality" principle VXLLAGE's
  own `villageEvents.js` already established. **Real, live cross-app
  validation for Hunts Dates**: HVNTZ's real `GET /api/hunt/:huntId`
  genuinely exists — checked directly — so `linkHuntToDateEvent` calls
  it live via an injected `huntFetchFn` and stores HVNTZ's own real
  response, not just the caller's input. BarBuddy's own venue
  validation now works the same real way, opt-in (Phase 10) — see
  `lib/proximity.js`'s own entry above.
- `server.js` — a real Express API (CommonJS) wrapping the above.

## Verified
41 plain-Node checks across all three phases, plus live passes:
`cvnvo/server.js` alone confirmed 4 real profiles, a live
compatibility score correctly distinguishing a strong pair from a
near-zero one, and a real 2v2 match generation against the actual
running server — surfacing a real, illustrative small-pool
forced-pairing result (documented in `dev-docs/`, not a bug:
Gale-Shapley guarantees a *stable* matching, not that every pairing is
a *good* one). Phase 2 then ran `cvnvo/server.js` alongside VOID's own
independently running `void/server.js`: two real red-flag Yap reports
against a matched user, with the match's `compatibilityScore`
independently confirmed unchanged via live `GET`; a real VOID
transportation job created and matched to a real driver on VOID's own
server, then genuinely fetched cross-server by CVNVO via a live HTTP
call, with the real `driverId`/`voidJobStatus` confirmed attached from
VOID's actual live response — genuine, working cross-app connectivity
between two independently built services in this ecosystem, not a
stub. A follow-up pass confirmed Yap's real Tea-model additions live
too: an unverified reporter's report genuinely rejected, a verified
one genuinely accepted, and a standalone safety lookup returned with
no match required. **Phase 3** ran all three servers independently —
`cvnvo/server.js`, `vsafe/server.js`, `void/server.js` — together: a
check-in created via CVNVO's API independently confirmed to exist,
correctly tagged, on VSAFE's own server; confirmation via CVNVO's API
independently confirmed on VSAFE's server; and a double-confirmation
attempt via CVNVO's API confirmed to surface VSAFE's own real
rejection message, propagated through CVNVO rather than re-decided
locally — genuine three-service cross-app connectivity, not a stub.
See `dev-docs/` for the full record.

**VACA identity wiring**: 8 further plain-Node checks (in `vaca/`'s own
suite) plus a live pass against `vaca/server.js` and `cvnvo/server.js`
running independently — a profile created with a lying
`verifiedBadge: true` for an unclaimed user came back `false`; after
submitting and approving a real VACA identity claim for a different
user, a profile created with a lying `verifiedBadge: false` came back
`true`. `lib/profiles.js` itself is unchanged — the override happens
in `server.js`, the same layering already used for VOKEN's
`authenticityGrade` fix.

**Phase 4 (Your Turn Limits + reliability wiring)**: 24 plain-Node
checks — a first message correctly starts a stall, a second from the
same sender without a reply grows it, the awaited reply resets it and
flips whose turn it is, a non-participant and empty-text sends both
rejected, every message still real-screened (a spam pattern correctly
flagged), a user pushed to exactly the real threshold confirmed over
their limit, dropping back under it after replying to just one stalled
conversation, and — the real enforcement point — `runGaleShapley`
proven to silently exclude an over-limit user from a new match round
while still matching an eligible one. The reliability wiring proven by
ranking three otherwise-identical candidates with three different real
track records (confirmed-reliable, no-history, confirmed-unreliable)
and confirming the exact expected order.

Live, with `vaca/server.js` and `cvnvo/server.js` both running: 5 real
profiles created (through VACA's own live identity check), a real
match generated, alice messaging bob twice confirmed via live `GET` to
grow `unansweredCount` to 2 with `awaitingReplyFromUserId: "bob"`,
bob's real reply confirmed resetting it to 0 and flipping the turn;
carol stalled across exactly 3 real conversations, confirmed over her
real turn limit via `GET /api/users/carol/turn-limit-status`, and then
confirmed live-excluded from a real `POST /api/matches/generate` call
that still matched an eligible fifth user in the same request.

**Phase 7 (all eight dating-format extensions)**: 47 plain-Node checks
across all six new modules — a real crossing correctly recorded within
Happn's real radius and rejected outside it, BarBuddy's real trust-
first default and its duplicate-check-in/visibility-toggle behavior,
speed-dating's real verified-badge gate and its one-time extension
limit, a real 3-person round-robin producing exactly 3 unique pairs,
gift dating's real threshold rejection and real VCoin payout, a daily
curated match proven rate-limited to exactly one per real day, a real
4-stage roadmap correctly blocked from advancing past its final stage,
blind date's real token-gate/reveal-gate/cancellation-block sequence
proven end to end, and all three Snap Map privacy tiers proven to
correctly include or exclude a viewer, plus a real derived attendee
count and a real HVNTZ hunt-link rejecting a hunt HVNTZ itself doesn't
confirm.

Live, with `vaca`, `venvs-mock-backend`, `hvntz`, and `cvnvo` all
running together: a real crossing recorded and a genuinely-too-far
pair rejected; a `DateEvent` linked to a real HVNTZ hunt created live
on HVNTZ's own server, with the returned `huntTitle` confirmed to be
HVNTZ's own real data, not echoed input; a real 60 VCoin gift request
confirmed via V3's own live balances (dave 1000→940, carol 1000→1060);
a real blind-date token purchase confirmed via V3 (alice 1000→980), a
reveal attempt correctly rejected with 0/3 real messages, and a real
reveal succeeding once 3 real messages existed; all three location-
privacy tiers confirmed live (Ghost Mode invisible to everyone, Select
Friends visible only to the real selected viewer); and a real speed-
date creation rejected live for an unverified participant.

**Phase 8 (the VDP Dating Village)**: see `../vdp/README.md`'s own
Phase 6 entry — CVNVO's own BarBuddy check-in, proximity crossings, and
FlashNotes are the real data this district renders; the district
itself lives in VDP's own world, not here.

**Phase 9 (VSAFE's Phase 3 endpoints wired in)**: 13 plain-Node checks
(real `trustedContactIds` reuse and `checkInId` linkage on schedule,
rejecting a second photo check-in for the same date, submit forwarding
the real linked id, Fake Call/Screen Time both rejecting an unknown
userId, `appId` hardcoded, `isMinorAccount` real-derived), plus a live
pass with `vaca`, `venvs-mock-backend`, `vsafe`, and `cvnvo` all running
together: a real date `SafetyCheckIn` created, a photo check-in
scheduled against it with `trustedContactIds`/`checkInId` confirmed
correctly reused/linked on VSAFE's own server directly, a real photo
submitted and confirmed server-side, and — the full chain — a real
missed slot confirmed to genuinely flip the linked `SafetyCheckIn`'s
own status to `escalated` on VSAFE's side. A real Fake Call scheduled
for alice and confirmed transitioning to `ringing` once genuinely due;
a real screen-time session confirmed crossing the daily limit with the
same real total independently re-read from VSAFE directly.

**Phase 10 (BarBuddy's live HVNTZ venue validation)**: 6 plain-Node
checks (unverified check-in still works for a synthetic venueId,
verified check-in succeeds for a real business, the fetch is cached
not repeated on a second check-in at the same venue, an unknown
business is rejected, a missing fetch function is rejected), plus a
live pass with `venvs-mock-backend`, `hvntz`, and `cvnvo` all running
together: a real HVNTZ business registered, an unverified check-in
against VDP's own synthetic `vdp-dating-village` id confirmed
unaffected, a verified check-in against the real business confirmed
succeeding, and a verified check-in against a nonexistent business id
confirmed rejected with HVNTZ's own real 404 error propagated, not a
generic one.

## Real persistence
`lib/persistence.js` wraps `server.js`'s own store in a real file-backed
store, `data/store.json` (port 8798) — CVNVO's own real state now survives a
restart. Live-verified: created a real dating profile, killed the running
process, restarted it, and confirmed the same real state came back from a
real GET. See `dev-docs/phase-11-real-persistence/`.

## Real Yap safety signal on profile reads (Phase 12)
Closes Yap's own previously-flagged gap ("CVNVO's discovery stack
surfacing verification/Yap signals visibly" — `yap/README.md`'s own
"Not yet built"). `GET /api/profiles/:userId` now makes a real, live
fetch to Yap's own `GET /yap/summary/:subjectId` and merges the result
in as `yapSignal` — the same `fetchIdentityStatus`-style live-merge
pattern this file already used for `verifiedBadge`. Deliberately fails
soft (`yapSignal: null`), not loud: a profile read shouldn't 500 just
because Yap happens to be down. Live-verified all three real cases:
zero reports (`{totalReports:0,...}`), a real report from a genuinely
verified reporter reflected accurately (`{totalReports:1,redCount:1}`),
and a graceful `null` when Yap's own process was killed mid-test. See
`dev-docs/phase-12-yap-signal-on-profile/`.

## Real WebSocket message push (Phase 13)
Closes this file's own previously-flagged gap ("real-time messaging
UX... no WebSocket/real-time layer exists"). `lib/messageSocket.js` —
a real `ws` WebSocket server (new dependency, `ws@^8`) attached to the
same HTTP server `server.js` already listens on, no new port or
process. A client connects to `ws://.../ws/matches?matchId=<id>` and
receives a real `{type:'message', matchId, message}` frame the instant
`POST /api/matches/:id/messages` successfully stores a new message for
that match — `GET /api/matches/:id/messages` still works unchanged for
a one-time read, this is additive. Deliberately kept out of
`messages.js`'s own pure `sendMessage`: broadcasting is a real I/O side
effect, orchestrated from `server.js` the same way this codebase
already orchestrates `transferFn`/`voidFetchFn`-style side effects,
not buried inside the pure lib layer. Live-verified with a real `ws`
client: a socket subscribed to a real match received a real message
the instant it was posted, and a second socket subscribed to a
different (wrong) `matchId` correctly received nothing for that same
post — subscription scoping actually works, not just "a message
arrives eventually." See `dev-docs/phase-13-real-time-messages/`.

## Not yet built
- Yap's actual review/moderation UI and workflow, and any due-process
  mechanism for a reported user to respond — genuinely undocumented
  anywhere in the source docs, not invented here (now tracked in
  `yap/README.md`).
- Real SMS/push delivery for safety escalations — the real trigger
  logic and real recipient list are computed; actually notifying them
  is separate infrastructure.
- Kevin (V4's dating agent) and VPLAN integration — VPLAN doesn't
  exist as code anywhere in this session yet.
- ~~Real-time messaging (polled, not pushed)~~ — closed (Phase 13, see
  below): a real WebSocket layer now pushes new messages the moment
  they're sent. Read receipts/typing indicators specifically are still
  real, separate, unbuilt scope on top of that.
- Real video/audio behind Speed Dating's "all-facetime" format or
  BarBuddy's "built-in video calling" — both would reuse
  `communicationControls.js`'s own real, unmodified `startAnonymousCall`
  once a real matchId exists for a given pairing; no actual media
  pipeline exists anywhere in this ecosystem.
- A separate, real friend graph for Snap Map's own "My Friends" tier —
  a real active Match is used as the closest existing substitute.

## Snap Map test coverage (1 Nov 2026)

`lib/dateEvents.js`'s own Snap Map functions (`setLocationSharingPreference`,
`shareLocation`, `getVisibleLocationsFor`, `searchNearbyOpenUsers`) had
no test coverage anywhere in this repo, despite being a real
privacy-enforcement surface — a wrong tier here leaks a real user's
location to someone who shouldn't see it. Found and closed while
wiring VDP's own Dating Village onto these exact functions (see
`vdp/README.md`'s own matching entry). `test/dateEvents.test.js` (new,
12 tests): the real default (no stored preference is Ghost Mode, not
"visible"), each of the three tiers' real enforcement (including an
EXPIRED match not counting as "my-friends" and select-friends never
falling back to a match), the viewer never seeing their own shared
location, re-sharing updating in place rather than duplicating, the
real radius-search band, and validation. Full suite: 35/35.
Mutation-verified: breaking the select-friends list check turned
exactly the one test built to catch that leak red; restored and
reconfirmed green.

## Frontend coverage pass (30 Oct 2026)
An audit found `public/index.html` making real calls against only 8 of
this app's 59 routes — the original 3 tabs (Discover, Events, Safety)
covered profile creation/viewing, compatibility scoring, a bare-bones
event create/lookup, BarBuddy check-in, and reliability/flash-notes
reads, but entire feature areas named throughout this file's own
"What's here" section had **zero** frontend exposure. Two real,
pre-existing bugs were found and fixed along the way, and four new
tabs plus the existing Events/Safety tabs close the rest of the gap —
every field in every new call checked against the real `lib/*.js`
function it reaches, several confirmed live against a running server
with real seeded profiles, never a fabricated payload shape.
Consistently left backend-only, by design: `POST /api/matches/generate`
and `POST /api/matches` (`requireCallingService()` — a trusted-service
credential for batch matching runs), and `GET /api/health`. This
frontend has no login for a service credential and no operator role,
so those stay real backend capabilities rather than a fake "admin" UI
pretending to hold one — the same posture `void/README.md`'s own
frontend coverage pass took for VOID's dispatcher-only routes.

- **Two real bugs fixed, not just new coverage.** The Events tab's
  "Create a date event" form sent `{hostId, title, venue}` to
  `POST /api/date-events`, but `lib/dateEvents.js`'s `createDateEvent`
  only ever reads `{participants, huntId, voidRideId}` — `DateEvent`
  has no `title`/`venue` field and never did. Every real submission
  403'd (`requireListedParticipant('participants')` saw no real array
  in the body), and the lookup card below it read `e.title`/`e.venue`,
  fields that never existed on a real `DateEvent` response either.
  Both fixed to match the real shape, and the **Events** tab gained
  real RSVP (`POST /api/date-events/:id/rsvp`, which moves the real,
  live-derived `visibleAttendeeCount`) and Hunts Dates linking
  (`POST /api/date-events/:id/link-hunt`, a real, live HVNTZ hunt
  lookup — a made-up `huntId` is rejected, not stored).
- **Safety tab, extended** — eight real, previously backend-only
  routes added to the existing tab rather than a new one, since this
  is the same First Date Safety / VSAFE surface that tab already
  anchors: starting a real VSAFE check-in for a date
  (`POST /api/safety/check-ins`), its real combined live status
  (`GET .../full-status`), the real "We Met" loop — one user action,
  two uses — confirming safe with VSAFE while folding in
  `actuallyMet`/`dateRating` (`POST .../confirm-safe`), attaching a
  real VOID ride's driver/status (`POST .../void-ride`), VSAFE's
  Phase 3 Photo Check-ins linked to this same check-in
  (`POST .../photo-check-in`, `.../submit`), and the two VSAFE Extras
  pass-throughs (`POST /api/safety/fake-call`,
  `POST /api/safety/screen-time`).
- **Messages tab** — `lib/messages.js` (Your Turn Limits, real message
  screening) and `lib/communicationControls.js` (anonymous calling)
  had no frontend at all. Looks up a match's real compatibility score/
  type/expiry/unanswered count (`GET /api/matches/:id`), loads and
  sends real, screened messages (`GET`/`POST /api/matches/:id/messages`),
  checks your own real turn-limit status
  (`GET /api/users/:userId/turn-limit-status`), previews the real
  deterministic screen without sending
  (`POST /api/messages/screen`), and starts/checks/ends a real,
  phone-number-free call session (`POST /api/calls`,
  `GET /api/calls/:id`, `POST /api/calls/:id/end`).
- **Nearby tab** — the rest of `lib/proximity.js` (BarBuddy check-in
  itself stays on the Safety tab, this app's own established safety
  entry point) had no frontend at all. Records a real Happn-style
  crossing, rejected server-side past the real 250m radius, and shows
  the real chronological feed (`POST`/`GET /api/proximity`), sends a
  pre-match FlashNote (`POST /api/flash-notes`), and rounds out a
  BarBuddy session — checking out, toggling venue visibility, seeing
  who else opted in (`POST /api/barbuddy/check-out`,
  `POST /api/barbuddy/visibility`, `GET /api/barbuddy/venues/:venueId`).
- **Formats tab** — `lib/speedDating.js`, `lib/giftDating.js`,
  `lib/longDistance.js`, and `lib/blindDate.js` had no frontend at
  all, bundled into one tab the way `void/public/index.html`'s own
  Scheduling tab bundled that app's four scheduling surfaces. Speed/
  Group Dating: schedules a slot requiring every participant's real
  VACA-verified badge, views a slot, extends it once, and views a
  group slot's real round-robin rotation
  (`POST /api/speed-dates`, `GET /api/speed-dates/:id`,
  `POST /api/speed-dates/:id/extend`, `GET .../rotation`). Gift
  Dating: sets your own real minimum, sends a real-VCoin gift with a
  date request, and views requests you've received
  (`POST /api/gift-dating/threshold`, `GET .../threshold/:userId`,
  `POST /api/gift-dating/request`, `GET /api/gift-dating/requests/:userId`).
  Long-Distance Mode: sets a Bumble Travel-style pin, gets today's real
  rate-limited curated match, and views/advances the real one-
  directional closing-distance roadmap (`POST /api/long-distance/pin`,
  `GET .../pin/:userId`, `POST .../daily-match`,
  `GET .../roadmap/:matchId`, `POST .../roadmap/:matchId/advance`).
  Blind Date: buys a real 20-VCoin date token, gets an AI-ranked
  assignment, views a session, reveals photos once 3 real messages
  exist, cancels, and checks the real 2-cancellation block
  (`POST /api/blind-date/token`, `.../assign`, `GET /api/blind-date/:id`,
  `POST .../:id/reveal`, `.../:id/cancel`, `GET .../blocked/:userId`).
- **Snap Map tab** — the location-privacy half of `lib/dateEvents.js`
  (the `DateEvent`/Hunts Dates half lives on the Events tab) had no
  frontend at all. Sets the real three-tier Ghost Mode/My Friends/
  Select Friends preference, shares your latest position (never a
  trail), views who has made themselves visible to you, and searches
  a real 1–100 mile radius for a real open-for-contact count
  (`POST /api/location/sharing-preference`, `POST /api/location/share`,
  `GET /api/location/visible/:viewerId`, `GET /api/location/search`).

**One deliberate, minor omission**: `GET /api/safety/check-ins/:id`
(the plain local-only read) has no separate card — the Safety tab's
"Check-in status" card calls `.../full-status` instead, which returns
every field the plain route does plus VSAFE's own live status, so a
second, strictly-weaker card would add a route checked off without
adding a real capability.

This leaves 55 of this app's 59 routes reachable from the UI, with the
remaining four being `GET /api/health` and the two service-credential-
gated batch-matching routes named above.

## Real message-screening dedup with VSAFE (5 Nov 2026)

VSAFE's own `lib/aiMonitoring.js` had already generalized this app's
local `lib/messageSafety.js` scan (contact-solicitation patterns,
phone-number-shaped content, links, character flooding) into its real,
shared `screenContent` -- plus a real, distinct threat/self-harm
category this app's copy never had -- behind the open
`POST /api/monitor/screen`, reachable but never actually called from
here. Checked directly rather than assumed: `vsafe/README.md`'s own
"Not yet built" list named migrating both this file and
`communicationControls.js` to that real shared version, so each half
was investigated on its own merits rather than closed as one item.

**`messageSafety.js` is now gone.** `lib/messages.js`'s `sendMessage`
is async now and takes a real, injected `vsafeScreenMessageFn(text)` --
the same cross-app-call shape `server.js` already used for VSAFE's
check-ins, photo check-ins, fake calls and screen time -- backed by a
new `vsafeScreenMessage` client that calls VSAFE's real
`/api/monitor/screen`. The standalone `POST /api/messages/screen`
preview route forwards to the same client. Stored messages now carry a
real `severity` field (`'none' | 'medium' | 'high'`) VSAFE's richer
classifier returns, surfaced in the Messages tab's flagged badge.

**`communicationControls.js` stays a real, deliberate duplicate.**
`server.js`'s own `requireCallParty()` guard does a synchronous local
`store.callSessions.find(...)` lookup -- migrating the call-session
logic itself would mean rebuilding that guard as async first, a real
architectural change the message-screening half never needed.

`test/messages.test.js` (new, 5 tests; full suite 77 -> 82, all
passing): the injected fn is required rather than silently optional,
the real flagged/severity/reasons VSAFE returns are stored as-is (never
a fabricated verdict), a high-severity message is still delivered
(VSAFE flags for real human review -- this layer never silently
blocks), and Your Turn Limits tracking is untouched by the migration.
Mutation-verified: hardcoding `severity` to `'high'` regardless of
VSAFE's real answer turned the real-data test red; restored and
reconfirmed green. Live-verified against a real spawned Shield + VSAFE
+ CVNVO stack: a real Shield session sending through
`POST /api/matches/:id/messages` got real `flagged`/`severity`/
`reasons` back from VSAFE's own classifier (`whatsapp`/phone-number
text correctly flagged `medium`), and killing the VSAFE process made
the send fail closed (`fetch failed`, no message stored) rather than
silently falling back to an unscreened pass-through.
