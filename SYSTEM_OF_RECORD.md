# VACO — System of Record

**One file, everything in it.** What the system is, what runs where,
what guards what, how to deploy it, how to verify it, and what is
deliberately not built.

The other two root documents stay useful and stay narrower: `README.md`
is how to run it, `VACO.md` is the filing form that says where a new
file belongs. This one is the state of the whole thing at a point in
time, so a person who has never seen the repo can get it running and a
person who built it can check whether a claim is still true.

Every number below was produced by running the tool that owns it, not
recalled. The commands are in §10 so they can be re-run.

*Current as of commit `dbd63b8`, 226 commits, branch
`claude/v4-proxy-server-s6dcp8`, 25 Sep 2026.*

**On the commit count.** An earlier revision of this line said 332. That
number was not wrong when written and the history it counted is gone:
the container holding it was reclaimed with nothing pushed, and the
repository was rebuilt from an archive. `dev-docs/DISASTER_RECOVERY.md`
§0 records it. The count restarted from the rebuild, which is why it is
small.

**The branch is pushed.** It was not, for most of the work recorded
here — `git push` returned 403 and this file said so — and it is now.
Re-linking the GitHub connector from the claude.ai settings page
restored access; no org-level app install turned out to be needed. The
whole branch went up on the first attempt afterwards. `git status -sb`
reports the local branch and `origin/` in step.

**`scripts/test/system-of-record.test.mjs` now holds every number in
this file to the tool that produces it.** Before that, this document
said its numbers "were produced by running the tool that owns it" and
nothing checked that they still matched — which is the same
citation-is-not-presence failure it warns about in §8. It was a week
stale when the test was written: 879 tests against a real 1498, 33
suites against 39, 28 volumes against 30.

**What this document does not cost out.** Money — pricing, compliance
spend, licences, staffing and what it costs to run in production — is
in `dev-docs/GO_LIVE_DOSSIER.md`, which marks every line **[MEASURED]**
or **[ESTIMATE]** and says which. Its §7 is the infrastructure bill,
and its one useful headline is that the measured 0.82–0.86 GB of app
memory for all 36 apps puts the whole ecosystem on a single modest box:
**the estimated infrastructure cost is 10–100× smaller than the people
cost.** Nothing in its estimate sections has been checked against a
real vendor, a real lawyer, or a real payroll, and it says so at the
top.

---

## 1. What this is

A monorepo of 36 containerised services — 34 Node backends and two
Vite frontends — sharing five pieces of real infrastructure: a
canonical ledger, session auth, an identity attestation service, an
operator-credential service, and an append-only decision record.

The services are not a microservice decomposition of one product. They
are separate products — a casino, a logistics network, a dating app, a
streaming service, a futures-research platform — that happen to settle
through the same ledger and trust the same session layer. That is why
cross-app calls are injected clients rather than imports, and why the
authorization work in §5 had to be done per app rather than once.

**Scale, measured:**

| | |
|---|---|
| Containerised services | 37 + nginx + a LiveKit SFU |
| Registry rows (incl. brand rows and the dev mock) | 38 |
| Mutating HTTP routes | 530, all accounted for (477 guarded, 53 declared open with a reason) |
| Automated tests | 2765 across 40 suites |
| Persisted volumes | 31 |
| Shared-module copies kept in sync | 216 |
| Service credentials in `.env.example` | 29 callers |
| Servers carrying trace context | 37 |

---

## 2. Running it

### Local, no Docker

```sh
./install-ecosystem.sh   # first time only — installs deps for every app
./start-ecosystem.sh     # boots every app on its assigned port
./stop-ecosystem.sh
```

A fresh clone or unzipped archive has tracked files only, so nothing
has `node_modules` yet — run the install step first. The Docker path
does not need it; `deploy/Dockerfile.node` installs during build.

### Docker Compose

```sh
cp .env.example .env      # then fill in the two required secrets
node deploy/generate-docker-compose.js
docker compose up --build
```

`docker-compose.yml` is **generated, not hand-edited.** Editing it
directly is silently undone by the next generator run. The generator
derives service list, ports, cross-app URLs, `depends_on`, and which
apps get which credentials from the apps themselves — see §9.

Two required secrets, plus `POSTGRES_PASSWORD` since 10 Sep 2026:
Compose refuses to start without it rather than shipping a working
default. It is VACON-C's database and nothing else uses it.

### One port, no nginx

Both paths above assume a host where you can run 36 processes and put
nginx in front of them. Replit, Render, Fly and most PaaS boxes give
you one port and expect one process to own it.

```sh
./start-ecosystem.sh            # the apps, on their own ports
PORT=8080 node gateway.js       # all of them, through one
node gateway.js --print-routes  # the table, starting nothing
```

`gateway.js` is the same routing table as the nginx configs, in Node,
reading `start-ecosystem.sh`'s APPS array like every other consumer
rather than keeping a copy. `scripts/test/gateway.test.mjs` holds it
and `deploy/nginx-docker.conf` to the same table.

**Verified 10 Sep 2026**: against the booted stack, 33 of 34 apps
answered 200 through the single port; the 34th was `v4-proxy`,
deliberately down for want of `ANTHROPIC_API_KEY`, and its 502 named
the app and the port.

**Re-verified 11 Sep 2026, this time against Postgres — the first
end-to-end run of the whole ecosystem on the database.** 35 up, 1 down
(the same deliberate `v4-proxy`); 28 apps reported `store: Postgres` in
their own boot lines and none fell back to a file; V3 reported
`ledger: Postgres rows`; VACON-C loaded its schema. **35 of 36 apps
reachable through the single port** — 32 serve a page, and
`vaco-audit`, `vaco-operator` and `vaco-media` are API-only and answer
on `/api/health`, which an earlier probe of this miscounted as three
failures. Seeding then wrote 34 items through the real HTTP API,
producing 28 documents, 8 balance rows and 14 transactions.
`dev-docs/DISASTER_RECOVERY.md` §0a has the full drill, including the
destroy-and-restore that followed.

`VACO_APPS` boots a subset, for a host that cannot hold the whole
stack — though at 38 processes and 0.82–0.86 GB, measured by PSS and
confirmed against the memory freed on shutdown, most hosts will hold
all of it. Five apps plus the gateway is 11 processes and 0.13 GB.

An earlier revision of this section said 2.43 GB across 68 processes.
The process count fell when the apps stopped launching through npm, and
the memory figure was wrong: summed RSS double-counts the pages 36 Node
processes share, overstating the total by about 3.5x.

```sh
VACO_APPS="vaco-shell v3 shield void vacay" ./start-ecosystem.sh
```

An unknown name is refused with the list of known apps rather than
skipped, and naming nothing at all is refused too — a subset boot that
silently starts zero apps reports "0 up, 0 down", which is a clean bill
of health for an ecosystem that is not running.

`deploy/README.md` has the Replit specifics and what that path is not
for.

---

## 3. Every app, and where it runs

Ports come from `vaco-shell/lib/registry.js`, which is now held against
`docker-compose.yml` by `scripts/test/registry.test.mjs`. They agree or
the suite fails.

### Financial & Trading
| id | port | parent | name |
|---|---|---|---|
| `v3` | 8811 | V3 | V3 — the canonical VCoin/VASH ledger |
| `vaca` | 8804 | V3 | VACA — identity and authenticity attestation |
| `vago` | 8795 | VAGO | VAGO — casino, sportsbook, fantasy contests |
| `vex-trading` | 8817 | Vex | Vex Trading — shell over VEX (8816) and Vex Business |

### Commerce & Marketplace
| id | port | parent | name |
|---|---|---|---|
| `venvs` | 5173 | VENVS | VENVS — analog commerce (Vite) |
| `voken` | 8794 | VOKEN | VOKEN — fractional shares, packs, resale |
| `cvltvre` | 8794 | CVLTVRE | CVLTVRE — VOKEN's card brand, same runtime |
| `vado` | 8794 | VADO | VADO — same runtime, different brand |
| `chopz` | 8800 | CHOPZ | CHOPZ |
| `chopz-shop` | 8801 | CHOPZ | CHOPZ SHOP |

### Social & Discovery
| id | port | parent | name |
|---|---|---|---|
| `hvntz` | 8792 | HVNTZ | HVNTZ — revenue stack, hunts, Explore |
| `dreams` | 8814 | HVNTZ | DREAMS — ad/screen network |
| `vxllage` | 8796 | VXLLAGE | VXLLAGE — villages, BarBuddy, cosmetics |
| `cvnvo` | 8798 | CVNVO | CVNVO — dating, speed dates |
| `yap` | 8802 | CVNVO | YAP |

