# Plan — Phase 7: the personal, cross-village avatar cosmetic shop

## Goal
Close a real, already-named gap: the README's own "Not yet built" list
named "a personal, cross-village avatar cosmetic shop (the prototype's
own separate Profile/Wallet-sheet concept)" as out of scope for Phase
3, which only built the village-specific version.

## Real investigation before any code
Read `villageShop.js` directly first, to confirm what already exists:
per-village cosmetics, listed only by a village's own owner, scoped to
that village, paid to that village's owner. Confirmed this is a real,
different concept from what's missing.

Read `VXLLAGE_CLAUDE.md`'s own "Profile / Wallet sheet" section
directly for the real spec, rather than inventing scope: "Wallet:
monetization stack list (5 illustrative revenue streams — Creator
Subscriptions, Event Monetization, **Avatar Economy**, Feed & Room
Ads, **Community Boosting** — labels only)... avatar cosmetic shop (3
items, real VCoin spend + equip state)." Confirms Avatar Economy and
Community Boosting are two real, separately-named revenue streams —
`villageShop.js` already covers Community Boosting; this phase covers
Avatar Economy. The real "3 items" count is given; the items
themselves are not.

## Design
`lib/avatarCosmetics.js` — a real, fixed 3-item catalog (flagged
placeholder names/prices, matching the doc's own real count). Real
VCoin purchase via the established injected-`transferFn` pattern,
paid to a real, fixed platform account (`vxllage-platform`) rather
than any village owner — this shop isn't village property. Real
single-slot equip/unequip: the doc says "equip state" (singular), with
no category structure the way VDP's own DEGVCHI wardrobe has, so
modeled as one slot rather than inventing categories nowhere named.

## Explicitly NOT in this task
Level/reputation/XP tracking — the same Profile sheet also names
"level (derived from XP), reputation... equipped cosmetics list," but
no XP/level/reputation system exists anywhere in this project's real
code yet; that's a separate, larger, undocumented-formula gap, not
attempted here. Only the cosmetic shop itself (the specific gap named
in the README) is in scope.

## Verification approach
13 plain-Node checks. A live pass against the real running server: a
real purchase confirmed moving real VCoin to the platform account
(not any village's), a real equip, and the real avatar profile
endpoint confirmed reflecting both.

## Done when
A user can browse, buy, and equip a real, personal avatar cosmetic
that has nothing to do with any one village — the real gap the
README's own "Not yet built" list named.
