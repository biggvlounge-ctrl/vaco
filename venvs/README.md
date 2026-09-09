# VENVS

VENVS — the ecosystem's real, analog/physical commerce layer: an
Amazon-style Shop, Facebook-Marketplace-style peer resale, a
Publishing store (ebooks/audiobooks/physical books). One identity, one
wallet (VCoin).

**VEX/VADO removed (Phase 12)**, read this before touching anything
here: this app used to also have its own VEX trading floor and VADO
art gallery (`CLAUDE.md` §1's original 5-tab list). VOKEN
independently built its own, separately-real VEX (brokerage trading)
and VADO (auctions) two days later, trading actual Cvltvre Card
editions rather than this app's generic assets — checked directly via
git history, not assumed: the two were never one shared feature, they
were built twice, unaware of each other. Per direct instruction, VOKEN
is now the single canonical home for both; this app's own `vex.js`/
`vado.js` and their tabs are gone. See `../voken/README.md` and
`../vdp/README.md` (whose VEX/VADO districts now render real VOKEN
clients directly, no longer iframing into this app).

**Split note (Phase 10), read this before touching anything here**:
VENVS used to also contain the digital, virtual layer — the walkable
avatar world, CHOPZ District (leasable virtual retail units), and
DEGVCHI (the avatar-wearable economy) — all in one repo/app. Per
explicit instruction, that's wrong: VENVS is the real, physical/
analog commerce layer (real goods, real storefronts, real
transactions); the digital/virtual layer (land ownership, avatar
economy, the Decentraland/Sandbox/Roblox-style world) is **VDP**
(`../vdp/`), now a real, separate project. They were never meant to
be one blended app — see `../vdp/README.md` for the full split
rationale and what moved.

What stayed here: `shop.js`, `marketplace.js`, `catalog.js`/
`royalties.js` (Publishing) — real, unchanged in behavior. `vex.js`/
`vado.js` also stayed here through Phase 10, but were removed in
Phase 12 (see above). What moved to VDP: `world.js`, `chopz.js`,
`degvchi.js` and their view components.

**The one real, new piece this split added**: VENVS didn't have any
real routing before — everything was just stacked on one page (a
flagged gap since Phase 9). This phase adds both a real tab switcher
(no `?view=` param) and a real, deep-linkable `?view=<shop|marketplace|
publisher>` route that renders just that one screen with its chrome
hidden — VDP's own `WorldView` embeds this app's real, separately-
running Publisher screen via an actual `<iframe>` pointed at that
route when a player walks into the Publisher building (VEX/VADO no
longer route here as of Phase 12 — see above), rather than importing
VENVS's React components directly (which only worked before because
both apps shared one process/store). **Verified live in a real
browser** (Playwright): a purchase made *inside the embedded iframe*,
launched from VDP, genuinely completes against VENVS's own running
server and the shared V3 mock ledger — not a stub.