### Leisure & Entertainment
| id | port | parent | name |
|---|---|---|---|
| `vacay` | 8803 | VACAY | VACAY — Stays, Experiences, Auto, Homes, Flights |
| `vavlt-stvdios` | 8808 | Vault | Vavlt Stvdios — streaming, 8-screen sessions |
| `vulture-music` | 8806 | Vvltvre | Vvltvre Music/Distribution |
| `vulture-flix` | 8807 | Vvltvre | Vvltvre Flix |
| `vulture-pods` | 8810 | Vvltvre | Vvltvre Pods |
| `vulture-studios` | 8815 | Vvltvre | Vvltvre Studios — production financing |
| `venvm` | 8813 | Vvltvre | VENVM — AI production/content pipeline |

### Gamified & Simulation
| id | port | parent | name |
|---|---|---|---|
| `vdp` | 5174 | VDP | VDP — the walkable digital layer (Vite) |
| `vacon-c` | 8809 | VACON-C | VACON-C — civilization simulation |

**`vacon`, `vsafe` and `vaco-notify` were in this table until 12 Sep
2026** and are now below, with the other cross-cutting services. They
carried `parent: 'VACON-C'`, which put three internal services on a
public store card — the opposite of the recorded decision in
`dev-docs/VACO_CONSTELLATIONS.md`: "VACON-C the game went to GAMES;
VACON the agent network and VSAFE the safety layer stayed internal."
The VACON-C product is the simulation engine alone.

### Operations & Infrastructure
| id | port | parent | name |
|---|---|---|---|
| `void` | 8793 | VOID | VOID — logistics, drones, workforce, stations |
| `voidmagic` | 8797 | VOID | VOID MAGIC |
| `v4-proxy` | 8787 | V4 | V4 Agent Proxy |
| `v4-search` | 8788 | V4 | V4 Search Layer |

### Cross-cutting services — no parent, nobody "launches" them
| id | port | name |
|---|---|---|
| `shield` | 8812 | Sessions and credential auth; SSO |
| `vacon` | 8805 | The 14-agent operating network |
| `vsafe` | 8799 | Safety layer — check-ins, trusted contacts, escalation |
| `vaco-notify` | 8818 | The one notification channel |
| `vaco-analytics` | 8790 | Metric ingestion, anomaly/alert loop |
| `vaco-audit` | 8819 | Append-only record of operator decisions |
| `vaco-operator` | 8820 | Human-operator credentials and scopes |
| `vaco-media` | 8821 | Live session and playback grants |
| `v3-shield` | 8791 | Legacy `venvs-mock-backend`; dev only, not deployed |

`vaco-shell` (the launcher) does not list itself. `vex` (8816) is
listed only through `vex-trading`, which serves it.

---

## 3a. Two groupings of the same apps, and both are correct

The §3 tables above group by **bundle** — what a customer is shopping
for. There is a second grouping, by **constellation** — lineage and
shared roadmap, which apps are one job rather than four. Both are real,
both are served by the API, and the App Store has a control to switch
between them.

```
■ VOKEN                ✕ VVLTVRE               ○ SYSTEMS
   VOKEN                  Vvltvre                 V3
   VEX                    Vault                   V4
   VADO                   VXLLAGE                 VENVS
   CVLTVRE                CHOPZ

✕ VOID                 ▲ GAMES                 ◇ internal — not public
   VOID                   VDP                     VACON · VSAFE
   HVNTZ                  VACON-C                 VACO Analytics · Notify
   CVNVO                  VAGO                    Shield · Audit
   VACAY                                          Operator · Media
```

**18 public parents, no parent in two places, none left out**, plus 8
internal services nobody opens. The glyph is meaning, not decoration:
■ and ✕ mark a group of four (✕ because it *is* a four — four arms),
▲ a three, ○ a three that is shared infrastructure, ◇ the public/
internal boundary. ◇ is the only one whose count is not part of its
meaning, which is why it can hold eight.

**Where the two disagree, that is the point.** VEX is with V3 and VAGO
in the bundles because that is where a trader looks for it, and with
VOKEN in the constellations because it was extracted out of VOKEN.
Neither placement is a mistake and neither is being retired.

`dev-docs/VACO_CONSTELLATIONS.md` is the prose source and records which
placements were directed and which were decided when asked.
`vaco-shell/lib/registry.js` exports the same map as `CONSTELLATIONS`.
**`scripts/test/constellations.test.mjs` parses the document's own ASCII
map and holds the two to each other in both directions** — a name in one
and not the other fails the suite, whichever side it is on.

### Three things this recorded — two since resolved

**The map spent two weeks drifting in silence.** The document's internal
layer said three while the registry grew five more services — Shield,
VACO Audit, VACO Operator, VACO Media and VACO Notify. Nothing broke and
nothing said anything. That is why the test exists rather than a note
asking someone to keep them in step.

**The public/internal split was being undone by the bundle view —
resolved 12 Sep 2026.** The recorded decision is explicit: *"VACON-C the
game went to ▲ GAMES; VACON the agent network and VSAFE the safety layer
stayed internal."* But all three carried `parent: 'VACON-C'`, so the
store folded them into one public card, and `registry.js`'s own comment
cited the constellations document while doing the opposite of what it
says. They are now `parent: null, bundle: null` — the spelling every
other cross-cutting service uses — so both views agree and the VACON-C
product is the simulation engine alone. The store went from 23 products
to 26.

**`BUNDLES` and the store disagreed about Commerce & Marketplace —
resolved 12 Sep 2026.** There were two sources of truth: the declared
`BUNDLES` array, and each app's own `bundle` field. `BUNDLES` listed
Commerce as `[VENVS, VOKEN, CHOPZ]`; CVLTVRE and VADO had tagged
themselves Commerce since being promoted to parents on 2026-08-26
without ever being added. So `/api/bundles` answered **3** and the store
page drew **5**, for two weeks, and the store page is the one people
see. Resolved in favour of the store — they are parents, they are
commerce, and the declared list was simply behind.

**Neither can happen again.** `scripts/test/registry.test.mjs` now
requires the two sources to agree in both directions, and requires
`parent` and `bundle` to be set together or not at all — a half-set row
is what put VACON and VSAFE on a public shelf. Both checks were watched
failing against deliberate controls before being trusted.

The comment above `/api/bundles` in `vaco-shell/server.js` also read
*"5 bundles of 3 parents each"* for some time. There are six, sized
5, 3, 3, 3, 2, 2. Corrected 11 Sep 2026.

---

## 3b. Brand spelling — canonical, and where it stops

Stylized spellings are **display text only**. Directories, package
names, compose services, environment variables, module identifiers and
React component names are never restyled — that is what keeps a
rebranding a documentation change instead of a migration.

| brand | display | identifiers / paths |
|---|---|---|
| Vault Studios | **Vavlt Stvdios** | `vavlt-stvdios/` |
| Vulture | **Vvltvre** | `vulture-music/`, `vulture-flix/`, `vulture-pods/`, `vulture-studios/`, `VULTURE_MUSIC_API_URL`, `VACO_TOKEN_VULTURE_*`, `VultureMusicView`, `vultureFlixClient` |
| Culture | **Cvltvre** | `cvltvre` (registry id), `cultureCards`, `artCultureCard.js` |

**`Cvltvre` and `Vvltvre` are two different words, one letter apart,
and that is deliberate.** Cvltvre is Culture — VOKEN's card product,
parent #17. Vvltvre is Vulture — the media parent over Music, Flix,
Pods, Studios and VENVM. They rhyme and they are not related; the near
collision was raised and accepted rather than stumbled into. When
writing either, check which word you mean before which letters you type.

**Casing follows position, not preference:** `CVLTVRE` in headings and
filenames, `Cvltvre` in prose, `cvltvre` as an identifier. Same for
`VVLTVRE` / `Vvltvre` / `vulture-*`.

**Three source documents keep the name they arrived with** —
`vavlt-stvdios/VAULT_STUDIOS_ARCHITECTURE.md`, `…_IG_LAYER.md` and
`…_INTERACTIVE_CASINO_LAYER.md`. Their bodies already use *Vavlt
Stvdios*, so nothing there conflicts with the brand; only the filenames
predate it, and 32 citations across the repo point at them. Renaming
them would break every one of those for no gain, and `VACO.md`'s rule
is that an incoming document is appended to, never rewritten.

---

## 4. The six shared modules

Each answers a different question, which is why there are six target
lists in `sync-shared-runtime.sh` rather than one.

