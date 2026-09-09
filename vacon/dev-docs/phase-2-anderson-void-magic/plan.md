# Plan — Phase 2: Anderson (VOID MAGIC)

## Goal
Add a new named agent, Anderson, to VACON's real registry — a direct,
explicit user instruction, not a gap found by investigation.

## Design
`V4Prototype.jsx`'s original roster (copied verbatim into
`lib/agents.js` in Phase 1) never included an agent for VOID MAGIC
specifically. Gibson already represents VOID's own routing/dispatch,
but VOID MAGIC is a genuinely different app — commercially under
Vvltvre Touring & Tix, only operationally powered by VOID (per
`voidmagic/VOID_MAGIC_MASTER_BUILD_BRIEF.md`'s own §17: "VOID MAGIC
belongs under: VVLTVRE → TOURING & TIX → VOID MAGIC → POWERED BY
VOID"). So Anderson is a real, additive agent, `app: 'VOID MAGIC'`,
`tier: 'user'` (consumer-facing, matching Kevin/Kay/Gibson/DREA), role
"Live Events Executive" — covering the real things VOID MAGIC's own
build (this session's own earlier Phase 2, 8 sub-phases) actually
does: event services, the digital waiting room/check-in flow,
notifications, creator interactions.

Domain keywords added to `lib/orchestrator.js`'s `DOMAIN_KEYWORDS`:
event ticketing, meet & greet, digital waiting room, check-in, fan
experience — grounded directly in VOID MAGIC's own real, already-built
feature set, not invented.

## A real, flagged ambiguity
Because `DOMAIN_KEYWORDS` scoring is plain substring matching (a
deliberate, non-ML choice — see Phase 1's own header), a query
containing the literal word "void" scores a hit on Gibson's existing
`void` keyword even when the query is really about VOID MAGIC. Not
resolved here: real disambiguation would require the "real LLM-backed
routing" Phase 1's own README already flags as a deliberate non-goal,
not a missing feature of this addition specifically.

## Verification approach
Plain-Node pass (11 checks): registry count (12 total), unique ids,
`getAgent`/`listAgents` returning Anderson correctly, `app` filtering
confirming VOID and VOID MAGIC stay distinct, three real routing
queries (clean win for Anderson x2, confirmed non-regression for
Gibson on a query with no ticketing/event language). Then a live pass
against the real running server.

## Done when
Anderson exists in the real registry, is queryable, and routes
correctly on real domain language without breaking Gibson's own
existing routing.
