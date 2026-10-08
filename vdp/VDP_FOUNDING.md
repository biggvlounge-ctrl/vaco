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
  **The currency question this raised was asked back directly and
  answered the same day**: "Bitcoin will be the currency of this new
  world" was floated, then settled as "VCoin not Bitcoin" on direct
  confirmation -- VCoin stays the real name, not just the technical
  implementation under a renamed label. Nothing to build; this is the
  autonomous bank's own real currency, unchanged.
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

## The tech is the government (8 Oct 2026)

Per direct instruction: "V4, our AI system, all the systems we use
will become basically the governing world of this new world... the
tech is the government. And that is the futuristic part of it." This
names, in so many words, what every "governors" reference in this
document already is in the code: `jobs.js`'s
`PLANETARY_GOVERNORS_PAYROLL` funds the frontier and enforcement jobs
(`lumberjack`, `farmer`, `hunter`, `water-treatment-worker`,
`robot-patrol-officer`), and the real intelligence behind an NPC a
player actually talks to is `v4AgentClient.js`'s `talkToNpc` -- a real
call to V4's own agent proxy, grounded in that NPC's own real traits
and decision log. The governors were never a human bureaucracy with
nothing behind it; this instruction says plainly what this document
can now say plainly too: V4 is the government, and the "governors"
payroll is that government's own treasury.

## Citations and detention: real consequences for real enforcement (8 Oct 2026)

Covered in full where the open question it answers already lived --
see "What is still open," below, for what the instruction resolved
and what it explicitly left for later (the detention's own visual
treatment). The real mechanic, `justice.js`, is summarized here:
`issueTicket`/`payTicket` for a real citation that lands on a real
person's own profile (`MyStatusView.jsx`'s new "Citations & Detention"
panel) with a real, flagged-interpretive VCoin fine; `detainPerson`/
`releasePerson` for a real, named detention any real enforcement
identity can place on any real person -- citizen or not, the same way
a real jail isn't reserved for people with the wrong papers.

## Starting mix and the futuristic-with-nature look (8 Oct 2026)

Per direct instruction: "we will start off with just a village,
commercial, residential, and dreams screen mix... everything will be
futuristic, but with nature. Future like Dubai, nature like Japan."

- **The starting mix is now real, not three-quarters built.**
  `village` (the Village District, already Hamlet-tier) and `dreams`
  screens (`dreamsClient.js`'s real ad-screen network, already
  mounted) were already real. `residential` (`property.js`'s 5-tier
  VXLLAGE ladder) was already real too. `commercial` was the one
  genuinely missing piece -- this file's own header literally named
  "VDP has no commercial... districts" as the reason it didn't exist
  yet. `property.js` now carries a real, independent `commercial`
  slot (`'commercial'` is VACON-C's own real `PROPERTY_TYPES` literal,
  reused verbatim) -- a player can run a business and own a home at
  once, two real claims, not one slot fought over.
- **"Towers, some bigger, some smaller, we'll use a mix"** was already
  true of `PROPERTY_LEVELS`'s own 5-tier tower ladder (Studio →
  Penthouse) -- confirmed, not rebuilt.
- **"Futuristic, but with nature. Future like Dubai, nature like
  Japan"** is a real aesthetic direction for whenever this world's
  visuals get their own design pass -- recorded here as flavor
  guidance, not a mechanic. Nothing in this codebase renders
  architecture in enough detail yet to act on it (canvas districts are
  flat colored rectangles, `drawAvatar`'s own humanoid is the only
  real character art). Flagged for that future pass rather than
  guessed at in code today.
- **"Our border will be futuristic and shown right at the ice wall...
  we will expand the world as needed."** `worldExpansion.js`'s own
  real backdrop-to-built-district promotion machinery
  (`isVisuallyPlayable`/`realGrowthSignal`) is already the real
  mechanism for "expand as needed" -- a backdrop area becomes a real,
  built part of this world only once it measurably earns it, never on
  a schedule. What the border itself actually looks like at the ice
  wall is not yet rendered anywhere and is recorded as open below.

