# VOKEN doc-vs-code reconciliation tracking

This round (13 Nov 2026) re-audited VOKEN's own markdown docs
(`README.md`, `VOKEN_ARCHITECTURE.md`, `VOKEN_MASTER_SPEC_PROGRESS.md`,
`VOKEN_NEW_VALUE_ALGORITHM.md`, `VOKEN_VALUE_DISPLAY_CARD_INDUSTRY_COMPARABLES.md`,
`VEX_VADO_RESTRUCTURING.md`, `dev-docs/`) against the real code in
`voken/lib/`, `voken/server.js`, `voken/test/`, and the cross-app code
it cites in `vex/`, `vdp/`, `vulture-music/`, `vulture-pods/`,
`vulture-flix/`, `cvllex/`, `vago/`, `venvs/`. A prior round (see
`git log --oneline -- voken/`) had already landed a real VACA
verification badge; this round starts from scratch, re-deriving the
remaining gaps rather than resuming a lost checklist.

No persisted checklist existed for VOKEN before this file.

## Mismatches found and fixed

- [fixed] `README.md` (Phase 15 referral section): said
  `VOKEN_PLATFORM_ACCOUNT` is imported "from `lib/vex.js`" — that file
  was deleted in Phase 16. The "What's here" section already correctly
  names `lib/platformAccount.js`; this paragraph did not get the same
  update. Appended a dated correction rather than rewriting.
- [fixed] `README.md` (`lib/complianceGate.js` entry): said the gate
  "now only guards fractional ownership" after the VEX extraction —
  stale, since `GATES` also holds a second real gate,
  `influencer-culture-card-rewards` (confirmed in `lib/complianceGate.js`
  and already correctly documented in `VOKEN_ARCHITECTURE.md`'s own
  compliance table). Appended a dated correction.
- [fixed] `README.md` ("## Real persistence" section): documented only
  the file-backed store (`lib/persistence.js`, `data/store.json`).
  Real, undocumented gap: `server.js` now boots its store through
  `lib/storeBackend.js`'s `attachStore()`, which uses
  `lib/persistencePg.js` (Postgres) instead whenever `DATABASE_URL` is
  set — and checked directly, this repo's own `docker-compose.yml`
  *does* set `DATABASE_URL` for the `voken` service, so VOKEN's real
  deployed default is Postgres-backed, not file-backed as the section
  implied. Added real missing coverage; also noted `.env.example`
  itself doesn't mention `DATABASE_URL` at all.
- [fixed] `README.md` ("VEX moved out (Phase 16)" section): claimed VEX
  "is a real, live HTTP client of VOKEN's own card API" for
  `POST /api/card/:id/edition` / `POST /api/card/:id/transfer`. Live-
  verified this is no longer true under VOKEN's own current defaults:
  `lib/serviceAuth.cjs`'s global middleware defaults to `enforce` and
  401s any mutating request with no Shield session and no
  `X-Service-Name`/`X-Service-Token` pair; booted the real server and
  confirmed both routes 401 with no headers, which is exactly what
  `../vex/lib/vokenClient.js` sends today (it attaches no service
  headers at all, unlike `../vex/lib/operatorAuth.cjs` and
  `../vex/lib/decisionLog.cjs`, which already do this correctly for
  VEX's other outbound calls). This is a real gap on VEX's side of the
  boundary — not fixed here, since `vex/` is a sibling app out of this
  session's scope (read-only on sibling code per instructions); flagged
  in VOKEN's own README with a dated correction instead of leaving the
  doc read as working integration proof.
- [fixed] `VOKEN_ARCHITECTURE.md` (compliance section): cited
  `lib/resale.js`, which does not exist. Corrected to the real files:
  `lib/auctions.js`'s resale royalty mechanic
  (`SECONDARY_SALE_ROYALTY_RATE` in `lib/cultureCards.js`),
  `lib/trading.js` for peer swaps, and `lib/fractionalOwnership.js` for
  the separate fractional-share secondary market.
- [fixed] `VOKEN_ARCHITECTURE.md` (data model comment + "Still open"
  closing note) and `VOKEN_MASTER_SPEC_PROGRESS.md` (placeholder
  category/rarity section): both said "10 categories" as the current
  count. The real `CATEGORIES` in `lib/cardTypes.js` is 11 — a real
  `historic` category was added later for the Historic Register
  (`lib/historicRegistry.js`) and never reflected back into these two
  docs. Rarity tier count (7) is still accurate in both. Appended dated
  corrections in all three locations rather than rewriting the
  original placeholder text.

## Claims checked and confirmed accurate (no fix needed)

- `lib/cardTypes.js`: `RARITY_TIERS` is still exactly the 7 claimed.
- `lib/historicRegistry.js`: `HISTORIC_REGISTRY` has exactly 34 entries
  as claimed.
- Server port 8794, VACA port/URL default (8804,
  `VACA_API_URL`/`fetchAuthenticityGrade`), `VACO_OPERATOR_MODE`
  three-value gate, and the `voken:mint-external-card` /
  `voken:grade` / `voken:predict` operator scopes all match
  `server.js`/`lib/operatorAuth.cjs` exactly.
- `SECONDARY_SALE_ROYALTY_RATE = 0.10`, `DEFAULT_CARDS_PER_PACK`
  (5/5/5/3), `RECOMMENDED_MINT_COUNTS_BY_RARITY` (all 7 tiers),
  `SECONDARY_LOCKUP_MS` (90 days), the scarcity formula
  (`100 - log10(totalMintCount+1)*40`), and `TRADITIONAL_WEIGHTS`
  (0.35/0.25/0.25/0.15, summing to 0.85 traditional + rookie) all
  match `lib/*.js` exactly.
- `EXTERNAL_SCORE_WEIGHTS` (social 0.30 / press 0.15 / recognition
  0.10 / consumption 0.25 / achievement 0.20, summing to 100) and the
  per-unit achievement/recognition point values match
  `lib/establishedCreatorAssessment.js` exactly.
- `REFERRAL_TIERS` (1/3/5/10 referrals → 10/25/50/150 VCoin + 1/1/2/3
  spins) matches `lib/referralGrowth.js` exactly.
- `cardEngagement.js`'s five engagement types (`view`/`click`/
  `comment`/`like`/`share`) and view-dedup-per-viewer behavior match.
