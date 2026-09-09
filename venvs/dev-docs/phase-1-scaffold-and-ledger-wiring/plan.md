# Plan — Phase 1: Scaffold + wallet/auth wiring

## Goal
`VENVS_CLAUDE.md` describes an existing single-file MVP
(`src/App.jsx`, ~2,500 lines) whose source isn't in this session —
confirmed with the user directly rather than assumed, and confirmed
this is a fresh build, not a handoff of existing code. §7's suggested
build order is written for that handoff scenario ("split App.jsx into
modules" as step 2); adapted here for greenfield: build it already
split, and start with what the brief itself calls "the single
highest-leverage change" — wiring the wallet to V3 and auth to Shield
— rather than the walkable-world UI, since per §0 nearly every other
feature (real leaderboards, real CHOPZ payouts, real Digital Twin earn
boosts) depends on money actually being real first.

## Real constraint, same pattern as this session's other builds
V3's real source and its exact API surface are both referenced in
`VENVS_CLAUDE.md` ("see V3's CLAUDE.md for the exact API surface") but
that document wasn't provided, and neither V3 nor Shield exist
anywhere in this session. Built `venvs-mock-backend/` — a real,
running Express service implementing a real, inferred, minimal
contract for both — rather than hardcoding fake values inline. This is
a step further than this session's other stubs (world-layer's
`fetchUnescoSites()`, vaco-analytics' ClickHouse note): here, a
*consumer* genuinely needed something to talk to in order to prove the
wiring works at all, so the "real, working substitute" is a running
service, not just a documented gap.

## Design
- `venvs/` — Vite + React 18, matching `VENVS_CLAUDE.md` §3's stated
  stack exactly (plain CSS-in-JS, `lucide-react`, no state library,
  no Tailwind).
- `src/lib/v3Client.js` — the wallet client. Per §0.1's explicit
  instruction ("Don't build VENVS its own accounting system"), this
  module contains **zero balance math** — every number is fetched from
  the ledger service. `getVCoinBalance`, `transferVCoin`,
  `getVCoinTransactions`, `cashOutToVash`, `getVashBalance`.
- `src/lib/shieldAuth.js` — the auth client. Per §0.2, session state
  lives in a Shield-issued token, not a VENVS-specific login system.
  `login`, `getCurrentSession`, `logout`. The session token itself is
  still cached in `localStorage` (there's nowhere else for a browser
  tab to keep it), but the token's *validity* is always re-checked
  against the session service, not trusted locally.
- `src/lib/persistence.js` — explicitly scoped to **exclude** wallet
  and auth state now that both have real homes; documented as
  "whatever's left" (UI prefs, camera position, etc.) rather than the
  do-everything `localStorage` layer the brief describes as the
  current (pre-this-phase) state.
- `venvs-mock-backend/server.js` — one process standing in for two
  real, separate ecosystem services (V3 + Shield), clearly documented
  as such in its own header. Inferred contract:
  - Shield: `POST /api/shield/session` (login), `GET
    /api/shield/session/:token` (validate).
  - V3 VCoin: `GET /api/vcoin/balance/:userId`, `POST
    /api/vcoin/transfer`, `GET /api/vcoin/transactions/:userId`.
  - V3 VASH: `POST /api/vash/cashout`, `GET /api/vash/balance/:userId`.
  - `VCOIN_TO_VASH_RATE = 0.01` and `STARTING_VCOIN_BALANCE = 1000` are
    both invented, flagged as such — no real rate or starting balance
    is specified anywhere.
- `src/App.jsx` — a Phase 1 smoke-test shell only (login button →
  real balances → a real cash-out button), not any of the actual
  analog/digital-mode UI. Proves the wiring works before any gameplay
  is built on top of it.

## Verification approach
This is the first *frontend* work in this session — per this
environment's standing instruction, UI changes get verified with a
real running dev server in an actual browser, not just unit-level
checks. Installed Playwright temporarily (scratchpad only, not part of
the repo) against the pre-installed Chromium, drove the real app
through `npm run dev` + a real running `venvs-mock-backend`: login,
balance display, a real cash-out click, balance update, logout — all
through actual clicks and actual network requests, screenshotted at
two points for a visual record.

One real bug caught in this pass: the first verification script
asserted the wrong expected VASH amount after a 100-VCoin cashout
(hardcoded `5`, copied from an earlier `curl` test that used 500
VCoin) — at the real 0.01 rate, 100 VCoin correctly yields 1 VASH. The
mismatch was in the *test's* expectation, confirmed by inspecting live
network responses and DOM state directly rather than assuming either
side was correct; the app and mock backend were both right. Fixed the
assertion, re-ran clean, all 8 checks passed.

## Explicitly NOT in this task
- No analog-mode UI (Shop, Marketplace, Publishing, VEX, VADO) — the
  3 new feature docs (Shopify integration, Publishing addition,
  Digital Planet comparables) land in later phases.
- No digital-mode walkable world, CHOPZ, NPCs, jobs, quests — all of
  §4's feature inventory beyond the wallet/auth shell.
- No `App.jsx` splitting into per-district modules — nothing exists
  yet to split; that structure gets built into each later phase
  directly instead.
- No real V3/Shield — see constraint above.

## Done when
- `venvs-mock-backend` correctly implements both contracts, verified
  live via `curl`: session issue/validate, balance read, transfer
  (with insufficient-balance and bad-input rejection), transaction
  history, cashout (with insufficient-balance rejection), VASH balance
  read.
- The real Vite dev server boots and serves the app.
- A real browser session (Playwright + pre-installed Chromium) can:
  log in, see a real fetched VCoin/VASH balance (not hardcoded),
  successfully cash out through a real click triggering a real network
  write, see the balance update correctly, and log out correctly.
- No unexpected console/page errors during the flow (the one 404 is a
  missing favicon, harmless and unrelated to the wiring being tested).
