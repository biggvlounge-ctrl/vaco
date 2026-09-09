# VOID — All Service Verticals: Comparables & Structure (v1)

**Goal stated for this document:** every vertical should visibly show
free pickup/delivery where physical goods move, and all verticals should
"coincide" — one consistent underlying structure (request → match →
accept → complete → pay → rate, per VOID's own already-tested backend
loop), not 24 unrelated pricing schemes bolted together.

**Research depth, stated plainly:** Transportation, Pets, Laundry,
Cleaning/Handyman, and Beauty below are grounded in deep real-comparable
research (multiple sources per vertical). Everything past that point uses
the reasoned fallback explicitly authorized for this pass: a consistent
~20% platform take rate (validated below as competitive, not invented),
applied to whatever that vertical's real-world pricing unit actually is
(hourly, per-job, per-trip, flat quote), with named real comparables for
future deeper research rather than invented category structure.

---

## Deep-researched verticals

### Transportation (Ride/Black/XL/Carpool/Scoot)
Already VOID's own core — direct Uber/Lyft comparable, dispatch-matched,
per-trip pricing, surge multiplier. No change from existing build.

### Pet Care
**Real comparables: Rover, Wag, Tails.** Actual core services are **Dog
Walking, Drop-in Visits, Boarding, House Sitting, Daycare** — not
"Waste Removal/Training/Grooming" as VOID's existing sub-service list
states; those are separate specialist categories in the real market (see
correction from prior turn). Fee stacks vary widely and matter for
positioning: Rover ~31% total (20% from provider), Wag ~40% from
provider, Tails ~15% total (the worker-friendly newer entrant). **VOID's
existing 80/20 split lands at Rover's rate — solid, not class-leading.**
Free pickup/delivery: N/A (in-person/in-home service, not goods
transport).

### Laundry
**Real comparables: Poplin, Rinse.** Per-pound pricing ($1/lb standard,
$2/lb same-day), **free pickup and delivery included** (matches the
"show free pickup/delivery" requirement directly), worker payout ~75% of
charged rate. Sub-services: Standard Wash & Fold, Express/Same-Day,
Hang-Dry, Oversized-item surcharge, Dry Cleaning (separate line, per
Rinse).

### Cleaning / Handyman
**Real comparables: TaskRabbit, Handy, Thumbtack, Angi.** Three genuinely
different pricing models exist in this one category — worth picking one,
not blending: TaskRabbit (hourly, worker-set rate + 15-30% service fee),
Handy (flat-rate package pricing, ~25% commission), Thumbtack (pay-per-
lead to the pro, $15-60+ regardless of winning the job — worse for
workers, avoid this model), Angi (lead-gen + optional $30/mo membership).
**Recommend VOID follow TaskRabbit's hourly + fixed service-fee model**,
not Thumbtack's pay-per-lead — the latter charges workers even when they
don't get hired, which is a worse deal than VOID's existing tested split.
Free pickup/delivery: N/A.

### Beauty (hair/makeup/nails, in-home)
**Real comparable: Glamsquad, StyleSeat.** Per-service flat pricing
(blowout ~$60, makeup $65-90), in-home "Uber for X" dispatch model — the
closest real-world analog to VOID's own ride-dispatch UX applied to a
different service type. No subscription; per-appointment only.

---

## Remaining verticals — reasoned structure, named comparables

Per the explicit direction for this pass: consistent ~20% platform take
rate (validated above as matching Rover's rate and beating Thumbtack's
worker-hostile lead-fee model), applied to each vertical's real pricing
unit. Free pickup/delivery flagged where physical goods actually move.

