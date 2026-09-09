# VEX — Brokerage Comparables

Written to close a comparables-coverage gap. VEX had no comparables
document, which matters more here than for most apps: this is the one
consumer app in the ecosystem whose entire launch depends on a
regulatory outcome.

**What it is:** the standalone brokerage app, extracted out of VOKEN.
**Gated closed** in `vex/lib/complianceGate.js` pending real
broker-dealer registration. Nothing here is a green light.

## Comparables

| Platform | Model | Monetization |
|---|---|---|
| **Robinhood** | Commission-free retail trading; the app that set consumer expectations for this category. | Payment for order flow, margin lending, Gold subscription, interest on cash |
| **Webull** | Commission-free with a more analytical interface; competes on tooling rather than simplicity. | PFOF, margin, securities lending |
| **Public** | Deliberately **rejected PFOF** and switched to optional tipping and subscription, marketing the absence as the product. | Subscription, tips, interest |
| **Fidelity / Schwab** | Incumbent full-service brokerages. Free equity trades, monetized through the broader relationship. | Cash sweep, advisory, fund fees |

//: Flagged interpretive: PFOF remains contested and has been the
//: subject of repeated regulatory attention. Its availability is a
//: policy variable, not a fixed feature of the market — a business
//: model that assumes it should assume it can be curtailed.

## The strategic question this raises

Every comparable above is free-to-trade and monetizes somewhere the
customer does not see. Two of those routes are closed or unattractive
to VEX:

- **Payment for order flow** requires real market-maker relationships,
  meaningful order volume, and a regulatory posture that is currently
  contested. It is not available to a new entrant on day one and may
  not be a durable model to build on.
- **Interest on idle cash and margin lending** requires holding real
  customer cash, which is a materially larger regulatory and custody
  undertaking than the brokerage registration already pending.

**Public's model is the realistic one to study**, because it is the
only comparable that monetizes transparently — and because "we don't
sell your order flow" is a position VEX can hold honestly from the
start rather than retrofitting after criticism.

## The honest position on the gate

The gate is not a formality and should not be treated as a countdown.
Broker-dealer registration is a real process with real capital,
compliance, and supervisory requirements, and until it clears, VEX
cannot take a customer order. The code path exists so that the
integration work is done in advance — the same reasoning VOKEN's
fractional-ownership gate uses.

**Nothing in this document is a recommendation to open the gate.** It
is competitive context for whoever does the registration work, and the
monetization question above should be settled *before* registration,
not after, because the answer shapes what is being registered for.

## What is genuinely built

Real brokerage models and routes behind the closed gate, VDP's VexView
repointed here from VOKEN, and `vex-trading/` as the parent shell over
VEX and Vex Business. Stephanie represents Vex Business in VACON.

## Related

`vex-business/` is a separate concern entirely — an internal,
management-facing futures *research* platform with its own Python
toolchain, its own comparables in
`vex-business/packages/research/research/comparables.py`, and its own
deployment. Its live-trading interlock must never be bypassed. Do not
conflate the two: VEX is consumer brokerage, Vex Business is internal
research.
