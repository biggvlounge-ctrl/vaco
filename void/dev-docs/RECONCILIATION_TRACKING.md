# VOID — Doc-vs-Code Reconciliation Tracking

Durable checklist for the ongoing "audit VOID's own markdown docs
against its real, current code" effort. The point of this file: a
future session should be able to read this one file and know exactly
what's been checked and what's left, instead of re-deriving the whole
list from scratch (which is what happened before this file existed —
see git log for the prior round's un-tracked findings, lost to context
compaction).

**How to use this file**: when auditing a doc against code, check it
against this list first so you don't redo work. When you find a new
mismatch, add a line. When you fix one, mark it `[fixed]` in place —
never delete the line, so the history of what was wrong stays visible
(same reasoning as "never silently delete a wrong claim" in the docs
themselves).

## Round 1 — 13 Nov 2026 (prior session, context-compacted)

- `VOID_SERVICE_APP_ROADMAP.md` — "domain bookings do not settle
  through V3" claim was stale (already closed). **[fixed]** — commit
  `8970cda`.

## Round 2 — 13 Nov 2026 (this session)

Full sweep of all top-level `void/*.md` docs (README, CLAUDE.md, every
`VOID_*.md`, `BUSINESS_AGENT_GIBSON_VOID_DESIGN.md`) against the real
code in `void/lib/`, `void/server.js`, `void/test/`, and the sibling
apps' own docs/code where VOID's docs make cross-app claims.

