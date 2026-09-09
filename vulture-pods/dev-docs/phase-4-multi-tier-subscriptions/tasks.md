# Tasks — Phase 4: multiple subscription tiers per show

- [x] Grep the whole project for `subscriptionPriceVCoin` to find
      every real caller needing the shape change.
- [x] `shows.js` — replace `subscriptionPriceVCoin` with
      `subscriptionTiers` (`{ id, name, priceVCoin }[]`), validated at
      creation; new `getSubscriptionTier` helper.
- [x] `subscriptions.js` — `subscribeToShow` takes a real `tierId`;
      switching tiers re-prices the one existing subscription record
      instead of duplicating it.
- [x] `episodes.js` — fix the stale `subscriptionPriceVCoin` gate
      check to `subscriptionTiers.length === 0`.
- [x] Confirm `listening.js`'s own `isSubscribedToShow` check needed
      no change (already tier-agnostic).
- [x] 8 plain-Node checks — all passing.
- [x] Live pass: real V3 + vulture-pods started (post-cutover
      defaults), a real two-tier show created, a real subscription to
      the pricier tier independently confirmed against V3's own
      balance on both sides.
- [x] Shut down all test servers.
- [x] Update `vulture-pods/README.md` — new Phase 4 bullets in "What's
      here", a new "Verified" paragraph, and the resolved item removed
      from "Not yet built".
- [x] Write this plan/tasks pair.

## Next
Per-episode minimum-tier gating and tier-specific perks remain
undocumented, real, separate features — not attempted here.
