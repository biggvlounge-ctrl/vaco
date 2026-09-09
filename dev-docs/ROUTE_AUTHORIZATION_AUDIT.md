# Route authorization audit — every mutating route, classified

**Date:** 2026-08-27 · **Method:** enumerated from source, then the
high-consequence cases were **exploited against a running instance**
rather than reasoned about. Produced by applying
`dev-docs/STANDING_INSTRUCTION_MIDDLEWARE_COMPOSITION.md` as a full
pass rather than a spot check.

The "exploited against a running instance" above is the same rule that
`dev-docs/STANDING_INSTRUCTION_TEST_VERIFICATION.md` now states for
tests generally: a guard you have not watched refuse someone is not a
guard you have verified.

---

## 0. Status — the count is now measured, not read

> **This document is no longer the source of the numbers.**
> `scripts/audit-route-guards.mjs` derives them from source on demand,
> and `--check` runs in CI demanding **zero unaccounted routes**
> so the count cannot silently rise. Run it rather than trusting the
> table below, which is a snapshot.
>
> ```
> node scripts/audit-route-guards.mjs            # summary
> node scripts/audit-route-guards.mjs --list     # every unguarded route
> node scripts/audit-route-guards.mjs --app vsafe
> ```
>
> **Where the sweep got to: 56 of 467 guarded → 417 of 467 (89%).**
> Seventeen apps are at 100% of their mutating routes: vxllage, v3,
> vacay, voken, vago, hvntz, dreams, venvm, chopz, chopz-shop, void,
> voidmagic, vavlt-stvdios and all four vulture-* apps — plus cvnvo and
> vsafe at everything except pure text classifiers that name no user.
>
> The 50 that remain are almost entirely **category A: correctly open**
> (§3.A) — `v4-proxy`'s shared reference layer, `shield`'s own
> register/login/session, and service-to-service ingest already covered
> by an app-level credential. See §6.
>
> **What remains, and why it was not in this sweep** (§6).

---

## 1. The measurement

**486 mutating routes across 30 apps. 62 carry a guard.**

*(Original figures, kept as the starting point. The script counts 467
across 31 apps — it excludes GETs consistently and finds VACAY's
router-mounted routes, which a by-hand enumeration missed.)*

That headline is deliberately alarming and deliberately incomplete — a
large share of the 424 are correctly open. What the audit is for is
separating those from the ones that are not, which no route count can
do on its own.

| App | Guarded | Unguarded | Now |
|---|---:|---:|---|
| **vxllage** | 31 | **0** | — |
| **v3** | 2 | **0** | — |
| voken | 8 | 30 | **0 open** |
| vaco-notify | 3 | 1 | 1 |
| cvnvo | 3 | 34 | **1** (a classifier) |
| vavlt-stvdios, voidmagic, vulture-* , vaca, vex | 2–3 each | 3–25 each | unchanged — §6 |
| vago | 1 | 24 | **0 open** |
| void | 0 | 99 | unchanged — §6 |
| vacay | 0 | 29 | **0 open** |
| vsafe | 0 | 28 | **2** (classifiers) |
| hvntz | 0 | 20 | **0 open** |
| v4-proxy | 0 | 18 | unchanged — §6 |
| vaco-shell | 0 | 13 | unchanged — §6 |
| dreams | 0 | 12 | **0 open** |
| venvm, chopz, chopz-shop | 0 | 8–9 | **0 open** |

---

## 2. What this pass found and fixed

Four routes were **exploitable against a live instance**, and all four
belong to one class: **the gates that are supposed to be hard to
change.** That makes them arguably worse than the money routes fixed
earlier — a compliance gate exists precisely because someone decided it
must not be casually flipped.

| Route | What an unauthenticated POST did | Now |
|---|---|---|
| `POST /api/compliance-gate/vex-brokerage` | Opened the gate holding VEX's **live trading** closed pending broker-dealer registration | 401 |
| `POST /api/compliance-gate/fractional-ownership` (VOKEN) | Opened fractional ownership, held closed on a **securities posture** | 401 |
| `POST /api/compliance-gate/influencer-culture-card-rewards` (VOKEN) | Opened a gate **explicitly held closed pending a named review** — a standing constraint | 401 |
| `POST /api/verifications/:id/approve` (VACA) | Granted **any authenticity grade under any reviewer's name**. A self-approved `A` came straight back out of `/api/authenticity-grade` | 401 |

