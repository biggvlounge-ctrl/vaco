# Operator roles — inventory and scope

**Status: built.** `vaco-operator` (port 8820) issues and verifies
operator authority; `shared/operatorAuth.js` guards routes with it. All
**27 group-2 routes** across seven apps now demand a human operator
credential holding a specific scope, with **no service-token fallback**
— and their vaco-audit rows name a person instead of a token.

Five of §3's six questions are decided (§3.1 separate credential, §3.2
scoped never boolean, §3.3 resolved by `vaco-audit`, §3.5 grant/revoke,
§3.6 no fallback). **§3.4 — the two-person rule — is decided and built:**
`cannabisDelivery` and `medicalTransportation` require two different
operators, and nothing else does. All six questions in §3 are closed.

Audit shipped first, deliberately — see `dev-docs/DECISION_AUDIT.md`.
Task #133.

**Why this document exists.** The authorization sweep closed 103 routes
with `requireCallingService()`, which refuses a user session outright.
That was the right holding position — an operator surface with no
operator model should refuse everyone rather than accept anyone — but
it is a holding position, and holding positions rot quietly. This is
the inventory of what is being held, and what has to be decided before
any of it can be built.

Reproduce the raw list at any time:

```
grep -rn "requireCallingService()" --include=server.js --include=routes.js \
  --exclude-dir=node_modules .
```

---

## 1. The headline: 103 routes is not 103 role-holders

The single most useful thing this inventory produced is that the 103
routes fall into five groups, and **only two of them want a role at
all.** Building "an operator role" against the raw count would produce
a permission system three times larger than the problem.

| # | Group | ~Count | Wants a role? |
|---|---|---:|---|
| 1 | **Machine reports and scheduled jobs** | ~21 | **No — permanently service-only** |
| 2 | **Decisions with a loser** | ~26 | **Yes, and audited** |
| 3 | **Catalog and inventory management** | ~33 | **Yes, lower stakes** |
| 4 | **Cross-app integration** | ~10 | **No — permanently service-only** |
| 5 | **Two-sided contracts with no flow** | 2 | **No — needs a product flow, not a role** |

Counts are a first classification and approximate at the margins; a few
routes are arguable between 2 and 3. The shape is the point, not the
arithmetic.

**Roughly 60 of 103 want a role. Roughly 31 should never get one**, and
saying so now prevents someone later "finishing the job" by handing a
human the ability to post impressions or grade fantasy entries by hand.

---

## 2. The five groups

### Group 1 — Machine reports and scheduled jobs *(no role, ever)*

Nobody is at a keyboard for these. They are cron ticks, player-software
telemetry, and dispatch matching.

- `void` — `jobs/sweep-failed-deliveries`, `job/:id/match`,
  `reserve-booking/:id/match`, `commute-batch` + `/:id/match`,
  `moving-job/:id/driver` + `/helper`,
  `real-estate-media-job/:id/assign`,
  `hub-shipment/:id/fulfillment-decision`, `locker/:id/deposit`,
  `locker-to-door/:id/assign`, `business-locker/:id/load-drone`,
  `mobile-docking-vehicle/:id/location`
- `vsafe` — `check-missed`, `photo-check-ins/check-missed`
- `dreams` — `campaigns/:id/impression`, `screens/:id/offline-plays`
- `cvnvo` — `matches/generate`, `matches`
- `vaco-shell` — `merch/orders/:id/submit`, `/advance`

**A role here would be a regression.** DREAMS' impressions are the
clearest case: they are what causes money to move, reported by the
screen player. A human who could post them by hand could invoice for
plays that never happened — which is precisely the exposure the sweep
closed. The service credential is the permanent, correct answer.

### Group 2 — Decisions with a loser *(role + audit)*

Someone is worse off after each of these, and a specific person decided
it. This is the group that actually needs the work.

| App | Route | What it decides |
|---|---|---|
| `vago` | `fantasy/props/:id/resolve` | the prop's outcome |
| `vago` | `fantasy/entries/:id/grade` | whether a bet won |
| `vago` | `markets/:id/resolve` | the market's outcome |
| `vago` | `sports/events/:eventId/settle` | who won, and the payout |
| `vago` | `esports/matches/:matchId/resolve` + `/start` | same |
| `voken` | `raffle/:id/draw` | who wins the prize |
| `voken` | `application/:id/analyze` | whether someone becomes a card subject |
| `hvntz` | `ad-submission/:id/review` + `/run` | whether an ad runs, and payment |
| `hvntz` | `placement-flag/:id/resolve` | a competitor dispute |
| `hvntz` | `revenue-event` | money into a business |
| `void` | `provider/:id/vetting` | **a licence was sighted** |
| `void` | `provider/:id/skill/:verticalId/verify` | **claimed → verified** |
| `void` | `provider/:id/skill/:verticalId/suspend` | enforcement |
| `void` | `regulated-box` + `/custody-event` + `/verify-recipient` | chain of custody |
| `vulture-music` | `releases/:id/revenue` | artist/label/manager split |
| `vulture-music` | `releases/:id/distributing` + `/live` | eligibility for revenue |
| `vulture-studios` | `projects/:id/revenue` | investor distribution |
| `vulture-studios` | `projects/:id/complete` + `/distribute` + `/start-production` | project state that gates payout |
| `vaco-shell` | `store/refund` | reverses a purchase |

