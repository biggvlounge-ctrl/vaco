# VACO — Completion by App

**GENERATED FILE — do not edit.** Re-run:

    node scripts/completion-report.mjs

Every number below was measured from this repository at generation
time: the app manifest in `start-ecosystem.sh`, the three generated
deploy artifacts, `scripts/audit-route-guards.mjs`'s own output, and
each app's test suite actually executed. Nothing here is recalled.
`scripts/test/completion-report.test.mjs` fails if this file drifts
from what the script emits, which is the failure mode that made
`COMPLETION_AUDIT.md` read 31 apps and 522 tests when the real numbers
were 34 and 1020.

---

## What this number means — and what it does not

The percentage is **not a judgement**. It is the count of named,
individually checkable criteria an app meets, out of the criteria that
apply to it. Every column below can be verified by hand.

It measures **infrastructure completeness against this ecosystem's own
standards**: does the app serve, persist, authorise, get tested, ship
in the design system, and land in all three deployment paths.

> ### It is NOT a measure of product depth.
>
> An app can score 100% and still not do the thing its users want. Two
> apps at 100% can be very different amounts of built software. A high
> score means nothing structural is missing, not that the product is
> finished.

**Three real gaps this table cannot see**, all of them larger than
anything it can:

1. **Real-time media.** Six surfaces cannot do their core thing —
   Vvltvre Flix cannot play, Vvltvre Pods cannot stream, Vavlt Stvdios
   cannot show a feed, CHOPZ cannot play video, VENVM cannot generate
   media, DREAMS has no display. Blocked on a vendor decision, not
   effort. See `dev-docs/MEDIA_INFRASTRUCTURE_DECISION.md`.
2. **Docker has never been build-tested** (#128) and **backups are
   same-host only** (#125). Both blocked on infrastructure, not work.
3. **A guard being present is not a guard being right.**
   `audit-route-guards.mjs` says so in its own output:
   `requireSession()` where an ownership lookup belongs still counts
   as guarded, and that was a real bug once.

---

## Headline

| Metric | Value |
|---|---:|
| Express backends in the manifest | **34** |
| Overall criteria met | **99%** (259/260) |
| Apps at 100% | **33 / 34** |
| Tests passing | **1020** |
| Tests skipped | **71** |
| Apps with no test suite | **0** |

The test count is lower than `scripts/run-all-tests.mjs`'s, and both
are right: this table counts only the 34 Express backends in the
manifest. The full run also covers the Vite frontends (VDP, VENVS),
the shared `scripts/` suites, `world-layer` and `vaco-mcp` — real
tests, but not any single manifest app's.

---

## Per app

| App | Complete | Met | Serves HTTP | Has a frontend | On the design system | Persists to disk | Has a test suite | Suite passes | Every mutating route accounted for | In all three deploy paths | Tests |
|---|---:|---:|---|---|---|---|---|---|---|---|---:|
| `chopz` | **100%** | 8/8 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 8 |
| `chopz-shop` | **100%** | 8/8 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 11 |
| `cvnvo` | **100%** | 8/8 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 13 |
| `dreams` | **100%** | 8/8 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 12 |
| `hvntz` | **100%** | 8/8 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 14 |
| `shield` | **100%** | 8/8 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 12 |
| `v3` | **100%** | 8/8 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 70 |
| `v4-proxy` | **100%** | 7/7 | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | ✅ | 30 |
| `v4-search` | **100%** | 7/7 | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | ✅ | 15 |
| `vaca` | **100%** | 8/8 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 17 |
| `vacay` | **100%** | 8/8 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 22 |
| `vaco-analytics` | **100%** | 8/8 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 34 |
| `vaco-audit` | **100%** | 6/6 | ✅ | — | — | ✅ | ✅ | ✅ | ✅ | ✅ | 16 |
| `vaco-media` | **100%** | 6/6 | ✅ | — | — | ✅ | ✅ | ✅ | ✅ | ✅ | 51 |
| `vaco-notify` | **100%** | 8/8 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 17 |
| `vaco-operator` | **100%** | 6/6 | ✅ | — | — | ✅ | ✅ | ✅ | ✅ | ✅ | 20 |
| `vaco-shell` | **100%** | 6/6 | ✅ | ✅ | — | — | ✅ | ✅ | ✅ | ✅ | 30 |
| `vacon` | **100%** | 8/8 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 18 |
| `vago` | **100%** | 8/8 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 9 |
| `vavlt-stvdios` | **100%** | 8/8 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 10 |
| `venvm` | **100%** | 8/8 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 40 |
| `vex` | **100%** | 8/8 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 16 |
| `vex-trading` | **100%** | 6/6 | ✅ | ✅ | ✅ | — | ✅ | ✅ | — | ✅ | 10 |
| `void` | **100%** | 8/8 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 137 |
| `voidmagic` | **100%** | 8/8 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 20 |
| `voken` | **100%** | 8/8 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 37 |
| `vsafe` | **100%** | 8/8 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 17 |
| `vulture-flix` | **100%** | 8/8 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 12 |
| `vulture-music` | **100%** | 8/8 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 12 |
| `vulture-pods` | **100%** | 8/8 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 12 |
| `vulture-studios` | **100%** | 8/8 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 11 |
| `vxllage` | **100%** | 8/8 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 13 |
| `yap` | **100%** | 8/8 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 20 |
| `vacon-c` | **87%** | 7/8 | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ | ✅ | 234 |

`—` means the criterion does not apply to that app and is excluded
from both halves of its fraction — an app is never marked down for
lacking something it was never meant to have.

### The criteria

- **Serves HTTP** — a real server.js that answers /api/health
- **Has a frontend** — public/index.html — its own real client
- **On the design system** — a sync-design-system.sh target, so it cannot drift
- **Persists to disk** — createPersistentStore — state survives a restart
- **Has a test suite** — a test/ directory with at least one running test
- **Suite passes** — zero failures when its own suite is run
- **Every mutating route accounted for** — guarded, or declared open with a stated reason — no route neither
- **In all three deploy paths** — docker-compose.yml, ecosystem.config.js and nginx-docker.conf

---

## Where the shortfalls are

- **`vacon-c`** (87%) — missing: persists to disk

  known and sequenced: `vacon-c/CLAUDE.md`'s own order of operations, step 9 — "Stand up Postgres, migrate off in-memory `WorldState`, keep `/api/*` identical". It is deliberately last, behind the engine work it would otherwise have to be migrated twice for. Until then a restart loses the simulation state.
