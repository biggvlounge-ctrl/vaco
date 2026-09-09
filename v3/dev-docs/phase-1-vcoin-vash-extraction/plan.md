# Plan — Phase 1: real V3 (VCoin/VASH) extraction

## Goal
Close the ecosystem's own largest, most-flagged remaining gap: "V3
never getting its own standalone app; every app's env var default
points at `venvs-mock-backend`." Do it without the ecosystem-wide
blast radius that gap was explicitly flagged for -- confirmed with the
user before starting given that risk.

## Real investigation before any code
Read `venvs-mock-backend/server.js` in full: a real, working,
already-tested VCoin+VASH+Shield contract, explicitly documented in
its own header as **inferred**, not copied from a real V3 spec --
neither V3's nor Shield's real source exists anywhere in this session.
Confirmed VACA (identity) was already split out into its own real app
earlier this session as V3's third component; VCoin+VASH (the ledger)
never was. Confirmed via multiple source docs that V3 and Shield are
real, distinct ecosystem services ("Shield's session, V3's ledger"),
combined into one mock process purely to keep an earlier session's
scope manageable -- this build is V3 (the ledger) only, matching
exactly what was asked, not Shield.

## Design
This is an extraction, not a redesign: `lib/vcoin.js`/`lib/vash.js`
preserve the mock's own real routes, response shapes, and the real
`STARTING_VCOIN_BALANCE`/`VCOIN_TO_VASH_RATE` constants byte-for-byte
-- dozens of already-shipped live tests across this ecosystem assert
against these exact numbers, and changing them would silently break
real, already-verified behavior elsewhere. `server.js` matches the
mock's own real Vcoin/VASH paths exactly; Shield's own session routes
are deliberately not included.

**The real, deliberate scope boundary**: this build does not modify
any other app's code. Every app already reads a `V3_API_URL` env var
with a default -- switching an app over is a one-line env var change,
left as a deliberate per-app follow-up rather than an ecosystem-wide
flag day touching 25 apps' configuration in one uncoordinated pass.
That boundary is the actual answer to the "ecosystem-wide blast
radius" concern this gap was originally flagged for.

## Explicitly NOT in this task
Shield (session/auth) -- a real, separate, still-open gap. Changing
any other app's own `V3_API_URL` default or code. Real persistence.
Any new financial mechanic beyond what the mock already had.

## Verification approach
8 plain-Node checks preserving exact parity with the mock's own real
behavior (including its exact real error message text). A live pass:
every route hit directly to confirm contract parity, then the real,
defining test -- VAGO (an already-built, unmodified app) started with
only its `V3_API_URL` env var repointed at this new service, a real
casino session placed through VAGO's own existing, unmodified code,
and the resulting real VCoin movement independently confirmed on this
new V3 service's own ledger, proving zero-code-change drop-in
compatibility.

## Done when
A real, standalone V3 app exists with real, verified byte-for-byte
contract parity with the mock it was extracted from, and real,
live-verified proof that an existing, unmodified app can be repointed
at it with only an env var change.
