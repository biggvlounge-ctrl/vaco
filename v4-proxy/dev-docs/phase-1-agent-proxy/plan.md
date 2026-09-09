# Plan — Phase 1: V4 Agent Proxy (retroactive record)

## Note
This dev-docs pair was written retroactively, closing a real gap
found while investigating V4 during a later priority pass: `v4-proxy`
had no `dev-docs/` folder at all despite being real, working, already-
verified code — this documents the architecture as it actually exists
in `server.js`/`README.md`, not a fresh build.

## Goal
Close `V4_CLAUDE.md`'s own named §7 gap 0: the Anthropic API key must
never reach the client. `V4Prototype.jsx` needs a real completion
without ever holding or transmitting the key itself.

## Design
A minimal Express server holding `ANTHROPIC_API_KEY` server-side only
(env-based, fails fast at startup if missing). `POST /api/agent`
accepts `{system, messages}`, calls `api.anthropic.com` with the real
key attached server-side, and proxies the response back — real input
validation, per-IP rate limiting, and error passthrough that never
leaks the key even on an upstream failure.

`V4Prototype.jsx` originally called this proxy directly from
`callAgent()`. That later changed (see `../vacon/README.md`): VACON's
own `POST /api/agents/:id/invoke` now sits between the frontend and
this proxy, looking up an agent's real system prompt in VACON's
registry before calling straight into this exact `/api/agent` route.
This server's own role never changed — it remains the only thing that
ever holds the key and talks to Anthropic.

## Verification approach
Documented in `README.md`'s own "Verify it's actually working"
section: a health check confirming the key loaded, a real end-to-end
call against the live Anthropic API confirming a real completion
comes back, and three explicit failure-mode checks (missing key,
malformed body, upstream error) confirming errors are handled without
ever leaking the key.

## Done when
The key never reaches the client under any code path, confirmed via
the README's own real, live verification steps.
