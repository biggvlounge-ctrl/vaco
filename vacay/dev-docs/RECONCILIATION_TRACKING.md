# VACAY — doc-vs-code reconciliation tracking

Running log of mismatches found between VACAY's own markdown docs and
the real current code, this round (13 Nov 2026). Per this project's
convention, every fix below was made by *appending* a dated correction
next to the stale claim in `README.md`, never by silently deleting or
rewriting it. Earlier rounds' tracking (if any existed) was lost to
context compaction before this round started, so this list was
re-derived from scratch against the real code, not resumed from memory.

## Found and fixed

- [fixed] `README.md` "Run" section told the reader to start only
  `venvs-mock-backend` (`:8791`, "V3 stand-in") and VOID, with no
  mention of Shield at all — but every mutating route across all four
  sections (30 of them) is gated by `requireActor`/`requireSession`
  from `lib/shieldAuth.cjs`, and `SHIELD_API_URL` defaults to
  `http://localhost:8812` (the real `shield` app), not `:8791`.
  Likewise `V3_API_URL` defaults to `http://localhost:8811` (the real
  `v3` app), not `:8791`. Running the Run section exactly as written,
  with no env override, leaves VACAY's mutating routes unable to reach
  either V3 or Shield. Appended a dated correction explaining the real
  default ports and the two real ways to fix it (run the real `v3`/
  `shield` apps, or override `V3_API_URL`/`SHIELD_API_URL` to point at
  the combined `venvs-mock-backend` stand-in).

- [fixed] `README.md` "Real persistence" section only described the
  file-backed `data/store.json` store via `lib/persistence.js` — but
  `server.js` now goes through `lib/storeBackend.js`'s `attachStore`,
  which also supports a real Postgres-backed store
  (`lib/persistencePg.js`) when `DATABASE_URL` is set. The Postgres
  path was entirely undocumented. Appended a dated correction
  describing both backends and that neither `storeBackend.js` nor the
  Postgres path is VACAY-specific (shared ecosystem infra).

- [fixed] `README.md` "What's here" → `lib/home/` bullet never
  mentioned `lib/home/padSplit.js` at all, even by name. Added a
  pointer to the new "Not yet built" entry below.

- [fixed] `README.md` "Not yet built" section had no entry for
  `lib/home/padSplit.js` — a real, complete PadSplit room-by-room
  co-living module (split a listing into rooms, move members in/out,
  weekly rent split host/platform via `settleFn`) that exists in the
  codebase but:
  - is wired to no route anywhere (`lib/home/routes.js` never
    `require`s it, and no other file does either — confirmed by
    search, not assumed);
  - has no test file exercising it;
  - is currently broken if ever called: `lib/store.js`'s `home`
    namespace never initializes `rooms`/`residencies`/`nextRoomId`/
    `nextResidencyId`, so `splitProperty` throws `TypeError: Cannot
    read properties of undefined (reading 'push')` on its first real
    call — reproduced directly with a small Node script against a
    fresh store, not inferred from reading the code.
  Added a flagged, dated gap entry describing exactly this. Per the
  task's own scope (reconciliation, not expansion), the module itself
  was **not** wired up or fixed — only documented as the real,
  broken, unreachable code it currently is.

- [fixed] `README.md` "UI" section contradicted itself within the same
  section: one paragraph says the CarGurus for-sale marketplace was
  "newly wired" into the UI this round (true — confirmed in
  `public/index.html`, a real "List your car for sale ($25 flat fee)"
  button that `POST`s to `/api/auto/for-sale-listings` as the seller),
  while a later paragraph claims "no UI anywhere for a host/agent/
  seller side (listing creation...)" — which is false as a blanket
  claim given the first paragraph's own feature. Appended a dated
  correction narrowing the still-missing claim to the three creator
  sides that really have no UI (Stays host via `hostId`, Home agent
  via `agentId`, Auto/Turo vehicle owner via `ownerId` — none of which
  appears anywhere in `public/index.html`), while leaving the rest of
  the original claim (strike count, seller-lead review, job-
  application review) as still accurate.

## Checked, confirmed accurate, not changed

- `FEE_PERCENT = 15.5` in `lib/bookings/bookings.js` matches the
  README's and `VACAY_COMPARABLES.md`'s stated 15.5% Airbnb-anchor fee.
- `hostType` really is a plain field with no other behavior anywhere
  in `lib/bookings/*.js` (no ranking, no insurance/verification gate) —
  matches the "Not yet built" claim.
- `marketAveragePrice` in `lib/auto/carListings.js` really is
  caller-supplied, not computed — matches the "Not yet built" claim.
- VOID's real endpoints VACAY's README cites all exist as described:
  `POST /api/job`, `POST /api/hourly-booking`, `GET /api/drop/assets/
  nearby`, `POST /api/drop/booking`, `POST /api/ride-pass/purchase`
  (checked read-only in `void/server.js`).
- `void/VOID_MASTER_FREEZE.md` really does cite "VACAY's own brief" at
  the line VACAY's README quotes, and no such brief exists anywhere in
  this session — the README's claim about that is accurate.
- No `vplan` app/directory exists anywhere in the repo — the README's
  "VPLAN doesn't exist as code anywhere yet" claim is accurate.
- `npm test` (50 tests: `bundles.test.js` 8, `dropStays.test.js` 4,
  `listByActor.test.js` 4, `money.test.js` 34 — summed, matches the
  suite total) passes in full both before and after this round's doc
  edits (doc-only changes, zero code touched).
- `VACAY_COMPARABLES.md`'s own "Implementation status" corrections
  (host-cancellation guarantee, double-booking overlap detection in
  four real places) were checked directly against
  `lib/bookings/bookings.js`, `lib/bookings/experiences.js`,
  `lib/auto/rentals.js`, `lib/auto/fleetRentals.js` and are accurate as
  written by the prior round; no further correction needed.

## Noted, out of scope for this round (not a markdown-doc claim)

- `server.js`'s own code comment says "every one of VACAY's 29
  mutating routes" — a direct count of `router.post/put/patch/delete(`
  across all four `lib/*/routes.js` files comes to 30, not 29. This is
  a source-code comment, not a markdown doc, so it is outside this
  round's scope (doc-vs-code reconciliation) and was left alone —
  noted here only for whichever round next touches `server.js` itself.
