# VXLLAGE doc-vs-code reconciliation tracking

Running record of mismatches found between VXLLAGE's own markdown docs
and its real current code. Per this project's established convention:
corrections are appended to the doc that was wrong, never silently
rewritten over the original claim. This file is the durable checklist
so a later pass doesn't have to re-derive the same findings from
scratch.

## 13 Nov 2026 pass

- [fixed] `README.md`, `VXLLAGE_CLAUDE.md`, and
  `dev-docs/phase-8-real-shield-auth/{plan,tasks}.md` all referenced
  `lib/shieldAuth.js`; the real file has always been
  `lib/shieldAuth.cjs` (confirmed via `server.js`'s own `require` line
  and `../sync-shared-runtime.sh`'s "both modules are synced as
  `.cjs`, deliberately" header). Filename spelling fixed in place in
  `README.md`/`VXLLAGE_CLAUDE.md`; dated correction notes appended in
  both phase-8 dev-docs files (left their historical body text as-is).
- [fixed] `README.md`'s "Run" section told the reader to boot
  `venvs-mock-backend` on :8791 as the shared V3 ledger. This app's
  own `.env.example` defaults `V3_API_URL` to `http://localhost:8811`
  (the real `../v3/`) and `SHIELD_API_URL` to `http://localhost:8812`
  (the real `../shield/`) — not the mock, which stands in for both on
  a different port. Following the old instructions literally would
  leave both clients pointed at ports nothing was listening on. Fixed
  the Run section to boot `../v3` and `../shield` instead; appended a
  dated correction section explaining why.
- [fixed] `VXLLAGE_CLAUDE.md` claimed "a real Express service with
  nineteen backend modules" and the table's own "nineteen"/"four
  modules among nineteen" framing. `lib/` now holds 24 real modules
  (21 `.js` + `shieldAuth.cjs`/`mediaClient.cjs`/`tracing.cjs`) —
  `communities.js` and the Phase 9 persistence set
  (`persistence.js`/`persistencePg.js`/`store.js`/`storeBackend.js`)
  landed after this count was written. Appended a dated correction
  with the real current count; left the original claim in place.
- [fixed] `VXLLAGE_SOCIAL_COMPARABLES.md` claimed "19 modules, 64
  routes, persisted." Real current count: 24 modules, 70 routes
  (counted every `app.get`/`app.post` in `server.js`). Appended a
  dated correction with the real numbers.
- [fixed] `VXLLAGE_CHOPZ_VACAY_ARCHITECTURE.md`'s "Confirmed: no
  duplication needed" section still stated "Podcasts — already
  covered by Vvltvre's Pods division" as settled fact. This was
  already found false during VXLLAGE's own build
  (`lib/vavltStvdiosClient.js`'s header: "the full ecosystem status
  audit found zero real Pods code anywhere; not relied on here"), and
  has since been closed for real by a separate app, `vulture-pods/`
  ("Vvltvre Pods"), whose own README calls this exact line an
  "already-debunked false claim." VXLLAGE's own architecture doc had
  never carried the correction itself. Appended a dated correction
  with the cross-references; left the original line in place.
- [fixed] `dev-docs/phase-real-caller-authorization/plan.md` described
  adding `requireOwnAccount(bodyField)` to `shieldAuth` as the fix for
  the impersonation gap. That function does not exist in
  `lib/shieldAuth.cjs`'s real exports today — the fix that actually
  shipped (per README.md's 1 Nov 2026 "Real per-route identity
  matching" section and the repo-root `dev-docs/AUTH_HARDENING.md`
  §4) is `requireActor(field)` plus four ownership-lookup guards
  (`requireVillageMember`, `requireVillageOwner`,
  `requireArticleAuthor`, `requireSourceSurfaceOwner`) defined
  directly in `server.js`. Appended a "Superseded" note; left the
  original plan text in place.

## Checked, found accurate (no action needed)

- Route/guard inventory in `server.js`: `BOOST_LEVEL_THRESHOLDS`
  (100/500/1500 VCoin), `AVATAR_COSMETIC_CATALOG` (3 items),
  `SURFACE_TYPES` (includes `community-thread`), `villages.js`'s
  owner/member-only roles, test counts (`test/communities.test.js` = 8
  tests, full suite = 24/24) all match the real code.
- `VXLLAGE_SOCIAL_COMPARABLES.md`'s "no moderation model in code — no
  roles, no removal, no reporting" — confirmed no such code exists
  anywhere in `lib/`.
- Cross-app claims checked read-only against sibling apps: Vavlt
  Stvdios Reels duration cap (20 minutes / 1200s, in
  `vavlt-stvdios/lib/posts.js`) matches VXLLAGE's doc claim; VDP's
  Village District (`vdp/src/lib/villageDistrict.js`) auto-creates one
  village + two rooms via VXLLAGE's real API, matching
  `VXLLAGE_VDP_VILLAGE_DISTRICT.md`'s own already-appended correction
  (VAGO precedent claim already flagged false there; not re-flagged).
- `VXLLAGE_VDP_VILLAGE_DISTRICT.md`'s claim that permanent
  creator-owned/scheduled rooms remain unbuilt from VDP's side is
  still accurate even though `lib/villageRooms.js` (VXLLAGE's own
  backend) supports `ownerId`/`scheduledRecurrence` — VDP's own
  `villageDistrict.js` only auto-creates two fixed, district-owned
  rooms with no claim/schedule UI, so the "frontend side" gap this doc
  flags is real and distinct from the backend capability.
- `dev-docs/AUTH_HARDENING.md`'s coverage table (root-level, outside
  this app's directory, not editable here) says vxllage has "27
  requireActor, 4 ownership-lookup guards" — now stale by 2 (the
  `communities.js` routes added 2 more `requireActor` calls, for 29).
  Out of scope for this pass since the file lives outside
  `vxllage/`; flagged here only so a future pass on that file knows to
  check it.

## Not reached this pass (lower priority, no clear mismatch found)

- `lib/persistencePg.js` (optional Postgres-backed store via
  `DATABASE_URL`, wired through `lib/storeBackend.js`) has no mention
  anywhere in `README.md`'s "Real persistence" section, which only
  describes the file-backed JSON store. Not a wrong claim — it's a
  real, working, undocumented capability. Most sibling apps'
  `README.md`s also omit `DATABASE_URL` (checked `vdp`, `venvs`,
  `vaco-shell`), so this isn't a VXLLAGE-specific gap in the doc
  convention; left undocumented rather than adding scope not asked
  for.
- `dev-docs/phase-1` through `phase-7`'s individual plan/tasks files
  were read for structure but not line-by-line re-verified against
  current code beyond the specific claims above — they are dated
  historical records and the live, current claims they fed into
  (README.md's phase sections) were checked directly instead.