| module | asks | copies |
|---|---|---|
| `shieldAuth` | is this human who they claim to be? | 27 |
| `serviceAuth` | is this caller a known internal service? | 27 |
| `decisionLog` | record this decision before allowing it | 10 |
| `operatorAuth` | does a *human operator* hold this scope? | 11 |
| `mediaClient` | open a session / issue a playback grant | 7 |
| `tracing` | what request is this, across every service? | 36 |

`tracing` is the only one on *every* server, and deliberately so. It is
not a security control and carries no per-app judgement: a trace that
stops at one service is worth nothing, because the whole value is being
able to line up the eight log streams that describe one user action. It
is mounted **before** the auth middleware everywhere, so a request that
is *refused* still carries an id — a 401 you cannot correlate is
exactly the one you want to correlate.

It implements the W3C `traceparent` header — the same wire format
OpenTelemetry uses — in about ninety lines with no dependency. An OTel
exporter added later continues these traces rather than starting new
ones. That was the deliberate alternative to adopting the SDK now: the
part that has to happen first is propagation, and none of the collector
or backend decisions are needed for it.

**They are copies, not requires, and that is forced.**
`deploy/Dockerfile.node` builds with a single app directory as its
context, so `require('../../shared/shieldAuth')` resolves in
development and fails inside the container — the worst possible split,
because local testing never shows it.

**They land as `.cjs`, deliberately.** `vaco-analytics` and
`vaco-shell` are `"type": "module"`, so a `.js` file there is parsed as
ESM and a CommonJS module throws on load. `.cjs` loads as CommonJS
regardless of package type and works from both `require()` and
`import`.

`./sync-shared-runtime.sh --check` enforces three things, and the third
was learned the hard way:

1. no copy has drifted from `shared/`;
2. every copy is actually *required* by its app — a synced file nobody
   imports is drift `--check` cannot see;
3. no app holds an **unmanaged** copy outside the target lists. This
   is the dangerous direction: `vaco-shell` shipped a frozen shieldAuth
   this way while `--check` cheerfully reported "all 53 copies current
   and in use." A frozen copy of an auth module is a security hole with
   a long fuse — the app keeps working on yesterday's rules.

That third check matches on **module identity** (CommonJS *and* the
canonical export), not filename. Matching `*/lib/shieldAuth.cjs` false-
positived on `vdp/src/lib/shieldAuth.cjs`, a browser-side ESM session
client that shares the name on purpose.

**A fourth, added 10 Sep 2026: the scan must have looked at
something.** The unmanaged check hardcoded `*/lib/<stem>.cjs`, which
made it a no-op for any module synced under a different name — and
`persistence.js` is one, because all 28 of its apps are CommonJS
packages and renaming would mean rewriting the require in each. So the
find matched zero files and the check reported success having examined
nothing. That is §8's own "a tool that finds nothing must not report
success", committed inside the tool that enforces the other rules.
Caught by planting an unmanaged copy and watching `--check` stay green.
A scan that examines fewer files than there are managed targets now
fails as BROKEN.

**persistence.js was itself unmanaged until that day**, which is the
larger half of the same finding. 28 byte-identical copies of the
durability layer — the module that decides whether an acknowledged
write survives a restart — maintained by hand, while `--check`
reported "all 119 copies current" without them in view. Three copies
stay out deliberately: `vaco-shell`'s is real ESM because that package
is `"type": "module"`, and `vdp`/`venvs` are browser storage that
shares only the name.

---

## 5. Authorization

### The four guard shapes

Nearly every authorization bug found in this repo was one of these four
applied where another belonged.

| the route… | the guard |
|---|---|
| names the actor in the **body** | `requireActor(field)` |
| names the actor in the **path** | `requireParamActor(param)` |
| names a **thing** in the path | resolve it, compare its owner |
| decides an **outcome** | `requireOperator(scope)` or `requireCallingService()` |

**The rule that ties them together: a claim may be self-service, a
credential never is.** `requireActor('<the decider field>')` looks like
a guard and is not one — it verifies the caller is who they say they
are, then lets them name themselves as the approver. That exact shape
was found on seven routes across five apps, including a compliance gate
an ordinary account could clear for itself. HTTP 200, verified live.

### Coverage

```
490 mutating routes across 34 apps
449 guarded (92%)
 41 declared open, each with a stated reason
490 accounted for (100%)
```

`scripts/audit-route-guards.mjs --check` fails on a single unaccounted
route. There is no baseline file and no `--update-baseline`: a route is
guarded, or it carries an `// audit-route-guards: open -- <reason>`
marker written by a person. A percentage that could be raised by
editing a JSON file is not a measurement.

**What the number does not mean.** A guard here means *some* middleware
asked who was calling. It does not mean the right one.
`requireSession()` where an ownership lookup belongs counts as guarded,
and that was a real bug. The audit narrows where to look; it does not
replace sending the request.

### Service credentials

26 apps receive service-to-service writes and refuse an
unauthenticated one. V3 defaults to `enforce`, not `observe`.

This is not theoretical. `observe` allowed unauthenticated writes, and
combined with the old `optionalOwnAccount` middleware on the money
routes, this drained a stranger's wallet against a live instance:

```
curl -X POST /api/vcoin/transfer \
  -d '{"fromUserId":"victim","toUserId":"attacker","amount":500}'
```

Compose now marks every token `:?`, so a missing one stops the stack at
`up` rather than at the first settlement.

### Operator roles

`vaco-operator` issues a **separate, deliberately small credential** —
not a Shield role. 22 scopes:

```
operator:grant        vago:settle vago:grade vago:state
void:vetting          void:vetting:approve void:enforce
hvntz:settle hvntz:grade hvntz:enforce
voken:settle voken:grade voken:compliance
vulture-music:settle vulture-music:state
vulture-studios:settle vulture-studios:state
vaco-shell:reversal   vex:compliance
vaca:verify           vaco-notify:subscribe    vacon-c:tick
```

