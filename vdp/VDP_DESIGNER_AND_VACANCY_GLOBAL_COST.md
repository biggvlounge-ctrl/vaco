# VDP — In-House Designer, and VACANCY's Global Cost (v1)

## Part 1 — VDP's ongoing expansion, and whether it needs an in-house designer

The real mechanic being described: as players explore VDP and reach the
edge of currently-built content, the world itself signals that it's time
for new construction/manufacturing — a real, ongoing, player-driven
expansion trigger, not a one-time launch task.

Direct, honest answer: given this is genuinely continuous, not a finite
launch scope, yes — this is a real, legitimate case for an in-house
world/level designer, not something to keep sending out to freelance
contractors piece by piece indefinitely. Recommend adding a real
World/Level Designer role to the internal team, owning VDP's ongoing
expansion specifically.

## Part 2 — VACANCY's full global completion, a real, honest cost estimate

VACANCY's Cesium/Google Photorealistic 3D Tiles integration already
provides real coverage across 2,500+ cities and 49 countries — but
"coverage" and "fully playable" are two different things with very
different real costs.

**Tier 1 — backdrop-only global coverage** (already essentially
included): using the raw Cesium/Google data as a visual backdrop across
the whole world requires no significant additional environment-art cost
beyond the real, usage-based Google Maps Platform API fees already
established.

**Tier 2 — full playable-tier expansion, city by city**: bringing a city
to the same real, human-refined playable standard as St. Louis's four
launch districts is genuinely the expensive part. Roughly $3,000–$5,000
in real environment-art cost per additional city brought to full
playable quality.

Real cost at different rollout scales:

| scale | cost |
|---|---|
| Backdrop-only, full global coverage | near-zero additional (API costs only) |
| Top 10 major world cities, full playable | $30,000–$50,000 |
| Top 50 major world cities, full playable | $150,000–$250,000 |
| All 2,500+ Cesium-covered cities, full playable | $7,500,000–$12,500,000 |

**Direct recommendation**: true, full-playable coverage of the entire
globe is genuinely not a near-term goal — a multi-million-dollar
undertaking best pursued gradually, city by city, funded by real, proven
revenue as the game grows. The realistic near-term plan is backdrop-only
global coverage (essentially already included) plus deliberate expansion
to additional playable cities over time, prioritized by real player
demand — managed by the in-house World/Level Designer role above.

## The critical distinction — simulation and visual environment are two separate layers

The NPC/Key Resolver engine's simulation (citizens, jobs, relationships,
population growth, economic activity) and the actual visual, walkable
environment are genuinely separate systems — the simulation doesn't
require full, human-artist-built visual detail to keep running.

```
BackdropAreaSimulation {
  areaId,
  isVisuallyPlayable: boolean,      // false for backdrop-only areas
  simulatedPopulation: number,      // real, ongoing citizen simulation,
                                    // running regardless of visual detail
  economicActivityLevel: number,
  realGrowthSignal: number          // feeds the WorldExpansionTrigger already
                                    // established — genuine, measured simulated
                                    // growth becomes the real signal for when
                                    // visual expansion is actually warranted
}
```

Why this is the right, coherent design: the world's population and
economy can genuinely grow everywhere from day one, while the expensive,
human-artist visual build-out only happens where the simulation itself
shows real, organic demand — the simulation becomes the actual signal for
where to invest in full playable art next, directly feeding the World
Expansion Pipeline's trigger system.

**Status**: two real, honest answers — VDP's ongoing expansion genuinely
justifies a real in-house hire; VACANCY's full global completion is a
real, multi-million-dollar long-term goal, not a near-term budget line.

---

## Implementation status — filed 2026-08-27; the code-bearing half **built**

Filed per `VACO.md`'s filing form. This document is mostly
**STRUCTURE-ONLY** — a hiring recommendation and a cost model, which
per the standing instruction generate no code. One section is
**CODE-BEARING**, and it is built.

### Built: `vdp/src/lib/worldExpansion.js`

`BackdropAreaSimulation` and the expansion trigger, with 17 tests in
`vdp/test/worldExpansion.test.js`. Three decisions in it are worth
stating because none was a default:

**The simulation genuinely does not branch on visual detail.** That is
this document's central claim, and it is asserted directly: a backdrop
area and a playable area fed identical samples must end with identical
population, activity, growth and sample count. The moment backdrop
areas simulate differently, the trigger measures the wrong thing.

**`realGrowthSignal` is derived, never assigned.** The document types
it as a plain number, but it decides where $3,000–$5,000 of
environment art goes — and a field anyone can set is a field anyone can
use to justify a spend. It is computed from observed deltas across
recorded samples, and there is a test asserting that writing
`area.realGrowthSignal = 99` changes nothing.

**No history returns `null`, not `0`.** "No signal" and "no growth" are
different facts and only one is a reason to look elsewhere; the other
means wait. The verdict says so in words, because that is the
difference a designer acts on.

**The trigger reports, it does not spend.** It says a threshold was
crossed and what a city would cost. The decision stays with a person —
this document is explicit that expansion is "funded by real, proven
revenue," and a trigger that committed money would be the wrong reading.

The cost constants are pinned to this document's own figures, including
the full-globe $7.5M–$12.5M line, so they cannot drift away from the
numbers the decision was made on.

### One thing the mutation pass caught

The growth threshold was initially unreachable: every "cold" fixture
also failed the population and activity thresholds, so the module could
have ignored growth entirely and stayed green. A big, busy, *flat* area
is now a test of its own, and it asserts the refusal names growth and
**does not** name the other two — a refusal for the right reason.

### Not built, and not proposed

The World/Level Designer hire and the city-by-city rollout are
decisions, not code. Nothing here schedules, budgets or commissions
anything.

`WorldExpansionTrigger` is described in this document as "already
established." It was not — the name appears nowhere in this repo. The
mechanism now exists as `evaluateExpansion`/`expansionQueue`; the name
is recorded here so the discrepancy is visible rather than quietly
absorbed. Cesium/Google 3D Tiles coverage likewise appears in
`world-layer/` documents but has no integration code in `vdp/`.
