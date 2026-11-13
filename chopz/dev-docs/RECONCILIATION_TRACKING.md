# CHOPZ — doc/code reconciliation tracking

Running log of mismatches found between CHOPZ's own markdown docs and
its real, current code (`chopz/` = the video/social app, plus its
sibling commerce app `chopz/chopz-shop/`, read-only checked for
cross-app claims). A prior round already landed one correction here
(`git log --oneline -- chopz/` → `a4aeb96`, the VENVM/Storytime
doc-claim fix) before this list was started; this file begins the
persistent checklist that round didn't leave behind.

Pass run: 13 Nov 2026.

## Found and fixed

- [fixed] `chopz/README.md` "Not yet built": claimed live shopping
  formats were still unbuilt. Real code says otherwise — CHOPZ SHOP's
  own `lib/liveShoppingEvents.js` + routes (sibling app, checked
  read-only) already closed the live-shopping half on 5 Nov 2026,
  per `chopz-shop/README.md`'s own "Live Shopping Events" section.
  Corrected inline (struck through, dated note added) rather than
  deleted; the four named ad formats are confirmed still genuinely
  unbuilt (and explicitly declined, not just pending) in
  `chopz-shop/README.md`, so that half of the bullet stands.
- [fixed] `chopz/README.md` "Real persistence": described the
  file-backed (`lib/persistence.js`) path only. Real code
  (`server.js` → `lib/storeBackend.js#attachStore`) now also supports
  a Postgres-backed store when `DATABASE_URL` is set
  (`lib/persistencePg.js`) — a real, later ecosystem-wide addition
  that was never documented here. Added a dated note; file-backed
  behavior is unchanged and still accurate when `DATABASE_URL` is
  unset.
- [fixed] `chopz/chopz-shop/README.md` "Real persistence": same gap
  as above — `server.js` boots through the same `attachStore`/
  Postgres-capable path, undocumented. Added the matching dated note.
- [fixed] `chopz/chopz-shop/README.md` "What's here": `lib/dashboards.js`
  (`creatorDashboard`, `sellerDashboard`, `trendingProducts`) and its
  three real routes (`GET /chopz-shop/dashboards/creator/:creatorId`,
  `GET /chopz-shop/dashboards/seller/:sellerId`, `GET
  /chopz-shop/discovery/trending`) existed, with real tests
  (`test/dashboards.test.js`, 7 tests), since this project's very
  first commit — never once mentioned in the README. Added real doc
  coverage for the existing code (no new feature invented).
- [fixed] `chopz/chopz-shop/README.md` "Verified": the phase-by-phase
  test-count breakdown (33 baseline / 12 Phase 2 / 6 Phase 3 "plain-Node
  checks") does not sum against the real, current test files —
  `test/money.test.js` is one consolidated 16-test file, not three
  separate per-phase files, and never was (checked against
  `git log -- test/money.test.js`: only ever touched in the single
  initial commit). The running full-suite totals quoted elsewhere in
  the same README (23/23, then 34/34) are correct and were
  cross-checked by running the suite directly. Added a dated
  correction with the real per-file counts; struck through the three
  wrong sub-counts rather than deleting them.
- [fixed] `chopz/package.json`: `description` field was a stale
  copy-paste — it described CHOPZ SHOP ("the ecosystem's short-form
  video/social commerce app") inside the *main* CHOPZ app's own
  manifest. Corrected to describe CHOPZ (the video/social app) and
  point at the real separate commerce app.
- [fixed] `chopz/package.json`: had no `"test"` script at all (unlike
  `chopz/chopz-shop/package.json`, which already has
  `"test": "node --test test/*.test.js"`). Added the matching script
  so `npm test` works the same way in both apps; no code or test
  content changed.

## Found, not a real mismatch (checked, left as-is)

- `chopz/README.md`'s per-section "Full suite: N/N" test-count claims
  (18/18 → 34/34 → 39/39 across Engagement/Duets/For You) are
  internally consistent with the real, current test files
  (`engagement.test.js` 12, `forYou.test.js` 14, `videos.test.js` 13 =
  39 total) once their actual chronological commit order is followed
  (`git log --oneline`: engagement → For You → Duets). The section
  *ordering* in the doc doesn't match commit order, but no individual
  number is wrong — left as-is.
- `VXLLAGE_CHOPZ_VACAY_ARCHITECTURE.md` (both the root copy and the
  `chopz-shop/` copy): an original, explicitly-versioned ("v1") spec/
  blueprint doc, not a current-state doc, and identical to its
  initial-commit content in both locations — not a stale claim to
  correct.
- `chopz/chopz-shop/README.md`'s "Not yet built" list (ad formats,
  measured engagement lift, all-or-nothing cart, extra category
  rates): re-checked each against the real code directly; all four
  are genuinely still true today.

## Not yet fixed (filed for a future pass)

- [filed, not yet fixed] `chopz/chopz-shop/lib/dashboards.js`'s three
  real routes (creator dashboard, seller dashboard, trending
  discovery) have no frontend tab in `chopz/chopz-shop/public/index.html`
  — checked directly, no reference to any of them there. This is a
  real, honestly-named gap, not a doc mismatch — building a frontend
  tab would be new feature work, out of scope for a doc-reconciliation
  pass, so it is only documented (see the "What's here" addition
  above), not built.
