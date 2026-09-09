# Video Library — Influencer & Distribution Strategy (v1)

Real, direct strategies for moving the existing 8,000-video library
through influencer relationships, plus additional channels not yet
connected.

Influencer-connected distribution (new): rather than treating
influencer marketing and the video campaign as separate channels,
connect them directly.

Real specific tactics: seeded remix/reaction access — give real
influencers early access to react to, remix, or stitch on TikTok/
Reels/YouTube Shorts, turning existing AI content into raw material
for creator content. Co-branded drops — a real influencer's face/voice
attached to a curated subset of the library (using the existing AI
video pipeline, with permission), giving their audience content that's
genuinely theirs. VOKEN Cvltvre Card tie-in — influencers who engage
with the video library earn real Cvltvre Card value, an ongoing
incentive beyond one-time payment.

Additional real distribution channels not yet connected: DREAMS screen
network — playing segments of the library on actual DREAMS physical
screens, a real channel most competitors couldn't replicate, no
additional production cost. HVNTZ hunt integration — tying specific
videos to real-world hunt locations, discovering a location unlocks a
related video. Cross-posting simultaneously to TikTok, Instagram
Reels, YouTube Shorts, Twitch clips — low-cost reach multiplication,
no new production cost. Direct syndication to gaming/entertainment
media as embeddable content.

---

## Implementation status (added when this file was placed into the repo)

**Placed with VENVM because that is where the pipeline is**, but the
document describes distribution of a library this repo does not hold.
Worth separating what is buildable from what is a business-development
plan, because they are mixed together here.

**What VENVM actually has.** `venvm/lib/` holds `scriptEngine.js`,
`crossPlatformReformat.js`, and `productionPipeline.js` — a real
four-stage state machine moving a piece of content through production,
plus real reformatting across platform aspect ratios. There is no
media storage, no asset library, and no 8,000 videos. VENVM models the
*process*; it does not hold the *files*.

That distinction matters for every tactic below, because most of them
need the files, not the process.

**The one already-built foundation this document does not know it
has.** `crossPlatformReformat.js` is precisely the "cross-posting
simultaneously to TikTok, Instagram Reels, YouTube Shorts" capability
listed as "not yet connected." The reformatting is real and working.
What is missing is not the transformation but the *publishing* — no
platform API integration exists, which is a credentials-and-vendor
problem rather than a logic problem.

**On the DREAMS screen network tie-in — the strongest item here, and
genuinely close.** DREAMS now has real campaigns, real screens, real
impression recording, and (as of the offline cache work) a real
creative-caching contract where a creative is identified by
`creativeId` + `campaignId`. A library video played on a DREAMS screen
is a creative like any other. The gap is only that nothing maps a
VENVM production to a DREAMS creative — a small, real integration,
and the one item on this list a developer could start today.

The claim that this is "a real channel most competitors couldn't
replicate" is fair and is the most defensible strategic point in the
document: owning both the content pipeline and the physical screens is
genuinely unusual.

**On the HVNTZ tie-in.** Also real and plausible — HVNTZ has real
locations with real lat/lng and real checkpoint mechanics, so
"discovering a location unlocks a related video" is a small extension
of an existing mechanic. It needs the library to exist first.

**On the VOKEN Cvltvre Card tie-in — flagged, not endorsed as
written.** "Influencers who engage with the video library earn real
Cvltvre Card value" reads as paying for promotional engagement in an
asset with real resale value (VOKEN has a real secondary market).
That is a genuine disclosure question — compensated promotion is
disclosable regardless of whether the compensation is cash — and it
interacts with the securities posture VOKEN already carries for
fractional shares. Not a reason to abandon it; a reason to route it
past Deskins before it is built rather than after.

**On co-branded drops using "a real influencer's face/voice ... with
permission" — the strongest constraint in this document, and it should
be stated more firmly than the parenthetical does.** Generating
synthetic video of a real, identifiable person is exactly the
capability that requires explicit, specific, written consent covering
the actual generated output — not a general partnership agreement, and
not implied by an influencer having agreed to a promotion. If this is
built, consent verification belongs *in the pipeline as a gate*, the
same way licensing gates work in VOID: unverifiable consent should
block generation, not warn about it. Recorded here so the requirement
is not softened into a checkbox later.

**Nothing in this document was built.** It is a distribution plan
whose prerequisites — a stored media library and platform publishing
credentials — do not exist yet.
