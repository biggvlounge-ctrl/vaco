# Standing instruction — test the composition, not just the units

**Status:** permanent, alongside
`dev-docs/STANDING_INSTRUCTION_ONGOING_EVALUATION.md`. Not a fix that
was applied once.

---

## The observation

Three separate security bugs in one session had the same shape, and it
was not the shape anyone was looking for.

| | What was wrong | Where it lived |
|---|---|---|
| The wallet drain | `optionalOwnAccount` mounted alone on 13 money routes; it calls `next()` when no token is present | route wiring |
| VOKEN's trade routes | four routes with no auth middleware at all — accept transferred card editions in both directions | route wiring |
| vxllage's four | `requireSession()` where an ownership check was needed | route wiring |

**None of them was a logic bug.** Every library function involved was
correct in isolation and had, or could have had, a passing unit test.
`optionalOwnAccount` did exactly what its name and its own header said.
`acceptTrade` correctly re-checked ownership before transferring. The
vulnerability in each case was **which middleware was mounted on which
route** — a fact that lives in `server.js` and in nothing else.

**464 tests were passing while an unauthenticated request could drain
any wallet in the ecosystem.** Every one of those tests called a
library function directly. Not one of them sent a request.

That is the category.

---

## Why unit tests structurally cannot catch it

A unit test imports a function and calls it. Middleware is not in that
path. So the entire class of question —

- *is this route guarded at all?*
- *is it guarded by the right thing?*
- *does the guard run before the work, or after it?*
- *does the guard engage when the attacker declines to cooperate?*

— is invisible to the test suite by construction, no matter how many
unit tests exist. Adding more of them does not asymptotically approach
catching it. The coverage number goes up and the hole stays open.

The last question is the sharpest one. `optionalOwnAccount` **passed**
every scenario a test author would naturally write: valid token acting
as self, valid token acting as another. The bypass was *sending no
token*, which is not a case that occurs to someone writing tests for an
auth middleware, because it does not look like an attack. It looks like
a mistake.

---

## What to do about it

### 1. When you add or change a route, ask the composition questions

Not "does the handler work" — that is what the unit test is for:

- What does this route change, and whose is it?
- If the body names a user, is `requireActor` on it? If it names a
  *thing*, is there an ownership lookup?
- Does the guard run **before** anything expensive or irreversible? A
  gate checked after settlement is not a gate. VEX's compliance gate is
  tested for exactly this: *"the gate is checked before the card is
  even fetched."*
- **What happens if the caller supplies nothing?** Absence must never
  read as permission. Every one of the three bugs above reduces to
  some version of that sentence.

### 2. Test at least one route per app through HTTP

Not every route — that is a different, larger job. One is enough to
prove the wiring is exercised at all, and it converts "the middleware
is mounted" from an assumption into an assertion.

`v3/test/shieldAuth.test.js` is the model: it drives the middleware
with a fake req/res and asserts **the attack fails** — no header,
malformed header, forged token, impersonation, a matching decoy field
alongside a victim's, a missing actor field, and Shield being down.
Every test is a refusal.

### 3. Write the test as the attack, not the feature

"A subscriber can watch" and "a non-subscriber cannot" are not
symmetric. The first passes whether or not the check exists. Prefer:

```js
test('no Authorization header is 401 — this is the bypass that used to be a 201', ...)
test('a matching decoy field does not launder a mismatched one', ...)
test('a body that names no actor at all is refused, not waved through', ...)
```

### 4. Run the exploit

The V3 drain was found by typing the curl, not by reading the code —
and it had been read many times, including by whoever wrote the header
that described the pass-through accurately. When a guard is in
question, send the request. It takes a minute and it does not
rationalise.

**Two ways an exploit script lies, both seen since:**

- **It talks to the wrong process.** A VSAFE/CVNVO run reported guards
  not firing; the guards were correct and a stale server from an
  earlier boot still held the port. Restart, confirm the version you
  are testing, *then* read the result. Here it failed safe — it made
  correct code look broken — but the same mistake in the other
  direction makes broken code look fixed.
- **It asserts on a status.** `200` means the request was accepted, not
  that the right thing happened. Where money moves, read the balance:
  the VACAY rental settlement check confirmed the owner's V3 balance
  went 1000 → 1024 on the legitimate call and did **not** move on the
  stranger's. A status stays correct while money goes wrong.

### 4a. Boot the thing

Three apps in the authorization sweep passed `node --check`, passed all
522 unit tests, and crashed on `npm start`:

```
ReferenceError: Cannot access 'createServiceAuth' before initialization
```

The require sat below the `app.use()` that consumed it. **No unit test
in this repo starts a server**, so nothing in the suite could see it.
`./start-ecosystem.sh` and reading the `N up, M down` line is a
ten-second check that covers a class of error the entire test suite is
blind to.

### 4b. Enforcing breaks callers — check them in the same change

Every app that starts refusing anonymous writes breaks whoever was
making them anonymously. CVNVO's six calls into VSAFE had to gain a
service credential in the same commit that closed VSAFE, or the whole
safety integration would have begun 401ing. Again: no unit test in
either app could see it, because neither sends a request.

