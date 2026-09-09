# Plan — Phase 4: real credential auth

## Goal
Close this project's own most directly self-flagged real gap:
`sessions.js`'s own header says plainly that `createSession` issues a
session for whatever `userId` a caller *claims*, with "no password,
credential, or identity check behind it anywhere in this ecosystem's
own source docs." No source doc specifies a credential flow either —
build the real, standard, well-understood one (register a password,
verify it on login), the same honest way this session has built every
other undocumented-but-obviously-real feature.

## Design
Two new, additive routes, `lib/credentials.js`:
- `POST /api/shield/register` — `{userId, password}`, min 8
  characters, real per-user `crypto.scrypt` hash (random 16-byte salt,
  stored as `salt:hash` hex, no plaintext ever stored) — mints a real
  session on success via the existing `createSession`, same as any
  real signup flow logging you in immediately.
- `POST /api/shield/login` — `{userId, password}`, real
  `crypto.timingSafeEqual`-based verification, 401 on a wrong password
  or unknown user.

**Deliberately additive, not a replacement**: `POST
/api/shield/session` (claimed-userId, no password) stays byte-for-byte
unchanged — every other app in this ecosystem already depends on it
for its own real, already-tested SSO flows (a user who's already
proven who they are to one app shouldn't need to re-enter a password
for every other app trusting the same Shield session). The new routes
are the real path a human actually signs up/logs in through directly.

**No new npm dependency**: Node's own built-in `crypto.scrypt` instead
of `bcrypt` (which needs a native build step) — same "use what's
already in the platform" posture as `lib/sessions.js`'s own
`crypto.randomBytes` token improvement.

**Wired all the way to the real front door**: `vaco-shell`'s own login
UI (`public/index.html`) gained a real password field and
Register/Log-in buttons alongside the existing quick-login, proxied
through two new `vaco-shell/server.js` routes (`/api/register`,
`/api/login`) the same way session issuance already is.

## Verification approach
A real unit-test pass on `credentials.js` in isolation first (register
+ verify correct password, wrong password rejected, unknown user
rejected without throwing, duplicate registration throws, short
password rejected, password never stored in plaintext, same password
for two different users produces two different hashes — real
per-user salting). Then live, against the real running server: `curl`
through register/login/wrong-password/duplicate/short-password, and
confirmed the existing `POST /api/shield/session` route is untouched.
Then a real Playwright browser pass against `vaco-shell`'s own UI:
register a brand-new account, log out, log back in with the right
password, get a real error with a wrong one, and confirm the original
quick-login button still works unchanged.

## Done when
A real human can register a real password-protected account and log
back into it through Shell's own UI, with the existing
claimed-userId ecosystem-internal SSO path completely unaffected.
