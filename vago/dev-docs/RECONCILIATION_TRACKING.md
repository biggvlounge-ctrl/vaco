# VAGO — doc-vs-code reconciliation tracking

Running log of mismatches found between VAGO's own markdown docs and its
real current code. Per this project's convention, fixes are appended as
dated corrections rather than silently rewriting prior text — see the
"Correction, <date>" sections inside the files themselves for the actual
wording. This file is the index of what was checked, not a replacement
for those corrections.

## This round — 13 Nov 2026

- [fixed] `VAGO_ARCHITECTURE.md` — "Genuinely unbuilt: `vacancy-in-game`
  prediction sources. VACON-C is paused..." was stale on both halves.
  `vacancy-in-game` is a real, accepted `MARKET_SOURCES` entry, has its
  own feed route (`GET /api/predictions/vacancy`), and is seeded with a
  real market + real two-sided trades in `lib/seedDemoData.js`
  (`IN_WORLD_MARKETS`). Separately, VACON-C itself is not paused —
  `vacon-c/VACANCY_INVENTORY.md` and `vacon-c/CLAUDE.md` both record the
  pause as lifted (28 Aug 2026) and correct the same "paused" claim in
  their own repo. Fixed with an appended dated correction in
  `VAGO_ARCHITECTURE.md`; sibling-app files untouched (read-only check).
- [fixed] `VAGO_ARCHITECTURE.md` — the "API map" section lists routes
  under a `/vago/...` prefix (`POST /vago/markets`,
  `POST /vago/sports/:eventId/bet`, `POST /vago/casino/sessions`, etc.).
  None of those paths exist in the real `server.js`; every real route is
  under `/api/...`, and there are 67 real route handlers today versus
  the eight the map lists (group wagers, competitions, BLIND rounds, and
  most of casino/fantasy/esports are missing from it entirely). This map
  was written pre-implementation and never updated. Fixed with an
  appended dated correction noting it should not be read as current.
- [fixed] `VAGO_CLAUDE.md` — the 13-module list (in the already-dated
  "Implementation status" section from a prior round) named
  `shieldAuth.js`; the real file is `lib/shieldAuth.cjs`,
  confirmed against `server.js`'s own `require('./lib/shieldAuth.cjs')`.
  Corrected in place (plain filename typo, not a claim about behavior)
  with a one-line note added to the existing 13 Nov 2026 correction
  section documenting the fix.
- [filed, not yet fixed] `dev-docs/phase-real-caller-authorization/plan.md`
  has the same `lib/shieldAuth.js` (should be `.cjs`) typo. Left as-is —
  it's a historical phase record of completed work (like the other
  `dev-docs/phase-*` files), and this project's convention treats those
  as a build log rather than a live spec to keep current. Noted inline
  in `VAGO_CLAUDE.md`'s correction section for whoever next touches that
  file.

## Checked this round and found accurate (no action needed)

- Module count (24 in `lib/*.js`/`*.cjs`) and route count (67 in
  `server.js`) — both already correct in `README.md` and
  `VAGO_CLAUDE.md`'s prior-round correction.
- Test count — `README.md` says "134 → 137 tests, all passing" after
  the Competitions/BLIND seeding work; `npm test` / `node --test
  test/*.test.js` currently reports 137 passing, 0 failing (confirmed
  stable across 5 consecutive runs).
- Blackjack: real backend routes exist
  (`/api/casino/blackjack/{start,:id/hit,:id/stand,:id/settle-natural}`)
  but `public/index.html` has zero "blackjack" references — matches
  README's "Deliberately left for a follow-up round" note; still true.
- No `operator`-gated button exposure anywhere in `public/index.html`
  (only comments referencing the gating) — matches README's claim.
- No esports-match seed data and no AMOE-history/session-lookup frontend
  callers — matches README's "Deliberately left for a follow-up round"
  list; still true.
- Group Wagers: `parentGroupWagerId` (side wagers) and `teamNames`
  (team roles) are real in `lib/groupWagers.js`; the leaderboard route
  is registered before the `:id` route in `server.js` (the ordering bug
  README documents fixing). Cross-app claim that group threads post
  through `vxllage/lib/posts.js`'s real `createPost` — confirmed that
  file and function exist (read-only check, sibling code untouched).
- `VAGO_COMPARABLES.md` — research/comparables document, not a
  built-feature claim; nothing concrete to check against VAGO's own
  code.
- `dev-docs/phase-*/plan.md` and `tasks.md` files — historical build
  logs; spot-checked several against the real code (module names,
  `vacancy-in-game`/`vdp-in-world` framing, persistence claims) and
  found them consistent with history, unlike `VAGO_ARCHITECTURE.md`'s
  "Implementation status" section which was written once and not
  updated as of this check.

## Known still-open gap (not a doc bug — a real, already-flagged gap)

- QVAN-based group-risk monitoring remains genuinely unbuilt (confirmed
  no spec exists in `v4-proxy/QVAN_SECURITY_RESILIENCE_SCOPE.md`) — this
  was already correctly documented as open in `README.md`'s "Not yet
  built" section; no doc change needed, listed here only so this
  tracking file reflects a full pass rather than silence on it.
