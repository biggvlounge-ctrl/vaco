# Plan — Phase 2: ecosystem-wide Shield default cutover

## Goal
Same real cutover as `../v3/`'s Phase 2, for Shield: switch every real
app's `SHIELD_API_URL`/`VITE_SHIELD_API_URL` default from
`venvs-mock-backend` (8791) to this real service (8812). Confirmed
with the user before starting, alongside the V3 cutover.

## Real investigation before any code
Grepped for `SHIELD_API_URL\s*||` across the repo: only 3 real
callers exist — `vaco-shell/server.js` (backend proxy), and two
frontend Vite clients (`venvs/src/lib/shieldAuth.js`,
`vdp/src/lib/shieldAuth.js`). Far fewer real Shield callers than V3
callers, since most apps don't do their own session handling —
`vaco-shell` is the real shared session host for the ecosystem.

## Design
Same mechanical, single-value swap as V3's cutover: fallback default
`8791` → `8812`, nothing else touched.

## Explicitly NOT in this task
Removing `venvs-mock-backend`. Touching env var names. Any change to
`vaco-shell`'s own `/api/session` proxy logic — it already just
forwards to whatever `SHIELD_API_URL` resolves to.

## Verification approach
Grep-confirmed the swap (0 remaining `8791` Shield defaults, 3 real
`8812` defaults). Live pass with **no env override**: `vaco-shell`
started with `SHIELD_API_URL` unset, a real login through its own
unmodified `POST /api/session` route, the resulting token
independently confirmed valid both directly against this service and
through `vaco-shell`'s own unmodified `GET /api/session/:token` proxy.

## Done when
All 3 real Shield callers default to this service, confirmed by grep,
with a live no-override proof that the new default actually works.
