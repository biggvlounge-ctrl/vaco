# CLAUDE.md — VENVS (VACO Ecosystem)

Handoff brief for Claude Code.

> **Status note (updated after Phase 13).** This brief was originally
> written when VENVS was an unrun, single-file prototype with no
> backend. Thirteen real phases have shipped since, and three
> structural things changed that this file used to describe wrongly:
> the wallet/auth wiring is **done**, the walkable digital world
> **moved out to `../vdp/`**, and VEX/VADO were **removed entirely**
> (VOKEN is canonical for both). Sections below have been corrected
> against the real code rather than left describing the prototype.
> `README.md` is the fuller, phase-by-phase record; this file is the
> orientation brief. If the two ever disagree, trust the code, then
> `README.md`, then this.

---

## 0. Ecosystem integration — status of the three confirmed decisions

Three ecosystem-wide decisions shaped this app. All three are now
resolved in real code, not pending work:

1. **V3 is the canonical VCoin/VASH ledger.** ✅ **Done.** VENVS's
   wallet is a real client of V3's ledger API — see
   `src/lib/v3Client.js` (`getVCoinBalance`, `cashOutToVash`,
   `getVashBalance`), wired into `src/App.jsx`. VENVS has no ledger of
   its own and must never grow one; it reads and writes V3's.
2. **Shield owns login/session, trusted by every app.** ✅ **Done.**
   See `src/lib/shieldAuth.js` (`login`, `getCurrentSession`,
   `logout`, `adoptToken`). `adoptToken` specifically is the real SSO
   handoff — VDP's iframe embed passes a real Shield token in, so a
   player walking into the Publisher building inside VDP is already
   logged in here (Phase 13, `dev-docs/phase-13-real-sso-handoff/`).
   Do not build a VENVS-specific signup/login.
3. **V4's Command Center is the ecosystem's agent layer.** Still open,
   but **no longer VENVS's problem** — the NPCs this originally
   referred to live in `../vdp/` after the Phase 10 split. If NPC
   conversation gets built, it belongs there, routed through the
   existing agent infrastructure rather than a new LLM integration.

---

## 1. What VENVS is

VENVS (stylized from "Venus," matching the ecosystem's vowel-dropping
convention — VXLLAGE, CVNVO, VADO) is the ecosystem's **real, analog/
physical commerce layer**: an Amazon-style Shop, a Facebook-
Marketplace-style peer resale market, and a Publishing store (ebooks/
audiobooks/physical books). One identity (Shield), one wallet (V3's
VCoin).

**Read this before assuming a feature belongs here.** VENVS used to
*also* be the digital/virtual layer — a walkable avatar world, CHOPZ
District, the DEGVCHI avatar-wearable economy. Per explicit
instruction that was wrong, and Phase 10 split them apart:

- **VENVS** = physical/analog commerce. Real goods, real books, real
  storefronts, real fulfillment.
- **`../vdp/`** (VACO Digital Planet) = the digital/virtual layer.
  Land ownership, the avatar economy, the walkable world, CHOPZ
  District.

They are genuinely separate apps/processes now, not one blended
codebase. VDP embeds VENVS's Publisher view through a real `<iframe>`
against the `?view=` route in `src/App.jsx` — a real cross-origin
embed with a real SSO token handoff, not a shared component instance.

---

## 2. Current state: real, modular, wired

`src/App.jsx` is ~250 lines — a real tab shell, not the ~2,500-line
monolith this brief used to describe. Real structure:

- `src/components/` — `ShopView.jsx`, `MarketplaceView.jsx`,
  `PublishingView.jsx`
- `src/lib/` — `v3Client.js` (V3 ledger), `shieldAuth.js` (Shield
  session + SSO adopt), `catalog.js`/`royalties.js` (Publishing),
  `shop.js`, `marketplace.js` (branded seller storefronts),
  `svmikoDegvchi.js` (the fashion house as real sellers),
  `persistence.js`

It runs for real (`npm install && npm run dev`) and has been verified
in a browser — the original "never actually run" caveat is resolved.

**`server.cjs` (Phase 14, 31 Oct 2026) is this app's first real
backend.** Before it, `MarketplaceView.jsx` called `createMarketplace()`
fresh on every mount — a registered seller vanished on the next page
load, because there was genuinely nowhere for it to persist. Now a
real Express server (`lib/` holds CJS copies of the shared Shield/
service-auth/persistence infrastructure, same split `vdp/server.cjs`
already uses for its own ESM `src/lib`) gives `marketplace.js`'s own
`registerSeller`/`listProduct`/`getSellerStorefront`/`checkout` a real
persisted store and real Shield-authenticated routes. See this app's
own README's "Phase 14" section for the full route list and
verification record. `MarketplaceView.jsx` itself has not been
rewired to call it yet — that remains real, separate frontend work.

