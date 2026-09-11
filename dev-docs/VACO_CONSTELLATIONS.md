# The VACO Constellations — a square, two X's, a triangle, a circle, and an internal layer

**Date:** 2026-08-26, shapes revised 2026-08-28, internal layer and
stale roadmap lines corrected 2026-09-11 · Supersedes the earlier
six-triangle draft, and the three-squares/two-triangles revision below it.
Depends on `dev-docs/CVLTVRE_AND_VADO_EXTRACTION_AUDIT.md`, which
establishes CVLTVRE and VADO as parents.

Grouped to direct instruction. Where the instruction was explicit it was
followed exactly; three placements were ambiguous and were decided by
the founder rather than guessed. This document records which is which.

---

## The map

```
■ VOKEN                ✕ VVLTVRE               ○ SYSTEMS
   VOKEN                  Vvltvre                 V3
   VEX                    Vault                   V4
   VADO                   VXLLAGE                 VENVS
   CVLTVRE                CHOPZ

✕ VOID                 ▲ GAMES                 ◇ internal — not public
   VOID                   VDP                     VACON
   HVNTZ                  VACON-C                 VSAFE
   CVNVO                  VAGO                    VACO Analytics
   VACAY                                          VACO Notify
                                                  Shield
                                                  VACO Audit
                                                  VACO Operator
                                                  VACO Media
```

**18 public parents. One square, two X's, one triangle, one circle.**
No parent in two places, none left out. The eight in ◇ sit outside the
public structure entirely, because none of them is an app a customer
opens.

**The internal layer was drawn with three and now holds eight.** VACO
Notify, Shield, VACO Audit, VACO Operator and VACO Media were all built
after 2026-08-26 — this document still refers to `vaco-notify` below as
unbuilt "task #123", which is how you can tell. The public eighteen have
not changed at all; only the internal list grew, and it grew silently,
which is exactly the kind of omission
`scripts/test/constellations.test.mjs` now prevents: every app the
registry carries must be placed here by name or listed as deliberately
unplaced.

**This map is now machine-readable.** `vaco-shell/lib/registry.js`
exports `CONSTELLATIONS`, and the test parses the block above and holds
the two to each other in both directions — a name added here and not
there, or there and not here, fails the suite.

## The shape vocabulary, and why each is what it is

Revised 2026-08-28 by decision. **Membership did not change** — every
parent sits exactly where it sat before. What changed is the glyphs, so
each shape now says something the reader can rely on:

| shape | means | count |
|---|---|---|
| ■ / ✕ | a group of **four** | 4 each |
| ▲ | a group of **three** | 3 |
| ○ | a group of three that is **shared infrastructure** | 3 |
| ◇ | **not public** — nothing a customer opens | 8 |

**◇ is the one shape whose count is not part of its meaning**, and that
is why it can be 8 while ■ and ✕ must stay at 4. The other glyphs encode
a group size; ◇ encodes a boundary. An internal service added later
joins it without disturbing anything, which is what happened five times
between 2026-08-26 and 2026-09-11.

**■ and ✕ both mean four, and the X was chosen because it *is* a
four** — four arms, the same count it marks. Three groups of four and
only one square meant two of them needed a second marker rather than a
regrouping; nothing was merged or dissolved to make the shapes tidy.

**Which four keeps the square is not arbitrary.** VOKEN is the only one
of the three whose membership was directed outright — "VEX added to the
square by instruction." VVLTVRE and VOID each gained their fourth member
from the "decided when asked" list below (CHOPZ and VACAY respectively).
So ■ marks the four that arrived whole, ✕ the two that were completed by
a decision. That rule is cosmetic and easy to flip; it is written down
so the assignment is checkable rather than a matter of taste.

**○ moved from GAMES to SYSTEMS**, and now means shared infrastructure
rather than "a three". V3, V4 and VENVS are what the other constellations
are built on, and a circle reads as the thing at the centre rather than
one group among equals. GAMES keeps ▲ as the only plain three.

**These constellations are not `vaco-shell`'s bundles.** The shell's
registry groups the same apps six ways too — Financial & Trading,
Commerce & Marketplace, Social & Discovery, Leisure & Entertainment,
Gamified & Simulation, Operations & Infrastructure — but by *what a
customer is looking for*, not by lineage. VEX sits with V3 and VAGO
there and with VOKEN here, and both are right for their own purpose.

