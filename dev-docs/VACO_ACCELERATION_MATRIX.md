# VACO Acceleration Matrix

**Build what makes VACO unique. Reuse proven technology for commodity
infrastructure.**

**Date:** 2026-08-26 · **Method:** the VACO column is measured against
this repository. The external column is assessed from engineering
knowledge, **not from a live check** — see the caveat immediately below.

---

## Read this first — two caveats that bound every recommendation

**1. No network access in this session.** Versions, pricing, licence
terms, and current maintenance status of every external technology
below could not be verified. Anything stated about cost or licence is a
*prior*, not a fact. `dev-docs/STANDING_INSTRUCTION_ONGOING_EVALUATION.md`
already governs this: *flag, don't silently replace.* Every INTEGRATE or
REPLACE verdict here is **conditional on a live re-check at decision
time**. Licence changes in this category are not hypothetical — several
infrastructure projects in this matrix have relicensed in the last few
years.

**2. This is not a rewrite directive.** The existing implementation is
the source of truth. 855 routes, 29 frontends, 391 tests, and the money
paths through V3 are the foundation to be hardened and accelerated — not
inventory to be replaced. Where a verdict is REPLACE, it replaces a
*commodity* layer, never a domain mechanic.

---

## The classification

| | Meaning |
|---|---|
| **KEEP** | VACO's own implementation is better suited, or the external option solves a problem VACO does not have. Do nothing. |
| **INTEGRATE** | Adopt alongside what exists. VACO keeps its own logic; the external tool takes a job VACO currently does badly or not at all. |
| **REPLACE** | The external option does the same job better, and the VACO code is commodity plumbing rather than domain knowledge. |
| **BUILD** | No adequate external option exists, or the thing *is* VACO's differentiation. Keep building it in-house. |

---

## Section 0 — The honest baseline

Before evaluating anything external, here is what the repository
actually runs on. This was measured, not recalled.

**The entire 29-app Node backend depends on three packages**:
`express`, `cors`, `dotenv`. That is the whole dependency surface.

| Concern | What VACO uses today |
|---|---|
| HTTP | `express` |
| Persistence | a recursive `Proxy` over an in-memory object, debounce-flushed to `store.json`, with a synchronous `commit()` on money routes |
| Money | `v3` — a real double-entry-ish ledger service, HTTP, idempotency keys, no reversal endpoint by design |
| Identity | `shield` — one session service, `?shieldToken=` handoff, `requireSession()` middleware copied per app |
| Cross-app calls | injected function parameters (`transferFn`, `appExistsFn`, `hvntzFetchFn`) — **zero cross-app `require()`** |
| Search | `v4-search` — fan-out over per-app adapters |
| Telemetry | `vaco-analytics` — apps POST metrics to it |
| Tests | `node:test`, 391 of them |
| Browser tests | Playwright, one smoke harness |
| Deploy | `docker-compose.yml`, three shell scripts |
| CI | **none** — no `.github/workflows` directory exists |
| Frontend | `vaco-design.css` + `vaco-ui.js`, synced into 29 `public/` dirs |

**One exception, and it matters.** `vex-business/` already runs
PostgreSQL, Alembic, uv, ruff, mypy, pytest, and its own
`docker-compose.yml`. VACO has already demonstrated it will adopt a
serious external stack when the domain demands it. The question in this
document is therefore not *whether* VACO adopts external technology —
it already has — but *where the line falls*.

Two dependencies outside that baseline: `pg` in `vacon-c`, `ws` in
`cvnvo`.

**What this baseline means for every verdict below.** A three-package
backend is not naïveté; it is why the money code is auditable. But it
also means every non-domain concern — telemetry, auth cross-checks,
retries, scheduling, feature flags — is either hand-rolled per app or
absent. That is precisely the commodity surface this matrix targets.

---

## Section 1 — Monorepo tooling

**What VACO has:** 29 npm projects, each with its own `node_modules`,
started by `start-ecosystem.sh`. No workspace root, no shared lockfile,
no build graph, no affected-target detection. `sync-design-system.sh`
is a hand-written file-copy step with a `--check` drift mode — which is,
functionally, a bespoke one-rule build task.

**External options:** Nx, Turborepo, npm/pnpm workspaces, Bazel.

| | Assessment |
|---|---|
| Overlap | High for caching and task orchestration; nil for domain logic |
| Advantage | One `npm ci`, one lockfile, cached task runs, "test only what changed" — with 391 tests across 17 suites, and no CI yet, this is the difference between a 30-second and a 6-minute feedback loop |
| Disadvantage | A build graph is a new thing to be wrong. Nx in particular brings generators and plugins VACO does not need |
| Licensing | Permissive (MIT-family) for pnpm workspaces and Turborepo; Nx has a paid cloud tier that is optional |
| Migration effort | pnpm workspaces: low. Turborepo: low-moderate. Nx: moderate-high |
| Lock-in | Low for workspaces, low-moderate for Turborepo |

**Verdict: INTEGRATE — pnpm (or npm) workspaces first, Turborepo only if
CI runtime becomes the bottleneck.**

Start with workspaces alone. It collapses 29 `node_modules` into one
store and gives a single lockfile, which is the precondition for
Dependabot/Renovate (§14) doing anything useful. Do **not** adopt Nx —
its value is in code generation and plugin ecosystems for large TS
monorepos, and VACO's apps are deliberately independent CommonJS
services. Adding Nx would impose structure the architecture has
specifically avoided.

**Do not** replace `sync-design-system.sh`. It encodes a real
architectural decision — shared layer owns structure, per-app layer owns
colour — and a generic build tool would express it worse.

---

## Section 2 — Internal developer portal (Backstage)

**What VACO has:** `vaco-shell/lib/registry.js` is a real service
registry. `start-ecosystem.sh` is a real service manifest.
`dev-docs/COMPANY_TREE.md` maps 16 parents to sub-apps.
`dev-docs/MASTER_COMPANY_REGISTER.md` and `DEPLOYMENT_INVENTORY.md`
exist. So a catalogue exists — as prose plus one JS file.

**External option:** Backstage (software catalogue, TechDocs, scaffolder
templates, plugin ecosystem).

