# VOID — Getting Every Service App to Par

Written to answer a direct question: what does it actually take to get
all 25 verticals to the standard of the best app in each category?

This is the honest version, including the parts that are large.

**13 Nov 2026 correction (doc-vs-code reconciliation pass):** checked
directly against `lib/verticals.js` — the registry now holds **26**,
not 25. The archetype breakdown below actually only ever buckets
**23** of them by name (counted directly: 7+4+5+4 across the four
archetypes, minus 2 verticals — `freightMoving`, `eventPlanning` —
each named in two archetypes) plus the 2 licensing-gated verticals
this document never names (`cannabisDelivery`,
`medicalTransportation`, kept out of the archetype framing for a
different, deliberate reason — see `CLAUDE.md`'s "Decisions" section)
= 25, which was accurate when written. `voidDrop` (Phase 18, after
this document was written) is the 26th and is not in that count at
all — a real registered vertical, but a structurally different one
(asset rental/deployment, not a person-to-person booking), which is
why it doesn't fit the archetype framing either.

## The finding that came out of asking

Auditing the verticals against their comparables surfaced something
that was not on any list, and it was live:

> **A stranger could register, claim `childcare`, and be eligible to
> watch a child.** `canWorkVertical` returned `allowed: true`.

Vetting only existed for the two licensing-gated verticals. Everything
else accepted a claim. Care.com, UrbanSitter, and Honor all gate on
background checks, and the reason is not competitive parity.

**Fixed in this pass** — `lib/serviceCommon.js` adds four vetting
levels, per-vertical requirements, expiry, and revocation, checked
inside `canWorkVertical` so no new service app can forget it. Backed by
22 tests.

That is the pattern to expect from the rest of this work: the gaps that
matter are not missing screens, they are missing gates.

## The good news: 25 verticals are not 25 problems

Writing pet care and laundry back to back made the shape obvious. They
are not two bespoke apps — they are two **archetypes** over shared
primitives. Sorting all 25 gives five:

### A. Relationship & recurrence — *pet care, tutoring, personal training, senior care, childcare, cleaning, landscaping*

The customer wants **the same person** again. The product is the
rebooking, not the booking.

Needs: a subject record (a pet, a student, a property), a
meet-and-greet or intro session, recurring schedules, a preferred-
provider list. **Pet care is built and is the reference.**

### B. Round trip with work in the middle — *laundry, auto repair, waste removal, freight/moving*

The pickup and the delivery **are** the service. Price is often
unknown until the item is assessed.

Needs: two legs, an estimate that becomes a real total at intake, a
customer-set cap, condition notes. **Laundry is built and is the
reference.**

### C. Appointment with a specialist — *beauty, photography, event planning, notary, IT support*

A slot with a named person, often at a fixed price, where the
cancellation policy is the commercial mechanism.

Needs: service menus, portfolios, deposits, cancellation windows.
*Cancellation is built in `serviceCommon.js`; the rest is not.*

### D. Quote first — *freight/moving, event planning, freelance, real estate media*

Work cannot be priced from a form. Someone must assess and quote.

Needs: request → survey → quote → accept → schedule.
**`realEstateMedia.js` and `movingServices.js` partly cover this.**

### E. Shift & dispatch — *transportation, courier, food delivery, staffing, security*

No relationship, no quote. Volume, speed, and utilisation.

Needs: real-time dispatch, batching, surge. **This is what VOID was
already built for** — `dispatchIntelligence.js`, `droneRouting.js`,
`sequencing.js`, `staffing.js`.

## So the real remaining work

| | Status |
|---|---|
| Archetype A | 1 of 7 built (pet care). **6 remain.** |
| Archetype B | 1 of 4 built (laundry). **3 remain.** |
| Archetype C | 0 of 5 built. Shared primitives partly there. |
| Archetype D | 2 of 4 partly built. |
| Archetype E | Largely built — this was VOID's original scope. |

**Roughly 15 domain modules remain**, not 21, because each archetype's
second module is substantially cheaper than its first. Pet care took
the longest of any so far; the next Archetype A vertical should be a
fraction of it, because the primitives now exist.

### Honest effort, per module

Each is a focused session: domain records, the lifecycle, the one trust
gate that makes the vertical work, and its tests. Pet care plus laundry
plus the shared primitives came to roughly 1,300 lines of module code
and 80 tests. Fifteen more at declining cost is real work measured in
sessions, not hours — and it is genuinely parallelisable, because the
archetype primitives are now shared.

## The three things that block "best in category" regardless

These are not per-vertical and no amount of domain modules fixes them.

~~**1. No provider-facing frontend.**~~ — **built.** The service-day
plan is now the first screen at `localhost:8793`, built on the shared
VACO design system. The point stands and was the reason to build it:
Rover, Instawork, and Uber are all *apps*, and a provider will not adopt
an API. What exists is a working provider surface, not a finished
product — there is no mobile client, no push, and no offline mode, all
of which a real gig app needs.

**2. Straight-line travel estimates.** Good enough to reject an
infeasible plan; not good enough to promise a customer an arrival time.
Every dispatch comparable routes against real road data.

~~**3. Domain bookings do not settle through V3.**~~ — **resolved.**
Checked directly against the real code (13 Nov 2026, during a
doc-vs-code reconciliation pass): both named reference
implementations, `petCare.js` and `laundry.js`, already import and
call `settleJob`/`settleOnce` from the shared `settlement.js`/
`settleOnce.js` modules — the same real marketplace-and-V3 payout path
every other vertical settles through, not a separate scheduling-only
record. This item was real when first written and has since been
closed; it was left listed as "the highest-value single item
remaining" after the fix landed, which this correction fixes.

## What I would do next, in order

~~1. **Join domain bookings to marketplace jobs and V3 settlement.**
   Contained, and it turns everything already built into a working
   business. Nothing else should come first.~~ — **done** (see
   "The three things that block" section above, corrected 13 Nov
   2026: both named reference modules settle through V3 via
   `settlement.js`'s `settleJob`). This item was left at the top of
   this list after that fix landed — this same reconciliation pass
   corrects it here too, not just above.
1. **Second Archetype A module — cleaning or landscaping.** Proves the
   primitives generalise and makes modules 3–7 cheap.
~~2. **A provider frontend, service day first.** One screen: today's
   plan, earnings, what a new skill would add.~~ — **done**, same as
   item 1 of "The three things that block" above: the service-day plan
   is the first screen at `localhost:8793`. Also left stale here after
   that fix landed; corrected in this same pass.
2. **The remaining 13 domain modules**, cheapest archetype first.
3. **Real road routing** — a vendor decision, not a code one.

## What "at par" honestly means

For Archetype E — dispatch, courier, staffing — VOID is close now, and
the cross-vertical workday is something no comparable has.

For Archetypes A through D, the gap is real. Rover has a decade of
product iteration in pet care alone. **The realistic goal is not
matching Rover feature-for-feature in every one of 25 categories** —
nobody has ever done that, and attempting it uniformly is how this
stalls.

The defensible goal is: **the trust gate and the core loop are right in
every vertical, and the cross-vertical day is something none of them
can offer.** A dog owner picks Rover for depth; a provider picks VOID
because it is the only place their Tuesday is a full day of work
instead of three apps and four unpaid hours of gaps.

That is a winnable position. Feature parity across 25 categories is
not.
