# Plan — Phase 2: ecosystem-wide V3 default cutover

## Goal
Phase 1 built a real, standalone V3 (VCoin/VASH) with proven drop-in
compatibility, but deliberately left every other app's `V3_API_URL`
default pointed at `venvs-mock-backend`, calling the actual cutover a
"deliberate follow-up." Confirmed with the user before starting: cut
real apps over from the mock to this real service.

## Real investigation before any code
Grepped every `.js` file in the repo for `V3_API_URL\s*||` to find
every real caller and its exact current default, rather than assuming
which apps have one. Found 15: 13 backend `server.js` files reading
`process.env.V3_API_URL || 'http://localhost:8791'`, and 2 frontend
Vite clients reading `import.meta.env.VITE_V3_API_URL || "..."`. Also
grepped `.env.example` files for the same stale default (8 files).

## Design
A mechanical, single-value change only: swap the fallback default from
`8791` (the mock) to `8811` (this service) everywhere it appears. No
other line touched — env var *names* stay identical, so no calling
code changes, only what it resolves to when unset. Applied via `sed`
with an explicit before/after grep pass to confirm exact match count
(15 hits before, 15 hits after at the new port, none left at the old
one).

## Explicitly NOT in this task
Removing or deprecating `venvs-mock-backend` — it still runs and is
still a valid target if an app's env var is explicitly pointed at it.
Touching any env var *name*, only the *default value*. Modifying any
app's actual business logic.

## Verification approach
Grep-confirmed the mechanical swap left no `8791` V3 defaults and
exactly the expected `8811` count. Then a live pass with **no env
override** — the actual point, since the earlier Phase 1 test used an
explicit override and wouldn't have caught a default that was typo'd
or missed: started real V3 (8811) and VAGO with no `V3_API_URL` set,
placed a real casino stake through VAGO's own unmodified
`POST /api/casino/sessions`, confirmed the real balance moved on V3
(`1000 → 950`) — proving the new default itself resolves correctly,
not just an explicit override of it.

## Done when
Every real app's V3 default points at this service, confirmed by grep,
and at least one real app proven working against that default with no
env var set at all.
