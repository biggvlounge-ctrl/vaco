# Plan — Phase 9: CVLTVRE, the real customer-facing brand

## Goal
Introduce CVLTVRE as this project's real, customer-facing product
brand, per direct instruction: VOKEN stays the technical/project name
underneath, the same relationship V3 already has to VCoin/VASH.

## Real investigation before any code
The instruction came through voice dictation across several rounds,
with real ambiguity worth resolving with real evidence rather than
guessing: is CVLTVRE a full rename, a brand layered over everything
VOKEN does, or scoped to one sub-feature? The clearest, final, typed
statement was: "Voken is the main app, cvltvre is a brand inside the
app that is our fanatics style card app with features like them" —
confirming VOKEN remains the parent/technical name, and CVLTVRE covers
the whole real product (not narrowly excluding VEX/VADO, per a later
clarifying message: "vex and vado ... are part of the auctionable
section of everything," matching VOKEN's own real "buyable/sellable/
tradeable/auctionable" framing already in this README).

The user separately asked to "make sure you do all comparables."
Checked directly rather than invented: eBay, Sotheby's/Christie's,
Fanatics, PSA, and Entrupy are all already real, researched
comparables present in this project's own `VOKEN_MASTER_SPEC_PROGRESS.md`
and `VOKEN_VALUE_DISPLAY_CARD_INDUSTRY_COMPARABLES.md` — not newly
fabricated for this phase, just surfaced properly in the README's own
top-level framing (VOKEN as a whole ↔ eBay was present in the source
doc but never stated plainly at the top of this README).

## Design
`lib/brand.js` — a real, small, queryable module (`BRAND_NAME`,
`BRAND_TAGLINE`, `POWERED_BY`, `getBrandInfo()`), not just a doc
comment, so the brand name can't drift between this README and any
real consumer. Wired into both a new `GET /api/brand` and folded into
the existing `GET /api/health`. VDP's own `VexView.jsx`/`VadoView.jsx`
now fetch and render it live ("Part of CVLTVRE, powered by VOKEN")
rather than hardcoding the string independently in a second place.

## Explicitly NOT in this task
Any rename of VOKEN's own package name, directory, port, or internal
code identifiers — CVLTVRE is real, but it's a product/brand-facing
name, not a project-identity rename. No new VDP world presence (a
scope question the user explicitly declined — branding pass only).

## Verification approach
3 real plain-Node checks on `brand.js`. A live pass confirming VOKEN's
own `/api/brand` and `/api/health` both return the real brand object,
then confirming VDP's own VEX and VADO districts render it live,
fetched over the network, not hardcoded.

## Done when
CVLTVRE is real, queryable, documented with its real comparable
grounding, and visibly rendered wherever a real consumer already
exists.
