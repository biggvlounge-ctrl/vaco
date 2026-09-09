# VDP — Casino-First Starter World (v1)

Direct confirmation: the initial VDP starter world should include
everything needed for a genuine launch, with the casino as the single
most important component, growing outward from there.

The starter world is not "everything at once" — it's the minimum real,
complete world needed, with the casino as the deliberate centerpiece,
not one feature among equals.

```
StarterWorldBuildPriority {
  worldId: "vdp-starter",
  tier1PriorityComponent: "casino",   // confirmed — the single most
                                      // important initial build target
  supportingComponents: [string],     // everything needed to make the
                                      // casino a real, functioning
                                      // centerpiece, not a standalone
                                      // feature
  growthDirection: "outward-from-casino"
}
```

## Real, direct connections to already-established casino content

- **Venus Resort Complex** — riverboat + land casino complex already
  designed as VDP's first-wave build priority; this confirmation
  reinforces that earlier decision.
- **VENVS Crown Resort** — the native VENVS casino district already
  established in the existing VENVS prototype.
- **The Interactive Casino Streaming Layer** — Vavlt Stvdios'
  broadcast/social layer over the casino environment, meaning the
  starter world's casino is also the first real, live content venue for
  creators from day one.

## What "supporting components" means concretely

The casino cannot function in isolation. It needs real minimum
supporting infrastructure:

- VOID water taxis, connecting the riverboat to land.
- Real NPC population with gambling/hospitality-relevant skills —
  dealers, hosts, security.
- VASH/VCoin transaction handling.
- The real compliance review already flagged for gambling-adjacent
  mechanics, before anything real-money-adjacent goes live.

## Honest growth path

Starter world (casino-centered) → surrounding districts building
outward (Food District, Fashion District, other VENVS-native areas) →
broader VDP world expansion, following the World Expansion Trigger
system (data-driven growth, not arbitrary).

**Status: confirmed and locked** — the casino is the deliberate
centerpiece of the VDP starter world, reinforcing the Venus Resort
Complex priority and the Interactive Casino Streaming Layer as one
unified build target.

---

## Implementation status — filed and **built** 2026-08-27

Filed per `VACO.md`'s filing form. Classified **CODE-BEARING**. The
tier-1 component is built: `vdp/src/lib/venusResort.js` and
`VenusResortView.jsx`, with the `vago` district promoted from
`vago-embed` to `vdp-native` — from a doorway to a place. Two venues
(land casino and riverboat), VOID water taxis as the only crossing, NPC
dealers/hosts/security, and tables that open only when a dealer is
standing at them. 25 tests, all eight rules mutation-verified. See
`vdp/dev-docs/phase-18-venus-resort-complex/`.

What follows is what the duplication check found first, because two of
this document's own premises are not what the code says.

### What already exists

- **A `vago` district exists in `vdp/src/lib/world.js`** — `id: 'vago',
  name: 'VAGO Casino'`, at grid position (20, 580). It is
  `contentType: 'vago-embed'`, which in VDP's own taxonomy is a
  *lounge-style entry point into the standalone app*, not a native
  walkable space. So the casino is present as a doorway and absent as a
  place — which is precisely the gap this document asks to close.
- **The Interactive Casino Streaming Layer is real and built**:
  `vavlt-stvdios/lib/casinoEvents.js`, with its own phase record at
  `vavlt-stvdios/dev-docs/phase-7-casino-events-minimal-slice/`. This
  is the one connection in the list above that is already code.
- **Native-district precedent exists** and is the pattern to follow:
  `foodDistrict.js` and `villageDistrict.js`, the latter with a real
  walkable multi-room interior built in
  `vdp/dev-docs/phase-5-village-district/`.

### Two claims that do not hold, recorded rather than quietly worked around

1. **"Venus Resort Complex … already designed as VDP's first-wave build
   priority."** The name appears only in `vago/README.md`,
   `vago/VAGO_COMPARABLES.md` and Vavlt Stvdios' casino-layer documents.
   There is no design for it in `vdp/` — no district, no lib module, no
   phase record. It is a named intention, not an existing design being
   reinforced.

2. **"VENVS Crown Resort — the native VENVS casino district already
   established in the existing VENVS prototype."** No such district
   exists in `venvs/`. This is the same class of claim VDP's own
   phase-5 record already caught and wrote down: that document asserted
   VAGO's Resort & Casino was "a real walkable destination inside VDP"
   as precedent for the Village, and the phase found no VAGO entry in
   `DISTRICTS` at all — "the doc's own precedent claim is false; this
   district is a first, not a copy."

   Both claims are the same shape, one document apart. Recorded here so
   the third one is recognised on sight.

**None of that changes the instruction.** The casino is confirmed as
the tier-1 build target and that stands on its own; it simply has to be
built rather than assembled from parts that turn out not to exist. The
`vago-embed` district is the honest starting point, and the work is
promoting it from a doorway to a place.

### Gambling compliance — noted, not assumed closed

This document names "the real compliance review already flagged for
gambling-adjacent mechanics, before anything real-money-adjacent goes
live." That review is not recorded as complete anywhere in this repo.
VDP's casino district must therefore stay on in-world VCoin/VASH and
must not acquire a real-money path in this phase.