The VACA one is the sharpest. VACA exists *because* VOKEN's
`POST /api/card/:id/value-score` used to trust whatever
`authenticityGrade` the caller put in the body — that is the opening
line of `vaca/lib/verifications.js`. An unguarded `approve` put the
trust right back where VACA was built to remove it, one hop further
along.

**Also found: the gates were already open in persisted state.**
`vex/data/store.json` had `vex-brokerage: true`. Reset to closed as
part of this pass. Worth noting because a gate that can be flipped
anonymously will eventually be found flipped, and nothing recorded who
or when.

### The fixes

- Compliance gates → `requireActor('operatorId')`. `complianceGate.js`
  already said the setter "fires only after actual broker-dealer
  registration/legal work clears, **not as a routine toggle**" — it
  cannot be a routine toggle if nobody can perform it anonymously.
- VACA approve/reject → `requireActor('reviewedBy')`. The field naming
  the decision-maker becomes the field the session must match, which
  closes `reviewedBy: "myself"` spoofing without an API change.

> ### ⚠️ Both of those fixes were insufficient, and were replaced
>
> `requireActor(<a decider field>)` proves the session belongs to
> **whoever the body names as the decider** — which any account holder
> can name as themselves. It closed *impersonating someone else* and
> left *appointing yourself* wide open. Verified live: an ordinary
> Shield account cleared `vex-brokerage` with
> `{"operatorId": "<their own id>", "cleared": true}` and got a 200.
>
> That is the same shape as VOID's licensing exploit — *a claim may be
> self-service, a credential never is* — and it read as `ok` in this
> very audit tool, because `requireActor(...)` matches the guard
> convention. It is the tool's own caveat made real: **some** middleware
> asked who was calling; it was not the right one.
>
> Swept for `requireActor(<decider field>)` across the repo and found
> **seven routes in five apps**, all now `requireOperator(<scope>)`
> with no service fallback:
>
> | Route | Was | Now |
> |---|---|---|
> | `vex` `compliance-gate/:gateName` | `requireActor('operatorId')` | `vex:compliance` |
> | `voken` `compliance-gate/:gateName` | `requireActor('operatorId')` | `voken:compliance` |
> | `vaca` `verifications/:id/approve` | `requireActor('reviewedBy')` | `vaca:verify` |
> | `vaca` `verifications/:id/reject` | `requireActor('reviewedBy')` | `vaca:verify` |
> | `vaco-notify` `subscriptions` (POST/DELETE) | `requireActor('operatorId')` | `vaco-notify:subscribe` |
> | `vacon-c` `tick` | `requireActor('operatorId')` | `vacon-c:tick` |
>
> VOKEN's gate matters most: `influencer-culture-card-rewards` is held
> closed pending a named review, and self-certification would have
> reopened it. The gates themselves were **not** relaxed — VEX's
> brokerage interlock still refuses every trade, verified after the fix.
>
> Found while answering "what is left to reach 100%", by reading the
> routes the audit called `ok` rather than the ones it called open.

Verified after: all four return 401, both gates stay `false`, and the
self-approved grade comes back `null`.

---

## 3. Classifying the remaining 424

Not a backlog of 424 bugs. Four categories, and only one is a problem.

### A. Correctly open — no guard belongs here

- **`shield`** (3) — `register`, `login`, `session`. These are how a
  session is *obtained*; requiring one is circular.
- **`v4-search`** (1), **`vaco-analytics/ingest`** (1),
  **`vaco-notify/notify`** (1) — service-to-service. No acting user
  exists. These are kept off the public listener at the deploy layer
  rather than guarded per-request.
- **`v4-proxy` maps writes** (18) — a shared reference layer, not
  user-owned data.

