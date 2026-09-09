# Plan — Phase 1: Real App Launcher + Shared Session Host

## Goal
Close the single most cross-cutting gap surfaced by the full ecosystem
status audit: "Shell" — the app launcher/unified session other apps'
own docs consistently assume exists — has no real code anywhere.

## Real investigation before any code
Grepped every README and every `*.md` source doc across the whole repo
for "Shell" (not just READMEs) and found it referenced consistently
but never built: `VAGO_CLAUDE.md` ("its own Shell tile/entry point"),
`VXLLAGE_CLAUDE.md` ("Shell's unified-session decision"),
`UNIVERSAL_SAFETY_LAYER_VSAFE.md` ("Shell's agent layer"). Separately
confirmed, by reading `vdp/src/lib/shieldAuth.js` and
`venvs-mock-backend/server.js` directly, that a real, working session
contract already exists under the name "Shield" — `POST /api/shield/session`
/ `GET /api/shield/session/:token` — already consumed live by both VDP
and VENVS. This mattered: it meant "fix Shell" was NOT "build auth
from zero" (that already existed and worked), it was "build the
launcher + registry that never got built on top of it."

## Design
- Shell proxies to Shield rather than reimplementing session storage —
  confirmed via direct code reading that a second, competing session
  store would fragment an already-real, already-shared service, not
  fix anything.
- `lib/registry.js` is a real, static list — every entry's `url`
  checked directly against that app's own `server.js` (grepped every
  `PORT || <number>` across the repo) rather than guessed or assumed
  sequential.
- VACON-C gets a real `url: null` entry rather than being omitted —
  its own README says plainly it has no HTTP routes yet; the registry
  reflects that honestly instead of hiding the gap.
- `lib/insight.js` wraps VACON's real `/api/route`, closing
  `VAGO_CLAUDE.md`'s own named gap ("needs a real call into Shell's
  shared agent layer... not a hardcoded string") with an actual live
  call, not a new hardcoded string of its own.
- The SSO handoff is a real, working `?shieldToken=` query param on
  outbound tile links — deliberately not oversold as full cross-origin
  SSO, since no shared cookie domain exists in this environment to
  build that on top of; the honest half-step is real and verified, the
  remaining half is named directly in "Not yet built."

## Explicitly NOT in this task
Migrating VDP/VENVS's own existing `shieldAuth.js` clients to actually
read Shell's `?shieldToken=` handoff — that's a real, separate change
to already-tested apps, out of scope for standing Shell up itself. A
persistent registry/database. Real LLM completions (confirmed live as
blocked on a missing `ANTHROPIC_API_KEY`, same gap VACON's own README
already names for MIA).

## Verification approach
Live, with `venvs-mock-backend`, `vacon`, and `shell` all running
together (not mocked): the real registry served and rendered as tiles
in an actual Playwright-driven browser, including the disabled
VACON-C tile; a real login round-tripping through Shield; the
resulting token confirmed present on a live tile's `href`; a real
insight-card query confirmed routed by VACON to the correct real
agent; the `invoke: true` failure path confirmed against v4-proxy's
own real refusal to start without a key (run directly to see its exact
real error, not assumed).

## Done when
- The launcher renders every real app in the ecosystem, accurately
  reflecting which ones have a live server today.
- Login is a real, working proxy to the already-real Shield session,
  not a second auth system.
- The insight card makes a real call into VACON, not a hardcoded
  string.