**VOID's three provider routes are the sharpest and should be treated
as a distinct sub-class.** They are the ones the `cannabisDelivery` and
`medicalTransportation` licensing gates depend on — `canWorkVertical`
requires a *verified* skill and `credential-verified` vetting. Whoever
holds that role can put a provider into a licensing-gated vertical.
That is closer to a regulated function than a permission bit, and it
should probably carry stricter requirements than the rest of group 2
(see §4).

### Group 3 — Catalog and inventory *(role, lower stakes)*

Staff maintain a catalog. Wrong entries are embarrassing and
occasionally expensive; they do not directly take money from a named
person.

- `void` — stations, no-fly zones, drone routes, affiliate stations,
  DSPs, lockers, docking vehicles, launchpads, external businesses,
  kitchen streams, capacity profiles, TaaS subscriptions (~20)
- `vago` — creating props, markets, sports events, esports matches (4)
- `voken` — pack tiers, raffles (2)
- `vacay` — fleet vehicles, airline inventory (2)
- `vaco-shell` — store listings, merch products (4)
- `vulture-studios` — greenlighting a project (1)

**One exception inside this group: the no-fly zone register.**
`findNoFlyViolation` consults it on every route build, so adding zones
grounds the fleet and removing them routes a drone through restricted
airspace. It is a safety register wearing catalog clothing and belongs
in group 2's audit treatment.

### Group 4 — Cross-app integration *(no role, ever)*

One app writing to another with no human in the loop.

- `vavlt-stvdios` — `map-listings` (HVNTZ owns the businessId namespace)
- `void` — `void-direct/manifest` (carries its own `apiKey` for the
  external business), `hunt-staffing` (HVNTZ → VOID)
- `voidmagic` — `notifications`
- `venvm` — the six production-pipeline routes; VENVM's principal is
  the requesting *app*, not a person

### Group 5 — Two-sided contracts *(product flow, not a role)*

- `vulture-music` — `managers/:managerId/roster`, `label-deals`

These refuse everyone because **neither party alone is safe**: a
manager-only guard lets a manager claim any artist (the 90% commission
exploit), and an artist-only guard lets an artist make a label pay them
an advance. What they need is an offer and an acceptance, not an
operator. Flagged and deliberately deferred — the product questions
(pending-offer visibility, rescind rights, revenue reported while an
offer is outstanding) are unresolved.

---

## 3. What has to be decided before anything is built

These are genuinely open. Each changes the shape of the implementation.

### 3.1 What *is* an operator? — **DECIDED: a separate credential**

> **Decision (2026-08-27): option C.** An operator is a separate,
> dedicated credential — not a Shield role, not a per-app list.
>
> Reason, in the deciding words: *keep it small and isolated, same
> principle as V3/VACON/DREAMS each being the one place for their
> concern. Don't expand Shield's remit.*
>
> This overrides the "leaning A" below, which is kept because the
> tradeoff it names is real and someone will re-propose it. Shield
> authenticates people. Making it also decide what those people may do
> would make one service the answer to two different questions, and
> this ecosystem's own structure argues the other way: V3 is the only
> place money lives, VACA the only place identity grades live,
> vaco-notify the only place alerts go. Operator authority gets the
> same treatment.

Three candidate answers, and they are not equivalent:

| Option | Shape | Cost |
|---|---|---|
| **A. A Shield role** | Shield issues sessions with a `roles: []` claim; `requireOperator('vago:settle')` checks it | Shield becomes an authorization service, not just authentication. Every app already trusts it. |
| **B. A per-app staff list** | Each app holds its own operator ids | No shared change; eight separate lists to keep correct, and no way to answer "what can this person do" |
| **C. A separate operator credential** | Distinct from both user sessions and service tokens | Cleanest separation; a third credential type to issue, rotate and revoke |