Group-2 routes — "decisions with a loser" — accept an operator
credential and **no service-token fallback**. `requireOperator(scope)`
fails closed with 503 if the operator service is unreachable, and 500
on an unknown scope (a typo'd scope name must not silently pass).

An operator may not grant themselves a scope. The self-grant refusal
carries the rule in its own error message, because the person reading
the 403 is the one who needs it.

`vaco-operator` deliberately holds no `operatorAuth` client of its own.
It guards its grant routes by calling `verify()` in process — giving
the authority service an HTTP client pointed at itself would add a
network hop, a timeout and a failure mode to the one service that must
answer when everything else cannot.

### The two-person rule

Scoped to exactly two verticals, `cannabisDelivery` and
`medicalTransportation`, derived from `VERTICALS[].licensingGated` in
VOID rather than a second hand-maintained list. `propose` and `approve`
must be different operators, compared as trimmed strings.

It is not applied anywhere else. A two-person rule on everything is a
two-person rule nobody follows.

### Audit before authorization

`vaco-audit` is written to **before** a decision is authorized, never
after. A decision that cannot be recorded is refused rather than made —
"record before deciding, refuse to decide if you cannot record."

`POST /api/decisions` requires a calling *service*, not a session. It
was reachable with an ordinary user session, which meant a user could
write fabricated rows into the record used to attribute decisions
against them. Verified fixed: 403 with a real Shield session, not 401.

---

## 6. Money

V3 is the canonical VCoin/VASH ledger; eighteen apps settle through it.
Two rules govern every money path:

**Fail soft on signals, hard on money.** Analytics feeds, advisory
signals and media sessions degrade quietly. Payouts, capacity checks
and licensing gates throw.

**Assert on the money, never on a status.** A status stays correct
while the money goes wrong — a payout route can return
`{ status: 'settled' }` having moved nothing, or having moved it twice.
Every money test asserts on the balance delta or the recorded transfer,
never on the response body's status field.

The NaN class was swept across every money path: a non-numeric amount
that passes a truthiness check, becomes `NaN` in arithmetic, and writes
a corrupt balance without ever failing a guard.

**Every money split is checked as a property, not as examples.**
`scripts/test/money-splits.property.test.mjs` runs DREAMS, Vvltvre Pods
and HVNTZ over hundreds of generated amounts, asserting the two shares
always sum to the amount. This exists because a hand-picked example
missed a real bug: the DREAMS rounding test used 0.07, which rounds
cleanly both ways, and passed against code that overcharged the
advertiser a cent at 77.25. The property finds such values in under a
second; a person guessing does not.

### Durability — what is actually guaranteed

Verified across all 29 persisting apps, not assumed:

| risk | covered? | how |
|---|---|---|
| Half-written store file | **yes** | write-to-temp then `renameSync` |
| Crash mid-transfer | **yes** | `transfer()` is synchronous and Node is single-threaded — debit and credit are adjacent statements with no `await` between them |
| Acknowledged write lost on process death | **yes** | `durable(store)` middleware calls `commit(store)` on every 2xx *before* responding. All 29 apps define it and all 29 mount it |
| Sudden power loss | **no**, and stated | `renameSync` is not an fsync of the file and its directory. `lib/persistence.js` says so in its own header rather than implying otherwise |
| Two processes writing one store | **no** | one container per app today; a second instance would corrupt the file |

**SQLite was considered and deferred, deliberately.** It would add
power-loss durability and per-row writes instead of rewriting the whole
store on every commit. Neither is a correctness bug today — the first
three rows above are the ones that cost money, and all three are
closed. Revisit it when an app runs more than one instance, or when a
store grows large enough that rewriting it per commit is the
bottleneck. Not before.

---

## 7. Media

Split into two planes, and the split is the whole design.

**The control plane is ours.** `vaco-media` decides who gets a playable
address and for how long — session grants, playback grants, capacity,
revocation, lifecycle. Tested, guarded, 51 tests.

**The media plane is a commodity, behind adapters.** `lib/transport/`
and `lib/storage/` mean the vendor is configuration, not architecture.
LiveKit JWTs are minted directly (HS256, no SDK); S3 URLs are presigned
with SigV4 written out (no SDK), expiry clamped to the grant's so a
signature can never outlive the permission.

**The SFU now exists.** `deploy/livekit.yaml` plus a `livekit` service
in the generated Compose file. Until this, the adapter minted real,
correctly-signed LiveKit tokens with nowhere to spend them — its own
header said so, and every test passed because every test tested the
token. Single UDP port rather than LiveKit's 50000-60000 default, so
`docker compose up` stays runnable on one machine. No keys in the
committed config; `livekit-server` reads them from env.

`VACO_MEDIA_TRANSPORT` still defaults to `loopback`, so a checkout with
no LiveKit credentials comes up working and simply cannot carry audio.
Selecting `livekit` *without* keys now refuses at boot rather than at
the first person who speaks — checked in `vaco-media/server.js`, not in
the adapter's constructor, because `describe()` reports
`configured: false` onto /api/health and that needs an unconfigured
adapter to exist.

**Both default adapters are asserted unusable.** `loopback://` returns
`token: null, mediaPlane: 'none'`; local storage returns `unstored://,
stored: false`. A default that half-works is worse than one that
refuses, because it ships.

Sessions: `call`, `room`, `broadcast`, `wall`. Assets: `audio`,
`video`, `short`, moving `registered → uploaded → ready`. `ready` is a
separate step from `uploaded` on purpose — a file that exists is not a
file anything can play, and conflating them fills a catalogue with
titles that 404.

Grants are stored as digests only (`vmg_`, `vpb_` prefixes),
per-viewer, per-asset, short-lived, revocable. A CDN URL is a bearer
token; one paste from public is how subscription video leaks. Takedown
revokes every outstanding grant, so a title pulled for a rights reason
stops playing for people who already had the page open.

**Seven consumers, all fail-soft:** vxllage (room), cvnvo (speed date,
never recordable), vavlt-stvdios (wall, recordable), v4-proxy (call
answer), vulture-flix (streaming + stream slot), vulture-pods
(publish), chopz (video). Each returns
`media: { available: false, reason }` rather than failing the
interaction.

`shared/mediaClient.js` is the **opposite** call from `decisionLog`,
deliberately. A decision record is evidence — an unattributed
settlement cannot be repaired afterwards, so that route refuses. A media
session is a feature: if vaco-media is down, a speed date cannot show
video, but the date, the match, the payment and the scheduling are all
still real. Refusing the whole interaction because the camera cannot
connect turns a degraded product into a broken one.

Bytes and bandwidth remain a purchase. That was never the part worth
owning.

---

## 7b. The agent surface

Three things stand between an agent and the ecosystem, and they were
built in this order on purpose.

**1 — the routes are guarded.** `v4-proxy` mounted no authorization at
all across 28 routes, including a live pass-through to the Anthropic
API and `/api/maps/crossings`, which takes a `userId` and reports who
that person crossed paths with. Twelve routes now carry guards, the
sweep route requires a service rather than a session, and the
app-level `serviceAuth` floor means no anonymous mutating call remains.

**2 — invocations are attributed.** VACON records every agent call in
its own `invocationLog` — which agent, which calling service, when —
before the agent answers, so a failed call still leaves a record.
Readable at `GET /api/agents/invocations` with a service credential,
capped at 10,000 because it grows with machine traffic rather than
human queries.

This deliberately does **not** go to `vaco-audit`. That was tried, and
vaco-audit refused the record: `agent-invocation` is not one of its six
outcome kinds. Reading its own header, the refusal was right — it holds
one row per irreversible decision and says in as many words that it is
not an application log. An agent answering a question is an action, not
a decision with a loser. When an agent can authorise a refund or
suspend an account, *that* belongs in vaco-audit, and none of them can
yet.

**3 — and only then, a tool surface.** `vaco-mcp/` speaks Model Context
Protocol over stdio and exposes fourteen tools onto V4 and VACON. It
holds one service credential, presents it on every call, and has no
privileged path:

```
agent -> MCP client -> vaco-mcp -> serviceAuth -> the route
```

A route that refuses it fails the tool and says so — and says a 401
there is authorization working rather than an outage, because that is
something a model can act on. Every call also carries a `traceparent`,
so an agent's action is traceable through every service it touches.

**Not exposed, and asserted so reversing it has to be deliberate:**
anything that moves money, and `POST /api/agent` itself. The first
needs a human or an operator credential and is recorded before it
happens; the second would be an agent calling itself through two
network hops. `system.health` takes a service *name*, never a URL — an
open host parameter would make it an SSRF primitive carrying a service
credential.

---

## 8. Standing rules

These were each paid for once. They are in force for all future work.

### Watch the test fail before trusting it
`dev-docs/STANDING_INSTRUCTION_TEST_VERIFICATION.md`

Reintroduce the real bug. If the test still passes, the test is the
bug. This caught the tests written to detect too-loose matching having
the too-loose-match bug inside them (`/UNMANAGED/` matched
`UNMANAGEDX`), a test passing against a *comment* about the bug rather
than the code, an escalation test that proved the outer scope check
instead of the self-grant rule — twice — and two media mutations that
survived because defence in depth upstream was catching them. The fix
there was to isolate the call and assert on the **reason string**, not
just `ok === false`.

A test that passes for the wrong reason is worth less than no test,
because it is trusted.

### A tool that finds nothing must not report success
Four sub-shapes, all found live:

1. a rewrite whose pattern no longer matches — `str.replace()` returns
   the string unchanged, no error, "success";
2. a filter narrower than the data — `lib/*.js` when every shared
   module lands as `.cjs`; would have pointed 7 containers' decision log
   at themselves;
3. a match looser than its name — `includes('VACO_SERVICE_TOKEN')`
   also matching the plural, so 21 of 22 verifiers appeared to have an
   allowlist;
4. a check scoped only to what the tool manages — `--check` blind to
   unmanaged copies, and a depth-1 backup walk that missed two nested
   apps while printing "ok".

What links them is not the bug, it is the reporting. `scripts/test/`
now pins every generator anchor, and `--check` on both sync scripts and
the guard audit fails rather than summarising.

### Middleware order is composition
`dev-docs/STANDING_INSTRUCTION_MIDDLEWARE_COMPOSITION.md`

`app.use()` applies only to routes registered *after* it. An
authorization floor added below its routes protects nothing.
Composition is untestable by reading — it has to be exercised.

### Ongoing evaluation
`dev-docs/STANDING_INSTRUCTION_ONGOING_EVALUATION.md`

Live-verify by sending the request. Every serious finding in this repo
— the wallet drain, the compliance-gate self-clear, the audit-log
forgery path, the `/api/join` route the new auth floor made
unreachable, a `describe()` built and never wired — was found by
running the system, not by reading it.

---

## 9. Generated, not hand-written

Six things in this repo are derived. Editing the output is silently
undone.

| output | generator | derives |
|---|---|---|
| `vaco-<date>-<commit>.tar.gz` | `scripts/package-release.mjs` | the deployable archive, verified by extraction |
| `docker-compose.yml` | `deploy/generate-docker-compose.js` | services, ports, cross-app URLs, `depends_on`, credentials |
| shared `lib/*.cjs` | `sync-shared-runtime.sh` | 80 copies from `shared/` |
| `public/vaco-ui.js` | `sync-design-system.sh` | design system into every serving app |
| service tokens | `scripts/generate-service-tokens.mjs` | the `.env` allowlist |
| `dev-docs/COMPLETION_BY_APP.md` | `scripts/completion-report.mjs` | per-app criteria met |
| `vacon-c/dev-docs/GAME_COMPLETENESS.md` | `vacon-c/scripts/completeness.mjs` | how much of a complete game exists |

The compose generator reads each app's own source to decide what it
gets: `createServiceAuth(` present means it verifies credentials;
`process.env.VACO_SERVICE_TOKEN\b` present means it calls out and needs
one. Both patterns are anchored and both are pinned by
`scripts/test/generator-anchors.test.mjs`, because both have silently
matched the wrong thing before.

---

## 10. Verification

Nine commands. The first eight must pass before deploying; the ninth
writes this document's figures back rather than checking them. Each was
run to produce the numbers here.

**Or run one command that runs all of them, inside the archive it just
built:** `node scripts/package-release.mjs` — see §11.

```sh
node scripts/run-all-tests.mjs           # 2765/2765 across 40 suites (some skip without a database)
node scripts/audit-route-guards.mjs --check   # 530/530 accounted for
./sync-shared-runtime.sh --check         # 216 copies current, none unmanaged
./sync-design-system.sh --check          # every serving app is a target
node deploy/generate-docker-compose.js   # 37 apps + nginx, livekit, postgres, 31 volumes
git diff --exit-code docker-compose.yml  # generator output matches committed
node scripts/generate-service-tokens.mjs --check   # .env.example matches 29 callers
node scripts/audit-settlement-atomicity.mjs   # 0 split settlements, ceiling 0
node scripts/restamp-record.mjs          # writes this document's own figures back
```

Nine now, not seven, and the count in that sentence has been wrong
twice — which is the reason the ninth exists.

The eighth is the ratchet from the settlement-atomicity sweep: it fails
if a single money movement is ever split into separate calls again, and
its ceiling is 0.

**The ninth is the only one that writes.** `restamp-record.mjs` reads
`dev-docs/COMPLETION_BY_APP.md` and `dev-docs/TEST_COUNTS.json` — the
two files the tools above generate — and writes their figures back into
§1's headline, §10's per-suite table, the command comment above, this
document's commit stamp, and REPLIT.md's line about the suite. Run it
**after** `run-all-tests.mjs`, which is what produces TEST_COUNTS.json;
run it before and it restamps to the previous run's numbers.

It exists because those five places were maintained by hand, and every
hand edit in one session needed a correction: a column width, a figure
in the wrong section, a number that appeared twice, a month rendered
"Sept" where the document says "Sep". It changes numbers and nothing
else — the per-suite table's hand-arranged layout and row order are
left alone, and a suite it cannot match is reported rather than
guessed at.

**Two of these need something the others do not.**
`run-all-tests.mjs` runs tests that need a real Postgres and **skip**
without one, saying why. A skipped test is not a passing test: the
headline count above was produced with Postgres up. Bring one up the
way `docker-compose.yml` does — the base schema then
`vacon-c/server/schema-extensions.sql`, in that order — or accept that
**49 checks did not run**, across three suites:

| Suite | Skipped without a database |
|---|---:|
| `v3` | 24 |
| `vacon-c` | 17 |
| `scripts` | 8 |

**This passage named only `vacon-c`'s 17 and quoted a test count that
had since moved on four times.** Both are the same mistake: a figure
transcribed by hand into prose that nothing checks. The suite names
come from `dev-docs/TEST_COUNTS.json`, which
`scripts/run-all-tests.mjs` writes on every run, so they can be
re-read rather than remembered.

`node --test test/` fails in this Node version regardless of the tests,
so mutation runs must use explicit file globs. That briefly made a set
of mutation results false.

**The two Vite frontends are the gap these commands used to have.**
`vdp` and `venvs` are built by `vite`, not run by `node`, so nothing
above exercises them — and both were unbuildable for some time while
every check above passed. `scripts/test/frontend-imports.test.mjs` now
resolves every relative import in both apps statically (no
`node_modules` needed, so it runs inside the release archive too). A
real `cd vdp && npx vite build` is still the stronger check when
dependencies are installed.

### Per-suite

```
vacon-c        1241   vdp             147   void            142
scripts         168   v3              111   vaco-media       51
v4-proxy         42   world-layer     172   venvm            40
venvs            45   voken            37   vaco-analytics   39
vaco-shell       36   vacay            24   voidmagic        28
cvnvo/yap        35   vaco-operator    20   vacon            18
vaca             17   vaco-notify      17   vsafe            17
vaco-audit       16   vex              16   vulture-music    19
v4-search        15   hvntz            14   vaco-mcp         14
vavlt-stvdios    14   cvnvo            13   vago             45
vxllage          13   dreams           15   shield           12
vulture-flix     12   vulture-pods     12   chopz/chopz-shop 14
vulture-studios  14   vex-trading      10   chopz             8
vash-tap         42
```

---

## 11. Deploying

### The archive

```sh
node scripts/package-release.mjs          # -> vaco-<date>-<commit>.tar.gz
```

3.8MB, 2203 files, tracked sources only. Unpack it on the target host
and follow the steps below; nothing else is needed to deploy.

**What is deliberately not in it.** `node_modules/` (273MB across the
tree) — the Docker path installs during build and the local path has
`install-ecosystem.sh`, and shipping platform-specific binaries inside
a source archive is how a deploy breaks on a different libc. Runtime
`**/data/` stores — somebody's live state, not release content. And
`.env`, which in this working tree holds live service tokens.

**The script proves the archive rather than producing it.** `tar` exits
0 on an archive missing the compose generator, carrying a stale
`docker-compose.yml`, or containing that real `.env` — all three ship
silently and surface on somebody else's machine. So it extracts what it
built and runs all seven checks from §10 *inside the extract*, against
the bytes a deployer receives rather than the working tree.

Five refusals, each watched failing on its own bug before being
trusted:

| if… | it… |
|---|---|
| the working tree is dirty | refuses — `git archive` packages HEAD, so your changes would be silently absent |
| a key, `.env` or runtime store is inside | refuses **and deletes the archive it just built** |
| a file the deploy procedure names is missing | refuses, naming the file |
| the committed `docker-compose.yml` is stale | refuses — it differs from what its own generator produces |
| anything fails inside the extract | refuses — the archive is the difference |

### The steps

1. **Secrets.** `cp .env.example .env`. Two are genuinely required:
   `ANTHROPIC_API_KEY` (v4-proxy) and `VACO_SERVICE_TOKENS` (the
   allowlist), plus 25 per-app `VACO_TOKEN_*` values —
   `node scripts/generate-service-tokens.mjs` writes them. All are
   marked `:?` in compose, so a missing one stops the stack at `up`.
2. **Operator bootstrap.** `VACO_OPERATOR_BOOTSTRAP` stays `:-`
   (optional), not `:?`. The first operator has to come from somewhere,
   and a required bootstrap value would mean the authority service
   cannot start without one.
3. **Regenerate and verify.** Run all six commands in §10.
4. **Build.** `docker compose up --build`. This has never run against a
   real Docker Hub — see §12.
5. **nginx** terminates TLS and applies rate limiting; it is the only
   service with published ports.
6. **Backups.** `node scripts/backup-stores.mjs` snapshots every
   `*/data/store.json`, including the two apps nested one level deeper
   (`chopz/chopz-shop`, `cvnvo/yap`) that a depth-1 walk silently
   missed. On a fresh checkout it correctly reports "found no
   */data/store.json to back up" rather than an empty success — the
   stores are runtime data and are not in git. There are 28 persisted
   volumes to cover once the stack has run.
   `dev-docs/DISASTER_RECOVERY.md` has the restore procedure. Restore
   has been tested locally, never from an off-host copy.

---

## 11a. VACON-C — the running percent

The simulation engine is the one app in this repo whose "done" is not a
list of routes, so it carries a measured completeness score rather than
a criteria tally. **91.4%**, from
`vacon-c/dev-docs/GAME_COMPLETENESS.md`, which
`vacon-c/scripts/completeness.mjs` regenerates and
`vacon-c/test/completeness.test.js` fails on if stale — including a
check that the percent in THIS file matches the one the code measures.

| axis | complete | what it measures |
|---|---|---|
| systems | 72.4% | the forty urban systems §7 names, at `urbanSystems.js`'s own four levels |
| tables | 93.2% | schema tables a built world actually fills |
| statistics | 88.2% | statistics a world can answer about itself |
| traits | 100% | traits something under `server/` reads |
| traitDepth | 85.7% | trait columns a life actually changes |
| habits | 100% | whether habits and routines carry information |

**90.8% -> 91.4% on 24 Sep 2026, on the tables axis instead of systems.**
`economy_snapshots` and `analytics_snapshots` were the tables axis's
last two genuinely open items besides `investments` — real history
(supply/demand/price at tick 900 is not computable at tick 900 once
tick 900 has passed), not a duplicated rollup, so building it did not
fight the third standing rule. `server/snapshots.js`: one
`analytics_snapshots` row every tick, world-level (population,
crime/birth rate, a lifetime death share, migration activity in the
trailing year, mean education, unlocked eras); `economy_snapshots`
rows for every living individual and family — not the schema comment's
wider community/city/region/civ list, because `entities` rows exist
for npc/organization/family only and cities/civilizations have no id
an FK to it could hold — on `statecraft.BUDGET_INTERVAL_TICKS` (a
quarter, reused rather than a new cadence invented for the same
question). `gdp` stays null on every row: no mechanism anywhere
computes a monetary output aggregate, and the columns a real one would
sum (`businesses.revenue`/`.profit`) are unwritten, so a substitute
would silently redefine GDP as a different quantity. Unknown is not
zero. `investments` remains open and un-forced for the reason already
on file: no document gives a return, risk or valuation model for a
capital stake, and inventing one would be game design this project has
repeatedly declined to guess at.

**90.7% -> 90.8% on 24 Sep 2026, same day, different cause.** Energy
moved `partial` -> `modelled` on the systems axis. A grid could already
fail (17 Sep) and the outage moved `resources` supply for `energy` —
and nothing consumed it, so a blackout was a number nobody felt.
`economy.energyFactor` is the first reader, folded into
`productivityOf` as an economic input the same way health and focus
already are, centred at 1.0 for supply meeting demand so an ordinary
city's workers are unaffected. Measured end to end: failing a city's
grid and running 20 ticks took a real worker's productivity from 1.556
to 1.156.

This is the systems axis's largest legitimate remaining bucket — 9.85
of the 29.35 buildable points once Transportation and Supply Chain's
scope-deferred credit is set aside — continued from the statistics
axis, which turned out to be exhausted of safe wins the same day (see
the entry above this one).

**90.6% -> 90.7% on 24 Sep 2026, and the denominator moved too.** The
catalogue grew from 117 statistics to 119 — `dominant_gift` and
`median_mastery`, from `server/gifts.js` — and both are answerable, so
the numerator grew by two against a denominator that grew by two. The
total went 318.95/352 to 320.95/354.

That is a smaller rise than the day's work might suggest, and the
reason is worth stating rather than leaving to be inferred: **most of
what changed on 24 Sep is invisible to this metric.** The
`seededUnit` defect — which meant `MOVE_CHANCE` had never gated
anything, `environment.drawWeather` returned `clear` in every world
ever generated, and every mission reward came out at its floor — does
not move a single axis, because every one of those systems already
scored as built. The metric asks whether a mechanism exists and is
reached, not whether it does what it claims. A system wired to a
constant passes it.

`tribeMissions.js` is the same: `missions` was already a filled table
and the statistics axis has no entry for "how many missions a world
generates", so closing playtest finding 2 scores zero here. The percent
is an honest floor on completeness and a poor measure of correctness,
and the gap between those two is where this week's findings have all
been.

**91.2% -> 90.6% on 23 Sep 2026, and the measurement is what moved, not
the engine.** Two justice statistics — `state_declined_share` and
`group_answered_share` — went silent. Measured at the script's own
200-tick horizon with its own seed: **4 incidents, 0 cleared.**
`runJustice` only processes CLEARED incidents, so neither a court case
nor a group sanction can exist, and both statistics are about what
happens after one. Four of five areas are still `contested`, so the
writ did not move; the chain never starts.

The same 600-tick world produces 18 offences and 12 clearances, so the
mechanism works. This is `migration_events` again from four days
earlier, and together they name a property of the score worth stating
plainly: **at 200 ticks several axes measure whether a rare event
happened in a short window, not whether the engine can produce it.**

The obvious response — run the script longer until the number recovers
— is the wrong one, and it is worth writing down why. A measurement
retuned because its result was disliked stops being a measurement. The
horizon stays at 200, the drop is recorded, and the sensitivity is
named here so the next person reading a dip knows to check the
mechanism at length before treating it as a regression.

**91.3% -> 91.2% on 19 Sep 2026, and the half-point is worth naming
rather than nudging.** `migration_events` went from filled to empty in
the 200-tick world the script measures, because the crime rescale of
the same day changed what a neighbourhood reads as.

`runMigration` takes its push pressure from
`crime.dangerByCommunity`, which was returning **1.0 in 18 of 24
measured areas** — the raw per-area rate against a reference of 40 that
every populated area was two to four times over. So push was maximal
almost everywhere and people fled constantly. Against the shrunk rate
and a measured reference it now returns about 0.25, and they do not.

**Migration is not broken and the mechanism was checked rather than
assumed**: a 600-tick playtest produces 21 migration events. What
changed is that 200 ticks is no longer long enough to guarantee one.
The honest reading is that migration was over-triggered before, and
this is a recalibration the fix earned rather than a loss — but the
score is the score, so it is recorded down rather than explained away.

Weighted by item count, deliberately: no document in the package says
which half of a game matters more, so inventing a weighting would put a
made-up number at the top of a report whose whole purpose is that its
numbers are not made up.

**Why a measured score and not a checklist.** Every status claim this
project has made has been wrong when checked. `vacon-c/CLAUDE.md`'s
"foundation already running" list was wrong in three places. A spec
section put its own coverage at "roughly 25 of the 40" from memory.
`statistics.js` carried 67 statistics and a real world answered 36.
Seven trait families were generated on every NPC and read by nothing.
Resources had no mechanism anywhere that could raise a supply, so every
world the engine had ever run ended in total famine and the suite was
green throughout. `server/contest.js` was a complete, tested,
deterministic contest resolver that the tick pipeline never called, so
no world had ever held a contest. A weekly routine could not form a
habit at all — flat decay against periodic reinforcement — so
`gathering` sat at 0.3 while daily habits sat at 75, and the frequency
column was wired, firing and inert. And `relationships.conflict` was
initialised to 0 with its only writer gated behind its own threshold,
so **not one violent or domestic offence had ever occurred in any world
the engine had generated** — 0 of 241 relationships above zero after
200 ticks, with a resolver, a threshold and a category vocabulary all
in place and a green suite over the top. And `laws` was a table no code
read when deciding anything, so a government legislated into a void:
the first 600-tick world to reach a courtroom produced 7 cases and **7
dismissals**, because neither city had ever outlawed theft. And every community in
every world was identical — `housing`, `safety`, `employment`,
`education` and `reputation` all at the schema default of 50 with
nothing writing any of them, so community health was 50 everywhere and
city reemergence 37 in every world — while every building decayed to
condition 0 within 300 ticks with nothing anywhere repairing one. And
nothing anywhere had a POSITION: §9's MASTER BLOCK KEY opens with
GEOGRAPHIC DATA and names police station distance and hospital distance
among eight fields, and three free-text geo keys in the schema had no
format, no parser and no reader — which is why how far the state
reached could only ever be a fact about a city rather than about a
street.

**And `infrastructure.failureRisk` was computed, crossing-detected and
consumed by nothing** — a grid at risk 0.95 behaved exactly like one at
0.05, `funding` had no reader anywhere in the engine, and four of §7's
forty systems were stuck on that one missing mechanism.

**And two whole tier-level trait sheets existed only in a document.**
`VACANCY_TRAIT_DATABASE_ATTACHMENT.md` defines five — FAMILY,
ORGANIZATION, CITY, CIVILIZATION and CULTURE — and the engine built
four. `CITY_TRAIT_FAMILIES` and `CIVILIZATION_TRAIT_FAMILIES` name
thirty-three dimensions between them and nothing under `server/`
mentioned either, which is where §7's last three `absent` urban systems
had been sitting the whole time: Government Services, Military /
National Guard and Tourism are `healthcare`/`education`/`security`,
`military` and `tourism` in a file this project has had since day one.
That one is not a citation-is-not-presence failure, it is its paper
twin — **a specification nobody opens is indistinguishable from one
that was never written**, and it was found only because the owner
asked, before any of it was built, whether it was already documented.

**And four `cities` columns were founding constants.** `economy`,
`safety`, `infrastructure` and `growth` were written once by
`generateCity` and by nothing ever again — the community columns'
situation exactly, one tier up. `cities.infrastructure`'s own schema
comment says it is a "computed rollup from the infrastructure table",
`infrastructure.cityCondition()` had computed that rollup since the day
that module was written, and nothing connected them; a third of every
city's reemergence composite was a number drawn on tick 0.

**And two whole urban systems were the reason a variable was a
constant.** §7 had exactly two entries left at `absent` — 23 Media and
24 Social Media — and `politics.broadcastGovernmentKnowledge` wrote one
`entity_knowledge` row per NPC unconditionally, so every announcement
reached every person in the world instantly and
`computeApproval`'s `spread` was a constant **1.0** (measured, 153 of
153). `assessRevolutions` needs approval below 35 AND spread at or
above 0.25, so one of its two conditions could never fail and §63's
"Public Opinion + Information Spread + Government" mechanic was a
public-opinion mechanic with a decorative second term. §61's own
channel list and the ten eras already on the ladder were the whole
design: awareness now reads 0.2 at founding and 1.0 once radio comes
back. **Nothing in §7 is `absent` any more.**

