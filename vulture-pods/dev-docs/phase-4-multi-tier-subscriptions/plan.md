# Plan — Phase 4: multiple subscription tiers per show

## Goal
Close this project's own previously-flagged gap: "Multiple
subscription tiers per show (Spotify/Patreon both support creators
offering more than one price point) — one real tier per show is
modeled." Part of a broader ecosystem sweep of small, self-flagged
gaps, confirmed with the user before starting.

## Real investigation before any code
Re-read `shows.js` and `subscriptions.js`'s own headers: the single
`subscriptionPriceVCoin` field was a real, deliberate Phase-1 scope
choice, not an oversight — this phase replaces it rather than bolting
tiers on alongside it, since a show never needs both shapes at once.
Grepped the whole project for `subscriptionPriceVCoin` to find every
real caller needing the shape change: `shows.js` (the field itself),
`subscriptions.js` (`subscribeToShow`), `episodes.js` (the
`requiresSubscription` gate check). `listening.js`'s own
`isSubscribedToShow` check turned out to already be tier-agnostic (any
active subscription unlocks a gated episode), so it needed no change.

## Design
`Show.subscriptionTiers` replaces `subscriptionPriceVCoin`: a real
array of `{ id, name, priceVCoin }`, empty by default (most shows stay
free). `subscribeToShow` now takes a real `tierId`; a subscriber holds
exactly one active tier per show (Patreon's own real model, not
stacked tiers) — subscribing again with a different `tierId` re-prices
the one existing subscription record rather than creating a second.
`episodes.js`'s gate stays tier-agnostic on purpose: there's no
per-episode minimum-tier requirement anywhere in this project's own
established design, so any one of a show's real tiers unlocks a gated
episode.

## Explicitly NOT in this task
Per-episode minimum-tier requirements (e.g. "this bonus episode needs
the Superfan tier specifically") — undocumented anywhere, not invented
here. Tier-specific perks/benefits beyond price — no other VACO app
models creator-tier perks either. Any UI.

## Verification approach
8 plain-Node checks (tier creation/ids, price validation, real
per-tier payout split, tier switching re-pricing one record, unknown
tierId rejected, zero-tier show rejecting subscribe, tier-agnostic
episode gating, and gating rejected on a zero-tier show). A live pass
against the real running server and the real standalone V3 (post
ecosystem-cutover): a real two-tier show, a real subscription to the
pricier tier, independently confirmed against V3's own balance on both
the listener and creator sides.

## Done when
`Show` models real multiple tiers, subscribing/switching/gating all
work correctly against them, and the README's own "Not yet built" list
no longer names this gap.
