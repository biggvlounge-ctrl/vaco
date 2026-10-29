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