| Vertical | Real-world comparable(s) | Pricing unit | Free pickup/delivery? |
|---|---|---|---|
| Freelance (writing/design/dev) | Upwork, Fiverr | Per-project or hourly | N/A |
| Tutoring | Wyzant, Varsity Tutors | Hourly | N/A |
| Freight / Moving | Dolly, Lugg, uShip | Flat quote by volume/distance | **Yes — pickup at origin, delivery at destination is the entire service** |
| Staffing (event/business temp) | Instawork, Bluecrew | Hourly + markup | N/A |
| Security (guard staffing) | **Corrected**: real on-demand marketplaces exist \u2014 Calvis (2026's top-ranked, ~$29.65/hr avg unarmed, no contracts/booking fees, live GPS shift tracking), Guardy (real App Store app, starts $25/hr, instant booking), Fast Guard (armed/unarmed, fire watch, event security) | Hourly, ~$25-30/hr avg unarmed | N/A |
| Landscaping / Lawn Care | LawnStarter, GreenPal | Per-visit flat quote | N/A |
| Personal Training / Fitness | Trainiac, Fyt | Per-session | N/A |
| Photography | Thumbtack-style project matching | Per-event flat quote | N/A |
| Event Planning | Thumbtack-style project matching | Per-event flat quote or % of budget | N/A |
| Cannabis Delivery | Eaze, Weedmaps | Per-order + delivery fee | **Yes — delivery is the product. ⚠️ Licensing-gated, see VOID's own existing flag** |
| Medical Transportation | Roundtrip, ModivCare | Per-trip fee | **Yes — this vertical IS transport.** ⚠️ Licensing-gated (DOT/medical), see VOID's own existing flag |
| Senior Care / Elder Care | Care.com, Honor | Hourly, higher vetting tier | N/A |
| Childcare / Babysitting | Care.com, UrbanSitter | Hourly | N/A |
| Auto Repair / Detailing | YourMechanic, Spiffy | Per-service flat quote | **Yes, if mobile/at-location — most of this category comes to the customer** |
| Notary / Legal Documents | Notarize, NotaryCam | Flat per-document fee | N/A (increasingly remote/online, not physical) |
| IT / Tech Support | Puls, Geek Squad | Flat per-service fee | N/A (or "yes" if device drop-off/pickup is offered) |
| Waste Removal / Junk Hauling | 1-800-GOT-JUNK, LoadUp | Volume-based quote | **Yes — pickup and haul-away is the entire service** |
| Courier / Same-day delivery | Roadie, Postmates-style | Per-delivery flat + distance | **Yes — this is the product** |

---

## Fulfillment — VOID as the shared delivery backend for ecosystem commerce

Distinct from the 18+ consumer-facing verticals above: VOID's driver pool
also serves as the **shared last-mile fulfillment layer** for other apps'
commerce, not just VOID's own requests.

- **CHOPZ SHOP** — already flagged in CHOPZ's own brief: its checkout
  flow has a `voidClient.createShipment()` stub specifically so wiring
  real VOID logistics in later is a one-function change, not a rebuild.
- **VENVS Marketplace** — VENVS's analog-mode commerce (its Facebook
  Marketplace/Amazon-style side) should route physical-good deliveries
  through this same layer. Not yet connected anywhere in VENVS's own
  documentation — this is the new piece to add.

**Mechanically:** one dispatch pool, mixed job types. A driver can be
offered a package-delivery job (from CHOPZ SHOP or VENVS Marketplace) or
a passenger/service job (any of the 18+ verticals above) from the same
queue, through the exact same request → match → accept → complete → pay
→ rate loop already built and tested — not a separate delivery-only
driver pool. This is the same "call the shared service, don't rebuild it"
principle already applied to V3 (money), V4 (AI), and DREAMS (ad
infrastructure), now applied to physical fulfillment.

**Courier/Same-day delivery** (already listed above with Roadie/
Postmates-style comparables) is the closest existing VOID vertical to
this — the difference is that vertical is a consumer requesting a
delivery directly through VOID's own UI, while Fulfillment is other apps'
checkout flows calling into VOID programmatically. Same underlying
mechanism, different entry point.

