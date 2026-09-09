# Vex Trading

The real parent shell over two genuinely separate apps, per direct
instruction: **VEX** (the real Cvltvre Card brokerage, extracted from
VOKEN — `../vex/`) and **Vex Business** (the real futures-research/
trading platform, renamed from CALL — `../vex-business/`). One app,
two real sub-apps — not a merge of their code, their data stores, or
their tech stacks (VEX is Node/Express, Vex Business is Python/FastAPI
+ Next.js).

This shell owns none of their logic. It's a thin, real front door:
a static launcher page plus an API that reports each sub-app's actual,
live reachability (a real `fetch` against each sub-app's own
`/api/health`, never a hardcoded "online") and links out to wherever
each sub-app's real UI actually lives.

**Neither sub-app's real UI is hosted here**:
- ~~VEX is API-only~~ — **VEX now has its own frontend** at port 8816,
  on the shared VACO design system: compliance gates first (an order
  placed while a gate is closed is refused before money moves),
  accounts, and order entry. VDP's VEX district (`VexView.jsx`) is
  still real and still the in-world trading floor; the two are
  different surfaces onto the same API, not a stand-in for a missing
  one.
- Vex Business has its own real dashboard (`../vex-business/apps/web`,
  port 9001) — this shell's tile opens that directly.

## Run
```
cd vex-trading && npm install && npm start   # localhost:8817
```

## Test
```
curl http://localhost:8817/api/health
curl http://localhost:8817/api/apps
```

## What's here
- `lib/registry.js` — the real, static two-entry sub-app registry
  (`listSubApps()`/`getSubApp(id)`), same "static array, not a
  database" posture as `vaco-shell/lib/registry.js`, scoped down to
  just these two apps rather than the whole ecosystem.
- `server.js` — `/api/health`, `/api/apps`, `/api/apps/:id`; each
  `/api/apps*` response includes a real, live `reachable` boolean from
  actually calling the sub-app's own health endpoint with a 2s
  timeout, not assumed from the registry alone.
- `public/index.html` — a real, minimal launcher page: two cards, each
  showing the real live up/down status and a link out to the sub-app's
  actual UI.

## Live-verified
Booted `vex` (up) and `vex-trading` together with `vex-business`'s API
deliberately still down: `GET /api/apps` correctly reported VEX
`reachable: true` and Vex Business `reachable: false` — a real,
independently-checked mixed status, not a static assumption. The
static launcher page (`GET /`) serves and renders both cards from that
same live data.

## Explicitly not built here
No shared session/SSO between VEX and Vex Business — they're
independent apps with independent (in VEX's case, none yet) auth,
same as every other real cross-app boundary in this ecosystem. No
merged data model — this shell never touches either sub-app's store.
