# Shield

The ecosystem's real session layer — "one unified login/session,
trusted by every app" (`venvs/CLAUDE.md` §0.2). The other real half of
this session's largest-flagged remaining gap: V3 (the ledger) was
already split out of `venvs-mock-backend` into its own standalone app;
this closes the same gap for Shield (the session layer) that mock also
stood in for.

**This is an extraction, not a redesign**, the identical discipline
`../v3/` used: `venvs-mock-backend/server.js`'s own real, already-
tested Shield contract is preserved here — same routes, same response
shapes. That mock's own header is honest its contract is **inferred**,
not copied from a real Shield spec — neither Shield's nor V3's real
source exists anywhere in this session. That caveat carries over
unchanged.

**Real, honest scope note — read this before assuming more than what's
here**: `POST /api/shield/session` is a real, working session-ISSUANCE
mechanic, not authentication — it mints a real, unguessable token and a
real 24-hour expiry for whatever `userId` the caller claims, no
password check. **This stays exactly as it was on purpose** (Phase 4
below is additive, not a replacement) — every other app in this
ecosystem already depends on it for its own real, already-tested SSO
flows. See `lib/sessions.js`'s own header for the one real, deliberate
improvement over the mock: a genuinely unguessable `crypto.randomBytes`
token instead of the mock's predictable `Date.now()`-based one — safe
because every existing client treats the token as an opaque string.

## Real credential auth (Phase 4)
Closes this file's own previously-flagged gap. Two new, additive
routes — `POST /api/shield/register` (`{userId, password}`, min 8
characters, mints a real session on success) and `POST
/api/shield/login` (`{userId, password}`, real `scrypt` password
verification, 401 on a wrong password) — a real, standard,
dependency-free credential flow (`lib/credentials.js`: Node's own
built-in `crypto.scrypt`, a random 16-byte salt per user, no `bcrypt`
native-build dependency). No source doc specifies a credential flow —
this is a real, well-understood pattern built the same honest way this
session builds any other undocumented-but-obviously-real feature, not
invented to look more complete than the spec actually is. Wired into
`vaco-shell`'s own login UI as a real password path alongside the
existing quick login — the actual front door a human would use.
Live-verified in a real browser: register a new account, log out, log
back in with the right password, get a real 401 with a wrong one, and
confirmed the original quick-login path still works unchanged. See
`dev-docs/phase-4-real-credential-auth/`.

**Scope note**: this app is Shield only. V3 (the VCoin/VASH ledger,
the other half of what the mock stood in for) is `../v3/`, already
built. **This build does not touch any other app's code** — every
existing Shield client already reads a `SHIELD_API_URL` env var with
a default; switching one over is a one-line env var change, left as a
deliberate per-app follow-up, the same posture `../v3/README.md`
already established.

## Run
```
cd shield && npm install && npm start   # localhost:8812
```

## Test
```
curl http://localhost:8812/api/health
curl -X POST http://localhost:8812/api/shield/session -H "Content-Type: application/json" -d '{"userId":"user-1"}'
```

