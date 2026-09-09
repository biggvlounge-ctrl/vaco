# VACAY — Comparables (v1)

## Fee structure (real 2026 data)
| Platform | Fee |
|---|---|
| Airbnb | 15.5% flat host-only fee (already VACAY's anchor) |
| Booking.com | ~15% commission, strongest in Europe/apartments |
| Expedia/Vrbo | 8% US/Canada, 12-15% Europe — distributes one listing across Expedia/Hotels.com/Vrbo/Travelocity from one signup |

Expedia's real differentiator: it acts as merchant of record for
*both* the flight and the room, letting it discount the bundle below
the sum of its parts — a real mechanic worth considering if VACAY's
Flights + Stays tabs are meant to work together, not just sit side by
side.

## Real, common failure patterns worth designing against
Across a review analysis of the five most-installed 2026 travel apps
(Booking.com, Expedia, Hotels.com, Airbnb, Vrbo), the same three
complaint patterns dominate every platform's 1-star reviews: **(1)
host cancellations on already-confirmed stays**, often with no
comparable replacement offered at the same price; **(2) misrepresented
or unready properties** (doesn't match listing, not cleaned, broken
essentials); **(3) double-bookings from calendar sync failures** across
platforms. These are industry-wide, unsolved problems, not one
platform's mistake — worth flagging as real design opportunities for
VACAY (real-time calendar sync, a stronger host-cancellation
guarantee, photo/condition verification) rather than assuming "match
Airbnb's feature set" is sufficient.

## Experiences — already matches VACAY's own tab structure
Airbnb's real "Experiences" category (tours/workshops hosted by local
residents) is a direct, already-correct model for VACAY's existing
Experiences tab — no structural change needed, just confirms the tab
is well-conceived.

## What this means for VACAY
1. Core booking flow: anchor to Airbnb's 15.5% flat fee (already
   decided) — Booking.com's ~15% and Expedia's lower-but-region-varying
   8-15% both validate that range as the real market rate, not an
   outlier.
2. Real differentiation opportunity: solve the three industry-wide
   failure patterns above better than the incumbents do — this is a
   genuine, evidence-based product opportunity, not speculation.
3. Flights+Stays bundling (Expedia's merchant-of-record model) is
   worth considering as a real mechanic if VACAY wants its tabs to
   functionally connect, not just co-exist.

---

## Implementation status (added when this file was placed into the repo)

**The structural recommendations are already in place.** VACAY is one
consolidated app (Stays, Experiences, Auto, Homes, Flights), Booking.com
is folded into Stays via `hostType` rather than existing as a separate
integration, Experiences is its own real surface, and Flights was built
on the Expedia merchant-of-record model this document points at. The
fee anchor is settled.

**The interesting part of this document is the second section, and it
is the part with the least code behind it.** The three failure patterns
are named as design opportunities; here is where each actually stands.

**1. Host cancellations on confirmed stays — partially addressed, and
the existing work shows the right shape.** `vacay/lib/auto/rentals.js`
implements a real cancellation policy: `CANCELLATION_CUTOFF_HOURS = 24`
with real refund eligibility, modelled on Turo's actual free-
cancellation window. That is a *guest* cancelling a car.

The failure pattern this document describes is the opposite and worse:
a **host** cancelling a confirmed stay, leaving a guest with no
comparable replacement. Nothing in VACAY handles that asymmetry. The
distinction matters because the remedies are different — a guest
cancelling needs a refund rule, while a host cancelling needs a
*replacement* and a penalty, and a refund alone is precisely the
response that generates the 1-star reviews this research is citing.
The existing rentals policy is a good template for the mechanism, not
for the terms.

**2. Misrepresented or unready properties — not addressed.** No photo
or condition verification exists. Worth noting that VACA is the natural
home for this rather than VACAY: VACA already attests claims about
subjects with a real human reviewer, and "this listing's photos
represent the property" is a claim of exactly that shape. It would need
a new `subjectType` (`vacay-listing`) and nothing else structurally —
the attestation loop, the review step, and the consuming query pattern
all already exist and are already used by VOKEN, VOID, and CVNVO.

**3. Double-bookings — internal collision detection is BUILT. Only
external calendar sync is missing.**

> *Correction.* An earlier version of this section stated there was
> "no booking-collision check across VACAY's surfaces." That was
> wrong — the result of searching `vacay/lib/` at top level and
> `auto/rentals.js`, and missing the nested `bookings/` directory.
> Corrected on a later verification pass.

Overlap detection is real in **four** places, covering every bookable
surface:

| Surface | Module |
|---|---|
| Stays | `lib/bookings/bookings.js` — `intervalsOverlap()` on checkIn/checkOut |
| Experiences | `lib/bookings/experiences.js` — `findDoubleBooking()` per host |
| Auto (peer) | `lib/auto/rentals.js` — `findDoubleBooking()` per vehicle |
| Auto (fleet) | `lib/auto/fleetRentals.js` — same pattern |

Each blocks a conflicting booking at creation rather than detecting it
afterward.

**What remains genuinely open is the harder half**, and it is the half
this document's research actually describes: the 1-star reviews cite
*"double-bookings from calendar sync failures **across platforms**"* —
a host listing the same property on VACAY and Airbnb, with no iCal
feed between them. VACAY cannot collide with a booking it never sees.

That is not a defect in what exists; internal detection is a
prerequisite and it is done. It is a separate, larger piece of work
requiring iCal import/export and a reconciliation policy for conflicts
discovered after the fact.

**Recommended ordering, revised:** host-cancellation terms first
(policy decision, cheap once decided, and the failure pattern with
nothing at all behind it), then listing verification (needs VACA work
and a human review process), then external calendar sync (largest, and
only worth doing once hosts genuinely dual-list).

**On the fee anchor — one honest note.** "Airbnb 15.5% flat host-only"
is cited as validated by Booking.com and Expedia's ranges, but those
ranges describe different structures: Expedia's 8–15% is a merchant-of-
record margin, not a host fee, and comparing them directly flatters the
anchor. The anchor may well be right; the validation is weaker than it
reads.

**Nothing in this document was built in this pass**, but one of the
three failure patterns turned out to be substantially solved already —
see the correction above. Two remain genuinely open, recorded in
revised priority order.
