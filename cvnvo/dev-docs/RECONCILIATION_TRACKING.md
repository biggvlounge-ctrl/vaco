# CVNVO doc-vs-code reconciliation tracking

Running list of real mismatches found between CVNVO's own markdown docs
and its actual current code, and what was done about each. Per this
project's own convention, a wrong claim is corrected with a dated note
appended beside it, never silently deleted. Earlier rounds' entries
(not re-litigated here) landed in `a561dbb` — see
`git log --oneline -- cvnvo/`.

## This round (13 Nov 2026)

- [fixed] `README.md`: "`test/messages.test.js` (new, 5 tests; full
  suite 77 -> 82, all passing)" was wrong even at the commit that wrote
  it — the real suite was 35 tests before that file and 40 after
  (verified by counting `test(` calls in the historical commit and
  re-running the suite today: 40/40 passing). Corrected in place with
  a dated note; the stale numbers are kept, not deleted.
- [fixed] `yap/README.md`: "## Verified" still said "9 plain-Node
  checks" — stale since before the Tea-model reporting additions and
  the later moderation/dispute/takedown build; the real current suite
  is 42 tests (`yap.test.js` 20 + `server.test.js` 6 +
  `moderation.test.js` 16), all passing. Corrected with a dated note.
- [fixed] `yap/README.md`: "What's here" never mentioned
  `lib/moderation.js` at all (331 lines — the real moderation queue,
  dispute path, takedown, and brigading detection). Added a full entry
  describing what it does and the real routes/operator-scope that
  guard it.
- [fixed] `yap/YAP_REVIEW_PLATFORM_COMPARABLES.md`: "Not built" section
  claimed "Dispute/appeal flow, removal process, identity verification
  of reviewers, and any fraud or brigading resistance" are unbuilt.
  Three of four are real and built in `lib/moderation.js` (which itself
  cites this exact line); identity verification of reviewers was
  already real even when this was first written. Only fraud/brigading
  resistance remains a real, partial gap (flags only, does not act).
  Corrected with a dated note, not rewritten.
- [fixed] `dev-docs/phase-real-caller-authorization/plan.md`: claimed
  "No Authorization header -> unchanged passthrough" for
  `requireActor` on the gift-dating/blind-date money routes. The
  ecosystem-wide auth hardening removed `optionalOwnAccount` from the
  shared `shieldAuth.cjs` this app syncs; `requireActor` now requires a
  session unconditionally. Verified live: an unauthenticated
  `POST /api/blind-date/token` now returns 401, not the 201 this plan
  recorded. Corrected with a dated note; the still-accurate
  mismatched-actor (403) behavior was left alone.
- [fixed] `package.json` (both `cvnvo/` and `cvnvo/yap/`): neither had
  a `test` script, unlike every one of the other ~35 apps in this
  monorepo (`"test": "node --test test/*.test.js"`). Added, matching
  the established convention exactly — no new behavior, just the
  standard way to run the suite this round's fixes depend on.
  `npm test` now runs clean in both: CVNVO 40/40, Yap 42/42.

## Checked and found still accurate (not touched)

- `CVNVO_BARBUDDY_FEATURE.md`: every function/route/data-model claim
  checked directly against `lib/proximity.js` and `server.js` — all
  real (`checkInAtVenue`, `getOrCreateVenue`, `store.barBuddyCheckIns`,
  `checkedOutAt`, the HVNTZ opt-in validation path).
- `CVNVO_ARCHITECTURE.md`, `CVNVO_CORE_FEATURES.md`: cross-checked
  against `lib/matching.js`, `lib/firstDateSafety.js`,
  `lib/profiles.js` — the reliability-multiplier formula, the We Met
  loop, and the VSAFE/Yap decoupling claims all match current code.
  (Both already carry dated corrections from the prior round.)
- `CVNVO_DATING_COMPARABLES.md`: the format-coverage table, the Snap
  Map "partially adopted" claim, and the "Not built" anti-ghosting
  block (a *general* reliability-based block, distinct from
  `blindDate.js`'s own local cancellation-streak block, which is a
  different, already-built mechanic) all still hold.
- `VPLAN_AI_PLANNING_ENGINE.md`: "no `vplan/` app, no `PlanRequest`
  anywhere" — confirmed, still true repo-wide.
- Route count: README's "59 routes" / "55 of 59 reachable from the
  UI" — counted directly from `server.js` (`app.(get|post)(...)`):
  exactly 59, matching.
- `yap/README.md`'s cross-app integration claim (fetches CVNVO's
  `GET /api/profiles/:userId` live) — confirmed in `yap/server.js`.

## Deliberately not touched (ambiguous, not a clear mismatch)

- `CVNVO_ARCHITECTURE.md`'s "`cvnvo/lib/` holds nineteen real modules"
  — `lib/` currently has 23 files. The gap is explained by 5 shared
  shared-runtime-synced infra files (`serviceAuth.cjs`,
  `shieldAuth.cjs`, `tracing.cjs`, `mediaClient.cjs`,
  `persistencePg.js`) that the original count appears to have excluded
  on purpose (23 - 5 = 18, one short of 19 now that `messageSafety.js`
  was removed in the prior round's dedup). Left alone: correcting it
  would require guessing the author's exact intended scope rather than
  citing a clean, unambiguous fact.
