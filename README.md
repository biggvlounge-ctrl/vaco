# VACO

A monorepo of 36 interconnected applications — 34 Node backends and
two Vite frontends — sharing common infrastructure: a canonical ledger (V3), session auth (Shield), an
identity attestation service (VACA), an agent layer (VACON / V4), and
an analytics spine (VACO Analytics).

## Running it

```sh
./install-ecosystem.sh  # first time only -- installs deps for every app
./start-ecosystem.sh    # boots every app on its assigned port
./stop-ecosystem.sh
```

On a host that gives you one port instead of thirty-six — Replit,
Render, Fly — put the gateway in front of them:

```sh
PORT=8080 node gateway.js       # the whole ecosystem, through one port
node gateway.js --print-routes  # the routing table, starting nothing
```

And on a machine that cannot hold the full ~2.4 GB stack, boot a
subset. An unknown app name is refused rather than skipped:

```sh
VACO_APPS="vaco-shell v3 shield void vacay" ./start-ecosystem.sh
```

A fresh clone or unzipped archive contains tracked files only, so no
app has `node_modules` yet — run the install step first. The Docker
path does not need it (`deploy/Dockerfile.node` installs during build).

Each app is a self-contained Node service with its own `package.json`,
`lib/`, and `dev-docs/`. `vaco-shell/lib/registry.js` is the
authoritative list of apps, their real ports, and their groupings —
ports there are verified, not guessed.

## Shared infrastructure

| Service | Role |
|---|---|
| `v3/` | Canonical VCoin/VASH ledger. Eighteen apps settle through it. |
| `shield/` | Sessions and credential auth; SSO across apps. |
| `vaca/` | Identity and authenticity attestation, consumed by VOKEN, VOID, CVNVO. |
| `vacon/` + `v4-proxy/` | The 14-agent roster, routing, and agent presentation surfaces. |
| `vaco-analytics/` | Metric ingestion plus a proactive anomaly/alert loop. |
| `vaco-shell/` | Launcher, session host, app registry. |
| `deploy/` | Docker Compose and nginx generation, including rate limiting. |

## Conventions

Several patterns recur deliberately across apps, and new code should
follow them:

- **Injected cross-app clients.** Modules take a `transferFn`,
  `hvntzFetchFn`, `voidRequestFn` rather than importing a sibling app,
  so every module stays runnable in plain Node with no network.
- **Fail soft on signals, hard on money.** Analytics and advisory
  signals degrade quietly; payouts, capacity checks, and licensing
  gates throw.
- **Named interpretive constants.** Any value inferred rather than
  specified is a named, overridable constant with a comment saying so —
  never a literal buried in a call site.
- **`dev-docs/` per app** records what each phase actually did,
  including what it deliberately did not do.
- **A claim in a document is held by a test.** Counts go stale
  silently, so the tools that produce them are re-run against the
  documents that quote them —
  `scripts/test/system-of-record.test.mjs` and
  `scripts/test/deploy-readme.test.mjs`. Both exist because the
  documents they check had drifted while asserting they had not.

## The other two root documents

`SYSTEM_OF_RECORD.md` is the single complete picture: every app and
port, the shared modules, the authorization posture, the standing
rules, the deploy procedure, the six verification commands, and what is
deliberately not built. Start there if you have never seen this repo,
or if you want to check whether a claim elsewhere is still true — every
number in it was produced by running the tool that owns it.

`VACO.md` is the cumulative record: where every file goes, what has
already been filed, and what is actually coded per app.

This README covers how to run the thing. `SYSTEM_OF_RECORD.md` covers
what the thing currently is. `VACO.md` covers where new work belongs.

## A note on the documentation

Many `.md` files here are source design documents, each carrying an
"Implementation status" section added when it was placed into the repo.
Those sections are the reconciliation between what a document claims
and what the code actually does — several documents describe
capabilities as already built that are not. Treat the status section as
authoritative over the document body above it.