## Security scales with real crime, the government builds through real contracts, and real people revolt against it (8 Oct 2026)

Three more pieces of "the tech is the government," per direct
instruction:

- **"Everything will be camera secured... at the beginning there will
  just be basic security features and then it will increase as crime
  increases... the robots will increase for policing."** New
  `security.js`: a real tier (`Basic → Elevated → High Alert →
  Maximum Security`) derived from this world's own real crime count
  (`justice.js`'s tickets and detentions, `immigration.js`'s illegal
  arrivals and active illegal settlements, `property.js`'s
  unauthorized structures) -- never a separate, invented crime-rate
  simulation. Each tier names a real camera count and a real robot
  count, both flagged interpretive numbers on the same footing every
  other unspecified figure in this document already stands on.
  `GovernmentView.jsx` shows the real, current tier.
- **"The government, which is the AI, will send out contracts to
  different builders to continuously build the world as needed."**
  New `contracts.js`: the AI posts a real contract (free-text
  description -- what specifically gets built is not specified, so
  nothing is invented here), a real builder accepts it, spends real
  materials if the contract names any, and is paid real VCoin by the
  governors on completion. Posting is a real, scheduler-style world
  event guarded the same way `generateMigrationWave` already is
  (`requireCallingService`, no single player actor) -- the AI's own
  act, never a player's.
- **"Multiple people who, as they come in the world, will try to
  revolt against the technology being the government."** New
  `dissent.js`: a real, named collective action
  (`organizeRevolt`/`suppressRevolt`), and `immigration.js`'s arrivals
  now carry a real `dissident` flag -- set per-arrival or across a
  real fraction of a migration wave (`generateMigrationWave`'s
  `dissidentFraction`). Being a dissident is explicitly not the same
  fact as being illegal -- a fully legal citizen can still oppose the
  government, the same way `justice.js`'s detention is open to a
  citizen too. VACON-C's own `server/politics.js` already owns
  revolutions at civilization scale; this is VDP's own small, real
  record of its own small world, not a second implementation of it.

## Crime varies by area, the government builds continuously, and the map grows with the population (8 Oct 2026)

- **"Aspects of the area have more criminal activity than others in
  the New World, depending on the NPCs."** Real now, not just stated:
  `justice.js`'s `issueTicket`/`detainPerson` carry an optional, real
  `locationLabel`, and `security.js`'s new `crimeByLocation` breaks
  the settlement's own real crime records down by the real place each
  one happened -- `GovernmentView.jsx`'s Security panel shows it. No
  area boundaries are invented; a record's own real location is the
  only input.
- **"Operations will be started similar to the operations that are in
  the vacancy game... those things will gradually increase as the
  world increases."** Already the real shape this whole session has
  built toward: `jobs.js`'s payroll jobs, `organizations.js`'s
  families/tribes/cults, `property.js`'s residential/commercial
  slots, and now `contracts.js`'s AI-posted construction work are
  VDP's own small-scale real analogs of VACON-C's real operational
  economy (jobs, organizations, property, takeovers) -- the same
  "borrow the shape, not the scale" discipline this document already
  names for `npcs.js`/`skills.js`. "Gradually increase as the world
  increases" is `generateMigrationWave`'s and `contracts.js`'s own
  real growth already built, not a new mechanic.