~~**Leaning A**~~ — *superseded by the decision above.* The argument
was that the alternative to a central answer is eight divergent ones,
and this ecosystem has already paid for that lesson twice
(`.env.example` drifting from the compose file; VDP holding a session
it never sent). That concern is answered by C rather than B: C is still
*one* central place, just not Shield's.

### 3.2 Per-app or ecosystem-wide? — **DECIDED: scoped, never a boolean**

> **Decision (2026-08-27): scoped permissions, `<app>:<action>`.**
> `void:vetting`, `vago:settle`, `hvntz:enforce`. There is no
> `isOperator` boolean and no wildcard `*` grant.

This follows from 3.1 rather than being a separate call. "Keep it small
and isolated" is not satisfied by one credential that opens all 27
group-2 routes — that is a master key with a smaller name. The person
who sights a cannabis licence is not the person who grades fantasy
entries, and a design that cannot express the difference will be worked
around by granting everyone everything.

Two consequences worth stating, because they are what makes the scope
real rather than decorative:

- **A grant names exactly one scope.** Holding `vago:settle` says
  nothing about `vago:grade`. Enumerated, so a typo is a startup error
  and not a silently-never-matching permission — the §5d lesson.
- **No wildcards, including for the bootstrap operator.** The
  temptation is a `*` for the first account; it would immediately
  become the account everyone uses. The bootstrap gets
  `operator:grant` and nothing else, so the first thing it must do is
  grant real scopes to real people.

### 3.3 What is audited, and where does it go? — **RESOLVED: vaco-audit**

> **Shipped (2026-08-27), ahead of this document's own subject.** A
> shared, append-only service on port 8819 that the apps write to and
> cannot rewrite. See `dev-docs/DECISION_AUDIT.md`.

The open half of this question was "each app's own store, or a shared
service?" — answered by the last line of the original text: an audit
trail is useless if the audited party can edit it. A table inside VAGO
that VAGO writes is a promise; a separate service with no `PUT`,
`PATCH` or `DELETE` is a property.

All 27 group-2 routes already record `route`, `subjectType`,
`subjectId`, `inputs`, `decidedBy` and `recordedAt`. Every row today
reads `decidedByKind: "service"`, which is the honest answer and the
reason `GET /api/coverage` exists: **`operatorCoveragePercent` is the
completion metric for the rest of this document.** It is 0% until the
work below lands, and every route migrated moves it.

### 3.4 Does any route need two people?

Some group-2 routes are large enough that a single operator acting
alone is a concentration risk:

- `void` provider vetting into a licensing-gated vertical
- `vago` settling an event with real stakes on it
- `vulture-studios` `projects/:id/revenue`
- `vaco-shell` `store/refund` above some threshold

Two-person rule (propose → approve, by different operators) is a real
mechanism and a real cost. Probably not for all of group 2; plausibly
for the licensing sub-class.

> **DECIDED (2026-08-27) and BUILT: yes, for `cannabisDelivery` and
> `medicalTransportation` only.** Nothing else in group 2.
>
> The reasoning accepted as recommended: those two are the only places
> a wrong call has consequences *outside* this ecosystem — a regulator,
> a licence, a vulnerable passenger. Everything else in group 2 is
> somebody losing money inside a system we control, which is bad and is
> recoverable. The cost — verification stalling when only one operator
> is available — is proportionate to that difference, and only to that
> difference. A two-person rule everywhere would be ignored everywhere.

**How it works.** `void/lib/twoPersonVetting.js`, and it is two *acts*
rather than two credentials on one request — one person holding two
credentials is exactly the situation the rule exists to prevent.

```
POST /api/provider/:id/skill/:verticalId/verify    void:vetting
     ordinary vertical      -> 200, verified
     licensing-gated        -> 202, proposal recorded, NOTHING verified

POST /api/provider/:id/skill/:verticalId/approve   void:vetting:approve
     a DIFFERENT operator   -> 200, now verified

POST /api/provider/:id/skill/:verticalId/withdraw  void:vetting
     stops a proposal; the proposer may withdraw their own
```

Four things worth stating because each was a way to get this wrong:

- **Which path you get is decided by the vertical, not the caller.**
  There is no flag a caller can set to take the one-operator route.
- **`void:vetting:approve` is a separate scope, not a second holder of
  `void:vetting`.** If approving were the same scope as proposing, the
  different-person check would be the only thing standing between one
  operator and both halves. This way an operator who should only ever
  counter-sign never holds the ability to originate.
- **Withdrawing needs only `void:vetting`.** Stopping something
  concentrates no authority, and requiring a quorum to *stop* a bad
  proposal would leave bad proposals open.
