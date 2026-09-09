# VOID — Service Apps and the Workday

The document that explains why VOID is shaped the way it is: twenty-five
service apps, one provider, one day.

## The idea

Every gig platform makes you one thing. Rover makes you a dog walker.
Uber makes you a driver. TaskRabbit makes you a Tasker in whichever
categories it approved. A person doing all three is running three
apps that do not know about each other, and the hours between jobs —
the gaps, the driving, the waiting — are unpaid and invisible to
everyone including them.

VOID holds twenty-five verticals and **one provider pool**. That makes
it possible to answer a question none of those platforms can:

> Given what I can do, where I am, and when I am free — what does a
> full day look like?

A dog walk at 9. Two laundry pickups at 11. A courier run at 2. One
schedule, one payout, one app.

That is not a feature bolted onto a marketplace. It is the reason to
build the marketplace this way rather than as twenty-five separate
businesses.

## What "service app" means here

Each vertical is its own service app **under VOID**, and both halves of
that phrase are load-bearing.

**Its own app** — its own domain, its own vocabulary, its own screens.
Pet care has pets, a walker you rebook, a standing Tuesday, and a
meet-and-greet before anyone takes your dog. Laundry has a pickup
window, a weight measured on arrival, care preferences that must reach
whoever runs the machine, and a delivery window two days out. These
have nothing in common and should not pretend to.

**Under VOID** — because three things stay shared, and giving any of
them up would give away the only real advantage:

| Shared | Why splitting it would hurt |
|---|---|
| **The provider pool** | One pool means a provider finishing a courier run takes the next dog walk. Twenty-five pools means twenty-five separate liquidity problems, and thin liquidity kills marketplaces before anything else does. |
| **Settlement (V3)** | One payout across every vertical worked. A pet care app that built its own payments is just a worse Rover. |
| **Safety (VSAFE)** | Check-ins, ID verification, and emergency escalation, already built and already used by six apps. |

It is also what makes VOID's flat ~20% defensible where Thumbtack
charges per lead and Upwork charges to bid: VOID is not running
twenty-five operations. If it starts to, that argument stops being
true.

## How it is actually built

```
lib/providerProfiles.js   who can do what, and when      ← the spine
lib/serviceDay.js         assembling a day across them   ← the idea
lib/marketplace.js        request → match → accept → complete → pay → rate
lib/verticals.js          the 25 verticals: pricing unit, take rate, gates

lib/petCare.js            ┐
lib/laundry.js            │ per-vertical domain — each its own service app
lib/staffing.js           │
lib/realEstateMedia.js    ┘
```

**Skills live on the provider, not the provider inside a vertical.**
That single decision is what makes a cross-vertical day possible at
all. Reverse it and every provider is locked to one category, and this
whole document describes something that cannot be built.

### Providers: individuals and businesses, one shape

A provider is a person or a business. `providerType` is
`'individual'` or `'business'`; a business carries a `businessName` and
a `crewSize`.

Deliberately **one shape with a type field**, not two onboarding paths.
The alternative means every vertical, every matching rule, and every
payout path carries two versions of itself forever. A laundromat, a
grooming salon, and a two-van moving company are providers.

### Skills: claimed, verified, suspended

Claiming a skill is a statement of intent. Verification is a separate
act.

For most verticals a claimed skill is enough to start working — the
friction of pre-verifying everyone is what stops supply from forming.
For the **licensing-gated** verticals (cannabis delivery, medical
transportation) a *verified* skill is required, because saying you are
licensed is not evidence that you are. Same posture as the rest of the
repo: fail hard where the law is involved, stay usable everywhere else.

`canWorkVertical()` is the one place that decision is made, so there is
exactly one function to audit rather than a rule repeated in
twenty-five modules.

### The service day

`buildServiceDay()` takes a provider, a day, and the open jobs, and
returns a feasible schedule plus **every rejection with its reason**.
"Why isn't this job in my day" is always answerable — too far, arrives
late, runs past the end, outside declared availability.

Greedy by scheduled time, deliberately. The optimal version is a
vehicle-routing problem with time windows, which VOID already
approximates elsewhere with 2-opt for drone routing. The reason not to
here is about the product rather than the maths: a provider reading
their day wants it chronological and wants to understand it. A
schedule that reorders their morning to save eight minutes is worse
than a legible one.

It also reports **utilisation** — worked minutes against worked plus
travel. Travel is unpaid on every comparable platform too. Surfacing it
is the point: a day that looks like six hours of work and is really
eight is the single most common complaint gig workers have, and it is
usually invisible until payday.

### Skill suggestions

`suggestSkillsToAdd()` compares the day a provider can build now
against the day they could build with one more skill, and reports what
that skill would have earned them **today, from real open jobs**.

