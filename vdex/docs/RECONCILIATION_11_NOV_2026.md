# VDEX Reconciliation — 11 Nov 2026

**Purpose**: verify the handoff's own claims against the actual code, the same discipline this ecosystem already holds everywhere else ("citation is not presence" — a document describing a feature is not the same as the feature existing). Every item below was checked directly, not restated from `docs/CLAUDE_CODE_HANDOFF.md`/`docs/VDEX_COMPLETENESS_AUDIT_0.3.23.md`.

## Confirmed exactly as claimed

- **Test suite**: `npm test` — real 81/81 pass, 0 fail, reproduced from a clean checkout.
- **`npm run check`**: real pass, exit 0, all 32 listed files.
- **One-time consent-withdrawal tokens** (`backend/server.js`, seller leads and job applications): real `crypto.randomBytes(32)` tokens, stored only as a SHA-256 hash, verified with `crypto.timingSafeEqual`. Withdrawal genuinely erases contact/identity fields from the record rather than just flagging it.
- **"Exactly three" evidence-linked highlights** (`backend/domain/highlights.js#generateTopThree`): real — candidates need a non-empty `evidenceIds` array to be used at all, missing slots are filled with an honest "Insufficient verified information" placeholder (`confidence: 0`) rather than a fabricated third conclusion.
- **Property evidence/assessment records** (`backend/property-intelligence.js`): real — confidence is clamped `[0,1]`, assessments carry a `professionalReviewRequired` flag, development scenarios and assessments both link back to real evidence IDs.
- **National jurisdiction scaffold**: real — `JURISDICTIONS` in `backend/data-catalog.js` is exactly 56 entries (50 states + DC + 5 territories), matching the claim precisely.
- **Missouri county-equivalent pilot**: real — 115 entries (114 counties + the independent City of St. Louis), matching the claim; confirmed both by direct count and by the passing `api.test.js` assertion.
- **JWT verification** (`backend/authentication.js`): real HS256 signature check, expiry check, issuer check, audience check — not just a presence check on the header.
- **Row-level-security migration policy**: real — `ROW LEVEL SECURITY`/`FORCE ROW` statements appear in 5 of the 6 migration files (002 through 006).
- **Fail-closed acquisition-source authorization**: real — `backend/acquisition-sources.js` defaults every new connector to `pending_authorization`, and a `revoked` connector throws rather than silently allowing reauthorization.
- **Honest self-disclosure in API responses**: real and consistent — `/api/national-sources`, `/api/public-data/connectors`, and `/api/data-catalog/jurisdictions` each return a `notice` field stating plainly that the entry is a catalog/contract, not a live connection. This isn't just response text; the underlying connector modules (`backend/public-data-connectors.js`, the Census adapters) take an injectable `fetchImpl` and only report `connectionStatus: 'not_verified'` — there is no code path that marks a connection live without an actual successful call.
- **`db:dry-run` failure**: real, reproduced exactly as the founder described — `ENOENT` on the missing private `data/db.json` fixture. Fixed for verification purposes with an isolated `VDEX_DB_PATH` fixture (`{}`), which produces a clean dry-run with all-zero counts and `sourcePreserved: true`; the real fixture itself was correctly never included in the package and was not reconstructed here.

## A real discrepancy found, not previously stated

- **National source count**: the handoff and `docs/VDEX_COMPLETENESS_AUDIT_0.3.23.md` describe "a 41-source initial nationwide source discovery catalog" plus later "expanded federal and commercial source discovery." The actual `SOURCES` array in `backend/national-source-directory.js` has **36** entries, confirmed by direct count, not 41. The only test that touches this count (`tests/api.test.js`) asserts `total>=35`, which the real 36 satisfies — so the suite stayed green without ever catching the gap between the claimed and actual figure. This is the eleventh/twentieth-standing-rule shape this ecosystem already knows well: a loose `>=` assertion can't catch a specific wrong number, only a floor violation. Not fixed in this round (no instruction to add sources) — stated here so it isn't mistaken for 41 going forward.

## VULCAN/VOKEN reconciliation (this round's primary task)

Per direct correction ("Vulcan is a mistake, make sure everything Vulcan is voken"): `backend/ecosystem-integrations.js` had two genuinely separate registry entries — `vulcan` (tokenization request/status) and `voken` (credential/trust-history references). These were merged into one `voken` entry carrying both capability sets (`credential.reference`, `trust_history.read`, `tokenization.request`, `tokenization.status.read`) and both boundary lists, under VOKEN's own real `envPrefix`. The merge is coherent, not forced: VOKEN's real-world counterpart in this ecosystem already handles tokenized/fractional digital assets (Cvltvre Cards, fractional shares, per `VACO.md`'s own description of the real, coded VOKEN app), so property/project tokenization is a natural extension of VOKEN's existing domain, not an awkward mashup of two unrelated purposes.

Updated to match: `tests/ecosystem-integrations.test.js` (service count 9→8, the "owns tokenization" boundary check moved to the `voken` entry, plus a new assertion that `vulcan` must never exist as a key), `tests/api.test.js` (same count fix, `key==='vulcan'` check replaced with `key==='voken'`), `config/integrations.env.example` (the `VDEX_VULCAN_*` block replaced with a comment explaining the fold-in), and all seven doc files that named VULCAN — four rewritten directly as live/current documents (`CLAUDE_CODE_START_HERE.md`, `MASTER_SPEC.md`, `INTEGRATION_CONTRACTS.md`, `BUILD_STATUS_0.3.24.md`) plus `CLAUDE_CODE_HANDOFF.md`'s two relevant entries (bracketed correction notes added inline, preserving its own running-log structure), and two kept as historical snapshots with a single forward-pointing correction note at the top rather than rewritten (`VDEX_COMPLETENESS_AUDIT_0.3.23.md`, `BUILD_STATUS_0.3.23.md`).

Re-verified after the merge: `npm run check` and `npm test` both still pass (81/81, 0 fail), and a live server boot confirms `GET /api/integrations` now reports `total: 8` with `voken` present and no `vulcan` key anywhere in the response.

## Explicitly blocked, not built

**The Cold-to-Hot Potential Index.** The founder's own instruction says: "First search the existing project documentation and supplied conversation/reference materials for the exact previously agreed twenty categories. Do not invent a replacement category list if the original is available." A direct search (`grep -rln "Cold.to.Hot\|Cold-to-Hot" docs/`) across every document in this package, including the `docs/reference/vaco_dex_preclaude_v0_3/` archive, found **nothing** — no twenty-category list, no partial list, no mention of the concept by name anywhere in this real package. Inventing one would be exactly the kind of fabrication this reconciliation exists to prevent. This stays blocked until the founder supplies the original list from wherever it was previously agreed (a separate conversation or document this package doesn't contain).

## Task 4 (optional Part 3 extension)

Not attempted this round. Every Part 3 item checked (Property DNA expansion fields, development scenario depth, parcel/GIS assembly) either needs a real external data source this package doesn't have wired (ownership/deed history, zoning/permit feeds, environmental screening — all named in Part 3B but not present in `backend/property-intelligence.js` beyond the generic evidence/assessment shape) or a product decision only the founder can make (which development concepts to support first, what the real twenty Cold-to-Hot categories are). This round's two required deliverables — the VULCAN/VOKEN reconciliation and this report — are real, complete, and tested; a Task 4 build was judged better left for a round where a concrete, no-external-dependency extension can be identified with confidence, rather than picking one just to show movement.

## Final verification

`npm run check`: pass. `npm test`: 81/81 pass, 0 fail. Live server boot confirmed `/api/health` and `/api/integrations` both report the corrected, merged state.
