# Plan — Phase 8: real Shield session auth

## Goal
Close this project's own previously-flagged gap: "Real auth — per the
doc's own gap list, this should trust Shell's unified session... not
yet wired." Part of a broader ecosystem sweep, confirmed with the user
before starting. Now buildable for real since Shield exists as a real,
standalone, live-verified service (`../shield/`), not just the mock it
stood in for when this gap was first flagged.

## Real investigation before any code
Re-read `venvs/src/lib/shieldAuth.js` and `vdp/src/lib/shieldAuth.js`
(the browser-side clients already speaking Shield's real contract) to
match the exact same `GET /api/shield/session/:token -> { valid,
userId, expiresAt }` shape. Counted every mutating route in
`server.js`: 31 `app.post` routes, zero `app.put`/`app.delete`.

## Design
`lib/shieldAuth.js` is the backend counterpart to the existing
frontend clients: a real Express middleware, `requireSession()`, that
reads `Authorization: Bearer <token>`, verifies it against Shield's
real session-check endpoint, and either attaches `req.sessionUserId`
and calls `next()`, or rejects with a real, distinct status per
failure mode (401 missing header, 401 invalid/expired token, 502
Shield unreachable -- never a silent pass-through on any failure).
Applied to all 31 mutating routes in `server.js` via a mechanical,
verified sed pass (each `app.post('/path', (req, res) => {` or
`app.post('/path', async (req, res) => {` became `app.post('/path',
requireSession(), ...)`), confirmed by grep that all 31 (and zero GET
routes) carry the middleware.

## Explicitly NOT in this task
Per-route identity matching (cross-checking `req.sessionUserId`
against whichever body field a route treats as the actor --
`userId`/`authorId`/`hostId`/etc., which differ per route). Flagged
directly rather than attempted in the same mechanical pass: doing it
correctly means auditing each route's own body shape individually,
and a blanket mismatch-rejection risks quietly breaking a real
cross-app caller acting on a user's behalf under a different identity
than its own session -- a real, separate, more careful follow-up.

## Verification approach
5 plain-Node checks against the middleware directly (a real local HTTP
server standing in for Shield's own response shape, not an in-process
mock): missing header, invalid/expired token, a real valid token
passing through with `sessionUserId` attached, Shield unreachable, and
a malformed (non-`Bearer`) header. A live pass against the real
running Shield and VXLLAGE servers: a tokenless request rejected, a
fabricated token rejected by Shield's own real validation, and a real
Shield session minted live carrying a real post through to creation.

## Done when
Every mutating VXLLAGE route requires a real, Shield-verified session,
confirmed by both isolated middleware tests and a live end-to-end
pass, and the README's own "Not yet built" list no longer names this
gap (replaced by the narrower, honestly-scoped identity-matching
follow-up).