Worse, the failure can predate the change and be invisible until it.
VDP has held a real Shield session since SSO was built and **never
attached it to a request** — so its Village district had been getting
401s from vxllage since vxllage's pass, unnoticed, until CVNVO's sweep
made the Dating Village fail the same way. Before mounting a guard,
grep for who calls the app.

### 5. Measure it, then require every route to account for itself

`scripts/audit-route-guards.mjs` answers the reviewable question below
mechanically, per route, across every app — because the answer lives
entirely in the argument list between the route path and the handler,
and nothing about the domain logic changes it. `--check` runs in CI and fails
if **any** mutating route is neither guarded nor declared open with a
stated reason:

```js
// audit-route-guards: open -- no actor exists; this route creates the session
app.post('/api/shield/login', ...)
```

That replaced a baseline ratchet. The ratchet was the right tool while
45 routes were open with no way to say *why* — but "do not get worse"
would have let the next 45 in one at a time, and a number that only has
to not rise never has to reach anything. The reason string is
mandatory; a bare `open` is refused, because that is how this becomes a
rubber stamp.

It proves a route has *some* guard, never that it has the right one.
`requireSession()` where an ownership lookup belongs still counts, and
that was a real bug. What it does is shrink the set a human has to
think about, and keep it shrunk.

**The tool was wrong twice before it was right, and both errors are the
lesson.** It scanned only `app.` and so reported *zero routes* for
VACAY, the app with the most money-moving routes — an audit that
silently reports zero is worse than no audit. And it matched a
hardcoded list of guard-name suffixes, so it reported six real guards
as missing the moment new names appeared for the same idea. A list that
must be extended every time someone writes a guard will be wrong; match
the convention (`require<Something>(`) instead.

### 5a. Four shapes, not two

The sweep across nine apps needed four, and the two beyond the obvious
ones carried most of the risk:

| Shape | Guard |
|---|---|
| the body names the actor | `requireActor(field)` |
| the path names the actor | `requireParamActor(name)` |
| the path names a **thing** | resolve it, compare its stored owner |
| the route decides an **outcome** | `requireCallingService()` |

**The fourth inverts the instinct and is worth internalising.** On
`POST /api/sports/events/:id/settle`, `requireActor` is exactly wrong:
it confirms the caller is a real logged-in user, which is the problem
rather than the solution. A player who can settle the event picks who
won. Same for grading your own bet, approving your own ad, posting your
own revenue events, drawing the raffle you entered.

**Its sharpest form is a credential.** VOID's `cannabisDelivery` and
`medicalTransportation` gates require a *verified* skill and a sighted
licence — and both the verify route and the vetting route were open, so
a stranger self-certified into a licensing-gated vertical in four
unauthenticated requests. `recordVetting` already demanded a
`verifiedBy` on the stated grounds that "a result nobody can be traced
back to is not evidence", and was accepting `verifiedBy: "me,
obviously"`.

The rule that fell out of it generalises past VOID:

> **A claim may be self-service. A credential never is.**

Wherever an app distinguishes *asserted* from *verified* — a skill, a
badge, a grade, a KYC level, an authenticity rating — find the route
that moves a record across that line and check it is not reachable by
the record's own subject. And check the same for suspension in both
directions: nobody lifts their own, nobody imposes one on a rival.

Ask not only *"whose is this?"* but *"is this a decision the parties
must not be allowed to make?"* — and where the answer is yes and the
app has no operator role yet, refuse everyone rather than accept
anyone.

### 5b. Middleware order IS composition

`app.use(x)` applies only to routes registered **after** it. VOID's
`serviceAuth` mount was first written next to its guard helpers, two
thirds down a 1500-line server — which reads perfectly well and is
wrong: seventy-odd routes defined above it would have skipped the
middleware entirely.

What makes this one nasty is that **nothing looks broken**. The
per-route guards still fire, so the app boots, the tests pass, and the
routes split silently into two groups: the ones relying on
`req.callingService` refuse everyone forever, and the rest accept
anonymous callers. Neither failure announces itself.

So when reviewing a diff that adds an `app.use()`, the question is not
"is this the right middleware" but **"what is above it?"** Mount
app-level guards immediately after the body parser and the store, above
the first route, and say why at the mount.

### 5c. A rewrite that matches nothing reports success

Same class as a middleware that guards nothing: the failure is silence,
not an error.

Adding `vaco-shell` to `SHIELD_TARGETS` used a `str.replace()` whose
pattern no longer matched a since-extended line. It matched nothing,
changed nothing, and exited 0. `sync-shared-runtime.sh --check` then
said *"all 43 copies current and in use"* — **truthfully**, because the
app was never in the list to be checked. It surfaced two steps later as
`ERR_MODULE_NOT_FOUND` at boot.

The rule, for any scripted edit across the repo:

> **Assert the pattern exists before replacing it.** A `replace` whose
> match count is zero is a failed edit, not a no-op.

