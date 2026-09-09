# VENVS — Publishing Addition (Amazon Publishing / KDP / Audible model)

New addition to VENVS's analog-mode Marketplace: alongside Facebook
Marketplace/Amazon-style general commerce (already documented), VENVS
should include a full **publishing arm** — ebooks, physical books, and
audiobooks — modeled on Amazon's real KDP + Audible/ACX structure.

## Real royalty/pricing structure (2026)
- **Ebooks**: 70% royalty at list prices $2.99-$9.99 (minus a small
  delivery fee); 35% outside that range. This price-banded royalty
  structure is the actual mechanism that nudges authors toward a
  specific price range — worth replicating deliberately, not
  accidentally.
- **Print (paperback/hardcover)**: 60% of list price minus a variable
  printing cost (a 200-page hardcover costs ~$7.25 to print, for
  example) — print-on-demand, no inventory risk to VENVS or the author.
- **Kindle Unlimited-style subscription pool**: a per-page-read payout
  (~$0.004-0.005/page) from a shared monthly fund — relevant if VENVS
  wants a reading-subscription tier alongside à la carte purchases.
- **Audiobooks (Audible/ACX model)**: traditional narrator-royalty deals,
  plus a newer **AI-narration option** (Amazon's "Virtual Voice") paying
  a flat 40% royalty — notably, Audible changed its own royalty model as
  recently as May 2026, and it's been a genuinely contested change among
  authors, worth watching rather than treating as fully settled.

## What this means for VENVS
This is a real three-format publishing arm (ebook + physical + audio)
sitting inside VENVS's Marketplace, not a separate app — same treatment
as DEGVCHI (a brand/district inside VENVS, not standalone). Physical book
orders should route through VOID's fulfillment layer like any other
VENVS Marketplace physical good. AI-narrated audiobooks are worth
building as a real differentiator (using the same Claude API access
already wired into VultureFlix) — but the author-payout structure should
be decided deliberately given Audible's own still-shifting royalty model,
not copied blindly before that settles.

## Existing/backlist catalog access — Ingram Content Group (locked in)

KDP/ACX-style self-publishing (above) covers *new* content — an author
publishing today. **This is the separate, real answer for accessing an
existing, massive catalog of already-published books**, not just new
self-published titles.

**Ingram Content Group** — the real, dominant, industry-standard book
wholesaler. Real, confirmed scale: access to millions of active *and*
out-of-print books from **over 30,000 publishers**, plus 13 million
titles across 150 languages internationally. This is the standard way
virtually every real bookstore and online retailer gets a massive
existing catalog through one relationship, rather than negotiating
individually with thousands of publishers.

**Real, current proof this exact model works**: Magsstore, a real
online magazine/book retailer, partnered with Ingram in February 2025
specifically to expand their catalog — real, direct precedent for
VENVS doing the same. Real, confirmed technical precedent also
exists: other companies have built direct API integrations pulling
Ingram's live catalog into their own storefront (a real Shopify
integration, and Celerant's real point-of-sale integration both pull
Ingram's data directly).

**Clean division for VENVS**: KDP/ACX-style tools serve new,
self-published authors; Ingram is the real path to the existing,
massive backlist catalog — both routing through the same VENVS
publishing storefront, with physical fulfillment through VOID either
way.
