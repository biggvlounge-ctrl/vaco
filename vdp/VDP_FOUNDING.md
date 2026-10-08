# VDP — Founding (v1)

Direct confirmation, recorded here so it does not need rediscovering:
VDP is a real, hidden place on Earth — the area beyond Antarctica's ice
wall. The Vaco elite tech team found a way to access it, founded the
first settlement there, and is actively inviting people into a new
tech society being built from the ground up.

**A correction to this document's own first version (9 Oct 2026).**
That version called this place "a new planet." It is not a separate
planet in space — it is a real, undiscovered area of Earth itself,
beyond the ice wall, which is why reaching it took finding a way
IN rather than a way off-world. "VDP (Digital Planet)" stays the
product's own real name regardless — a name given before this detail
of the story was, the same way `town.js` kept "Meridian" through every
other correction in this file. Flagged, not silently reconciled.

This is the real premise behind what the code already does, not a
layer added on top of it — the pieces below already exist and already
match this story; this document is the first place that says so out
loud.

## The premise

- **A real, hidden area of Earth, beyond Antarctica's ice wall** —
  found, not built from nothing, and accessed rather than traveled to.
  Nothing before this document said that in so many words, though
  `settlement.js`'s own header already carried the closest thing to it
  on record: "this is a growing world that's newly inhabited."
- **Found and founded by the Vaco elite tech team.** They are the ones
  who found the way in, the ones who got here first, and the ones
  doing the inviting — not a government, not a company with no face, a
  specific team with a specific reason to be here: building something
  real, from the ground up, somewhere nobody had settled yet.
- **An open invitation, not a closed colony** — and a real one, spread
  the way information actually spreads now: through social media,
  through AI, through TV and the rest of the algorithm, saying a new
  world is being established and is open. New real logins (Shield
  register/login) are each one real person who heard that and arrived.
- **Every business here is a real, operating business.** The place is
  hidden; what happens inside it is not. Every district a player walks
  into — Food District, the Fashion District, VENVS's own Publisher,
  Venus Resort — is a real app with a real ledger behind it (V3's
  VCoin), not a prop. The place is the setting; the economy inside it
  is the actual thing.
- **Migration has a real cause, not a constant trickle.** People leave
  the old world because of real issues there, and the instruction is
  explicit that the heavier migration wave starts only once something
  real happens back in the old world — not specified yet, and not
  invented here (see "What is still open"). Until then, the settlement
  grows from the small founding population below, the same slow,
  measured growth `settlement.js` already models.

## What this reframes, concretely

- **`town.js`'s `TOWN_NAME = 'Meridian'`** is the name of the first
  settlement the tech team founded beyond the ice wall — still flagged
  as a placeholder in that file, not promoted to final by this
  document. The area itself has no name on record yet either.
- **`settlement.js`'s population-tier unlock ladder** (Hamlet → Village
  → Town → City → Metropolis) is the literal growth of that first
  settlement as more people take up the invitation and arrive — not an
  abstract game-balance gate, the actual story of the place filling in.
- **`npcs.createNpcWorld()`'s default `count: 14`** is the "certain
  amount of people just to establish the world" the instruction points
  back to — the real founding population already in the code before
  this document existed, not a new number invented to match the
  story. 14 lands the settlement at Village (min 10) the instant it
  boots, exactly the small, deliberate start the instruction describes
  — before any larger migration wave, which starts only once the old
  world has its own real reason for people to leave (see above).
- **`resources.js`'s "old world"** (8 Oct 2026) is wherever the tech
  team and every arriving settler actually came from before reaching
  this planet. `oldWorldStock` is the real, finite amount of goods that
  made the trip; `digForResources`/local materials (wood, stone, clay,
  ore) are what the planet itself provides once people stop relying on
  what they brought and start building from what is actually here —
  the same "limit import, build from this world" instruction that
  module's own header already recorded, now with the planet it is
  actually about named.
- **Every `vdp-native`/`-embed` district in `world.js`** is a real
  business the tech team (or an arriving settler, via `jobs.js`,
  `organizations.js`, `property.js`) actually operates on this planet
  — not a theme-park façade over VACO's real ecosystem apps, the real
  thing simply located somewhere new.
- **"All the initial operations will be done by us, the governors of
  the new planet"** (8 Oct 2026, direct instruction) is now a real
  payroll account, not just a line in this document:
  `jobs.PLANETARY_GOVERNORS_PAYROLL` funds the three frontier jobs
  (`lumberjack`, `farmer`, `hunter`) — hunting, lumberjacking and
  farming the undeveloped land around Meridian, the real work a brand
  new settlement needs before it has businesses of its own to employ
  anybody. The founding team is that settlement's first real employer,
  the same payroll-is-the-employer shape every other job in `jobs.js`
  already uses, just with the governors standing where a district's
  own business usually would. A player steps into these jobs the same
  way they clock in anywhere else — this is the founding team's own
  operation, open to be worked, not a separate system.
- **"The government will establish a clean water process through
  water... everything is actually done through a process from water"**
  (8 Oct 2026, direct instruction) names water as the real base of the
  whole chain, not one more raw material among equals. The governors'
  own `water-treatment-worker` job — the real occupation
  `occupations.js` already links to a water system, a plumber — has no
  input of its own; it is the one resource with no job that merely
  finds it. `farmer` now needs real water on hand to complete a shift
  (irrigation), so the chain actually reads water → crop → a real
  cooked product (`foodDistrict.js`), which is the instruction's own
  "a process from water" traced through code rather than asserted.
- **Hunting's real yield found a real home the same day.** `game` had
  no consumer anywhere once `crop` got one at the 11 real, sourced
  flagship brands — and assigning it to any of those 11 would have
  meant deciding which specific brand's dish "contains meat," a
  factual claim about already-sourced content this project refuses to
  invent. The resolution: a new, explicitly-not-sourced stall, the
  Frontier Grill (`foodDistrict.js`'s `FRONTIER_STALLS`), governors-run
  like the frontier jobs above, kept visibly apart from the 11 real
  brands rather than folded into them.

## What is still open

- The area's own name — nothing has been given yet (the product name,
  "VDP / Digital Planet," is not it — see the correction above).
- Exactly how the tech team found a way past the ice wall, and what
  (if anything) was already there when they arrived — not specified;
  not invented here either.
- The real event in the old world that starts the heavier migration
  wave — named as real and load-bearing by direct instruction, but not
  itself specified yet. Until it is, the settlement's growth stays the
  slow, small-founding-population story already in the code.
- The specific content of what gets put out "into the algorithm"
  (social media, AI, TV) announcing the new world — real as a premise,
  not yet a built mechanic anywhere in VDP.

This document records what has been confirmed and leaves the rest for
whenever more of the story is given, the same discipline `town.js`
already applies to Meridian's own name.
