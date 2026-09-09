# VENVM — Marketing & DTC Capabilities

A real, concrete synthesis: given the Photo-Grounded Scene Generation
pipeline, the AI Human Twin, Gaussian Splatting 3D reconstruction, and
Jake's dual script engines — exactly what this makes possible.

Real concrete advertising formats: hyper-local, place-accurate ads —
a real business's actual storefront, not stock footage, directly
powering DREAMS' self-serve advertiser flow. The business owner
appears in their own ad using the AI Human Twin, from a single photo,
no shoot required — removes the biggest real barrier small businesses
face with video advertising. Explorable 3D previews via Gaussian
Splatting — a real location becomes a genuine walkable 3D preview, not
just a flat clip; direct DTC application: a VACAY property a guest can
explore before booking, a VENVS storefront a shopper can walk through
before buying. Narrative-driven brand content via Jake's Sudowrite-
powered engine — real Storytime-style narrative ads, not just product-
shot commercials.

DTCApplications: personalizedAdVariants (same base ad regenerated per
audience segment, realistic at scale since generation cost is
internal), virtualPropertyTours (VACAY listings explorable in 3D),
virtualStorefrontTours (VENVS shops explorable before purchase),
creatorScaleWithoutCreatorCost (consenting influencer twins star in
many more ad variations than a real shoot allows), ownerAsFace (small
businesses appear in their own marketing without hiring talent).

How this changes VENVM's role: stops being just a video-generation
tool and becomes the actual production studio behind every other
app's marketing — DREAMS advertisers, VACAY listings, VENVS
storefronts, Vvltvre promotional content, and the 8,000-video campaign
all draw from the same internal capability instead of each app
needing its own separate content solution.

Real impact on the marketing plan already built: the Facebook/Google/
AdLib test budgets already established get genuinely more effective
creative at lower marginal cost per new ad variant — the same test
budget supports more creative variations, giving a cleaner read on
what actually works before scaling spend.

---

## Implementation status (added when this file was placed into the repo)

**This document synthesizes four capabilities. One of the four is
real.** Stating that up front because the synthesis reads as though all
four are in hand, and a plan built on that reading would be building on
three things that do not exist.

| Capability | Status |
|---|---|
| **Jake's script engine** | **Real.** `venvm/lib/scriptEngine.js`, with a real `JAKE_SYSTEM_PROMPT` producing hook / beats / call-to-action scripts. |
| Photo-Grounded Scene Generation | **Not built.** No scene generation of any kind. |
| AI Human Twin | **Not built** — generation. Its *consent gate* is built and enforced; see `venvm/AI_HUMAN_TWIN_AD_GENERATION_VENVM.md`. |
| Gaussian Splatting 3D reconstruction | **Not built.** No 3D reconstruction, no splat handling, nothing adjacent. |

"Jake's **dual** script engines" also overstates by one: there is a
single engine. The Sudowrite-powered narrative variant this document
attributes to Jake is not present — `scriptEngine.js` produces
short-form video scripts, not Storytime-style narrative.

**What VENVM actually is today**: a real production *process* model —
`scriptEngine.js`, `crossPlatformReformat.js` (genuinely working
platform aspect-ratio reformatting), `productionPipeline.js` (a real
four-stage state machine with enforced ordering), and
`likenessConsent.js`. It models how content moves through production.
It does not hold or generate media. `productionPipeline.js` says so
directly: VENVM "cannot generate pixels."

### The role claim is the important part, and it is half-earned

"Stops being just a video-generation tool and becomes the actual
production studio behind every other app's marketing" is the strategic
argument here, and it is genuinely sound — one internal capability
serving DREAMS, VACAY, VENVS, and Vvltvre beats four separate content
solutions, for exactly the reasons the ecosystem already centralized
V3, Shield, and VACA.

But a production studio needs two things: a **pipeline** and a
**catalogue**. VENVM has the pipeline. It has no asset storage, no
media library, and no join to any consuming app — nothing maps a VENVM
production to a DREAMS creative, a VACAY listing, or a VENVS
storefront. So the claim describes an architecture that is correct and
a wiring that does not exist.

That join is the single most tractable item across all three VENVM
documents placed in this session, and all three arrive at it
independently: this one from the studio-role angle,
`VIDEO_LIBRARY_INFLUENCER_DISTRIBUTION_STRATEGY.md` from distribution,
and `AI_HUMAN_TWIN_AD_GENERATION_VENVM.md` from the DREAMS self-serve
angle. Three separate arguments, one missing link.

### Two applications worth separating by difficulty

**`ownerAsFace` and `personalizedAdVariants`** need generative video
plus the DREAMS join. Vendor integration, then plumbing.

**`virtualPropertyTours` and `virtualStorefrontTours`** need Gaussian
Splatting, which is a materially harder and different problem — 3D
reconstruction from captures, plus a viewer, plus hosting for assets
far larger than video. Grouping all four as one capability set
understates that gap. VACAY and VENVS both exist and could consume
tours today if tours existed; nothing about them is blocking.

### The marketing-plan claim is sound and cheap to verify later

"The same test budget supports more creative variations, giving a
cleaner read on what actually works" is the most defensible line here,
because it does not depend on quality parity — only on marginal cost
per variant being near zero, which
`venvm/VENVM_CAMPAIGN_COST_COMPARISON.md` supports (roughly $3 per
additional 30-second video). More variants per dollar is a real
statistical advantage in creative testing regardless of whether any
single variant matches agency work.

It becomes measurable the moment VENVM records real per-job cost —
which it currently does not. Same gap, from a third direction.

**Nothing in this document was built in this pass.**
