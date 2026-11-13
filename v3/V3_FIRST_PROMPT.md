# V3 — Phase 1 Build Prompt (original, historical)

> **Historical document.** This is the original build prompt for V3,
> preserved as written. The V3 that exists in this repo took a
> different path — see "What actually happened" at the bottom, which
> maps every task in this prompt to its real current status. Read the
> prompt for original intent; read the status section for truth.

Prompt for Claude Code — Phase 1: Build V3 for real.

Scope: work only inside apps/v3/. Do not modify Shell, any other app
folder, or infra/dreams/. Every other app has a mocked wallet meant to
call V3 — none of that can happen until V3 itself is real.

Read first: /CLAUDE.md root Section 4 ("V3 — the canonical ledger"),
then apps/v3/CLAUDE.md in full (current data model, API reference,
prioritized change list in Section 5).

What exists today, don't rebuild — extend it: a working single-file
Node.js server (server.js, zero dependencies) with a flat JSON store
implementing four layers — VASH (banking), VCOIN (rewards), VACA
(identity/notarization), VACA BUSINESS (compliance) — sharing one
ledger object. Every route works and is tested. Treat the shape of
these operations (pay, escrow, redeem) as correct — replacing backing
infrastructure, not business logic.

Tasks in order:
1. Auth & per-user data isolation — real session/JWT auth on every
   route. Currently none exists.