- **The proposal is recorded as `state-change`, not `credential`.**
  A proposal is a step toward a credential. Logging it as one would
  make the audit trail claim the vertical was opened when it was not.

**Verified live.** The test that mattered needed an operator holding
*both* scopes: refusing `ada` was the scope check doing its job, not
the rule. `grace` holds `void:vetting` and `void:vetting:approve`,
proposed, passed the scope check, and was still refused approving her
own proposal — with the vertical left `claimed`. The audit trail reads
as a pair: `state-change` by ada, then `credential` by grace carrying
`proposedBy: ada`.

### 3.5 How is a role granted and revoked? — **DECIDED**

> **Decision (2026-08-27):** granting is itself an operator action,
> gated on `operator:grant`, and **nobody may grant or revoke a scope
> for themselves** — including `operator:grant` itself.

The question answers itself once asked, which is why it was worth
asking: the route that grants roles *is* a group-2 decision, so it gets
the same treatment as the routes it protects — an operator credential,
no service fallback, and a `credential` row in vaco-audit naming who
granted what to whom.

The self-grant refusal is the VOID licensing lesson applied to the
authority system itself: *a claim may be self-service, a credential
never is.* Without it, one compromised operator escalates to every
scope in the ecosystem in a single request, and the audit log faithfully
records them doing it.

**Bootstrap.** The first operator cannot be granted by an operator, so
it comes from the environment — `VACO_OPERATOR_BOOTSTRAP` — and holds
`operator:grant` alone. It is a seed, not an admin: it cannot settle,
grade, vet or enforce anything, and the audit log shows exactly which
rows it is responsible for. If it is unset the service starts with no
operators, which is correct — an authority service that invents its own
first authority is not one.

**Revocation is immediate and is not deletion.** A revoked grant is
marked revoked, not removed, because "who could do this last March" is
precisely the question an audit answers. Verification checks the
revocation, so a credential stops working the moment it is pulled.

### 3.6 What happens to the service credential? — **DECIDED: no fallback**

> **Decision (2026-08-27): group-2 routes accept the operator
> credential ONLY.** No service-token fallback, once operator
> credentials exist.
>
> Reason, in the deciding words: *a compromised service should never
> carry operator authority.*
>
> This is the stricter of the two options and it has a cost worth
> naming: it means each group-2 route must be reachable by a human
> path, or it becomes unreachable. Any route that turns out to have no
> human caller was misfiled and belongs in group 1 or 3 — which makes
> this decision a useful forcing function on the classification rather
> than just a restriction.

Some routes are called by both kinds of caller (VOID's job matching is
dispatch software; VOID's vetting is a person) — but those are
*different routes*, and the decision above means any route that is
genuinely both was classified wrong.

---

## 4. Suggested order, if this gets built

1. **Decide §3.1 and §3.2 first.** Everything else depends on the
   shape, and both are cheap to decide and expensive to change.
2. **Audit before authorization.** Recording who did what can ship
   before roles exist and is useful immediately — today the answer to
   "who settled this event" is "a service token, we don't know which
   person."
3. **VOID's licensing sub-class first** among the routes. It is the
   smallest (6 routes), the highest consequence, and the one where the
   requirements are clearest because the gates already define them.
4. **Group 2 by app**, largest consequence first: `void` → `vago` →
   `vulture-*` → `hvntz` → `voken` → `vaco-shell`.
5. **Group 3 last**, and possibly with a coarser role — catalog
   management does not need the same ceremony as settlement.
6. **Never groups 1 and 4.** Add a note at those mount points saying
   so, or someone will eventually "finish" them.

---

## 5. What this is not

Not a design. §3 is six unanswered questions, and answering them is the
next piece of work, not this one. The value here is the classification:
**~60 routes want a role, ~31 must never have one, and 2 want a product
flow instead** — which is a materially smaller and differently-shaped
problem than "103 routes are unreachable."

## Related

- `dev-docs/ROUTE_AUTHORIZATION_AUDIT.md` — the sweep that produced
  these routes, §§7-10 for the per-app reasoning.
- `dev-docs/STANDING_INSTRUCTION_MIDDLEWARE_COMPOSITION.md` §5a — the
  fourth guard shape, which is why these routes refuse user sessions.
- `dev-docs/STANDING_INSTRUCTION_TEST_VERIFICATION.md` — watch a test
  fail before trusting it. Applies to every test written from here on,
  and to the operator-role tests especially: a role check that passes
  because the test never exercised the refusal is the exact failure
  this whole area exists to prevent.
- `scripts/audit-route-guards.mjs` — the live count.
