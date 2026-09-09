# VACO

**The cumulative record.** Where work belongs — read this before
filing anything; it points to everything else rather than repeating it.

Its job is to stop duplicated work: one place that says where a file
goes, whether it has already been filed, and what is actually coded.

> **For the state of the system rather than the filing of it, see
> `SYSTEM_OF_RECORD.md`.** That is the one complete picture — every app
> and port, the shared modules, the authorization posture, the standing
> rules, the deploy procedure, the verification commands, and what is
> deliberately not built. This document stayed the filing form on
> purpose: the two answer different questions, and merging them would
> mean neither could be trusted as short.

> **Name settled: `VACO.md`.** It was briefly `VACO_COMPLETE.md`. The
> shorter name was chosen deliberately, to keep distance from the
> separate `vaco-complete` GitHub repository — see Part 4. Recorded
> here so the name does not wobble a third time.

---

## Part 1 — The filing form

**Every file lands in exactly one of eighteen homes. There is no
nineteenth.**

| # | Home | Directory | Holds |
|---|---|---|---|
| 1 | CHOPZ | `chopz/` | + `chopz-shop` |
| 2 | CVNVO | `cvnvo/` | + `yap` |
| 3 | HVNTZ | `hvntz/` | + `dreams` |
| 4 | V3 | `v3/` | + `vaca` |
| 5 | V4 | `v4-proxy/` | + `v4-search` |
| 6 | VACAY | `vacay/` | Stays, Experiences, Auto, Homes, Flights |
| 7 | VACON-C | `vacon-c/` | + `vsafe` |
| 8 | VAGO | `vago/` | |
| 9 | VDP | `vdp/` | |
| 10 | VENVS | `venvs/` | |
| 11 | VOID | `void/` | + `voidmagic` |
| 12 | VOKEN | `voken/` | |
| 13 | VXLLAGE | `vxllage/` | |
| 14 | Vault | `vavlt-stvdios/` | |
| 15 | Vex | `vex-trading/` | + `vex`, `vex-business` |
| 16 | Vvltvre | `vulture-music/` | + `-flix`, `-pods`, `-studios`, `venvm` |
| 17 | **VACON** | `vacon/` | The operating network + `shield`, `vaco-analytics` |
| 18 | **VACO Shell** | `vaco-shell/` | Launcher, registry, session host |

**Sub-apps do not get their own home.** They file under their parent.
VENVM files under Vvltvre. DREAMS files under HVNTZ. YAP files under
CVNVO.

**The only exception**: a document that genuinely governs the whole
ecosystem and belongs to no single app goes in `dev-docs/`. That is
rare — four files so far. If you are reaching for it, check twice.

### Before filing anything: the duplication check

This is the whole point of this document. **Run it every time.**

```sh
ls <app>/ | grep -i <KEYWORD>        # is it already here under another name?
git ls-files '*.md' | grep -i <KEY>  # is it anywhere else in the repo?
```

Three real cases already caught by doing this:

- `VOKEN_ARCHITECTURE.md`, `VAGO_ARCHITECTURE.md`, `VACAY_COMPARABLES.md`,
  and three others **already existed** when they were re-sent. They were
  appended to, not overwritten.
- One batch **was** overwritten before the check became routine, losing
  richer original bodies. It had to be restored from git history.
- `V4_CLAUDE.md` was cited in working code (`V4Prototype.jsx` line 101)
  while the file itself had never been saved. Citation is not presence.

**Rule: if the file exists, append a status section. Never replace the
body.**

### Classify every file on arrival

| Class | What it is | When it gets handled |
|---|---|---|
| **CODE-BEARING** | Specifies behavior a service can implement | Now |
| **STRUCTURE-ONLY** | Org charts, cost models, vendor research, positioning | **Last**, per standing instruction |

Structure-only files still get filed under their app immediately — they
just don't generate code. Marking them on arrival is what stops someone
later mistaking a cost table for a build spec.

### What "100%" means per file

A file is complete when it has:

1. A home under one of the eighteen.
2. An **Implementation status** section stating what is actually built,
   verified against code — not against another document.
3. Its unbuilt items named specifically enough to act on.

A file is *not* complete because it was pasted in.

---

## Part 2 — What is coded, by home

Verified by booting the ecosystem: **32 services up, 0 down.** Module
and route counts are from source.

