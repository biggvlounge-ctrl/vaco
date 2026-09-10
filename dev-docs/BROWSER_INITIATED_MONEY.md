# Browser-initiated money: what a client may instruct, and what it may not

**Status:** the boundary is enforced in code. The backend that would
supply the other half does not exist yet, so four flows currently
refuse rather than half-settle. This document is what the refusal
messages point at.

---

## The finding

VDP and VENVS are Vite frontends. Their commerce modules —
`vdp/src/lib/chopz.js`, `venvs/src/lib/marketplace.js`,
`venvs/src/lib/catalog.js`, `venvs/src/lib/shop.js` — hold their state
in React `useState` and move **real V3 money** from the browser.

Some of that is legitimate. A buyer paying for a book, a tenant paying
rent: V3's `/api/vcoin/transfer` is `actorOrService('fromUserId')`, so
a user's Shield session authorises a movement out of that user's own
account. A browser may instruct those.

The rest is the platform paying out — a seller's share, an author's
royalty, a shift payout. **A browser must never be able to instruct
those, and no credential fixes it.** A client that could authenticate
as the platform is a client that could drain the platform.

### The sharp case

`runShift` in `vdp/src/lib/chopz.js` moved 15 VCoin **from the platform
account to the signed-in user**. Its only rate limit was a cooldown
stored on the unit — in the real app, React state, cleared by a page
reload.

Had the browser ever been given a credential that satisfied V3, that
was an unbounded money printer: reload, run a shift, repeat. The fix is
not a better cooldown. It is that a browser cannot instruct the
movement at all, whatever it holds.

### Why nobody noticed

These flows were failing anyway, for a different reason.
`venvs/src/lib/v3Client.js` sent `Content-Type` and nothing else — no
`Authorization`, no service credential — so against the real V3 every
VENVS purchase got **401 before authorization was even considered**.
They only ever appeared to work against `venvs-mock-backend`, which has
no auth at all.

VDP had the same bug and had already fixed it: `vdp/src/lib/shieldAuth.js`'s
`sessionHeaders` exists precisely for this, and its own header describes
it as "a session that is acquired, validated, stored, and then not
used." VENVS was never given the same treatment. It has been now.

---

## The boundary, as enforced

Two injected functions, because two different authorities:

| | moves | authorised by | supplied by |
|---|---|---|---|
| `transferFn` | the **user's own** money | their Shield session, matched against `fromUserId` | the browser |
| `payoutFn` | the **platform's** money | a service credential | a backend — nothing else |

`requirePayoutFn` lives in each module and throws when a payout is
attempted without one. No component in either app supplies a
`payoutFn`, and none should.

**A flow with any platform leg refuses entirely rather than settling
half.** Charging the buyer and not paying the author is precisely the
partial-settlement defect the ecosystem-wide sweep removed everywhere
else; reintroducing it here to keep a demo working would be the worst
of both. `checkout` and a royalty-bearing `purchaseBook` therefore
refuse **before** charging anyone.

### What works today, and what refuses

| Flow | Legs | Status |
|---|---|---|
| VENVS Shop `buyNow` | buyer → platform | **works** — single leg, buyer-funded |
| VENVS `purchaseBook`, Ingram title | buyer → platform | **works** — no author-side royalty |
| VDP `leaseUnit` | tenant → platform | **works** — buyer-funded |
| VENVS `purchaseBook`, self-published | buyer → platform, platform → author | refuses |
| VENVS `checkout` | buyer → platform, platform → each seller | refuses |
| VDP `runShift` | platform → user | refuses |
| VDP `collectEarnings` | platform → user | refuses |

The three that work now work *properly* for the first time — the
session token reaches V3, so its guard engages instead of 401ing.

---

## What closing this actually needs

Not a refactor. These modules keep their state in the browser, so
there is no server-side state for a payout route to be built on. A
backend for these flows has to own:

1. **the state** — carts, catalogs, leased units, cooldowns. A cooldown
   the client holds is not a limit.
2. **the rule** — the seller split, the royalty band, the elapsed-time
   AI income calculation. If the browser computes the amount and the
   backend pays it, the backend is a rubber stamp.
3. **the settlement** — one atomic `POST /api/vcoin/settle` per order,
   the same shape every other app in the ecosystem now uses.

That is three real backends, or one commerce service the two apps
share. It is a design decision, and it is deliberately not made here.

`venvs-mock-backend` is **not** the answer: its own header says it
stands in for V3 and Shield "in the real ecosystem these are two
distinct services VENVS depends on", it has no auth, and both services
it stood in for are now real.

---

## Where this is tracked

`scripts/audit-settlement-atomicity.mjs` lists these files under
`BROWSER_INITIATED`, so the sweep's remaining count stays honest about
what is unconverted and why. That list re-earns itself: a parked file
with no transfer calls left fails the run as a stale exemption.
