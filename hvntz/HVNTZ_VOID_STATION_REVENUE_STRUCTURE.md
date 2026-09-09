# HVNTZ Business — VOID Station Hosting Revenue Structure (v1)

Formalizes multiple, distinct real revenue streams for any HVNTZ
business that hosts a VOID Station (drone delivery station) at their
location — connecting several already-established systems into one
clear structure.

## The real, distinct revenue streams a hosting business earns

**1. Screen scan/ad revenue** — already established DREAMS revenue
share, unchanged, per HVNTZ's standing three-revenue-stream onboarding
model.

**2. Screen DTC commission** — when a customer buys directly from the
mounted screen (per the Box-Mounted DREAMS Screen DTC system), the
hosting business earns a real commission on that sale, whether or not
it's their own product being sold.

**3. Drone station usage fee — new, worth formalizing explicitly** —
every time the drone station itself is used for *any* transaction
(pickup, drop-off, charging, relay handoff), regardless of whether it
relates to the host business's own products, the host earns a small
real usage fee. Same real principle as a vending-machine host location
earning a cut of machine revenue, or an apartment complex benefiting
from hosting a package locker.

**4. Midpoint/relay usage fee — new, worth formalizing explicitly** —
when the location is used purely as a relay/waypoint for a delivery
unrelated to the host's own business (per the Multi-Midpoint document),
the host earns a real fee for that usage too, separate from any DTC or
scan revenue.

## Data model

```
HubHostRevenueEvent {
  id, hostBusinessId, stationId
  eventType: "screen-scan" | "screen-dtc-sale" | "station-transaction" |
    "midpoint-relay-use"
  amountEarned: number  // VCoin or real currency, per event type
  relatedOrderId: string | null  // populated for DTC/transaction events
}
```

## Why this matters — the real incentive structure

This is what makes hosting a VOID Station genuinely attractive to a
business beyond just their own DTC sales: **multiple, independent
revenue streams from the same physical footprint**, several of which
don't even require the business to sell anything themselves. This
directly strengthens the existing Affiliate Network recruitment
strategy (prioritizing HVNTZ-onboarded businesses first) — real,
compounding financial reasons to opt in, not just the existing
relationship.

## Direct-to-consumer becomes genuinely compelling with drone fulfillment

Confirming the real strategic point: for VENVS sellers, CHOPZ sellers,
and HVNTZ businesses themselves, direct-to-consumer sales become
dramatically more compelling once drone delivery is real and fast at
these hosted locations — the gap between "I want it" and "it's in my
hands" shrinks to minutes, the same real value proposition that made
Meituan's model work at scale in China. Availability at that specific
moment (what's actually in stock at a nearby station) determines what
can be offered instantly versus what needs standard delivery — matching
the real-time inventory sync already established in the Box-Mounted
DREAMS Screen document.

## Status
Ready for Claude Code — connects HVNTZ's onboarding model, DREAMS'
screen revenue, the Multi-Midpoint system, and the Box-Mounted DREAMS
Screen DTC system into one clear, formalized revenue structure. No new
technology, only the integration and payout logic.
