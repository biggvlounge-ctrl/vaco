# Plan — Phase 1: V4 Search Layer (retroactive record)

## Note
This dev-docs pair was written retroactively, closing a real gap
found while investigating V4 during a later priority pass: `v4-search`
had no `dev-docs/` folder at all despite being real, working code —
this documents the architecture as it actually exists in
`server.js`/`adapters/`/`README.md`, not a fresh build.

## Goal
Close the V4 "Maps/Search/Ads" scope gap for Search specifically —
Maps already had real architecture, Ads is covered via DREAMS routing,
but Search never got its own canonical cross-app layer.

## Design
One shared search index every V4-ecosystem app calls into instead of
each app building its own search feature independently. `server.js`
only talks to the real `SearchAdapter` contract
(`adapters/SearchAdapter.js`) — it never touches a specific search
backend directly, so swapping to a real vendor (Elasticsearch,
Algolia) later means writing one class with the same
`search(query, {apps, limit})` shape, no other file changes.
`adapters/memoryAdapter.js` is the one real, working implementation so
far: a real in-process index seeded with sample documents from each
routed app (HVNTZ, VACAY, VENVS, Vvltvre, VOKEN, VACON-C).

## Verification approach
Documented in `README.md`'s own "Verify" section: a health check
confirming the routed app list, an unscoped search confirming
cross-app results, and a scoped (`apps`-filtered) search confirming
routing actually respects the filter.

## Done when
A real, working shared search layer exists behind a real adapter
contract, confirmed via the README's own documented verification
steps.