**This paragraph used to end "nothing in the codebase reads these
glyphs; changing them changes this document and nothing else." That is
no longer true, by decision, on 11 Sep 2026.** The App Store has a
grouping control offering both views, `/api/constellations` serves this
map, and changing a name here now changes what a visitor sees. The
reason for the change was that the store read as one flat wall of
bundles — the structure existed and nothing showed it.

The two groupings still disagree on purpose and neither is being
retired. What changed is only that both are now visible.

**The internal layer took ◇ so that ○ means one thing.** It was drawn
as ○ before, which now collides with SYSTEMS. The public/internal line
is the sharper of the two distinctions in this document and was kept
distinct rather than merged: VACON, VSAFE and VACO Analytics are real
and running, and none of them is an app anybody opens.

---

## ■ VOKEN — the card economy

**VOKEN · VEX · VADO · CVLTVRE (CVLTVRE)**

*Directed. VEX added to the square by instruction.*

VEX belongs here on lineage, and the repo records it: VEX was extracted
**out of** VOKEN (task #92), `voken/dev-docs/phase-4-vex-brokerage/` and
`phase-16-vex-extracted-to-standalone-app/` document both halves of that
move, and `voken/VEX_VADO_RESTRUCTURING.md` was written about exactly
this pair. Grouping VEX back with VOKEN restores a relationship that
already exists in the history.

The other three are not merely related — they are **one running
process**. `voken/` is 65 routes and 27 modules; an art card *is* a
Cvltvre Card with `category: 'art'`; VADO's auctions call the Cvltvre
card engine's `transferEditionOwnership` in the same tick as the VCoin
transfer.

- **Shared roadmap:** VOKEN's eight untested money flows (packs,
  raffles, trades, auction settle, fractional buy, secondary shares,
  merch, referral spins), plus VEX's untested compliance gates.
- **Shared risk:** VOKEN has one test file and it covers the compliance
  gate, not the money. VEX has 7 untested routes and is gated pending
  broker-dealer registration.
- **Do not** split VADO into its own service — see the extraction audit.
  Every reason still holds now that VEX is in the square.

---

## ✕ VVLTVRE — content and presence

**Vvltvre · Vault · VXLLAGE (Village) · CHOPZ**

*Vvltvre, Vault and Village directed. CHOPZ placed here by decision.*

Four content surfaces: Vvltvre (Music, Flix, Pods, Studios, VENVM),
Vavlt Stvdios (multi-channel live, 8-screen sessions, VOD), VXLLAGE
(feed, threads, villages, Live, Call), CHOPZ (short-form feed, with
CHOPZ SHOP riding along).

- **Shared roadmap — the sharpest in the set.** All four are blocked on
  **one decision**: the media vendor. Flix cannot play, Pods cannot
  stream audio, Vault cannot show a feed, CHOPZ cannot play video,
  VENVM cannot generate media, and VXLLAGE's Live and Call have the same
  dependency. See `dev-docs/MEDIA_INFRASTRUCTURE_DECISION.md` and
  Acceleration Matrix §9.
- **Vavlt Stvdios is the only member that genuinely needs an SFU**
  (LiveKit, 8-screen). Flix, Pods and CHOPZ are storage + CDN.
- **Cheapest unblock for the whole group:** Vvltvre Pods on object
  storage + CDN. No SFU, no vendor negotiation, one product that works.
- **Test posture:** strong except at one corner — Flix 12, Studios 11
  (including a 12-month rounding-drift test), VXLLAGE 13, CHOPZ SHOP 11.
  **Vvltvre Pods has none** (17 routes), and CHOPZ itself has none (5).

---

## ○ SYSTEMS — V3 · V4 · VENVS

*Directed.*

| | Holds |
|---|---|
| **V3** | The VCoin/VASH ledger and VACA identity. 18 apps settle through it |
| **V4** | Agent proxy, Search, and the whole Maps layer |
| **VENVS** | Marketplace, shop, publishing |

- **Shared roadmap:** this is where every ecosystem-wide fix lands
  first — off-host backups, `requireActor`, OpenTelemetry, the Postgres
  move for the ledger. **The Postgres move is done** (11 Sep 2026):
  V3's balances and transactions are real rows, and 28 more apps keep a
  document each in `vaco.stores`. Off-host backups are still open.
