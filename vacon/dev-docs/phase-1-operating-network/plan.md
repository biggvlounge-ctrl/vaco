# Plan — Phase 1: The Operating Network

## Goal
Confirm whether VACON exists as real, built code or only as narrative
flavor text, and if it's a genuine gap, build it. Confirmed genuine:
`V4Prototype.jsx`'s own `AGENTS` const and "VACON → MIA" Command Center
UI are real, correct display data, but frontend-only — no backend
registry, no real routing logic, nothing any other service could
query or call into. `v4-proxy` (a key-holding LLM passthrough) and
`v4-search` (a search adapter) were both read in full and confirmed to
implement exactly what their names say, nothing more.

## Design
- `lib/agents.js`: `MIA` + the 10 named executives, copied verbatim
  from `V4Prototype.jsx`'s own `AGENTS` array (id/name/role/tier/app/
  systemPrompt) — real source material, not reinvented. Icon/tier-color
  fields are UI-only and stay in that file.
- `lib/orchestrator.js`: MIA's real routing logic — deterministic
  keyword scoring per agent, grounded in each agent's own existing
  `role`/`app`/`systemPrompt`, not an LLM classifier (flagged as a
  deliberate choice, not a shortcut — routing to one of 10 agents
  doesn't need its own model call).
- `server.js`: real Express API exposing the registry, MIA's routing
  (with a real, inspectable log), and a real `invoke` endpoint that
  looks up an agent's systemPrompt and proxies to `v4-proxy`'s own
  `/api/agent` route for the actual completion — VACON never
  reimplements the Anthropic call.
- `V4Prototype.jsx`'s `callAgent()` updated to call VACON's invoke
  endpoint instead of `v4-proxy` directly, so VACON is a real, load-
  bearing piece of the one place this roster is actually used, not
  parallel dead code.

## The "Jake" question
User-named alongside MIA/Qvan/Leslie/Deskins/Gibson. No agent named
Jake exists anywhere in this session's source docs or in
`V4Prototype.jsx`'s own roster. The only real "Jake" found anywhere is
VENVM's own production-stack lead — a different real thing, a
human/tool credit, not a VACON executive. Resolved by building the
real, established roster exactly as `V4Prototype.jsx` already defined
it, and flagging the mismatch honestly rather than fabricating a
tenth-plus agent to match the name.

## Explicitly NOT in this task
Real LLM-backed routing (a deliberate choice). Refactoring
`V4Prototype.jsx`'s Command Center UI to fetch its display roster from
VACON live (that file has no build tooling in this session to verify
such a change against, so only its actual network call — `callAgent`
— was changed). Multi-agent delegation/chaining.

## Verification approach
Plain-Node pass (24 checks): registry shape and filtering, 8 real
domain queries each confirmed routing correctly, fallback-to-MIA on a
nonsense query, input validation, ranked-match ordering, the routing
log. Then a live pass: the real server run standalone (registry
endpoints, routing + history, a 404, an honest 502 when `v4-proxy`
isn't reachable — no real Anthropic key exists in this session). To
still prove the real proxy plumbing without a key, a throwaway local
HTTP stand-in for `v4-proxy`'s own contract was pointed at via
`V4_PROXY_URL`, confirming VACON forwards the correct systemPrompt and
messages and passes the response back untouched.

## Done when
- The roster is real, queryable, and matches `V4Prototype.jsx` exactly.
- MIA's routing is real, tested, and its decisions are inspectable.
- The real invoke path is proven end-to-end (against a stand-in, since
  no real key exists here) rather than only unit-tested in isolation.
- `V4Prototype.jsx` is a real caller of VACON, not parallel dead code.