- Cross-app integration claims verified by reading the actual sibling
  code (read-only): `vulture-music.getTotalStreamCountForArtist`/
  `getAlbumCountForArtist`, `vulture-pods.getTotalListensForCreator`,
  `vulture-flix.getTotalViewsForCreator`,
  `cvllex.getTotalUnitsRedeemedForCreator` and
  `GET /api/production-orders/creator/:creatorId`, `vago`'s
  `voken-culture-card` prediction-market source, VEX's and VDP's own
  `vokenClient.js` files, and VOKEN's own
  `GET /api/card/:id` / `POST /api/card/:id/edition` /
  `POST /api/card/:id/transfer` routes all exist exactly as described
  (the VEX-auth gap above is a separate, narrower finding about
  whether that call is actually *authorized*, not whether the routes
  exist).
- The historic-card worked example in `README.md` (a freshly-minted,
  zero-engagement Stonehenge card scoring `combinedRealValueScore: 31`,
  `genuineSignificanceScore: 80`, pricing at `$15.50`) was re-run
  directly against `lib/valueAlgorithm.js`/`lib/cardMarketPrice.js` and
  reproduces exactly.
- `ROOKIE_BONUS = 15` and the `voken_vado_<type>:<id>` V3 settlement
  reason string (`lib/auctions.js`) match `VOKEN_ARCHITECTURE.md`'s
  claims exactly.
- The "103 routes" figure (`README.md`'s "Frontend coverage pass") was
  checked against a live count of `app.<method>(` calls in
  `server.js`: exactly 103 today.
- `VEX_VADO_RESTRUCTURING.md` already carries its own correct, dated
  "SUPERSEDED on VEX" framing — no stale claims found there.

## Not fixed (out of scope / not a doc-vs-code mismatch)

- `lib/complianceGate.js`'s own code comment is internally
  inconsistent (says "this module now only ever guarded VADO
  fractional ownership" immediately above a `GATES` array that defines
  two gates). This is a code comment, not a markdown doc, so left
  alone per this round's scope — noted here so it isn't lost.
- The VEX-side fix for the service-auth gap above (adding
  `X-Service-Name`/`X-Service-Token` to `vex/lib/vokenClient.js`)
  belongs to a VEX audit round, not this one — `vex/` was read-only
  for this session.

## Test suite

`npm test` (Node's built-in test runner, `test/*.test.js`): 279/279
passing before this round's doc edits and 279/279 passing after — all
changes this round were to `.md` files only, no `lib/`, `server.js`,
or `test/` changes.