**And one of the seven Keys had never resolved once.** `keys_log` was a
table with no store, partly because `keys_log.key_id` references
`key_definitions` and the module constant `completeness.js` said it
was had never been written. With both in place, 300 ticks of a
generated world measured: Aggression 4555, ScarcityResponse 2398, Fear
2398, Adaptability 1530, Resilience 2, **Trust 0**, Territory 0.
Territory is deliberately unwired and says so; Trust was not — the
entire Social category, dead, because `runSocialPhase` only runs it
where the actor holds a fact ABOUT the other party and **nothing in the
engine wrote a knowledge row whose subject is a person** (0 of 600).
A robbery victim now learns something about whoever robbed them, at a
confidence drawn against the offender's own `criminal` traits, and
Trust resolves 7,186 times with relationship trust spanning 16 to 87
instead of sitting at 50.

**And a complete trade had never executed.** `barter.exchange` prices
an item from §27's own barter key, adjusts for scarcity, population,
both sides' Barter Skill and the seller's Trustworthiness, checks the
buyer can cover it out of SAVINGS rather than net worth, checks the
seller really holds the thing, and moves the object — conservative on
both sides, with its own green test file and **no caller anywhere
outside its own module**. The `contest.js` shape exactly.
`vacon-c/server/trade.js` is the occasion and it invents no motive:
`crime.js` already turns being below the poverty line into a theft, and
somebody under that pressure who owns something can sell it instead.
Measured over 400 ticks: 51 sales against 8 thefts, and the tenth
percentile of net worth rose from -452 to 1,796 — the first mechanism
in the engine that moves value from the people who have it to the
people who do not.

