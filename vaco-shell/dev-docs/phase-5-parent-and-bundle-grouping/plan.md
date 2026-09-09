# Plan — Phase 5: 15 real parents, 5 real bundles + a full runnability sweep

## Goal
Per direct instruction: confirm every one of the ecosystem's 15 real
"parent" apps has a genuinely working frontend and backend, then group
those 15 parents into 5 real bundles of 3, by functional similarity,
"to make it easier to function with similars."

## The 15 parents (confirmed with the user directly, iteratively)
Vex, VACON-C, VACAY, VENVS, VOID, CVNVO, HVNTZ, Vvltvre, Vault, V3, V4,
CHOPZ, VXLLAGE, VAGO, VOKEN. Several fold multiple real, independently-
running apps together (organizational only — nothing about how these
apps actually run changed): Vvltvre = Music + Flix + Pods + Studios +
VENVM; VACON-C = the civilization-sim engine + VACON + VSAFE; V3 = the
ledger + VACA; V4 = the proxy + the search layer; CVNVO = itself +
YAP; CHOPZ = itself + CHOPZ SHOP; Vex = the Vex Trading shell (VEX +
Vex Business). `vdp` (the shared walkable-world host), `vaco-analytics`,
`shield`, and `v3-shield` (legacy mock) aren't products of their own —
no parent.

## Real investigation before any code
1. **Backend runnability, checked live, not assumed**: booted all 23
   real backends behind these 15 parents (skipping `vex`/`vex-business`/
   `vex-trading`/`voken`, already re-verified in the prior phase) and
   hit each one's own `/api/health`. 22/23 responded 200 immediately.
   The one non-200 (`v4-proxy`) was read directly rather than assumed
   broken: it's a real, deliberate `FATAL: ANTHROPIC_API_KEY is not
   set` refusal-to-boot — the app's own documented safety behavior,
   not a bug.
2. **Frontend coverage, checked against VDP's real district list**
   (`vdp/src/lib/world.js`), not assumed from each app's own
   directory structure (most of these apps are API-only by design —
   their real UI is a VDP district, the established ecosystem
   pattern). 14 of 15 parents have a confirmed real district. The one
   without: **VACON-C** (and by extension VSAFE/VACON, folded into
   it) — flagged directly to the user rather than silently built or
   silently skipped, since a new civilization-sim UI is real, sizable,
   net-new scope, not a wiring fix.
3. **Two more real, stale registry bugs found and fixed while
   verifying**, the same class as the earlier VENVS/VEX finding:
   - `vacay`'s description still said "API only, no UI yet" — false;
     VDP's real `vacay-embed` district (`VACAY Experiences`) already
     exists. Updated to say so.
   - `venvs`'s description still listed "VADO" after "VEX" was
     removed last phase — but VADO was deleted from VENVS in the same
     Phase 12 that removed VEX (confirmed directly in
     `venvs/README.md`: "VEX/VADO removed (Phase 12)"). Both were
     stale, not just one.
4. **Three real, already-built apps were missing from the registry
   entirely** — `dreams`, `venvm`, `vulture-studios` all have real
   servers, real ports (confirmed by reading each `server.js`
   directly), and real VDP districts, but no `vaco-shell` entry.
   Added all three.

## Design
Added `parent`/`bundle` fields to every real registry entry rather
than building a separate merged data structure — keeps every real,
independently-running app's own true identity/port/health-check
intact (folding is purely organizational), while making "find
everything related to X" a real, live query instead of tribal
knowledge. `BUNDLES` is a small, separate array (5 entries, `name` +
`parents`) so the bundle list itself stays a single source of truth;
`listBundles()`/`getBundle()` derive each bundle's real app list from
`APPS` live rather than duplicating it.

The 5 bundles, grouped by genuine functional similarity (not
alphabetical or insertion order):
- **Financial & Trading**: Vex, V3, VAGO — real money-movement
  mechanics (futures/brokerage trading, the VCoin/VASH ledger,
  wagering/casino currency).
- **Commerce & Marketplace**: VENVS, VOKEN, CHOPZ — real buy/sell
  marketplaces (analog commerce, digital collectibles, video+shop).
- **Social & Discovery**: VXLLAGE, CVNVO, HVNTZ — real social
  feed/engagement mechanics (villages/threads, dating, hunts/explore).
- **Leisure & Entertainment**: VACAY, Vvltvre, Vault — real
  leisure/content consumption (travel/experiences, music/flix/pods/
  financing, multi-channel streaming).
- **Operations & Infrastructure**: VACON-C, VOID, V4 — the real
  operational backbone (agents/simulation/safety, logistics, search/AI
  interface).

`vaco-shell/server.js`: `GET /api/bundles` (all 5, each with its real,
live app list) and `GET /api/bundles/:name`.

## Verification approach
Live, not just source-level: booted `vaco-shell` and called both new
endpoints. `GET /api/bundles` returned all 5 bundles with exactly the
right apps under each (spot-checked the counts match the design
above); `GET /api/bundles/leisure%20%26%20entertainment` correctly
resolved a single bundle by name. `GET /api/apps` grew from 28 to 31
entries (the 3 real apps that were missing), each carrying its correct
`parent`/`bundle`.

## Explicitly NOT in this task
No new docker-compose/start-script grouping — the user's own framing
("easier to function with similars") was about findability/
organization, not a new deployment topology, so this stays a real
data/API feature, not new infra. No VACON-C frontend was built here —
flagged as a real, open question for the user rather than assumed
either way.

## Done when
- All 15 parents' real backends are confirmed live (or, for the one
  exception, confirmed to be correctly refusing to boot by design).
- Every parent's real frontend surface is confirmed (a VDP district,
  or — for the one gap found — explicitly flagged as missing rather
  than silently ignored).
- `GET /api/bundles` and `GET /api/bundles/:name` are live, correct,
  and derived from the same single real `APPS` list every other
  endpoint already uses.
