# Tasks — Phase 1: The Operating Network

- [x] Investigate: read `V4Prototype.jsx`, `v4-proxy/server.js`,
      `v4-search/server.js` in full to confirm VACON did not exist as
      real code anywhere.
- [x] `lib/agents.js` — `MIA`, `AGENTS` (10, copied verbatim from
      `V4Prototype.jsx`), `ALL_AGENTS`, `listAgents`, `getAgent`.
- [x] `lib/orchestrator.js` — `DOMAIN_KEYWORDS`, `scoreAgent`,
      `routeQuery`, `recordRouting`, `getRoutingHistory`.
- [x] `lib/store.js` — `routingLog`.
- [x] `server.js` — health, agents list/filter/get, route + history,
      real invoke proxying to `v4-proxy`.
- [x] `npm install`.
- [x] Verify in plain Node (24 checks): registry shape/filtering, 8
      real routing cases, fallback, validation, ranked ordering.
- [x] Caught and fixed a real test-script timing bug (two same-
      millisecond log entries sorted unpredictably without explicit
      timestamps) — confirmed via explicit `now` values, not an app
      bug.
- [x] Verify live: server standalone (health, agents, route + history,
      404, honest 502 with no `v4-proxy` reachable).
- [x] Verify the real invoke plumbing end-to-end against a throwaway
      local HTTP stand-in for `v4-proxy` (no real Anthropic key exists
      in this session) — confirmed the correct systemPrompt + messages
      forwarded and the response passed back correctly.
- [x] Shut down all test processes; confirmed via port check.
- [x] Update `V4Prototype.jsx`'s `callAgent()` to route through VACON;
      flagged as unverified live (no build tooling for that file).
- [x] Update `v4-proxy/README.md`'s "Wiring the frontend to it".
- [x] Write `README.md`, this plan/tasks pair.

## Next
Real LLM-backed routing (if ever wanted — currently a deliberate
choice, not a gap). Refactor `V4Prototype.jsx`'s Command Center UI to
fetch its display roster from VACON's own `GET /api/agents` instead of
its local constant. Multi-agent delegation/chaining for a single
query.
