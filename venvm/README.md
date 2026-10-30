# VENVM

The ecosystem's AI production/marketing tool. Confirmed, by direct
investigation rather than assumption, to have been the one real
shared system this ecosystem's own status audit found at a genuine
0% — no directory, route, or line of implementation existed anywhere
in this repo before this build.

## Scope boundary — read this before adding anything

**VENVM is the AI production/content pipeline. That is its whole
scope.** Script generation, storyboard/production staging,
cross-platform reformatting, and likeness consent. Nothing else.

Founder decision, recorded because the source documents blur this:
the ~20-game puzzle/casual gaming system described in
`VENVM_INTERNAL_OPERATING_SYSTEM_EXPANSION.md` (items 6–8 — Bingo,
Crossword, Sudoku, Trivia, card/board games, tournaments) is **not
VENVM's**. It belongs to **VDP's Casino/Resort district or VACON-C**,
and appears in that document only because the document happened to
cover it. Route it there when that work resumes; do not build it here.

Same caution applies generally: that expansion document describes
twelve feature areas, and several of them are other apps' work
described in VENVM's file. Check the scope boundary above before
treating anything in it as VENVM's to build.

**Real, honest source situation** (updated as documents were filed):
three of the four docs the master index references by name are now
present here — `VENVM_MARKETING_DTC_CAPABILITIES.md`,
`AI_HUMAN_TWIN_AD_GENERATION_VENVM.md`, and
`VENVM_INTERNAL_OPERATING_SYSTEM_EXPANSION.md` (the last received as a
partial, missing items 1–2). Still absent:
`PHOTO_GROUNDED_SCENE_GENERATION_CAMERA_CONTROL.md`. When this build
happened, none of them were present — checked directly (`find`/`grep`
across the whole tree), not assumed. What those references confirm: a real
production stack (Seedance 2.5, Kling 3.0, Runway Gen-4.5, Nerfstudio
3DGS, Sudowrite, Jasper) and a lead named "Jake." This build doesn't
invent a fake spec to fill that gap — it builds the real, honest,
buildable slice the same way this session builds any other
undocumented-but-obviously-real feature, and flags plainly what's out
of reach.

## Run
```
cd venvm && npm install && npm start   # localhost:8813
```
Also needs `../v4-proxy` running (with a real `ANTHROPIC_API_KEY`) for
real script generation to succeed — without it, `/api/scripts/:id/generate`
still runs for real and returns an honest error, the same way every
other agent in this ecosystem behaves without a key.

## Test
```
curl http://localhost:8813/api/health
curl -X POST http://localhost:8813/api/reformat -H "Content-Type: application/json" -d '{
  "sourceDurationSeconds": 120, "sourceAspectRatio": "16:9",
  "platforms": ["tiktok", "instagramReels", "youtubeShorts", "twitterX"]
}'
```

## What's here
- `lib/scriptEngine.js` — real script-generation requests, routed
  through V4/VACON's own real completion pathway
  (`invokeViaV4Proxy`, the identical pattern `vacon/server.js` already
  established) — VENVM never talks to Anthropic directly and never
  sees a key. A real completion failure (no key behind v4-proxy,
  v4-proxy unreachable, a real upstream error) marks the request
  `failed` with the real error attached — never a fabricated script.
- `lib/crossPlatformReformat.js` — real, deterministic reformatting
  math: given a source video's real duration (and, optionally, aspect
  ratio) and a list of target platforms, computes whether it fits each
  platform's real constraints and a real recommended trim duration if
  not. Platform specs (`PLATFORM_SPECS`) are real, publicly documented
  constraints as broadly understood — flagged directly as interpretive
  and time-sensitive (platforms change upload limits over time), same
  posture as CHOPZ's own cited TikTok Shop attribution window.
