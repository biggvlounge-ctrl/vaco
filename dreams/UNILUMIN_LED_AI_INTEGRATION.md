# Unilumin — LED Hardware & AI Integration (v1)

Real, current research on Unilumin, world's #1 LED display
manufacturer for 3 consecutive years, over $1.1B+ revenue. Real
strategic pivot: "from Display Hardware Supplier to AI Intelligent
Service Application Provider" — directly parallel to DREAMS' own
transformation from passive ads to active AI-powered DTC/retail-media
network.

Real relevant technology: "ChatPPT" — a full-body-visible digital
human on the screen that understands content and interacts live with a
presenter — direct precedent for an embodied AI presence on DREAMS
screens. "Zbrain" — an AI agent platform giving screens spatial
awareness (understanding location and who's nearby) — extends DREAMS'
existing location-based targeting. "IN·BOX" — AI-generated visual
content driving commercial traffic and brand revenue. Smart Display
Robot Company — real JV with Zhipu AI combining LED hardware with AI.

Real US presence: Unilumin USA headquartered in Orlando, Florida, all-
US sales/service/repair team, 36,000 sq ft facility. Real
distribution partnerships: Electro-Matic Visual (master distributor,
announced October 2025) and Matrix Visual (since 2016). Real
legitimacy: genuine SBA PPP loan ($350,000-$1M) through HSBC Bank USA.

Direct implication: any real deal should go through Unilumin USA or
Electro-Matic Visual specifically, not the Chinese parent — keeps
warranty valid.

Minimum order: no fixed universal MOQ for enterprise-grade route,
negotiated per contract. Lower-barrier wholesale via Alibaba: MOQs 1
piece up to 100 pieces or 1-10 sqm.

Real panel specs: standard modular panels 500mm x 500mm and 500mm x
1000mm. Pixel pitch range: P2 through P16. Viewing-distance rule:
minimum viewing distance in meters ≈ pixel pitch number. Direct
implication: close-up screens (inside a business, storefront window)
use finer pitch (P2-P4); larger outdoor screens use coarser, cheaper
pitch (P8-P10).

Relevant product line: Transparent LED display — sleek, minimal-frame
screen for storefront windows, letting a business advertise without
blocking the window view — well-suited to HVNTZ-onboarded retail
businesses.

Real pricing: $800-$3,000 per square meter, varying by pixel pitch,
brightness, use case.

Status: reference/inspiration document — informs DREAMS' AI-layer
design and screen hardware sourcing, not a required build item yet.

---

## Implementation status (added when this file was placed into the repo)

**Correctly labelled by its own last line — a sourcing and inspiration
document, not a build item.** Panel dimensions, pixel pitch, MOQs, and
distributor relationships are procurement facts. Nothing in this repo
should encode them, and nothing does.

**Where it touches real code: the screen model.**
`dreams/lib/screens.js` registers a screen with a `screenOwnerId`,
`locationName`, and `locationAddress`. It has no concept of physical
characteristics at all — no pitch, no dimensions, no indoor/outdoor,
no transparent-vs-standard. Today every screen in DREAMS is
interchangeable.

That is fine while screens are hypothetical, and stops being fine the
moment two real screens differ. The viewing-distance rule in this
document is the reason: a P2 storefront panel and a P10 outdoor panel
are genuinely different advertising products, with different legible
content, different minimum viewer distance, and a price per square
metre that varies by roughly 4x. A campaign targeting "screens" without
distinguishing them would be selling two different things at one price.

**The smallest real change this document implies**, recorded rather
than built since no physical screen exists yet: `registerScreen` should
carry `pixelPitch`, `widthMm`/`heightMm`, and a `displayType`
(`standard` | `transparent`), and campaign targeting should be able to
filter on them. Cheap now, and it is the same "config from day one"
argument that applied to crypto-agility — a screen model that has never
had physical attributes is easier to extend than one with a year of
campaigns booked against the assumption that all screens are alike.

**On the transparent-display / HVNTZ link — the connection is real and
the plumbing already exists.** DREAMS screens carry a real
`locationAddress`, and HVNTZ holds real businesses with real lat/lng
and location lookups. A storefront transparent panel is precisely a
DREAMS screen whose owner is an HVNTZ-onboarded business. Nothing
needs inventing to connect them; what is missing is only the physical
attribute set above.

**On "ChatPPT" and the embodied digital human — this is the one item
here that is no longer purely aspirational.** V4 now has a real twin
presentation layer: `v4-proxy/lib/twinProfiles.js` (animation state
machine) and `v4-proxy/lib/surfaces.js` (per-surface framing rules,
including full-body on the lean-back surface). A DREAMS screen is
conceptually another surface — large, lean-back, full-body-capable,
and unlike TV Play it has no viewer-initiated interaction at all.

Adding a `dreams-screen` surface to `v4-proxy/lib/surfaces.js` would
be a small, real change. It is deliberately not made here, because a
screen surface needs a genuine answer to what an agent presenter is
*for* on an ad screen — DREA is explicitly marked `embodied: false`
(she scores inventory; she is not a presenter), so the question of who
appears on the glass is unresolved rather than merely unimplemented.

**On Zbrain / spatial awareness**: DREAMS has location, but "who is
nearby" is a sensing capability requiring hardware this repo has no
access to. Out of scope, and correctly so.
