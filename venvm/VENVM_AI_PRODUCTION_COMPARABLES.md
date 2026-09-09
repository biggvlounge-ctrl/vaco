# VENVM — AI Production Comparables

Written to close a comparables-coverage gap. VENVM's existing documents
discuss capabilities extensively but never place it against the real
market.

**Scope, per standing instruction:** VENVM is the AI production and
content pipeline only. The puzzle/casual gaming system some documents
attach to it routes to VDP/VACANCY instead.

## Comparables

| Platform | What it does |
|---|---|
| **Synthesia** | Avatar-presenter video from a script; the closest analogue to the AI Human Twin concept, and an enterprise business rather than a consumer one. |
| **HeyGen** | Avatar video plus voice cloning and translation; strongest on the "your own face, many variants" use case DREAMS' self-serve flow would need. |
| **Runway** | General generative video; a creative tool rather than a presenter pipeline. |
| **Pika** | Consumer-oriented generative video. |
| **ElevenLabs** | Voice synthesis; the audio half of a twin. |
| **Descript** | Edit video by editing the transcript — the closest analogue to VENVM's *process* modeling rather than its generation ambitions. |

## The honest placement

**VENVM does not currently compete with any platform above**, and its
own code says so: `productionPipeline.js` states plainly that VENVM
"cannot generate pixels." What is built is a real production *process*
— script generation, cross-platform reformatting, a four-stage pipeline
with enforced ordering, and a hard likeness-consent gate.

Descript is therefore the only comparable in the same category today.
The rest are generation engines, and generation is exactly the piece
that needs an outside vendor.

**What that implies is a build-versus-integrate decision, not a gap to
close by writing more code.** Synthesia and HeyGen exist, work, and are
expensive to replicate. The realistic path is integrating one of them
behind VENVM's pipeline rather than building generation — which makes
VENVM the orchestration and consent layer over a vendor, and that is a
defensible position rather than a diminished one.

## Where VENVM is genuinely ahead

**The consent gate.** `likenessConsent.js` requires consent on file,
scoped to the specific use, with an agreement reference and an expiry,
enforced at every pipeline transition, and it throws rather than warns.
Scope is specific: consent to a still image is not consent to animate
or to synthesize a voice, and paid-media distribution is a separate
grant again.

No comparable above enforces anything like this structurally. Most
handle likeness rights through terms of service and an upload checkbox.
As synthetic-likeness regulation develops, a pipeline that cannot
physically run without scoped consent on file is a real asset — and it
is 15 tests deep in `venvm/test/likenessConsent.test.js`.

## What is genuinely built

`scriptEngine.js` (Jake, with a real system prompt),
`crossPlatformReformat.js` (real aspect-ratio reformatting),
`productionPipeline.js` (four-stage state machine), and
`likenessConsent.js`. Jake is VACON's 14th agent, representing this app.

## Not built

Generation of any kind — no scene generation, no avatar rendering, no
3D reconstruction. Also no asset storage and no join to consuming apps:
nothing maps a VENVM production to a DREAMS creative, a VACAY listing,
or a VENVS storefront. Three separate VENVM documents arrive at that
missing join independently, and it remains the most tractable item.