```python
assert old in s, f'pattern not found: {old[:40]}'
s = s.replace(old, new)
```

This applies to every scripted rewrite in this repo — the guard sweeps,
the Cvltvre rename, the target lists — and it is cheap. Every route
guard applied in the authorization sweep went through a helper that
counted matches and printed `NOT APPLIED` on anything other than
exactly one; the one edit that skipped that discipline is the one that
broke.

### 5d. The general rule: a tool that finds nothing must not report success

§5c is one instance. After it happened a second time — two deploy
generators scanning `lib/*.js` when every shared module lands as
`.cjs` — the whole generator/scanner surface was audited as a class
rather than a series of accidents. That pass found three more live
faults, and the pattern behind all five is worth stating on its own:

> **A tool cannot tell "I did the work" from "I found nothing to do"
> unless it is written to. Whichever it cannot distinguish, it will
> eventually report as the first.**

The five, and what each one *said* while being wrong:

| tool | fault | what it reported |
|---|---|---|
| scripted `replace` | pattern no longer matched | exit 0 |
| both deploy generators | `lib/*.js` scan, modules are `.cjs` | a complete config |
| both deploy generators | `includes('VACO_SERVICE_TOKEN')` also matched the plural allowlist var | 21 verifiers wired with no allowlist |
| `backup-stores.mjs` | one directory level deep; two apps are nested | `ok`, over a snapshot missing two stores |
| `sync-shared-runtime.sh --check` | only inspects apps already in a target list | "all 53 copies current and in use" |

Four sub-shapes, each with a cheap test:

1. **A rewrite that matches nothing.** Assert before replacing (§5c).
2. **A filter narrower than the data.** `.js` when files are `.cjs`;
   depth 1 when apps nest two deep. Ask what the scan *cannot* see.
3. **A match looser than the name.** `VACO_SERVICE_TOKEN` matching
   `VACO_SERVICE_TOKENS`; `UNMANAGED` matching `UNMANAGEDX`; a lazy
   `[\s\S]*?` running past its own block into the next one — that last
   is the worst of them, because it does not no-op, it edits the
   *wrong* list. Use `\b`, and bound a class so it cannot cross the
   delimiter it belongs inside.
4. **A check scoped to what the tool manages.** The most dangerous,
   because it is *truthful*. `--check` answered "are the copies I
   manage current?" correctly while two apps held unmanaged copies
   outside its view. Every coverage check needs its mirror: not only
   "is what I placed correct?" but "is there anything I should have
   placed and did not?"

`sync-shared-runtime.sh` now carries that mirror as `UNMANAGED`, and it
found `vaco-audit` immediately.

**Verify the verifier.** `scripts/test/generator-anchors.test.mjs`
pins all of the above. It was written, passed 7/7, and then had each
fault deliberately reintroduced — and **two of the seven did not
catch their own bug**: `/UNMANAGED/` matched the renamed-away
`UNMANAGEDX`, and the block anchor still matched after its closing
paren was disturbed, because it ran on to the next list's. Both are
sub-shape 3, in the tests written to catch sub-shape 3.

> A test for this class is worth nothing until you have watched it
> fail. Reintroduce the bug; if the test still passes, the test is the
> bug.

That last rule has since been promoted out of this section: it applies
to **every test in this repo, not only this class**. See
`dev-docs/STANDING_INSTRUCTION_TEST_VERIFICATION.md`.

### 6. Make new routes secure by construction

`scripts/new-app.mjs` emits `requireActor` on its mutating route and a
first test that asserts a refusal. That is the durable half of this
instruction: the previous 30 apps converged on one shape by copying the
last one, which is why a single middleware's pass-through reached ten
of them. **A copied mistake is an ecosystem-wide mistake**, and the
factory exists so the thing being copied is correct.

---

## The reviewable form

When reviewing a diff that touches `server.js`, the question is not
"is this handler right". It is:

> **Which requests can reach this handler, and who is allowed to be
> making them?**

If the diff does not make that answerable, it is not finished — however
correct the library function underneath it happens to be.

---

## Related

- `scripts/audit-route-guards.mjs` — the mechanical form of the
  reviewable question; `--check` in CI.
- `dev-docs/OPERATOR_ROLES_SCOPE.md` — where the fourth shape leads:
  every `requireCallingService()` is a place an operator role belongs
  and does not exist yet. Not all of them, though — the inventory's
  main finding is which ones must stay machine-only forever.
- `// audit-route-guards: open -- <reason>` — how a route with no actor
  to check declares itself. The reason is mandatory; a bare `open` is
  refused. This replaced a baseline ratchet, which could only say "do
  not get worse" and would have let the next 45 open routes in one at
  a time.
- `dev-docs/AUTH_HARDENING.md` — the full write-up of the wallet drain,
  including the reproduction and why three separately reasonable
  decisions were only dangerous in combination.
- `v3/test/shieldAuth.test.js` — the reference suite for this style.
- `dev-docs/COMPLETION_AUDIT.md` §3.6 — where the gap was recorded
  accurately as far as it went, and still understated by a wide margin.
