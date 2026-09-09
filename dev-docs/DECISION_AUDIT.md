# The decision log (vaco-audit)

**Status: shipped.** Port 8819. Recording today from seven apps across
27 routes. Every row currently says `decidedByKind: "service"`, and
that is the honest state of the world rather than a defect — see
[§7](#7-what-this-does-not-answer-yet).

This is the audit half of `dev-docs/OPERATOR_ROLES_SCOPE.md`, shipped
ahead of the authorization half on purpose. The two are independent:
knowing *what was decided and by which credential* is useful the moment
it exists, and it does not wait on any of the open questions about how
operator roles get scoped, granted or revoked.

---

## 1. The problem, stated exactly

The authorization sweep closed roughly 26 routes that the scope doc
calls **decisions with a loser**: settling a sports event, grading a
bet, drawing a raffle, resolving a market, approving an ad, sighting a
licence, distributing revenue. Somebody is measurably worse off after
each one.

Every one of those routes now demands a credential. None of them
recorded that anything happened.

So the honest answer to *"who settled this event?"* was **"we don't
know."** Not "a service token" — the application log, if it still
existed, might have said which process, and application logs rotate.
Six months later, in the only situation where the question is ever
asked, there was nothing to read.

## 2. The rule

> **Record before deciding, and refuse to decide if you cannot record.**

The record is written first and the decision runs only if it lands.
The ordering is the whole point: writing afterwards means a crash
between the two leaves a decision nobody can attribute, which is
precisely the state this service exists to end.

This is a deliberate exception to the ecosystem's standing posture,
which is **fail soft on signals, hard on money**. `pushMetric` swallows
its errors because a fractional-share purchase should not be held up by
analytics being down. A decision record is on the money side of that
line, and further along it than money usually is: a transfer that fails
can be retried, but an *unattributed settlement* cannot be repaired
afterwards, because the fact is exactly what was lost.

**The cost, stated plainly.** vaco-audit becomes a hard dependency of
every group-2 route. If it is down, settlements stop. That is a real
availability tradeoff, and `VACO_AUDIT_MODE` is the lever for it:

| mode | behaviour |
|---|---|
| `enforce` *(default)* | no record, no decision — the route returns **503** |
| `observe` | record if possible, proceed either way, count the misses |
| `off` | do not record at all |

`observe` is the tool for onboarding a new app or riding out an
incident. **It is not a resting state.** An audit log with silent gaps
is worse than no log, because the gaps are invisible from inside the
log itself — nothing in it says "three settlements are missing." What
makes them visible is `decisionLog.describe()`, surfaced on each
recording app's own `/api/health`:

```json
"decisionLog": {
  "mode": "observe", "url": "http://localhost:8819",
  "recorded": 0, "missed": 1,
  "recentMisses": [
    { "route": "POST /api/sports/events/:eventId/settle",
      "reason": "fetch failed", "at": 1787824688498 }
  ]
}
```

Without that block wired in, `observe` degrades to `off` silently. It
was built, left unwired, and caught only by putting a real service into
`observe` with vaco-audit stopped and reading the health endpoint — not
by any test.

## 3. What a row is

One row per irreversible decision. Not a metric (that is
vaco-analytics), not an alert (that is vaco-notify), not an application
log. Enough on it to answer a dispute six months later without reading
anything that has since rotated away.

```json
{
  "id": 3,
  "app": "vago",
  "route": "POST /api/sports/events/:eventId/settle",
  "outcomeKind": "settlement",
  "subjectType": "sportsEvent",
  "subjectId": "E1",
  "decidedBy": "ada",
  "decidedByKind": "service",
  "inputs": { "winningOutcomeId": "home", "serviceToken": "[redacted]" },
  "reason": "final score 112-104",
  "recordedByService": "vago",
  "recordedAt": 1787824594947
}
```

**`decidedBy` is required and has no default.** That is the point of
the whole service. Defaulting it to `system`, or to the calling
service, would produce a log that looks complete and answers nothing —
worse than no log, because someone will trust it.

**`outcomeKind` is a closed vocabulary** of six values: `settlement`,
`grade`, `credential`, `enforcement`, `state-change`, `reversal`. A
free-text `action` field would drift into a hundred spellings of the
same six things and make the log unqueryable, which is the failure mode
of every audit table that gets built and then never read.

**`decidedBy` is a claim; `recordedByService` is a fact.** The body can
say anything about who decided. The credential that carried the record
cannot be forged the same way. Keeping both means a mismatch is
findable later even though only one of them is trusted today — a row
where a `vago` token reports a decision made by a VOID operator is
worth looking at.

## 4. Three properties that are structural, not promised

**Append-only.** There is no update and no delete — not in
`lib/decisions.js`, and no `PUT`/`PATCH`/`DELETE` anywhere in
`server.js`. Leaving the verbs unimplemented is a stronger guarantee
than implementing them behind a guard. A test asserts the module's
exported surface contains no `updateDecision`/`deleteDecision`/
`amendDecision`/`purge`, so adding one is a test failure rather than a
review question. A separate service rather than a table inside each app
is what makes *"the audited party cannot rewrite it"* a property of the
architecture instead of a policy.

**Redaction happens on the way in.** A caller can be careless and put a
token, password or auth header in `inputs`. Because the store is
append-only, a captured secret could never be taken back out — so keys
matching `/(token|secret|password|credential|authorization|apikey|
api_key)/i` are replaced with `[redacted]` *before* anything is
written, recursively, arrays included. Verified live: a settlement sent
with `"serviceToken": "tok-vago-SECRET"` in the body stores
`"[redacted]"`, the plaintext appears nowhere in `data/store.json`, and
the neighbouring non-secret fields survive intact.

**Oversized inputs are refused, not truncated.** A silently truncated
record reads as complete. Over 4096 bytes the record is rejected with a
message telling the caller to record identifiers, not payloads.

## 5. Who may write to it

`POST /api/decisions` carries **`requireCallingService()`** on top of
the app-level `serviceAuth` mount. The mount is necessary and not
sufficient, and the difference matters here more than anywhere else in
the tree:

`serviceAuth.middleware` accepts *either* a service credential *or* a
user session — `if (kind === 'user-session') return next()` — because
on a normal app a logged-in person is a legitimate caller. On this one
they are not. Without the route-level guard, any account holder with a
Bearer token could post fabricated rows naming whoever they liked in
`decidedBy`, into a log that is append-only by design and therefore can
never be cleaned up afterwards. **Poisoning the evidence is the one
attack this service has no recovery from.**

This is the fourth guard shape from
`dev-docs/ROUTE_AUTHORIZATION_AUDIT.md` — *refuse the logged-in user,
do not require them* — and it was found by `scripts/audit-route-guards.mjs`
flagging the route, not by reading the code.

Verified live, with a genuine Shield session:

```
POST /api/decisions  (Authorization: Bearer shield_mallory_…)
  -> 403 requireCallingService: … requires a service credential …, not a user session
```

The **403** rather than a 401 is the proof: serviceAuth admitted the
session as a valid caller, and the route-level guard is what refused
it. Without that one line the same request returns `201`.

## 6. What is recorded today

27 routes across seven apps — group 2 of the scope doc, and
deliberately not every app holding a service credential. An app that
only reports telemetry has nothing to attribute.

| app | routes | outcome kinds recorded |
|---|---|---|
| void | 7 | `credential`, `enforcement` |
| vago | 6 | `settlement`, `grade`, `state-change` |
| hvntz | 4 | `settlement`, `grade`, `enforcement` |
| vulture-studios | 4 | `settlement`, `state-change` |
| vulture-music | 3 | `settlement`, `state-change` |
| voken | 2 | `settlement`, `grade` |
| vaco-shell | 1 | `reversal` |

The client is `shared/decisionLog.js`, synced to those seven as
`lib/decisionLog.cjs` by `sync-shared-runtime.sh` — see
`DECISION_LOG_TARGETS`.

### Reading it during a dispute

```
GET /api/history/:subjectType/:subjectId   # the timeline, oldest first
GET /api/decisions?app=&outcomeKind=&decidedBy=&since=&until=
GET /api/decisions/:id
GET /api/coverage
```

`/api/history` is first-class rather than a query the caller has to
compose correctly, because *"what has ever been decided about this
thing"* is the shape a dispute actually arrives in. It reads forwards,
as a timeline. A numeric `subjectId` and its string form are the same
subject — route params arrive as strings and lib functions hand back
numbers, and a log that filed those separately would silently split one
thing's history in two.

## 7. What this does not answer yet

**Every row says `decidedByKind: "service"`.** Today the log's answer
is *"a service token decided this, and here is which one"* — strictly
better than the previous answer of nothing at all, and still not a
person. `GET /api/coverage` reports `operatorCoveragePercent`, which is
**0% by construction** right now and is the honest progress metric for
the operator-role work in `OPERATOR_ROLES_SCOPE.md`. When operator
credentials arrive, the same rows start carrying `operator`, and the
difference is queryable — which is how you find the routes that were
never migrated.

**The log records attempts, not only outcomes.** Because the record is
written *before* the decision runs, a settlement that is then rejected
by validation still leaves a row. This is correct — an attempted
settlement is worth knowing about — but it means a reader must not
assume every row implies money moved. Cross-reference V3 for that. The
live verification above produced exactly this: three rows for
`sportsEvent/E1`, of which the first two were rejected attempts and
only the third settled.

**It is a single node with a `data/store.json`.** Same durability
posture, and the same backup obligation, as every other persisted app —
see `dev-docs/DISASTER_RECOVERY.md`. An append-only log is only as
append-only as its disk.

**Nothing reads it automatically.** There is no alerting on a
suspicious pattern, no reconciliation against V3, no UI. Those are
worth building and none of them are built.

## 8. Deploy notes

`VACO_AUDIT_URL` and `VACO_AUDIT_MODE` are wired by
`deploy/generate-docker-compose.js`, derived from source rather than
listed by hand. Two derivation bugs were found and fixed while wiring
this up, both worth remembering because both fail silently:

- The generator scanned `lib/*.js` only. Every module
  `sync-shared-runtime.sh` copies lands as **`.cjs`** (the two ESM apps
  parse a bare `.js` as ESM), so it read none of shieldAuth,
  serviceAuth or decisionLog. `VACO_AUDIT_URL` lives in
  `lib/decisionLog.cjs` and nowhere else — which would have shipped
  seven containers pointing their decision log at `localhost:8819`,
  which inside a container is *itself*.
- The same scan tested `includes("VACO_SERVICE_TOKEN")`, which
  substring-matches `VACO_SERVICE_TOKENS` — the *allowlist* a verifier
  reads. Verifier and caller are different roles needing different
  variables, and conflating them meant pure verifiers like vaco-audit
  were issued a caller token they never present, while 21 of the 22
  apps running `createServiceAuth()` got **no allowlist at all**. An
  empty allowlist is not permissive: `classify()` returns
  `unauthenticated` for every credential it cannot find, so in
  `enforce` those containers would 401 every mutating server-to-server
  call while looking perfectly healthy.

`VACO_AUDIT_MODE` is generated with a `:-enforce` default rather than
`:?`, because `observe` is the documented lever for riding out an
outage and has to be reachable without editing a generated file.