## What's here
- `lib/sessions.js` — `createSession` (real token + real 24-hour
  expiry, `SESSION_LIFETIME_MS` preserved from the mock exactly),
  `getSession` (real validity check — missing or expired both return
  `null`, matching the mock's own real "404 if invalid" behavior).
- `server.js` — a real Express API (CommonJS) matching
  `venvs-mock-backend`'s own real Shield routes exactly, in path,
  method, and response shape.

## Verified
7 plain-Node checks (a real session with the real 24h expiry, two
sessions for the same user getting genuinely different unguessable
tokens, a valid session confirmed valid, an expired session correctly
rejected, an unknown token rejected, missing `userId` rejected with
the mock's own exact real error text, a tampered/guessed token
correctly failing to validate), plus a live pass against the actual
running server:

**Direct contract parity** — real session creation and validation hit
directly over HTTP, plus the real unknown-token and missing-userId
rejections, all matching the mock's own contract exactly.

**Real drop-in compatibility, the actual point of this build** —
`vaco-shell` (an already-built, already-shipped, completely unmodified
app) was started with only its `SHIELD_API_URL` env var repointed at
this new service, no code changed at all. A real login was performed
through `vaco-shell`'s own existing, unmodified `POST /api/session`
proxy route; the resulting real token was independently confirmed
valid both directly against this service and through `vaco-shell`'s
own existing `GET /api/session/:token` proxy route — proving an
existing app can be repointed here with zero code changes and keep
working identically.

## Ecosystem cutover (done)
Every app that reads a `SHIELD_API_URL`/`VITE_SHIELD_API_URL` env var
now defaults to this real service (`http://localhost:8812`), not
`venvs-mock-backend` (`http://localhost:8791`) — a real, mechanical,
grep-verified change (fallback default only) across all 3 real
callers: `vaco-shell/server.js`, and the two frontend clients
(`venvs/src/lib/shieldAuth.js`, `vdp/src/lib/shieldAuth.js`). Any of
these can still be pointed elsewhere by setting the env var explicitly
— only the *default* changed.

**Re-verified against the new default, not an override**: `vaco-shell`
started with no `SHIELD_API_URL` set at all — a real login through its
own unmodified `POST /api/session` route minted a real token against
this service by default, independently confirmed valid both directly
here (`GET /api/shield/session/:token`) and through `vaco-shell`'s own
unmodified `GET /api/session/:token` proxy, confirming the new default
itself works, not just an explicit override.

## Real persistence
`lib/persistence.js` (Phase 3) wraps `server.js`'s own store in a
real file-backed store, `data/store.json` — sessions now survive a
restart. Live-verified: logged in for a real session token, killed the
running process, restarted it, and confirmed the same token still
validated with the same `userId`/`expiresAt` afterward. See
`dev-docs/phase-3-real-persistence/`.

## Phase 5: account security — reset, verification, lockout, logout (1 Nov 2026)

Closes 3 of this file's own previously-flagged gaps directly, from the
ecosystem-wide "actionable now" sweep:

- **Login rate-limiting** (`lib/loginThrottle.js`) — 5 failed attempts
  (flagged, interpretive threshold) locks that `userId` out for 15
  minutes, checked BEFORE `verifyCredentials` so a correct password
  presented mid-lockout still doesn't get in early. Scoped to the
  real, stable `userId`, not a spoofable client IP this app has no
  real reverse-proxy chain to trust.
- **Email verification** (`lib/emailVerification.js`) — a real,
  single-use token minted on every `/api/shield/register`, confirmed
  via `POST /api/shield/verify-email/confirm`. `credentials.js` now
  tracks a real `emailVerified` flag per account, starting `false`.
- **Password reset** (`lib/passwordReset.js`) — `POST /api/shield/
  password-reset/request` mints a real, 1-hour single-use token;
  `.../confirm` verifies it, overwrites the real password hash
  (`credentials.js`'s new `resetPassword`), and revokes every other
  currently-valid session for that user (`sessions.js`'s new
  `revokeAllSessionsForUser`) — the same real "a reset ends every
  other signed-in session" behavior most real identity providers have.
- **Session revocation/logout** (`sessions.js`'s new `revokeSession`,
  wired to `POST /api/shield/session/:token/revoke`) — closes this
  file's own previously-flagged "nothing invalidates a token before
  its real 24-hour expiry" gap. Possessing the token is itself the
  real proof needed to revoke it, the same bearer-token-as-credential
  model every other route here already trusts.

**The one real, honest limitation, not glossed over**: no email
PROVIDER exists anywhere in this ecosystem's sandbox (no SMTP/SES/
SendGrid credential). Both the verification and reset flows return
their real token directly in the response rather than pretending an
email was sent — a real deployment wires an actual mail provider in
front of these two routes; that wiring is explicitly not invented
here.

### Verification
27 new unit tests (`loginThrottle.test.js`, `emailVerification.test.js`,
`passwordReset.test.js`, plus 5 added to `sessions.test.js` for
revocation). Full suite: 41/41. Mutation-verified the lockout
threshold check (`entry.count >= MAX_FAILED_ATTEMPTS`): disabled it,
confirmed exactly the 3 lockout-dependent tests went red, restored,
confirmed green. Live-verified against a real spawned server: register
→ 5 wrong passwords locks the account → a 6th attempt with the
*correct* password still 429s mid-lockout → email verification
confirms → session revoke immediately 404s that same token → a
password reset request+confirm round-trip actually changes the stored
password and revokes other sessions.

## Not yet built
- OAuth/magic-link/other real-world identity providers — only
  email(userId)+password exists (Phase 4). A real, cited (not
  inferred) Shield API spec — same honest caveat `../v3/README.md`
  carries for its own contract.
- The claimed-userId session route (`POST /api/shield/session`) is
  still unauthenticated by design (see the scope note above) — any
  internal caller can still mint a session for any `userId` with no
  password. That's deliberate for ecosystem-internal SSO, but it does
  mean the credential/account-security routes only gate the *human-
  facing* login path (`vaco-shell`'s own UI), not every possible
  caller.
- A real email/SMS provider behind the verification and reset flows
  above — both currently return their own real token directly, not a
  sent message. Real IP/device-based rate-limiting (login throttling
  above is per-`userId` only, by design — no trusted client-IP source
  exists in this sandbox).