**And phase 2 of the locked eleven was a no-op.**
`advanceResourceTick` moves `resources.quantity` by `production_rate -
consumption_rate`, and `worldgen` set neither, so it computed
`max(0, 0 + 0 - 0)` on every resource on every tick. Meanwhile
`getScarcity` reads `supply`/`demand`, whose only writer anywhere was
the drought applier — so **a settlement's scarcity was a constant drawn
on tick 0**, measured unchanged across 400 ticks (food 44, water 45,
medicine 46, energy 42, wood 62), with prices, the food satisfier,
survival pressure and the broadcast feeding two Key resolvers all
reading it. `consumption_rate` is live now as units per person per
tick, so demand tracks the population that wants the thing and moves
with births, deaths and migration. Derived from the drawn demand rather
than chosen, so tick 0 is unchanged to the digit.

**The percent can go DOWN, and did — twice, for different reasons.**
90% to 89.6% (and back up through 90.6% with the tier sheets, 91.1%
with media, 91.4% with the Social Key and 91.5% with the market to
**91.2%**, because declaring `resource_stock` as a gap grows the
catalogue by an entry that cannot be answered — a score that only ever
rose would be measuring the work rather than the world; and to
**91.1%** on 18 Sep 2026 for the same reason again, when the takeover
key, §24 knowledge recovery and meetings added eight statistics of
which one, `knowledge_stock`, is declared unanswerable because
knowledge is a §28 resource type that using does not use up; and back
to **91.3%** with salvage, whose three statistics are all answerable —
`salvageable_stock` measured 7.5% to 76% across five neighbourhoods,
and `materials_held` and `things_made` return a real zero rather than a
null in an area where nobody has salvaged yet, which is the difference
the `known` flag exists to carry), because the world
the report measures is now a contested settlement where thefts go
unprosecuted, so `court_cases` is genuinely empty in it. A score that
only ever rose would be measuring the work rather than the world. The pattern is consistent enough to be a rule: **the
only trustworthy number is one a command produces.**