Every vertical above, regardless of pricing unit, runs through the exact
same backend loop VOID has already built and tested end-to-end: request
→ match → accept → complete → pay → rate. That's the actual mechanism
that makes 18+ verticals feel like one platform rather than 18 bolted-on
apps — the same reason Rover/Wag/TaskRabbit/Thumbtack all *feel*
different from each other despite technically doing similar things: they
each reinvented their own loop. VOID's real structural advantage is not
having to.

**Two items flagged as needing resolution, not left ambiguous:**
1. Whichever verticals move physical goods (Freight, Cannabis Delivery,
   Medical Transportation, Waste Removal, Courier) should have
   "free pickup and delivery" as a headline feature in the UI, the same
   way Laundry already does — this is the specific ask from this
   conversation and it's a real differentiator worth surfacing, not
   burying in fine print.
2. Cannabis Delivery and Medical Transportation remain licensing-gated
   per VOID's own existing brief — nothing above changes that; both are
   included in this structure for completeness, not as a green light to
   launch them before licensing is real.

## Correction: Security is a real, researched vertical, not a fallback
Earlier research in this project understated Security — real on-demand
guard-booking marketplaces exist and are thriving in 2026: Calvis (top-
ranked, no-contract, ~$29.65/hr avg for unarmed coverage, live GPS shift
tracking), Guardy (App Store, $25/hr+, instant booking), and Fast Guard
(armed/unarmed guards, fire watch, event security, regional). One useful
category distinction from Calvis's own buyer's guide: **customer booking
platforms** (Calvis, Guardy — you book directly) are structurally
different from **agency-management software** (TrackTik, Belfry,
Silvertrac — internal tools security companies use, not something an
end customer books through). VOID's Security vertical should model the
former, not the latter. Notably, **live GPS shift tracking is the exact
same mechanic VOID already uses for trip tracking** — this vertical
reuses existing VOID infrastructure more directly than most others.

## Freelance and Staffing — deepened research (real 2026 data)

### Freelance (Fiverr-style service marketplace)
- **Fiverr**: a flat 20% commission on all seller earnings — no tiers,
  no volume discount — one of the highest flat-commission models in the
  industry, plus an additional ~5.5% buyer-side fee. Project/gig-based
  pricing, not hourly. Payment holds up to 14 days for newer sellers.
- **Upwork**: variable 0-15% freelancer fee (most freelancers experience
  an effective rate around 10-12%), but **also charges for the act of
  bidding** — "Connects" cost $0.15 each, with most proposals costing
  2-16 Connects. Submitting 50 proposals can cost $15-$120 before
  earning a single dollar.
- **Recommendation for VOID's Freelance vertical**: avoid Upwork's
  pay-to-bid model — same principle as already avoiding Thumbtack's
  pay-per-lead in the Cleaning/Handyman vertical, since both charge
  workers for the *chance* at a job rather than only on completed work.
  A flat, transparent take rate with no cost to apply is the more
  worker-friendly, competitive position.

### Staffing (event/business temp staff)
- **Instawork's real model**: workers browse open short-term shifts
  (hospitality, warehousing, retail, events), apply directly in the app,
  and get paid after the shift completes. This maps directly onto VOID's
  existing request → match → accept → complete → pay → rate loop — no
  new mechanic needed, just this vertical's specific job type (a shift,
  not a delivery or ride) running through the same infrastructure.

---

## Coverage audit — all 25 verticals, checked against the code

Added after auditing this document against `void/lib/verticals.js`
rather than against its own table of contents. The audit found a real
gap and one false alarm, both recorded below.

**The document was written when VOID had 24 verticals** (its own
opening paragraph says "24 unrelated pricing schemes"). The code now
defines 25. Two were never covered here:

| Vertical | Status found |
|---|---|
| `realEstateMedia` | **False alarm.** Genuinely covered, in a different file — `VOID_MOVING_REAL_ESTATE_MEDIA.md` names **HomeJab** as the real comparable, with automated match rather than bidding. It was simply never cross-referenced from here, so an audit of this file alone reports it missing. Cross-referenced now. |
| `foodDelivery` | **Real gap.** `VOID_MEITUAN_MODEL_INTEGRATION.md` covers Meituan as a *super-app structural* model — dispatch, drone, station strategy — which is a different question from what a US food/grocery delivery vertical competes against on price and take rate. Filled in below. |

