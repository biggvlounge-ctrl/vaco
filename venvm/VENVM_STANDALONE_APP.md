# VENVM — Standalone App

Formalizes a real split: the AI production tool originally built for
internal VultureFlix use now becomes its own standalone app in the
Vaco App Store, under the name VENVM.

VultureFlix stays the real Netflix-style streaming platform inside
Vvltvre, unchanged. VENVM is the standalone version of the AI script-
to-storyboard-to-video-prompts tool, now its own independent app,
usable by anyone.

Explicit distinction: "Venom" (previously flagged placeholder for a
possible third VOKEN division) remains completely unrelated — VENVM is
a distinct name in a distinct part of the ecosystem.

Critical correction: Sora is being discontinued — OpenAI closed its
consumer apps April 2026, API shutting down entirely September 24,
2026. VENVM should not be built around Sora at all; treat it as a
migration source only.

Real architectural comparable: the 2026 market splits into "clip-tier"
tools (Runway, Kling, Veo, Luma, Pika, Seedance — individual 5-15
second clips) and "pipeline-tier" tools (LTX Studio, mStudio — wrap
the entire workflow into one connected system). VENVM should be built
as a pipeline-tier tool, matching LTX Studio/mStudio's architecture.

Recommended multi-model backend: Google Veo 3.1 (top-rated cinematic
quality and native audio, strongest default), Runway Gen-4.5 (best for
advertising/marketing content, tight creative/editing control), Kling
3.0 (leader in multi-shot storyboard continuity via "Elements 3.0" —
keeps characters/props consistent across shots). Honest caution: Pika
has a real reliability concern (~1.6 Trustpilot rating, credit-burning
failed generations) — avoid as primary backend despite low cost.

Confirmed real API costs (2026): Veo 3.1 Fast $0.15/sec with audio,
Standard $0.40/sec (4K, best lip-sync). Kling 3.0 $0.09-$0.14/sec, real
cost leader, self-serve API no waitlist. Runway Gen-4.5 $0.15-$0.57/sec,
but direct API access currently requires an enterprise waitlist, not
self-serve — factor in real lead time.

Recommended strategy: draft/iterate in cheap tiers, render final in
premium once direction is confirmed. Honest starting cost estimate:
$50-$300/month for early testing, scaling with real usage.

Direct connection to the marketing plan: Phase 1 ($75,000-$150,000)
already includes AI video concept development — VENVM is literally the
tool that produces this. Same pipeline generates real DTC advertising
content for VMall screens and individual HVNTZ businesses.

Status: VENVM confirmed as the standalone app name, locked-in multi-
model architecture, confirmed real API costs. All prior "VultureFlix's
internal AI tool" references now mean VENVM specifically.

---

## Implementation status (added when this file was placed into the repo)

**The split happened.** VENVM is a real standalone service —
`venvm/`, port 8813, six library modules, 14 routes, disk persistence,
its own entry in `start-ecosystem.sh` and `docker-compose.yml`.
VultureFlix is separately real at `vulture-flix/` (5 modules, 17
routes) and unchanged. Both file under the Vvltvre parent.

The naming instruction held: nothing in the codebase conflates VENVM
with the "Venom" VOKEN placeholder, and no stale "VultureFlix's
internal AI tool" references remain.

**The pipeline-tier architecture is the part that got built, and it is
the right part.** `productionPipeline.js` is a real four-stage state
machine — script-ready → storyboard-ready → render-queued → rendered —
with enforced ordering. `scriptEngine.js` ("Jake") generates real
scripts. `crossPlatformReformat.js` handles real per-platform aspect
ratios.

That is precisely the LTX Studio/mStudio shape this document argues
for: the connective tissue between steps, rather than another clip
generator. What VENVM lacks is the clip tier underneath it —
`productionPipeline.js` says so directly: VENVM "cannot generate
pixels." It accepts a real external `videoUrl` and tracks it.

So the split this document describes is real, and the honest summary
is: **the pipeline exists, the render backend does not.**

**No model backend is wired.** Veo, Kling, and Runway appear nowhere
in the code. Neither does Sora — which means the critical correction
was heeded by omission rather than by migration, since nothing was
ever built on it. Worth confirming explicitly: there is no Sora
dependency to remove.

**The cost figures have no counterpart in code**, and that is the one
concrete gap worth acting on. A production job carries no tier, no
duration, and no cost — so the $0.09–$0.57/sec spread that drives this
document's entire economic argument cannot be measured against
reality. Same gap reached independently from the costing side in
`venvm/VENVM_CAMPAIGN_COST_COMPARISON.md`. When a backend is wired,
tier and duration should land on the job at the same time.

**Per the standing evaluation instruction, three things here need
re-checking at build time rather than trusting:** the per-second
prices (generative video pricing has fallen repeatedly), the Runway
enterprise-waitlist status (a real scheduling risk if it holds), and
the Sora shutdown date, which by now has likely passed. The Pika
reliability caution is the kind of finding that ages either way and is
worth re-verifying rather than inheriting.

**Genuinely unbuilt:** the model backend, the draft-cheap/render-premium
strategy, and any App Store surface. VENVM is a service with routes,
not yet an app anyone opens.
