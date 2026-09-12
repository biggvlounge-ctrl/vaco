# Running VACO on Replit

Read this first if somebody handed you this archive and said "put it on
Replit."

## What this is

36 applications — 34 Node/Express backends and two Vite frontends —
that share a ledger, a session service, an identity service, an agent
layer and an analytics spine. They are separate processes on separate
ports, not one app with 36 routes.

Replit gives you **one port**. `gateway.js` is what reconciles those
two facts: it runs the apps on 127.0.0.1 and proxies all of them
through the single port Replit exposes.

## Importing it

**Import from GitHub rather than from a zip.** Two facts make that the
short path:

- **The repository is public.** No account, no invitation, nothing
  anyone has to grant you. Replit pulls it straight from the URL.
- **The branch you want is already the default.** The code is on
  `claude/v4-proxy-server-s6dcp8`, and that is the repository's default
  branch, so a plain import lands on it. There is no branch to switch
  to afterwards.

The URL:

```
https://github.com/biggvlounge-ctrl/vaco
```

Then:

1. In Replit, create a new Repl and choose **Import from GitHub**
   rather than a blank template. Paste the URL. Replit detects Node.js
   on its own. (If it offers to connect a GitHub account, you can skip
   that — it is only needed for private repositories.)
2. Press **Run**. Nothing needs configuring first: `.replit` is
   committed and points Run at `deploy/replit-boot.sh`, which installs
   dependencies, starts every app on its own local port, seeds demo
   content, and puts the gateway in front of them. **The first boot is
   slow** — it installs dependencies for 36 separate applications.
   Later boots skip that entirely.
3. Open the web view. You land on `vaco-shell`, the launcher. Every
   other app is at `/<app-name>/` — `/void/`, `/vacay/`, `/voken/`.

That is the whole procedure.

### How you know it worked

| Where | What you should see |
|---|---|
| Console | `35 up, 1 down, out of 36 total.` — see "Secrets" below about the one. |
| Launcher | **26 products across 7 sections**, not a flat wall of tiles. Vvltvre is one card containing 5 apps; V3 is one containing 2. |
| Store grouping | A **Group:** control at the top right, with two views. "by category" is the 7 sections above. "by constellation" regroups the same apps by lineage into **■ VOKEN (4), ✕ VVLTVRE (4), ○ SYSTEMS (3), ✕ VOID (4), ▲ GAMES (3), ◇ internal (8)**. Both show 26 products and they disagree on grouping by design — VEX sits with V3 in one and with VOKEN in the other. |
| Any app path | A real page with content in it, not an empty state — demo content is seeded at boot. |
| Sign in | `demo-elena`, `demo-marcus`, `demo-priya`, `demo-kai`, password `demo-pass-1234` for all four. |

Those four are local throwaway logins on a per-boot development
ecosystem, which is why the password is written down here. Do not seed
a deployment that has real users on it.

## Two things to decide before it is more than a demo

### Memory

Measured on the development machine:

| | processes | memory |
|---|---|---|
| all 36 apps | 38 | **0.82–0.86 GB** |
| 5 apps + gateway | 11 | **0.13 GB** |

**This grew on 11 Sep 2026 and the reason is worth knowing.** It was
0.7–0.8 GB until 28 apps gained the Postgres driver. Re-measured rather
than left alone: 819 MB by PSS, 856 MB by the MemAvailable freed on
shutdown. Same two methods, same agreement, a bigger number.

**On how these are measured, because the first attempt was wrong by
3.5x.** Summing RSS across processes double-counts every shared library
page, and 36 Node processes share a great deal of one. That method
reported 2.43 GB. PSS (`/proc/<pid>/smaps_rollup`), which divides shared
pages among the processes using them, and the MemAvailable actually
freed when the stack stops, are two completely different routes to the
same answer — which is why these figures are stated at all. A `ps` RSS
total is not a measurement of anything.

The range rather than a single number is also deliberate. The two
methods do not agree to the megabyte, and the simulation app's world
size and ordinary allocator variance move it between boots, so quoting
one figure to two decimal places would be precision the measurement does
not have.

**The whole ecosystem is a little over four fifths of a gigabyte**, so most
Repls will hold all of it. If yours will not — or if you just want
fewer things running while you look at one app — uncomment `VACO_APPS`
in `.replit`:

```
VACO_APPS = "vaco-shell v3 shield void vacay"
```

An unknown app name is refused with the list of real ones, rather than
silently skipped.

### Secrets

**A demo needs none.** `scripts/deploy-preflight.mjs` reports 30
required environment variables, which reads like a lot of setup, but 27
of them are the inter-service `VACO_TOKEN_*` credentials and
`start-ecosystem.sh` generates those fresh on every boot when they are
not already set. `VACO_OPERATOR_BOOTSTRAP` defaults to empty and the
operator app boots without it. That leaves two a person ever types by
hand, both optional:

