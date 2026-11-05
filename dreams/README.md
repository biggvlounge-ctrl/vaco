# DREAMS

The ecosystem's ad/screen network — real screen registration, a real
self-serve advertiser flow (sign up, pick screens, upload/generate
creative, set budget, go live), and real per-screen revenue tracking.

**Real, honest source situation**: no DREAMS implementation existed
anywhere in this repo before this build — confirmed by direct grep
across the whole tree, not assumed. DREAMS itself is referenced
extensively and consistently across `hvntz/`, `voidmagic/`, `venvs/`,
`vavlt-stvdios/`, and VOKEN's own agent roster ("DREA for DREAMS," the
same naming convention as HVNTER for HVNTZ, Gibson for VOID dispatch,
Kevin for CVNVO), but always as an external system those apps
integrate with conceptually — never as a real, standalone app of its
own. Built directly against that real, cross-referenced spec, most
concretely `hvntz/HVNTZ_COMPLETE_REVENUE_STACK.md`'s "DREAMS screen ad
revenue," "DREAMS screen DTC commission," and "Ad tier system"
sections.

**Honest scope note — HVNTZ already has a related, narrower feature**:
`hvntz/lib/adReview.js` and `hvntz/lib/adPricing.js` implement a
real, HVNTZ-local version of "a business submits ad content to run on
its own screen," tied into HVNTZ's own revenue-stack payouts. That is
a genuinely different shape from what's built here: DREAMS is the
standalone marketplace where *any* advertiser signs up and buys
placement across the *whole* network, not just their own location.
The two are complementary, not duplicates, and this build doesn't
touch or refactor HVNTZ's existing code — a future integration
connecting DREAMS' own screen registry to HVNTZ's business locations
is real, later work, not assumed or forced into this pass.

## Run
```
npm install && npm start   # localhost:8814
```
Also needs `../v3` running (for real payment transfers) and, for the
optional creative-generation endpoint, `../v4-proxy` running with a
real `ANTHROPIC_API_KEY` — without it, `/api/campaigns/:id/generate-creative`
still runs for real and returns an honest 502, the same way every
other agent-backed endpoint in this ecosystem behaves without a key.

## Test
```
curl -X POST http://localhost:8814/api/screens -H "Content-Type: application/json" -d \
  '{"screenOwnerId":"gym-owner","locationName":"Gym Front Desk","locationAddress":"456 Fitness Ave"}'
curl -X POST http://localhost:8814/api/advertisers -H "Content-Type: application/json" -d \
  '{"advertiserId":"protein-co","businessName":"Protein Co"}'
curl -X POST http://localhost:8814/api/campaigns -H "Content-Type: application/json" -d \
  '{"advertiserId":"protein-co","name":"Gym Launch"}'
```

## What's here
- `lib/screens.js` — real screen registration (`registerScreen`,
  `listActiveScreens`, `deactivateScreen`, owner-scoped) and real
  per-screen revenue aggregation (`getScreenRevenue`).
- `lib/advertisers.js` — real advertiser sign-up, the first step of
  the self-serve flow.
- `lib/campaigns.js` — the real, step-by-step self-serve campaign
  flow: `createCampaign` (draft) → `selectScreens` (pick locations,
  every screen must be real and active) → `setCreative` (upload — a
  real, honestly-nullable `creativeUrl`/`creativeText`) or
  `generateCreativeText` (generate — routed through V4's own real
  completion pathway, same `invokeFn` pattern `venvm/lib/scriptEngine.js`
  already established) → `setBudget` → `launchCampaign` ("go live,"
  real validation that every prior step genuinely completed, no
  defaults silently filled) → `recordImpression` (a real per-screen ad
  run).
