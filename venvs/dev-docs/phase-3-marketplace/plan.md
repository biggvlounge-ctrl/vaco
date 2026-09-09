# Plan — Phase 3: Marketplace (branded storefronts + abandoned cart recovery)

## Goal
`VENVS_SHOPIFY_INTEGRATION.md` names four features. Two are real,
buildable, testable mechanics in isolation; two need other ecosystem
apps that don't exist in this session. Built the first two for real,
flagged the other two explicitly rather than faking them:

- ✅ **storefrontCustomization** — branded per-seller storefronts
  within a unified marketplace.
- ✅ **abandonedCartRecovery** — real, automated re-engagement.
- ❌ **appEcosystem** (VENVM tools as addable storefront apps) — needs
  VENVM, which isn't in this session.
- ❌ **posIntegration** (HVNTZ's physical business network) — needs
  HVNTZ, same gap.

## Design
- `src/lib/marketplace.js`: `registerSeller` takes a real `theme`
  object (free-form — no fixed schema is specified in the source doc,
  so callers set whatever their storefront rendering actually needs,
  same reasoning as `world-layer`'s free-form data slices).
  `getSellerStorefront` returns only that seller's products plus their
  theme — the actual "own branded page, not one generic template"
  mechanic — while `browseProducts` is the separate unified,
  Amazon-style cross-seller view. Both exist side by side, matching
  the doc's "VENVS should support both modes."
- `checkout()` reuses Phase 2's exact `purchaseBook` pattern (buyer →
  platform → recipient(s), via an injected `transferFn`), extended for
  a cart that can span multiple sellers: the platform leg fans out to
  one payout per seller represented in the cart, grouped and summed
  first so a seller with two line items still gets one transfer, not
  two.
- `checkAbandonedCarts()` is a real detection function, not a stub —
  age-based (`now - lastActivityAt >= threshold`), scoped to `active`
  carts with at least one item (an empty cart, however old, is never
  "abandoned" — there's nothing to recover). No specific threshold is
  given in the source doc; defaults to 30 minutes, a normal real-world
  e-commerce norm, overridable by the caller. `generateRecoveryOffer`
  computes a real percentage discount off the cart's actual total (no
  specific discount is specified either; defaults to 10%, both flagged
  as interpretive).
- `src/components/MarketplaceView.jsx` — real demo UI: 2 sellers with
  visibly distinct themes (color + banner), a real cart/checkout flow
  against the actual wallet, and a second, deliberately backdated cart
  demonstrating the abandonment detection + recovery offer live.

## Verification approach
Same two layers as Phases 1-2. Plain-Node pass first (30 checks,
including one bug caught in the test script itself — calling the
async `checkout()` inside a synchronous `try` without `await`, which
doesn't catch a rejection; fixed before the rest of the suite ran
clean). Then a real browser pass (Playwright + this environment's
Chromium): both storefronts render with their real theme content, all
3 products appear in the unified browse, a real 2-seller cart checks
out through an actual click, and — independently verified via direct
`fetch` calls to the mock backend's own ledger, not just the UI's
displayed numbers — both sellers' balances reflect their exact correct
payout. The abandoned-cart demo is exercised through a real click
too, with the resulting discount math checked against the actual
$34.00 cart total.

## Explicitly NOT in this task
- No VENVM app ecosystem, no HVNTZ POS integration — see the two ❌
  items above.
- No real cart-abandonment email/notification delivery — the
  detection and offer-generation logic is real; actually sending
  anything (email, push) isn't attempted, no notification service
  exists in this session.
- No seller onboarding flow, no product image/inventory management,
  no reviews — this is commerce + storefront mechanics only, not the
  full Marketplace/Shop tab UI from `CLAUDE.md` §4.
- No scheduled/background abandonment sweep — `checkAbandonedCarts()`
  runs on demand (a button click in the demo), same posture as Phase
  1's `vaco-analytics` intelligence layer (`evaluateMetric` also runs
  on demand, not on a timer).

## Done when
- `registerSeller`/`listProduct` validate correctly; `getSellerStorefront`
  correctly isolates one seller's products and theme from the unified
  `browseProducts` view.
- `addToCart` correctly accumulates quantity on a repeated add rather
  than creating a duplicate line, and rejects a bad cart/product or a
  non-active cart.
- `checkout` correctly computes a cross-seller split (verified against
  a mocked ledger with exact per-seller amounts, not just "didn't
  throw"), marks the cart completed, and rejects being called again on
  the same cart or on an empty cart.
- `checkAbandonedCarts` flags exactly the stale, non-empty cart and
  nothing else (not a fresh cart, not an old-but-empty cart), is
  idempotent on a second pass, and `generateRecoveryOffer` computes
  the correct discount off the real total, rejecting a non-abandoned
  cart.
- The full flow verified live in a browser, with both sellers' real
  payouts independently confirmed against the mock backend's ledger.
- Regression: Phases 1-2 (wallet, Publishing) still work in the same
  session.