| | Assessment |
|---|---|
| Overlap | Backstage's catalogue duplicates `registry.js`; its scaffolder overlaps the App Factory (§3); TechDocs overlaps `dev-docs/` |
| Advantage | Ownership, dependency graph, and docs in one queryable place. Genuinely valuable at 29 services |
| Disadvantage | **Backstage is a large React/TypeScript application with a Postgres backend that a team must own.** It is the single heaviest item in this matrix. At VACO's current team size the portal would be a bigger codebase than several of the apps it catalogues |
| Licensing | Apache-2.0, CNCF-hosted — verify at decision time |
| Migration effort | High, and ongoing |
| Lock-in | Moderate — catalogue YAML is portable, plugins are not |

**Verdict: KEEP — with one cheap borrowed idea.**

Backstage is the right answer for an organisation with a platform team.
VACO does not have one. The concrete recommendation is to steal the
*catalogue-entity* idea without the portal: add a
`vaco.json` manifest to each app (name, parent, port, owner, depends-on,
money-paths, has-tests) and generate `COMPANY_TREE.md`,
`DEPLOYMENT_INVENTORY.md`, and `registry.js` **from** it, rather than
maintaining three drifting hand-written views of the same facts.

That is a weekend of work and captures most of the value. Revisit
Backstage if VACO ever employs someone whose job is the platform.

---

## Section 3 — The VACO App Factory

**This is a BUILD, and it is the highest-value item in this document.**

**What VACO has:** 29 apps that already converged on one shape — because
each was built by copying the last. The shape is real and consistent:

```
<app>/
  server.js          express + cors + express.static('public')
  lib/store.js       createXStore() factory
  lib/persistence.js reactive Proxy + commit()
  lib/shieldAuth.js  requireSession() / optionalOwnAccount()
  public/            index.html + synced vaco-design.css + vaco-ui.js
  test/              node:test suites
  dev-docs/phase-N-*/{plan,tasks}.md
  package.json       express, cors, dotenv
```

Convergence-by-copying is why this shape is consistent, and also why
`shieldAuth.js`'s known identity gap (§5) is replicated across every app
that has one. **A copied bug is an ecosystem-wide bug.**

**External options:** Yeoman, Plop, `create-*` scripts, Backstage
scaffolder, Cookiecutter.

**Verdict: BUILD — `scripts/new-app.mjs`, using Plop or plain Node.**

No external scaffolder knows what a VACO app is. The template is the
asset; the templating engine is a detail. What the factory must emit,
grounded in what the 29 existing apps actually have:

| Emitted | Source of truth today |
|---|---|
| `server.js` with health route + static + `durable()` | `void/server.js` |
| `lib/store.js` factory | any app |
| `lib/persistence.js` — **imported, not copied** | `void/lib/persistence.js` |
| `lib/shieldAuth.js` — **imported, not copied** | see §5; this is the fix |
| `public/index.html` using `VACO.app(...)` | `vaco-shell/public/vaco-ui.js` |
| a palette entry | `vaco-shell/VACO_PALETTE_REGISTER.md` |
| a first test asserting money or refusal, never status | `void/test/` |
| a smoke-harness registration | `scripts/smoke-frontend.mjs` |
| a `registry.js` entry + `start-ecosystem.sh` line + port | both files |
| `dev-docs/phase-1-*/plan.md` skeleton | every app |

**The critical design constraint:** the factory must emit *thin*
wrappers over shared modules, not copies. Today's copy-per-app model is
exactly why one auth gap became 29. Converting `persistence.js` and
`shieldAuth.js` into a real shared package (`packages/vaco-runtime`)
under workspaces (§1) is the prerequisite, and it retroactively fixes
every existing app at once.

**Sequencing:** §1 (workspaces) → shared runtime package → §3 (factory).
In that order the factory is 200 lines. In any other order it
manufactures more copies of the same bug.

---

## Section 4 — Durable workflow (Temporal)

**What VACO has:** `void/lib/settlement.js` — one settlement path for 25
verticals. `void` has a background retry sweep for failed deliveries.
VACAY has cutoffs. Vvltvre Studios reports revenue monthly. VSAFE runs
check-ins and escalations. Every one of these is a synchronous function
plus, at most, a `setInterval`.

**External options:** Temporal, Cadence, AWS Step Functions, BullMQ,
River, or plain cron + an outbox table.

| | Assessment |
|---|---|
| Overlap | Temporal replaces retry sweeps, timers, and multi-step compensation |
| Advantage | Durable execution: a workflow survives process death mid-step and resumes exactly where it stopped. Timers that fire in 30 days. Automatic retry with history you can inspect |
| Disadvantage | **Temporal is a cluster** — server, database, workers, a UI. It also imposes determinism constraints on workflow code that are easy to violate accidentally. It is a genuine operational commitment |
| Licensing | MIT for the OSS server; Temporal Cloud is usage-priced — **re-verify** |
| Migration effort | High per workflow, moderate to stand up |
| Lock-in | Moderate-high: workflow code is written against the SDK |

**The directive's own guardrail applies and is correct:** *do not
introduce Temporal where ordinary synchronous API calls are sufficient.*

**Verdict: KEEP for now. INTEGRATE later, and only for four named
workflows.**

Most VACO money moves in a single synchronous settlement inside one
process. `settleJob()` is not a saga — it is two transfers and a field
update, and its correctness is already covered by tests that assert
conservation. Temporal would add a network hop and a determinism
constraint to code that is currently readable end to end. That is a
downgrade.

The four places where durable execution genuinely earns its cost, all
of which share the shape *"a step must happen later, and forgetting it
loses money or safety"*:

1. **VOID's multi-leg service day** — a cross-vertical day with real
   dispatch, where a crash between legs currently loses the plan.
2. **Subscription renewals** (Vvltvre Flix, App Store) — a timer that
   must fire in 30 days, survive every restart in between, and be
   idempotent when it does.
3. **VSAFE escalation ladders** — check-in missed → wait → escalate →
   wait → escalate. A `setInterval` that dies silently is a safety
   failure, not a feature gap.
4. **Vvltvre Studios revenue distribution** — a monthly, multi-payee,
   must-be-exactly-once payout that the tests already prove is
   rounding-sensitive over 12 cycles.

Even for these, the cheaper first move is a **transactional outbox plus
a durable job table in Postgres** (§12). If that proves insufficient,
Temporal is the right escalation. Do not adopt it before then.

---

## Section 5 — Authorization (OIDC / OAuth / Keycloak / OpenFGA)

**This section addresses a known, documented, ecosystem-wide gap. It is
the highest-priority security item in this matrix.**

**What VACO has:** Shield is a real, single session authority. Every app
carries a copied `shieldAuth.js`. Its own header states the gap
verbatim:

