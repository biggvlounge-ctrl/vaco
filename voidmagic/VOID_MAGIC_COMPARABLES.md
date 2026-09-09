# VOID MAGIC — Comparables

Written to close a gap found auditing comparables coverage across the
ecosystem: VOID MAGIC is a real revenue app with a real take rate in
code and had no comparables document of its own.

**What it is:** creator meet & greets, event ticketing, a digital
waiting-room check-in flow, and paid media orders — operationally
powered by VOID's transportation and security infrastructure.

**The number that matters:** `voidmagic/lib/bookings.js` sets
`PLATFORM_TAKE_RATE = 0.155`. That is a real, enforced constant applied
to bookings, cancellations, and media orders, not an aspiration.

## Comparables

| Platform | Model | Take |
|---|---|---|
| **Cameo** | Personalized video messages from talent; the closest single analogue to paid media orders. | ~25% |
| **Fanmio** | Live virtual meet & greets with athletes and celebrities — closer to VOID MAGIC's live format than Cameo's asynchronous one. | Negotiated per talent |
| **Eventbrite** | General ticketing; the comparable for the ticketing half rather than the meet & greet half. | Service fee + payment processing, typically ~5–8% combined |
| **Ticketmaster / Live Nation** | Incumbent live-event ticketing. Not a realistic direct competitor at VOID MAGIC's scale, but it is what fans compare fee experience against. | Highly variable, widely criticized |

//: Flagged interpretive: Cameo's ~25% is the widely reported platform
//: cut and has been stable, but creator-platform economics change
//: without announcement. The durable finding is the *band* — 15–25%
//: for creator-to-fan paid interaction — not a rate sheet.

## Where 15.5% sits, honestly

**Below Cameo, above Eventbrite** — which is the right place for a
product that is neither pure ticketing nor pure asynchronous video.

The genuine argument for undercutting Cameo is not generosity, it is
that VOID MAGIC does not carry Cameo's cost structure: no separate
talent-acquisition marketing spend, because talent arrives through
Vvltvre and VOKEN, and no separate logistics or security operation,
because VOID already runs both. A platform that shares infrastructure
can charge less for the same service without losing margin. That is the
same structural argument the VOID verticals document makes about a
shared driver pool.

The corresponding risk, stated rather than glossed: 15.5% only holds if
the shared-infrastructure assumption stays true. If VOID MAGIC ever
needs its own dedicated talent acquisition or its own event staffing,
the rate was set against a cost base that no longer exists.

## What is genuinely built

Real bookings with escrow, a 15.5% take applied consistently across
bookings and media orders, real cancellations and refunds, creator
analytics, and the digital waiting room. Anderson represents this app
in VACON.

## Not covered here

Live video for the meet & greet itself. VOID MAGIC models the booking,
the payment, the waiting room, and the settlement — the actual call
depends on the real-time media infrastructure that is not built
anywhere in the ecosystem (task #106, scoped in
`dev-docs/REALTIME_MEDIA_SHARED_INFRASTRUCTURE.md`). Every comparable
above solves that with a vendor.