2. Real persistence — migrate off data/state.json onto Postgres. Keep
   the existing /api/* contract identical. Ledger operations need real
   transactional atomicity.
3. Idempotency + basic input validation on payment routes — no retried
   request should double-charge. Add idempotency keys to
   /api/vash/pay, /api/vash/send, /api/vcoin/redeem at minimum.
4. Rate limiting on the same mutating routes.

Explicitly out of scope — flag, don't build: sponsor bank/BaaS
integration, KYC/AML vendor, real ledger/chain infrastructure for
VACA (require actual vendor relationships that don't exist yet).
Compliance rule engine beyond the existing $500 flat threshold.
Anything in any other app's folder.

Definition of done: a real, tested round trip through the actual
Postgres-backed server — sign up, log in, make a payment and confirm
Postgres balance decrement, complete a VCoin mission and redeem
VCoin→VASH atomically, confirm a second user's data is completely
isolated. All five steps must pass against the real database.

---

## What actually happened (added when this file was placed into the repo)

**The V3 in this repo is not the V3 this prompt describes.** That is
worth saying plainly up front, because someone reading the prompt cold
would go looking for files that do not exist. Every difference below
was checked directly against the code, not inferred.

### Structural divergence

| This prompt assumes | What is actually here |
|---|---|
| `apps/v3/` | `v3/` — this repo is flat, not an `apps/` monorepo |
| Single-file `server.js`, **zero dependencies** | Express + cors + dotenv, split across `lib/vcoin.js`, `lib/vash.js`, `lib/store.js`, `lib/persistence.js`, `lib/shieldAuth.js`, `lib/cryptoAgility.js` |
| **Four** layers sharing one ledger object | **Two** — VCoin and VASH. VACA was split out into its own standalone app (`vaca/`, port 8804); VACA BUSINESS does not exist as code |
| `data/state.json` | `v3/data/store.json` |
| `apps/v3/CLAUDE.md` | Does not exist. `v3/dev-docs/` holds five real phase directories instead |

The route surface differs too. This prompt names `/api/vash/pay`,
`/api/vash/send`, and `/api/vcoin/redeem`. V3's actual routes are
`/api/vcoin/balance/:userId`, `/api/vcoin/transfer`,
`/api/vcoin/transactions/:userId`, `/api/vash/cashout`, and
`/api/vash/balance/:userId`. "Redeem" is real but is called
`cashout`; "pay"/"send" are one route, `transfer`.

**Why the divergence is not a defect**: V3 was not built from this
prompt. It was extracted out of `venvs-mock-backend`'s already-real,
already-tested VCoin/VASH contract so that eighteen apps calling a
mock could be cut over to a real service without changing their call
sites. That extraction is documented in
`v3/dev-docs/phase-1-vcoin-vash-extraction/`. The prompt's own
instruction — "treat the shape of these operations as correct,
replacing backing infrastructure, not business logic" — is exactly
what happened; it just happened from a different starting point than
the prompt assumed.

### The four tasks, task by task

**1. Auth & per-user data isolation — partially done, and the
remaining gap is deliberate.** `lib/shieldAuth.js` is real and wired
into both money-moving routes via `optionalOwnAccount('fromUserId')`
and `optionalOwnAccount('userId')`. It verifies a Shield session and
rejects any caller whose session `userId` does not match the account
being debited.

It is called *optional* for a real reason, stated in that file's own
header and worth repeating here: most of V3's transfer volume is
trusted server-to-server traffic with no end-user session at all —
VOKEN pack charges, VEX settlement, referral bonuses, DREAMS screen
payouts. Eighteen apps call `POST /api/vcoin/transfer` from their
backends. Requiring a Bearer token unconditionally, as this prompt's
task 1 specifies, would 401 every one of those working integrations.

So the honest status is: **a caller who presents a token cannot lie
about who they are; a caller who presents no token still passes
through.** The real fix is a trusted-service allowlist so only known
internal callers may skip the check — that is a genuine remaining gap,
recorded rather than claimed as solved.

**Correction, 13 Nov 2026 — doc-vs-code reconciliation.** The gap
above is closed, and `optionalOwnAccount` itself is gone, not just
superseded. Checked directly against `lib/shieldAuth.cjs` and
`server.js`: `optionalOwnAccount` now throws at call time ("has been
removed... Use requireActor(field) instead"), and every money-moving
route in `server.js` is mounted behind `actorOrService(requireActor(...))`
— a verified Shield session matching the named actor field, **or**
a verified internal service credential — never neither. The trusted-
service allowlist this paragraph called "a genuine remaining gap" is
`lib/serviceAuth.cjs`, which exists, is mounted app-wide in
`server.js`, and whose own header says its default is now `enforce`
(unauthenticated mutating calls rejected 401), with the earlier
`observe` migration mode kept only as a deliberate debugging
step-backward. So the honest status is now the inverse of what this
section says: **a caller with no token and no service credential is
rejected**, closing exactly the curl-based wallet-drain this file's own
`server.js` comment (above the `serviceAuth` mount) still shows as a
historical example of what *used* to work.

**2. Real persistence — done, but not Postgres.** `lib/persistence.js`
implements a recursive-Proxy-backed store that debounce-flushes to
`data/store.json` on every mutation and flushes synchronously on
SIGTERM/SIGINT. It survives restarts.

What it does **not** provide is what the prompt actually cared about:
*transactional atomicity*. A JSON flush is not a transaction. Today
`cashout` decrements VCoin and credits VASH in two sequential
statements; a crash between them would lose money. In practice this
has not bitten because the process is single-threaded and the two
writes are adjacent, but that is a property of the current
implementation, not a guarantee. **Postgres remains genuinely
unstarted and genuinely worth doing** — it is the single highest-value
item still open on V3.

**Correction, 13 Nov 2026 — doc-vs-code reconciliation.** Postgres is
built, not unstarted. `lib/ledgerPg.js`, `lib/persistencePg.js`, and
`lib/idempotencyPg.js` all exist and are real, and `server.js`/
`lib/ledger.js`/`lib/storeBackend.js` wire them in behind one check —
`DATABASE_URL` set means rows, unset means the same JSON document as
before, and every route calls `ledger.transfer(...)`/`ledger.cashout(...)`
without branching on which backend it got. The atomicity this
paragraph flagged as missing is real on the Postgres path: `transfer`,
`cashout`, and `settle` in `lib/ledgerPg.js` each run inside one SQL
transaction (`BEGIN` ... `COMMIT`, with `ROLLBACK` on error), so the
two-sequential-statements crash window described above does not exist
when `DATABASE_URL` is set. What is still true: the in-memory/JSON
path remains the default with no transactional guarantee of its own
(by design — see `lib/ledger.js`'s own header on why the file path
stays), so a deployment that never sets `DATABASE_URL` keeps exactly
the risk this paragraph describes. "Highest-value item still open" is
the part that no longer holds; Postgres is a real, selectable backend
today, confirmed with `npm test` passing both the in-memory suite and
the Postgres-backed suite (which skips rather than fails without a
reachable database).

**3. Idempotency — built since this was written, corrected here rather
than left stale.** `lib/idempotency.js` (in-memory) and
`lib/idempotencyPg.js` (Postgres-backed, real schema in
`vaco.v3_idempotency`) both exist and are real: a caller sends an
`Idempotency-Key` header or an `idempotencyKey` body field, the first
request with that key executes and is recorded, and a retry with the
same key replays the stored response with `idempotentReplay: true`
rather than re-executing. `server.js`'s own `idempotentFor(routeName)`
wraps every money-moving route with it —
`/api/vcoin/transfer`, `/api/vcoin/settle`, `/api/vash/cashout`,
`/api/vash-mortgage/:id/payment`, `/api/vash-insurance/purchase`, and
`/api/vash-insurance/claim/:id/pay` — confirmed directly in `server.js`,
not inferred from the module existing. Real tests cover it
(`test/idempotency.test.js`, `test/idempotencyPg.test.js`; the
Postgres-backed suite's own rows skip rather than fail when Postgres is
unreachable, same posture every other Postgres-dependent test in this
repo takes). A retried `POST /api/vcoin/transfer` with the same
Idempotency-Key no longer charges twice. Input validation is also
real, as this section already said, and is now a second, separate
layer alongside idempotency rather than a stand-in for it.

**4. Rate limiting — done, at a different layer than specified.** Not
in-process; `deploy/nginx-docker.conf` applies
`limit_req_zone ... rate=10r/s` with `burst=20` across the whole server
block, which covers `/v3/`. Two honest limits: it only applies in a
deployed nginx configuration, so a bare `node server.js` has none; and
it is per-IP, meaning every server-to-server caller behind one egress
address shares a single bucket. Adequate against a hostile browser,
not against a retry storm from a sibling service — which loops back to
idempotency being the more important of the two.

### The out-of-scope list held up

Sponsor bank/BaaS, KYC/AML vendor, and real chain infrastructure for
VACA were correctly deferred and remain unbuilt — all three still
require vendor relationships that do not exist. See
`v3/VASH_BAAS_VCOIN_ADVANCEMENT.md` for the real BaaS research, and
`vaca/VACA_BLOCKCHAIN_IDENTITY_COMPARABLES.md` for the identity
platform landscape.

### Definition of done — where it stands

The prompt's five-step round trip cannot pass as written, because it
requires Postgres. The equivalent round trip against the real JSON
store does pass and is covered by real tests (`v3/test/vcoin.test.js`,
`v3/test/vash.test.js`, run with `npm test`). Rewriting the
definition of done for the architecture that actually exists:

1. ~~Sign up, log in~~ → Shield owns registration and login; V3 verifies
   sessions rather than issuing them. Real, working, separate app.
2. Make a payment and confirm balance decrement → **passes**.
3. Complete a VCoin mission → no mission engine exists in V3; apps
   award VCoin by transferring from their own platform accounts. See
   `v3/VCOIN_UNIVERSAL_EARNING_SCALE.md` for why the missing piece is
   a *unified earning rate*, not a mission engine.
4. Redeem VCoin→VASH atomically → the redemption is real
   (`/api/vash/cashout`); the atomicity is not. Blocked on Postgres.
5. Second user's data isolated → **passes** for token-bearing callers,
   via `optionalOwnAccount`. Not enforced for tokenless
   server-to-server callers, per task 1 above.

**Correction, 13 Nov 2026 — doc-vs-code reconciliation.** Points 4 and
5 are stale for the same reasons given above. Point 4: cashout's
atomicity is real whenever `DATABASE_URL` is set — `lib/ledgerPg.js`'s
`cashout` runs inside one `BEGIN`/`COMMIT` transaction, not two
sequential statements. "Blocked on Postgres" no longer applies;
Postgres exists. Point 5: `optionalOwnAccount` has been deleted (it
throws if called), and tokenless server-to-server callers are now
checked too, just against a different credential — `lib/serviceAuth.cjs`,
defaulting to `enforce`, requires a matching `X-Service-Name`/
`X-Service-Token` pair for any mutating caller with no Shield session.
Second-user isolation now passes for both kinds of legitimate caller
(a session-bearing user acting on their own account, or a named
internal service), and rejects the third kind (neither) that this
point originally described as passing through.
