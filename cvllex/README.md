# CVLLEX

VOKEN's star constellation's own physical-production app: real order intake
for getting a limited physical run actually MADE (CDs/vinyl/cassettes
for a digital album drop, a short magazine run, limited collectible
merch), vaulted as a real, tokenized Cvltvre Card through VOKEN, and
redeemable — burn the digital twin, ship the real physical item —
through VOID's courier vertical.

## Why this exists, and why it's its own app

Built first as a module inside VOKEN (25 Oct 2026), then extracted
into this standalone app the same day, by direct decision: the
four-member VOKEN square (VOKEN · VEX · VADO · CVLTVRE) is now a
five-member constellation, still named **VOKEN**, drawn as a
five-point star, with CVLLEX as its fifth member — see
`dev-docs/VACO_CONSTELLATIONS.md` (including its "On the name" note:
this group was briefly mis-recorded as "Vulcan" the same day it grew
to five members, caught and corrected — there is no Vulcan anywhere
in this ecosystem).

**The real gap this closes.** Nothing in this ecosystem modeled
ordering a real physical run and getting it made before it's a real,
tokenizable object. VENVS's Publishing arm models print-on-demand
*economics* for books but never names who presses them; VOID only
ships goods that already exist (point A to point B). VOKEN's own
`limitedEditionMerch.js` already had `linkedCultureCardId` on every
listing — built to pair a physical item with a Cvltvre Card before
this existed to supply the physical item in the first place.

**Real comparables grounding this, each a distinct, current (2025–
2026) business:**

- **Qrates** — real, Tokyo-based platform pressing vinyl and cassettes
  in batches as small as 100 units, crowdfund-style. A genuine
  minimum run, not a smooth per-unit cost curve. (Qrates' *current*
  operating status is unverified as of 25 Oct 2026 research — see
  `CVLLEX_VENDOR_OUTREACH.md` — though the real economic fact it
  grounds, a genuine minimum run on pressed media, holds regardless of
  any one vendor's status.)
- **Printful / Printify** — real, no-minimum print-on-demand merch
  (apparel, posters, pins).
- **Lulu / Doxzoo** — real, no-minimum on-demand magazine/zine
  printing.
- **Courtyard.io** — the real model for the tokenization half: a
  physical collectible (today, graded trading cards) is vaulted
  (Brink's-insured), a 3D "digital twin" NFT is minted as a redemption
  voucher, and redeeming burns the NFT and ships the real card.

See `CVLLEX_VENDOR_OUTREACH.md` for a real, current (25 Oct 2026)
roundup of named vendors across every category CVLLEX orders from,
researched for direct outreach, not just comparables.

## Why CVLLEX talks to VOKEN instead of minting its own card

This is a deliberate choice, not an oversight, and it has a real
precedent in this exact codebase: VOKEN's own `VEX_VADO_RESTRUCTURING.md`
records that VEX was once extracted out of VOKEN into its own
standalone service, then folded back in, because a buy settles money
and transfers card ownership in the same tick against one store — a
network hop between those two lines can leave a buyer who paid and
owns nothing, with no reversal endpoint by design.

CVLLEX stays standalone for everything that is genuinely its own job
— production orders, vendor status, vaulting, redemption. Only the
actual "mint this as a real Cvltvre Card" step crosses into VOKEN,
through VOKEN's existing, canonical `POST /api/card/external`
(`sourceApp: 'cvllex'`, `sourceType: 'production-order'` — see VOKEN's
`lib/cultureCards.js` and `server.js`). CVLLEX never mints its own
competing token, and VOKEN never calls CVLLEX except to verify who
placed the order it's being asked to mint a card for.

## Real flow

```
POST /api/production-orders          (creator orders a real run)
POST /api/production-orders/:id/advance   (ordered -> in-production -> produced,
                                            a real human confirming a real vendor shipment arrived)
POST /api/production-orders/:id/vault     (mints the real Cvltvre Card via VOKEN,
                                            creates the vault record)
POST /api/vault/:id/redeem                (decrements the real remaining-unit count,
                                            requests a real VOID courier shipment,
                                            assigns a real serial number and records
                                            an optional engraving/specification note)
```

## Numbering and specification, on redemption

Every redemption gets a real `serialNumber` / `editionSize` (e.g. "3 of
500") — but framed honestly as **claim order**, not mint order. `#N/total`
normally claims to know mint order, and mint order is only knowable at
mint time; this vault mints one Cvltvre Card for the whole run, not one
per physical unit, so no real per-unit mint order exists to report (see
`VOKEN_VALUE_DISPLAY_CARD_INDUSTRY_COMPARABLES.md`'s own "On serial
numbering" note, which named this as the one serial-numbering gap worth
closing). What CVLLEX can honestly report is the Nth unit actually
redeemed, counted from when the vault opened — a real, non-fabricated
number.

A redemption can also carry a caller-stated `specification` — an
engraving or customization note (e.g. `"engrave: For Maria"`). Recorded
the same honest way `vendorNote` already works on a production order:
for the real human operator who confirms production, not applied by any
real engraving/finishing vendor integration, because none exists.

## What's real, and what honestly isn't

**Real:**
- The minimum-run economics (Qrates' ~100-unit floor on pressed
  media; no minimum on print-on-demand goods), enforced, not just
  described.
- The `ordered → in-production → produced` status progression.
- The real cross-app mint into VOKEN's existing card engine.
- Real redemption with a real VOID courier job requested, claimed
  before the request goes out (same claim-before-pay discipline
  `settleOnce.js` enforces for money elsewhere in this ecosystem).

**Not built, named rather than hidden:**
- **Any real vendor integration.** No pressing plant, printer, or
  merch manufacturer credential exists anywhere in this repository.
  `in-production`/`produced` are human-confirmed, not automated.
- **Redemption-against-specific-edition-ownership.** This tracks a
  vault's remaining unit count and who redeemed a unit — it does not
  verify the redeemer currently owns a specific *edition* of the
  linked Cvltvre Card before releasing a unit. VOKEN's card model has
  no "burned"/"redeemed" edition status to call into yet.
- **"Vulture Ticks" (touring/ticketing).** Raised as a connection
  point alongside Vulture Music and Vulture Flix. It does not exist
  anywhere in this repository — no touring, venue-booking, or
  ticketing system has been built for the Vvltvre family. Not
  fabricated here; a real, separate undertaking if it's wanted.

## Run it

```
npm install
npm start
curl http://localhost:8822/api/health
```

## Test

```
npm test
```

`test/physicalProduction.test.js` and `test/vault.test.js` cover both
modules against injected fake cross-app functions — no network.

## Routes

| Route | Auth | Notes |
|---|---|---|
| `GET /api/health` | none | |
| `POST /api/production-orders` | session, must be `creatorId` | |
| `GET /api/production-orders/:id` | none | VOKEN calls this unauthenticated to verify order ownership before minting |
| `GET /api/production-orders/creator/:creatorId` | none | |
| `POST /api/production-orders/:id/advance` | session, must be the order's creator | |
| `POST /api/production-orders/:id/vault` | session, must be the order's creator | mints the real Cvltvre Card via VOKEN |
| `GET /api/vault/:id` | none | |
| `POST /api/vault/:id/redeem` | session, must be `redeemerId` | requests a real VOID courier shipment; assigns a real claim-order serial number; accepts an optional `specification` engraving note |
