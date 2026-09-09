# Auth hardening — the unauthenticated wallet drain

**Date:** 2026-08-26 · **Severity: critical, and it was live.**
Found while doing task #120, "fix the Shield actor gap", which turned
out to understate the problem by a wide margin.

---

## 1. What the gap actually was

`COMPLETION_AUDIT.md` §3.6 recorded it, accurately as far as it went:

> **`requireSession()` does not cross-check identity.** It proves a
> valid session exists but not that it belongs to the acting user.

That describes an *authorization* gap: an attacker needs a valid session
of their own, then names someone else in the body.

The reality was worse. Ten of the twelve apps had no `requireSession` on
those routes at all. They mounted `optionalOwnAccount(field)` alone, and
its first line was:

```js
function optionalOwnAccount(bodyField) {
  return async (req, res, next) => {
    const token = /* Bearer token, or null */;
    if (!token) return next();      // <- the entire vulnerability
```

The middleware was named honestly and its own header said it was
optional. But mounted alone, it only engaged for callers who
**volunteered** a token. Sending none was the bypass.

So the real gap was not "an authenticated user can impersonate another".
It was **no authentication at all on thirteen money-moving routes.**

---

## 2. Demonstrated, not theorised

Run against this repository, servers booted normally, no special setup:

```
$ curl -s localhost:8811/api/vcoin/balance/victim-user
{"userId":"victim-user","balance":1000}

$ curl -s -X POST localhost:8811/api/vcoin/transfer \
    -H 'Content-Type: application/json' \
    -d '{"fromUserId":"victim-user","toUserId":"attacker","amount":500}'
{"transaction":{"id":138,...,"amount":500},"fromBalance":477.01,"toBalance":1500}
```

**V3 is the ledger.** Eighteen apps settle through it. That is every
wallet in the ecosystem, drainable with one unauthenticated request.

A second, independent route to the same outcome, through a consumer app:

```
$ curl -s -X POST localhost:8807/api/subscriptions \
    -d '{"userId":"victim-user","tier":"premium"}'
{"userId":"victim-user","tier":"premium","status":"active",...}
```

That charged a stranger 22.99 VCoin for a subscription they did not ask
for, with no credentials of any kind.

### Why it survived

Three reasonable-looking decisions that were only dangerous together:

1. **`optionalOwnAccount` was correctly named and correctly
   documented.** Its header explained the pass-through. Nothing lied.
2. **V3's `serviceAuth` layer defaulted to `observe`** — allow
   unauthenticated writes, record who sent them. That was the right
   *migration* default, chosen deliberately so that flipping to
   `enforce` would not 401 eighteen live integrations on deploy day.
   The migration was never finished, so the temporary default became
   the permanent one.
3. **Task #98, "Fix V3 transfer endpoint: no real authorization
   currently", was closed** — by adding `optionalOwnAccount`. The task
   was marked done and the endpoint was still open.

Each layer assumed another layer was doing the work. **Nothing tested
the composition**, which is why 464 passing tests did not catch it: every
one exercised a library function directly, and the vulnerability lived
entirely in the middleware wiring.

---

## 3. The fix

### One canonical module, synced

`shared/shieldAuth.js` is now the single source, copied into each app's
`lib/` by `./sync-shared-runtime.sh`.

**Copies rather than a shared import, because of Docker.**
`deploy/Dockerfile.node` builds with the *app directory* as its context
(`context: ./void`), so a `require('../../shared/...')` would resolve in
development and fail in the container — the worst kind of split, since
local testing would never show it. Same constraint and same answer as
the design system.

`--check` fails on drift **and** on a copy that no app requires. That
second check exists because of a lesson from the design system: a synced
file nobody imports is drift a byte comparison cannot see. For CSS that
shipped an unstyled page. For this file it would ship unauthenticated
money routes.

### Three questions, kept separate

| | Answers |
|---|---|
| `requireSession()` | Is there a live Shield session? |
| `requireActor(...fields)` | Is that session the user this request claims to act as? |
| service credentials | Is this a known internal service? (V3 only) |

`requireActor` mounts `requireSession` internally. The two were
separable before, and every route that took the first without the second
was a hole — so they are no longer separable by accident.

**`optionalOwnAccount` is removed, not deprecated.** The export throws at
mount time with a message pointing at `requireActor`. A middleware that
silently permits anonymous access should not stay available to be
reached for, or copy-pasted in from an older app.

### Why `requireActor` takes field names

Thirty-one mutating routes each name the acting user differently:
`userId`, `fromUserId`, `buyerId`, `investorId`, `authorId`, `boosterId`,
`requesterId`, `fromOwnerId`, `customerId`, `artistId`, `subscriberId`,
`creatorId`, `followerId`, `ownerId`.

A single hardcoded field would have meant renaming every API or writing
a middleware per app — and per-app middleware is precisely how thirteen
routes ended up unguarded. So the route declares its own:

```js
app.post('/api/vcoin/transfer', actorOrService('fromUserId'), ...)
app.post('/api/projects/:id/invest', requireActor('investorId'), ...)
```

Two details that are guards in their own right:

- **A body naming no actor is refused (400), not waved through.** If
  absence meant permission, the bypass would just move from "omit the
  header" to "omit the field".
- **Every named field that is present must match.** Checking only the
  first would let an attacker send a matching `userId` alongside a
  victim's `fromUserId`.