- **Vertical count stale everywhere (23/25 vs. real 26).** The
  registry (`lib/verticals.js`) grew from 23 → 25 → 26 across Phase 9
  (`foodDelivery`), Phase 10 (`realEstateMedia`), and Phase 18
  (`voidDrop`), but most docs' headline counts were never updated past
  23 or 25. Verified directly: `node -e "require('./lib/verticals.js').listVerticals().length"` → `26`.
  Fixed in every doc that stated a specific, current-tense count:
  - `README.md` ("23 real named verticals" bullet). **[fixed]**
  - `CLAUDE.md` ("25 registered verticals" bullet). **[fixed]**
  - `VOID_SERVICE_VERTICALS_COMPARABLES.md` ("Coverage audit — all 25
    verticals" section, which had already self-corrected once from 24
    → 25 and needed the same treatment again for 25 → 26). **[fixed]**
  - `VOID_MEITUAN_MODEL_INTEGRATION.md` ("25 registered verticals"
    implementation-status line). **[fixed]**
  - `VOID_SERVICE_APPS_AND_THE_WORKDAY.md` (pervasive "twenty-five"
    framing — one dated correction note added near the top rather
    than rewriting every occurrence of the word). **[fixed]**
  - `VOID_SERVICE_APP_ROADMAP.md` (title + "25 verticals are not 25
    problems" framing — one dated correction note added, with the
    actual archetype-bucket arithmetic (23 bucketed + 2 licensing-
    gated = 25, `voidDrop` uncounted = 26) spelled out). **[fixed]**
  - `VOID_COMPLIANCE_AND_COST_REGISTER.md` ("All 25 verticals
    are built and running" / "twenty-five regulatory surfaces").
    **[fixed]**

- **Broken doc cross-reference**: `VOID_SERVICE_APPS_AND_THE_WORKDAY.md`
  pointed to `dev-docs/COMPARABLES_INDEX.md` as the place "each
  vertical's comparables document" is mapped — that file does not
  exist anywhere in the repo (confirmed: `find . -iname "*COMPARABLES*"`
  returns only `VOID_SERVICE_VERTICALS_COMPARABLES.md`, at the app
  root, not under `dev-docs/`). Corrected to point at the real file.
  **[fixed]**

- **Stale "next steps" items in `VOID_SERVICE_APP_ROADMAP.md`**: the
  "What I would do next, in order" list still had two items at the top
  (#1 "join domain bookings to marketplace jobs and V3 settlement",
  and the provider-frontend item) that the very same document's "The
  three things that block" section — ten lines above — already marks
  `~~done~~`/`~~resolved~~`. The prior round's fix (commit `8970cda`)
  corrected the "blocks" section but missed the duplicate stale
  framing further down in the "next steps" list of the same file.
  Both corrected and the list renumbered. **[fixed]**

- **Test-count drift**: `VOID_DROP.md` said `test/voidDrop.test.js`
  has "31 tests"; running it directly (`node --test test/voidDrop.test.js`)
  shows 32. Corrected. **[fixed]**

### Checked and confirmed accurate (no action needed)

Recorded so a future pass doesn't re-check these from scratch:

- `CLAUDE.md`'s `STATION_TYPES = ['port','hub-and-port']` claim —
  matches `lib/stations.js` exactly.
- Server port 8793 — matches `server.js`'s `PORT` default and every
  doc's `curl localhost:8793` examples.
- `VOID_HUB_WALKUP_ORIGINATION.md`'s claim that `fulfillmentMethod`
  never actually emits `'rideshare-style'` — confirmed in
  `lib/hubOrigination.js` (only `'drone'`/`'driver'` are ever set).
- `VOID_FOOD_CAPABLE_STATIONS.md`'s `temperatureControlled` /
  `ORDER_TYPES` / `getDeliveryPriority` claims — all present as
  described in `lib/stations.js` / `lib/dispatchIntelligence.js`.
- `VOID_APARTMENT_UNIVERSITY_LOCKER_NETWORK.md`'s `PMS_OPTIONS` (5),
  `LOCKER_LOCATION_TYPES` (3), `courierAgnostic` default — all match
  `lib/voidLocker.js` exactly.
- `VOID_MOVING_REAL_ESTATE_MEDIA.md`'s `DEFAULT_MAX_PROVIDER_TRAVEL_MINUTES`
  / `DEFAULT_AVERAGE_TRAVEL_SPEED_KMH` enforcement claims — confirmed
  in `lib/realEstateMedia.js`.
- `VOID_AMAZON_LOGISTICS_INTEGRATION.md`'s `DSP_STARTUP_CAPITAL_REQUIRED
  = 30000` and `RETRY_DELAY_HOURS = 24` — both match
  `lib/driverFleet.js` / `lib/marketplace.js` exactly.
- `VOID_COMPLIANCE_AND_COST_REGISTER.md`'s `serviceCommon.js`
  background-check-requirement claim for childcare/seniorCare/tutoring
  — confirmed in `lib/serviceCommon.js`'s `VERTICAL_VETTING_REQUIREMENTS`.
- `VOID_SERVICE_APP_ROADMAP.md`'s "22 tests" for the vetting work in
  `serviceCommon.js` — confirmed by running `test/serviceCommon.test.js`
  directly (22 pass).
- `VOID_DROP.md`'s full "API surface" route list (29 routes) — every
  one confirmed present in `server.js`.
- `VOID_DROP.md`'s "16 named products" — confirmed against
  `lib/voidDropCategories.js`'s `DROP_CATEGORIES` (16 keys).
- README's "Deliberately left for a follow-up round" list (VOID DSP,
  VOID Direct manifests, Regulated Delivery Boxes, Mobile Drone
  Docking, TaaS, delivery-method selection, Locker Network register/
  deposit + Locker-to-Door, provider-skill verification workflow) —
  confirmed `public/index.html` still has zero coverage of any of
  these (grepped for taas/regulated-box/delivery-method/mobile-dock/
  two-person/skill-verif/suspension/dsp/void-direct/manifest — no
  hits beyond an unrelated comment).
- README's "(then) 200 routes" / "168 plain-Node checks across all
  twelve phases" — both explicitly date/phase-scoped historical
  snapshots in an append-only changelog-style doc, not current-state
  claims; left as-is, consistent with how the rest of the doc already
  handles later phases.
- Files that look VOID-specific but are actually ecosystem-wide
  shared/synced infrastructure (per `sync-shared-runtime.sh`'s own
  target lists, which include `void`), so their absence from
  `CLAUDE.md`'s "Where things live" map is consistent with every other
  app's own docs, not a VOID-specific gap: `lib/serviceAuth.cjs`,
  `lib/shieldAuth.cjs`, `lib/tracing.cjs`, `lib/decisionLog.cjs`,
  `lib/operatorAuth.cjs`, `lib/storeBackend.js`, `lib/persistencePg.js`,
  `lib/settleOnce.js`. Not filed as gaps.

## Status: all findings from this round fixed. Nothing outstanding.

If a future session resumes this work, the next thing worth doing is a
similar sweep of `void/dev-docs/phase-*/plan.md` and `tasks.md` files
(not yet audited this round — this pass covered only the top-level
`void/*.md` docs) and a check of whether any sibling app's own docs
make a claim about VOID that's gone stale (this round only checked
VOID's claims about siblings, not the reverse).
