# VACON

The ecosystem's real operating network — MIA (executive AI director)
and every named executive agent (QVAN, Leslie, Deskins, Kevin, Kay,
Gibson, DREA, Anderson, Ava, Autumn, Jacobi) actually live here, with
**V4** (`../v4-proxy/`) as their real interface layer. Per explicit
instruction: confirm whether VACON exists as real code or only as
narrative, and if it's a genuine gap, flag and build it. It was a
genuine gap — this closes it.

**What was actually there before this project**: `V4Prototype.jsx`'s
own `AGENTS` const (real id/name/role/tier/app/systemPrompt data for
10 agents) and its "VACON → MIA" Command Center screens — real,
correct display data, but frontend-only, with no backend registry any
other service could query, and no real routing logic behind MIA's own
"executive orchestrator" label. `v4-proxy` and `v4-search` were both
confirmed (read in full) to be exactly what their names say — a
key-holding LLM passthrough and a search adapter — neither implements
VACON. This project is the real, missing piece: the roster made
queryable over HTTP, MIA's own real routing logic, and a real invoke
path that proxies to `v4-proxy` for the actual completion.

**A note on "Jake," corrected from this file's own earlier claim.**
This README once said no agent named Jake existed anywhere and that
building one would mean fabricating an eleventh agent to match a name
— true at the time, no longer true now, and this section is stale
until corrected here. `venvm/lib/scriptEngine.js` later gained a real
`JAKE_SYSTEM_PROMPT` and a real callable capability behind it, which
changed the situation: Jake was not invented to match the name, he was
*registered* once a real capability existed to register. `lib/
agents.js`'s own header carries the fuller account, including the
structural argument that made it worth doing — every other consumer
app already has a VACON representative (V3/Leslie, VOID/Gibson,
DREAMS/DREA, VACAY/Kay, CVNVO/Kevin, VOID MAGIC/Anderson, Vex
Business/Stephanie, Vvltvre/Ava+Autumn+Jacobi); VENVM was the only one
with none, so MIA could not hand off production work to anyone. See
"Jake (Phase 5)" below for the real registry/verification record.