### B. Needs a service credential, not a user session — **CLOSED**

> **Done.** `serviceAuth` was lifted out of `v3/lib/` into
> `shared/serviceAuth.js` and now guards all five receiving apps: V3,
> `vaca`, `vacon`, `vaco-analytics`, `vaco-notify`. The env vars were
> renamed `V3_SERVICE_*` → `VACO_SERVICE_*` to match — it stopped being
> a V3 mechanism the moment a second app read the same allowlist.
> Verified live with the ecosystem booted: an outsider gets 401 from
> notify and vaca, and VSAFE's escalation still lands end to end. Kept
> below for the record.

The pattern V3 already solved with `actorOrService`. These accepted
writes from other apps with no end-user session, and accepted them
from anyone:

- **`vaca`** — `POST /api/verifications` (submit). Approve was guarded
  first; submission stayed open, so the queue could be flooded.
- **`vaco-analytics`**, **`vaco-notify`** — ingest and notify.
- **`vacon`** — `POST /api/agents/:id/invoke`.

One thing this pass turned up that the plumbing itself did not:
`.env.example` was hand-maintained and listed **16 callers against 19
real ones**. Because docker-compose marks every token `:?`, that gap
would not have appeared as a missing feature — it would have appeared
as a stack refusing to start, naming a variable the example file never
mentioned. Both blocks are generated from the same source scan now
(`generate-service-tokens.mjs --example`), and `--check` runs in CI.

### C. Should be `requireActor`, genuinely — **SWEPT**

> **Done, for every app named here.** ~190 routes across nine apps,
> each one's acting-user field read off the lib function's own
> destructured options rather than guessed. All nine are at zero
> unguarded mutating routes except two pure text classifiers in VSAFE
> and one in CVNVO, which name no user to check.
>
> It was not the mechanical job this section predicted. Two shapes were
> known going in; the sweep needed **four**, and the two new ones
> carried most of the real risk.

Routes acting on a named user's behalf. Roughly: `cvnvo` (34),
`vacay` (29), `vsafe` (28), `hvntz` (20), `dreams` (12), `chopz` +
`chopz-shop` (14), `venvm` (9), `vago` (24), `voken`'s remaining (30).

#### The four shapes

| Shape | When | Guard |
|---|---|---|
| the body names the actor | `{ userId, buyerId, sellerId, … }` | `requireActor(field)` |
| the path names the actor | `/screen-time/:userId/…` | `requireParamActor(name)` |
| the path names a **thing** | a check-in, a rental, an auction, a screen | resolve it, compare its stored owner |
| the route decides an **outcome** | settle, resolve, grade, draw, review, invoice | `requireCallingService()` — a user session is explicitly *not* sufficient |

**The fourth is the one with teeth, and it inverts the instinct.** On
`POST /api/sports/events/:id/settle`, `requireActor` would be exactly
wrong: it would confirm the caller is a real logged-in user, which is
the problem rather than the solution. A player who can settle the event
picks who won. The same shape recurs across the sweep — VAGO's five
payout routes, VOKEN's raffle draw and pack odds, HVNTZ's ad review (an
advertiser approving their own ad) and revenue events (a business
paying itself), DREAMS' impressions (an advertiser draining their own
budget into a screen they control, or a screen owner invoicing for
plays that never happened), CVNVO's batch matcher, VACAY's fleet and
airline inventory.

These stay closed to user sessions entirely until the app in question
has a real operator role. That is category D arriving early, and it is
the honest answer: an operator surface with no operator model should
refuse everyone rather than accept anyone.

#### The third shape's asymmetry

Some settlements have **two** legitimate parties and admitting only one
is worse than the exposure it removes: a renter must be able to cancel
and a vehicle owner must be able to close out a return; either side of
a match may message; either party to a call may hang up. Others have
exactly one: a stay's add-ons bill the guest, so a host must not order
a ride onto someone else's tab; a likeness consent may only be granted
and revoked by its subject.

#### Two things the sweep broke, and had to fix

