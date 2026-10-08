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
  real happens back in the old world. **Named below, not still open**
  (corrected 8 Oct 2026 — see "The old-world event, named"): it is
  VACANCY's own reset. Until that wave, the settlement grows from the
  small founding population below, the same slow, measured growth
  `settlement.js` already models.

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

## The old-world event, named (8 Oct 2026)

**A correction to this document's own second open item above.** This
document previously left "the real event in the old world that starts
the heavier migration wave" unspecified. It is now named by direct
instruction: **VACANCY** — the real civilization-simulation game this
whole repository already builds (`vacon-c/`, whose own schema and docs
are literally named `VACANCY_*`: `VACANCY_POSTGRESQL_SCHEMA.sql`,
`VACANCY_SEED.md`, and the rest) — is "the game" the old world was
playing when a reset inside it threw the real old world into
"craziness." VDP is the real extension founded on the other side of
that chaos: people migrated not out of a vague old-world hardship, but
specifically away from the fallout of VACANCY's own reset, into the
new, controlled, slowly-opening world beyond the ice wall this
document already describes.

This is a real, checkable claim about this repository, not a new
invented backstory: `vdp/src/lib/vacancyClient.js` and
`vdp/src/lib/vacancySchema.js` already read VACANCY's own live API and
map VDP's world objects onto its real tables (`vacancySchema.test.js`
fails if that mapping ever drifts from a real `CREATE TABLE`) — VDP was
already built as the thing standing next to VACANCY before this
document said why. What "the reset" specifically was inside VACANCY's
own simulation, and what in the old world's reaction to it actually
broke, are not specified by the instruction and are not invented here
— named as the trigger, not yet detailed as an event.

## Illegal migration, and the chaos people bring with them (8 Oct 2026)

Per direct instruction, the controlled gate above has a real, working
seam, not a perfectly sealed one:

- **People find other ways across the ice wall besides the passport
  line** — a real illegal crossing, alongside the legal one, both
  landing in the same real arrival record (`immigration.js`'s
  `arrivals`, `method: 'passport'` vs `'illegal_crossing'`) rather than
  two separate, incompatible systems.