**One statistic was built, measured, and taken back out.** The owner
asked for obesity in a city. A body-composition index was derivable
from the substrate that exists — `motivation`'s food need as intake, a
`work` routine and `sports` traits as exertion — and it ran and produced
bands. It was removed and declared unavailable instead, for three
measured reasons: intake is a fact about a CITY's food supply rather
than about a person; 50 of 127 people hold a work routine, so the
exertion half splits a population at the same line employment does; and
the obese band was unreachable in every world measured, making it a
statistic that could only ever report zero. §9 permits demographic
modelling and forbids demographics deciding an NPC's worth, and a body
reading that is really a jobs reading is on the wrong side of that
before anybody uses it for anything. `body_composition` names what
would close it: a per-person consumption record, which `inventory.js`
is one step from. **A declared gap is visible; a plausible wrong number
is not.**

---

## 11b. On deck — frozen, not started

`dev-docs/on-deck/` holds architecture the owner has frozen and
deliberately deferred. Nothing in it is built.

| document | status |
|---|---|
| VACO Verified Business Network + VCoin + Community Economy | frozen 17 Sep 2026; audit begun and stopped |
| VAGO Group Wagers / Group Bets | frozen 17 Sep 2026; audit begun and stopped |

Both carry a mandatory audit-before-code step, and the partial audit is
recorded in that folder's README because it is the expensive part.
Its one load-bearing finding: **the VAGO Group Wagers freeze requires
integration with a Wager Contract Engine, Wager Graph, Wager Threads,
Escrow Adapter and Resolution Engine that return zero files apiece.**
The engine the group layer sits on has not been built, so that is the
first task there, not the group layer.

The compliance gates in §12 are unchanged by either document, and both
documents agree with them in their own text.

---

## 12. What is not done, and why

**Environmental — nothing to do until there is infrastructure. These
are what stand between this and a real deployment.**

- **First real `docker compose build`.** No network here has Docker Hub
  access. Every layer above it is verified — the file generates
  deterministically, all 35 servers boot and propagate a trace, every
  env var is declared — but the build itself has never run. **This is
  the single largest untested step**, and it is the first thing to do
  on a machine that can reach a registry.
- **There is still no off-host backup, and the backup tooling was
  blind to Postgres for a day.** `scripts/backup-stores.mjs` copied
  `<app>/data/store.json` and nothing else. After the 11 Sep conversion
  those files stop being written the moment `DATABASE_URL` is set, so on
  a real Postgres deployment the script captured stale pre-cutover
  files, verified their checksums, and printed `v3 ledger: 17 accounts,
  15500 VCoin` — its own second witness on the money — against a live
  ledger of 2 accounts and 2000 VCoin. `restore-stores.mjs` had the
  mirror and would have reported the ledger restored while the database
  was untouched. Both now dump and restore `vaco.stores` and the two v3
  tables, both refuse rather than report success where the files alone
  would mislead, and `scripts/test/backup-restore.test.mjs` holds it.
  **The snapshot still goes to a local directory**, so the disk that
  holds the database and the disk that holds its backup are the same
  disk. That is the remaining gap, and it is the same one as before —
  it just moved.
- **The LiveKit SFU has never been started.** Its config and Compose
  service exist and the token it will be handed is real, but no audio
  has ever crossed it. Expect the first run to need `use_external_ip`
  and a public address, which the config comments call out.
- **No TLS, no domain.** `deploy/nginx-docker.conf` terminates plain
  HTTP on :80. A real deployment needs certificates and a hostname, and
  Shield's session cookies should be `Secure` once there is one.