**VDP had never sent its session.** It acquires a Shield session,
validates it, stores it — and no client module in `vdp/src/lib` ever
attached it to a request. All thirty posted `Content-Type` and nothing
else. This was *already* broken: vxllage has had 31 guarded routes
since its own pass, so VDP's Village district had been getting 401s the
whole time and nobody noticed. `sessionHeaders()` now exists and is
wired into 20 client modules (36 call sites).

**Every app that starts enforcing breaks its callers.** CVNVO's six
VSAFE calls had to gain the service credential in the same change or
the safety integration would have started 401ing — a failure no unit
test in either app could see, because neither sends a request. Check
the callers before mounting `serviceAuth` on a new receiver.

Two deserved naming ahead of the rest, and **both are now closed**:

- **`POST /api/check-ins/:id/emergency` (VSAFE).** ✅ Anyone could
  trigger anyone's emergency — now that escalations actually page
  people, that was a live harassment and alert-fatigue vector, and it
  got *worse* the moment the notification channel started working.
  Guarded with `requireCheckInOwner()` — an ownership lookup, not
  `requireActor`, because the body names no actor, only the check-in
  id. Verified live: anonymous 401, another user 403, the owner 200,
  an unknown id 404.

  **Deliberately not extended to trusted contacts.** A contact
  escalating on someone's behalf is a real product question — does it
  need consent, is the subject told — and guessing an answer in the
  middleware would be worse than the honest restriction. Recorded here
  as open product design rather than closed as done.
- **`POST /api/tick` (VACON-C).** ✅ The civ-sim is **paused by
  decision**; an open tick route let anyone advance it, and the engine
  makes that irreversible. Guarded with `requireActor('operatorId')`
  rather than a bare session, so the request records *who* advanced the
  world. Verified live: anonymous 401, session with no `operatorId`
  400, session naming someone else 403, the caller naming themselves
  200. VACON-C has no operator role yet (see category D) — this is the
  hook one attaches to.

### D. Admin/operator surfaces with no operator concept

`vacon-c`, parts of `void` (stations, no-fly zones, drone routes),
`dreams` advertiser onboarding. These need an operator role before a
guard means anything — a design decision, not a mechanical fix.

---

## 4. Why the count is not the metric

`void` shows 0 guarded / 99 unguarded and is the **best-tested app in
the ecosystem** (124 tests, one settlement path for 25 verticals). Its
licensing and vetting gates genuinely refuse. The unguarded count says
nothing about whether the domain logic is right — only about who can
reach it.

Conversely `vxllage` shows 31/0 and got there by fixing real holes
found in this session.

**The number to watch is not "how many routes are guarded". It is
"which requests can reach this handler, and who is allowed to be making
them" — asked route by route.** That is what this document is, and why
it lists categories rather than a percentage.

---

## 5. Recommended order

1. ~~**Extend `serviceAuth` to VACA, Analytics, Notify, VACON**~~ —
   **done.** All five receiving apps enforce; verified live.
2. ~~**VSAFE `emergency` and VACON-C `tick`**~~ — **done.** Both
   verified live against a running instance, per rule 4 of the
   middleware-composition standing instruction: send the request.
3. ~~**Category C, app by app**~~ — **done**, all nine apps, verified
   live against 33 running services.
4. **Category D** needs an operator-role decision first. The sweep
   staked out where those roles attach — every `requireCallingService()`
   marks one — and that inventory is now taken:
   **`dev-docs/OPERATOR_ROLES_SCOPE.md`**. Headline: 103 such routes,
   but only ~60 want a role. ~31 are machine reports and cross-app
   integration that must stay service-only permanently, and 2 want a
   product flow rather than an operator.

Category A needs nothing, and should be recorded as deliberate so a
future pass does not "fix" `shield/login` into unusability.

---

## 6. What is left, and why it was not in this sweep

50 mutating routes remain unguarded. They were **out of scope, not
overlooked** — the general sweep covered the nine apps §3.C named, and
`void` was then done as its own pass (§7).

