# Plan — Phase 1: Vex Trading shell

## Goal
Per direct instruction: VEX and Vex Business become "one app with sub
apps" — VEX as the main/parent identity, Vex Business as the trading-
assistant program living inside it. Built as a real, thin launcher
shell wrapping two genuinely independent codebases, not a literal code
merge — VEX is Node/Express, Vex Business is Python/FastAPI + Next.js,
and forcing them into one process/repo would mean rewriting one of
them for no real benefit.

## Real investigation before any code
Checked how this ecosystem already solves "one app, sub-apps" before
picking a shape: `vacay`/`vago` merge multiple *related, same-stack*
features into one Express app+lib directory. That doesn't fit here —
VEX and Vex Business are different languages, different runtimes,
different real domains (collectibles brokerage vs. futures research),
each already a fully real, independently-tested app. The closer real
precedent is `vaco-shell` itself (task: "Build Shell: real app
launcher + session host") — a thin front door over genuinely separate
apps, proxying rather than merging. Scoped that pattern down to just
these two sub-apps instead of the whole ecosystem.

## Design
- `lib/registry.js`: a real, static two-entry array (same shape as
  `vaco-shell/lib/registry.js`), each entry honest about where its
  real UI actually lives — VEX had no UI of its own at the time (its real
  trading-floor UI is VDP's own VEX district), Vex Business has its
  own real dashboard.
- `server.js`: `/api/apps` performs a real, live `fetch` against each
  sub-app's own `/api/health` (2s timeout) rather than trusting the
  registry's static shape — a sub-app being down reports `reachable:
  false` honestly instead of 500ing or lying.
- `public/index.html`: a real, minimal launcher page rendering that
  live data, not mock tiles.

## Verification approach
Live, not just source-level: booted `vex` (kept running from the
Phase-16 extraction work) and `vex-trading` together, deliberately
left Vex Business's API down, and confirmed `GET /api/apps` reported
the real, independently-checked mixed result — VEX `reachable: true`,
Vex Business `reachable: false`. Confirmed the static launcher page
serves (`GET /` -> 200).

## Explicitly NOT in this task
No shared session/SSO between the two sub-apps. No merged data model
or shared store — this shell never reads or writes either sub-app's
own state, only their `/api/health`.

## Done when
- A real, running shell reports live, independently-verified
  reachability for both real sub-apps, not a hardcoded status.
- Both sub-apps' real UIs are reachable through the shell's own
  launcher page, each honestly labeled about where that UI actually
  lives.
