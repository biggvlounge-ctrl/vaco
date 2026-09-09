# Plan — Phase 4: Length tiers and destination routing

## Goal
Turn the structural half of `THOUSAND_VIDEO_CONTENT_PLAN.md` into real
categorization and distribution logic, per direct instruction that it
"should inform VENVM's actual content-categorization and distribution
logic, not just sit as a planning reference."

## Real investigation before any code
- The document was not previously filed. Filed under Vvltvre (#16),
  where VENVM lives.
- **The allocation sums to 750, not 1,000.** 350 + 200 + 100 + 100.
  250 videos are unassigned to any destination.
- **VMall has no app, and correctly should not.** It is a physical
  placement of the DREAMS screen network — HVNTZ's own revenue-stack
  document: "installed for DREAMS/VMall, just a new function on the
  same screen." All five other named destinations are real apps.
- `crossPlatformReformat.js` already holds per-platform duration
  limits. That is a different question (what a platform accepts) from
  this one (what the plan intends), so neither replaces the other.

## Design
- **The 250 is a named constant, not smoothed over.** Scaling the four
  numbers to reach 1,000 invents an allocation nobody decided; changing
  the total to 750 discards a quarter of the plan. `UNALLOCATED = 250`,
  reported by `describePlan()`, and a full destination's refusal points
  at the unassigned pool.
- **Tier gaps are refused, never rounded.** 16–29s and 61–119s are in
  no tier. A classifier that snapped them would always answer and
  sometimes invent the answer. `classifyLength` returns null with a
  reason that says which way the video falls, because "re-cut to 15s"
  and "pad to 30s" are different instructions.
- **Tier/destination fit is enforced.** A catalogue title is not
  fifteen seconds; retail screen content is not five minutes.
- **Gated in `createProductionJob`**, so an unroutable video is never
  produced — the same posture as the likeness-consent gate already
  there. Both-or-neither on destination/duration; legacy jobs unaffected.

## Deliberately not built
The three named gaps — script ownership, production timeline, review/
compliance — are process decisions with no owner. The third is the one
with teeth: nothing currently gates publishing on human review, and a
rubber-stamp step would look like a control and act like a
pass-through.