Every other vertical is covered: five deep-researched
(Transportation, Pet Care, Laundry, Cleaning/Handyman, Beauty), three
researched later in this file (Security, Freelance, Staffing), and the
remainder in the named-comparables table.

### Food / Grocery Delivery — the vertical that was missing

The largest and most competitive category VOID enters, and the one
where a ~20% take rate needs the most defending, because the
incumbents' economics are public and contested.

| Comparable | Model |
|---|---|
| **DoorDash** | Tiered restaurant commissions — roughly 15% / 25% / 30% depending on the plan a merchant selects, with higher tiers buying broader delivery radius and promotional placement. US market leader. |
| **Uber Eats** | Comparable tiered structure in the same ~15–30% band, bundled with Uber's rider network. |
| **Grubhub** | Similar range, historically with more negotiated per-merchant deals. |
| **Instacart** | Different shape — grocery rather than restaurant: retailer-side fees plus consumer service fees and optional membership, not a single merchant commission. |

//: Flagged interpretive: these commission bands are the widely
//: published structure rather than a rate sheet read this week. They
//: move, and they are exactly the kind of number a competitor changes
//: without announcing. Treat the *shape* — tiered merchant commission,
//: 15–30%, with placement sold at the higher tiers — as the durable
//: finding, and re-verify the specific percentages before any pricing
//: decision depends on them.

**What this means for VOID's flat ~20%.** In every other vertical in
this document, 20% is competitive or generous. Here it sits in the
middle of the incumbent band — which is the honest read, not a
disadvantage to explain away. The real difference is structural rather
than a lower number:

- **No tier tax.** DoorDash's model charges a merchant more for the
  visibility that makes the platform useful to them. A flat rate with
  no paid-placement tier is the same worker- and merchant-friendly
  position this document already took against Thumbtack's pay-per-lead
  and Upwork's pay-to-bid. That is a consistent stance across three
  verticals now, not an ad-hoc pitch.
- **Shared driver pool.** The incumbents run food-only fleets. VOID's
  dispatch already mixes job types, so a food order and a laundry
  pickup and a courier run come from one queue. That is a genuine
  utilization advantage — the same argument the Fulfillment section
  above makes — and it is the part of the economics that a competitor
  cannot match by changing a percentage.

**Pricing unit:** per-order commission plus a delivery fee.
**Free pickup/delivery:** delivery *is* the product, same as Courier
and Cannabis Delivery.

**Not licensing-gated**, but food handling carries real local health
and food-safety requirements that vary by jurisdiction. That is an
operational compliance matter rather than a launch gate like cannabis
or medical transport, and it is not currently modeled anywhere in
`lib/verticals.js`. Flagged, not silently assumed away.

### Cross-references — where the other verticals' depth actually lives

This file is not the only place VOID comparables are recorded, which is
what made the audit above necessary. Related research:

- `VOID_MOVING_REAL_ESTATE_MEDIA.md` — **HomeJab** (real estate media),
  **GoShare** and **Dolly** (moving).
- `VOID_MEITUAN_MODEL_INTEGRATION.md` — Meituan's super-app and drone
  model; structural rather than per-vertical pricing.
- `VOID_AMAZON_LOGISTICS_INTEGRATION.md`, `VOID_FOOD_CAPABLE_STATIONS.md`,
  `VOID_HUB_WALKUP_ORIGINATION.md` — fulfillment and station strategy.

**Keeping this from drifting again:** `void/test/licensingGates.test.js`
pins the vertical table itself — every vertical must declare
`licensingGated` explicitly, so a vertical added without it fails a
test. There is no equivalent test that a new vertical arrives with a
comparable, because that is a research obligation rather than a code
invariant. The audit above is the manual check; run it against
`lib/verticals.js` whenever a vertical is added.