> this proves a caller holds a real, currently-valid Shield session
> before allowing a mutating action through — it does **NOT**
> cross-check the session's own `userId` against whichever body field a
> given route treats as the acting user (`userId`, `authorId`,
> `hostId`, etc.). Thirty-one mutating routes each name that field
> differently.

`optionalOwnAccount('fromOwnerId')` exists and is chained on *some*
routes — VOKEN's card transfer and pack open, for instance. So the fix
pattern already exists in the codebase; it is applied unevenly.

**What that means concretely:** on any mutating route without
`optionalOwnAccount`, a valid session for user A can act as user B by
naming B in the request body. Every app is affected. This is not a
theoretical finding — it is written down by the code's own author.

**External options:** Keycloak (full IdP), Ory (Hydra/Kratos/Keto),
Auth0/Clerk (hosted), OpenFGA / SpiceDB (relationship-based
authorization, Google Zanzibar model), Casbin (policy).

| | Assessment |
|---|---|
| Overlap | Keycloak/Ory overlap **Shield entirely**. OpenFGA overlaps *nothing* VACO has — VACO has no authorization layer at all, only authentication |
| Advantage (OpenFGA) | Expresses "can user X do action Y on object Z" as data. Village ownership, gallery holdings, project cap tables, fractional shares, App Store entitlements are all relationship questions VACO currently answers with ad-hoc field comparisons |
| Disadvantage | Another service on the request path. A wrong model is a security hole with a friendly API. Real latency on every check unless cached |
| Licensing | Keycloak Apache-2.0; OpenFGA Apache-2.0, CNCF — **re-verify**; hosted IdPs are per-MAU priced |
| Migration effort | Keycloak: high, and it would displace working code. OpenFGA: moderate, additive |
| Lock-in | Keycloak: high. OpenFGA: moderate (the model is portable, the API is not) |

**Verdict — split, and the split is the point:**

- **Shield: KEEP.** Shield works, 29 apps trust it, and it is the single
  session authority the whole ecosystem was built around. Replacing a
  working identity service with Keycloak is exactly the rewrite this
  directive forbids. Revisit **only** if VACO must federate with an
  external IdP (enterprise SSO, a partner login) — that is the one
  requirement Shield genuinely does not meet.