- **2 apps keep state in JSON files** — `vaco-shell` and
  `vaco-analytics`, the two that were never converted. Writes are
  atomic (temp + rename) and `durable(store)` commits before
  responding, which is genuinely safe for one process per service. It
  is *not* safe for two replicas of the same service, so **do not scale
  either of those two past one container** until that changes. §6 has
  the full posture.

  The other 32 backends divide as **29 on Postgres** — 28 through the
  shared store backend plus VACON-C on its own schema — and **3 that
  keep no state across a restart at all**: `v4-proxy` (call sessions,
  deliberately in-memory — a `ringing` call restored from disk is
  ringing at nobody), `v4-search` and `vex-trading` (both stateless
  query layers over other apps' records).

  **All 28 file-backed apps moved to the shared Postgres store backend on 11 Sep 2026 — 30 of the 35 backends on Postgres once VACON-C is counted.** `shared/persistencePg.js` is the same three-function
  interface the other apps already use, over a `vaco.stores` table
  holding one JSONB document per app. An app converts by changing how
  its store is built; its libs, routes and guards do not move.
  `sync-shared-runtime.sh`'s `PERSISTENCE_PG_TARGETS` is the honest
  record of how far this has got — 28 names in it today.

  **These counts are held by `scripts/test/storage-backends.test.mjs`,
  and that test exists because they drifted.** When the conversion
  landed, the number that grew was updated everywhere and the number
  that shrank was not: four documents went on describing a file-backed
  remainder of 5 or 6 apps when the real figure was 2. The direction of
  that error matters — a document that overstates the remaining work
  reads as a warning, and one that understates it reads as permission.

  Two things about it that must not be blurred together:

  **It is not a drop-in.** `persistence.js` is synchronous end to end
  and there is no synchronous Postgres client for Node, so `commit`
  returns a promise and `durable` holds the response until it settles.
  The externally visible guarantee is unchanged — verified by killing
  V3 with `SIGKILL` immediately after a 201 and finding the 250 VCoin
  transfer intact on restart — but every converted app must await its
  store before `app.listen`. That async conversion is the real per-app
  cost.

  **It does not make an app horizontally scalable.** The whole store is
  one document, so two instances still cannot both write. What changes
  is that they now *find out*: every write is conditional on the version
  it read, so a second writer gets a refused write and a 409 instead of
  silently overwriting. Divergence becomes loud rather than invisible.
  True multi-writer means decomposing a store into rows and letting
  Postgres arbitrate per balance and per transaction — a second,
  per-app job, and V3 is where it will matter first.

  **V3's own ledger is rows, not a document, as of 11 Sep 2026.**
  Balances, transfers, settlements, cashouts and idempotency keys are
  real tables; `v3/lib/ledger.js` picks that or the in-memory store from
  DATABASE_URL and the routes never branch. Two V3 containers can both
  write: Postgres arbitrates per balance, and an idempotency key is
  claimed by an INSERT before the handler runs rather than recorded
  after it.

  V3 without `DATABASE_URL` still uses its file and says so at boot.
  With one set and the database unreachable it **refuses to start**,
  deliberately unlike VACON-C: an empty simulation that says so is a
  working demo, and an empty ledger that answers `/api/vcoin/balance`
  reports everyone's money as zero.

  **VACON-C is the exception, as of 10 Sep 2026.** It is a tick
  simulation with a locked 63-table schema, and its durable record is
  Postgres: `server/persistence.js` loads the world before
  `app.listen` and checkpoints every 10 ticks.
  `docker-compose.yml` declares the service, mounts the base schema and
  `server/schema-extensions.sql` as ordered init scripts, and gives it
  a volume.

  That does **not** make VACON-C safe to scale either, and for a
  different reason: the working set is still one process's memory, so
  two replicas would be two divergent worlds both checkpointing over
  each other. One container, same as the rest.

  It also fails soft. With no reachable database it starts an *empty*
  world, says so in full on stderr, and never checkpoints — so an unset
  `DATABASE_URL` is silent data loss rather than a startup failure.
  A process whose load failed is then permanently barred from
  checkpointing for its whole life, because otherwise a connection blip
  at boot followed by a recovery would have the empty world truncate
  and overwrite a real archive.
- **Off-host backup restore.** The backup script works and the restore
  works locally. Restoring from a remote copy needs a remote.

**Deliberate — built this way on purpose.**

- **vulture-music offer/accept flow** — flagged, not built. Scoped out
  rather than half-built.
- **`influencer-culture-card-rewards`** — closed pending review.
- **VACON-C live trading** — paused. The interlock is never bypassed.
- **VOID licensing gates** on `cannabisDelivery` and
  `medicalTransportation` — not relaxed, and the two-person rule sits
  on top of them.
- **Likeness consent throws, never warns.**
- **BarBuddy `isVisibleToOthersAtVenue: false`** stays as built.
- **VENVM scope** is the AI production/content pipeline only.
- **Media plane vendors** — LiveKit and S3 are adapters, unconfigured
  by default and asserted unusable until they are.

**Deliberate — added since, and stated so it is not mistaken for a gap.**

- **Tracing carries ids, not spans.** There is no collector and no
  exporter, by choice. Propagation had to come first; adopting an OTel
  exporter later continues these traces rather than starting new ones.
- **`vaco-mcp` has no SDK.** MCP over stdio is JSON-RPC 2.0 with four
  methods that matter. The cost is real — an SDK tracks protocol
  revisions and this does not — so its tests spawn the real process and
  write real frames, including the two framing cases that only fail
  under load.
- **Renovate is configured but not installed.** `renovate.json` does
  nothing until the GitHub App is enabled on the repository.

**Durability: resolved.** `claude/v4-proxy-server-s6dcp8` is pushed to
`biggvlounge-ctrl/vaco`, and local and remote are in step.

This section carried a warning for most of this work's life, and the
warning was earned. `git push` returned 403 — the remote said the
Claude GitHub App lacked access to the org — so every commit lived only
in an ephemeral container. Re-linking the GitHub connector from
claude.ai's settings page fixed it; the org-level app install the error
message suggested was not required.

Two revisions of this line were wrong before that, and both are worth
keeping visible. One quoted a commit count from a history that no
longer exists. The other called an unpushable branch "not blocking" —
which is exactly the reasoning that made the earlier loss total, when
the container was reclaimed with nothing pushed and the repository had
to be rebuilt from an archive (`dev-docs/DISASTER_RECOVERY.md` §0).

`node scripts/snapshot.mjs` still produces a restore-tested bundle and
is still worth running before anything risky. It is no longer the only
copy, which is a different and much better position.

**Closed since the last revision of this file (10 Sep 2026):**

- **VACON-C persistence.** Order-of-operations step 9's second half.
  `dev-docs/COMPLETION_BY_APP.md` now reads "Every app meets every
  criterion that applies to it" — this was the last shortfall.
- **Single-port deployment.** `gateway.js` puts the whole ecosystem
  behind one port for hosts without nginx; §2 and §11 have it.

**Known and open, added here rather than discovered again:**

- **`npc.name` needed a column the locked schema does not have.**
  `server/schema-extensions.sql` adds it in a separate additive file so
  the base schema stays untouched. Its bar for adding a column is a
  field the engine *reads*; `properties.community_id` is set by nothing
  and read by nothing, so it is a self-checking exemption instead and a
  test fails the day something reads it.
- **The schema models no property location.** `properties` has no FK to
  a community or a city. Closing that is a design decision about the
  Property/Territory relationship, not a column to add quietly.
- **`.replit` and `replit.nix` have never run on a real Replit
  container.** They are marked as first drafts in their own headers.
  `deploy/replit-boot.sh` underneath them has been driven here.

---

## 13. Where everything else lives

| document | covers |
|---|---|
| `README.md` | how to run it |
| `VACO.md` | the filing form — where a new file goes |
| `dev-docs/DEPLOYMENT_INVENTORY.md` | per-service deployment detail |
| `dev-docs/DEPLOYMENT_FILE_PLACEMENT.md` | what lands where on a host |
| `dev-docs/DISASTER_RECOVERY.md` | backup and restore |
| `dev-docs/ROUTE_AUTHORIZATION_AUDIT.md` | the guard sweep, route by route |
| `dev-docs/AUTH_HARDENING.md` | the auth work and what it closed |
| `dev-docs/OPERATOR_ROLES_SCOPE.md` | group 1 / group 2, and why |
| `dev-docs/DECISION_AUDIT.md` | the decision record's design |
| `dev-docs/MEDIA_INFRASTRUCTURE_DECISION.md` | build vs. rent, and the answer |
| `dev-docs/REALTIME_MEDIA_SHARED_INFRASTRUCTURE.md` | the media architecture |
| `dev-docs/COMPLETION_AUDIT.md` | claimed vs. actually coded, per app |
| `dev-docs/MASTER_COMPANY_REGISTER.md` | the corporate/brand structure |
| `dev-docs/STANDING_INSTRUCTION_*.md` | the three standing rules in §8 |
| `<app>/dev-docs/` | per-app phase records, including what was skipped |

**On the older documents.** Many `.md` files here are source design
documents carrying an "Implementation status" section added when they
were filed. Several describe capabilities as built that are not. **The
status section is authoritative over the document body above it.**
