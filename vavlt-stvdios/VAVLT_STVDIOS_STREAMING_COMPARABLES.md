# Vavlt Stvdios — Streaming Comparables

Written to close a comparables-coverage gap. Vavlt Stvdios has a real
creator split in code and had no comparables document.

**What it is:** multi-channel live streaming, 8-screen interactive
sessions, VOD hosting, tips, and locked content tiers.

**The number that matters:**
`vavlt-stvdios/lib/lockedContentTiers.js` sets
`CREATOR_SPLIT_PERCENT = 0.80` — creators keep 80%, the platform takes
20%.

## Comparables

| Platform | Creator keeps | Notes |
|---|---|---|
| **Twitch** | 50% standard; 70% on legacy/negotiated premium deals | The 50/50 baseline is the single most criticized number in live streaming and the reason competitors exist. |
| **Kick** | 95% | The aggressive challenger position. Widely understood to be subsidized rather than sustainable on subscription economics alone. |
| **YouTube Live** | 70% of channel memberships | Backed by the strongest discovery engine in the category, which is much of what the 30% buys. |
| **Patreon** | 88–95%, depending on plan tier | Not live streaming, but the direct comparable for locked-tier subscription content specifically. |
| **OnlyFans** | 80% | Exactly the same split as Vavlt Stvdios, for the same product shape: locked content behind a creator-set tier. |

//: Flagged interpretive: these splits are the widely published
//: headline rates. Real creator economics differ — Twitch's 70% tier
//: is not generally available, Kick's 95% is a growth position, and
//: every platform's *effective* rate differs from headline once
//: payment processing and regional taxes land. Treat the ordering as
//: durable and the exact percentages as needing verification before
//: any pricing decision.

## Where 80/20 sits, honestly

**Better than Twitch, matching OnlyFans, worse than Kick and Patreon.**

That is a defensible middle. The honest framing is that 80/20 is not a
differentiating number — it is table stakes for a challenger, since
anyone leaving Twitch is already being offered 95% by Kick. The
differentiation has to come from the product:

- **The 8-screen interactive session** has no direct comparable in any
  platform above. Twitch, Kick, and YouTube are all one-stream-one-view.
  This is the actual novel mechanic and it is genuinely built.
- **Ecosystem settlement.** Tips, subscriptions, and locked tiers all
  settle in VCoin through V3, which means a creator's streaming income
  is spendable across VOKEN, CHOPZ, VACAY, and the rest without a
  cash-out step. No comparable offers that, because none of them own an
  economy.

**The risk worth naming:** Kick's 95% sets the anchor for any creator
doing the arithmetic. Competing on split against a subsidized rate is a
losing position, so the pitch has to be the two items above. If it
isn't, 80/20 reads as "Twitch but smaller."

## What is genuinely built

Multi-channel streaming, 8-screen sessions wired into VDP's Stage
district, VOD, tips, locked content tiers with the 80/20 split, and a
referral mechanic. All settling through V3.

## Not covered here

The video transport itself. Everything above models the *economics* of
streaming — who pays whom, and how much. Actual ingest, transcoding,
and delivery is not built and is the same real-time media gap as
task #106. Every comparable listed solves this with substantial
dedicated infrastructure or a vendor.
