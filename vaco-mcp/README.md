# VACO MCP

Exposes VACO's routes to an MCP client as tools. **Through the guards,
never around them.**

## Why this exists, and why it exists *now*

An MCP server is a way to let an agent act on a system. Built over an
unguarded API, it is a way to let an agent act on a system with no
authorization — which is exactly what `v4-proxy` was until its
twenty-eight routes were put behind `serviceAuth`.

So this was deliberately sequenced second. The order matters more than
the code does:

1. guard the routes
2. *then* hand agents a way to call them

Doing it the other way round is handing out keys to a building with no
locks.

## How it is authorized

This process holds one service credential and presents it on every
call. It has no privileged path and no exemption list.

```
agent → MCP client → vaco-mcp → serviceAuth → the route
```

If a route refuses `vaco-mcp`, the tool fails and says so. That is
correct behaviour, not a bug — and the failure message says as much,
because "the guard refused me" is something a model can act on while a
generic error is not.

Every call also carries a W3C `traceparent`, so an agent's action is
traceable from the tool call through every service it touches.

## What is deliberately not exposed

**Nothing that moves money.** V3 transfers, VOKEN purchases, VAGO
settlements. Those are `decisionLog` routes — a human or an operator
credential stands behind them and the decision is recorded in
`vaco-audit` before it happens. An agent reaching them through a tool
list is a category error.

**`POST /api/agent`.** V4's pass-through to the model. An agent calling
it would be an agent calling itself through two network hops.

A test asserts both, so reversing either has to be done on purpose:

```
test('no tool that moves money is exposed', ...)
```

## Running it

```sh
VACO_SERVICE_TOKEN=<this service's token> node server.mjs
```

Wired into a client as a stdio server:

```json
{
  "mcpServers": {
    "vaco": {
      "command": "node",
      "args": ["/path/to/vaco/vaco-mcp/server.mjs"],
      "env": { "VACO_SERVICE_TOKEN": "..." }
    }
  }
}
```

The token must be in the target services' `VACO_SERVICE_TOKENS`
allowlist under the name `vaco-mcp` (or whatever `VACO_SERVICE_NAME`
is set to). Without it the server still starts — and says so on stderr
— but every call is refused, which is the intended failure.

| Variable | Default |
|---|---|
| `VACO_SERVICE_NAME` | `vaco-mcp` |
| `VACO_SERVICE_TOKEN` | *(empty — calls will be refused)* |
| `VACO_MCP_TIMEOUT_MS` | `8000` |
| `V4_PROXY_URL` | `http://localhost:8787` |
| `VACON_URL` | `http://localhost:8805` |

## The no-SDK decision

MCP over stdio is JSON-RPC 2.0 with four methods that matter —
`initialize`, `notifications/initialized`, `tools/list`, `tools/call` —
newline-delimited on stdin and stdout. That is about a hundred lines.

Every app in this repo runs on `express`, `cors` and `dotenv`. Adding a
protocol SDK to a process whose whole job is forwarding HTTP would make
the largest dependency in the repository serve its smallest service.
Same argument `vaco-media/lib/transport/livekit.js` makes about minting
a LiveKit token with `node:crypto` instead of a vendor SDK.

**The honest cost:** an SDK tracks protocol revisions and this does not.
If MCP changes shape, this needs editing. `test/protocol.test.mjs` is
what will say so — it spawns the real process and writes real frames to
its stdin rather than calling the handlers directly, including the two
framing cases that only fail under load: a message split across two
writes, and two messages in one write.

## Tools

| Tool | Reaches |
|---|---|
| `maps.describe` `maps.nearby` `maps.distance` `maps.route` | V4 maps layer |
| `surfaces.list` `twins.list` `twins.get` | V4 presentation |
| `calls.list` `calls.place` | V4 call flow |
| `agents.list` `agents.route` `agents.invocations` | VACON |
| `system.health` | any of nine named services |

`system.health` takes a **name**, never a URL. An open host parameter
would make it an SSRF primitive carrying a service credential; the
allowlist is in `lib/tools.mjs` and a test drives a metadata-endpoint
URL at it to prove it is refused.
