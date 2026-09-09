# Plan — Phase 2: verify frontend wiring + fix stale naming

## Goal
The ecosystem audit's own priority list flagged "V4's `v4-search`
wiring into `V4Prototype.jsx`'s UI" as a real, open gap, and the
README's own "Wiring a frontend" section said outright: "Not yet wired
into `V4Prototype.jsx`." Investigate and close it for real.

## Real investigation before any code
Read `V4Prototype.jsx` in full around its search-related code rather
than trusting the README's claim. Found:
- `SEARCH_ENDPOINT = "/api/search"` and `searchEcosystem(query)`
  already call this exact server's real contract.
- `EcosystemSearch` (a full component: input, loading/error states,
  results list) already consumes `searchEcosystem`'s results directly.
- `SearchResultRow` already renders `result.app`/`type`/`id`/`title`/
  `subtitle` — the exact shape `memoryAdapter.js` returns, not a
  mocked shape.
- `EcosystemSearch` is already routed (`screen === "ecosystemSearch"`)
  and already reachable from Home via a real `onClick={() =>
  go("ecosystemSearch")}` button.

Conclusion: the wiring was already fully real and complete. The
README's "Not yet wired" claim was stale, not accurate — the same
"verify a doc claim rather than trust it" discipline this session has
applied to false claims found elsewhere (VACON-C's Artifact/Mission
system, CVNVO's validation-asymmetry line).

The one real staleness actually found: `V4Prototype.jsx`'s own
`SEARCH_APPS` display list and two comments still said `VACANCY`,
this project's own old name for what's been `VACON-C` since that
rename earlier in this session. `memoryAdapter.js`'s own seeded
documents already used the current name (`app: "VACON-C"`) — only the
frontend's display list and comments were stale, not the actual
routing (search still worked either way, since the app-name string is
just a display value on this axis, not what gates the query).

## Design
Fix, not rebuild: three literal string replacements in
`V4Prototype.jsx` (`SEARCH_APPS` array, two comments), changing
`"VACANCY"` to `"VACON-C"`. No behavioral change to the actual search
routing, since `memoryAdapter.js` was already correct. Correct the
README's own stale "not yet wired" line into an accurate, verified
account of what already exists.

## Explicitly NOT in this task
No dev server exists for `V4Prototype.jsx` as a standalone file (no
`package.json`, meant to be embedded in a real host app's dev
environment per `v4-proxy/README.md`'s own "Wiring the frontend"
section) — a full browser-rendered UI test wasn't possible here.
Verification instead confirmed the real backend contract the frontend
already calls into, matching the frontend's own exact request/response
shapes.

## Verification approach
A live pass against the real running `v4-search` server: the exact
`{query}`-only request shape `searchEcosystem()` sends, a scoped
`apps`-filtered request matching `EcosystemSearch`'s own capability,
and a `VACON-C`-specific search confirming the current name is what
the backend actually indexes under.

## Done when
The frontend-wiring gap is confirmed already closed (not rebuilt), the
one real staleness (`VACANCY` → `VACON-C`) is fixed, and the README
accurately reflects the real, verified state instead of a stale claim.
