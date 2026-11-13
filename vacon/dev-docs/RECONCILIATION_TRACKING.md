# VACON doc-vs-code reconciliation tracking

Running log of mismatches found between VACON's own markdown docs and
its real, current code. Per this repo's own convention: entries are
appended, not rewritten, as later passes find more. This is the first
entry for VACON since the prior round's work landed (see `git log
--oneline -- vacon/`); that round's own checklist lived only in a
since-compacted conversation, so this pass re-derived the list from
scratch by reading every doc against the real code rather than
resuming a known list.

## Pass: 13 Nov 2026

- [fixed] `README.md`'s opening paragraph listed 11 named executives
  (QVAN, Leslie, Deskins, Kevin, Kay, Gibson, DREA, Anderson, Ava,
  Autumn, Jacobi) and had never been updated to include Stephanie
  (Phase 4) or Jake (Phase 5), even though both are documented
  elsewhere in the same file. Appended a dated correction with the
  real, full 13-named-executive + MIA (14 total) roster.
- [fixed] `README.md` line 37 ("A note on 'Jake'") pointed readers to
  a "Jake (Phase 5)" section for "the real registry/verification
  record" that did not exist anywhere in the file — a dangling
  reference. Added a real "Jake (Phase 5)" section with facts already
  true of the code (registry count, `getAgent`/`listAgents` behavior,
  existing passing tests), nothing newly built.
- [fixed] `README.md`'s "Not yet built" section claimed "VACON's own
  endpoints are unprotected" — false against the real code:
  `server.js` mounts `lib/serviceAuth.cjs`'s trusted-service allowlist
  app-wide, in `enforce` mode by default, 401ing unauthenticated
  mutating requests. Appended a dated correction rather than deleting
  the original claim.
- [fixed] `README.md`'s "Not yet built" section also claimed
  `V4Prototype.jsx`'s Command Center "still renders from its local
  `AGENTS` const, not a live `GET /api/agents` fetch" — false against
  the real code: that file's own `syncAgentRosterFromVacon()` (present
  since this repo's earliest visible history for this file) fetches
  `GET /api/agents` on mount and syncs name/role/app/systemPrompt into
  the existing arrays in place. Appended a dated correction.
- [fixed] `README.md`'s "Real persistence" section documented only the
  file-backed store (`lib/persistence.js`, `data/store.json`) and
  never mentioned that `server.js` now builds its store through
  `lib/storeBackend.js`'s shared `attachStore`, which gives VACON a
  real Postgres-backed option (`lib/persistencePg.js`) when
  `DATABASE_URL` is set. Added the missing coverage.
- [fixed] `lib/orchestrator.js`'s own header comment said "routing a
  request to the right one of 10 agents" — stale; the real roster
  (`lib/agents.js`'s `AGENTS`, excluding MIA) has grown to 13 since
  that comment was written (Anderson, Stephanie, and Jake were all
  added after it). Corrected the count in place (a code comment
  describing current design, not a dated historical record like the
  phase-N dev-docs, so corrected directly rather than appended).
- [filed, not yet fixed] Real cross-app drift, read-only (sibling
  app, not touched): `v4-proxy/V4Prototype.jsx`'s own `AGENTS` array
  gives Jake `tier: "vulture"`, copied from the Vvltvre entries
  immediately above him in that array. VACON's own registry
  (`vacon/lib/agents.js`) has his real tier as `'user'` (he represents
  VENVM, not Vvltvre Media). `syncAgentRosterFromVacon()` deliberately
  does not overwrite `tier` for a known agent, so this will not
  self-correct — Jake currently renders in V4's Command Center under
  the wrong tier-color bucket. Documented in `vacon/README.md`'s new
  "Jake (Phase 5)" section. The actual fix is a one-line change in
  `v4-proxy/V4Prototype.jsx` (`tier: "vulture"` → `tier: "user"` on the
  `jake` entry) for whichever pass is auditing v4-proxy's own docs/code
  next, since this pass's remit is VACON's own directory plus this
  tracking file only.

## Checked and found current (no action needed)

- `lib/agents.js`'s own header/comments (Jake registration rationale,
  "V4's shared map layer" note, Anderson/Stephanie structural
  rationale) — all match the real code and the real roster.
- `server.js`'s route list, trusted-service allowlist wiring, and
  invoke-path behavior (incl. the deliberate `/api/agents/invocations`
  ordering-before-`/api/agents/:id` fix) — all match.
- `public/index.html` — all four claimed frontend fixes (the `app`
  field, `keywords` field, `routedTo`/`fallback` fields, and the
  `messages`-array invoke payload) are present in the real code; the
  Status tab and Agents-tab "Full profile" button both call the real
  routes they claim to.
- `test/orchestrator.test.js` and `test/invocations.test.js` — every
  claim they encode (word-boundary matching, specificity weighting,
  Jake's registration, bounded invocation log, etc.) matches the real
  `lib/orchestrator.js`/`lib/agents.js` behavior; full suite passes
  (18/18) both before and after this pass's changes.
- `dev-docs/phase-{1,2,3,4}-*/plan.md` and `tasks.md` — read in full.
  These are dated, historical planning records (e.g. phase-1's "10
  named executives", its "no agent named Jake exists" note) and are
  correctly left as-is under this repo's own convention: they describe
  what was true *at that phase*, and later corrections live in
  `README.md`'s own dated notes, not by rewriting history.
- `README.md`'s other "Verified" phase blocks (Phase 1 baseline, "11
  total agents"; Anderson Phase 2, "12 total"; Stephanie Phase 4, "13
  total") — same as above: correct historical snapshots, superseded by
  the new Jake (Phase 5) section's current total, not contradicted by
  it.
