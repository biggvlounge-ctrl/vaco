# Plan — Phase 2: real music/podcast distribution

## Goal
Close one of this app's own two self-flagged gaps: `distribute` only
handled film/tv projects (into Vvltvre Flix); music/podcast projects
had no real, automatic hand-off anywhere.

## Design
Investigated Vvltvre Pods' own `publishEpisode` first, since it
already does the same kind of real cross-app hand-off this phase
needs: it calls Vvltvre Music's real `POST /api/releases` via an
injected `distributeFn`, deliberately reusing that app's real
distribution economics (flat fee, `ownershipRetainedPercent: 100`)
rather than building a second one. That's the exact real precedent
this phase follows.

**Why route through Vvltvre Music directly, not through Vvltvre Pods'
Show/Episode layer for podcast projects**: Vvltvre Pods' `Show` needs
real metadata (`category`, `description`) and `Episode` needs
(`episodeNumber`, `durationSeconds`) that this project's own schema
(`title`, `synopsis`, `budgetRequested`) doesn't carry. Fabricating
that metadata would be a real, unwanted invention. Vvltvre Music's own
`podcast-episode` format is already explicitly documented as "a
standalone item... with no concept of a running series" — the exact
shape a one-off Vvltvre Studios project actually has — so `music` and
`podcast` mediums both route directly into Vvltvre Music's own `POST
/api/releases`, differing only in `format`/`targetPlatforms`.

**The real payer**: `VULTURE_STUDIOS_PRODUCTION_ACCOUNT`, the same
account every investor's financing already sits in, pays Vvltvre
Music's real flat distribution fee — the same real-world shape as a
label paying to distribute a record it financed.

**The real point of the whole hand-off**: rather than building a
second, parallel proportional-payout mechanism in this app for music/
podcast (which would duplicate `reportProjectRevenue`'s own real
exact-sum-rounding payout logic for no reason), this project's real
investors become that release's own real `coWriters`
(`getInvestorCoWriterSplits`, a new exported helper reusing the same
raw, unrounded contribution totals `reportProjectRevenue` itself
uses). Vvltvre Music's own already-real `reportStreamingRevenue` then
pays every investor directly and proportionally the moment real
revenue is reported there — no second call back into this app.

**A real double-accounting risk this design creates, closed
directly**: once a project is distributed through Vvltvre Music,
allowing this app's own `/api/projects/:id/revenue` to also fire for
that project would create two independent, competing "real" payout
paths for the same money. `reportProjectRevenue` now rejects that
case explicitly, naming the correct endpoint to use instead.

**A real, separate correctness gap found and fixed while touching this
code**: the existing `distribute` route had no status check of its
own before firing a cross-app call — `recordDistribution`'s own status
check ran only afterward, meaning a non-`completed` project could
already have created a real title/release externally before the local
rejection. Added an explicit `project.status !== 'completed'` check at
the top of the route, before any cross-app call, for every medium.

## Verification approach
Real unit tests (plain Node, scratchpad-only, deleted after passing):
`getInvestorCoWriterSplits` produces a real, correctly-ratioed,
sum-to-1 `coWriters` array; `reportProjectRevenue` rejects a project
once `distributionApp === 'vulture-music'`, naming the correct
endpoint; a film project (a different `distributionApp`) is confirmed
unaffected by that new guard.

Live pass against real running V3/Vvltvre Music/Vvltvre Studios
instances: a real music project financed 70/30, completed, and
distributed — confirmed the real created release's `coWriters` and the
real fee charged to the studio's production account, independently
re-confirmed via Vvltvre Music's own separate `GET /api/releases/:id`.
Confirmed this app's own revenue endpoint now honestly rejects a call
for that project. Advanced the real release through Vvltvre Music's
own `distributing -> live` gate, reported real revenue there, and
confirmed the exact real 70/30 payout landed in both investors' V3
balances with zero code in this app moving that money. A real podcast
project confirmed the `podcast-episode` format/platform mapping. A
real pre-completion `distribute` call confirmed the new status check.
