# Plan — Phase 2: Publishing arm

## Goal
`VENVS_PUBLISHING_ADDITION.md`: a real three-format publishing arm
(ebook + print + audiobook) with a real, specified 2026 royalty
structure, plus the "clean division" between new self-published work
(KDP/ACX-style royalty splits) and Ingram's existing backlist catalog
(wholesale access, no author-royalty split).

## Design
- `src/lib/royalties.js` — pure calculators, no side effects:
  - `calculateEbookRoyalty(listPrice, deliveryFee)`: 70% in the
    $2.99-$9.99 band minus delivery fee, 35% outside it. The delivery-
    fee deduction is applied only inside the 70% band, matching how
    the doc describes it (tied to the 70% mechanic specifically) and
    the real KDP program this models.
  - `calculatePrintRoyalty(listPrice, printingCost)`: 60% of list
    minus printing cost, clamped at 0 with a `belowCost` flag rather
    than returning a negative "royalty" — a real design decision (no
    source doc addresses what happens when a price is too low), since
    paying an author negative money isn't meaningful.
  - `calculateSubscriptionFundRate` / `calculateSubscriptionPayout`:
    modeled the fund mechanic for real — rate is
    `totalMonthlyFund / totalPagesReadPlatformWide`, not a fixed
    constant, matching how the doc describes it ("from a shared
    monthly fund") and the real program it's based on. The doc's
    $0.004-0.005/page is used as a sanity-check range
    (`typicalRange: true/false`), not a hard bound — a real fund can
    genuinely land outside its typical range in an unusual month.
  - `calculateAudiobookRoyalty`: AI narration gets the doc's specified
    flat 40%. Traditional narrator deals do **not** get an invented
    default rate — the doc names "traditional narrator-royalty deals"
    without quantifying them, and explicitly flags Audible's own
    royalty model as still-shifting as of May 2026. A caller must pass
    an explicit `narratorRoyaltyRate`; omitting it throws rather than
    silently guessing a number that isn't in any source doc.
- `src/lib/catalog.js` — `createCatalog`, `publishBook`, `getBook`,
  `getCatalog`, `purchaseBook`. Ingram-sourced books
  (`source: 'ingram'`) get `royalty: null` at publish time — no
  self-publish royalty split is computed for them at all, a direct,
  literal read of the doc's "clean division."
- **`purchaseBook` is the real integration point with Phase 1's
  wallet.** It takes an injected `transferFn(from, to, amount,
  reason)` rather than importing `v3Client.js` directly — keeps
  `catalog.js` runnable in plain Node (`v3Client.js` uses
  `import.meta.env`, which only exists under Vite) and keeps the
  purchase logic decoupled from exactly how a VCoin transfer happens.
  A purchase is two real transfers, in order: buyer → platform (full
  list price), then platform → author (the royalty amount) — skipped
  entirely for Ingram titles, which only have the first leg.
- `src/components/PublishingView.jsx` — a real demo UI (not the full
  Publishing tab from `CLAUDE.md` §4) proving the whole chain works
  against the actual Phase 1 wallet: a seeded 2-book catalog (one
  self-published ebook, one Ingram title), a real "Buy" button wired
  to `transferVCoin` from `v3Client.js`, and a purchase confirmation
  showing the real price paid and royalty (or lack of one for Ingram).

## Verification approach
Same two-layer rigor as Phase 1: pure-logic checks in plain Node first
(29 checks covering every calculator, every validation path, and a
mocked-ledger version of `purchaseBook` confirming the two-transfer
sequencing and exact amounts), then a real browser pass (Playwright +
this environment's Chromium) against the actual running app +
mock backend — including an **independent check of the author's real
ledger balance via a direct `curl`-equivalent `fetch` to the mock
backend**, not just trusting what the UI displayed, to confirm the
royalty payment genuinely happened server-side and wasn't just a
client-side illusion.

## Explicitly NOT in this task
- No full Publishing tab UI (skill tags, browsing/search, cover art,
  etc.) — `PublishingView` is a real but minimal demo.
- No actual Ingram Content Group API integration — `source: 'ingram'`
  is just a flag on a manually-published book; there's no real catalog
  import.
- No print-on-demand fulfillment or VOID routing — the doc says
  physical book orders should route through VOID's fulfillment layer;
  VOID doesn't exist in this session, so that connection isn't made.
- No subscription-pool UI — `calculateSubscriptionFundRate` /
  `calculateSubscriptionPayout` are built and tested as pure functions
  but nothing in the catalog/purchase flow uses them yet (à la carte
  purchases only, matching what `PublishingView` actually demos).

## Done when
- All four royalty calculators validate their inputs correctly and
  compute hand-checked correct values across real example prices,
  including edge cases (delivery fee exceeding the ebook cut, printing
  cost exceeding 60% of list price, a fund rate outside the doc's
  typical range, a narrator rate omitted).
- `publishBook` correctly computes and stores royalty info for
  self-published books in all three formats, and correctly stores
  `royalty: null` for Ingram-sourced ones.
- `purchaseBook` performs the correct two-transfer sequence for a
  self-published book and the correct one-transfer sequence for an
  Ingram book, verified against a mocked ledger with exact balance
  checks, not just "did it not throw."
- The real browser flow: both books render with correct pricing/
  royalty display, both purchases succeed through real UI clicks,
  the buyer's real VCoin balance drops by the correct amount each
  time, and — checked independently against the mock backend's own
  ledger, not just the UI — the author's balance increases by exactly
  the royalty amount while the Ingram "author" balance doesn't move at
  all.
- Regression: Phase 1's login/balance/cashout/logout flow still works
  in the same browser session.