| App | Open | Why it was not swept |
|---|---:|---|
| ~~`void`~~ | ~~99~~ **0** | **Done** as its own pass, read against the licensing gates — which was the right call: reading it that way produced a live exploit. See §7. |
| `v4-proxy` | 18 | Category A, deliberately: a shared reference layer, not user-owned data (§3.A). |
| ~~`voidmagic`~~ | ~~16~~ **0** | **Done.** See §8. |
| ~~`vavlt-stvdios`~~ | ~~25~~ **0** | **Done.** See §9. |
| ~~`vulture-*`~~ | ~~32~~ **0** | **Done**, and it held the sharpest money bug of the whole sweep. See §10. |
| `vaco-shell` | 13 | The launcher. Its writes are registry-shaped rather than user-owned; needs a decision about what a shell route even is before a guard means anything. |
| `shield` | 3 | Category A: register, login, session. Requiring a session to obtain one is circular. |
| the rest | 16 | Ones and twos — `vex`, `vacon`, `vaca`, `vaco-notify`, `yap`, `vacon-c`, `v4-search`. Mostly already covered by an app-level service credential. |

**Nothing named remains.** What is left is category A plus scattered
ones and twos: `v4-proxy` (18) and `shield` (3) are correctly open and
should stay that way; `vaco-shell` (13) needs a decision about what a
launcher route even is before a guard means anything; the rest are
already behind an app-level service credential.

`scripts/audit-route-guards.mjs --list` prints the current set at any
time, and `--check` in CI means the number cannot rise while nobody is
looking.


---

## 7. VOID, done against the licensing gates

The instruction was to read this pass *against* `cannabisDelivery` and
`medicalTransportation` rather than fold it into the general sweep.
That was the right call, and the reason is the first thing the pass
found.

### The gates, and where they are enforced

`licensingGated: true` on those two verticals is checked in two places:

| Where | What it does |
|---|---|
| `marketplace.requestJob` | refuses a gated vertical **outright** |
| `providerProfiles.canWorkVertical` | requires a **verified** skill and `credential-verified` vetting, not a claimed one |

The second is the one that matters long-term. `requestJob`'s blanket
refusal is explicitly temporary — *"not launch-ready without real
licensing in place"* — while `canWorkVertical` is documented as
*"exactly one place where 'may this provider work this job' is
decided"*. It is the gate that survives launch.

### It was defeatable in four unauthenticated requests

Verified against a running instance, before any change:

```
POST /api/provider                                      -> 201
POST /api/provider/:id/skill      {cannabisDelivery}    -> claimed
POST /api/provider/:id/skill/cannabisDelivery/verify    -> VERIFIED
POST /api/provider/:id/vetting
     { level: 'credential-verified',
       verifiedBy: 'me, obviously',
       referenceId: 'TOTALLY-REAL-LICENCE' }            -> 201

GET  /api/provider/:id/capabilities
     -> workable: [{ verticalId: 'cannabisDelivery', ... }]
```

A stranger, starting from nothing, made VOID's own matcher say they may
deliver cannabis — on a self-verified skill and a self-sighted licence.

`recordVetting` already refused a result with no `verifiedBy`, on the
stated grounds that *"a result nobody can be traced back to is not
evidence"*. It was accepting `verifiedBy: "me, obviously"` from an
anonymous caller. The field did exactly what its comment promised and
proved nothing.

**The only thing between that and a real dispatch was `requestJob`'s
temporary blanket refusal** — belt-and-braces by accident, not by
design. Lift it, as launching the vertical requires, and the vertical
opens onto a provider pool that certified itself.

### The rule this pass established

> **A credential is never self-service.**

Claiming a skill *is* self-service — it is an assertion, and
`canWorkVertical` treats it as one. What must never be self-service is
anything that turns a claim into a credential:

| Route | Guard |
|---|---|
| `POST /api/provider/:id/skill/:verticalId/verify` | `requireCallingService()` |
| `POST /api/provider/:id/vetting` | `requireCallingService()` |
| `POST /api/provider/:id/skill/:verticalId/suspend` | `requireCallingService()` |
| `POST /api/regulated-box` + `/custody-event` + `/verify-recipient` | `requireCallingService()` |

