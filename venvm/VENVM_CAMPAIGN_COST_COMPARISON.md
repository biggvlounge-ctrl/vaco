# VENVM — Campaign Cost Comparison

Real, worked math for a strong marketing campaign at two real volumes,
compared against real 2026 traditional video production costs.

Assumptions: 30-second average video, mixed approach — most videos at
cheap tier (Kling 3.0, ~$0.10/sec), a smaller share of hero/final
content at premium tier (Veo 3.1 Standard, $0.40/sec). Per-video cost:
cheap tier ~$3/video, premium tier ~$12/video.

100 videos: 80 cheap ($240) + 20 premium ($240) + subscription
($100-$600) = ~$580-$1,080 total.

250 videos: 200 cheap ($600) + 50 premium ($600) + subscription
($200-$900) = ~$1,400-$2,100 total.

Real 2026 traditional production benchmark (simple/short social media
content, 15-60 seconds, single-camera): $1,500-$5,000 per video. At
100 videos: $150,000-$500,000. At 250 videos: $375,000-$1,250,000.

Real savings comparison: 100 videos — 99.3%-99.8% savings. 250 videos
— 99.4%-99.8% savings.

Honest summary: a genuinely dramatic, real, defensible savings figure
— every number traces to a real confirmed API rate or published 2026
industry benchmark. A strong 100-250 video campaign costing hundreds
of thousands to over a million traditionally is achievable for under
$2,500 total using VENVM's pipeline. Honest caveat: this compares raw
production cost, not creative quality/brand storytelling depth for
the highest-end campaigns — VENVM makes a large volume of good, usable
content possible at unmatched cost, not a full replacement for every
premium agency use case.

1,000 videos — full ecosystem-wide usage (launch campaign, DTC
advertiser content, HVNTZ business videos, VultureFlix short-form,
VXLLAGE/CHOPZ social content): 800 cheap ($2,400) + 200 premium
($2,400) + subscription ($600-$3,600) = ~$5,400-$8,400 total.
Traditional cost at this volume: $1,500,000-$5,000,000. Real savings:
still genuinely 99%+ — VENVM's cost structure is linear (API cost per
second), so the advantage doesn't erode as usage scales.

---

## Implementation status (added when this file was placed into the repo)

**The arithmetic was recomputed independently and every figure
reproduces exactly.** Worth stating, because a cost argument is only
as good as its numbers and this one will get quoted:

| Volume | VENVM total | Traditional | Savings |
|---|---|---|---|
| 100 | $580–$1,080 | $150,000–$500,000 | 99.28%–99.88% |
| 250 | $1,400–$2,100 | $375,000–$1,250,000 | 99.44%–99.89% |
| 1,000 | $5,400–$8,400 | $1,500,000–$5,000,000 | 99.44%–99.89% |

Per-video: 30s × $0.10/s = $3; 30s × $0.40/s = $12. Both correct. The
stated ranges ("99.3%-99.8%", "99.4%-99.8%") match, computed the
conservative way — worst case being the priciest VENVM run against the
cheapest traditional quote.

**No cost model exists in the code, and that is the one real gap this
document implies.** `venvm/lib/` holds `scriptEngine.js`,
`crossPlatformReformat.js`, `productionPipeline.js`,
`likenessConsent.js`, `store.js`, and `persistence.js`. Searching for
any rate, tier, or cost constant returns nothing. A production job
carries `requesterApp`, `title`, `stage`, `storyboard`, and `videoUrl`
— no tier, no duration, no cost.

That matters more here than in most documents, because **cost is the
entire value proposition**. The argument is not "VENVM makes video," it
is "VENVM makes video for 1% of the price." A pipeline that cannot
report what it actually spent cannot substantiate that claim to anyone
— an advertiser, an investor, or the founder checking whether the
model holds.

**The smallest version worth building**, recorded rather than done: add
`tier` (`cheap` | `premium`) and `durationSeconds` to a production job,
put the per-second rates in a named, overridable constants table with
the vendor and date attached, and compute `estimatedCostUsd` at
creation plus `actualCostUsd` at `markRendered`. That is a handful of
fields, and it converts this document from a projection into a
measurement.

The rates belong in a flagged constants table specifically because
they are the fastest-moving numbers in the whole argument — per-second
generative video pricing has fallen repeatedly and will again. Per
`dev-docs/STANDING_INSTRUCTION_ONGOING_EVALUATION.md`, they should be
re-checked at build time rather than trusted from this document.

**Two honest qualifications to the comparison itself**, neither a
reason to discount it:

*The caveat in the document is the right one and should stay attached
to the number.* Raw production cost is not creative quality. The
comparison is fair for volume social content, which is exactly what
the $1,500–$5,000 benchmark describes; it would be unfair applied to a
flagship brand campaign, and this document says so.

*The subscription figure is doing quiet work.* At 100 videos, the
subscription ($100–$600) is most of the total cost — API generation is
only $480. So at low volume this is largely a subscription-cost
comparison, and the marginal cost of one more video is roughly $3. That
strengthens the argument rather than weakening it, and it is the reason
the linearity claim at 1,000 videos holds: the fixed component stops
mattering as volume rises.

**Nothing here was built.** This is a costing document, and the only
code it implies is the measurement layer described above.