---

## 3. Stack

- Vite + React 18, plain CSS-in-JS (template-literal `<style>`
  blocks), no Tailwind/styled-components
- `lucide-react` for icons
- No state library — plain `useState`/`useEffect`
- Runs anywhere with Node 18+ and npm

---

## 4. Feature inventory (analog commerce — the real current scope)

- **Shop** — Amazon-style first-party retail (`src/lib/shop.js`).
- **Marketplace** — Facebook-Marketplace-style peer resale, used &
  new, plus the **Shopify-style branded-seller storefront** system
  (`registerSeller`/`listProduct`): a unified marketplace browse
  experience *and* per-seller branded pages, per
  `VENVS_SHOPIFY_INTEGRATION.md`.
- **Publishing** — VENVS Publisher: ebooks/audiobooks/physical books
  with the real KDP/ACX-derived royalty math in
  `src/lib/royalties.js` (70% band at $2.99–$9.99, 35% outside;
  print at 60% minus print cost), per `VENVS_PUBLISHING_ADDITION.md`.
- **SVMIKO DEGVCHI Fashion House** — the fashion *house* and its 20
  real sub-brands (updated 22 Oct 2026 from the original 13, then
  twice more on 1 Nov 2026 — first 12 to 16, then corrected/extended
  to 17 — then again on 12 Nov 2026 to 20, with three renames and
  three new brands; see `src/lib/svmikoDegvchi.js`'s own header) live
  here as real branded sellers inside the Marketplace storefront
  system (`src/lib/svmikoDegvchi.js`). 14 of the 20 have a real, open
  storefront — VvLGARI's own positioning was given directly on 22 Oct
  2026 (a luxury accessories house: cologne, perfume, sunglasses, and a
  handbag for each of men and women) and is no longer "to be
  established." SVRPENTS & STONES (renamed from STONE BONES, then
  SVRPENTS Stone, now SVRPENTS & STONES — same brand, same products
  throughout) carries a second real product too (an emerald-inlay
  bone chain, alongside its flagship jacket) — a later correction gave
  it genuine natural stone/gemstone inlay as part of its own material
  signature. Both SVRPENTS & STONES and VvLGARI list more than one
  item under their single real storefront; 12 others carry one each.
  SA VIOR and VIC VALENCI (renamed from VIC VALENCIAGO, 12 Nov 2026)
  have real, confirmed positioning: SA VIOR is "like our Christian
  Dior" (French-couture-inspired, a Bar-Suit-style cinched waist), VIC
  VALENCI is "similar to the Balenciaga brand, luxury, simple"
  (restrained minimalism, not the module's earlier avant-garde guess).
  VAISON / △AISON is now VITO VAISON (12 Nov 2026, rename only — same
  product/positioning). THRONES AND BONES, MYSTERY AND MASTERY, CVLT,
  BARRAGE, ARROGANT ANGEL, and SANTOS VENDETTA (the 18th-20th brands,
  12 Nov 2026) are real, confirmed names with **no** positioning — the
  first two confirmed directly as genuinely undecided ("I have not
  figured out yet"), not merely unsent — so all six carry
  `flagshipProducts: []` and are honestly real-skipped at seeding
  rather than given an invented identity. Note the split: the
  **brands/storefronts** are VENVS commerce; the **avatar wearables**
  economy is VDP's.

**Not here anymore** (don't re-add): the walkable world, CHOPZ
District, avatar wearables → all in `../vdp/`. VEX (trading floor)
and VADO (art gallery) → removed in Phase 12; **VOKEN is the single
canonical home for both**, trading real Cvltvre Card editions. VDP's
VEX/VADO districts render real VOKEN API clients directly.

---

## 5. Genuinely not built

- **Multiplayer / shared-world state.** Real accounts and a real
  ledger exist now, but there's no shared live *walkable* world here
  (and that world itself is VDP's concern). Marketplace itself is a
  real exception as of Phase 14: `server.cjs` gives it a real,
  persisted, multi-user store — a seller one account registers is
  visible to every other account, which was not true before.
- **Ingram catalog integration.** `VENVS_PUBLISHING_ADDITION.md`
  identifies Ingram Content Group as the real path to an existing
  backlist catalog (millions of titles, 30,000+ publishers) with real
  precedent for direct API integration. Not built — there is no real
  Ingram API credential or contract here, and it would be fabrication
  to stub one as though it were live.
- **AI-narrated audiobooks.** Named as a real differentiator in the
  source doc; not built.
- ~~**HVNTZ POS integration.**~~ **Done (Phase 15).** A real HVNTZ
  business now rings up an in-person sale through this same ledger —
  `recordPosSale`/`ordersForSeller` in `src/lib/marketplace.js`, the
  `POST /api/marketplace/sellers/:id/pos-sale` and
  `GET /api/marketplace/sellers/:id/orders` routes, and the "Ring up
  an in-person sale" / "Order history" cards in `hvntz/public/
  index.html`'s own Storefront tab. See this app's own README's
  "Phase 15" section for the full design and verification record.
- **Health/lifestyle stats** — deliberately not built and should stay
  that way; the source spec itself says this should remain pure
  gameplay rather than resemble real wellness tracking.

---

## 6. Source material

Real source docs live in this directory:
`VENVS_DIGITAL_PLANET_COMPARABLES.md` (Decentraland/Sandbox land
economy, Roblox's 2026 avatar-economy pivot — note most of this now
informs **VDP**, not VENVS, after the split),
`VENVS_PUBLISHING_ADDITION.md` (KDP/ACX royalty structure, Ingram),
`VENVS_SHOPIFY_INTEGRATION.md` (branded storefronts, seller app
ecosystem, POS). `README.md` carries the full phase-by-phase record.

---

## 7. Suggested next work

The original build order (run it, split `App.jsx`, wire V3, wire
Shield) is **complete** — steps 1–4 all shipped across Phases 1–13.
Phase 14 (31 Oct 2026, both same-day passes) gave this app its first
real backend, a working Hunts/Vault Studios storefront path, real
CHOPZ/VOID/abandoned-cart routes, and rewired `MarketplaceView.jsx`
itself onto the real backend. Phase 15 (1 Nov 2026) gave HVNTZ a real
point-of-sale path through that same backend (see §5 above).
Genuinely useful next steps, roughly by leverage:

1. **Real VOID fulfillment authorization.** `requestFulfillment` is
   wired and real, but refuses honestly against a real VOID: that
   service's `POST /api/job` wants the real seller's own Shield
   session (`requireActor('customerId')`), which neither this call nor
   CHOPZ SHOP's own already-shipped identical one sends. A real fix
   needs either VOID's own route to accept a service credential for a
   marketplace creating a job on a seller's behalf, or a per-seller
   confirmation step this app does not have yet — a real,
   cross-app design question, not a one-file patch.
2. ~~**Publishing → VOID fulfillment.**~~ **Done.**
   `purchaseBook` now records a real order, and
   `requestBookFulfillment` routes physical book orders to VOID through
   the same injected-`voidRequestFn` shape `marketplace.js` uses.
   Only `print` ships: an ebook or audiobook order is
   `not-applicable` rather than `unfulfilled`, so the shipping queue
   (`listUnfulfilledBookOrders`) never fills with files nobody can
   post. Self-published titles ship from their author; Ingram titles
   ship from VENVS, following the same wholesale-vs-self-publish line
   `publishBook` already draws for royalties.
3. ~~**Publishing: wire `catalog.js` into a real backend and
   component.**~~ **Done (Phase 17, 1 Nov 2026).** `server.cjs` now
   owns a real, persisted catalog with `POST/GET /api/publishing/
   books`, `POST .../purchase`, `GET .../orders/:id`,
   `GET .../orders/unfulfilled`, and `POST .../orders/:id/fulfillment`.
   `PublishingView.jsx` is rewired onto a new `publishingClient.js`,
   the same split `marketplaceClient.js` already draws. Found and
   fixed live while building this: the old view's purchase handler
   never supplied `payoutFn`, so every self-published purchase (any
   title owing its author a royalty) threw before this phase — only
   royalty-free Ingram titles could ever be bought. See this app's own
   README's "Phase 17" section for the full record.
4. **Ingram catalog** — high value, but blocked on a real commercial
   agreement and real API credentials, not on code. Don't stub it.

Already done, don't redo: abandoned cart recovery
(`checkAbandonedCarts` + `generateRecoveryOffer` in
`src/lib/marketplace.js`, real detection and a real computed discount
offer, not stubs) and Marketplace→VOID physical fulfillment.
