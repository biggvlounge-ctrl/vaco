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
- `server.js` — the real Express API tying all three together, plus
  the real `pushMetric` call to VACO Analytics on every impression.

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
6 real unit test groups: screen registration validation, the full
self-serve flow enforcing every step in order with no silently-filled
defaults, the real 70/30 revenue split with budget depletion
auto-completing a campaign, an impression rejected on a screen not
selected for that campaign, `generateCreativeText`'s real success and
real honest failure both handled correctly (a real completion failure
never fabricates ad copy), and owner-scoped screen deactivation.

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
- No cross-link between a DREAMS screen and a real HVNTZ business
  location — the two systems are integrated at the revenue-share
  concept level (per the source docs) but not at the data level yet.
- No VDP district or other UI surface for DREAMS yet.
- Smart Benches, Smart Tables, Smart Mirrors, Viral Pack, and every
  other real physical-format extension named in
  `HVNTZ_COMPLETE_REVENUE_STACK.md` — real, later work, explicitly
  out of scope for this first, core phase.