| Home | Coded | Modules | Routes | State |
|---|---|---|---|---|
| **VOID** | **Yes — largest app** | 33 + 12 | 119 + 33 | 25 verticals, drone/ground routing, stations, staffing, lockers, TaaS. VOID MAGIC: bookings, 15.5% take, refunds |
| **VOKEN** | **Yes** | 27 | 63 | Cvltvre Cards, auctions, fractional shares, resale, VACA-verified grading, 2 compliance gates |
| **VXLLAGE** | **Yes** | 19 | 64 | Posts, feed, profiles, follows, villages, search, cosmetics |
| **CVNVO** | **Yes** | 19 + 3 | 59 + 5 | Gale-Shapley matching, 11 dating formats, BarBuddy, VSAFE-backed. YAP decoupled |
| **Vault** | **Yes** | 18 | 57 | Multi-channel streaming, 8-screen sessions, VOD, casino events |
| **VACON-C** | **Yes** (`vsafe`) / **paused** (civ-sim) | 15 + 0 | 43 + 7 | VSAFE: check-ins, ID verification, 6 source apps. Civ-sim paused |
| **HVNTZ** | **Yes** | 13 + 6 | 40 + 22 | 14 revenue streams, businesses, hunts. DREAMS: screens, campaigns, offline cache |
| **VAGO** | **Yes** | 13 | 39 | Prediction markets, sportsbook, esports, casino, Gold Coin, AMOE, provably-fair |
| **Vvltvre** | **Yes** | 23 across 5 | 84 | Music (royalties, labels, beats), Flix, Pods, Studios, VENVM |
| **V3** | **Yes — has tests** | 6 + 4 | 6 + 8 | Canonical ledger, 18 apps settle here. VACA attestation |
| **V4** | **Yes** | 4 + 0 | 17 + 2 | Agent interface, twin profiles, 5 surfaces, call flow, cross-app search |
| **VACON** | **Yes** | 4 + 4 | 6 + 12 | 14 agents, routing, invoke. Shield (tests), VACO Analytics |
| **CHOPZ** | **Yes** | 3 + 5 | 4 + 10 | Native checkout, category fees, affiliate splits |
| **VDP** | **Yes — frontend** | 33 | — | The walkable world. Districts for most apps |
| **VENVS** | **Yes — frontend** | 9 | — | Marketplace, shop, publishing |
| **Vex** | **Yes** | 5 + 127 files | 7 + 3 | Brokerage (gated). Vex Business is a Python monorepo, **deploys separately** |
| **VACAY** | **Thin** | 2 | 1 | 5 sections real, fewest modules of any built app |
| **VACO Shell** | **Yes** | 2 | 10 | Launcher, registry, session host |

**Totals: 239 modules, ~700 routes, 24 apps persisting to disk.**

**Every one of the eighteen has running code.** None are empty. The
thinnest is VACAY.

Per-app ports, volumes, and the deployment chain: see
`dev-docs/DEPLOYMENT_INVENTORY.md`. Directory dispositions and the
per-app Docker build-context rule: see
`dev-docs/DEPLOYMENT_FILE_PLACEMENT.md`. **This file does not repeat
them.**

---

## Part 3 — The document ledger

**110 app-level documents** are filed across the eighteen homes.
**41** carry a verified Implementation status section.

| Home | Docs filed | Reconciled |
|---|---|---|
| VOID | 16 | 6 |
| VACON-C | 12 | 2 |
| Vvltvre | 10 | 5 |
| CVNVO | 7 | 5 |
| V4 | 7 | 4 |
| CHOPZ | 6 | 1 |
| HVNTZ | 6 | 1 |
| V3 | 6 | 4 |
| VACON | 6 | 2 |
| VOKEN | 6 | 4 |
| VENVS | 5 | 0 |
| VAGO | 4 | 2 |
| VXLLAGE | 4 | 1 |
| Vault | 4 | 0 |
| VACAY | 3 | 1 |
| VACO Shell | 3 | 2 |
| Vex | 3 | 0 |
| VDP | 2 | 0 |

Plus `dev-docs/` (8), `world-layer/` (4), root README (1).

**Against the 259 available**: 110 are filed at app level. That count
is not a claim about which 259 — some filed docs were written here
rather than pasted, and some of the 259 may duplicate each other. The
honest reading is that **roughly 40% of the corpus has a home, and
about a third of those are reconciled against code.**

The gap worth watching is the **reconciled** column, not the filed
one. VENVS, Vault, Vex, and VDP have documents on disk with nothing
checking them against the code — those are where a stale claim is most
likely still sitting unnoticed.

---

## Part 4 — On the name

There is a `vaco-complete` repository on GitHub under this account,
last updated 2026-08-20. This file is *not* that repo and does not
sync to it. Dropping "COMPLETE" from this filename is partly to keep
that distinction visible: `VACO.md` is the in-repo record,
`vaco-complete` is a separate thing on GitHub. If they are meant to be
the same, that still needs deciding before either is treated as
canonical — otherwise there are two records disagreeing, which is the
exact failure this file exists to prevent.

## Part 5 — Standing instruction: GitHub

**Do not attempt GitHub pushes. Do not raise the topic.** The founder
is handling the reconnect separately, on their own timeline.

Background, recorded once so it does not need rediscovering: the app
installation lacks `Contents: write` on this repository. Read works
(`get_me`, `list_branches`, `search_repositories` all succeed); write
returns `403 Resource not accessible by integration` from both the
API and the git CLI. `add_repo` with `access: "push"` issues no new
credentials. This is a permission scope, fixable only outside the
session — retrying is wasted effort.

**Keep committing locally as normal.** Commits are the record. When a
batch is worth handing over, rebuild the archive:

```sh
git archive --format=zip -o vaco-<date>.zip HEAD
```

That is the delivery path until the founder says otherwise.
