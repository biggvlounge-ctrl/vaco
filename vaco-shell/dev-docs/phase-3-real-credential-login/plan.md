# Plan — Phase 3: real credential login UI

## Goal
Wire Shield's new real credential auth (`register`/`login` with a
real password) all the way to the actual front door — this app's own
login UI — not just leave it as an API nothing calls.

## Design
Two new server-side proxy routes, `POST /api/register` / `POST
/api/login`, matching the existing `/api/session` proxy shape exactly
(forward to Shield, pass through status + body). `public/index.html`
gained a real password field and Register/Log-in buttons alongside
(not replacing) the original quick-login box — a user can still
quick-login by typing any userId with no password (the ecosystem's
internal SSO shortcut, unchanged), or register/log into a real
password-protected account.

## Verification approach
A real Playwright browser pass: register a brand-new account, confirm
logged in; log out; log back in with the correct password; confirm a
wrong password shows a real error, not a silent failure; confirm the
original quick-login button still works unchanged.

## Done when
A real human can create and log back into a real password-protected
account through this app's own UI.