- **Shared risk:** a bug in V3 or V4 is 29 apps' bug. This said "there
  is currently **no mechanism by which V3's ledger survives the loss of
  one disk** — the largest under-weighted risk in the repository," and
  that was true when written. With `DATABASE_URL` set the ledger is in
  Postgres and two V3 containers can both write it. **The disk risk has
  moved rather than gone**: it is now the database's disk, and there is
  still no off-host backup, so the sentence is corrected rather than
  deleted.
- **VENVS is the loose member, and it is worth saying so.** It is a
  consumer marketplace sitting with two pieces of infrastructure. The
  one thing it genuinely shares is a frontend problem: **VENVS and VDP
  are the only two frontends in the repo outside the design system** —
  both predate it and build separately as Vite apps. That migration is
  real work and it belongs to VENVS wherever VENVS sits.
- VACA (8 routes) and V4 Search (2 routes) are both untested. VACA is
  the identity gate other apps trust.

---

## ✕ VOID — the real world

**VOID · HVNTZ · CVNVO (Combo) · VACAY**

*VOID, HVNTZ and CVNVO directed. VACAY added to the group by decision,
restoring the earlier "Combo, Hunts, vacay" instinct.*

Four products about places, people, and getting things done off-screen:
VOID (25 service verticals, drone and ground routing, stations, plus
VOID MAGIC), HVNTZ (14 revenue streams from one location, plus DREAMS),
CVNVO (11 dating formats, plus YAP), VACAY (Stays, Experiences, Auto,
Homes, Flights).

All four consume the V4 Maps layer. That is the real technical thread —
VOID for dispatch, HVNTZ for proximity, CVNVO for matching range, VACAY
for location.

**This group is where the grouping earns its keep.** Counting the 180
untested routes from `COMPLETION_AUDIT.md` §3.2 by constellation:

| Constellation | Untested routes |
|---|---:|
| **✕ VOID** | **126** |
| ✕ VVLTVRE | 22 |
| ○ SYSTEMS | 10 |
| ▲ GAMES | 8 |
| ■ VOKEN | 7 *(plus 8 untested money flows)* |
| ◇ internal | 7 |

**126 of 180 untested routes sit in this one group** — cvnvo 59,
hvntz 40, dreams 22, yap 5. That concentration was invisible in a flat
list of parents.

And it is a group of extremes rather than a uniformly weak one: **VOID
is the best-tested app in the ecosystem** (158 routes, 124 tests, one
settlement path for all 25 verticals), and VACAY has 22. The untested
126 belongs entirely to HVNTZ, CVNVO, DREAMS and YAP.

- **Shared roadmap:** moderation and the notification channel. YAP has
  no moderation queue — nothing reviews a report before it counts
  against a subject — and DREAMS alerts page nobody. One build fixes
  both.
- **Shared risk:** YAP is recorded in the company tree as the highest-
  liability item in the ecosystem, and VOID carries the licensing gates
  on `cannabisDelivery` and `medicalTransportation` that **must not be
  relaxed**.

---

## ▲ GAMES — VDP · VACON-C · VAGO

*The two games directed. VAGO placed here by decision.*

This pairing already exists in code and was not invented for this
document: `vaco-shell/lib/registry.js` bundles **both `vdp` and
`vacon-c` as `Gamified & Simulation`** today.

- **VDP** — the walkable world, 22 districts, the Food District's 11
  owned brands
- **VACON-C** — the civ-sim engine, **paused by decision**, scoped to
  its live 5-endpoint contract
- **VAGO** — prediction markets, sportsbook, esports, casino, fantasy,
  Gold Coin, AMOE

- **Shared roadmap:** VDP's migration onto the design system (it is one
  of the two Vite frontends outside it), and VAGO's compliance posture.
- **VACON-C stays paused.** Its presence in a public constellation is a
  statement about what it *is*, not permission to resume it.
- **Honest note on VDP:** VDP is a surface *over* the other seventeen —
  it embeds districts for VOID, HVNTZ, CVNVO, VACAY, Vvltvre, Vault,
  VOKEN, VADO, VEX, VENVM and Analytics. Any constellation it sits in is
  a partial truth. It is here because it is a world you walk around in,
  which is the most honest single answer.

---

## ◇ Internal — not public-facing