- `lib/productionPipeline.js` — a real status machine: `script-ready`
  → `storyboard-ready` → `render-queued` → `rendered`, each transition
  enforced (can't skip a stage). `videoUrl` is a real field that stays
  honestly `null` unless a caller supplies a real external one — VENVM
  itself cannot produce pixels.
- `lib/persistence.js` — the same shared, generic file-backed
  persistence module every other real app in this ecosystem uses,
  wired in from day one (not added later).
- `server.js` — the real Express API tying all three together.

## Verified
8 real unit tests across all three lib modules (a video that fits vs.
one that doesn't and gets a real recommended trim, an unknown-platform
rejection, the full production-stage progression enforced in order,
`markRendered` staying honestly `null` with no supplied URL, a real
successful script generation, and a real completion failure marking
the request `failed` with the real error — no fabricated script).

Then live, against the real running server: a real reformat call
(confirmed correct fits/doesn't-fit/aspect-change flags across all 4
platforms), a full real production-job progression through all 4
stages, and a real script request whose `/generate` call correctly
returned a real 502 with the real error, since `v4-proxy` is honestly
down in this environment (no `ANTHROPIC_API_KEY` configured) — proving
the failure path is real, not just written and assumed to work.
Restart-survival also confirmed: killed the running process, restarted
it, and the same real production job came back unchanged.

## Not yet built
- Actual video rendering — no rendering infrastructure
  (Seedance/Kling/Runway/Nerfstudio-class tools) exists in this
  environment. This is a real, permanent ceiling for this session, not
  a deferred task — the same category of gap as Vavlt Stvdios' own
  `streamUrl`.
- Storyboard generation itself is a real, plain data field
  (`advanceToStoryboard` takes a caller-supplied storyboard) — no AI
  storyboard-generation logic exists yet; only script generation is
  wired to a real completion call.
- No VDP district or any other UI surface for VENVM yet.
- No real economic/fee model — no source doc grounds pricing for this
  internal production tool the way every consumer-facing app's real
  economics were grounded in a named comparable; not invented here.

## Marketing/Campaign Dashboards (task #59)

Real data-model and analytics scaffolding for: Marketing Dashboard,
Campaign Dashboard, Ad Dashboard, Brand Management, Product Launch
Manager, Content Calendar, Asset Library, AI Analytics, and AI A/B
Testing. Every module's **analytics/tracking half is real** — plain
record-keeping and deterministic math, no model call required. Every
module's **generative half** (ad copy, brand voice, launch copy,
variant creative, content-slot suggestions, analytics insights) is a
single, clearly-labeled pending integration point via
`lib/pendingIntegration.js`'s `pendingGenerationCall()` — it throws a
`PendingIntegrationError` naming exactly what is blocked and why,
never a fabricated result standing in for a real one, the same
posture `scriptEngine.js` already takes for a real completion
failure.

- `lib/brandManagement.js` — **Brand Management**: a real brand
  profile (`name`, `ownerApp`, `voice`, `colors`, `logoUrl`) every
  other module below hangs its own records off of via `brandId`.
  `updateBrandGuidelines` only changes fields a caller actually
  supplies. `ownerApp` is left open (dreams/vacay/venvs/vvltvre/…),
  the same "real examples, not an exhaustive list" posture
  `referralType` already takes in `growthPrograms.js`.
- `lib/assetLibrary.js` — **Asset Library**, and the real join
  `VENVM_MARKETING_DTC_CAPABILITIES.md` itself flags as the single
  most tractable gap across all three VENVM documents in this repo:
  "VENVM has no asset storage, no media library, and no join to any
  consuming app." `catalogAsset` records that a real asset (a script,
  a production job's output, or an externally supplied `url`) belongs
  to a brand, optionally a campaign, and is consumed by a named app +
  reference id — it does not hold media itself. `recordAssetReuse` is
  a real, append-only log of every place a catalogued asset is reused
  again — the actual `personalizedAdVariants`/
  `creatorScaleWithoutCreatorCost` mechanic that document describes,
  built as a plain record, not a generative capability.
- `lib/campaigns.js` — **Campaign Dashboard**'s own data model: a real
  campaign under a brand, with a real, enforced status machine
  (`draft` → `active` ⇄ `paused` → `completed`, looser than
  `productionPipeline.js`'s strictly linear stages because a real
  campaign genuinely does pause and resume) and a real, append-only
  spend log — `campaignSpendTotal`/`campaignRemainingBudget` are
  derived fresh every call, the same "never cache a number that can
  drift" rule `ambassadorScorecard` already holds. `budget: null`
  means honestly unbudgeted, not zero.
- `lib/adDashboard.js` — **Ad Dashboard**: a real ad under a campaign
  with a real, append-only metrics log (impressions/clicks/
  conversions/spend as periodic snapshots, not a running total a
  caller maintains). `adPerformance` sums the real log and computes
  real, deterministic CTR/CPA/conversion-rate — honestly `null` when
  a ratio's real denominator is zero, never a divide-by-zero or a
  guess.
- `lib/contentCalendar.js` — **Content Calendar**: a real scheduled
  publish slot (brand, optional campaign/asset, platform,
  `scheduledAt`) with a real, enforced status machine (`scheduled` →
  `published` or `cancelled`, both terminal). `listUpcoming` filters
  to real, still-scheduled entries at or after a given time.
- `lib/productLaunches.js` — **Product Launch Manager**: a real
  launch under a brand with a real milestone checklist.
  `completeMilestone` is idempotent, the same posture `followCard`/
  `markNotificationRead` already hold elsewhere in this ecosystem for
  a repeat call. `launchReadiness` is a real, derived percentage of
  milestones actually marked done — never stored and left to go
  stale.