- **Scan and sale revenue, new (16 Oct 2026)** — the founder's own
  follow-up on VOID DROP's screens: "we will run our ads... plus the
  renter's personal ads, [and the renter] will receive a small
  percentage of scans and sales on the screens." `setScanPricing` +
  `recordScan` price and settle a scan the same 70/30 shape as an
  impression (drawn from the campaign's own ad-spend budget, same as
  an impression); `setSaleCommission` + `recordSale` commission a real
  percentage of an actual sale's own value instead — a referral shape,
  not a flat cost, and deliberately *not* metered against ad-spend
  budget, since a performance payment on money the advertiser already
  made is a different thing from money spent to be seen. Both pay
  whoever is registered as `screenOwnerId` — for a VOID DROP asset,
  that's now the current renter, not VOID's own platform account (see
  `void/VOID_DROP.md`'s "DREAMS screens" section).
- `server.js` — the real Express API tying all three together, plus
  the real `pushMetric` call to VACO Analytics on every impression,
  scan, and sale.
- **Required real incentive, per direct instruction (9 Oct 2026)**:
  "everything has to be used to give away something, a coupon, a
  percentage off, even if it's a large corporation." `setIncentive`
  (`percent-off`, `amount-off`, or `coupon`) is now required before
  `launchCampaign` will let a campaign go live — no exception for
  advertiser size.
- **Screen-purchase scaling, confirmed already real (9 Oct 2026)**:
  "as businesses grow, they can have the option of using as many
  screens that are available for purchase." `selectScreens` already
  had no cap on screen count — a growing advertiser's only real limit
  is how many active screens exist and the budget they set.
- **Government emergency broadcast, new (9 Oct 2026)**:
  `lib/emergencyBroadcast.js` -- "these screens can all be controlled
  as once by the government to give out one message" for a real
  weather emergency, a wanted/missing-person alert, or an off-grid
  search. Service-credential-only (`requireCallingService`), since the
  AI-run government has no end-user session to present. Exactly one
  active broadcast at a time, by design -- a second push replaces the
  first. `GET /api/screens/:id/content` is the one real, universal
  "what should this screen show right now" resolver: an active
  broadcast overrides every real screen; otherwise it defers to the
  existing offline-cache fallback. **Not yet wired to a real caller**:
  no app in this ecosystem currently has a real "wanted criminal still
  at large" or "missing person" game event to trigger this from, so
  VDP (the natural caller, as the world's own AI-run government) does
  not call it yet -- the receiving mechanism is real and tested; the
  trigger is real, later work, not invented here to fill the gap.

## The real revenue-split decision
No exact DREAMS revenue-share percentage is given anywhere in any
source doc — `HVNTZ_COMPLETE_REVENUE_STACK.md` and
`HVNTZ_VOID_STATION_REVENUE_STRUCTURE.md` both refer to "DREAMS'
standing revenue-share model" as already established without stating
the number, and HVNTZ's own `lib/adPricing.js` already flagged its own
base ad prices the same honest way. `recordImpression` takes the same
posture: a real, deterministic, flagged-interpretive **70/30 split**
(screen owner / `dreams-platform`) — a real, common range for
digital-out-of-home ad network deals, not a number pulled from any doc
in this repo. Two real transfers per impression (screen-owner payout +
platform fee), the same two-real-transfers shape `void/lib/marketplace.js`'s
own `completeJob` already established, guaranteeing the two amounts
always sum to the exact real cost.

## Verified
7 real unit test groups: screen registration validation, the full
self-serve flow enforcing every step in order with no silently-filled
defaults, the real 70/30 revenue split with budget depletion
auto-completing a campaign, an impression rejected on a screen not
selected for that campaign, `generateCreativeText`'s real success and
real honest failure both handled correctly (a real completion failure
never fabricates ad copy), owner-scoped screen deactivation, and scan/
sale revenue (`setScanPricing`/`recordScan`, `setSaleCommission`/
`recordSale` — the 70/30 split on both, a scan drawing down the
campaign's ad-spend budget the same as an impression, a sale's
commission deliberately not drawing it down at all).

Then live, against real running `v3`, `dreams`, and `vaco-analytics`
instances: registered a real screen, signed up a real advertiser,
walked a real campaign through every step of the self-serve flow
(pick locations → creative → budget → launch), recorded a real
impression and confirmed the exact real balance changes against V3
(advertiser −10, screen owner +7, `dreams-platform` +3), confirmed
`GET /api/screens/:id/revenue` aggregated correctly, and confirmed the
real `screen_revenue` metric landed in VACO Analytics.
Restart-survival also confirmed: killed the running process,
restarted it, and the same real campaign/screen data came back
unchanged.

**A real bug found and fixed during live verification**: the first
version of `/api/campaigns/:id/generate-creative`'s error-status logic
checked for the substring `"invokeViaV4Proxy"` in the thrown error
message to decide 502 vs. 400 — but a real connection failure (v4-proxy
not running at all) throws Node's own generic `"fetch failed"`, which
never contains that substring, so the honest failure was incorrectly
returned as a 400 instead of a 502. Fixed by having
`generateCreativeText` wrap its own `invokeFn` call and rethrow with a
distinguishable `"completion failed: ..."` prefix, which the route
matches on reliably — confirmed with a real v4-proxy-down request
returning the correct 502 afterward.

## Frontend coverage pass (31 Oct 2026)

An audit found `public/index.html` making real calls against only 14
of this app's 31 routes — the original 4 tabs (Screens, Advertisers,
New Campaign, Offline) covered the core self-serve loop, but several
real, already-built features had no frontend exposure at all. Every
call below was checked against the real route in `server.js` and the
real handler signature in its `lib/*.js` function before being
written — never a guessed field name. 24 of 31 routes are now real
frontend clients; the remaining 7 (`GET /api/health`, the service-
credential-only impression/scan/sale/offline-play reporters, and the
government's emergency-broadcast push/clear) are correctly left
backend-only, since none of them has a legitimate end-user or
screen-owner session to present — see `requireCallingService` in
`server.js`.

- **Scan & sale pricing, in the New Campaign flow** — `setScanPricing`
  and `setSaleCommission` (the "Scan and sale revenue" feature above)
  had no frontend at all. Two new form steps sit next to budget and
  incentive; the campaign status line now also shows the real
  per-scan cost and sale-commission rate once set.
- **A pre-existing dead call, fixed in passing** — "Generate creative
  text (AI)" posted an empty body, but `generateCreativeText` requires
  a real `brief`; every real click 400'd. Now a brief field feeds the
  real field.
- **Screen lookup and deactivation, in the Screens tab** — `GET
  /api/screens/:id` (a screen the active-only list won't show once
  deactivated) and `POST /api/screens/:id/deactivate`, shown only to
  the signed-in owner on their own screen tile — the one screen-owner
  control that had no frontend path at all.
- **Advertiser profile, in the Advertisers tab** — `GET
  /api/advertisers/:id` is now fetched alongside the existing
  campaigns lookup, so looking up an advertiser shows their real
  `businessName` and signup date instead of jumping straight to
  campaigns.
- **Offline-cache owner tools, in the Offline tab** — `POST
  /api/screens/:id/cache/sync` (the real owner-facing sync step from
  `lib/offlineCache.js`), `GET /api/screens/:id/cache`, and `GET
  /api/screens/:id/offline-content` (the real "what would this screen
  show right now" resolver, including the honest `blank` case). None
  of the three had any frontend before. The offline-plays table's
  `playCount` column, which read a field `getOfflinePlays`' real
  per-play record has never had, was also corrected to the record's
  real fields (`creativeId`, reporting lag).
- **New Emergency tab, read-only** — `GET /api/emergency-broadcast`
  (active status + history) and `GET /api/screens/:id/content`
  (`resolveScreenContent`'s real, broadcast-aware resolver). Pushing
  or clearing a broadcast stays backend-only by design (service-
  credential-only, no end-user session), so this tab is deliberately
  a status view, not a control panel.

## The Dreams Wallet (31 Oct 2026)

**What a real person collects by scanning a real screen — new
`lib/wallet.js`, new Wallet tab.** Every DREAMS campaign already has
to give something away before it can go live (`setIncentive` — a
coupon code or a percent/amount off; `launchCampaign` refuses to run
without one). What was missing was anywhere for the person who
scanned to actually keep it.

**Deliberately separate from `recordScan`.** That function is a
service-credential, anonymous billing event — a screen or kiosk
backend reports "a scan happened" so the advertiser and screen owner
get paid; it has never known *who* scanned. The wallet is the other
half: a real person, signed into a real Shield session (the same
identity model every other end-user action in this ecosystem already
uses), collects the campaign's own incentive by scanning. The two can
both happen from the same physical scan, by two different real
actors, and `collectIncentive` never calls or depends on `recordScan`
— whether an advertiser owes scan-pricing revenue is a separate
question from whether a person is owed a coupon.

**One collected item per person per campaign, by direct instruction.**
Scanning the same campaign's screen again answers "already collected"
rather than minting a second coupon — closes the obvious free-coupon-
farming case.

**Redeeming is a status flag, by direct instruction — not a real
checkout integration.** A person marks their own coupon "used",
exactly like tearing a paper coupon. Nothing here talks to VENVS or
any other checkout; that would be real, separate, later work.

**Routes:** `POST /api/campaigns/:id/collect` (`requireActor('userId')`
— the real scanning person's own session, never a service credential),
`GET /api/wallet/:userId` (`requireParamActor('userId')` — only the
owner may read their own wallet), `POST /api/wallet/:id/redeem`
(a new `requireWalletOwner()` guard, same ownership-resolution shape
as `requireCampaignAdvertiser`/`requireScreenOwner`).

**"Connect the Dreams wallet to VASH so you can see both" — by direct
instruction.** `GET /api/wallet/:userId` also returns a live
`vashBalance`, read server-side from V3's own `GET
/api/vash/balance/:userId` (the same read-only client shape
`venvs/src/lib/v3Client.js` already uses) — DREAMS keeps no VASH data
of its own and never will. Fails soft: if V3 is briefly unreachable
the real coupons still render, with `vashError` saying why the
balance is missing rather than silently showing 0 (a real balance a
reader could mistake for a true one).

**Verification performed:** `test/wallet.test.js` (collecting,
duplicate refusal, screen-not-on-campaign refusal, a non-live campaign
refusal, redemption, double-redemption refusal, cross-user redemption
refusal, per-user listing) and new guard-proof tests in
`test/server.test.js` (anonymous refusal on all three new routes, a
service credential refused where a real session is required) — 60/60
passing. Also run live against a real Shield + V3 + DREAMS stack: a
real session, a real live campaign, collect → duplicate-refused →
wallet read (with a genuine live VASH balance) → redeem →
double-redeem-refused → a different signed-in person refused read
access to someone else's wallet — all over real HTTP, not just
asserted in a unit test. The frontend's Wallet tab was driven in a
real headless browser end to end (collect, the "already collected"
refusal, redeem, the VASH balance rendering) — which is also how a
real bug was caught and fixed: `VACO.price()` returns a `<span>` node,
not text, and the balance card's first draft stringified that node
("[object HTMLSpanElement]") instead of rendering it.

## Not yet built
- **DREA's full placement intelligence** — `HVNTZ_COMPLETE_REVENUE_STACK.md`
  specifies extensive real logic for DREA (contextual venue matching,
  competitor-exclusion rules, a borderline-case flagging system, ad
  tiers with dynamic traffic-based pricing) — none of that is built
  here. This phase is the real, honest "core" requested: screen
  registration, self-serve campaign creation, and per-screen revenue —
  not DREA's own intelligence layer.
- Ad content review workflow (pending/approved/rejected) — HVNTZ
  already has a real, narrower version of this
  (`hvntz/lib/adReview.js`); a DREAMS-side equivalent for its own
  broader advertiser base is real, later work.
- No real image/video creative hosting — `creativeUrl` is a real,
  honestly-nullable, caller-supplied field, same class of gap as Vault
  Studios' own `streamUrl`.
- No VDP district or other UI surface for DREAMS yet.
- Smart Benches, Smart Tables, Smart Mirrors, Viral Pack, and every
  other real physical-format extension named in
  `HVNTZ_COMPLETE_REVENUE_STACK.md` — real, later work, explicitly
  out of scope for this first, core phase.

## Real DREAMS screen ↔ HVNTZ business location cross-link (5 Nov 2026)

Closes this project's own flagged gap: "the two systems are integrated
at the revenue-share concept level (per the source docs) but not at
the data level yet." A screen now carries real, optional
`hvntzBusinessId`/`hvntzLocationId` fields — `null` until linked,
same "optional, not forced on every screen" posture as VOID DROP's own
`hasDreamsScreen` cross-link.

`linkHvntzBusinessLocation(store, { screenId, hvntzLocationId,
hvntzLocationFetchFn })` (new, `lib/screens.js`) reads the real
location straight from HVNTZ (`GET /api/location/:id`, injected as
`hvntzLocationFetchFn`, the same cross-app pattern this ecosystem uses
everywhere) and stores its own real `businessId` — never a
caller-declared pair that could claim a mismatched business/location.
`unlinkHvntzBusinessLocation` clears both fields. `POST
/api/screens/:id/link-hvntz-location` and `POST
/api/screens/:id/unlink-hvntz-location` (new), both
`requireScreenOwner()`-gated — this is the screen's own metadata, same
guard as deactivation.

### Verification

`test/hvntzLink.test.js` (new, 8 tests): no link by default, the
`hvntzLocationFetchFn` requirement, refusal for an unknown screen,
refusal when HVNTZ returns no location, the real businessId stored
from a live fetch, a caller-declared `hvntzBusinessId` correctly
ignored in favor of the real one (mutation-verified: making the code
prefer a caller-supplied value over the live HVNTZ answer turned
exactly that test red; restored and reconfirmed green), unlink
clearing both fields, and unlink's own unknown-screen refusal. Full
suite: 67/68 (one pre-existing, unrelated failure in
`test/server.test.js` — a Shield-unreachable 502-vs-401 case,
confirmed via `git stash` to fail identically with this change
removed).

Live-verified against real spawned Shield + HVNTZ + DREAMS servers: a
real screen registered with both fields `null`; a link attempt
against a nonexistent HVNTZ location id was correctly refused with
HVNTZ's own exact "no location with id" error; linking the real seeded
HVNTZ location (id 1) populated the screen's own live record with the
real `businessId` (1) read from HVNTZ, not supplied by the caller; and
unlinking cleared both fields back to `null`.