This is the growth loop and the supply loop at once: the verticals that
surface are by construction the ones with unmet local demand. It never
suggests a licensing-gated vertical — recommending someone add cannabis
delivery to fill an afternoon would be recommending they work without a
licence.

## Live, as of this pass

A real provider with three skills, built from a running server:

```
09:00  Pet Care                    earns 32   travel 0m
11:00  Laundry                     earns 45   travel 1m
14:00  Courier / Same-day Delivery  earns 20   travel 2m

3 jobs across 3 verticals — one schedule, one payout
earnings 97 | worked 115m | travel 4m | utilisation 97%

+ Beauty would add 96 today
```

## The two service apps built so far

Chosen because their domains look nothing like each other. If one
module shape fits both, it fits the remaining twenty-one.

### Pet Care

Pets are first-class records — species, breed, weight, vet name and
phone, medications, behavioural notes, emergency contact. Not a
free-text note on a job, because the vet contact has to survive the
booking it was entered on.

**The meet-and-greet is a gate, not a nicety.** A first booking with a
new walker is refused until a meet-and-greet is recorded complete.
Handing a stranger a key and an animal is the highest-risk moment in
this vertical. Repeat bookings with the same walker skip it — which
makes rebooking the same person the path of least resistance, so the
retention loop and the safety mechanism are the same mechanism.

Recurring bookings are **real generated bookings**, not a rule
evaluated later, so a series is inspectable, individually cancellable,
and visible to the day planner like anything else.

### Laundry

The vertical where "free pickup and delivery" is real rather than
marketing, because the pickup and the delivery *are* the service.

**Pricing is honest about what is not yet known.** Nobody knows the
pound count until the bag is on a scale, so an order carries an
*estimate* until it is weighed and the real total is set at intake. A
customer can set `maxAcceptableTotal`, and if the weighed total exceeds
it the order is **held rather than washed**. Washing first and asking
after is how a dispute becomes a loss — and "we weighed it and it is
triple" is exactly the surprise that loses a customer permanently.

Care preferences are captured once and travel with the order. Every
real complaint in this category is a preference that never reached the
person operating the machine.

## What is not built

Stated plainly rather than left to be discovered:

- **Twenty-one verticals still have no domain module.** They transact
  correctly through the shared loop and have comparables documenting
  what each would need, but pet care and laundry are the only two with
  real domain depth. `staffing.js` and `realEstateMedia.js` predate
  this pass and are the same pattern.
- **Travel time is straight-line at an assumed speed.** Good enough to
  reject an infeasible plan, not good enough to promise a customer an
  arrival time. Real road routing is a genuine upgrade, not a tweak.
- ~~**No provider-facing frontend.**~~ — **built.** The day plan is
  now the first screen a provider opens (`public/index.html`, served at
  `localhost:8793`): the schedule in chronological order, earnings,
  every rejection with its reason, skill suggestions priced from real
  open jobs, and utilisation with unpaid travel shown against it rather
  than hidden. It is a real client of the same `/api/provider/:id/
  service-day` endpoint described above — no scheduling logic lives in
  the page.
- ~~Domain modules do not settle through V3~~ — **done.** Completing a
  service booking now moves real money: the provider is paid, the
  platform takes its vertical's rate, and both transfers go through V3
  separately so they are individually auditable. Settlement runs
  *before* the status changes, so a ledger failure leaves the booking
  uncompleted rather than complete-and-unpaid. Live-verified end to
  end: a 200 courier booking moved sam 1000→800, rider 1000→1160,
  void-platform 1000→1040.

  ~~Two remaining seams: `petCare.js` and `laundry.js` still have their
  own completion functions that do not settle~~ — **closed.** Both now
  settle, and all three paths share one implementation
  (`lib/settlement.js`) rather than three copies of the same money
  logic, which is how a take rate drifts in one place and nobody
  notices.

  Three things that had to change to make it true:
  - **Pet care bookings carried no price at all**, which is precisely
    why completion could never pay anyone. `createBooking` now requires
    one — except for a meet-and-greet, which is an introduction rather
    than a service and is genuinely free.
  - **Laundry settles the weighed total, never the estimate.** The
    estimate is explicitly not a quote, so settling it would charge a
    number the customer was told was provisional.
  - **There was no HTTP route to record vetting**, so every
    vetting-gated vertical was unreachable through the API rather than
    merely gated. The gate was correct; its other half was missing.

  Live-verified: a 40 VCoin walk moved sam 914→874, maria +32,
  void-platform +8, with the two transfers separately visible in V3's
  own transaction log.

## Where the comparables fit

Each vertical's comparables document is the specification for what its
service app needs — `dev-docs/COMPARABLES_INDEX.md` maps all of them.
Rover tells you what pet care needs. Rinse tells you what laundry
needs. LawnStarter tells you what landscaping needs.

That is why the comparables were worth writing: not as competitive
analysis, but as twenty-five product specs already in the repo.