- **Some of them bring things from the old world with them** — guns,
  named as the instruction's own example, "things like that" left
  genuinely open rather than expanded into an invented catalog of
  contraband (`immigration.js`'s `smuggledGoods`, free text).
- **A robot patrol can find a new, specific spot where people are
  sneaking in** — a real, named discovery (`reportSmugglingSpot`), and
  closing it a separate, later, equally real act (`sealSmugglingSpot`)
  — two real events, never one invented detection roll standing in for
  both, the same standing rule against inventing a simulation
  threshold this whole project already holds itself to.
- **"People are bringing the chaos from the old world to the new
  world. You have all your different characteristics, statistics, and
  things like that"** — a migrant's real stats carry over rather than
  starting at zero. `immigration.js`'s arrival record can carry real
  `oldWorldSkills`/`oldWorldBeliefs`, and `server.cjs`'s `ensurePlayer`
  now seeds a new player's `skills.js` sheet from exactly that record
  when one exists for them (`skills.js`'s `createSkills(seed)`) —
  falling back to the same all-zero start every existing player and
  test already has when no arrival was ever recorded for them.
- **People start illegal settlements** — a real, standing claim to a
  place outside the governors' own controlled footprint
  (`immigration.js`'s `foundIllegalSettlement`/`clearIllegalSettlement`),
  kept distinct from a single unauthorized structure below.

## Keeping a controlled atmosphere: robots, unauthorized building, land, and who gets in (8 Oct 2026)

- **"We also will have robots doing a lot of the policing in the new
  world."** `occupations.js` has no literal "police" entry; `officer`
  (tier 5, Combat, "military tactics," employed by `military`/
  `government`) is the nearest real occupation, the same
  nearest-real-match discipline `lumberjack` already uses for
  carpenter's Construction. `jobs.js`'s `robot-patrol-officer` is that
  slot, governors-paid like every other frontier/government job above
  — a player clocked into it is directing that robot patrol, not
  playing a robot themselves, a flagged interpretive bridge the same
  way every other gap between an instruction and a mechanic in this
  document is flagged rather than silently assumed.
- **"People doing unauthorized buildings. We will be restricted, and
  we will try to keep everything [controlled]."** `property.js`'s
  `authorized` field is true on every real home/plot above; the one
  new path, `buildUnauthorized`, sets it false on purpose — a real
  structure on the books as not sanctioned, no payment attached
  because an unauthorized builder went around the governors' office by
  definition. `demolishUnauthorized` is the robot patrol's own real
  enforcement action on it.
- **"People can also have the option to buy land as well."**
  `property.js`'s `purchaseLand` — a real, separate, cheaper purchase
  than a finished VXLLAGE home, land with nothing built on it yet.
- **"We will also try to keep a controlled atmosphere of passports
  coming into this new world. All different type of religions, people
  from everywhere."** `immigration.js`'s `admitWithPassport` records
  wherever a migrant really came from and whatever they really believe
  as open, free-text fields (`originRegion`, `religion`) — never a
  fixed invented list of real-world regions or faiths, the same
  discipline `beliefs.js`'s own `beliefType` enum already stops short
  of naming specific real creeds.
- **VACON-C's own `server/justice.js` stays the one real
  arrest/court/prison system at civilization scale.** `immigration.js`
  does not reimplement it in miniature — catching an illegal arrival
  or clearing a settlement is VDP's own small, real record of its own
  small world, not a second justice system.

## Exotic value: scarcity pricing (8 Oct 2026)

Per direct instruction: "there will be an exotic value of things that
are least accessible — those things will be more valuable until they
increase in this new world." A real, deterministic scarcity-price
formula (`resources.js`'s `exoticValueFor`), not a second invented
rarity system: a resource's value is the inverse of how much of it
this world has actually produced so far
(`totalProduced[type]`, cumulative, settlement-wide, never
decremented) — worth the full flagged base value
(`BASE_EXOTIC_VALUE`) the instant before anyone has ever produced a
unit of it, and measurably less exotic with every real unit anyone
anywhere produces after that. "Until they increase" is read literally:
value only falls as the world's own accumulated production rises, the
same direction the instruction names, never a random walk. A real
`sellMaterials` lets a player convert local stock back to VCoin at
today's real exotic value, through a named `RESOURCE_EXCHANGE_ACCOUNT`
— the resource counterpart to `property.js`'s own `'vdp-property-office'`.

## Who is really here: NPCs first, then real people (confirmed 8 Oct 2026)

Per direct instruction: "this world will be contingent on NPCs and
real people entering the VDP environment — real people who enter the
simulation are the people. Before that, NPCs. Starter NPCs." This is a
confirmation of what this document and the code it describes already
say, not a new mechanic: `npcs.createNpcWorld()`'s real founding
population (`count: 14`, "the certain amount of people just to
establish the world," above) exists before a single real login ever
happens. `population.js`'s own `describePopulation(playerCount,
npcCount)` already keeps the two counts separate rather than one
blended figure, and `settlement.js`'s own header already says the part
this instruction restates plainly: growth past the earliest tier
depends on real players joining — "NPCs alone settling the world would
make 'people started to integrate to it' meaningless." Named here
because the instruction asked for it to be, not because the code
needed to change to make it true.

## Citizenship, temporary passports, and real migration waves (8 Oct 2026)

Per direct instruction, the controlled gate above has two real doors,
and the world grows through a real, named process rather than a
constant background trickle:

- **"Users will be able to apply for citizenship or they can apply
  for a temporary passport that only lasts so long."** The same real
  `admitWithPassport` gate, with one new field telling the two apart
  (`citizenshipType`): `applyForCitizenship` is permanent, no expiry;
  `applyForTemporaryPassport` sets a real `expiresAt`
  (`TEMPORARY_PASSPORT_DURATION_MS`, a flagged interpretive length —
  no document gives VDP a real visa duration). `isPassportExpired` is a
  real, checkable fact about an existing arrival. What happens at
  expiry beyond that fact is not specified and not invented here, the
  same restraint this document already applies to what happens to
  someone a robot patrol catches.
- **"NPCs will be picking a certain amount of NPCs to be coming over
  legally and illegally... we will just grow the planet off of
  that."** `immigration.js`'s `generateMigrationWave` is a real,
  deterministic generator: given a real survivor-population figure (how
  many people actually made it through VACANCY's reset — not specified
  anywhere yet, so this function never invents that number, only scales
  off whatever real figure it is handed) and real pools of origin
  regions/religions/smuggled goods (the caller's own data, never a
  closed list this function invents), it produces a real wave of new
  arrivals split between legal and illegal entry, and — per "we will
  just grow the planet off of that" — each one is a real new NPC
  (`npcs.addNpcToWorld`), not a database row with nobody behind it.
  "However you choose to mix it, that makes it a good blend based on
  population, type of person" is read as: the blend is whatever real
  data the caller supplies, not a fixed recipe this module bakes in.
- **"When a new spot is found to get through the ice wall, we will be
  notified in certain ways."** Already real as of the immigration
  phase above: `reportSmugglingSpot` posts straight to Meridian's own
  Live World News feed (`NewsTicker.jsx`, reading `newsLib`'s real
  event log) the instant a robot patrol finds one. That is the one
  real, in-world notification channel this document can point to; any
  other channel (a push alert, a direct message) is not specified and
  not built.

## New-world technology: drones, autonomous vans, automated banking (8 Oct 2026)

Per direct instruction: "everything will be new technology... we will
basically bring our whole operation from the technology world over to
this world." Checked against what already exists before adding
anything new -- three of the four pieces named were already real:

- **"Even the initial restaurants we will have will all be ghost
  kitchens and delivered by drone."** Already true, unchanged:
  `foodDistrict.js`/`FoodDistrictView.jsx`'s own header has said
  "ghost-kitchen fulfillment" and "real drone delivery through VOID's
  own `foodDelivery` vertical" since that phase shipped.
- **"All packages will be delivered by drone."** Already true,
  unchanged: `server.cjs`'s `registerMeridianVoidHubsOnce` registers
  Meridian's real VOID Hub Stations (package + temperature-controlled
  food distribution) on VOID's actual station network at boot.
- **"We'll handle the banking. It will all be autonomous."** Already
  true of the ledger this whole ecosystem already runs on: V3's VCoin
  ledger has no human teller anywhere in it -- every transfer in VDP
  (`jobs.js` payroll, `property.js` purchases, `resources.js`'s
  `sellMaterials`, every district's commerce) already moves through
  real, automated settlement code, not a person approving it.
- **"We will have autonomous vans that will drive. We won't have any
  cars."** The one genuinely new piece. VDP never had a car concept to
  remove -- checked directly, no `car`/`vehicle` reference anywhere in
  this app before this phase (Venus Resort's water taxi is a boat).
  `VoidView.jsx` now offers VOID's own real `transportation` vertical
  (per-trip, non-licensing-gated) alongside its Courier demo, branded
  as "Call an autonomous van" -- the same real request→match→accept→
  complete→pay→rate loop every VOID vertical already runs through, not
  a second invented ride system.
- **"People trying to smuggle cars in, drugs in, things of that
  nature."** `immigration.js`'s `smuggledGoods` was already real, free
  text (`crossIllegally`) -- widened with the instruction's own new
  examples in that module's header. Cars specifically matter here:
  since the autonomous van is Meridian's only real ride, a smuggled
  car is explicitly contraband, not a second legitimate vehicle this
  world is supposed to have.

## What is still open

- The area's own name — nothing has been given yet (the product name,
  "VDP / Digital Planet," is not it — see the correction above).
- Exactly how the tech team found a way past the ice wall, and what
  (if anything) was already there when they arrived — not specified;
  not invented here either.
- What VACANCY's own "reset" specifically was, and what in the old
  world's reaction to it actually broke — named as the real trigger
  above, not itself detailed yet.
- The specific content of what gets put out "into the algorithm"
  (social media, AI, TV) announcing the new world — real as a premise,
  not yet a built mechanic anywhere in VDP.
- What, if anything, happens to someone a robot patrol actually
  catches — caught and recorded is real (`catchIllegalArrival`); any
  consequence beyond the record (detention, deportation, a fine) is
  not specified and not invented here.
- The real survivor-population figure — how many people actually made
  it through VACANCY's reset. `generateMigrationWave` is built to
  scale a real migration wave off this number the instant it is
  given; until then, no wave fires on its own, and no number is
  guessed at to make one up.
- What happens to a passport at the moment it actually expires, beyond
  `isPassportExpired` recording the fact — not specified and not
  invented here.
- **"Bitcoin will be the currency of this new world"** (8 Oct 2026,
  direct instruction) — flagged, not acted on. Every real transfer in
  VDP and the rest of this ecosystem settles through V3's real VCoin
  ledger; there is no real Bitcoin/blockchain integration anywhere in
  this repository to move this world's money onto instead, and
  replacing V3 with one would be a change far outside VDP alone (V3 is
  shared ledger infrastructure for every app in this ecosystem, not a
  VDP-owned file). Asked back to the instruction's own author rather
  than guessed at or silently left as VCoin -- see the open question
  this document raised the same day this bullet was written.

This document records what has been confirmed and leaves the rest for
whenever more of the story is given, the same discipline `town.js`
already applies to Meridian's own name.
