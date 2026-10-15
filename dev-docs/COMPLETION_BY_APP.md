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
were 37 and 2775.

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

1. **Real-time media.** Vvltvre Flix, Vvltvre Pods, CHOPZ, and Vavlt
   Stvdios' on-demand Video primitive are wired end to end (as of 15 Oct
   2026) — what's left for those four is real object storage + a CDN,
   a vendor/budget line, not a code gap. Three surfaces still can't do
   their core thing for reasons that stay blocked either way: Vavlt
   Stvdios' *live* eight-screen wall cannot show a feed (needs a
   real-time transport vendor, separate from the Video primitive above),
   VENVM cannot generate media (a real AI-video-vendor decision), and
   DREAMS has no display (no screen hardware exists anywhere in this
   ecosystem). See `dev-docs/MEDIA_INFRASTRUCTURE_DECISION.md`.
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
| Express backends in the manifest | **37** |
| Overall criteria met | **100%** (285/285) |
| Apps at 100% | **37 / 37** |
| Tests | **2775** |
| Apps with no test suite | **0** |

Two notes on that test count, so it is not read as contradicting
anything else:

- It is **lower than `scripts/run-all-tests.mjs`'s**, and both are
  right. This table counts only the 37 Express backends in the
  manifest. The full run also covers the Vite frontends (VDP, VENVS),
  the shared `scripts/` suites, `world-layer` and `vaco-mcp` — real
  tests, but not any single manifest app's.
- It counts each suite's **size**, passing plus skipped, not passes
  alone. Suites that boot a real server skip themselves when the app's
  dependencies are absent, so counting passes would make this document
  read differently depending on where it was generated. Every suite
  here is at zero failures — that is the "Suite passes" column, and it
  is checked separately.

---

## Per app

| App | Complete | Met | Serves HTTP | Has a frontend | On the design system | Persists to disk | Has a test suite | Suite passes | Every mutating route accounted for | In all three deploy paths | Tests |
|---|---:|---:|---|---|---|---|---|---|---|---|---:|
| `chopz` | **100%** | 8/8 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 8 |
| `chopz-shop` | **100%** | 8/8 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 16 |
| `cvnvo` | **100%** | 8/8 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 23 |
| `dreams` | **100%** | 8/8 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 37 |
| `hvntz` | **100%** | 8/8 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 100 |
| `shield` | **100%** | 8/8 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 16 |
| `v3` | **100%** | 8/8 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 120 |
| `v4-proxy` | **100%** | 7/7 | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | ✅ | 59 |
| `v4-search` | **100%** | 7/7 | ✅ | ✅ | ✅ | — | ✅ | ✅ | ✅ | ✅ | 21 |
| `vaca` | **100%** | 8/8 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 25 |
| `vacay` | **100%** | 8/8 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 30 |
| `vaco-analytics` | **100%** | 8/8 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 39 |
| `vaco-assistant` | **100%** | 8/8 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 19 |
| `vaco-audit` | **100%** | 6/6 | ✅ | — | — | ✅ | ✅ | ✅ | ✅ | ✅ | 17 |
| `vaco-media` | **100%** | 6/6 | ✅ | — | — | ✅ | ✅ | ✅ | ✅ | ✅ | 52 |
| `vaco-notify` | **100%** | 8/8 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 24 |
| `vaco-operator` | **100%** | 6/6 | ✅ | — | — | ✅ | ✅ | ✅ | ✅ | ✅ | 24 |
| `vaco-passport` | **100%** | 8/8 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 37 |
| `vaco-shell` | **100%** | 7/7 | ✅ | ✅ | — | ✅ | ✅ | ✅ | ✅ | ✅ | 40 |
| `vacon` | **100%** | 8/8 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 18 |
| `vacon-c` | **100%** | 8/8 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 1401 |
| `vago` | **100%** | 8/8 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 120 |
| `vash-tap` | **100%** | 8/8 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 63 |
| `vavlt-stvdios` | **100%** | 8/8 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 21 |
| `venvm` | **100%** | 8/8 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 44 |
| `vex` | **100%** | 8/8 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 25 |
| `vex-trading` | **100%** | 6/6 | ✅ | ✅ | ✅ | — | ✅ | ✅ | — | ✅ | 10 |
| `void` | **100%** | 8/8 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 144 |
| `voidmagic` | **100%** | 8/8 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 29 |
| `voken` | **100%** | 8/8 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 46 |
| `vsafe` | **100%** | 8/8 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 19 |
| `vulture-flix` | **100%** | 8/8 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 17 |
| `vulture-music` | **100%** | 8/8 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 24 |
| `vulture-pods` | **100%** | 8/8 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 13 |
| `vulture-studios` | **100%** | 8/8 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 16 |
| `vxllage` | **100%** | 8/8 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 16 |
| `yap` | **100%** | 8/8 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | 42 |

`—` means the criterion does not apply to that app and is excluded
from both halves of its fraction — an app is never marked down for
lacking something it was never meant to have.

### The criteria

- **Serves HTTP** — a real server.js that answers /api/health
- **Has a frontend** — public/index.html — its own real client
- **On the design system** — a sync-design-system.sh target, so it cannot drift
- **Persists to disk** — state is read back at boot, so it survives a restart
- **Has a test suite** — a test/ directory with at least one running test
- **Suite passes** — zero failures when its own suite is run
- **Every mutating route accounted for** — guarded, or declared open with a stated reason — no route neither
- **In all three deploy paths** — docker-compose.yml, ecosystem.config.js and nginx-docker.conf

---

## Where the shortfalls are

Every app meets every criterion that applies to it.
