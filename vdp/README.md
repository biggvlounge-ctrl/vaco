# VDP (Digital Planet)

VDP — the ecosystem's real, digital/virtual layer: land ownership, the
avatar economy, the walkable Decentraland/Sandbox/Roblox-style world.
Split out of VENVS (the real, analog/physical commerce layer) per
explicit instruction: these are two genuinely distinct systems, not
one blended app wearing two modes. Same identity, same wallet (VCoin)
as VENVS — both are real, separate clients of the same shared V3/
Shield infrastructure.

**Read `../venvs/README.md`'s own split note first** for the full
rationale and what moved where. Short version: `world.js`, `chopz.js`,
`degvchi.js` and their view components used to live inside VENVS's
repo; they're here now. VENVS kept its own real analog commerce
(`shop.js`, `marketplace.js`, `catalog.js`/`royalties.js`).

**How VENVS and VDP actually connect**: walking your avatar into the
VENVS-owned Publisher building inside this world embeds VENVS's own,
separately-running app via a real `<iframe>`, pointed at a real,
deep-linkable `?view=<name>` route VENVS's own Phase 10 added — not a
shared React component instance (the two apps no longer share a
process or an in-memory store, so that's not possible anymore, and
isn't needed: a real purchase made inside the embedded iframe
genuinely hits VENVS's own server and the shared V3 ledger). Fashion
District (DEGVCHI) and CHOPZ District are this app's own real, native
content — they were never VENVS's in the first place; see `world.js`'s
own header for the real resolution of an ambiguity in VENVS's original
source doc about exactly this. **The VEX and VADO districts no longer
embed VENVS at all (Phase 7)** — see below.

**A real, known, flagged limitation — now fully closed (Phase 10)**:
VDP and VENVS are separate origins with separate Shield sessions.
Logging into VDP used to not carry into the embedded VENVS iframe — a
user saw VENVS's own login prompt inside the frame, since the iframe's
`src` URL carried no session token. Closed the same way the
direct-visit case was closed: `WorldView.jsx`'s Publisher-district
iframe `src` now appends VDP's own real `session.sessionToken` as
`&shieldToken=...` alongside `?view=publisher`, and VENVS's existing
`adoptToken()` (already built for the direct-visit case, no VENVS-side
code changed) reads it from `window.location.search` the same way
whether that location is a top-level tab or an iframe's own `src`.
Live-verified in a real browser with a definitive before/after: hitting
VENVS's `?view=publisher` route with no token renders **no Buy button
at all**; with VDP's real token appended, the Buy button appears and a
real purchase completes end-to-end through V3 ("Bought ... for 5.99
VCoin — 4.04 VCoin paid to author"). Still real and honest about what's
NOT solved: this is still one-directional (VDP → VENVS), not a shared
cookie domain or two-way sync — a session started fresh inside the
VENVS iframe itself still doesn't propagate back out to VDP or
sideways to the Shell.

Source docs: VENVS's own `CLAUDE.md` (its digital-mode/walkable-world
sections, §1/§4, describe this project now, not VENVS itself; §5 also
names Vavlt Stvdios' real streaming, "up to 8 real camera feeds with AI
operators," as explicitly not built there — now wired in below),
`VENVS_DIGITAL_PLANET_COMPARABLES.md` (DEGVCHI's real Roblox-
avatar-wearable-pivot grounding).

**A fourth real integration, beyond the VENVS split**: VENVS Stage
("event plaza") now renders `vavlt-stvdios`' own real "up to 8
interactive screens" mechanic — a genuine cross-app wiring, the same
pattern as the VENVS iframe embeds, but via a real HTTP client
(`lib/vavltStvdiosClient.js`) instead of an iframe, since Vavlt Stvdios
has no frontend of its own to embed. See "What's here" for the full
detail.

**A fifth real integration, and a real 7th district**: the Village
District wires in VXLLAGE's own real Villages/Rooms/Channels, per
`VXLLAGE_VDP_VILLAGE_DISTRICT.md`'s own direct instruction — "a real
place with multiple distinct rooms a player's avatar can walk between,
not just a card linking out." That doc directly contradicts this
file's own general rule that only 6 native districts get physical
space and "lounge" apps like VXLLAGE live only in their own app; the
contradiction is resolved in VXLLAGE's favor here, per explicit
instruction, and flagged rather than silently reconciled — see
`lib/world.js`'s own header. That same doc's claim that this should
follow "the same treatment already given to VAGO's Resort & Casino,
which is a real walkable destination inside VDP" was checked directly
and confirmed false — VAGO has no district anywhere in this world, and
its own README confirms its casino world isn't built either. This
district is a first, not a copy of an existing pattern.

**A sixth real integration, and a real 8th district**: the Dating
Village wires in CVNVO's own real BarBuddy venue-check-in mechanic, per
`CVNVO_DATING_COMPARABLES.md`'s own "Dating Village inside VDP"
section — "a real place to walk into with your avatar, not just a
link-out card," following the same pattern already established for the
Village District above. Unlike the Village District's own doc, this
one's precedent claim was checked directly and confirmed **true**: the
Village District really is built and live-verified in this same file.
See `lib/world.js`'s own header and `lib/datingVillage.js`'s own header
for the full detail, including why this district is one real venue
rather than a second interior map (CVNVO has no "rooms" concept the way
VXLLAGE does).

**A seventh real integration, replacing two districts' earlier
embeds**: the VEX and VADO districts used to iframe into VENVS's own,
independently-built `vex.js`/`vado.js`. VOKEN later built its own,
separately-real VEX (brokerage trading)/VADO (auctions) two days
later, trading actual Cvltvre Card editions rather than generic
assets — checked directly via git history, not assumed: the two were
never one shared feature, they were built twice, unaware of each
other. Per direct instruction, VOKEN is now the single canonical home
for both; VENVS's own copies were removed (`../venvs/README.md`'s own
Phase 12), and these two districts now render real clients of VOKEN's
own API directly (`lib/vokenClient.js`) — the same `-embed` shape as
every other cross-app district above, no iframe. See `lib/world.js`'s
own header for the full detail, including the real, honest trade-off:
VOKEN's VEX brokerage trading is gated behind a real compliance flag
(VENVS's version had none); VADO's auctions carry no gate at all,
confirmed directly, so nothing was lost there.

**An eighth and ninth real integration, and real 9th/10th districts**:
VAGO Casino and VACAY Experiences. The earlier paragraph above noted a
checked-and-confirmed-false claim that VAGO already had a walkable
destination here — that gap is now real and closed: VAGO Casino fills
the one open grid slot the 3rd row had left (`x:20,y:580`), a live
client of VAGO's own Originals (Mines) casino game
(`lib/vagoClient.js`) — real stake via a real casino session, a real
provably-fair round, real tile reveals, a real cash-out paid in VCoin.
VACAY Experiences is a new 4th row (`WORLD_HEIGHT` grown from 860 to
1140, same precedent as the earlier Village District row growth), a
live client of VACAY's own Experiences API (`lib/vacayClient.js`) —
deliberately scoped to Experiences rather than Stays, since Experiences
is the one resource in VACAY's bookings router with a real browse-all
route (`GET /api/bookings/experiences`); Stays only exposes
single-listing lookup by a known id, no browse-all route exists there
to embed. Both districts follow the same `-embed` shape as VEX/VADO:
no game or booking logic lives in VDP, every real number comes back
from VAGO's/VACAY's own server.

**An eleventh through fifteenth real integration, and real 11th-15th
districts**: HVNTZ Hunt, VOID Marketplace, and all three Vvltvre
divisions (Music, Pods, Flix) — closes the largest remaining slice of
this ecosystem's own "only 3 apps have any UI" gap. HVNTZ Hunt fills
the 4th row's remaining `x:20` slot, a live client of HVNTZ's own
original core mechanic (`lib/hvntzClient.js`) — a real sponsored hunt,
a real checkpoint, a real VCoin bounty on check-in. VOID Marketplace
fills the 4th row's remaining `x:580` slot, a live client of VOID's own
real request→match→accept→complete→pay→rate loop
(`lib/voidClient.js`) — the same loop every one of VOID's 18+
verticals runs through, demoed via the real, non-licensing-gated
Courier vertical. Vvltvre Music/Pods/Flix are a real new 5th row
(`WORLD_HEIGHT` grown from 1140 to 1420), live clients of each
division's own separate API (`lib/vultureMusicClient.js`/
`vulturePodsClient.js`/`vultureFlixClient.js`) — a real release +
streaming-revenue payout, a real show/episode/subscription flow
(publishing an episode is itself a real cross-app call from Pods into
Music), and a real acquisition + subscription + concurrent-stream-limit
flow. All five follow the same `-embed` shape as every prior district
— no business logic in VDP, every real number comes back from each
app's own server.

**A sixteenth real integration, and a real 16th district — CHOPZ
Shorts**: closes this project's own long-carried "CHOPZ isn't placed
in the walkable world's district grid" gap, in a new 6th row
(`WORLD_HEIGHT` grown from 1420 to 1700). A live client of both CHOPZ's
own real video mechanic and CHOPZ SHOP's own real product API
(`lib/chopzClient.js`/`lib/chopzShopClient.js`) — a real product, a
real shoppable video linking to it, and a real live verification of
that link against CHOPZ SHOP's own server. **A real, flagged naming
collision, found and documented rather than silently resolved**: this
project already had an unrelated component also called "CHOPZ"
(`ChopzView.jsx`/`lib/chopz.js`, rendered outside the walkable world
entirely) — a real, different feature (8 leasable retail kiosks,
sourced from VENVS's own CLAUDE.md §4) whose local, client-side-only
store never touches the real `chopz/` app's actual API. The two share
a name purely because two separate source docs independently used
"CHOPZ" for two unrelated concepts. Neither was removed; the new
district and view are deliberately named "CHOPZ Shorts"/
`ChopzShortsView` to stay distinct in code and on screen. See
`lib/chopz.js`'s own header for the full detail.

## Run
Fourteen processes (only `vdp` itself and V3/Shield are strictly
required to boot; the rest are needed one-for-one to reach a specific
district without a real fetch error):
```
cd ../v3 && npm install && npm start                     # localhost:8811 (VCoin/VASH ledger)
cd ../shield && npm install && npm start                 # localhost:8812 (session layer)
cd ../venvs && npm install && npm run dev                # localhost:5173 (needed for the Publisher embed)
cd ../voken && npm install && npm start                  # localhost:8794 (needed for the VEX/VADO districts)
cd ../vavlt-stvdios && npm install && npm start           # localhost:8808 (needed for VENVS Stage)
cd ../vxllage && npm install && npm start                 # localhost:8796 (needed for the Village District)
cd ../cvnvo && npm install && npm start                   # localhost:8798 (needed for the Dating Village)
cd ../vago && npm install && npm start                    # localhost:8795 (needed for VAGO Casino)
cd ../vacay && npm install && npm start                   # localhost:8803 (needed for VACAY Experiences)
cd ../hvntz && npm install && npm start                   # localhost:8792 (needed for HVNTZ Hunt)
cd ../void && npm install && npm start                    # localhost:8793 (needed for VOID Marketplace)
cd ../vulture-music && npm install && npm start            # localhost:8806 (needed for Vvltvre Music, and Pods' publish step)
cd ../vulture-pods && npm install && npm start             # localhost:8810 (needed for Vvltvre Pods)
cd ../vulture-flix && npm install && npm start             # localhost:8807 (needed for Vvltvre Flix)
cd ../chopz && npm install && npm start                    # localhost:8800 (needed for CHOPZ Shorts)
cd ../chopz/chopz-shop && npm install && npm start          # localhost:8801 (needed for CHOPZ Shorts' linked product)
cd ../venvm && npm install && npm start                    # localhost:8813 (needed for VENVM Studio)
cd ../vaco-analytics && npm install && npm start            # localhost:8790 (needed for VACO Analytics)
cd vdp && npm install && npm run dev                      # localhost:5174
```
Simpler: `../start-ecosystem.sh` from the repo root brings up the whole
ecosystem (this app included) with one command.

## What's here
- `src/lib/v3Client.js` / `src/lib/shieldAuth.js` / `src/lib/persistence.js`
  — real, separate copies of VENVS's own thin client modules (not a
  shared file — two real, distinct apps consuming the same real
  backend contract). `shieldAuth.js`'s own header carries the real
  cross-origin-session caveat. **`adoptToken` (new)**: reads a real
  `?shieldToken=` off the URL on mount (the shape `vaco-shell`'s own
  launcher attaches to every outbound tile) and adopts it as this
  origin's own session instead of defaulting to `demo-user` — closes
  the direct-visit half of the cross-origin SSO gap, live-verified in
  a real browser; the embedded-iframe half is now closed too (Phase
  10, see above).
- `src/lib/world.js` — the walkable world's pure logic: a 10-district
  map (a 3x2 grid plus a real 3rd row for the Village District, Dating
  Village, and VAGO Casino, plus a 4th row for VACAY Experiences —
  `WORLD_HEIGHT` grew from 580 to 860 to 1140), clamped
  movement, district containment, "walk up to and enter" proximity +
  entry validation, clamped camera-follow math. Its own header explains
  the real `contentType` split (`venvs-embed` / `vdp-native` /
  `vavlt-stvdios-embed` / `vxllage-embed` / `cvnvo-embed` /
  `voken-embed` / `none`) that replaced the old `hasAnalogView`
  boolean, and how that resolves a genuine ambiguity in VENVS's
  original source doc between its 5-tab analog list (never included
  DEGVCHI) and its digital-mode district list (calling Fashion
  District "real content matching analog") — settled by explicit
  instruction: avatar economy is VDP's. All 8 districts now have a
  real view; there is no district left with `contentType: 'none'`.
- `src/components/WorldView.jsx` — real canvas rendering + arrow-key/
  WASD movement. Walking into Publisher renders a real `<iframe>` onto
  VENVS's own running app; walking into VEX or VADO renders `VexView`/
  `VadoView`, real clients of VOKEN's own separate API (see below);
  walking into Fashion District renders `DegvchiView` natively, Food
  District renders `FoodDistrictView` natively, VENVS Stage renders
  `StageView` (a real client of Vavlt Stvdios' own separate API), and
  the Village District renders `VillageDistrictView` (a real client of
  VXLLAGE's own separate API) — see below.
- `src/lib/vokenClient.js` / `src/lib/vexMarket.js` / `src/lib/vadoMarket.js`
  / `src/components/VexView.jsx` / `src/components/VadoView.jsx` —
  **the VEX and VADO districts, now real clients of VOKEN (Phase 7)**.
  `vokenClient.js` is a real, thin HTTP client into VOKEN's own running
  server (same posture as `cvnvoClient.js`/`vxllageClient.js`).
  `vexMarket.js` surfaces VOKEN's own real `vex-brokerage` compliance
  gate status alongside browsable vehicle-category Cvltvre Cards —
  opening a broker account is never gated, placing a real order is,
  shown honestly in `VexView.jsx` (Buy disabled while locked, never a
  silent failure). `vadoMarket.js` browses real open auctions via
  `listOpenAuctions`, a small, real, necessary addition to VOKEN's own
  `auctions.js` this integration required (no prior VOKEN route could
  list what's open, only look up one by a known id) — see
  `../voken/README.md`'s own Phase 8 entry. `VadoView.jsx` supports
  real bidding across all four of VOKEN's real auction types
  (instant/english/dutch/offer), with the live Dutch price fetched and
  displayed, not just the static starting price. Replaces this
  project's earlier VENVS iframe embed for these two districts — see
  the header note above for why. **CVLTVRE branding wired in (Phase
  7.1)**: both views now show "Part of CVLTVRE, powered by VOKEN,"
  fetched live via `vokenClient.js`'s own `getBrandInfo()` (VOKEN's
  real `GET /api/brand`) rather than hardcoded — see
  `../voken/README.md`'s own Phase 9 entry for the full comparable
  grounding (VOKEN ↔ eBay, VEX ↔ Robinhood, VADO ↔ Sotheby's/
  Christie's, CVLTVRE ↔ Fanatics).
- `src/lib/vxllageClient.js` / `src/lib/villageDistrict.js` /
  `src/components/VillageDistrictView.jsx` — **the Village District**.
  `vxllageClient.js` is a real, thin HTTP client into VXLLAGE's own
  running server (same posture as `vavltStvdiosClient.js`).
  `villageDistrict.js`'s `ensureVillageDistrict` idempotently creates
  (or reuses) one real VXLLAGE village plus two real rooms — one of
  each real `ROOM_TYPE`, `clubhouse-audio` and `discord-hangout`,
  matching the source doc's own "room types coexisting in one Village
  area" — and one real text channel. Real, deliberate, proportionate
  scope choice, documented directly in that file's own header: rather
  than a second full nested 2D engine, the district's interior reuses
  `world.js`'s own real movement/proximity/camera-clamp shape at a
  smaller scale (its own `INTERIOR_*` constants), applied independently
  rather than sharing code directly, so the two maps can evolve apart.
  `VillageDistrictView.jsx` renders that interior: walking into "Main
  Stage" shows a real, live participant list with real join/leave
  (VXLLAGE's own `villageRooms.js`); walking into "The Lounge" shows
  that district's own real channel — real messages, real posting.
  Entering the district for the first time makes the VDP player a real
  VXLLAGE village member (idempotent — a repeat "already a member"
  response is expected and swallowed, not surfaced as an error), since
  posting in the channel requires it. **A real bug found and fixed
  during this build's own Playwright pass**: the "Enter Main Stage"/
  "Enter The Lounge" button was gated behind `!enteredRoom`, so once
  any room was entered, walking to a *different* room's proximity
  never showed its own Enter button again — `enteredRoom` was only
  ever set, never cleared. Fixed by matching `WorldView.jsx`'s own
  real, already-correct pattern exactly: the Enter button's visibility
  depends only on real proximity, never on whether something else was
  already entered.
- `src/lib/vavltStvdiosClient.js` / `src/lib/stage.js` /
  `src/components/StageView.jsx` — **VENVS Stage wired to Vavlt
  Stvdios' real "up to 8 interactive screens" mechanic**. VENVS's own
  `CLAUDE.md` names Stage as an "event plaza" and explicitly flags
  real multi-camera streaming as unbuilt there ("up to 8 real camera
  feeds with AI operators"); `vavltStvdiosClient.js` is a real, thin
  HTTP client (same posture as `v3Client.js`) into Vavlt Stvdios' own
  running server; `stage.js`'s `ensureStageSession` idempotently
  creates 8 real, named camera channels (a real, flagged interpretive
  layout — no doc names specific camera roles) owned by `venvs-stage`
  and one real broadcaster `ScreenSession` combining them the first
  time anyone visits, then reuses it on every later visit rather than
  creating duplicates. `StageView.jsx` renders all 8 as a real,
  clickable grid; the focused screen shows its own real, independent
  chat (Vavlt Stvdios' own `channelChat.js`) and a real tip form that
  pays that specific screen's own named operator directly (`channelTips.js`'s
  `recipientPersonId`, never a shared Stage account) — genuine
  per-screen interactivity, not a static mockup. Unlike Food District/
  DEGVCHI, Stage's real state lives entirely on Vavlt Stvdios' own
  server — VDP holds no local copy of it, an honest architectural
  difference since this content genuinely isn't VDP's own.
- `src/lib/chopz.js` / `src/components/ChopzView.jsx` — CHOPZ
  District: 8 leasable units across 7 categories, real self-run shifts
  with a real cooldown, real AI-employee passive income computed from
  actual elapsed time. Rendered standalone below the world, same
  pre-existing gap as before the split (never placed in the world's
  district grid).
- `src/lib/degvchi.js` / `src/components/DegvchiView.jsx` — DEGVCHI's
  avatar-wearable economy: real or DEGVCHI-original branded wearables
  across Roblox's validated 3-category structure, bought with real
  VCoin, a real "one equipped item per category" mechanic.
- `src/lib/svmikoDegvchiWearables.js` — **SVMIKO DEGVCHI Avatar
  Wearables (Phase 2)**: the other real half of the SVMIKO DEGVCHI
  handoff ("first real clothing lines for VENVS *and* VDP") — one real
  virtual piece per sub-brand (13 total), mapped honestly to
  `degvchi.js`'s three real categories (`cosmetics` left unused, no
  brand's real description centers on it). Real, independently-
  reasoned virtual price scale (not VENVS's physical prices divided by
  a constant), preserving the same real luxury-vs-streetwear tiering.
  Real cross-app identity link: `creatorId` matches VENVS's own
  `ownerIdFor()` convention exactly, crediting the same real brand
  entity in both apps.
- `src/lib/foodDistrict.js` / `src/components/FoodDistrictView.jsx` —
  **Food District: real flagship restaurants (Phase 3)**: 11 real,
  named brands from `VACO_FOOD_WELLNESS_BRANDS.md` — VIVE, VIXENS,
  VORDABELLO'S, VAZAN, VODEGA, VFRESH, TACO TOWN, BIG JACK'S, NETTY'S,
  WEDGE, and a still-unnamed chicken tender spot (`nameConfirmed:
  false`, rendered with a visible "name not yet finalized" flag rather
  than a fabricated final name). Confirmed directly beforehand that no
  placeholder restaurant content had ever actually existed here —
  `contentType` was `'none'`, same honest gap as Stage — despite the
  source doc's own predecessor describing 5 placeholders to replace;
  that reference traced only to a parenthetical in VENVS's own
  `CLAUDE.md`, never implemented. Real, instant per-item purchases via
  an injected `transferFn`, paid to each brand's own distinct account
  (11 real payout accounts, not one shared platform account) — closer
  in shape to VENVS's own `shop.js` (`buyNow`) than to DEGVCHI's own
  wearable-with-equip flow, since ordering food isn't wearing it.
- `src/lib/cvnvoClient.js` / `src/lib/datingVillage.js` /
  `src/components/DatingVillageView.jsx` — **the Dating Village**.
  `cvnvoClient.js` is a real, thin HTTP client into CVNVO's own running
  server (same posture as `vxllageClient.js`/`vavltStvdiosClient.js`).
  `datingVillage.js`'s `enterDatingVillage` idempotently checks the
  player into one real, fixed BarBuddy venue (`vdp-dating-village`) —
  swallowing the expected "already checked in" response on a repeat
  visit — then fetches every other real, currently-visible checked-in
  player and records a real Happn-style proximity crossing with each of
  them via CVNVO's own unmodified `recordProximityEvent`, using one
  real, fixed shared coordinate (the St. Louis anchor this session
  already established for Cahokia Mounds/HVNTZ) for both sides, since
  VDP's own pixel grid has no real GPS meaning. `isVisibleToOthersAtVenue`
  defaults to `true` here — a deliberate divergence from BarBuddy's own
  general trust-first `false` default, reasoned in that file's own
  header: walking into a dedicated VDP district is already a visible
  act. `DatingVillageView.jsx` renders who's really checked in right
  now, a real FlashNote form to break the ice pre-match, and the
  player's own real crossing feed; leaving the district (unmount)
  triggers a real, best-effort checkout.
- `src/App.jsx` — the app shell: real Shield login, real V3 balances,
  `WorldView` + `ChopzView`.

## Verified
Live in a real browser (Playwright + this environment's pre-installed
Chromium), run against all three real servers (VENVS, VDP, and the
shared V3/Shield mock) together:
1. VDP login and world canvas render confirmed.
2. Walking to the VEX building and entering it: a real `<iframe>`
   appears, `src` confirmed pointing at VENVS's own
   `http://localhost:5173/?view=vex`; VENVS's real login screen
   confirmed rendered *inside* the embedded frame. **Historical record
   — superseded by Phase 7 below**: VEX (and VADO) no longer iframe
   into VENVS at all; see the Phase 7 entry further down for their
   current, real verification against VOKEN instead.
3. Logging in inside the embedded frame and clicking "Buy 1": a real
   purchase confirmed completed with no error, genuinely hitting
   VENVS's own running server and the shared V3 mock ledger — not a
   stub, not a mocked response.
4. Walking to Fashion District and entering it: confirmed **zero**
   iframes present and DEGVCHI's real content rendered natively.
5. Zero browser console/page errors across the entire pass.

See `../venvs/README.md`'s own Phase 10 entry for that side's matching
verification (the tab switcher, the `?view=` deep-link rendering with
zero chrome).

**Phase 9 — VAGO Casino + VACAY Experiences districts**, live in a real
browser (Playwright + this environment's pre-installed Chromium), run
against VDP, VAGO, VACAY, V3, and Shield's own real servers together:
1. Walking to VAGO Casino and entering it: real `VagoView` rendered,
   zero iframe. Starting a Mines round, revealing a tile, and cashing
   out confirmed a real 25-tile board, a real 1.125x multiplier off a
   3-mine round, and a real 11.25 VCoin payout credited via VAGO's own
   `cashOutMines` — genuinely hitting VAGO's own running server and the
   real V3 ledger.
2. Walking to VACAY Experiences and entering it: real `VacayView`
   rendered. Hosting a demo experience, booking it, and cancelling it
   confirmed real capacity tracking (6/6 → 5/6 on booking, back to 6/6
   on cancel once `refresh()` was added after cancel — an initial pass
   left the displayed capacity stale post-cancel; fixed and
   re-verified), a real booking id, and a real "Cancelled" status.
3. A real double-booking guard confirmed firing as an honest UI error
   (re-hosting the same host into an overlapping scheduled window on a
   second run correctly surfaced VACAY's own
   `createExperience: double booking` error, not a silent failure).
4. Zero browser console/page errors across the entire pass (beyond the
   one intentional double-booking error case above, which is correct
   server behavior, not a bug).

**Phase 11 — HVNTZ Hunt, VOID Marketplace, Vvltvre Music/Pods/Flix
districts**, live in a real browser, run against all 8 real servers
together (VDP, V3, Shield, HVNTZ, VOID, Vvltvre Music, Vvltvre Pods,
Vvltvre Flix) in one continuous session:
1. HVNTZ Hunt: set up a demo hunt (a real business, location, hunt,
   and checkpoint created in sequence), checked in, confirmed a real
   10 VCoin bounty paid to the signed-in user.
2. VOID Marketplace: requested a real Courier job, walked it through
   match → accept → complete → rate, confirmed the real dual payout
   sums exactly to the job total (9.6 VCoin provider payout + 2.4 VCoin
   platform fee = 12 VCoin).
3. Vvltvre Music: submitted a real single (9.99 VCoin distribution
   fee), took it live, reported 50 VCoin of streaming revenue,
   confirmed a real 40.01 VCoin net payout landed in the artist's own
   summary.
4. Vvltvre Pods: created a show, published an episode — a real,
   live cross-app call from Pods into Music, both services genuinely
   running — listened for free, then subscribed to a real paid tier.
5. Vvltvre Flix: acquired an exclusive title (real 40 VCoin
   acquisition payout), subscribed (standard tier), watched (a real
   subscription-gate check), started and ended a real stream session.
6. Zero browser console/page errors across the entire pass.

**Phase 12 — CHOPZ Shorts district**, live in a real browser, run
against V3, Shield, CHOPZ, and CHOPZ SHOP's real running servers:
1. Entered CHOPZ Shorts, posted a real shoppable video — a real 24.99
   VCoin product created on CHOPZ SHOP, a real CHOPZ video created
   linking to it.
2. Verified the linked product live against CHOPZ SHOP's own API,
   confirmed the real seller and price came back correctly.
3. Confirmed the pre-existing, unrelated `ChopzView` (leasable retail
   kiosks, outside the walkable world) still renders untouched — the
   real naming collision between the two "CHOPZ" features didn't
   break either one.

**Phase 13 — VENVM Studio and VACO Analytics districts**, live in a
real browser via Playwright, run against Shield, V3, VENVM, and VACO
Analytics' real running servers:
1. Logged in via a real Shield session — the walkable world only
   renders post-login, confirmed spawn position (430, 290).
2. Walked to VENVM Studio, entered, ran a real reformat (90s source →
   real fit/trim results across all 4 platforms), created a real
   production job, advanced it to `storyboard-ready` for real, and
   triggered a real script-generation request — confirmed the honest
   "no ANTHROPIC_API_KEY configured" failure rendered correctly
   instead of a fabricated script.
3. Walked to VACO Analytics, entered, confirmed the honest empty-state
   message with nothing ingested yet, then pushed one real metric via
   curl and confirmed a fresh visit rendered that exact real
   app/metric/value row.
4. Regression: VEX, the very first district built, still enters
   correctly — unaffected by the new districts.
5. Zero browser console/page errors across the entire pass.

**Phase 14 — Beat Marketplace district**, live in a real browser via
Playwright, run against Shield, V3, and Vvltvre Music's real running
servers:
1. Walked to Beat Marketplace, entered, confirmed the honest
   "no beats listed yet" empty state, then listed a real beat as the
   session user and confirmed it rendered in the browse list, correctly
   marked "your listing" (not self-buyable).
2. Listed a second real beat under a different real producer directly
   against Vvltvre Music's API, confirmed it rendered with a real
   `<audio>` preview player, clicked "Buy" in the real UI, and
   confirmed the real license-delivery message rendered with the
   correct beat title, license type, and price.
3. Confirmed the real VCoin balance change directly against V3 after
   the UI purchase (985 buyer / 1015 producer on a 15 VCoin beat) —
   the click in the browser moved real money, not just updated state.
4. Regression: VEX still enters correctly, unaffected.
5. Zero browser console/page errors across the entire pass.

**Phase 15 — Vvltvre Studios district**, live in a real browser via
Playwright, run against Shield, V3, Vvltvre Music, and Vvltvre
Studios' real running servers — closes one of Vvltvre Studios' own two
self-flagged gaps (the other, real music/podcast distribution, was
closed on Vvltvre Studios' own side, not here):
1. Logged in via a real Shield session, walked straight down from
   spawn to the new 20th district (a real, deliberate reuse of the
   7th row's second open slot — `WORLD_HEIGHT` did NOT need to grow
   again), entered Vvltvre Studios.
2. Greenlit a real music project through the real form, invested the
   full real budget as the session user (self-investment is allowed —
   nothing in this app's own model requires a separate investor
   identity), confirmed the project auto-advanced to `funded` in the
   UI.
3. Advanced it through `start-production` → `complete`, both via real
   button clicks, then clicked "Distribute" — confirmed the UI
   rendered "distributed via vulture-music," a real cross-app call
   Vvltvre Studios' server made into Vvltvre Music's own
   `POST /api/releases`.
4. Independently re-confirmed via direct `curl` against both apps'
   own separate APIs (not just trusting the UI's own claim): Vvltvre
   Music's `GET /api/releases/1` showed the real release with
   `coWriters: [{demo-user, 1}]`; Vvltvre Studios' own
   `GET /api/projects/1` showed `distributionApp: "vulture-music"`,
   `distributionTitleId: 1`.
5. Clicked "View equity," confirmed the real, correctly-computed
   100%-equity/50-VCoin-invested row rendered for the sole investor.
6. Full 30-app ecosystem boot confirmed unaffected (the one pre-
   existing, unrelated `v4-proxy` gap — no `ANTHROPIC_API_KEY`
   configured in this environment — aside).
7. Zero browser console/page errors across the entire pass.

**Phase 2 (SVMIKO DEGVCHI Avatar Wearables)**: 20 plain-Node checks
(13 unique real pieces, real category assignment, the luxury-vs-
streetwear tier proven at VDP's own real price scale, a real purchase
+ equip flow), plus a live pass — walked to Fashion District, all 13
real virtual pieces confirmed rendered, a real purchase and equip of
the DEGVCHI virtual coat confirmed end to end. **A real regression was
caught and fixed along the way**: equipping silently didn't update the
visible outfit — traced to this project's own `App.jsx` missing a real
re-render fix VENVS had already made once before (Phase 8) for the
same class of bug, and re-introduced here (and, it turned out,
independently re-introduced in VENVS's own `App.jsx` too) when each
shell was rewritten. Both fixed; re-verified live. See `dev-docs/` for
the full record.

**Phase 3 (Food District flagships)**: 17 plain-Node checks (11 unique
brands, unique slugs, every menu item priced, 10 brands confirmed-name
vs. 1 honestly unconfirmed, WEDGE's two named toppings present,
category coverage, per-brand payout accounts proven distinct, a real
order proven to charge the buyer and pay the specific brand's own
account — not a shared one — unknown brand/menu-item rejection, order
history correctly scoped per buyer), plus a live pass — walked to Food
District (position-readout-driven navigation), entered it, all 11
brand names confirmed rendered including the unconfirmed-name flag on
the chicken spot, a real order (WEDGE's Alfredo-Topped Wedges) placed
and confirmed appearing in "My orders," zero console/page errors. Two
real test-script bugs caught and fixed along the way: a `page.textContent('p')`
call was grabbing the wrong (first) paragraph on the page instead of
the one with the actual position readout; and the position regex
didn't account for the space after the comma in "Position: (430,
290)" — both confirmed as test-authoring issues, not app bugs, by
inspecting the real rendered text directly.

**Phase 4 (VENVS Stage — eight interactive screens)**: a full live
pass with a real browser against all three real running servers (V3/
Shield mock, Vavlt Stvdios, VDP): logged in, walked to VENVS Stage
(position-readout-driven navigation), entered it — the real "VENVS
Stage — Event Plaza" header confirmed rendered, exactly 8 real camera
tiles confirmed present (fetched live from Vavlt Stvdios, not
hardcoded), exactly 3 confirmed showing a LIVE badge matching the
server's own real state. Clicked a different tile (DJ Booth Cam) and
confirmed it became the focused screen; sent a real chat message and
confirmed it round-tripped through Vavlt Stvdios' own chat endpoint
and rendered back; sent a real tip and confirmed no error. Separately
confirmed via direct HTTP calls mirroring the exact client logic: the
operator's own V3 balance moved from 1000 → 1005 on a 5 VCoin tip
while the tipper's dropped 1000 → 995, and a second `ensureStageSession`
call correctly found and reused the existing session rather than
creating duplicate channels (the real idempotency guard). One real,
pre-existing artifact investigated and confirmed unrelated: an initial
console "Failed to load resource: 404" turned out to be the browser's
own default `/favicon.ico` request (Vite serves none) — reproduced via
3 isolated diagnostic runs, including one with zero navigation and no
login at all, confirming it fires before any of this project's code
ever runs. Zero other console/page errors across the whole pass.

**Phase 5 (the Village District)**: a full live pass with a real
browser against `venvs-mock-backend`, `vxllage`, and `vdp` all running
together: logged in, walked down to the new 7th district (position-
readout-driven navigation to the real 7th-district cell), entered it —
the real village name confirmed rendered, proving `ensureVillageDistrict`'s
idempotent create-or-reuse logic actually ran and succeeded live, not
just asserted in isolation. Walked the real interior map to Main
Stage, entered it, joined the room, and confirmed the real participant
list showed the live session's own `userId` — then left, and confirmed
it emptied again. Walked to The Lounge, entered it, sent a real chat
message, and confirmed it round-tripped through VXLLAGE's own channel
API and rendered back — proving the real auto-granted village
membership actually worked, not just returned success. One real
application bug was found live during this exact pass and fixed (see
"What's here" for the fix): the Enter button for a second room never
reappeared after entering a first one. One further console artifact
investigated directly rather than dismissed: a real `POST /api/villages/:id/join`
400 fired on every page load, traced via URL diagnostics to
React.StrictMode's own real, documented dev-only double-effect-
invocation (confirmed by reading `main.jsx` directly) — the first real
join call succeeds, the second legitimately gets a real "already a
member" response, which `ensureMembership`'s own try/catch already
handles correctly; only the raw browser network log still surfaces it.
Zero other console/page errors across the whole pass.

**Phase 6 (the Dating Village)**: a full live pass with a real browser
against `venvs-mock-backend`, `vaca`, `cvnvo`, and `vdp` all running
together, with a real second user ("carol") pre-seeded via a direct
call to CVNVO's own `/api/barbuddy/check-in` endpoint (VDP's login is
hardcoded to a single `"demo-user"`, so a second real logged-in browser
session wasn't directly testable — this pre-seed exactly mirrors what a
second real player's own `enterDatingVillage` call would have done).
Logged in, walked to the new 8th district (position-readout-driven
navigation), entered it — the real "CVNVO Dating Village" header
confirmed rendered, proving `enterDatingVillage`'s live check-in
actually ran. The pre-seeded second user ("carol") confirmed appearing
in "Here right now," and a real proximity crossing with her confirmed
recorded and rendered in the player's own crossing feed. Sent a real
FlashNote and confirmed it round-tripped with no error; independently
re-confirmed via a direct server-side read of CVNVO's own
`/api/flash-notes/carol` endpoint that the note genuinely landed. Zero
console/page errors across the whole pass. One test-script bug (not an
app bug) was caught and fixed along the way: an ambiguous
`button:has-text("Send")` selector matched both the "Send a FlashNote"
list button and the form's own "Send" submit button — fixed with an
exact-text selector.

**Phase 7 (VEX/VADO repointed to VOKEN)**: a full live pass with
`venvs-mock-backend`, `voken`, and `vdp` all running together (VENVS
itself confirmed separately below, since it's no longer needed for
these two districts): a real vehicle Cvltvre Card and a real art
Cvltvre Card minted directly on VOKEN's own server. Walked to VADO,
entered it — the real "VADO — real Cvltvre Card auctions" header
confirmed rendered (not a VENVS iframe), the real pre-seeded auction
confirmed appearing, a real bid of 20 VCoin placed and reflected live
after a refresh, independently re-confirmed via a direct server-side
read of VOKEN's own `/api/auction/1` (`currentBid: 20`,
`highestBidderId: "demo-user"`). Walked to VEX, entered it — the real,
honest "Trading is locked" state confirmed rendered (VOKEN's own
`vex-brokerage` gate defaults closed), the pre-seeded vehicle card
confirmed still browsable, a real broker account opened successfully
(never gated), Buy confirmed correctly disabled while locked, and the
account independently re-confirmed via a direct server-side read of
VOKEN's own `/api/vex/account/1`. Separately confirmed on VENVS's own
side: exactly 3 tabs (Shop, Marketplace, Publishing) render, with VEX
and VADO genuinely absent from the tab bar, not just hidden. Zero
console/page errors across the whole pass.

**Phase 7.1 (CVLTVRE branding)**: 3 plain-Node checks on VOKEN's own
`lib/brand.js` (all passing), plus a live pass confirming both VEX and
VADO render "Part of CVLTVRE, powered by VOKEN," fetched live from
VOKEN's real `/api/brand` endpoint — not hardcoded text.

## Not yet built
- Avatar/character art — the player is a rendered dot; equipped
  DEGVCHI wearables have nothing visual to render onto.
- ~~CHOPZ isn't placed in the walkable world's district grid~~ —
  closed in Phase 12 (CHOPZ Shorts, see above).
- Digital Twin Levels (1→2→3), DREAMS billboards, Residential Towers,
  Jobs/Careers, Daily Quests/HVNTZ Hunt, Skills, Population tiers,
  living NPCs (real conversation via Shield's agent layer), My Assets
  dashboard, Live World News, multiplayer/shared-world state — all
  real, named scope from VENVS's original `CLAUDE.md` §4 this project
  doesn't cover yet.
- ~~Real cross-origin Shield SSO for the embedded-iframe case~~ —
  closed in Phase 10 (see above). Both the direct-visit handoff from
  `vaco-shell` and the embedded-iframe handoff into VENVS are now real.
- VEX: only vehicle-category Cvltvre Cards are browsable here (a real,
  flagged interpretive scope choice, matching VEX's own "Robinhood-
  style trading floor" framing most directly among VOKEN's real
  categories) — VOKEN itself supports trading any category through its
  own API. VADO: offer-type auctions can be submitted here, but
  there's no seller-side UI anywhere in VDP to review/accept a real
  offer (`acceptOffer` is a seller-only VOKEN action, not exposed in
  this district).
- VENVS Stage: real video — each of the 8 screens is a real, named,
  live/offline channel record with no actual media pipeline behind it
  (`streamUrl` is a real string field, same honest posture as Vavlt
  Stvdios' own README). The specific 8 camera roles (Main Floor, DJ
  Booth, VIP Lounge, etc.) are this project's own real, flagged
  interpretive layout — no source doc names them. A Stage-side "go
  live"/"end stream" control for an actual event operator isn't
  exposed here — `StageView` is a real viewer surface, not a
  broadcaster console.
- Food District: the chicken tender spot's real final name (see
  `foodDistrict.js`'s own header — "Tenderoni" floated, not locked
  in); real menu items beyond what `VACO_FOOD_WELLNESS_BRANDS.md`
  itself confirms for TACO TOWN/BIG JACK'S/NETTY'S (the doc's own
  "to be detailed further" note); the secondary Virtual Kitchen/Port
  Station real-world extension and its 3-location kitchen grouping —
  explicitly a separate, later phase, not part of establishing the
  district's own real flagship tenants; the "VENVS Design District"
  naming question the source doc itself flags as open.
- Village District: real audio for the Main Stage room — joining is a
  real, tracked participant record with no actual voice behind it,
  same posture as Vavlt Stvdios' own Stage. QVAN's own confirmed
  security/anti-bot mandate (no-bots scoring, behavioral detection) —
  named in the source doc but not implemented anywhere in this
  ecosystem. Village boost/cosmetics purchases (real in VXLLAGE's own
  API) aren't exposed inside this district's own UI. Only one real
  village is wired in (VDP's own, auto-created); a player can't browse
  or join a *different*, pre-existing VXLLAGE village from inside VDP.
- Dating Village: only real Happn-style proximity crossings and
  FlashNotes are wired in — the other seven CVNVO dating-format
  extensions (Speed Dating, Long-Distance Mode, Blind Date, Group
  Dating, Gift Dating, Snap Map location sharing, Hunts Dates) exist as
  real CVNVO APIs but have no VDP-district surface of their own yet.
  VDP's own hardcoded single-user login (`"demo-user"`) means two real
  distinct players can't currently be tested inside the same live
  browser pass; multiplayer/shared-world state generally remains
  unbuilt (see above).
