# AI Human Twin — Ad Generation (VENVM)

A genuinely real, proven capability — turning a single photo into a
realistic AI human twin usable directly in ad creative — added
directly into VENVM's marketing scope.

Honest note: Daulio.app's site blocks automated access, so its
specific feature set couldn't be directly verified. Grounded instead
in a real, verified, directly comparable technology already proven at
scale.

Real proven comparable — DeepBrain AI: has already built and shipped
exactly this capability. Real named example: "AI Howie," a digital
twin of comedian Howie Mandel, built for brand advertising and fan
engagement, letting him "show up" in content without physical
presence. DeepBrain has also built twins for news anchors and real
athletes (Son Heung-min), confirming this works across different use
cases.

Direct addition to VENVM, inserted into the Marketing & Advertising
Command Center:

```
AIHumanTwinAdGeneration {
  step1_photoCapture: "single-photo-or-short-video-input"
  step2_twinGeneration: "photorealistic-ai-model-of-the-person"
  step3_adPlacement: "twin-inserted-directly-into-generated-ad-scene"
    // connects directly to VENVM's PhotoRoom-style Product Studio
  useCases: [
    "influencer-likeness-in-ads-with-permission",
    "business-owner-appearing-in-their-own-DREAMS-ad-without-a-shoot",
    "VACO-ecosystem-personalities-in-marketing-content"
  ]
  consentRequirement: "explicit-permission-required-per-person"
}
```

Why this connects to what's already built: this is the same real
capability the DREAMS advertiser self-serve flow already needs — a
business owner without existing creative could generate a real ad
featuring themselves from a single photo, no shoot required.

---

## Implementation status (added when this file was placed into the repo)

**This is "twin #1"** in the three-way disambiguation recorded at
`v4-proxy/AI_HUMAN_TWIN_SCOPE.md`: a synthetic presenter inside a
pre-rendered video ad. It is a genuinely different product from V4's
agent presenter twin (real-time, interactive, on a live surface) and
from HVNTZ's unrelated "Digital Twin Level" business tier. Building
one does not advance the others.

### The generation pipeline is not built, and cannot be here

`step1` through `step3` all require real generative video
infrastructure — DeepBrain-class model hosting — which does not exist
in this repository and is not something this codebase should pretend
to. `venvm/lib/productionPipeline.js` is candid about the same ceiling
for video generally: it accepts a real `videoUrl` but "VENVM itself
cannot generate pixels."

So the three steps remain a vendor integration, correctly unbuilt.

### The consent requirement *is* built — as a hard gate, not a field

This document lists `consentRequirement` as one line in a struct.
That line is now `venvm/lib/likenessConsent.js`, and it is enforced
rather than recorded:

- `requireConsent()` is called at **every** production-pipeline
  transition — `createProductionJob`, `advanceToStoryboard`,
  `queueRender`, `markRendered` — not once at creation. Revocation
  therefore stops a job already sitting in the render queue.
- Consent is **scope-specific**, and the scopes map onto this
  document's own use cases: `likeness-still`, `likeness-animated`,
  `voice-synthesis`, `paid-media-distribution`. A job requesting a
  scope outside the grant is refused even though consent exists,
  because agreeing to a promotion is not agreeing to be synthesized.
- Records require a named recorder and an `agreementReference`
  pointing at the real signed instrument. The register points at
  consent; it does not constitute it.
- Consent expires by default rather than running perpetual.

That posture came directly from this document's own framing —
"explicit permission required **per person**" — read as a gate rather
than a checkbox, because the person depicted is not the one operating
the system and cannot decline at render time.

### A real friction this document surfaces, flagged rather than fixed

The three use cases are not equally weighted, and the gate currently
treats them identically:

| Use case | Consent shape |
|---|---|
| Influencer likeness in ads | Third-party. A signed agreement is exactly right. |
| VACO personalities in marketing | Third-party or internal. Signed agreement fits. |
| **Business owner in their own DREAMS ad** | **Self-consent.** A signed agreement is heavier than the situation warrants. |

The third case is the one this document calls the point — "removes the
biggest real barrier small businesses face with video advertising."
But `recordConsent()` requires an `agreementReference` unconditionally,
so a business owner uploading their own photo through a self-serve
flow would be blocked pending paperwork with themselves. That is a
real friction the gate introduces into the exact flow this document
exists to enable.

**Deliberately not fixed unilaterally**, because loosening a safety
gate is not a change to make on my own judgment. The shape of the fix,
if wanted: a `self` consent path where the subject is the authenticated
Shield user, with the session identity standing in for the signed
instrument — genuine consent, genuinely recorded, without inventing
paperwork. That is a small change and it is a decision, not an
oversight.

### The DREAMS connection is real infrastructure, not aspiration

"The same real capability the DREAMS advertiser self-serve flow
already needs" is accurate. `dreams/lib/advertisers.js` opens by
describing itself as "the first real step of the self-serve" flow, and
DREAMS has real campaigns, real screens, and a real creative contract
(`creativeId` + `campaignId`) from the offline-cache work. A generated
ad is a creative like any other.

What is missing is the join: nothing maps a VENVM production job to a
DREAMS creative. That is a small, real integration and the most
tractable item connected to this document — see
`venvm/VIDEO_LIBRARY_INFLUENCER_DISTRIBUTION_STRATEGY.md`, which
reaches the same conclusion from the distribution side.

**Summary:** generation unbuilt and correctly so; consent built and
stricter than specified; one real friction flagged for a decision.
