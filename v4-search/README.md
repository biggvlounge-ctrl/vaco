# V4 Search Layer

Closes the V4 "Maps/Search/Ads" scope gap for Search — Maps already had
real architecture, and Ads is covered via DREAMS routing, but Search
never got its own canonical layer until now.

## What this is

One shared search index every V4-ecosystem app calls into, instead of
each app building its own search feature independently. Currently
routed apps:

- **HVNTZ** — nearby business hunts
- **VACAY** — stay / Experience search
- **VENVS** — storefront / product search
- **Vvltvre** — music / content search
- **VOKEN** — Cvltvre Card search
- **VACON-C** — location / discovery search within the simulation

## Setup

npm install
npm start

Expected startup output:
V4 search layer listening on http://localhost:8788
Health check: curl http://localhost:8788/api/health

## Verify (run these yourself in a second terminal)

curl http://localhost:8788/api/health
Expected: {"ok":true,"apps":["HVNTZ","VACAY","VENVS","Vvltvre","VOKEN","VACON-C"]}

curl -X POST http://localhost:8788/api/search \
  -H "Content-Type: application/json" \
  -d '{"query":"hunt"}'
Expected shape: {"query":"hunt","results":[...],"tookMs":N} with HVNTZ
documents in the results.

curl -X POST http://localhost:8788/api/search \
  -H "Content-Type: application/json" \
  -d '{"query":"stay","apps":["VACAY"]}'
Expected: results scoped to VACAY only.

## Architecture

`server.js` only talks to the `SearchAdapter` contract defined in
`adapters/SearchAdapter.js` — it never touches a specific search
backend directly. The only adapter implemented so far is
`adapters/memoryAdapter.js`: a real, working in-process index seeded
with sample documents from each routed app, useful for development and
for proving the cross-app routing end to end.

Swapping to a real vendor (Elasticsearch, Algolia, or similar) at build
time means writing one class that implements `search(query, { apps,
limit })` with the same return shape, and pointing `server.js`'s
`adapter` at it instead of `MemorySearchAdapter` — no other file
changes. Each app's real content becomes searchable by indexing it into
whichever vendor gets picked; that indexing pipeline is out of scope
for this layer, which only owns the query-time routing and contract.

## Wiring a frontend

Same pattern as `v4-proxy`: call `POST /api/search` (relative path) from
the client, proxy it to this server in dev, and serve both from the
same origin in production.

**Already wired into `V4Prototype.jsx`** (Phase 2) — this line
previously said "not yet wired," which was stale; a real,
investigation-first pass confirmed the wiring already existed:
`searchEcosystem()` calls this exact `POST /api/search` contract, and
`EcosystemSearch` (the real search screen, reachable from Home via a
real button, routed as `screen === "ecosystemSearch"`) consumes the
response's `results` array directly (`app`/`type`/`id`/`title`/
`subtitle` — the exact shape `memoryAdapter.js` returns), not a mocked
shape. The one real staleness found and fixed: `V4Prototype.jsx`'s own
`SEARCH_APPS` list and two comments still said `VACANCY`, this
project's own old name for what's been `VACON-C` since that rename —
`memoryAdapter.js`'s own seeded documents already used the current
name, so only the frontend's display list and comments were stale, not
the actual routing. Live-verified: `POST /api/search` with the exact
`{query}`-only shape the frontend's `searchEcosystem()` sends, a
scoped `apps`-filtered search, and a `VACON-C`-specific search all
confirmed returning real, correctly-shaped results against the
running server.