**VACON · VSAFE · VACO Analytics · VACO Notify · Shield · VACO Audit ·
VACO Operator · VACO Media**

*Directed: VACON is not an app the public sees, so it does not belong in
a public constellation. The five added on 11 Sep 2026 follow the same
rule — none is an app anybody opens.*

| | What it is | Who consumes it |
|---|---|---|
| **VACON** | The operating network — 14 agents | Internal operations |
| **VSAFE** | The shared safety layer | 6 apps, including CVNVO |
| **VACO Analytics** | The corporate command center | Internal management |
| **VACO Notify** | The one notification channel | VSAFE, DREAMS, Analytics |
| **Shield** | The session layer | Every app that reads `SHIELD_API_URL` |
| **VACO Audit** | The append-only decision record | Every Group-2 route |
| **VACO Operator** | Human-operator credentials and scopes | Group-2 routes |
| **VACO Media** | The media control plane | Vault, Flix, Pods, CHOPZ, VXLLAGE |

These are real, running, and load-bearing — VSAFE especially, since
check-ins, screening and escalation are live mechanics that CVNVO
depends on. They are simply not products a customer opens, and the
public structure should not pretend otherwise.

**The split inside the old VACON-C parent** is deliberate: VACON-C the
game went to ▲ GAMES; VACON the agent network and VSAFE the safety layer
stayed internal. One parent, two different kinds of thing.

- **Consequence worth stating — and since resolved.** This read: "VSAFE
  escalations currently **page nobody**. A safety escalation with no
  notification channel is not a degraded feature — it is a promise the
  product does not keep. Being internal does not lower its priority;
  `vaco-notify` is task #123." VACO Notify was built; it is in the table
  above and running on 8818. The original wording is kept because the
  argument it makes is the reason the app exists.
- VACO Analytics has 7 untested routes.

---

## What each constellation needs next

Drawn from `VACO_ACCELERATION_MATRIX.md` and `COMPLETION_AUDIT.md`. The
grouping does not create new work — it makes clear which work is one job
and which is four.

| | Next | Why |
|---|---|---|
| **✕ VOID** | Tests for CVNVO, HVNTZ, YAP · a moderation queue · the notification channel | 126 untested routes, and the highest-liability product has no review step |
| **○ SYSTEMS** | Off-host backups · CI · `requireActor` · tests for VACA | A gap here is 29 apps' gap. The Postgres move landed 11 Sep 2026; the backup gap did not |
| **■ VOKEN** | VOKEN's eight money flows · VEX's compliance gates | Precondition for any restructuring of the VOKEN four |
| **✕ VVLTVRE** | The media vendor decision — start with Pods on storage + CDN | One decision unblocks six surfaces; blocked on judgment, not effort |
| **▲ GAMES** | Migrate VDP onto the design system | One of the last two frontends outside it |
| **◇ internal** | *(done — VACO Notify shipped)* · tests for Analytics' 7 routes | VSAFE escalations had no channel; they now have one |

---

## Decisions recorded

So this can be re-litigated against what was actually decided rather
than what was inferred.

**Directed explicitly:**
- VOKEN · VADO · CVLTVRE together, with **VEX added** to make a square
- Vvltvre · Vault · VXLLAGE together
- V3 · V4 · VENVS together
- VOID · HVNTZ · CVNVO together *(superseding an earlier "Combo, Hunts,
  vacay")*
- VDP and VACON-C — "the two games" — together
- VACON excluded from the public structure

**Decided when asked, not guessed:**
- **VACAY** → the VOID group (now ✕), making it a four
- **CHOPZ** → the VVLTVRE group (now ✕), making it a four
- **VACON-C parent split** → the game public, VACON and VSAFE internal

**Resolved, not open:** "Vulcan" in the directive was **a typo for
VOKEN**, confirmed by the founder. It is read as VOKEN throughout and
there is no missing entity here.

**Still undefined, one level higher:** **VVI**, the grandparent above
VACO, appears in exactly two places in the repo — one line in
`void/lib/taas.js` and a matching line in `void/README.md` — both citing
a `QUICK_INNOVATION_THREAD.md` that is not in the repository. That one
is real and still open. It does not block anything in this structure.

**`vaco-shell` is deliberately in no constellation.** It is the launcher
and session host over all eighteen, the way the design system sits under
all 29 frontends.