- **"A ticker of... how many people are in the world, how much money
  is generated... a map of the charter territory that's already been
  conquered... more places will be inserted on the map as the
  population grows."** The population ticker was already real
  (`WorldView.jsx`'s own header, `population.js`). New:
  `GET /api/analytics/status`'s real `totalVCoinGenerated` -- a
  named, bounded figure (real governors-funded payouts: job shifts,
  completed contracts, resource sales -- not literally every VCoin
  this ecosystem has ever moved, which this server has no way to
  see) -- and a real territory map in `GovernmentView.jsx`, built
  from `world.js`'s own real `DISTRICTS` and `settlement.js`'s own
  real population-gated unlock tiers, not a second invented map.
- **"Some areas... will be off the grid until the government finds
  out... different places can be migrated at different times and the
  government not know."** Real now: `immigration.js`'s illegal
  settlements start `discovered: false` -- active and real the
  instant they're founded, but not counted toward `security.js`'s
  measured crime until a real `discoverSettlement` act happens.
  "Underground places" are the same real mechanic under a different
  real `locationLabel` ("underground," or whatever a founder actually
  names it) -- not a second system.
- **"Depending on the type of NPCs, the traits, where they're from...
  we need different populations of people migrating... to grow
  gradually."** Already real: `generateMigrationWave`'s
  `originRegions`/`religions` pools, supplied by the caller, were
  built for exactly this the same day migration waves shipped.
- **"NPCs start to build... a continuous world that's being built as
  people go into it. But with real currency, real businesses, and
  real people and avatars."** `contracts.js`'s `builderId` is any real
  person string, `npc-<id>` included -- an NPC accepting and
  completing a government contract needs no new code. "Real
  currency, real businesses, real people and avatars" is VCoin,
  every real district, Shield accounts, and `avatarRender.js` --
  confirmed, not rebuilt.
- **"People can also be set for jail, ticketing, fine. They could
  avoid the fines and ticketing... or even face deportation back to
  the old world."** "Avoid" needed no new code: nothing in
  `justice.js` ever forced payment, so an unpaid ticket already is the
  real "avoided" case. Deportation is new and closes this document's
  own earlier "deportation remains unspecified" item:
  `immigration.js`'s `deportPerson` marks a real arrival deported
  (never deleted -- the real history stays), and when the deportee is
  a real NPC, `npcs.removeNpcFromWorld` actually removes them from
  the live, server-ticked population -- the real "back to the old
  world" for an NPC specifically.

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
- **Partially answered 8 Oct 2026**: a robot patrol catching someone
  can now issue a real citation (`justice.js`'s `issueTicket`) or
  detain them (`detainPerson`) — direct instruction confirmed both are
  real possible consequences. Deportation remains unspecified. **What
  the detention itself actually looks like is explicitly still open
  in the instruction's own words** — "some type of futuristic glowing
  jail system, or would be more like an open area" was floated as two
  real alternatives, not decided between. `justice.js` records the
  real fact of detention (who, why, since when) and deliberately
  carries no `cellType`/visual field — that choice is for whenever it
  is actually made, not guessed at here.
- The real survivor-population figure — how many people actually made
  it through VACANCY's reset. `generateMigrationWave` is built to
  scale a real migration wave off this number the instant it is
  given; until then, no wave fires on its own, and no number is
  guessed at to make one up.
- What happens to a passport at the moment it actually expires, beyond
  `isPassportExpired` recording the fact — not specified and not
  invented here.
- Which of detention's two real alternatives this world actually
  uses — "some type of futuristic glowing jail system, or would be
  more like an open area" — and what the ice wall's own real border
  looks like. Both are real visual-design questions, not mechanics;
  `justice.js`/`worldExpansion.js` are built either way.
- "We will gradually insert more books into rotation into the
  universe" — VENVS Publishing's own real catalog
  (`venvs/src/lib/catalog.js`) is the real place this happens, and it
  has not happened yet; this document records the instruction, not an
  invented title list standing in for it.
- The real consequence, if any, of being suppressed
  (`dissent.js`'s `suppressRevolt`) or of a government contract going
  unfinished — both record the real fact of what happened, with no
  further invented penalty attached.
- What deportation actually does to a real logged-in player, beyond
  the real record (`deportPerson`'s `deported: true`). An NPC is
  really removed from the live population; this server does not
  forcibly end a real person's own session, and nothing says it
  should — left as a real, visible fact on their own record rather
  than an invented account-level consequence.

This document records what has been confirmed and leaves the rest for
whenever more of the story is given, the same discipline `town.js`
already applies to Meridian's own name.
