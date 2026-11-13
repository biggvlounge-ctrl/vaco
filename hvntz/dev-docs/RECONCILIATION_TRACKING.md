# HVNTZ doc/code reconciliation tracking

Round 2 (13 Nov 2026). Round 1 already landed as prior commits on
`hvntz/` (see `git log --oneline -- hvntz/`); this file tracks what a
from-scratch re-audit of `README.md` (plus the three source-spec docs
and `dev-docs/`) against the real current code in `hvntz/` found this
round, since the prior round's own checklist lived only in a since-
compacted conversation and was never persisted here.

Method: every concrete, checkable claim in `README.md` — route lists,
module lists, specific numbers, specific file/function names, and
cross-app claims about `vavlt-stvdios`/`cvnvo`/`venvs` — was checked
directly against `server.js`, `lib/*.js`, `test/*.test.js`, and the
named sibling apps' own real files (read-only). The three top-level
`HVNTZ_*`/`VOID_*` docs are source specs this project builds *from*,
not implementation docs describing what's built, so their own
"Tier A/B pricing" and feature-wishlist content was not treated as a
checkable claim against code.

## Found and fixed this round

- [fixed] `lib/training.js` ("Hunts Academy" — course catalog,
  enrollment, completion, state-based recommendations) plus its six
  real routes (`/api/training/courses`, `/api/training/courses/:courseId`,
  `/api/training/enroll`, `/api/training/complete`,
  `/api/training/progress/:businessId`, `/api/training/recommended/:businessId`)
  and its frontend **Training** tab were real, tested
  (`test/training.test.js`) and wired into `server.js`, but had zero
  mention anywhere in `README.md`'s "What's here" list. Added a real
  bullet documenting it.
- [fixed] `README.md`'s "`server.js` ... wrapping all fourteen
  modules" undercounted — `server.js` actually requires sixteen real
  `lib/*.js` business modules (the fourteen already named elsewhere in
  the file plus `training` and, depending on how you'd already counted
  it, the module list itself was never kept in sync as modules were
  added). Appended a dated correction with the real count and the real
  module list, per this repo's append-not-rewrite convention; did not
  delete the original "fourteen" text.
- [fixed] Mystery Hunts section says "plus five new routes" but then
  lists six (`mystery/solution`, `checkpoint/:id/mystery-clue`,
  `mystery/team`, `mystery/status`, `mystery/known-facts/:userId`,
  `mystery/accusation`) — confirmed six real routes exist in
  `server.js` and in `test/mysteryHunt.test.js`'s coverage. Appended a
  dated correction; did not delete or rewrite the original list.

## Checked and confirmed accurate (no fix needed)

- Route-guard claim "47 guarded, 0 unguarded" (Phase 4 section) —
  reconfirmed by re-running `node scripts/audit-route-guards.mjs --app
  hvntz` from the repo root: still 47 guarded, 0 unguarded.
- `participation.js`'s `REFERENCE_FEE_FOR_FULL_SHARE = 500` matches the
  "$500+ paid in" figure quoted in `lib/training.js`'s course text.
- `digitalTwin.js`'s `LEVEL_2_LOCATION_THRESHOLD`/`LEVEL_2_SHARE_THRESHOLD`/
  `LEVEL_3_LOCATION_THRESHOLD`/`LEVEL_3_REVENUE_THRESHOLD` (2, 0.5, 3,
  200) match the thresholds quoted in both `README.md` and
  `lib/training.js`'s course text.
- Cross-app claim that `vavlt-stvdios/lib/screenSessions.js` defines
  `MAX_SCREENS = 8` and a `'viewer'`/`'broadcaster'` `sessionType`, and
  that `POST /api/screen-sessions` there is `requireActor('ownerId')`
  with no service-credential path — confirmed by reading that file and
  route directly (read-only, no sibling code touched).
  `lib/networkConnections.js`'s `linkNetworkScreenSession` correctly
  requires `session.sessionType === 'viewer'`.
- Cross-app claim about the `vavlt-stvdios` `authorId`/businessId
  string-normalization bug fix (`posts.js`/`videos.js` both do
  `String(authorId)` at write time) — confirmed real.
- Cross-app claim in `cvnvo/README.md` about live HVNTZ venue
  validation via `GET /api/business/:id` — confirmed that route is
  real in `hvntz/server.js` and that `cvnvo/README.md` references it.
- `lib/cvnvoPlacement.js`'s package tiers (`basic`/`standard`/`premium`)
  and visibility-boost values (1/2/4) match what `README.md` describes.
- `lib/networkAnalytics.js`'s "six of thirteen metrics real" claim —
  confirmed the six named fields (`networkSize`, `activeNodeCount`,
  `activeCreatorCount`/`activeStreamCount`, `huntParticipationCount`,
  `totalRevenueDistributed`, `revenueByPayee`) are all real,
  deterministic computations over real stored data, matching the
  module's own header comment.
- Test-count claims ("136/136", "142/142", "170/170" at successive
  points in `README.md`'s append history) — the final stated count,
  170/170, matches a real `node --test test/*.test.js` run today.
- `package.json` has no `"test"` script of its own (unlike the repo
  root, which has `npm test` → `scripts/run-all-tests.mjs`); this is
  consistent with every other per-app `package.json` in this
  ecosystem, which also rely on `node --test test/*.test.js` run
  directly rather than their own `test` script — not a per-app gap.
- Persistence: `README.md`'s "Real persistence" section describes only
  the file-backed path (`data/store.json`). `lib/storeBackend.js`
  actually also supports a Postgres-backed path
  (`lib/persistencePg.js`) when `DATABASE_URL` is set — real, wired-in
  code. Checked sibling apps (`v4-proxy`, `vaca`, `venvs`, `vdp`): none
  of their own READMEs mention `DATABASE_URL`/Postgres either, so this
  is an established ecosystem-wide documentation convention (the
  generic dual-backend module is documented once, centrally, not
  repeated in every app's own README), not an HVNTZ-specific gap. Not
  flagged.

## Not reconciled (none outstanding)

Everything found this round was fixed in this same pass. No items are
being carried forward as `[filed, not yet fixed]`.