**A real, known, flagged limitation, now half-closed**: VDP and VENVS
are separate origins with separate Shield sessions (see
`shieldAuth.js`'s own header). Logging into VDP does not automatically
log the embedded VENVS iframe in — a user still sees VENVS's own login
prompt inside the frame the first time, since the iframe's `src` URL
carries no session token. But a direct, top-level visit to VENVS with
a real `?shieldToken=` (the shape `vaco-shell`'s own launcher already
sends) now genuinely works — `shieldAuth.js`'s `adoptToken` validates
it against Shield and signs the user in as themselves, live-verified
in a real browser. Only the embedded-iframe path is still unsolved.

Source docs: `CLAUDE.md` (the project brief — read this first, its §0
reorders everything; **its digital-mode/walkable-world sections now
describe VDP, not this project**), `VENVS_SHOPIFY_INTEGRATION.md`,
`VENVS_PUBLISHING_ADDITION.md`, `VENVS_DIGITAL_PLANET_COMPARABLES.md`.

## Run
Two processes — the mock backend (stands in for V3 + Shield) and the
app itself:
```
cd ../venvs-mock-backend && npm install && npm start   # localhost:8791
cd venvs && npm install && npm run dev                 # localhost:5173
```
Optionally also run `../vdp` (`npm install && npm run dev`,
localhost:5174) to see the real cross-app iframe embedding live.

## What's here (Phase 1)
- `src/lib/v3Client.js` — the wallet client, per `CLAUDE.md` §0.1:
  zero balance math lives in VENVS itself; every number comes from the
  ledger service.
- `src/lib/shieldAuth.js` — the auth client, per §0.2: session token
  issued and validated by the session service, not a VENVS-specific
  login.
- `src/lib/persistence.js` — whatever's left that's genuinely
  client-local (explicitly not wallet or auth state anymore).
- `src/App.jsx` — the Phase 1 smoke-test shell (login → real balances
  → real cashout), now also rendering `PublishingView`.
- `src/lib/royalties.js` — the Publishing royalty calculators (Phase
  2): ebook (70%/35% price-banded), print (60% minus printing cost,
  clamped at 0), subscription fund rate + payout, audiobook (flat 40%
  AI narration; narrator deals require an explicit rate — no invented
  default, since none exists in any source doc).
- `src/lib/catalog.js` — book catalog + `purchaseBook`, which performs
  real VCoin transfers (buyer → platform → author) via an injected
  `transferFn`, skipping the author-royalty leg entirely for
  Ingram-sourced titles per the doc's "clean division."
- `src/components/PublishingView.jsx` — a real demo UI: a seeded
  2-book catalog, a working "Buy" button wired to the actual wallet.
- `src/lib/marketplace.js` — Marketplace core (Phase 3): branded
  per-seller storefronts (`registerSeller` + `getSellerStorefront`,
  distinct from the unified `browseProducts` view), a real cart →
  checkout flow that splits payment across multiple sellers via
  real VCoin transfers, and real abandoned-cart detection
  (`checkAbandonedCarts`) + recovery offer generation
  (`generateRecoveryOffer`). The Shopify integration doc's other two
  features (VENVM app ecosystem, HVNTZ POS integration) aren't built —
  neither VENVM nor HVNTZ exists in this session.
- `src/components/MarketplaceView.jsx` — real demo UI: 2 branded
  storefronts, unified browse, a working checkout, and a live
  abandoned-cart-recovery demo, plus (Phase 11) 13 real SVMIKO DEGVCHI
  storefronts — see below.
- `src/lib/svmikoDegvchi.js` — **SVMIKO DEGVCHI Fashion House (Phase
  11)**: the ecosystem's first real clothing lines, populating
  Marketplace's branded-storefront system with real content instead of
  demo placeholders. 13 real sub-brands (DEGVCHI, LVCII, Devil in
  Details, BOOBI Couture, Boulevard, JACQVÉ, ZV, RED VEIL, VEDELLÍN,
  VvLGAR, VAISON, ANCÓR, DVMB), each a real, distinct
  `registerSeller` storefront with its own real positioning/signature
  element in `theme`, and one real flagship product each — a real,
  proven luxury-vs-streetwear price tier separation, not uniform
  placeholder pricing. Not built: the SD monogram / DEGVCHI Gateway
  Symbol (出口/deguchi) as actual rendered graphics — real visual/asset
  work, no image assets available in this session.
- `src/lib/shop.js` / `ShopView.jsx` — Shop (Phase 9): VENVS's own
  first-party retail, distinct from Marketplace's peer resale. Single
  catalog, instant buy, full price to the platform.
- `src/lib/vex.js` / `vado.js` and their views — **removed in Phase
  12**. See the header note above and `../voken/README.md` for where
  this real functionality now lives.
- `../venvs-mock-backend/` — a real, running Express service
  implementing a real, **inferred** V3 + Shield contract (their real
  API surfaces aren't available in this session). See its own file
  header for the full caveat.

## Build status: 3 of CLAUDE.md's original 5 analog tabs remain here
Shop, Marketplace, and Publishing (`CLAUDE.md` §1's named list) are
real and tested, behind a real tab switcher with real deep-linkable
routes (Phase 10). VEX and VADO — the other 2 of the original 5 — were
deliberately removed in Phase 12; VOKEN is now their single canonical
home (see the header note above), a real, flagged deviation from
CLAUDE.md §4's original 5-tab spec, not a silent one. The digital,
walkable-world side of the original build (native districts, Digital
Twin Levels, DREAMS billboards, Residential Towers, Jobs/Careers,
Daily Quests/HVNTZ Hunt, Skills, Population tiers, living NPCs, My
Assets dashboard, Live World News) belongs to `../vdp/` — see that
project's own README for its build status.

## Verified
Live in a real browser (Playwright + this environment's pre-installed
Chromium), both per-phase and — Phase 7 — as one continuous regression
pass across systems together: login, real fetched balances, a real
cash-out, real purchases across Shop/Publishing/Marketplace with
correct payouts, a real multi-seller checkout with abandoned-cart
recovery, real VEX share trading with a live-price portfolio
revaluation, a real VADO auction watched through an actual real-time
close (not simulated) — every money movement **independently
confirmed against the mock backend's own ledger**, including
hand-computed running totals across combined sequences.

**Phase 10 (split into VENVS/VDP)**: live in a real browser — the real
tab switcher and each tab's content confirmed; `?view=vex` confirmed
to render with zero chrome (no `<h1>`, no tab bar); and, launched from
VDP's own world, walking into the VEX building, entering it, and
completing a real purchase **inside the embedded iframe** confirmed to
genuinely hit this app's own running server and the shared V3 mock
ledger, not a stub — see `../vdp/README.md`'s own Verified section for
the full cross-app pass. See `dev-docs/` for the full verification
record, including 9 bugs caught in test scripts themselves (not the
app) across earlier phases, plus 3 real app bugs found and fixed
(Phase 8's shared-store gap and the React re-render bail-out it
surfaced; Phase 9's VADO listing that silently disappeared from the UI
once its auction ended) — worth a skim either way.

**Phase 11 (SVMIKO DEGVCHI)**: 20 plain-Node checks (13 unique real
brands, real seeding, DEGVCHI's own seller/theme/product checked
field-by-field, the luxury-vs-streetwear price tiering proven
directly), plus a live pass in a real browser — all 13 real
storefronts confirmed rendered on the Marketplace tab, the SD monogram
confirmed rendering next to DEGVCHI's name, and a real, complete
purchase of the DEGVCHI flagship coat confirmed end to end (Order
total exactly 640 VCoin), zero console/page errors. Two real test-
script bugs caught and fixed along the way — see `dev-docs/` for the
full record.

**Phase 12 (VEX/VADO removed)**: `npm run build` confirmed clean after
removal (40 modules, down from 41). A live pass in a real browser
confirmed exactly the 3 remaining tabs (Shop, Marketplace, Publishing)
render, with VEX and VADO genuinely absent from the tab bar — not just
hidden. See `../voken/README.md` and `../vdp/README.md` for the live
verification that VOKEN's own VEX/VADO now work end to end from
inside VDP's world instead.

## Fixed: shared state between standalone and world-nested views (Phase 8, historical)
Phase 7's regression pass found (and screenshotted) that
`PublishingView`/`DegvchiView` each created their own store on mount,
so the standalone instances and the ones `WorldView` renders on
building entry were independent state. Phase 8 fixed this by lifting
shared stores to `App.jsx` and passing them down as props. This whole
class of bug is now structurally impossible for the districts Phase 10
moved to VDP — VDP's `WorldView` embeds VENVS via a real iframe
against this app's real server, not a shared in-memory store, so
there's no second instance to drift out of sync with in the first
place.

## Fixed: the re-render bail-out regressed, then got fixed again (Phase 11)
Phase 8's *other* real fix — a `tick` counter forcing a real re-render
after non-money actions, since React's `setState` bails out when a
refetched balance is `Object.is`-identical to what's already
displayed — was silently dropped when Phase 10 rewrote this file for
the tab switcher/`?view=` embed. Caught live while verifying VDP's own
Phase 2 (SVMIKO DEGVCHI avatar wearables): equipping a purchased piece
didn't update the visible outfit. VDP's own `App.jsx` had the identical
gap (it was written fresh, without ever having the fix in the first
place). Both restored; re-verified live in both apps. A real reminder
that a fix living only in one file's own history, not in a test that
actually exercises the non-money path, can silently regress the next
time that file gets rewritten for an unrelated reason.

## Not yet built
- **Avatar/character art, Digital Twin Levels, DREAMS billboards,
  Residential Towers, Jobs/Careers, Daily Quests/HVNTZ Hunt, Skills,
  Population tiers, living NPCs, My Assets dashboard, Live World
  News, multiplayer/shared-world state** — all now VDP's scope, not
  this project's. See `../vdp/README.md`.
- Marketplace: VENVM app ecosystem and HVNTZ POS integration — still
  not built HERE, but the parenthetical this line used to carry
  ("neither system exists in this session") is out of date and was
  removed on re-check: `../venvm/` and `../hvntz/` are both real, built
  apps now, with 14 and 40 routes respectively. What is missing is
  VENVS's integration with them, not the systems themselves. Also
  unbuilt: seller onboarding, inventory management, scheduled
  abandonment sweeps.
- Publishing: no Ingram API integration (just a flag on a manually-
  published book), no subscription-pool UI, no full tab UI (search,
  skill tags, cover art). **VOID fulfillment routing IS now built** —
  `catalog.js`'s `requestBookFulfillment` routes physical book orders
  through the same client Marketplace uses; this line used to list it
  as missing.
- VEX/VADO: no longer this project's scope — see `../voken/README.md`.
- ~~Real cross-origin Shield SSO for the VDP→VENVS **iframe embed**~~
  — **BUILT, and this entry was stale.** It claimed "a user still sees
  VENVS's own login prompt the first time inside that embedded frame,
  since the iframe's `src` doesn't carry a session token today." Checked
  directly: `vdp/src/components/WorldView.jsx` appends
  `&shieldToken=<session>` to the iframe `src`, and this app's
  `App.jsx` calls `adoptToken()` on mount, which validates it against
  the same real `GET /api/shield/session/:token` check `getCurrentSession`
  uses. The handoff is still one-directional (Shell/VDP → app): a
  session started inside VENVS itself does not propagate outward. That
  is the real remaining limit, not the iframe.

- `V3_API_URL`/`SHIELD_API_URL` now default to the real, standalone
  `v3`/`shield` services (see `../v3/README.md`'s "Ecosystem cutover"),
  not `venvs-mock-backend` — this app was one of the real callers
  switched over.