- **Authorization: BUILD FIRST, then evaluate OpenFGA.**

  The gap is not that VACO lacks a policy engine. The gap is that
  **31+ routes per app never ask the authorization question at all.**
  Adding OpenFGA before closing that gap installs a sophisticated engine
  that most routes still do not call. That is worse than useless — it
  looks like the problem is solved.

  **The correct first move, in order:**

  1. Promote `shieldAuth.js` to a shared package (§3's prerequisite), so
     one fix reaches all 29 apps.
  2. Add `requireActor(...fieldNames)` — a middleware that asserts the
     session `userId` matches whichever body field this route treats as
     the actor, accepting the several names in use.
  3. **Enumerate every mutating route and classify it**: self-acting
     (must match), acting-on-behalf (must be an authorised service
     identity), or genuinely open. The `shieldAuth.js` header is right
     that this cannot be a mechanical pass — a cross-app caller acting
     on a user's behalf under its own identity will break, and that
     breakage is the *point*: it surfaces every implicit trust
     relationship in the ecosystem.
  4. Make `requireActor` mandatory in the App Factory template so no new
     app can be born without it.
  5. Add a test per app that a session for A cannot act as B. This is
     the same posture as the money tests: **assert on the refusal, not
     on the status.**

  Only after that is done does OpenFGA become worth evaluating — for
  the genuinely relational cases (village membership, gallery holdings,
  fractional share rights, entitlement inheritance), where a hand-rolled
  check gets combinatorially awkward.

**Explicitly: do not weaken existing security.** Every gate that
currently refuses — licensing gates on `cannabisDelivery` and
`medicalTransportation`, VOID's vetting gates, VEX's compliance gates,
the live-trading interlock — stays exactly as built. This section only
ever *adds* refusals.

---

## Section 6 — Observability (OpenTelemetry, Prometheus, Grafana, Loki, Tempo)

**What VACO has:** `vaco-analytics` — 7 routes, a metrics store, an
intelligence layer, a wallboard. Apps POST business metrics to it. There
is **no** request tracing, no structured logging standard, no metrics
endpoint, no cross-app correlation ID, and no way to answer "why was
this request slow" for a call that crosses four services.

This is the largest *invisible* gap in the repo. It does not appear in
the completion audit because nothing is broken — you simply cannot see
anything.

**External options:** OpenTelemetry (the standard), Prometheus
(metrics), Grafana (dashboards), Loki (logs), Tempo/Jaeger (traces),
or a hosted vendor.

| | Assessment |
|---|---|
| Overlap | OTel overlaps `vaco-analytics` **not at all**. Analytics measures *business* facts (revenue, bookings, listens). OTel measures *system* facts (latency, errors, spans). These are different products that are frequently confused |
| Advantage | Auto-instrumentation for Express means near-zero code change per app for baseline traces. One `traceparent` header makes a cross-app money path visible end to end for the first time |
| Disadvantage | A collector to run, storage to size, and sampling to get right. Grafana/Loki/Tempo is four more services in `docker-compose.yml` |
| Licensing | OTel Apache-2.0, CNCF. **Grafana, Loki, and Tempo have relicensed to AGPLv3 — re-verify current terms before committing.** Prometheus Apache-2.0 |
| Migration effort | Low for instrumentation, moderate for the backend |
| Lock-in | **Very low — this is OTel's whole point.** Instrument once, change backend later |

**Verdict: INTEGRATE — OpenTelemetry as the ecosystem-wide standard.
KEEP `vaco-analytics` unchanged.**

This is the clearest INTEGRATE in the document, for one reason: OTel's
vendor-neutrality means adopting it is close to a free option. The
instrumentation outlives any decision about where the data goes.

Concretely:

1. `packages/vaco-telemetry` — one module wrapping the OTel Node SDK
   with VACO's service naming. Apps `require` it and call one init.
2. Add it to the App Factory template.
3. Propagate `traceparent` through the injected cross-app clients
   (`transferFn`, `appExistsFn`, `hvntzFetchFn`) — the injected-function
   pattern makes this a **single-file change per client**, which is a
   direct dividend of an architectural decision made long before OTel
   was on the table.
4. **Span every V3 transfer with the reason string.** The reason strings
   are already structured (`void_${label}_payout:${verticalId}:${ref}`).
   That turns the existing money code into a queryable financial trace
   with no new instrumentation design.
5. Start with the collector writing to console/file. Decide on a backend
   later — precisely the flexibility OTel buys.

**Do not** route business metrics through OTel. `vaco-analytics` owns
revenue and engagement; that separation is correct and should be stated
explicitly in the analytics README so a future engineer does not
"unify" them.

**Adjacent gap this exposes.** The completion audit records that VSAFE
escalations, DREAMS alerts, and Analytics alerts all *record and page
nobody*. Observability without an alert channel is a dashboard nobody
watches at 3am. See §21.

---

## Section 7 — Messaging and events (NATS, Kafka, Redpanda, RabbitMQ)

**What VACO has:** direct HTTP calls via injected client functions.
No broker, no queue, no event log. `cvnvo` uses `ws` for real-time
message push — the only asynchronous transport in the repo.

**External options:** NATS (+JetStream), Kafka, Redpanda, RabbitMQ,
Redis Streams, or Postgres `LISTEN/NOTIFY` and an outbox table.

| | Assessment |
|---|---|
| Overlap | Replaces some synchronous fan-out; overlaps nothing on the money path |
| Advantage | Producer and consumer stop being coupled in time. Analytics ingestion, DREAMS impressions, CHOPZ engagement, VXLLAGE feed writes are all naturally fire-and-forget |
| Disadvantage | **Eventual consistency is a correctness change, not a performance change.** Broker infrastructure to run. Debugging moves from a stack trace to a correlation ID |
| Licensing | NATS Apache-2.0 (CNCF); Kafka Apache-2.0; Redpanda source-available BSL with a community edition — **re-verify**; RabbitMQ MPL |
| Migration effort | Moderate |
| Lock-in | Low for NATS, moderate for Kafka semantics |

**The directive's guardrail again applies:** *do not create unnecessary
distributed complexity.*

**Verdict: KEEP synchronous HTTP for money. INTEGRATE NATS for signals —
but only after §12, and possibly never.**

The repo already draws exactly the right line and states it as a
principle: **"fail soft on signals, hard on money."** `persistence.js`
encodes the same split — `commit()` on money, debounce on signals.

Events belong on the *signals* side of that line, and nowhere near the
money side. A settlement that publishes an event and returns is a
settlement that can silently not happen.

Before adopting a broker, note that **the cheapest version of this is
already available**: if §12 moves state to Postgres, `LISTEN/NOTIFY`
plus an outbox table gives durable, transactional, ordered events with
**zero new infrastructure** — the event is committed in the same
transaction as the money, which is a stronger guarantee than any broker
gives without effort.

Adopt NATS only when a measured problem appears: analytics ingestion
adding latency to user-facing writes, or a fan-out to more than three
consumers. If that day comes, NATS over Kafka — VACO's volumes are
nowhere near Kafka's design point, and Kafka's operational burden is the
highest in this matrix.

---

## Section 8 — AI layer (MCP, A2A, model gateways, RAG, vector DBs)

**What VACO has:** `v4-proxy` holds the Anthropic key, runs twin
profiles and surfaces, and has 28 routes including the entire Maps
layer. `VACON` is a real operating network of 14 agents. `VENVM` is an
AI production/content pipeline. `v4-search` fans out across per-app
adapters. No vector store, no embeddings, no retrieval.

**External options:** MCP (tool protocol), A2A (agent-to-agent),
LiteLLM / OpenRouter (gateways), LangChain / LlamaIndex (frameworks),
pgvector / Qdrant / Weaviate (vector stores).

| | Assessment |
|---|---|
| Overlap | MCP overlaps the *shape* of V4's tool access, not its content. Gateways overlap v4-proxy's routing. Frameworks overlap little that VACO does |
| Advantage | MCP makes VACO's 855 routes addressable by any MCP-speaking client — the natural exposure surface for VACON's agents. pgvector adds semantic search to `v4-search` with no new database |
| Disadvantage | **Exposing tools to a model is exposing them to whatever the model was persuaded to do.** A prompt-injected agent with a `transferFn` is a live financial risk, not a bug class |
| Licensing | MCP open spec; LiteLLM MIT; pgvector PostgreSQL licence; Qdrant Apache-2.0 — **re-verify** |
| Migration effort | Low-moderate for an MCP server; low for pgvector |
| Lock-in | Low |

**Verdict: INTEGRATE MCP — behind the full VACO control stack, with no
exceptions. KEEP v4-proxy. BUILD nothing new for retrieval beyond
pgvector.**

An MCP server over VACO's APIs is genuinely valuable and is the right
front door for VACON's agents. But the directive's list of required
controls is not a checklist to satisfy at the end — **it is the design**:

Every AI tool call must pass through, in this order:

1. **Shield identity** — the agent acts *as* a user, with that user's
   session. Never a god token. An agent with ambient authority is the
   failure mode here.
2. **Authorization (§5)** — `requireActor` applies to agents exactly as
   to humans. This is the second reason §5 is the highest-priority item:
   an MCP server built on top of the current auth gap would let any
   agent act as any user by naming them.
3. **VACA verification** — actions gated on verified identity stay
   gated.
4. **VSAFE restrictions** — safety limits apply to agent-initiated
   actions identically.
5. **App permissions** — an agent's tool set is scoped to the apps the
   user has entitlements for (App Store entitlements are already real).
6. **Financial controls** — per-call and per-session VCoin ceilings,
   plus a human confirmation step above a threshold. An agent should not
   be able to drain a wallet in a loop.
7. **The live-trading interlock — never bypassed.** VEX Business trading
   tools are **excluded from the MCP surface entirely.** Not gated:
   absent. There is no benefit to exposing them that justifies the
   failure mode, and an absent tool cannot be talked into firing.
8. **Audit logging** — every tool call, its actor, its arguments, its
   result. This is where §6's tracing pays for itself twice.

**Concrete recommendation:** build the MCP server **read-only first.**
Search, explore, list, describe. Ship it, watch it, then add mutating
tools one at a time, each with its own financial ceiling. A read-only
MCP surface over 855 routes is already most of the value and carries a
fraction of the risk.

On gateways: v4-proxy exists and works. A gateway becomes worth it only
if VACO runs multiple model providers. **KEEP.**

On frameworks: LangChain and LlamaIndex solve orchestration problems
VACO's agent code does not have. **KEEP.**

---

## Section 9 — Real-time media (LiveKit, WebRTC, CDN)

**What VACO has:** nothing that plays. This is recorded as the largest
gap in `dev-docs/COMPLETION_AUDIT.md` §3.1, and analysed fully in
`dev-docs/MEDIA_INFRASTRUCTURE_DECISION.md` and
`dev-docs/REALTIME_MEDIA_SHARED_INFRASTRUCTURE.md`.

Six surfaces cannot do their core thing: Vvltvre Flix cannot play,
Vvltvre Pods cannot stream audio, Vavlt Stvdios cannot show a feed,
CHOPZ cannot play video, VENVM cannot generate media, DREAMS has no
display. Add Magic Meet & Greet and V4 realtime from the directive.

**External options:** LiveKit (WebRTC SFU, self-host or cloud), Mux
(video API), Cloudflare Stream, Agora, Daily, Janus/mediasoup, plus a
CDN for VOD.

**Verdict: INTEGRATE — and the directive's guardrail is already the
repo's own conclusion.**

*"Do not build a proprietary streaming infrastructure stack unless there
is a strategic reason."* There is not one. Media transport is the
purest commodity in this matrix — an SFU is thousands of engineer-years
of NAT traversal, codec negotiation, and simulcast that has no relation
to what makes VACO distinctive.

The existing decision document recommends a split by product, which is
correct and stands:

| Surface | Shape | Fit |
|---|---|---|
| Vvltvre Pods | audio VOD | object storage + CDN — **cheapest first step, do this one first** |
| Vvltvre Flix | video VOD, DRM, concurrency | a video API (Mux-class); the concurrency limits are already built and tested |
| CHOPZ | short-form video | object storage + CDN + transcode |
| Vavlt Stvdios | multi-channel live, 8-screen | **LiveKit** — this is the one that genuinely needs an SFU |
| Magic Meet & Greet | 1:1 / small-group live | LiveKit, same infrastructure |
| V4 realtime | agent voice | LiveKit, same infrastructure |
| DREAMS | screen playback | a player and a schedule, not an SFU |
| VENVM | generation, not transport | a different problem — see §8 |

Two things worth noting because they change the economics:

- **Vvltvre Flix's tier concurrency limits are already real and tested**
  (`vulture-flix/test/subscription.test.js`). Whichever vendor is
  chosen, that enforcement stays VACO's, not the vendor's. That is the
  correct boundary: **VACO owns entitlement, the vendor owns
  transport.**
- LiveKit self-hosted vs. cloud is the single largest cost variable in
  this document, and it cannot be assessed without live pricing.

**This is blocked on a founder decision, not on engineering effort.**
It has been blocked for some time. The cheapest way to unblock it is to
ship Vvltvre Pods with plain object storage and a CDN — no SFU, no
vendor negotiation, one product that works.

---

## Section 10 — Commerce (Medusa)

**What VACO has:** the App Store (listings, entitlements, subscriptions
with real expiry, refunds that reverse both money and access), VACO
Merch (zero-inventory, platform fee on margin not retail, below-cost
products refused at creation), CHOPZ SHOP (three-way split, category
fees, affiliate attribution windows — 11 tests), VOKEN (packs, raffles,
trades, auctions, fractional shares, secondary market), VENVS
marketplace. All settling through V3 in VCoin.

**External option:** Medusa (headless commerce), Saleor, Vendure.

| | Assessment |
|---|---|
| Overlap | Superficially high, **actually low** |
| Advantage | Medusa brings tax, multi-currency, fiat payment providers, fulfilment integrations, and an admin UI |
| Disadvantage | Medusa assumes fiat, a cart/checkout model, and its own data model. VACO settles in VCoin through V3 with idempotency keys and no reversals |
| Licensing | Medusa MIT — **re-verify** |
| Migration effort | Very high, and it would displace tested money code |
| Lock-in | High — the data model is the product |

**Verdict: KEEP. This is the clearest KEEP in the document.**

VACO's commerce is not a storefront with unusual branding. It is a
**closed-loop VCoin economy** where a CHOPZ SHOP order splits three ways
with category-dependent fees and time-windowed affiliate attribution,
where VOKEN fractional shares have a secondary market, and where Vvltvre
Studios cap tables determine payouts for years. No headless commerce
platform models any of that, and the tests that prove these splits
conserve money to the cent are among the most valuable assets in the
repo.

**One genuine gap Medusa would have solved, and the honest scope of
it:** `merchStore.js`'s `submitToFulfilment` records intent and nothing
ships. That is a **print-on-demand integration** (Printify/Printful),
not a commerce platform. It is a few hundred lines against a documented
API — build it directly.

---

## Section 11 — Search (OpenSearch, Elasticsearch, Meilisearch, Typesense)

**What VACO has:** `v4-search` — 2 routes, fan-out across per-app
adapters. Each app answers for itself. No index, no ranking, no typo
tolerance, no facets. Positioned in the company tree as the Google
Search equivalent for the ecosystem.

**External options:** OpenSearch, Elasticsearch, Meilisearch, Typesense,
Postgres full-text search, pgvector for semantic.

| | Assessment |
|---|---|
| Overlap | High on the retrieval mechanic; nil on the fan-out routing that makes cross-app search work |
| Advantage | Typo tolerance, ranking, facets, sub-50ms at scale. Fan-out latency is bounded by the *slowest* app; an index is not |
| Disadvantage | An index is a second copy of the truth and must be kept fresh. Elasticsearch/OpenSearch are heavy for VACO's data volume |
| Licensing | OpenSearch Apache-2.0; **Elasticsearch is SSPL/Elastic-licensed — re-verify**; Meilisearch MIT; Typesense GPLv3 |
| Migration effort | Moderate |
| Lock-in | Low-moderate |

**Verdict: KEEP the fan-out architecture. INTEGRATE Meilisearch or
Typesense underneath it — later, and only if quality becomes the
complaint.**

`v4-search`'s value is the **routing layer**, not the matching. Keep it
as the front door and let it query an index instead of 29 services.

Do not adopt Elasticsearch or OpenSearch. They are sized for a problem
VACO does not have, and the licensing question alone makes Elasticsearch
a poor default. If §12 moves data to Postgres, **start with Postgres
full-text search plus pgvector** — zero new infrastructure, and probably
sufficient. Escalate to Meilisearch only on measured evidence.

**Ordering note:** `v4-search` has 2 tests and is on the untested list.
Test the routing layer before optimising the matching underneath it.

---

## Section 12 — Data layer (PostgreSQL, Redis/Valkey, object storage)

**What VACO has:** a reactive `Proxy` over an in-memory object, flushed
to `store.json`, with synchronous `commit()` on money routes. The
persistence header is unusually honest about its own limits: it survives
`kill -9`, OOM, and container restart; it does **not** claim to survive
power loss. Durability was demonstrated by killing a process mid-cashout,
not reasoned about.

`vex-business` already runs PostgreSQL with Alembic migrations.
`vacon-c` has `pg` as a dependency.

**External options:** PostgreSQL, Redis/Valkey, S3-compatible object
storage.

| | Assessment |
|---|---|
| Overlap | Total for storage; nil for domain logic |
| Advantage | **Real transactions** — the single most important gain. Concurrent access. Queries that are not full array scans. A dataset larger than RAM. Point-in-time recovery |
| Disadvantage | The current model is genuinely excellent for development: no schema, no migration, no connection pool, and a store you can read as JSON. That ergonomic advantage is real and will be lost |
| Licensing | PostgreSQL licence; **Redis relicensed — use Valkey (BSD) or verify Redis terms**; MinIO AGPL |
| Migration effort | High — 29 store factories |
| Lock-in | Low; SQL is portable |

**Verdict: INTEGRATE PostgreSQL — money apps first, incrementally, and
never as a big-bang migration. KEEP the JSON store for everything else.
INTEGRATE object storage as a precondition for §9.**

The strongest argument is not scale — it is that **`settleJob()` moves
money in two transfers that cannot currently be made atomic.** The
settlement code is careful and the tests prove conservation, but
"careful code" and "a transaction" are different guarantees. A real
transaction makes an entire class of test unnecessary.

Order of adoption, by consequence:

1. **`v3`** — the ledger. Everything else settles through it, and it is
   the one place where a lost write is unrecoverable.
2. **`shield`** — sessions. Its persistence posture is flagged in the
   audit as needing review before relying on long-lived tokens.
3. **`void`** — 158 routes, 25 verticals, the largest money surface.
4. Everything else: only when it has a reason.

`vex-business` already proves the pattern works here, with a migration
tool (Alembic) chosen and in use. **Use the same shape** — a real
migration tool, checked in, not hand-run SQL.

**Object storage is a prerequisite for §9** and should be stood up when
Vvltvre Pods ships audio, not before.

Redis/Valkey: **KEEP** — nothing yet needs a cache, and adding one
before a measured latency problem is speculative.

---

## Section 13 — Testing and quality (Playwright, OpenAPI, contract testing, SAST/DAST)

**What VACO has:** 391 tests, 0 failures, across 17 of 29 apps. Playwright
smoke harness covering all 29 frontends. **12 apps still have no tests.**
No OpenAPI specs. No contract tests. No linting on the Node side
(`vex-business` has ruff + mypy). No SAST, no dependency scanning, no
DAST.

The testing philosophy in this repo is genuinely strong and worth
stating, because it should constrain every tool added here:

> **Assert on the money, never on a status.** A status is exactly what
> stays correct while the money goes wrong.

The suites use a **ledger helper rather than a spy** — a spy proves a
transfer was attempted; a ledger proves money landed sanely — and assert
conservation via `drift()` and `isDrained()` at sub-cent tolerance,
with a documented rationale for why bit-exact is the wrong assertion
under IEEE-754.

**Verdict — by item:**

- **Playwright: KEEP and extend.** Already adopted; it caught two real
  bugs that reading the code did not, including a nested-CSS-comment
  bug that silently voided the entire token system.
- **OpenAPI: INTEGRATE — generate, do not hand-write.** 855 routes with
  no machine-readable contract is the blocker for §8 (MCP tool
  definitions), §18 (docs), and contract testing. Hand-writing 855
  specs is not viable and would drift immediately. Emit them from route
  definitions, and add the emission to the App Factory template.
- **Contract testing (Pact-style): KEEP for now.** VACO's injected-client
  pattern (`transferFn`, `appExistsFn`) already makes cross-app contracts
  explicit and testable in-process — which is most of what contract
  testing buys, without the broker. Revisit if apps are ever deployed
  and versioned independently.
- **ESLint + a formatter: INTEGRATE.** Trivial, and it is the cheapest
  way to stop the design-system and auth-copy drift patterns.
- **SAST (CodeQL/Semgrep) + dependency scanning: INTEGRATE.** With only
  three production dependencies the dependency surface is tiny — but
  §5's auth gap is exactly the class of finding a Semgrep rule can
  detect and then *prevent*. Write a custom rule: **every mutating route
  must chain an actor check.** That converts a one-time audit into a
  permanent guarantee.
- **DAST: KEEP for now.** Low value until there is a deployed
  environment to scan.

**The 12 untested apps.** The audit names the right next tier and the
reason, and it stands: **VACA, VEX, and YAP — the gates other apps
trust.** A gate that silently stops gating is worse than one that was
never built, because the callers believe it. Test those three before
adding a single tool in this section.

---

## Section 14 — CI/CD and infrastructure (Docker, GitHub Actions, OpenTofu, Argo CD)

**What VACO has:** `docker-compose.yml`, `install-ecosystem.sh`,
`start-ecosystem.sh`, `stop-ecosystem.sh`, `sync-design-system.sh`,
`dev-docs/DEPLOYMENT_INVENTORY.md`, `DEPLOYMENT_FILE_PLACEMENT.md`,
nginx rate limiting at the deploy layer. **No `.github/workflows`
directory exists.**

**Verdict: INTEGRATE GitHub Actions. KEEP docker-compose. KEEP OpenTofu
and Argo CD out for now.**

CI is the largest cheap win in this matrix. 391 tests exist and nothing
runs them automatically — every regression is caught by whoever happens
to run `npm test`. A first workflow is perhaps 40 lines:

```
on: [push, pull_request]
  - npm ci
  - node --test across all suites
  - ./sync-design-system.sh --check     # already has a drift mode
  - node scripts/smoke-frontend.mjs     # already exists
  - eslint                              # once §13 lands
```

Every one of those steps is **already built**. The only missing piece is
the trigger.

**One blocker, stated plainly and not raised as a new topic:** GitHub
push from this environment is confirmed broken (403, permission scope).
That is being handled separately. The workflow file can be written and
committed locally now, so it activates the moment access is restored.

On OpenTofu/Terraform and Argo CD: both solve problems VACO does not yet
have — there is no cloud infrastructure to declare and no Kubernetes
cluster to reconcile. `docker-compose.yml` is the correct level for the
current deployment shape. **Revisit only when a real target exists.**

---

## Section 15 — Feature flags (OpenFeature, Unleash, Flagsmith)

**What VACO has:** flags as code and as decisions —
`influencer-culture-card-rewards` closed pending review, VEX gated
pending broker-dealer registration, VACON-C paused, the live-trading
interlock. Each is enforced in code, and several are enforced as
constants specifically so they cannot be toggled by a caller.

**Verdict: KEEP — and this is a deliberate KEEP, not a deferral.**

VACO's most important flags are **not** operational toggles. They are
**compliance and safety states**, and their value comes precisely from
being unreachable at runtime. A flag service that can turn the
live-trading interlock on is a strictly worse design than a constant
that cannot. The directive's own standing constraint — *the live-trading
interlock is never bypassed* — is an argument against a flag system
touching it, not for one.

If a genuine operational need appears (percentage rollouts, per-user
betas), adopt **OpenFeature** as the SDK-level abstraction so the
provider stays swappable, and keep every safety and compliance gate
**out of it, permanently.** Document that boundary in the flag system's
own README the day it is created.

---

## Section 16 — Documentation (OpenAPI, TypeDoc, Mermaid, TechDocs)

**What VACO has:** a large and genuinely good `dev-docs/` corpus —
per-app phase plans, `COMPANY_TREE.md`, `MASTER_COMPANY_REGISTER.md`,
`COMPARABLES_INDEX.md`, `DEPLOYMENT_INVENTORY.md`, this file. Module
headers throughout carry real design rationale, including *why a
rejected alternative was rejected*, which is the part that usually goes
unrecorded.

The weakness is not quality. It is that **the docs and the code can
drift without anything noticing** — and this repo has already caught two
instances of exactly that, catalogued as the "cited-but-absent" and
"asserted-but-unbuilt" patterns.

**Verdict: INTEGRATE generation for the mechanical parts. BUILD nothing.
KEEP the prose.**

1. **Generate OpenAPI from routes** (§13). 855 routes, hand-maintained,
   will be wrong within a week.
2. **Generate the company tree, deployment inventory, and registry from
   `vaco.json` manifests** (§2). Three hand-written views of one fact set
   is three chances to drift.
3. **Mermaid diagrams in Markdown** — zero-cost, versioned with the code,
   and renders in most viewers.
4. **A doc-drift check in CI**: assert that every path cited in a
   dev-doc exists. That is a twenty-line script and it directly attacks
   the "cited-but-absent" pattern the repo already named.
5. **TypeDoc: skip.** The codebase is JavaScript with rich header
   comments; TypeDoc would produce a worse artefact than the source.

---

## Section 17 — Dependency management (Dependabot, Renovate)

**What VACO has:** 29 independent `package.json` files and 29 lockfiles.
Three production dependencies total. `vex-business` uses `uv` with
`uv.lock`.

**Verdict: INTEGRATE Renovate — but only after §1.**

With 29 separate lockfiles, Renovate opens up to 29 PRs for a single
`express` patch. Workspaces (§1) collapse that to one. Adopting
dependency automation before consolidating lockfiles converts a small
maintenance task into a large noise problem.

Renovate over Dependabot for grouping and scheduling control. Once
workspaces land, this is a config file and near-zero ongoing cost.

The genuinely good news: **a three-dependency backend has almost no
supply-chain surface.** That is a real security property of the current
architecture and it is worth defending — the App Factory (§3) should
make adding a dependency a deliberate act, not a default.

---

## Section 18 — Synthetic monitoring

**What VACO has:** `scripts/smoke-frontend.mjs` — a real Playwright
harness asserting that the runtime boots, `--vaco-space-4` computes to
`16px`, the accent is set, tabs render, no tab is stuck on "Loading…",
and no `.vaco-notice-danger` is present. It runs **on demand**, against
localhost.

**External options:** Checkly, Grafana Synthetic Monitoring, Uptime
Kuma, or the existing harness on a schedule.

**Verdict: BUILD — extend what exists. KEEP external vendors out.**

The harness is already the hard part. What is missing is a schedule and
a place to run it. Concretely:

1. Run it on a cron in CI (§14) against a deployed environment.
2. Extend it to assert **money-path liveness**, not just rendering: a
   V3 health transfer between two test accounts, asserting the balances
   move and the drift is zero. The audit's central insight applies to
   monitoring as much as to testing — **a green status page is exactly
   what stays correct while the money goes wrong.**
3. Self-host Uptime Kuma if a simple uptime board is wanted. Do not buy
   synthetic monitoring while the harness is unscheduled — the gap is
   scheduling, not capability.

---

## Section 19 — Disaster recovery

**What VACO has:** `store.json` per app, `renameSync`-based atomic
writes, `commit()` on money routes. **No backup process, no restore
procedure, no tested recovery, no RPO/RTO defined anywhere.**

`persistence.js` states its own limit precisely: it survives process
death, not power loss, because `renameSync` alone does not fsync the
file and its directory.

**Verdict: BUILD — and this is the most under-weighted risk in the
repository.**

Every observation about money correctness in this repo assumes the data
still exists. There is currently **no mechanism by which V3's ledger
survives the loss of one disk.** That is a larger exposure than any
individual untested app.

Minimum viable, in order of consequence:

1. **Define RPO and RTO.** For V3 the honest answer is likely RPO ≈ 0 —
   a lost transfer cannot be reconstructed from anything.
2. **Back up `store.json` files off-host** on a schedule. Today. This is
   a shell script and a bucket, and it should not wait for §12.
3. **Test a restore.** An untested backup is a belief, not a backup —
   the same standard this repo applies to gates and to money.
4. Once §12 lands, use Postgres PITR and continuous archiving, which is
   the real answer.
5. Write the runbook. `dev-docs/DISASTER_RECOVERY.md` does not exist.

---

## Section 20 — Business automation (n8n)

**What VACO has:** nothing in this category. Ops work is manual or
unmodelled.

**Verdict: INTEGRATE n8n — self-hosted, and on a strict boundary.**

The directive draws the correct distinction and it should be written
into the deployment: **Temporal (§4) is for mission-critical durable
workflows; n8n is for business automation.** The failure mode is n8n
quietly accumulating business-critical logic because it is easier to
click than to code.

Make the boundary enforceable rather than advisory:

- **n8n may:** send notifications, sync to external SaaS, generate
  reports, respond to webhooks, run scheduled admin jobs.
- **n8n may not:** move VCoin, alter entitlements, touch VACA
  verification, VSAFE state, compliance gates, or anything behind the
  live-trading interlock.
- **Enforcement, not convention:** give n8n its own Shield identity with
  a scoped permission set that structurally cannot reach money routes
  (§5). A rule nobody can violate beats a rule everybody agrees with.

Licence: n8n is **fair-code / sustainable-use licensed, not OSI open
source** — internal self-hosted use is normally fine, but **verify the
current terms**, especially against anything customer-facing.

---

## Section 21 — The notification channel (not in the directive, but blocking three others)

The completion audit records that **VSAFE escalations, DREAMS alerts,
and VACO Analytics alerts all record and page nobody.** §6
(observability) and §18 (synthetic monitoring) both terminate in the
same missing component.

**External options:** Twilio / MessageBird (SMS, voice), SendGrid /
Postmark / SES (email), Firebase Cloud Messaging / APNs (push),
PagerDuty / Grafana OnCall (paging).

**Verdict: BUILD one `vaco-notify` service. INTEGRATE vendors behind it.**

One service, one interface, per-channel adapters — the same pattern
`v4-search` already uses for adapters and `settlement.js` uses for one
path. It serves all three consumers plus §6 and §18, and it is a
precondition for VSAFE being a real safety product rather than a
recorded one.

**VSAFE escalation is the priority.** A safety escalation that pages
nobody is not a degraded feature; it is a promise the product does not
keep.

---

## Priority order

Ranked by consequence, with dependencies respected. Nothing here is a
rewrite.

| # | Action | Section | Why first |
|---|---|---|---|
| 1 | Back up `store.json` off-host | §19 | No recovery path exists at all today |
| 2 | CI running the 391 existing tests | §14 | Everything already built; only the trigger is missing |
| 3 | Tests for VACA, VEX, YAP | §13 | Gates other apps trust; a silent gate is worse than none |
| 4 | Shared runtime package (`persistence`, `shieldAuth`) | §1, §3 | Precondition for fixing 29 copies at once |
| 5 | `requireActor` + route-by-route audit | §5 | The known, documented, ecosystem-wide auth gap |
| 6 | `vaco-notify` | §21 | VSAFE escalations page nobody |
| 7 | Workspaces | §1 | Unblocks §17, simplifies §14 |
| 8 | App Factory | §3 | Makes every fix above permanent for new apps |
| 9 | OpenTelemetry | §6 | Near-zero lock-in; unblocks real diagnosis |
| 10 | Vvltvre Pods on object storage + CDN | §9, §12 | Cheapest path out of the largest product gap |
| 11 | PostgreSQL for V3 | §12 | Real transactions on the money path |
| 12 | OpenAPI generation | §13, §16 | Unblocks §8's MCP tools and §16's docs |
| 13 | Read-only MCP server | §8 | High value, low risk — after §5 |
| 14 | Renovate | §17 | After §7 collapses the lockfiles |

Items 1–3 need no new technology whatsoever. They are the highest-value
work in this document, and every one of them is assembling parts that
already exist.

---

## Summary table

| Area | Verdict | Note |
|---|---|---|
| Monorepo tooling | **INTEGRATE** | Workspaces; not Nx |
| Developer portal | **KEEP** | Steal the catalogue idea, skip Backstage |
| App Factory | **BUILD** | Highest-value new build |
| Durable workflow | **KEEP** → INTEGRATE | Outbox first; Temporal for 4 named workflows |
| Identity (Shield) | **KEEP** | Works; replacing it is the forbidden rewrite |
| Authorization | **BUILD** | `requireActor`; OpenFGA only after |
| Observability | **INTEGRATE** | OpenTelemetry, ecosystem-wide |
| Business analytics | **KEEP** | Separate from OTel by design |
| Messaging | **KEEP** | Postgres outbox before any broker |
| MCP / A2A | **INTEGRATE** | Read-only first; trading tools absent, not gated |
| Model gateway | **KEEP** | v4-proxy works |
| Vector / RAG | **INTEGRATE** | pgvector, after §12 |
| Real-time media | **INTEGRATE** | LiveKit for live; VOD is storage + CDN |
| Commerce | **KEEP** | Closed-loop VCoin; no platform models it |
| Fulfilment | **BUILD** | Printify/Printful adapter |
| Search | **KEEP** + INTEGRATE | Keep fan-out; Postgres FTS underneath |
| PostgreSQL | **INTEGRATE** | V3 first, incrementally |
| Redis / Valkey | **KEEP** | No measured cache need |
| Object storage | **INTEGRATE** | Precondition for media |
| Playwright | **KEEP** | Already adopted, already earning |
| OpenAPI | **INTEGRATE** | Generated, never hand-written |
| Contract testing | **KEEP** | Injected clients already do this |
| Lint / SAST | **INTEGRATE** | Custom rule for the §5 gap |
| CI/CD | **INTEGRATE** | GitHub Actions; largest cheap win |
| IaC / GitOps | **KEEP** | No target to declare yet |
| Feature flags | **KEEP** | Safety gates must stay unreachable |
| Docs generation | **INTEGRATE** | Generate mechanical, keep prose |
| Dependencies | **INTEGRATE** | Renovate, after workspaces |
| Synthetic monitoring | **BUILD** | Schedule the harness that exists |
| Disaster recovery | **BUILD** | Most under-weighted risk in the repo |
| n8n | **INTEGRATE** | Hard boundary, enforced by permissions |
| Notifications | **BUILD** | Blocks VSAFE, DREAMS, Analytics |

---

## What must not change

Restated because an acceleration document is exactly where these get
lost:

- The **live-trading interlock** is never bypassed, and VEX Business
  trading tools are excluded from any AI tool surface entirely.
- **VOID's licensing gates** on `cannabisDelivery` and
  `medicalTransportation` are not relaxed.
- **Likeness consent throws, never warns.**
- **`influencer-culture-card-rewards`** stays closed pending review.
- **VACON-C** stays paused at its live 5-endpoint contract.
- **BarBuddy's `isVisibleToOthersAtVenue: false`** stays as built.
- **VENVM** stays scoped to the AI production/content pipeline.
- **No cross-app `require()`.** Injected clients only. This one
  constraint is what makes §6's tracing a per-client change rather than
  an 855-route change — architectural discipline paying a dividend years
  after the decision.