### V3: actor *or* service

Most of V3's transfer volume is server-to-server — pack-opening charges,
referral bonuses, VEX settlement — with no end-user session to present.
Requiring a session everywhere would 401 all of it. So V3 uses:

```js
function actorOrService(field) {
  const actor = requireActor(field);
  return (req, res, next) => {
    if (req.callingService) return next();
    return actor(req, res, next);
  };
}
```

`req.callingService` is set by `serviceAuth.middleware` only after a
constant-time token match, so this checks a verified fact rather than a
header the caller chose.

`VACO_SERVICE_AUTH_MODE` now **defaults to `enforce`.** All sixteen callers
send `X-Service-Name` and `X-Service-Token`; the migration `observe` was
built for is complete.

---

## 4. Coverage

| App | Before | After |
|---|---|---|
| v3 | 2 routes, bypassable | 2 routes, `actorOrService` + enforce |
| cvnvo, vago, vavlt-stvdios, voidmagic, vulture-flix, vulture-music, vulture-pods, vulture-studios | 1 each, bypassable | `requireActor` |
| voken | 2, bypassable | `requireActor` + 4 trade routes newly guarded |
| vxllage | 31 `requireSession`, 2 with an actor check | 27 `requireActor`, 4 ownership-lookup guards |

**VOKEN's four trade routes were found later**, while writing its money
tests (task #121), and they were worse than the `optionalOwnAccount`
routes: they had **no auth middleware of any kind**.
`POST /api/trade/:id/accept` took only a trade id and transferred card
editions in both directions, so anyone who knew an id could execute
someone else's trade. `POST /api/trade` took `fromUserId` from the
body, so anyone could propose a trade *as* another user.

Propose now uses `requireActor('fromUserId')`. Accept, reject and
cancel cannot: they identify the acting party by looking the trade up,
not from a body field. Those use `requireTradeParty(side)` — a session
first, then a check against the party the *stored record* says is
entitled to act. **That is the same ownership-lookup shape vxllage's
remaining four routes need**, so the pattern now exists in the codebase
rather than only in this document.

**vxllage's four ownership-lookup routes — closed.** These were
recorded here first as a known limitation, then closed once the pattern
existed. `/api/village-events`, `/api/channels`,
`/api/newsletters/send` and `/api/surface-links` take no acting-user
field, so `requireActor` cannot cover them; the acting party is whoever
the stored record says owns the thing being touched.

| Route | Guard | Boundary |
|---|---|---|
| `/api/village-events` | `requireVillageMember` | a non-member scheduling events in your community is the abuse |
| `/api/channels` | `requireVillageOwner` | a channel is village *configuration*, so one notch tighter than an event |
| `/api/newsletters/send` | `requireArticleAuthor` | mails an article to every subscriber — anyone else doing it spends the author's credibility with their audience |
| `/api/surface-links` | `requireSourceSurfaceOwner` | resolves post/article by `authorId`, village-room by `ownerId`; an unknown surface type is refused, so a new type must be taught to the resolver before it can be linked from |

Verified live with two real Shield sessions: Mallory gets 403 on every
one of ada's resources, ada gets 201 on her own, unauthenticated is 401.

---

## 5. Verified

Re-run after the fix, against a live ecosystem:

| | Result |
|---|---|
| Unauthenticated V3 transfer | **401** — `serviceAuth` refuses |
| Unauthenticated flix subscribe | **401** — `requireSession: missing Authorization` |
| Victim's balance | **unchanged** |
| Real user moving their own money | **201** — succeeds |
| Real user naming someone else | **403** — `session belongs to a different user` |
| User action settling via service credential | **succeeds** — 975 → 952.01 |
| All suites | **477/477** |
| All frontends | **30/30** in a browser |

`v3/test/shieldAuth.test.js` (13 tests) is written as "the attack
fails", not "the happy path works": no header, malformed header, forged
token, impersonation, the matching-decoy-field case, a missing actor
field, and Shield being down — which must be **502, never 401 and never
a pass**, since failing open there would make a denial of service
against Shield a way in.

---

## 6. What this does not fix

- **Read routes are not gated.** `GET /api/vcoin/balance/:userId`
  discloses any account's balance to anyone. Lower severity than the
  write path, and unchanged here.
- **Shield's own session store.** These changes trust Shield; they do
  not audit it. Its persistence posture is still flagged in
  `COMPLETION_AUDIT.md` §3.3.
- **Rate limiting is at nginx, not in the apps.** Direct-to-port access
  bypasses it, so the container ports should not be publicly reachable.
- **No audit log.** There is no record of who authorized what. The
  transaction log records the money, not the credential that moved it.

---

## 7. Deploying

```bash
node scripts/generate-service-tokens.mjs --write   # writes .env, both sides consistent
node deploy/generate-docker-compose.js
docker compose up -d
```

The generator reads the same manifest as everything else and derives the
caller list from source, so the allowlist and the sixteen per-caller
tokens are consistent by construction rather than by careful copying.
Every token is marked `:?` in the compose file — a missing one stops the
stack at `up`, rather than at the first settlement.

For local development `./start-ecosystem.sh` generates a fresh dev token
per boot. Per-boot rather than fixed, because a checked-in dev token is
the kind that reaches production by accident.