- `lib/abTesting.js` — **AI A/B Testing**, and the "AI" overstates by
  the same margin flagged elsewhere in this ecosystem: variant
  *assignment* and *result tracking* are both real, deterministic math
  — a stable FNV-1a hash of `(testId, subjectId)` picks the same real
  variant for the same real subject every time, with no per-assignment
  state beyond the one real conversion fact this module needs.
  `abTestResults` tallies real per-variant assigned/converted counts
  and conversion rates, and only names a `leadingVariant` once every
  variant has a real `minSampleSize` (default 30, a flagged,
  interpretive default like `AMBASSADOR_TIERS`) — honestly `null`
  below that, never a winner crowned off a statistically meaningless
  handful of samples. Only the variants' own creative generation
  needs a model; that's the one pending integration point here.
- `lib/marketingAnalytics.js` — **AI Analytics**' real half: a plain,
  open-`eventType` event log (the same shape `cardEngagement.js` uses
  in VOKEN) plus real, deterministic aggregation —
  `analyticsSummary`'s counts-by-type and `clickThroughRate` are
  direct sums/divisions over real events, honestly `null` with no
  real views to divide by. Reading those real numbers and writing out
  a plain-language insight is the one pending integration point.
- `lib/marketingDashboard.js` — the **Marketing Dashboard** and
  **Campaign Dashboard** themselves: real, unified rollups, the same
  "collapse several real calls into one" shape VOKEN's own
  `cardFullDetail.js` already established — nothing new is computed
  here, it only assembles already-real, already-tested functions from
  every module above.
- `lib/pendingIntegration.js` — the one shared, honest stub every
  generative sliver above calls, instead of each module inventing its
  own ad-hoc "not implemented" error.

Mounted in `server.js` under `/api/marketing/...` (brands, assets,
campaigns + `/dashboard`, ads, content-calendar, launches, ab-tests,
analytics), gated the same "apps submit briefs" way the rest of this
server already gates service-level writes:
`requireCallingService()` — this is internal marketing tooling, with
no end-consumer session that owns a brand or campaign. Every
`.../generate` route returns a real `501` with the real
`PendingIntegrationError` message, never a fabricated 200.

Verified live against the real running server (`VACO_SERVICE_TOKENS`
set, a real `X-Service-Name`/`X-Service-Token` credential presented):
a full real brand → campaign → spend → ad → metrics → performance
chain, both dashboard rollups returning the correct real assembled
figures, and a `.../copy/generate` call correctly returning a real
501 with the real pending-integration message. See each lib module's
own test file (`test/brandManagement.test.js`,
`test/assetLibrary.test.js`, `test/campaigns.test.js`,
`test/adDashboard.test.js`, `test/contentCalendar.test.js`,
`test/productLaunches.test.js`, `test/abTesting.test.js`,
`test/marketingAnalytics.test.js`, `test/marketingDashboard.test.js`).

**Not built here, for the same reason `growthPrograms.js` already
gives**: no generative/predictive model provider is configured in
this environment (checked directly — no OpenAI/Replicate/ElevenLabs/
etc key anywhere), so copywriting, image, video, voice, translation,
SEO, social, email, SMS, and push generation all stay real, labeled
pending integration points rather than faked.

## Frontend coverage pass (30 Oct 2026)

An audit found `public/index.html` making real calls against only 7 of
this app's 66 routes — the original 4 tabs (Scripts, Reformat,
Pipeline, Consent) covered the core production pipeline, but
`lib/growthPrograms.js` (8 routes) and the entire task #59 Marketing/
Campaign Dashboard surface (44 routes across 8 modules) had **zero**
frontend exposure. Three new tabs close most of that gap — 25 more
routes, every one a real client of the route named, checked against
its real handler and `lib/*.js` function and then verified live
against the running server before being written, never a fabricated
payload shape.

