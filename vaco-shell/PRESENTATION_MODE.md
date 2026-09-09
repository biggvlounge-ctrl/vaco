# Presentation Mode (v1)

Direct answer: yes, this is real and buildable. Confirms and refines
the founder's own instinct — two things running side by side, not one
combined view.

The real setup: Window/screen 1 — the actual, live, running app being
demonstrated. Window/screen 2 — a purpose-built Presentation Mode
screen, not the raw technical documents, but a clean, live summary
pulling the same real data (completion %, key features, cost,
compliance) formatted for a room to read at a glance while the founder
talks.

What Presentation Mode should show, per app: app name and one-line
identity (real comparable + key differentiator), completion percentage
clearly visible, 3-5 key features to highlight, cost (software build
cost and any relevant compliance cost), compliance status (clear /
gated pending review).

Real practical technical execution: build as a genuine, simple
standalone screen, styled with the same design system established in
the Visual Design Directive, navigable via simple controls (next/
previous app, quick-jump menu).

What can't be used yet — and how to still show it live: for every app
with compliance-gated features, Presentation Mode should clearly show
both what's fully functional now and what's gated — with gated
features still demonstrable as a real, working preview, not just
described verbally. Compliance-gated features (real-money betting,
fractional ownership, brokerage trading, full money-transmitter
banking) already have real, working UI/UX and logic built — gated
specifically at the point where real money would move. The interface
can be demonstrated live in a real "preview mode," using VCoin instead
of real currency.

Gated-feature examples: VAGO's full betting flow shown in VCoin
preview mode, same UI/odds display, no real-money settlement. VOKEN's
fractional-purchase flow and VEX trading interface shown in preview
mode. V3's VASH account interface shown with the real-cash rail gated.
VACANCY's full VCoin-based gameplay shown live, cash-out mechanic
pending legal review.

```
PresentationModeSlide {
  appId, appName, oneLine: string
  industry: string
  completionPercentage: number
  keyFeatures: [{
    featureName: string
    tag: "new" | "enhanced" | "original"
    whatMakesItSpecial: string
  }]
  softwareCost: string
  remainingCost: string
  completionIfFunded: number
  complianceStatus: "clear" | "gated-pending-review"
  complianceCostIfGated: string | null
  gatedFeatures: [string]
  gatedFeaturePreviewAvailable: boolean
}
```

Key features must be tagged and explained — new, enhanced, or
original, each with a real, specific "what makes this special"
explanation, not a generic bullet.

Industry tagging, remaining cost, and completion-if-funded per app —
ordered cheapest-to-most-expensive: the eight single-pass apps
(CHOPZ, VACAY, VXLLAGE, Vavlt Stvdios, CVNVO, Vvltvre, VOKEN, VAGO)
each at $500-$2,000 remaining, ~85-90% completion if funded; V3 and
VOID included in Phase 1/4; VACANCY and VDP at $25,000-$40,000 each
(environment art + population); VOID/HVNTZ expansion at
$26,000-$84,200 as the largest remaining software phase.

Status: Ready for Claude Code — build as a real, dedicated
Presentation Mode view, pulling data from the Master Project Status
and App Portfolio Breakdown documents, styled for live-room
readability. Gated features must remain demonstrable via VCoin/preview
mode, not hidden or omitted.

---

## Implementation status (added when this file was placed into the repo)

**Not built, genuinely buildable, and placed in `vaco-shell/` because
the shell already holds most of the data it needs.**

### What already exists to build on

`vaco-shell/lib/registry.js` holds a real `APPS` array with `id`,
`name`, `description`, `url`, `category`, `parent`, and `bundle` per
app — and its own header records that ports are real and verified, not
guessed. Two of the required fields (`appId`, `appName`) are already
there, and `description` is close to `oneLine`. The shell also already
has real launcher and session infrastructure, so "next/previous app,
quick-jump menu" is navigation over a list it already owns.

So the build is smaller than the spec implies: extend the registry,
add a view, done. No new data plumbing.

### The real problem: most of the required fields have no source

This is worth being blunt about, because it determines whether this is
a two-hour job or a much larger one. Of the fields in
`PresentationModeSlide`:

| Field | Source |
|---|---|
| `appId`, `appName` | Registry — real |
| `oneLine` | Registry `description` — close enough |
| `keyFeatures`, `industry` | **No source.** Must be authored per app |
| `completionPercentage`, `completionIfFunded` | **No source.** Not derivable |
| `softwareCost`, `remainingCost`, `complianceCostIfGated` | **No source in this repo** |
| `complianceStatus`, `gatedFeatures` | **No source**, though derivable with judgment |

The status line says to pull from "the Master Project Status and App
Portfolio Breakdown documents." **Neither exists in this repository.**
So Presentation Mode would not be *computing* a completion percentage;
it would be *displaying an authored one*.

That is a legitimate design — a pitch deck is authored content, and
there is nothing wrong with a hand-maintained data file. But it should
be built knowing that, because the failure mode is specific and
serious: a number typed into a slide deck in a live room, presented as
if the system measured it. The honest implementation puts these in an
explicit `presentationData.js` with a header saying they are authored
figures with a date, not derived metrics — so that when a percentage
is six months stale, that is visible rather than invisible.

### One claim that overstates what is built

> "Compliance-gated features … **already have real, working UI/UX and
> logic built** — gated specifically at the point where real money
> would move."

The **logic** half is accurate and impressive: VAGO has real casino
game logic and real fantasy contests, VOKEN has real fractional shares
with a real secondary market, V3 has a real ledger, and all of it
settles in VCoin rather than currency. "Gated at the point where real
money would move" is a fair description of the architecture.

The **UI/UX** half is not. This ecosystem is overwhelmingly
server-side: most apps are Express services exposing JSON routes, with
their visible surfaces living in VDP's districts rather than in the
apps themselves. There is no VAGO betting screen to project. Anyone
preparing a demo on the assumption that every app has a
screen-ready interface will find that out in the room.

Two honest options, and the choice should be made deliberately rather
than discovered late: demo the **API** (real, works today, reads as
technical) or build the **screens** (real work, not yet scoped). The
"preview mode using VCoin" idea works either way — it is genuinely
already true, since nothing settles in real currency anywhere.

### The costs

The dollar figures and percentages in the last section have no source
in this repo and cannot be verified from it. Same posture as the other
financial claims placed this session (MTL, broker-dealer, OpenObserve):
real planning inputs, not settled findings. They are also the numbers
most likely to be quoted aloud from a screen, which is a reason to
date-stamp them rather than let them read as current by default.

**VACANCY is listed among the apps at $25,000–$40,000.** VACON-C is
paused, so its completion figure will not move regardless of funding —
worth reflecting in any authored data rather than showing a stale
target.