Suspension is on the list in both directions: a provider must not lift
their own suspension, and a rival must not be able to impose one. The
regulated-box routes are there for the same reason as `verifiedBy` — a
custody chain anyone can write an entry into is not evidence.

Verified after: the four-request exploit now stops at step 3 with a
403, `capabilities` reports `cannabisDelivery` blocked as *"requires a
verified skill, not a claimed one"*, and the same two calls **with** a
VOID operator credential still work end to end. `requestJob`'s refusal
is untouched.

### The rest of the 99

| Group | Shape |
|---|---|
| stations, no-fly zones, drone routes, DSPs, docking vehicles, launchpads, lockers | `requireCallingService()` — VOID's own network; no user session owns it |
| dispatch intelligence, sequencing, capacity fit | `requireSession()` — compute-and-return, no record read or written |
| job lifecycle | customer requests and rates; either party accepts, completes, cancels; **matching is the dispatcher's**, so a party cannot assign work to themselves |
| rides, freight, moving, media, pet care, laundry, the 25-vertical service engine | `requireActor(field)` on creation, two-party ownership lookups on settlement |
| over-cap approvals (laundry + service engine) | **customer only** — approving a bigger bill is the customer's, and the provider who weighed the load must not do it for them |

The no-fly zone register deserves its own note: `findNoFlyViolation`
consults it on every route build, so a caller who can add zones can
ground the fleet and one who can remove them can route a drone through
restricted airspace. It is a safety register, not a setting.

### One composition bug, caught before it shipped

The `serviceAuth` mount was first placed with the guard helpers, two
thirds down the file. That reads fine and is wrong: `app.use()` only
applies to routes registered *after* it, so seventy-odd routes defined
above would have skipped it silently — the `requireCallingService()`
ones refusing everyone forever, the rest accepting anonymous callers.
Nothing would have *looked* broken. Moved above every route, with the
reason recorded at the mount.


---

## 8. VOID MAGIC

17 of 17. Bookings and refunds move VCoin out of an escrow account, and
sixteen of the seventeen routes had no guard.

Two principals, and almost every route belongs to exactly one: a
**host** owns an experience and gets paid; a **customer** books it and
pays.

**Cancellation is genuinely either party's, and the refund rule is what
makes that safe** rather than merely convenient. `cancelBooking`
decides refund-vs-host-settlement from the cancellation cutoff, not
from who called it — so a customer cancelling late still settles the
host, and a host cancelling early still refunds the customer. Neither
side can pick the favourable branch by being the one to press the
button. Worth stating because "either party may cancel" would be the
wrong call on a route where the caller's identity *did* select the
payout.

**The door is the credential shape again.** `verifyIdentity` checks
what the attendee presents and marks the session `identity-verified` —
the same claimed-vs-verified line VOID's licensing pass turned on, and
it is the host's check to make. An attendee who can call it verifies
themselves. Verified live: the attendee gets 403, a stranger gets 403,
the host gets 200 and `status: identity-verified`. Same for admission.

`POST /api/notifications` is service-only. It took an arbitrary
`recipientId`, `subject` and `message` from anyone — a phishing surface
pointed at users who have money in escrow and are expecting messages
about it.

Verified against a running VOID MAGIC with V3 up:

```
create an experience    anonymous 401, attacker-as-host 403, host 201
book it                 100 VCoin into escrow
stranger completes it   403      stranger cancels it   403
                        host 1000 -> 1000, customer 900 -> 900
customer cancels        200, customer 900 -> 1000 (refunded)
verify-identity         attendee 403, stranger 403, host 200
admit                   attendee 403, host 200
notifications           user 403, service credential 201
```

The money assertions are the point: nothing moved on either refused
call, and the refund landed on the legitimate one.

### One thing deliberately left open

`completeExperience` settles every *confirmed* booking, not only
checked-in ones, so a host can complete an experience nobody attended
and collect. Guarding it with `requireExperienceHost()` is a strict
improvement over "anyone", and it is where the guard belongs — but the
underlying question (should payout require attendance? what is the
dispute path?) is product design, not authorization, and inventing an
answer in middleware would be worse than naming it here.