| Variable | What it is for | Needed? |
|---|---|---|
| `ANTHROPIC_API_KEY` | Brings `v4-proxy` up. | Optional — without it that one app stays DOWN. |
| `DATABASE_URL` | Puts 29 of the 34 backends on Postgres instead of files. | Set for you automatically when you attach Replit's PostgreSQL. |

They go in Replit's **Secrets** pane, never in `.replit` — that file is
committed to a public repository.

Nothing here invents a default for a secret. An app that refuses to
start without its credential is behaving correctly; it will show as
DOWN in the boot output with the reason in `logs/<app>.log`. `v4-proxy`
without `ANTHROPIC_API_KEY` is the worked example, and it is the "1
down" in the expected `35 up, 1 down` line above.

## The database is optional, and 29 apps will use it if it is there

**Attach Replit's built-in PostgreSQL.** It sets `DATABASE_URL`, and
that one variable is the whole configuration — nothing else to set, and
nothing to run by hand.

With it, 29 of the 34 backends keep their state in Postgres instead of
a file: `vacon-c` loads its own 63-table world schema, and 28 others
keep a document each in a `vaco.stores` table.

The other 5 are not all waiting their turn. **2 apps keep state in JSON
files** — `vaco-shell` and `vaco-analytics`. The remaining 3 keep no
state across a restart at all and are not meant to: `v4-proxy` holds
live call sessions in memory on purpose, and `v4-search` and
`vex-trading` are stateless query layers over other apps' records.

Without it, everything still boots and every app falls back to its
file, which Replit's filesystem keeps between runs. That is fine for a
demo and is what you get if you skip this section entirely.

Two things behave differently when the database is attached but
unreachable, and the difference is deliberate:

- The 28 converted apps **refuse to start** and say why. An app serving
  reads from a store that never loaded would report empty collections
  as though they were real — and for V3, the ledger, that means
  everyone's balance reads as zero and transfers are accepted against
  it.
- `vacon-c` starts an **empty world**, says so in full on stderr, and
  never checkpoints. A simulation whose working set is regenerable is
  still a working demo; it does mean a missing `DATABASE_URL` is silent
  data loss for that app rather than a startup failure.

## What is honest about this

**These config files have never been run on a real Replit container.**
There is no Replit account attached to the work that produced them, so
`.replit` and `replit.nix` are written from the documented schema and
should be treated as a first draft that you correct, not as tested
config. Expect to adjust them.

What *has* been driven for real, on Linux:

- `deploy/replit-boot.sh`, end to end. Doing that found a defect that
  would have failed on Replit every single time: `PORT` is set for the
  gateway, but the app launcher passes its environment to every app it
  starts and every app reads `process.env.PORT`, so all of them tried
  to bind the gateway's port. Fixed, and held by a test.
- `gateway.js` against the booted ecosystem — 33 of 34 apps answered
  200 through one port, the 34th being the one deliberately down.
- The full test suite: 1785 tests across 39 suites.

## What Replit is good for here, and what it is not

**Good for:** showing the whole ecosystem at a URL. Until the gateway
existed, seeing this run meant cloning the repo and starting 36
servers.

**Not good for production, as it stands — but the reason is narrower
than it was.** Three separate limits, and they are not the same limit:

**Without `DATABASE_URL`, nothing here should be scaled.** Every app
falls back to a JSON file, the filesystem on an autoscaling deployment
is ephemeral, and a second instance means a second divergent copy of
everything — including the ledger. Use a **Reserved VM**, or attach the
database.

**With it, exactly one app is safe to run twice.** V3 keeps balances
and transactions as real rows and takes its locks in a fixed order, so
two V3 containers can both write. The other 28 keep a whole document
per app behind an optimistic version check: a concurrent write is
*refused* rather than silently lost, which makes divergence loud but
does not make two writers work. **Do not scale those past one
container.**

**2 apps keep state in JSON files on disk** — `vaco-shell` and
`vaco-analytics`. Same rule, for the older reason.

VACON-C is on Postgres and still must not be scaled past one container,
for a third reason: its working set is one process's memory, so two
replicas would be two divergent worlds checkpointing over each other.

## If you would rather not use Replit

The repo has two other deployment paths, both more suited to
production:

- **Docker Compose** — `deploy/README.md`, "Docker Compose deployment".
  39 services including nginx and Postgres, generated from one manifest.
- **pm2 + nginx on a VPS** — same document, "VPS deployment".

The gateway exists for hosts that cannot do either.

## Where to read next

- `README.md` — how to run it, and the conventions the code follows.
- `SYSTEM_OF_RECORD.md` — what the system currently is: every app and
  port, the authorization posture, what is deliberately not built.
  Every number in it is checked against the tool that produces it by
  `scripts/test/system-of-record.test.mjs`.
- `deploy/README.md` — all three deployment paths in detail.
