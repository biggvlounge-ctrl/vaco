# Vvltvre Studios — Content Financing Comparables

Written to close a comparables-coverage gap.

**What it is:** fund-and-produce financing — the division that invests
in projects and takes a share of what they earn, then distributes the
output into Vvltvre Flix (film/tv) or Vvltvre Music (music/podcast).

## Comparables

| Model | Example | Shape |
|---|---|---|
| **Fan/retail equity financing** | Legion M | Retail investors fund projects under Reg A+; the closest analogue to financing production from an ecosystem's own userbase. |
| **Project marketplace** | Slated | Matches projects to accredited investors; curation and diligence are the product. |
| **Traditional slate financing** | Studio co-financing deals | Institutional capital across a portfolio of titles rather than one, to spread the well-understood power-law risk. |
| **Music catalogue funds** | Hipgnosis and successors | Buys existing royalty streams rather than funding new production — the lower-variance adjacent strategy. |

## The regulatory point, which is the whole point

**Legion M's structure is the one to study, and specifically the fact
that it required Reg A+ qualification.** Financing content with money
from ordinary users is a securities offering. It does not become
something else because the money is denominated in VCoin or because the
users are already ecosystem members.

This is the same question already open on VOKEN's fractional ownership,
and it is gated there for exactly this reason. Vvltvre Studios has no
equivalent gate in code.

**That asymmetry is worth flagging rather than quietly leaving.** VOKEN
cannot sell a fractional share of a Cvltvre Card without clearing
`fractional-ownership`, but Vvltvre Studios can currently accept an
investment into a project. Whether those are genuinely different
instruments is a legal question, not an engineering one — and it is a
question for Deskins alongside the Cvltvre Card influencer item.

Nothing here is a recommendation to build a gate unilaterally; the
point is that the inconsistency should be a deliberate decision rather
than an oversight.

## The structural risk worth naming

Content financing is a power-law business: most projects return little
and a few return everything. Every comparable above manages that with
portfolio breadth. A division financing a handful of projects from one
ecosystem's creator pool has concentrated exposure, and no amount of
good selection fixes small-n variance.

## What is genuinely built

Fund-and-produce financing, project investment and revenue
distribution, real distribution into Vvltvre Flix and Vvltvre Music,
and a VDP district. Persisted.

> *Correction, added during this round's doc-vs-code reconciliation
> (13 Nov 2026, later the same day as the "Implementation status" pass
> below).* The line above previously said "into Vvltvre Music and
> Pods." That second half was never true: `grep` across this app's own
> `server.js` and `lib/*.js` for `vulture-pods`/`VULTURE_PODS` returns
> nothing. `distribute` only ever calls `registerWithVultureFlix`
> (film/tv) or `registerWithVultureMusic` (music/podcast — see "Real
> music/podcast distribution (Phase 2)" above, which itself already
> explains that a `podcast` project maps to Vvltvre Music's own
> `podcast-episode` format specifically *so that* no Vvltvre Pods
> Show/Episode wrapper has to be fabricated). The same stale claim was
> copied into `../vulture-pods/VULTURE_PODS_COMPARABLES.md`'s own "What
> is genuinely built" line and is corrected there too.

## Implementation status (verified 13 Nov 2026)

Checked directly against real code. `lib/projects.js` confirms real
distribution into `vulture-music` (branching on
`project.distributionApp === 'vulture-music'`) reusing
`vulture-music/lib/releases.js`'s own exact-sum rounding. The VOKEN
`fractional-ownership` gating asymmetry this doc raises is still real
and still unresolved — re-checked, not just re-asserted; it remains an
open, named legal question rather than an engineering gap. One stale
claim found later the same day and corrected above: this app never
distributes into Vvltvre Pods.