---

## 9. vavlt-stvdios

26 of 26. One principal for almost every route — the creator who owns
the record — and 25 of 26 let anyone act on anyone's: go live on
somebody else's channel, end their stream, post as them, price their
subscription tier.

Two deserve naming.

**Tipping.** `tipChannel` debits `tipperId` and credits a
`recipientPersonId` the body names *separately*. That is deliberate in
the lib — a channel can be a venue with several performers, and a tip
is aimed at one of them — but it means the guard has to be on the
tipper. Guarding the recipient would have let anyone spend anyone's
balance on a performer of their choosing.

**Subscription tiers.** `createTier` takes a `creatorId`, and the
subscriptions pay whoever that names.

Map listings sync from HVNTZ, which owns the businessId namespace, so
they take a service credential.

---

## 10. The vulture-\* apps, and the sharpest bug in the sweep

All four at 100%: music 13, flix 10, pods 7, studios 6.

### A stranger signed another artist to themselves and took 90%

Verified against a running instance, entirely unauthenticated:

```
POST /api/managers/<stranger>/roster
     { artistId: <victim>, commissionPercent: 0.9 }      -> 201
POST /api/releases/<id>/revenue  { amount: 1000 }        -> 201

   victim    990.01 -> 1090.01    (+100)
   stranger  1000   -> 1900       (+900)
```

`reportStreamingRevenue` looks up the artist's active management deal
and hands over the commission. Nothing checked who created the deal.
`signArtist` accepts any `commissionPercent` strictly between 0 and 1,
so 0.9 is a valid input, and a label deal does the same thing through
`applyLabelDeal`.

### Why neither party alone is a safe guard

The obvious fix — `requireParamActor('managerId')` — is wrong, and so
is the opposite:

| Guard | What it still permits |
|---|---|
| manager-only | a manager claims any artist — the exploit above |
| artist-only | an artist makes a label pay them an advance |

A two-sided contract needs an offer and an acceptance, and this app has
no such flow. So both routes are `requireCallingService()`: the deal is
recorded by the platform after both sides agreed elsewhere. That
refuses everyone rather than accepting either, which is the honest
holding position — the same call as VAGO's settlement routes.

**Open, and named rather than invented: there is no offer/accept flow.**
Building one is a product decision (does an artist see pending offers?
can a manager rescind? what happens to revenue reported while an offer
is outstanding?) and guessing at it in middleware would be worse than
the restriction.

### The rest

`reportStreamingRevenue` is the payout — it splits gross across
co-writers, applies each one's label deal, deducts the manager's
commission and settles the remainder. Service-only: an artist who could
report their own revenue could mint it.

`markDistributing` / `markLive` are the distributor's report that a
release reached the platforms, not the artist's claim — and `markLive`
is what makes a release eligible for revenue reports at all.

**Vvltvre Flix inverted the instinct the same way VAGO did.** Acquiring
an exclusive title pays the creator an acquisition fee; licensing one
pays the licensor a licence fee. `requireActor('creatorId')` would have
confirmed the payee is a real logged-in user, which is the problem:

```
POST /api/titles { creatorId: me, acquisitionFee: 999999 }
```

Both are the platform's decisions. Now 403 for any user session.

**Vvltvre Studios** is a financing app, so `reportProjectRevenue` —
which distributes to every investor by equity share — and
`greenlightProject`, which creates the project it distributes from, are
both operator surfaces. `greenlightProject` names no owner at all,
which is the signature.

### Verified after

```
sign an artist       anonymous 401, stranger 403, even the ARTIST 403
mark live            anonymous 401, distributor credential 200
report revenue       stranger 403, artist 990.01 -> 990.01 (unmoved)
                     platform 201, artist keeps all 1000
flix self-cheque     creator 403, licensor 403
flix cancel          somebody else's subscription 403
pods                 stranger creating a show as another creator 403
studios              user greenlight 403, user-forced distribution 403
```
