# CVLLEX — real vendors for direct outreach (researched 25 Oct 2026)

Answering a direct question: "do you know any distributors that we can
go to directly for the Collex brand?" Researched via web search, not
guessed — every vendor below is named because it could be verified as
real and currently operating; anything that couldn't be verified is
flagged as such rather than silently included.

**One correction to this repo's own existing grounding, found during
this research**: `cvllex/README.md` and `lib/physicalProduction.js`
cite **Qrates** as *the* real comparable for pressed-media minimums.
Qrates' current operating status is genuinely in doubt — Hypebot
reported in January 2024 that Qrates was struggling to fulfill orders
since mid-2023, with its own homepage showing a "new projects
suspended for maintenance" banner. No 2025/2026 coverage was found
confirming it resumed, was sold, or shut down. Qrates still stands as
real grounding for *why pressed media has a real minimum run* (that
economic fact doesn't depend on any one vendor), but it should not be
named to a real pressing-plant contact as a currently reliable outreach
target without checking qrates.com directly first.

## Pressed music media (vinyl / CD / cassette)

- **Diggers Factory** (France) — real, currently active. Offers both
  a crowdfund/pre-order model and a direct-pressing option (production
  starts immediately on payment, no pre-order phase), ~6–8 week
  turnaround. The strongest lead right now, given Qrates' unresolved
  2024 trouble.
- **Press On Vinyl** (Middlesbrough, UK) — real small-batch plant
  aimed at unsigned artists/indie labels; advertised 100-unit minimum
  runs at its 2022 launch. Confirm current minimums/pricing directly.
- **Sunpress Vinyl** (Miami) — real "Small Batch" program, reported at
  100 LPs (black vinyl, full-color jacket/labels) for ~$999, ~$8/unit
  reorders. Pricing is from older coverage — confirm current rates.
- **Outta Wax** (Minneapolis) — real boutique plant, manual presses,
  specializes in small-batch runs; no public unit minimum found.

None of these four expose a public API as far as this research could
verify — direct outreach (email/contact form) is the realistic
engagement model, which matches CVLLEX's own honest posture: no real
vendor integration exists yet, by design.

## Print-on-demand apparel/accessories (t-shirt/hoodie/hat/tote-bag/phone-case)

- **Printful** — real, current REST API (JSON; OAuth 2.0 for
  multi-merchant platforms, personal access tokens for single-account
  use) covering order submission and mockup generation. Already this
  repo's cited alternate provider.
- **Printify** — real API (developers.printify.com; personal access
  token or OAuth 2.0). A 2025 review notes advanced/custom API
  integration is geared toward higher-volume Enterprise tiers —
  confirm which tier CVLLEX-scale usage actually needs. Already this
  repo's default provider.
- **Fourthwall** — real, no-minimum, no-upfront-cost model, explicitly
  including enamel pins (e.g. pet pins "from $8.25"). Already cited in
  `vaco-shell/lib/merchStore.js` as an alternate provider — worth
  considering for CVLLEX's own pin/sticker/tote-bag/phone-case
  categories too.

No confirmed public API was found for sticker/enamel-pin specialists
(Sticker Mule, Printy6, Gelato) — searches surfaced only generic
no-minimum pin vendors without a confirmed developer API. Printful/
Printify/Fourthwall's existing catalogs already cover these
categories, so a specialist isn't necessary to pursue first.

## Magazine / zine / book print-on-demand

- **Doxzoo** (UK/US) — real, current: zero minimum order quantity on
  zines and magazines, 1 to 1,000+ copies. Explicitly states it is
  *not* automated print-on-demand — each order is placed, not
  storefront-triggered — which matches CVLLEX's own "order intake,
  human-confirmed" posture well.
- **Lulu** — real, true print-on-demand (pay only for what prints, no
  inventory held), supports single-copy orders and a bulk-import tool
  for recurring periodical shipping.

Both already correctly cited in this repo; no correction needed.

## Vault-then-redeem tokenized collectibles (Courtyard.io's model)

- **Courtyard.io** — confirmed real and currently thriving: a July
  2025 Fortune report has Forerunner leading a $30M round, with
  Courtyard reportedly doing ~$50M/month in volume at the time;
  Brink's-insured vaulting and NFT-burn-to-redeem confirmed via its own
  support docs. No correction needed to this repo's existing citation.
- Possible competitors surfaced — **unverified, flagged as such, not
  recommended for outreach yet**: 4K.com, Dibbs, Americana. These came
  only from aggregator/directory "alternatives" pages, not their own
  sites or independent reporting, and could not be confirmed real and
  operating with the same confidence as Courtyard.

## Outreach priority

Printful / Printify / Fourthwall / Doxzoo / Lulu are all solid,
API-or-direct, verifiably current — safe to approach immediately. For
pressed media, lead with **Diggers Factory** over Qrates given Qrates'
unresolved 2024 disruption; treat Press On Vinyl / Sunpress / Outta Wax
as secondary direct-contact options pending their own confirmation of
current minimums and pricing.