Consistently left backend-only, by design, across every new tab:
anything gated to `requireCallingService()` (a trusted-service
credential — creating a brand/campaign/asset/ad/content-calendar
entry/launch/A/B test, recording spend/metrics/analytics events,
advancing a campaign's status, converting or rewarding a referral) and
every `.../generate` route (ad copy, brand voice, campaign
optimization, content-slot suggestions, launch copy, variant copy,
analytics insights — all a real, labeled `PendingIntegrationError`, a
real 501, since no generative model provider is configured anywhere in
this environment). This frontend has no login for a trusted-service
credential, so those stay real backend capabilities without a fake
"admin" UI pretending to hold one.

- **Growth tab** — `lib/growthPrograms.js` had no frontend at all.
  Unlike the other two new tabs, two of its routes genuinely are
  reachable from a signed-in person's own session:
  `POST /api/growth/referral-codes` (`requireActor('ambassadorId')`)
  lets an ambassador create their own code, and
  `POST /api/growth/referrals` (`requireActor('referredId')`) lets a
  new recruit record their own referral — the same
  "you may only act as yourself" shape the existing Consent tab's
  grant/revoke already uses. Also looks up a code or referral by id
  (`GET /api/growth/referral-codes/:code`,
  `GET /api/growth/referrals/:id`), auto-loads your own real ambassador
  scorecard when signed in
  (`GET /api/growth/ambassadors/:ambassadorId/scorecard`), and checks
  progress on a named growth mission
  (`GET /api/growth/ambassadors/:ambassadorId/missions/:missionKey`) —
  with the mission list and ambassador tiers read live from
  `GET /api/health` rather than hardcoded. Converting and rewarding a
  referral are operational facts an app observed (a real purchase, a
  real published video) and stay `requireCallingService()`-only.
- **Brands tab** — `lib/brandManagement.js`, `campaigns.js`, and
  `assetLibrary.js` (Brand Management, Campaign Dashboard, Asset
  Library) had no frontend at all. Browses brands, optionally filtered
  by `ownerApp` (`GET /api/marketing/brands`); looks up a brand
  together with the real, unified Marketing Dashboard rollup — its
  campaigns with spend/remaining budget, upcoming content, launch
  readiness, and analytics, all assembled from already-real, already-
  tested functions (`GET /api/marketing/brands/:id`,
  `GET /api/marketing/brands/:id/dashboard`); lists a brand's campaigns
  and looks up one campaign together with the real Campaign Dashboard
  rollup — its ads with real CTR/CPA performance, catalogued assets,
  and any A/B test scoped to it
  (`GET /api/marketing/brands/:id/campaigns`,
  `GET /api/marketing/campaigns/:id`,
  `GET /api/marketing/campaigns/:id/dashboard`); and lists/looks up
  assets for a brand (`GET /api/marketing/brands/:id/assets`,
  `GET /api/marketing/assets/:id`). Creating a brand/campaign/asset,
  updating guidelines, changing campaign status, and recording spend
  all stay `requireCallingService()`-only.
- **Ads & Launches tab** — `lib/adDashboard.js`, `contentCalendar.js`,
  `productLaunches.js`, `abTesting.js`, and `marketingAnalytics.js`
  (Ad Dashboard, Content Calendar, Product Launch Manager, AI A/B
  Testing, AI Analytics) had no frontend at all. Lists a campaign's
  ads and looks up one ad's real performance totals/ratios
  (`GET /api/marketing/campaigns/:id/ads`,
  `GET /api/marketing/ads/:id/performance`); lists a brand's upcoming
  content and looks up one calendar entry
  (`GET /api/marketing/brands/:id/content-calendar/upcoming`,
  `GET /api/marketing/content-calendar/:id`); lists a brand's launches
  and looks up one launch's real milestone checklist plus derived
  readiness percentage (`GET /api/marketing/brands/:id/launches`,
  `GET /api/marketing/launches/:id`,
  `GET /api/marketing/launches/:id/readiness`); looks up an A/B test's
  real per-variant assigned/converted/conversion-rate tally and leading
  variant (`GET /api/marketing/ab-tests/:id`,
  `GET /api/marketing/ab-tests/:id/results`); and looks up a brand's
  real analytics summary, optionally scoped to a campaign
  (`GET /api/marketing/brands/:id/analytics/summary`). Creating an
  ad/content-calendar entry/launch/A/B test, recording metrics,
  publishing/cancelling content, completing a milestone, assigning a
  variant, and recording an analytics event all stay
  `requireCallingService()`-only.

**Deliberately left for a follow-up round, with reasons:**

- **Every `requireCallingService()` creation/mutation route named
  above.** This frontend has no trusted-service credential to present,
  and inventing a fake "admin mode" that always 403s would be worse
  than the honest gap — the same call `void`'s coverage pass already
  made for fleet operations and dispatcher routes.
- **Every `.../generate` route.** All honestly 501 with a real
  `PendingIntegrationError` today; a button that always fails is not a
  real control, and this page already shows that posture correctly for
  Scripts' own `/generate` route.
- **`POST /api/scripts`, `POST /api/production-jobs`, and their
  advance-stage routes.** Still `requireCallingService()`-only,
  unchanged from before this pass — see the Scripts/Pipeline tabs'
  existing notices.
- **A per-row "drill in" affordance on the Brands/Ads & Launches list
  tables** (e.g. clicking a campaign row to pre-fill the detail form
  below it) would read nicely, but each list and its matching detail
  lookup already call distinct, real routes today; that refinement is
  a UX polish on working coverage, not a gap, so it was left for
  whoever picks this up next rather than rushed in alongside three new
  tabs in one pass.
