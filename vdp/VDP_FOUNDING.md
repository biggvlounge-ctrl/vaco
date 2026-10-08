# VDP — Founding (v1)

Direct confirmation, recorded here so it does not need rediscovering:
VDP is a new planet. It was recently discovered, and the Vaco elite
tech team founded the first settlement on it and is actively inviting
people into a new tech society being built from the ground up.

This is the real premise behind what the code already does, not a
layer added on top of it — the pieces below already exist and already
match this story; this document is the first place that says so out
loud.

## The premise

- **A new, newly-discovered planet**, not a simulated Earth city with a
  sci-fi coat of paint. Nothing before this document said that in so
  many words, though `settlement.js`'s own header already carried the
  closest thing to it on record: "this is a growing world that's newly
  inhabited."
- **Founded by the Vaco elite tech team.** They are the ones who got
  here first, and the ones doing the inviting — not a government, not
  a company with no face, a specific team with a specific reason to be
  here: building something real, from the ground up, somewhere nobody
  had settled yet.
- **An open invitation, not a closed colony.** The whole point is
  people joining — new real logins (Shield register/login), each one
  a real person arriving at a place that is still being built.
- **Every business here is a real, operating business.** The planet
  is fictional; what happens inside it is not. Every district a player
  walks into — Food District, the Fashion District, VENVS's own
  Publisher, Venus Resort — is a real app with a real ledger behind it
  (V3's VCoin), not a prop. The planet is the setting; the economy
  inside it is the actual thing.

## What this reframes, concretely

- **`town.js`'s `TOWN_NAME = 'Meridian'`** is the name of the first
  settlement the tech team founded on the planet — still flagged as a
  placeholder in that file, not promoted to final by this document.
  The planet itself has no name on record yet either.
- **`settlement.js`'s population-tier unlock ladder** (Hamlet → Village
  → Town → City → Metropolis) is the literal growth of that first
  settlement as more people take up the invitation and arrive — not an
  abstract game-balance gate, the actual story of the place filling in.
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

## What is still open

- The planet's own name — nothing has been given yet.
- Why this specific team, why this specific planet, and what (if
  anything) was here before they arrived — not specified; not invented
  here either. This document records what has been confirmed and
  leaves the rest for whenever more of the story is given, the same
  discipline `town.js` already applies to Meridian's own name.
