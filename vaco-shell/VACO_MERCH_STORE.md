# VACO Merch Store

A real, dedicated merch section inside Vaco Shell, serving every app
brand across the ecosystem — VOID, VDP, VASH, VOKEN, HVNTZ, Vvltvre,
Vavlt Stvdios, VXLLAGE, CHOPZ, VACAY, VAGO, CVNVO, VACANCY, and the
Food & Wellness Brands — from one unified storefront, real zero-
inventory fulfillment.

Real comparables: Printful (in-house production, best for brand
reputation), Printify (marketplace model, genuinely lower cost —
~$4+ cheaper per shirt than Printful, ~$400/month more profit at 100
sales/month; explicitly supports "full product ecosystems" — multiple
product lines from one dashboard, a direct fit for VACO's many-app
structure), Fourthwall (best all-in-one, strong brand customization).
Printful and Printify announced a merger in late 2025, still operating
separately as of mid-2026.

Zero-inventory model confirmed: no upfront stock, no warehousing, no
minimum order quantities — products manufactured only after a real
customer order, eliminating inventory risk, making it realistic to
launch merch for every app brand simultaneously.

Real product range confirmed: apparel, tech accessories (watch bands
compatible with Apple Watch/Android Wear), coffee mugs, broad general
catalog.

Direct fit with existing AI illustration layer: Printful, Printify,
and Gelato have all added AI-assisted design tools directly into their
platforms — connects to VACO's own already-established AI
illustration/image-generation layer, the same tools already planned
for ad creative and DREAMS content can generate app-specific merch
designs.

```
VacoMerchProduct {
  id, appBrandId
  productType: "apparel" | "watch-band" | "mug" | "accessory" | "other"
  designAssetUrl
  fulfillmentProvider: "printify" | "printful" | "fourthwall"
  isZeroInventory: true
}
```

Status: ready for Claude Code — Printify recommended as primary choice
given its multi-brand dashboard and stronger margins, product designs
sourced from VACO's existing AI illustration layer. No manufacturing/
warehousing infrastructure needs to be built.

---

## Implementation status (added when this file was placed into the repo)

**Not built.** `vaco-shell/lib/` holds `registry.js` and `insight.js`
— a launcher, a session host, and an app registry. There is no
commerce surface, no product model, and no fulfillment integration.

**Filed under VACO Shell because this document places it there**
("inside Vaco Shell"), and that placement is right for a reason worth
stating: the Shell is the only surface that already knows about every
app. `registry.js` holds all 31 entries with their parent groupings.
A merch store spanning every brand needs exactly that list, and the
Shell is the one place it exists without duplication.

**The `appBrandId` field lands on something real.** It would key
directly to `registry.js` ids — `void`, `voken`, `hvntz`, and so on —
rather than needing a new brand table. That is the difference between
a two-day build and a two-week one, and it is why the Shell placement
matters more than it first appears.

**One correction to the brand list.** It names VACANCY, which is
paused (VACON-C), and VASH, which is a *layer inside V3* rather than
an app with its own identity. It omits VENVM, Vvltvre's four
sub-divisions as distinct brands, and Vex. If this gets built, the
brand list should be derived from the registry rather than retyped —
same argument made against V4's hardcoded agent roster, which had
drifted to 10 of 12 before it was caught.

**The AI illustration layer this document depends on does not exist.**
"VACO's own already-established AI illustration/image-generation
layer" is asserted as established. It is not: there is no image
generation anywhere in this repo, and `venvm/lib/productionPipeline.js`
states plainly that VENVM "cannot generate pixels." The design-asset
half of `VacoMerchProduct` therefore has no upstream source today.

That does not block the merch store. Print-on-demand platforms accept
uploaded artwork, and Printify, Printful, and Gelato all ship their own
AI design tools — which this document itself notes. The honest
sequencing is that merch can be built with manually supplied artwork
now, and wired to an internal generation layer if one is ever built.

**The vendor recommendation holds up on its own terms.** Printify's
multi-brand dashboard genuinely fits an ecosystem with sixteen parent
brands better than a single-store tool, and the margin argument is
concrete. Per `dev-docs/STANDING_INSTRUCTION_ONGOING_EVALUATION.md`,
re-check the pricing and the merger status at build time — the
Printful/Printify merger was announced late 2025 and "still operating
separately as of mid-2026" is exactly the kind of fact that changes.

~~**Nothing here was built.**~~ — **built, in `lib/merchStore.js`.**

The store side is real: products in this document's own
`VacoMerchProduct` shape, one storefront across every app brand, and an
order that settles through V3 in a three-way split. Surfaces exist in
both the shell's Merch tab and VDP's `vaco-merch` district — the latter
live-verified end to end, walking an avatar to the district and placing
a 28 VCoin order that moved 11 to fulfilment, 13.6 to the VOID brand,
and 3.4 to the platform.

Four decisions worth naming, since this document did not settle them:

- **The platform fee is taken on margin, not on retail.** Taken on
  retail it would eat most of the brand's share on a low-margin item
  (on a 30/10 tee: 16 to the brand rather than 14). 20% is flagged
  interpretive — no source document sets a merch margin.
- **`isZeroInventory` is fixed true and not caller-settable.** A
  product that needed warehousing would silently break the model the
  whole store rests on.
- **Selling below cost is refused at creation.** In a zero-inventory
  model there is no stock sitting anywhere to make the loss visible, so
  every unit sold would quietly lose money.
- **Cancelling stops being free at `in-production`**, which is the
  point the item physically exists.

Still not built, and stated on both surfaces rather than left to be
discovered after paying: **no live Printify/Printful/Fourthwall API** —
`submitToFulfilment` is the seam and records intent only — and **no AI
illustration layer**, so `designAssetUrl` still has no upstream source.
The vendor decision remains open; the code defaults to Printify per this
document's own recommendation and accepts the other two.
