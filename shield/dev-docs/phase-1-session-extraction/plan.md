# Plan — Phase 1: real Shield session extraction

## Goal
Close the other real half of "V3 never getting its own standalone
app" -- `venvs-mock-backend` stood in for both V3 (the ledger,
already split out) and Shield (the session layer, not yet). Confirmed
with the user before starting.

## Real investigation before any code
Read `venvs-mock-backend/server.js`'s own real Shield routes and
`venvs/CLAUDE.md` §0.2 ("Shield assumes one unified login/session,
trusted by every app") directly. Found three real, existing clients
already speaking this exact contract: `venvs/src/lib/shieldAuth.js`,
`vdp/src/lib/shieldAuth.js` (both browser-side), and
`vaco-shell/server.js`'s own real `/api/session`/`/api/session/:token`
proxy routes (a Node backend, and the real drop-in-compat test
candidate since it's directly curl-able).

Confirmed no doc anywhere specifies real credential/password
verification -- "trusted by every app" describes the trust
relationship between apps and Shield, never how a caller proves who
they are. This is a real, honest scope boundary, not an oversight to
silently fill in.

## Design
`lib/sessions.js` preserves the mock's own real
routes/shapes/`SESSION_LIFETIME_MS` (24h) exactly -- same extraction
discipline as `../v3/`. One real, deliberate deviation: the mock's own
token (`shield_${userId}_${Date.now()}`) is predictable; every real
client treats the token as an opaque string (none parse it), so
swapping in a real `crypto.randomBytes` suffix is a safe, real
improvement, not a compatibility break -- the same real pattern this
session already used for VOID's Locker-to-Door codes.

`server.js` matches the mock's own real Shield paths exactly; V3's own
VCoin/VASH routes are deliberately excluded (already built separately
in `../v3/`).

## Explicitly NOT in this task
Real credential/password authentication -- genuinely undocumented
anywhere, flagged directly rather than invented. Real persistence.
Server-side session revocation before real expiry. Modifying any
other app's own code or env var defaults.

## Verification approach
7 plain-Node checks (real session/expiry, unguessable-token
uniqueness, valid/expired/unknown-token handling, exact real error
text, tamper resistance). A live pass: direct contract parity over
real HTTP, then the defining test -- `vaco-shell` (already-built,
unmodified) started with only `SHIELD_API_URL` repointed, a real login
performed through its own existing `/api/session` route, the resulting
real token independently confirmed valid both directly against this
service and through `vaco-shell`'s own existing `/api/session/:token`
proxy.

## Done when
A real, standalone Shield app exists with verified contract parity,
and live-verified proof that an existing, unmodified app can be
repointed at it with only an env var change.
