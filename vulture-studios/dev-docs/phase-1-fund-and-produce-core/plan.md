# Plan — Phase 1: fund-and-produce core

## Goal
Build Vvltvre Studios: a new, standalone `VVLTVRE -> STUDIOS`
division, against the real, named comparable given for it — a
Universal-Studios-style company that funds (raises real capital from
investors) and produces (moves a project through a real production
pipeline) projects, then distributes completed film/TV projects into
the existing Vvltvre Flix catalog, with investors receiving real
proportional profit participation as the completed project earns
revenue.

Confirmed genuinely new first, by direct grep across the whole repo:
no "Vvltvre Studios" concept existed anywhere, under any name.

## Design
**Why not shape this like Vvltvre Music or Vvltvre Flix.** Both of
those are real *distribution* businesses — they move money to acquire
or license already-independently-financed content. Neither has a
financing-round concept at all. Vvltvre Studios needed a genuinely
different economic shape: a real financing round (investors contribute
capital, capped at the project's budget, real proportional equity
computed from raw contribution ratios) that closes once the project
enters production, a real production stage machine (`greenlit` ->
`funded` -> `in-production` -> `completed`), and real backend profit
participation once the completed project reports revenue. The closest
real precedent in this codebase for the payout math is
`vulture-music/lib/releases.js`'s own co-writer percentage-split
payout loop (exact-sum rounding: every share but the last is rounded
independently, the last absorbs the remainder) — reused directly for
`reportProjectRevenue`, not reinvented. VOKEN's fractional-ownership
module was considered and rejected as a precedent: it's a buy/resell-
shares-of-an-asset model with no revenue-payout mechanic of its own.

**Distribution hand-off design.** Investigated Vvltvre Flix's two
existing title-creation paths, `acquireExclusiveTitle` and
`licenseNonExclusiveTitle` — both hard-require a positive fee, making
either unsuitable for an already-financed, studio-produced title
(forcing a fee through either would double-charge the project, since
real payment already happened as production financing here). Added a
clean, honest third path instead: `registerStudioProducedTitle` in
`../vulture-flix/lib/titles.js`, called via a new `POST
/api/titles/studio-produced` route on Vvltvre Flix's own server. The
new title record: `acquisitionType: 'studio-produced'`,
`acquisitionFee: null`, `licenseFee: null`,
`ownershipRetainedPercent: 0`, and a real `studioProjectId` cross-
reference — calls no `transferFn`, since the money already moved.

**Scope boundary, deliberate**: the real cross-app distribution hookup
in this phase is film/tv -> Vvltvre Flix only. Music/podcast projects
are explicitly deferred to Vvltvre Music's/Vvltvre Pods' own existing
submission flows, judged to already fit a self-financed project
honestly without new integration work — flagged directly in
`server.js`'s own route handler and in the README, not silently built
deeper or silently left undone.

## Verification approach
Real unit tests (plain Node, scratchpad-only, deleted after passing)
covering: `greenlightProject` validation, `investInProject`'s real
budget cap and auto-advance-to-`funded` at the exact budget, the
rounding-precision fix in `reportProjectRevenue`, and the full
status-guard chain across `startProduction`/`completeProject`/
`reportProjectRevenue`.

Live pass against real running servers (V3, Vvltvre Flix, Vvltvre
Studios, VACO Analytics): a full real project lifecycle from
greenlight through two real investors' financing, production,
completion, real cross-app distribution into Vvltvre Flix (independently
re-confirmed via Vvltvre Flix's own separate `GET /api/titles/:id`,
not just Vvltvre Studios' own success response), and a real revenue
report with its exact 70/30 investor payout confirmed via direct V3
balance checks. A second project was used specifically to test the
honest-failure distribution path against a deliberately-killed Vvltvre
Flix process.
