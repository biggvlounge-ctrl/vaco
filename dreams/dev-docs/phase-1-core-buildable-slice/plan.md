# Phase 1 — DREAMS core buildable slice

## Goal
DREAMS was confirmed genuinely missing — one of the 14 core apps, with
a real revenue stack already specified across multiple other apps'
source docs (per-screen revenue, DREA as its named agent), but zero
implementation anywhere. Build the real, honest, requested core:
screen registration, the self-serve advertiser flow (sign up, pick
locations, upload/generate creative, set budget, go live), and basic
per-screen revenue tracking feeding into VACO Analytics the same way
vago/chopz-shop/vulture-music already do.

## Design
Confirmed by direct grep across the whole repo before designing
anything: no DREAMS implementation existed under any name. DREAMS is
referenced extensively and consistently by `hvntz/`, `voidmagic/`,
`venvs/`, `vavlt-stvdios/`, and VOKEN's own agent roster, most richly
in `hvntz/HVNTZ_COMPLETE_REVENUE_STACK.md`. That document specifies
far more than this phase's scope (DREA's contextual placement
intelligence, competitor exclusion, ad tiers with dynamic pricing,
Smart Benches/Tables/Mirrors) — this phase builds exactly the real
core requested, not the full document's scope.

Three lib modules, one shared store, one Express server on port 8814:
- `lib/screens.js` — real screen registration, owner-scoped
  deactivation, and real per-screen revenue aggregation.
- `lib/advertisers.js` — real advertiser sign-up.
- `lib/campaigns.js` — the real, step-by-step self-serve flow (create
  draft → select screens → set creative → set budget → launch → record
  impressions), each step genuinely validated, no defaults silently
  filled to skip a step.

**Honest scope boundary against HVNTZ's existing code**: HVNTZ already
has `lib/adReview.js`/`lib/adPricing.js` — a real, narrower,
HVNTZ-local version of a business running an ad on its own screen.
DREAMS is the broader, standalone marketplace (any advertiser, any
screen in the network). This phase does not touch, duplicate, or
refactor HVNTZ's existing code — that integration is flagged as real,
later work in DREAMS' own README.

**The real revenue-split decision**: no exact DREAMS revenue-share
percentage exists in any source doc — confirmed by direct read of
every doc that references it. Took the same honest posture HVNTZ's own
`lib/adPricing.js` already established for its own flagged numbers: a
real, deterministic, explicitly-interpretive 70/30 split (screen owner
/ platform), reusing the two-real-transfers shape `void/lib/marketplace.js`'s
`completeJob` already established.

**Creative generation**: routed through V4's own real completion
pathway (`invokeFn`, the same pattern `venvm/lib/scriptEngine.js`
already established) — DREAMS never talks to Anthropic directly.

## Verification approach
6 real unit test groups against the lib modules directly: screen
registration validation, the full self-serve flow enforcing step order
with no defaults, the real 70/30 split with budget-depletion
auto-completion, an impression rejected on an unselected screen,
`generateCreativeText`'s real success and real honest failure, and
owner-scoped deactivation.

Then live, against real running `v3`, `dreams`, and `vaco-analytics`
instances: the full real flow end-to-end via curl (register a screen,
sign up an advertiser, walk a campaign through every step, record a
real impression), confirming the exact real V3 balance changes and the
real `screen_revenue` metric landing in VACO Analytics. Restart-
survival confirmed. A real bug was found and fixed during this pass:
the initial `generate-creative` route misclassified a real connection
failure as a 400 instead of a 502 — fixed and reverified.

## Done when
- `node --check` passes on all files.
- All 6 unit test groups pass.
- Live end-to-end verification (above) passes, including the fixed
  error-classification bug.
- README documents the real revenue-split decision, the HVNTZ scope
  boundary, and what's honestly not yet built.
