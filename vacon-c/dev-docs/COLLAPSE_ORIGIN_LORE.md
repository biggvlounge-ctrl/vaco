# Collapse-origin lore — task #108

**What this is, and what it is not.** `VACANCY_CONSOLIDATED_MASTER_SPEC.md`
§1 opens on "the game begins after a civilization-collapse event" and
never says what that event was — deliberately, per its own header,
since nothing about the engine needs a cause to simulate the
aftermath. This document gives the collapse a real-feeling origin for
players who want one, closing task #108's own request: "digital-
currency grid transition, Iran/Hormuz, Haiti/Chad troops." It is
**narrative only** — no code changed, no mechanic reads this file, the
same posture task #132 ("regional cryptid/folklore landmarks... for
lore") is scoped to. §9's own firewall still applies in full: nothing
here determines an NPC's morality, criminality or worth, and nothing
in `server/` is required to read it.

**The honest boundary, stated rather than blurred.** Three of this
story's anchors are real, dated, checkable events; the trigger that
turns them into a *global* collapse is invented, because no such
collapse has happened. Mixing those two kinds of fact without marking
which is which would be exactly the mistake this project's whole
documentation discipline exists to catch — so here it is, marked.

## The three real anchors

1. **Israel-Iran war and the Strait of Hormuz closure — already real,
   already in this engine, not re-researched here.**
   `server/countryPacks.js`'s `israeli.warStatus` and
   `iranian.warStatusRef` entries carry the real, dated detail: a war
   that began 28 Feb 2026, a ceasefire in April that did not fully
   hold, renewed strikes reported 8 Jul 2026 after attacks on Gulf
   shipping, and a real `globalEconomicSpillover.hormuzClosure` —
   ~20% of global oil supply disrupted starting 4 Mar 2026, Brent
   crude surging past $120/bbl, a worldwide fuel crisis in countries
   that import through the Gulf. `countryPacks.js`'s own sourcing
   (dawn; cbsnews; foxnews; abcnews; multiple secondary compilations)
   and confidence flags carry over unchanged — this document adds no
   new claim about the war itself.

2. **Chad's troops deploying to Haiti's Gang Suppression Force —
   real, checked directly for this round, not assumed.** Reporting
   from March-April 2026 (Reuters via theprint.in; AFP via
   jamaica-gleaner.com, ewn.co.za, jamaicaobserver.com; africanews.com)
   has Chad committing up to 1,500 troops/police and gendarmes to the
   UN-backed force succeeding the earlier Kenya-led mission, with
   roughly 400 already in-country by late April and the UN Security
   Council having approved expansion of the whole force to 5,500.
   `server/countryPacks.js`'s own `haitian.gangCrisis2026` block
   already carries the real underlying crisis this deployment answers
   (90% of Port-au-Prince gang-controlled, 1.5 million displaced,
   Jimmy "Barbecue" Cherizier named directly) — Chad's deployment is
   the missing "the world is already spending its remaining capacity
   here" data point this document adds on top of it, not a
   replacement for it.

3. **No real digital-currency/power-grid collapse exists, and the
   reporting on the adjacent real risks is clear about that.** Checked
   directly rather than assumed: IMF and BIS material on CBDC cyber
   resilience (2024) describes real, studied THREATS — DDoS,
   intrusion, a hypothetical quantum attack on Fedwire modelled by the
   Hudson Institute at a 10-17% GDP hit — never an event. Separately,
   NERC's own estimate (cited via CSIS) of the US grid gaining roughly
   60 new vulnerable points a day from digitalisation, and CSIS's own
   direct finding that the real Iran conflict above has measurably
   heightened cyber threats to US energy infrastructure, are both
   real and current. Nothing found ties a digital-currency transition
   to an actual grid failure anywhere. That gap is the seam task #108's
   own fictional premise is built across.

## The fictional synthesis — what VACON-C's own world holds as "what happened"

Sometime after the real events above, most major economies complete
a long-planned shift of their core payment settlement systems onto a
small number of centralized, software-defined digital-currency
clearing networks — the real-world CBDC rollouts cited above, taken to
their logical, not-yet-real conclusion. The efficiency case was real;
so was the warning, in the same real sources, that concentrating
settlement onto one digital rail concentrates risk onto it too.

The Iran war's real cyber spillover — the heightened threat CSIS
already documents against energy infrastructure, compounding on an
already real ~60-new-vulnerability-a-day grid — is VACON-C's own
fictional proximate cause: a cyberattack reaches through an energy
operator's own settlement connection into the shared clearing layer
underneath the new digital-currency rails. It does not have to be
sophisticated everywhere at once; it only has to be sophisticated
once, against a system every other system had just finished making
load-bearing. Power and payment fail together, in the places that had
just finished removing their own redundant, older systems — a single
point of failure the real sourcing above warned about and VACON-C's
own fiction is the one place that warning actually lands.

Haiti is not where the collapse starts. It is where the **shape** of
it was already visible months before anyone else's lights went out:
a state with no elected government since 2016, a security mission
that had to replace its lead nation mid-mission, and a reinforcing
nation (Chad — `countryPacks.js`'s own entry: low-income,
authoritarian-regime, no real regime-score agreed across sources)
sending the troops it has anyway. When the wider grid goes, there is
no reserve capacity anywhere to send — because the real world, right
up until that point, had already been spending what little it had on
exactly this.

## What this does and does not change

- **Nothing in `server/` reads this file.** `countryPacks.js`'s own
  `israeli`/`iranian`/`haitian` entries are unchanged — this document
  cites them, never edits them, and they stay exactly as real and as
  current as they already were.
- **The game's own "ZERO CIVILIZATION PERIOD" (master spec §4) is
  unchanged.** This document gives it a cause; it does not change
  what the period itself contains.
- **No calendar anchor for tick 0 is claimed.** Nothing in `server/
  behavior.js`/`worldgen.js` ties a tick count to a real date (`a tick
  is a day`, per `TICK_INTERVALS`'s own header, is the only real
  anchor that exists), so this document does not invent one either —
  "shortly after" the real 2026 events above is as precise as this
  gets, honestly.
- **A future round could make this discoverable in-world** (a
  `historical_records` row a player could actually find, the way
  `discovery.js`'s own book pools already grant knowledge) — that is
  a real, separate mechanic this document does not build, named here
  so it is not mistaken for an oversight.
