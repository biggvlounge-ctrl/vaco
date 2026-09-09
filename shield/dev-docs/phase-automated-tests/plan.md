# Plan — first automated test suite

## Goal
Same real motivation as V3's: Shield is the other app every real SSO
integration in this ecosystem depends on, and had zero automated
tests before this pass.

## Design
Node's own built-in `node:test` + `node:assert/strict`, testing
`lib/credentials.js`/`lib/sessions.js` directly against a fresh
`createShieldStore()`.

## Verification approach
`npm test`: 12/12 real assertions pass, covering the real minimum-
password-length rejection, real duplicate-registration rejection,
real password verification (correct/wrong/never-registered), real
per-user salt independence (two users with the same password get
different stored hashes), real token uniqueness across two sessions
for the same user, and real session-expiry boundary behavior (valid
one millisecond before expiry, invalid one millisecond after).

## Done when
`npm test` is a real, green, one-command regression check for
Shield's own core session/credential logic.