Source docs: `V4Prototype.jsx` (the real, original roster + Command
Center UI this project's registry is copied from verbatim),
`vacon-c/VACANCY_MASTER_SESSION_INDEX.md` §13 (the
"V4_EXECUTIVE_AGENT_ARCHITECTURE" framing: every named agent is "a
specialized AI executive operating inside VACON... accessed through
V4... with MIA as executive orchestrator" — the exact split this
project implements).

**Do not confuse this with `../vacon-c/`** — genuinely different
system, a naming collision this session already resolved once
(`vacon-c/README.md`'s own naming-correction note). VACON is the
operating network agents run inside; VACON-C is the game/simulation
engine (traits, Keys, Family engine) formerly called VACANCY.

## Run
```
cd vacon && npm install && npm start   # localhost:8805
```
Optionally also run `../v4-proxy` (`npm install`, a real
`ANTHROPIC_API_KEY` in `.env`, `npm start`, localhost:8787) to exercise
a real end-to-end `invoke` call — no real key exists in this session,
so that leg is verified here against a throwaway local HTTP stand-in
instead (see Verified below), the same honest posture as everywhere
else in this session network access wasn't available.

## Test
```
curl http://localhost:8805/api/health
curl http://localhost:8805/api/agents
curl -X POST http://localhost:8805/api/route -H "Content-Type: application/json" -d '{"query":"We think there was a security breach"}'
```

## What's here
- `lib/agents.js` — the real registry: `MIA` (orchestrator tier) plus
  the 10 named executives copied verbatim from `V4Prototype.jsx`'s own
  `AGENTS` const (icon/tier-color fields stay there — UI-only
  concerns, not real identity data), plus **Anderson (Phase 2)** —
  VOID MAGIC's own Live Events Executive, added directly by name.
  `V4Prototype.jsx`'s roster never included an agent for VOID MAGIC
  specifically (Gibson represents VOID's own routing/dispatch, a
  genuinely different app — VOID MAGIC belongs commercially under
  Vvltvre Touring & Tix per its own build brief's §17, operationally
  powered by VOID, but isn't VOID itself), so Anderson is a real,
  additive agent, not a copy of anything pre-existing. **Stephanie
  (Phase 4)** — Market Research Executive, `tier: 'business'` (the
  same internal-management tier as QVAN/Leslie/Deskins), `app: 'Vex
  Business'` — CALL's own internal/management-facing identity (VEX
  being the ecosystem's existing Robinhood-style trading app; "Vex
  Business" is a name reuse for CALL's internal identity, not a code
  rename or a new app). Backed by `call/packages/research`'s real,
  sourced comparable-platform findings — see `call/README.md`'s own
  "Stephanie" section and `dev-docs/phase-4-stephanie-vex-business/`.
  `listAgents({tier, app})`, `getAgent(id)`.
- `lib/orchestrator.js` — MIA's real routing logic: deterministic
  keyword scoring against each agent's own domain (drawn directly from
  their existing `role`/`app`/`systemPrompt` fields, not arbitrary),
  ranks every agent, routes to the top match or honestly falls back to
  MIA herself when nothing scores — a real, genuinely-used router, not
  a fabricated "AI routing" claim (same honesty this session already
  applied to VENVS's own NPCs). `recordRouting`/`getRoutingHistory`
  make every real routing decision inspectable, not just a stateless
  one-shot function.
- `server.js` — a real Express API (CommonJS): `GET /api/agents`
  (optionally filtered by `tier`/`app`), `GET /api/agents/:id`,
  `POST /api/route`, `GET /api/route/history`,
  `POST /api/agents/:id/invoke` — looks up the agent's real
  systemPrompt in the registry and calls straight into `v4-proxy`'s
  own `/api/agent` route for the completion (an injected, real `fetch`
  call, same pattern as every cross-app client built this session),
  rather than re-implementing the Anthropic call a second time.

## Real cross-app integration: V4Prototype.jsx
`callAgent()` now calls VACON's own `/api/agents/:id/invoke` instead
of posting to `v4-proxy` directly — VACON owns the agent's real
identity (systemPrompt) and does the actual `v4-proxy` call itself;
the frontend no longer needs to already know the prompt. The local
`AGENTS` array there is now display-only. **Flagged honestly**: that
file has no `package.json`/build of its own (it's reference material,
per its own original header) — unlike everything else touched this
session, this specific edit is unverified in a live browser, since
there's nothing to actually run it in. See `v4-proxy/README.md`'s own
updated "Wiring the frontend to it" section.

## Verified
24 plain-Node checks (registry shape — 11 total agents, unique ids,
every agent has real id/name/role/tier/app/systemPrompt;
`listAgents`/`getAgent` filtering; routing — 8 real domain queries each
confirmed routing to the correct agent, a nonsense query correctly
falling back to MIA, `routeQuery` rejecting an empty string, ranked
matches sorted correctly; the routing-history store). One real
test-script timing bug caught and fixed along the way (two log entries
recorded in the same millisecond sorted unpredictably under "newest
first" without explicit timestamps — a test-authoring issue, not an
app bug, confirmed by re-running with explicit `now` values 1000ms
apart).

Live: `server.js` run standalone — health, full agent listing (11
ids), tier/app filtering, a single-agent lookup, a 404 for an unknown
agent id, a real routed query logged and read back via
`/api/route/history`, and an honest `502` from `/api/agents/:id/invoke`
when `v4-proxy` isn't reachable (no real Anthropic key exists in this
session, so `v4-proxy` itself can't run — same limitation `v4-proxy`'s
own README already documents). To still prove the real proxying logic
end-to-end without a real key, a throwaway local HTTP server standing
in for `v4-proxy`'s own `/api/agent` contract was pointed at via
`V4_PROXY_URL`: a real invoke call confirmed VACON forwarded the
correct agent's actual `systemPrompt` and the caller's `messages`, and
correctly passed the stand-in's response back to the caller. Both test
processes shut down cleanly afterward, confirmed via port check.

**Anderson (Phase 2)**: 11 further plain-Node checks — registry now 12
total (11 + MIA), unique ids still hold, `getAgent('anderson')`
correctly returns VOID MAGIC's own agent, `listAgents({app:'VOID
MAGIC'})` returns exactly Anderson while `listAgents({app:'VOID'})`
still returns only Gibson (confirming the two apps stay genuinely
distinct in the registry), a clean meet-and-greet/ticketing query
routes to Anderson, a digital-waiting-room query routes to Anderson,
and a plain ride-dispatch query still correctly routes to Gibson, not
Anderson. **A real, honest, flagged ambiguity**: since keyword scoring
is plain substring matching, a query containing the literal word
"void" (e.g. "void magic") scores a hit on Gibson's own `void` keyword
too — the router's own deterministic-not-intelligent design (see
`lib/orchestrator.js`'s header) means a genuinely ambiguous query can
tie or favor either agent; not fixed, since building real
disambiguation would mean building the "real LLM-backed routing" this
project's own "Not yet built" section already flags as a deliberate
non-goal. Live: the real server confirmed Anderson's full record via
`GET /api/agents/anderson`, the `app=VOID MAGIC` filter, and a real
routed meet-and-greet query landing on Anderson.

**Stephanie (Phase 4)**: registry now 13 total (12 + MIA). Live via a
real running `server.js`: `GET /api/agents?app=Vex%20Business` returns
exactly Stephanie, `GET /api/agents/stephanie` returns her full
record, a competitor-research query (`"find comparable platforms to
QuantConnect for our competitive intelligence"`) correctly routes to
`stephanie` via `POST /api/route`, and an unrelated vacation-planning
query does not. See `dev-docs/phase-4-stephanie-vex-business/`.

## Real persistence
`lib/persistence.js` wraps `server.js`'s own store in a real file-backed
store, `data/store.json` (port 8805) — VACON's own real state now survives a
restart. Live-verified: routed a real agent request through the network,
killed the running process, restarted it, and confirmed the same real state
came back from a real GET. See `dev-docs/phase-3-real-persistence/`.

## Frontend coverage pass (31 Oct 2026)

An audit found `public/index.html` making real calls against only 4 of
this app's 7 registered routes — `GET /api/agents`, `POST /api/route`,
`GET /api/route/history`, and `POST /api/agents/:id/invoke`, each
cross-checked directly against `server.js` and the `lib/*.js` function
behind it before anything below was written.

- **Status tab** — `GET /api/health` had no frontend at all. Shows the
  network's own real liveness (`ok`, `agentCount`, `invocations`) and,
  honestly, the trusted-service allowlist's current posture straight
  from `serviceAuth.describe()`: its mode (`off`/`observe`/`enforce`),
  which service names are allowlisted, and which unauthenticated
  callers it has actually seen (names and counts only — never a token,
  because `describe()` itself never returns one). Mirrors Shield's own
  `kv`/`kv-cell` health-card pattern (`shield/public/index.html`'s
  `renderContract`) rather than inventing a new one.
- **Agents tab, full profile** — `GET /api/agents/:id` had no frontend
  at all; the list view only ever showed a role line. Each card now
  has a real "Full profile" button that fetches that agent's own
  single-record route directly (not reused from the list response) and
  shows its full, untruncated `systemPrompt`.

**Four real bugs fixed along the way**, found by checking the exact
field names the frontend read against what the route handlers (and
`lib/orchestrator.js`) actually return — none were gaps in coverage,
all were already-covered routes silently showing nothing or failing:
- The Agents tab read `a.represents` for the app badge; the real field
  on an agent record is `app`. The badge never rendered. Also added
  the previously-unshown `tier`.
- The Route tab read `m.matched` for the keywords that caused a match;
  `routeQuery`'s real return shape names that field `keywords`. The
  "matched: ..." line — the one piece of UI that makes a deterministic
  router's own reasoning inspectable instead of a black box — never
  rendered.
- The History tab read `h.matchedAgents` for the "Routed to" column; a
  logged entry (`recordRouting`) actually carries `routedTo` (one agent
  id) and a `fallback` flag. The column showed "—" for every real row.
- **Invoke was broken outright.** The button posted `{ query }` to
  `POST /api/agents/:id/invoke`, which requires a non-empty `messages`
  array (`[{role, content}]`, the same shape `v4-proxy`'s own
  `/api/agent` takes). Every click 400'd before the request ever
  reached `v4-proxy`, and the UI's own catch handler blamed the missing
  Anthropic key for a failure that was actually a malformed payload.
  Fixed to send `{ messages: [{ role: 'user', content: <question> }] }`
  — verified live: the same query now reaches the real 502 from an
  unreachable `v4-proxy` instead of the old client-side 400.

**Deliberately left backend-only**: `GET /api/agents/invocations`.
It requires a trusted-service credential (`X-Service-Name` +
`X-Service-Token`) checked inline against `req.callingService`, by
design — it names internal callers, which `server.js`'s own comment
says plainly is not public information. This frontend has no login for
a service credential (nor should it: embedding one in client-side JS
would defeat the entire point of the allowlist), so this stays a real,
unexposed backend capability rather than a fake "admin" UI pretending
to hold a credential it doesn't have — same posture this session's
other frontend-coverage passes already took for `requireCallingService`
/`requireOperator`-gated routes (see `void/README.md`'s own "Frontend
coverage pass").

## Not yet built
- Real LLM-backed routing (MIA's own routing is real but deterministic
  keyword scoring, not a model call — a deliberate choice, not a gap,
  see `lib/orchestrator.js`'s own header).
- No real auth/rate-limiting at this layer — `v4-proxy` already has
  per-IP rate limiting on the actual LLM call; VACON's own endpoints
  are unprotected, same posture as the rest of this prototype-stage
  ecosystem (no user accounts exist yet).
- `V4Prototype.jsx`'s own Command Center UI still renders from its
  local `AGENTS` const, not a live `GET /api/agents` fetch — the
  identity/prompt truth now lives in VACON, but the UI's display
  roster wasn't refactored into a real fetch (out of proportionate
  scope for a file with no build tooling to verify it against).
- Multi-agent routing (today's `/api/route` returns one ranked list;
  nothing chains a request across more than one agent, e.g. MIA
  delegating part of a request to Leslie and part to Deskins).
