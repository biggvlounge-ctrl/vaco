# Plan — Phase 2: licensed content + subscription tiers

## Goal
Close two real, already-named gaps in the README's own "Not yet
built" list: licensed, non-exclusive content (distinct from acquired
Originals) and multiple subscription tiers (real Netflix has
ad-supported/standard/premium; only a flat monthly fee was modeled).

## Real investigation before any code
Read `lib/titles.js` and `lib/subscriptions.js` in full. Confirmed:
every title record assumes exclusive acquisition
(`ownershipRetainedPercent: 0`, an `exclusiveUntil` window); every
subscriber pays one flat `MONTHLY_FEE`. Both gaps are genuinely
different economics from what exists, not extensions of the same
shape — the real Netflix distinction between owned Originals and
licensed catalog content, and real tiered pricing with real per-tier
differentiators.

## Design
`licenseNonExclusiveTitle` — structurally distinct from
`acquireExclusiveTitle`: a real `licenseFee` for temporary, non-
exclusive rights, the licensor keeps full ownership
(`ownershipRetainedPercent: 100`, the literal mirror of an acquired
title's `0`), and a real `licenseExpiresAt` instead of an
`exclusiveUntil` window. `acquisitionType` is the real, honest
discriminator added to every record (both types). `isLicenseActive`
mirrors `isExclusive`. `watchTitle` gains a real check rejecting an
expired license even while `status` is still `streaming`.

`subscriptions.js` gains `SUBSCRIPTION_TIERS`/`TIER_FEES`
(ad-supported/standard/premium, `standard` equal to the original
`MONTHLY_FEE` exactly) and `TIER_MAX_SIMULTANEOUS_STREAMS` (a real,
named Netflix differentiator, informational only — no stream-session
tracking exists in this codebase to enforce it against, flagged
directly rather than half-built). `subscribe` gains an optional
`tier` param defaulting to `'standard'`; no separate tier-change
action is added since `subscribe` already doubles as the real renewal
mechanism — calling it again with a different tier is the same real
action, now switching tier and price too.

## Explicitly NOT in this task
Concurrent-stream limit enforcement. Co-production/multi-studio
acquisitions. Viewership-based bonus clauses on top of flat fees —
all pre-existing, still-real, still-deferred gaps.

## Verification approach
9 plain-Node checks. A live pass against the real running server and
V3 mock: a real licensed title with its fee/ownership/expiry fields
confirmed, a premium subscriber watching it, a second short-term-
licensed title's expiry proven via the same `now` testability
parameter every module here already exposes — isolating a license-
expiry rejection specifically from a subscription-lapse rejection by
renewing the subscription forward to the same future `now` first — an
ad-supported subscriber's distinct fee confirmed, and invalid-tier/
invalid-license-fee submissions confirmed rejected over real HTTP.

## Done when
Both README-flagged gaps are closed with real, tested code grounded
in Netflix's real, named distinctions (owned vs. licensed content,
tiered pricing), live-verified against the actual running server.
