# dev-docs/displays/

The four presentation surfaces built for this ecosystem, kept here so
they survive the machine they were drafted on. They were authored in a
scratch directory and published as Artifacts; a container restart
mid-session was the reminder that a scratch directory is not storage.

These are **prototypes, not deployed apps.** Nothing here is a Compose
service, nothing here is behind nginx, and `scripts/audit-route-guards.mjs`
has no routes to find in them. They are opened directly in a browser
or published as an Artifact.

| File | What it is |
|---|---|
| `vaco-tv.html` | **Ten-Foot Shell** — the television launcher. Five figures (✕ ■ ◆ ▲ ○); each app's name forms one edge, and the shape is the button. Arrow keys and Enter, no pointer required. |
| `vaco-poster.html` | **Ecosystem Map** — the one-pager. The same five shapes, a two-level radial launcher on a phone, and the app-to-app connection strip. |
| `vaco-os.html` | **Operating System** — the four-quadrant dashboard: four ecosystems around one V4 core, with per-app route counts, module counts and shared-runtime wiring. |
| `vaco-golive.html` | **Go-Live Brief** — what it costs to deploy, who to hire for each blocker, and how to screen them. The only one of the four aimed at somebody outside the project. |

## The rule these are built under

**Every number on these pages came out of the repository, and none of
them is invented.** Route counts are grepped from each `server.js`,
ports come from `vaco-shell/lib/registry.js`, hues from
`VACO_PALETTE_REGISTER.md`, guard counts from
`scripts/audit-route-guards.mjs`, test counts from
`scripts/run-all-tests.mjs`, and the memory figures on the Go-Live
Brief were measured by booting six real servers.

There are no usage figures anywhere on them, because there are no
users yet. A dashboard showing invented traffic is the exact artefact
this repository keeps a filing document to prevent.

**The connection strip on the Ecosystem Map is verified, not asserted.**
An earlier draft listed four app-to-app links "by design"; grepping for
each caller's `*_API_URL` read found that two were wired, one ran the
opposite direction, and two did not exist. All of them are shown with
what is actually true. Citation is not presence.

## Keeping them honest

These pages hard-code numbers that the repository keeps changing, and
three of them had already gone stale before anyone noticed — the test
count sat at 822 and 860 across two pages long after it was 879, and
the OS dashboard was still showing `tracing 5/33` in warning amber
after the sweep had put tracing in all 36 places.

So when a number here stops matching the repository, the page is
wrong, not the repository. Re-check against:

```
node scripts/run-all-tests.mjs        # test and suite counts
node scripts/audit-route-guards.mjs   # routes accounted
./sync-shared-runtime.sh              # shared-module copy counts
node deploy/generate-docker-compose.js  # services and volumes
```

`SYSTEM_OF_RECORD.md` §1 carries the same scale table and is the place
to reconcile against first.

## What is deliberately not on them

VACON and the Shell take no edge on any shape. VACON is the agent
network we operate rather than an app anybody opens, and the Shell
*is* the launcher — a launcher does not need a tile inside itself.
That is a decision, not an omission, and both pages say so in their
own footers.
