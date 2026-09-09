# CHOPZ — TikTok / TikTok Shop Comparables (v1)

## TikTok Shop — real 2026 data
- Referral/commission fee: **5-8%** depending on category (apparel runs
  higher, ~15%), plus payment processing (~1.5-2%) — true take rate
  before fulfillment/affiliate costs lands around 7%.
- **Native in-app checkout** is the core structural feature: unlike
  Instagram Shop (which often redirects to the seller's own site), TikTok
  Shop completes the entire purchase without leaving the app — this
  drives higher conversion (5-8% vs. 2-4% industry benchmark) but means
  the platform owns the customer relationship, not the seller.
- **Affiliate marketplace**: 2M+ creators, performance-only commission
  (5-20%, seller-set) — brands pay nothing upfront, only on completed
  sales.
- **Live shopping**: drives 10-15x more engagement than static posts;
  brands running weekly livestreams see 3-5x higher conversion.
- Four ad formats: Shop Ads, Video Shopping Ads, LIVE Shopping Ads,
  Product Shopping Ads — each targets a different stage of shopping
  intent.
- Scale: $66B global GMV in 2025, projected $112B in 2026 — the
  fastest-growing social commerce platform, ahead of Instagram Shopping
  and Facebook Marketplace on transaction volume growth.

## Direct translation to CHOPZ SHOP
CHOPZ SHOP's already-documented cart-to-checkout flow and Creator Studio
map onto this closely — the two pieces worth confirming are in place:
(1) checkout should stay fully native/in-app, never redirecting out to
VENVS Marketplace or an external store, matching TikTok's own highest-
converting pattern; (2) the affiliate commission model (creator-set
rate, performance-only, no upfront cost to the brand) should be the core
creator-monetization mechanic for CHOPZ SHOP specifically, distinct from
Vvltvre/Vavlt Stvdios' subscription-based creator payouts.

---

## Implementation status (added when this file was placed into the repo)

**Both directives were already implemented**, and the affiliate half
was built directly against this research — `chopz-shop/lib/orders.js`
carries a comment describing its economics as "real, TikTok-Shop-
accurate," so this document visibly shaped the code even though the
file itself was not saved here until now.

**Affiliate model — real.** `chopz-shop/lib/store.js` holds
`affiliateLinks` and `affiliateClicks`; `lib/orders.js` splits a
completed order between seller, platform, and affiliate "if the order
came through a" real affiliate link. That is the performance-only
structure this document asks for: no payout exists until an order
actually settles, so a creator with clicks and no conversions costs
nothing — exactly the "brands pay nothing upfront" property.

**Native checkout — real, and structurally enforced rather than merely
observed.** CHOPZ SHOP has its own cart and its own checkout settling
through V3. It does not hand off to VENVS Marketplace. Worth being
precise about why the two are separate rather than duplicative: VENVS
carts span multiple sellers (which is why VENVS fulfillment creates one
courier job *per seller*), while CHOPZ SHOP is single-seller
storefront commerce. They are different checkout shapes, not two
implementations of one.

**Real category-based fees exist**, matching the document's observation
that TikTok's rate varies by category (apparel ~15% vs. 5-8% baseline)
rather than being one flat number.

**One distinction this document draws that the code also honors.**
"Distinct from Vvltvre/Vavlt Stvdios' subscription-based creator
payouts" is accurate and load-bearing: Vvltvre Music pays through
royalty splits and label deals, Vavlt Stvdios through subscription and
tip-style channels, CHOPZ SHOP through per-order affiliate commission.
Three genuinely different creator-monetization models, which is correct
— a creator selling a product, a musician earning on plays, and a
streamer earning on an audience are not the same economic relationship.

**Live shopping — not built.** The "10-15x more engagement" claim is
the one substantial mechanic in this document with no counterpart in
the code. Vavlt Stvdios has real live channels and CHOPZ SHOP has real
products, so the pieces exist in separate apps; nothing connects them.
That is a real, identifiable gap rather than a vague ambition, and it
is the obvious next thing here if this document is picked up again.

**On "the platform owns the customer relationship" — flagged as a
trade-off the document states neutrally.** It is presented alongside
the conversion benefit as a consequence, and it is worth noting that
this is the part sellers object to in the real product. A seller who
cannot reach their own buyers is dependent on the platform's
distribution. If CHOPZ SHOP is meant to be seller-friendly relative to
TikTok, that is the specific lever — and it is a product decision, not
a technical one.

**A note on this file's location.** A second copy of this document was
created at `chopz/CHOPZ_TIKTOK_COMPARABLES.md` during the placement pass
and has been removed. This copy is the original and the fuller of the two —
it carries the four TikTok ad formats and the GMV growth comparison that the
later copy lacked. It lives here rather than in `chopz/` because the subject
is CHOPZ SHOP's commerce layer specifically, not CHOPZ's video feed.
