# V3 doc-vs-code reconciliation — tracking

Running record of mismatches found between V3's own markdown docs and
its real, current code. One line each. A prior round (commit
`a7c2c28`) already corrected one stale claim (idempotency in
`V3_FIRST_PROMPT.md`) before this round started; that one is not
re-listed here.

- [fixed] `V3_FIRST_PROMPT.md` task 1 ("Auth & per-user data isolation
  — partially done... a caller who presents no token still passes
  through") — stale. `optionalOwnAccount` has been deleted (throws at
  call time) and every money-moving route now requires
  `actorOrService(requireActor(...))`: a verified Shield session *or*
  a verified internal service credential via `lib/serviceAuth.cjs`,
  which defaults to `enforce`. Appended a dated correction.
- [fixed] `V3_FIRST_PROMPT.md` task 2 ("Postgres remains genuinely
  unstarted and genuinely worth doing — highest-value item still
  open") — false. `lib/ledgerPg.js`, `lib/persistencePg.js`,
  `lib/idempotencyPg.js` all exist and are wired in via
  `lib/ledger.js`/`lib/storeBackend.js` behind a `DATABASE_URL` check;
  `transfer`/`cashout`/`settle` each run inside one SQL transaction on
  that path, giving the atomicity the doc said was missing. Appended a
  dated correction.
- [fixed] `V3_FIRST_PROMPT.md` "Definition of done" points 4 and 5
  (atomicity "blocked on Postgres"; isolation "not enforced for
  tokenless server-to-server callers") — both stale for the same two
  reasons above. Appended a dated correction.
- [fixed] `README.md` "Ecosystem cutover (done)" section's "all 15
  real callers" — undercounts. Seven more real callers (`dreams`,
  `vex`, `vulture-studios`, `vaco-assistant` ×2 call sites,
  `vaco-passport`, `vaco-shell`, `vash-tap`) already default to this
  service's `8811`, grep-confirmed, and were never named in this
  section — they were built after the cutover and never needed one.
  Real current count is at least 22 apps. Appended a dated correction.
- [fixed] `README.md` had zero mention of three real, shipped features
  anywhere in the file: the optional Postgres-backed ledger, the
  enforced caller-authorization posture (Shield session or service
  credential, required on every mutating route), and idempotency on
  every money-moving route. Added a new "Added coverage" section
  documenting all three against the real code (`lib/ledgerPg.js`,
  `lib/shieldAuth.cjs`, `lib/serviceAuth.cjs`, `lib/idempotency.js`,
  `lib/idempotencyPg.js`), citing nothing speculative.
- [fixed] `VCOIN_UNIVERSAL_EARNING_SCALE.md`'s claim that a future
  earning route would "inherit the missing idempotency... and the
  missing transactional atomicity that Postgres would provide" — both
  blockers it names have since landed (see the two `V3_FIRST_PROMPT.md`
  fixes above). Appended a dated correction; left the actually-true
  part (no earning engine exists, verified by a fresh grep for
  `awardVCoin`/`grantVCoin`/`mintVCoin`/`earnRate`/`EARN_RATE`/
  `VCOIN_PER_*`/`VCOIN_REWARD` — zero matches, same as the doc's
  original finding) untouched.
- [fixed] `VASH_BAAS_VCOIN_ADVANCEMENT.md`'s "`v3/lib/vash.js` is 47
  lines... VASH balances are numbers in a JSON file" — the file is now
  82 lines (a real tamper-evident integrity hash was added to every
  cashout), and balances are rows in Postgres instead of JSON whenever
  `DATABASE_URL` is set. Appended a dated correction; the "no account,
  no IBAN, no card" substance of the claim still holds on both
  backends.

## Checked, found accurate, no fix needed
- README's "22 real routes" claim (frontend coverage pass intro) —
  counted every `app.get`/`app.post` in `server.js`: exactly 22.
- `deploy/nginx-docker.conf`'s rate-limiting claim in
  `V3_FIRST_PROMPT.md` task 4 — `limit_req_zone ... rate=10r/s` /
  `burst=20` and the `/v3/` location block both confirmed present.
- VACA split-out claim (`vaca/`, port 8804) — confirmed in
  `vaca/server.js`.
- Cross-app `V3_API_URL` default claims for the 15 apps named in the
  original cutover section — all 15 confirmed still defaulting to
  `8811`, read-only check against each app's own `server.js`/
  `v3Client.js` (no sibling code touched).

## Reviewed, deliberately left untouched (historical-record convention)
- `dev-docs/phase-*/plan.md` and `dev-docs/phase-*/tasks.md` (five
  phase directories) — these are point-in-time planning/checklist
  docs, not living specs. No phase-plan doc anywhere else in this repo
  carries a "Correction" annotation (checked `hvntz/dev-docs`,
  `vaca/dev-docs`, `cvnvo/dev-docs` for the pattern — none found), so
  rewriting one here would break house convention rather than follow
  it. Notably `dev-docs/phase-automated-tests/plan.md` still says
  "11/11 real assertions pass"; the real suite is now 137 tests
  (112 pass, 25 skip without Postgres, 0 fail) — true but left as the
  historical snapshot it is, same treatment as every other phase doc
  in this repo.

## Test status
`npm test` (Node's built-in `node:test`): 137 tests, 112 pass, 0 fail,
25 skipped (Postgres-backed suites skip without a reachable
`DATABASE_URL`, by design). Identical before and after every edit in
this round — all edits were markdown-only.
