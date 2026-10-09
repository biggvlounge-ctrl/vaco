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

## The economy rotates, and a real revolt can fight the robots (8 Oct 2026)

- **"This way people get, it can be involved in the economy
  rotation... the economy should continue to thrive as far as the
  owners of the businesses and things like that... the economy can go
  up and down depending on how people are spending inside of it."**
  New: `economy.js`, a real, moving index built from every real
  purchase `server.cjs` already charges (homes, land, commercial
  property, upgrades, ticket fines all call its `recordSpending`).
  `property.js`'s new `operateBusiness` is the real opposite flow a
  commercial owner now has -- their property actually earns, scaled
  by the real economy index (`economyMultiplierFor`), not a fixed
  number regardless of how the world is doing. `GET /api/analytics/
  status` now reports the real index alongside the population ticker
  and `totalVCoinGenerated` it already carried.
- **"Some people can also be involved in moving... creating new areas
  or migrating until they are noticed by the AI."** Already real and
  confirmed, not rebuilt: `immigration.js`'s illegal settlements
  (undiscovered until a real `discoverSettlement` act) and
  `foundIllegalSettlement` are exactly this -- a real area existing,
  unnoticed, until the government finds it.
- **"Certain people will fight against [the robots] if they have a
  big enough tribe group organization."** New: `dissent.js`'s
  `attemptUprising`, measuring a revolt leader's own real
  `organizations.js` group (`memberIds.length`) against
  `security.js`'s own real current `robotCount` -- never an invented
  combat stat. Big enough, and the revolt's own record is marked
  `overpoweredAt`; from then on `suppressRevolt` refuses it (the
  robots that would suppress it are the real ones it just pushed
  back). `GovernmentView.jsx`'s "Fight the robots" button is this
  action, shown only to the real revolt's own leader.

## Unsecured businesses, and V4 as a natural guide (8 Oct 2026)

- **"Other certain communities that haven't been secured by the
  government also can have businesses there that are existing
  business, real businesses, or NPC built businesses."** New:
  `property.js`'s `buildUnauthorized` now accepts `type: 'commercial'`
  alongside its existing residential default -- a real business that
  never went through the governors' office, seeded at the real Market
  Kiosk level so `operateBusiness` works on it exactly like a
  sanctioned one. `ownerId` is any real string, `npc-<id>` included --
  an NPC-built business needs no new code, the same way
  `contracts.js`'s `builderId` already allows one. The same
  one-business-per-owner rule `purchaseCommercial` enforces applies
  here too. `ImmigrationView.jsx`'s build form gained a type choice;
  `MyHomeView.jsx` marks an unsecured business as such.
- **"There's an AI that works with the users to show them things to
  get further in the game, similar to how vacancy works, but we want
  this to be a little more natural... since it's one big world that
  everybody's involved in."** New: `v4AgentClient.js`'s
  `suggestNextStep`, a real call to V4 (the same AI persona
  `GovernmentView.jsx` already presents as this world's government)
  grounded in the real facts `GET /api/guide/facts/:id` assembles --
  this one resident's own real need/goal/trait/skill/job/property/
  organization, AND the real shared world (population, the real
  economy index, open government contracts) -- never a scripted,
  numbered quest list, which the instruction explicitly asked this
  not to feel like. `MyStatusView.jsx`'s "Ask V4 what's next" is this
  action.

## Where the other ways across actually are, imported technology, frontier farms, and who is visible (9 Oct 2026)

Per direct instruction, four more pieces of the same world this whole
document already describes:

- **"The place where they're migrating in illegally... make those
  spots be... uncharted territory, wooded area, places away from the
  technology."** Real now: `immigration.js`'s `reportSmugglingSpot`
  stamps every real spot a robot patrol finds with a fixed
  `ILLEGAL_CROSSING_TERRAIN` fact — the opposite of the one real,
  controlled, tech-equipped passport checkpoint, by definition, not a
  per-report choice. `locationLabel` still names the specific place (a
  real crevasse, a real ridge); `terrain` now says what kind of place
  every one of them actually is.
- **"We will be using the most modern technology that we will be
  importing in from the old world, from places like China and things
  like that — but yes, we will have the highest technology of
  things."** Confirmed, not rebuilt: `resources.js`'s `oldWorldStock`
  already IS this — a one-way, finite shipment of what the founding
  team and every arriving settler actually brought with them, spent
  down as the settlement builds (see "`resources.js`'s 'old world'"
  above). "China and things like that" is the instruction's own real,
  specific example of where that shipment's technology actually came
  from — recorded here as flavor, the same open-free-text discipline
  `originRegion` already uses for a migrant's own background, rather
  than a new enum this document invents to pin it down further. No
  real manifest exists naming what, specifically, was imported, so
  nothing beyond this flavor note is built for it.
- **"We will have farms, they will be closer to the uncharted
  territory type of area, but still ran through tech."** Confirmed,
  not rebuilt, and already exactly right: `jobs.js`'s `farmer` is
  already one of the three frontier jobs, `districtId: 'frontier'` —
  deliberately not a real `world.js` district, the same backdrop-beyond-
  what's-been-hand-built land the hunter and lumberjack already work.
  "Still ran through tech" is the real water chain already in place:
  `farmer` requires real water on hand to complete a shift
  (irrigation), produced by the governors' own `water-treatment-worker`
  — a frontier farm, worked by hand on undeveloped land, run through a
  real technological process regardless.
- **"Every area and section will have NPCs who are attached to the
  government, who are professionals that came over and helped create
  the starter environment. But the initial people who come over are
  never seen. They hide behind the computer."** New:
  `npcs.js`'s `seedGovernmentLiaisons` adds one real, named liaison per
  real `world.js` district — "every area and section" read literally
  from the actual district list — tagged `role: 'government-liaison'`,
  with a real bio naming which area they came over to help establish.
  Wired into `server.cjs`'s boot sequence, idempotent against a
  restart or a `world.js` that later grows a new district. **The
  founders themselves stay exactly what they already were**: per the
  instruction's own words, they are never one of these, or any other
  NPC — `jobs.js`'s `PLANETARY_GOVERNORS_PAYROLL` (an abstract payroll
  account) and `v4AgentClient.js`'s real AI government (see "The tech
  is the government," above) were already the honest answer to "who
  is actually running this," and this instruction confirms that in so
  many words rather than asking for a visible founder character this
  document would otherwise need to invent. A liaison is the real,
  different fact: a professional who DOES appear, because standing up
  one specific area was visible, on-the-ground work, while whoever
  actually runs the government stays off-screen.

## A second migrant source, real robot types, red zones, and who comes first (9 Oct 2026, later the same day)

Five more pieces of the same world, per a further direct instruction:

- **"I would like one of the spots on the ice wall to lead directly to
  the underground world where people will start to migrate from."**
  New: `immigration.js`'s `reportSmugglingSpot` carries a real
  `leadsToUndergroundWorld` flag, and `findUndergroundWorldSpot` finds
  the one real passage once it exists. A migrant who actually comes
  through it is recorded the same way any illegal crossing already is
  -- `originRegion: 'the underground world'` is simply what the caller
  names, the same already-open free-text field every other origin
  uses. What the underground world actually is remains unspecified,
  same restraint this document already applies elsewhere.
- **"There also will be stages of robots, from your basic robot that
  just roams around and does basic things, to your household robot,
  all the way up to your military style robot, and variations in
  between."** New `robots.js`: a real five-type ladder (Patrol Drone →
  Household Robot → Security Robot → Combat Robot → Military Robot),
  the first real robot TYPES this app has ever had -- before this,
  "robot" was only ever a number (`security.js`'s own `robotCount`).
  `SECURITY_TIER_ROBOT_TYPE` names which real type the government
  actually deploys at each real security tier (Basic gets the weakest,
  Maximum Security the strongest); the Household Robot is the real
  "variation in between" that is deliberately never enforcement-
  capable and never deployed for policing at all -- a domestic fact
  about this world's technology, not a second security tier.
- **"It takes a lot of people to overpower certain robots, and
  depending on what type of robot and how many people and what type of
  people -- it does stand for athletics and the strategy to go against
  the robot."** `dissent.js`'s `attemptUprising` now takes the real
  robot type being resisted (scaling how much combined strength is
  needed, via that type's own `overpowerStrength`) and each real
  participant's own real Athletics skill (`skills.js`) where one is on
  record, so a smaller, more athletic group can do what a larger,
  ordinary one cannot -- both strictly additive over the 8 Oct
  mechanic, which still behaves exactly as before when neither is
  supplied. "Strategy" is named by the instruction but not built as a
  second stat or roll -- Athletics is the one real number this world
  already tracks that the instruction names by name; nothing else is
  invented to stand in for "strategy."
- **"There also will be humans or NPCs that will be basically in
  control of the robots."** `robots.js`'s `deployRobot` records a real
  `controlledBy` -- any real id, a player or an `npc-<id>`, the same
  open convention `contracts.js`'s `builderId` already uses. A
  deployed robot has no AI of its own in this module; its real actions
  are whatever its controller actually does through `immigration.js`'s
  own enforcement functions, the same way `jobs.js`'s
  `robot-patrol-officer` already documents a player directing a patrol
  rather than being one.
- **"This will lead to illegal areas, red zones, illegal gambling,
  drugs, clubs, and things of that nature... this is also how certain
  items will make it through."** `immigration.js`'s
  `foundIllegalSettlement` now carries a real, free-text `activities`
  list -- "and things of that nature" is read the same open way
  `smuggledGoods` already is. This is explicitly the unregulated,
  off-the-books kind of gambling/nightlife a settlement the government
  has not sanctioned would actually have -- a real, different fact
  from VAGO's own regulated, VCoin-settled Venus Resort, never a second
  instance of it.
- **"The people who start to come early are the people who are most
  affluent... they come first, and then they send for their family
  members, and only a portion of those will get in, and then also
  other people will get in, and those are the NPCs that start the
  businesses, and then the import-export depends on the family in the
  old world as well."** `immigration.js`'s `admitWithPassport` gains a
  real, closed `WEALTH_TIERS` ordering (`affluent` → `family-sponsored`
  → `general`, the one real structure this instruction itself names,
  unlike the deliberately open `originRegion`/`religion`), a real
  `sponsorId` linking a sponsored arrival back to the affluent arrival
  who sent for them, and a real `familyImportCapacity` fact recorded
  per arrival. The new `sponsorFamilyMembers` is the one function that
  actually turns some candidates away rather than admitting a whole
  list -- "only a portion... will get in" is a real, inspectable
  `admitted`/`turnedAway` split, never silently all-or-nothing.
  `familyImportCapacity` is deliberately NOT wired into
  `resources.js`'s shared `oldWorldStock` -- that module's own header
  is explicit that stock "is only ever going down... everybody drew
  from the same one shipment." A richer family does not top up the
  whole settlement's shared import; this is only the honest record of
  how capable that one family is, in case a future real import path
  reads it. "Those are the NPCs that start the businesses" needed no
  new code: `property.js`'s `buildUnauthorized`/`purchaseCommercial`
  already accept any real owner id, `npc-<id>` included.

## Imported and discovered animals, real taxes, barter, and the starter world (9 Oct 2026, a third instruction the same day)

Per direct instruction:

- **"People will be importing animals from the old world... breeding
  and start to grow and breed new things. Also there will be
  different animals... discovered in the new world as well."** New
  `animals.js`: `importAnimal` (real, already-adult, one-way from the
  old world) and `discoverNativeAnimal` (a real, unowned wild find,
  claimed later) are the two real sources, one real record, the same
  "two methods, one shape" discipline `immigration.js` already uses.
  `breedAnimals` requires two real adult same-species parents the
  breeder actually owns; `growUp` matures a real juvenile after a
  flagged interpretive real duration.
- **"Certain people will take advantage of that and do too much
  killing... everything will get regulated."** `animals.js`'s
  `regulatedHuntYield` reads `resources.js`'s own already-real
  `totalProduced.game` -- once this settlement's real cumulative
  hunting yield crosses a real threshold, `jobs.js`'s `hunter` shift
  yields less, via a new, optional `regulateYieldFn` hook
  (`clockOutAndPay`) rather than either module importing the other.
- **"The currency and the income, there also be taxes involved."** New
  `taxes.js`: every real shift now withholds a real 10% income tax
  into a real `GOVERNMENT_TREASURY_ACCOUNT`, as a second real transfer
  after the worker is already paid -- a tax-collection failure never
  undoes the worker's own real pay, recorded honestly as uncollected
  rather than inventing an atomicity this ledger does not have.
- **"We need the track of how much the government has, how much the
  government is making through taxes, so we can see when the
  government will order more import, more robots... or finding a
  cheaper way to do it... the government is trying to be efficient...
  because it's ran by AI."** `taxes.js`'s `recommendDeploymentSource`
  compares the real treasury balance (read live from V3) against a
  robot type's own real `importCost`/`domesticCost` (`robots.js`) --
  a real, named rule, not a second invented AI agent.
- **"This is also where the barter system comes into play... people
  will also want things from the old world that are exotic, that are
  being smuggled in. So we need to do an inventory."** New `barter.js`:
  a real, separate item-for-item ledger (never VCoin), with
  `seedFromSmuggledGoods` reading `immigration.js`'s own real
  `smuggledGoods` list rather than inventing a second catalog.
- **"The government will not set up religious institutions. This is
  something that will be set up as more NPCs come over."**
  `organizations.js`'s `ORG_TYPES` now includes
  `'religious-institution'` -- the existing `foundOrganization` gate
  already takes any real founder, NPC included, and nothing lets the
  government (an account, not an actor) call it at all.
- **"As things grow, people will look on the void app for different
  jobs that are available for the government."** `server.cjs`'s new
  `postGovernmentJobsToVoidOnce` posts every real
  `PLANETARY_GOVERNORS_PAYROLL` job onto VOID's own real staffing
  marketplace (`void/lib/staffing.js`'s `postStaffingPosition`) at
  boot. VOID's own `POST /api/staffing-position` gained one real,
  narrow widening to make this possible: `actorOrService(requireSession())`
  in place of a bare `requireSession()`, since a government job
  posting has no human session to present -- the same dual-auth shape
  this app's own `/api/library/record` already uses.
- **"Make sure we have how the world is going to be set up and where
  we need to start... get down the population... how big the world
  needs to be... a starter world and then a second stage."** Answered
  in full in the new `VDP_STARTER_WORLD.md` -- Stage 1's real current
  numbers (39 real NPCs at boot, 25 built districts, 10 real jobs, a
  500-unit old-world stock, no pre-built housing stock yet) and Stage
  2's real, scoped next step (a finite starter housing pool, a real
  mall/village/commons cluster in `world.js`'s own grid), rather than
  restated here.

## Real diversity, homelessness, culture-driven relationships, and the elite (9 Oct 2026, a fourth instruction the same day)

Per direct instruction:

- **"People coming from all across, all around the world, different
  nationalities, religions, incomes... poor state of minds as well,
  which we'll use through the Hawking scale... mixed in with
  everything else, morality."** New `demographics.js`. Flagged
  interpretive: "the Hawking scale" is read here as the real, named
  **Hawkins Scale of Consciousness** (David R. Hawkins, *Power vs.
  Force*, 1995) rather than any scale belonging to physicist Stephen
  Hawking -- the context (poor states of mind mixed with morality)
  matches Hawkins' own framework, not a coincidence of a similar name,
  but this reading should be corrected if wrong. `HAWKINS_SCALE` carries
  his own 17 named levels (Shame 20 through Enlightenment 700) and his
  own named `COURAGE_THRESHOLD` of 200 separating destructive from
  constructive states. `WORLD_REGIONS` draws a real origin continent
  off real, approximate UN population-share figures (Asia 0.59, Africa
  0.18, ...) rather than an even split. `drawDemographics` composes
  origin region, religion, culture, a real income tier, and a drawn
  consciousness level onto one real record; `createNpc` and
  `createPlayerState` (`npcs.js`) now both carry it on `demographics`,
  additive and backward compatible with every existing NPC/player test.
- **"A lot of people will have to start off in one-bedroom apartments,
  two-bedroom apartments, till they can move up."** Already real --
  `property.js`'s own residential ladder starts below Penthouse and
  `upgradeHome` is the existing climb; nothing new needed here beyond
  confirming it.
- **"A lot of, there will be some homelessness as well too, that the
  government can't control."** New `homelessness.js`: `isHoused` is a
  real derived read (owns a home via `property.js`, or belongs to a
  household via `households.js`) -- homelessness is never its own
  stored flag, so it can never drift out of sync with the real
  property/household records it is read from. `isHomelessDueToIncome`
  further checks the new `INCOME_LEVELS`' own `maxAffordablePropertyLevel`
  -- a real, derived reason, not a separate invented cause field.
- **"Move into outskirts and find migration to some of these spots
  through word of mouth... that are off the grid. This will become a
  big part of the game."** `immigration.js`'s illegal settlements gain
  `knownByWordOfMouth` (a real, appended list of who has heard, and
  when) via `spreadWordOfMouth` -- deliberately separate from and never
  setting the existing `discovered` field, because word of mouth is
  real, person-to-person knowledge, not official discovery by the
  government.
- **"Culture, religion, and location of where they're coming from...
  will play a big part... this is how these relationships will be
  formed."** `relationships.js` gains `shareBackground` (true when two
  real demographics records match on culture, religion, or origin
  region) and a real `SHARED_BACKGROUND_MULTIPLIER` of 1.5, applied as
  an optional multiplier on `recordConversation`/`recordSharedActivity`
  -- additive, defaulting to no multiplier so every existing
  relationship test is untouched.
- **"Everything is dependent on population, of who survived in the
  vacancy game and who comes over... go to the whole globe and get a
  good percentage."** This is the same real survivor-population figure
  already recorded as open in this document ("the real survivor-
  population figure -- how many people actually made it through
  VACANCY's reset") -- `generateMigrationWave` is already built to
  scale off it the instant it is given; still not invented here.
- **"Some people will let the homeless or less fortunate families come
  live with them... it builds more income and more unity... it also
  could go wrong."** `households.js`'s new `hostGuest` reuses the
  existing `addMember` and rolls a real outcome -- `HOST_GOOD_OUTCOME_CHANCE`
  (0.8) when `shareBackground` is true, `HOST_NEUTRAL_OUTCOME_CHANCE`
  (0.5) otherwise -- "the right combination" made real as a background
  match improving the odds, not a guarantee.
- **"A neighborhood... for the elite and the people who run the
  government... skyscraper and penthouses... set for the elite...
  autonomous cars... small security forces... different attitudes in
  the elite."** New `elite.js`, additive rather than restrictive so the
  existing Penthouse-purchase ladder keeps working for any ordinary
  player: `isElite` is true for the real `GOVERNMENT_LIAISON_ROLE` or
  for already owning the top real residential tier; `purchaseEliteEnclaveUnit`
  sells a separate, new `elite-enclave` property type priced at a real
  1.5x the top Penthouse price (flagged interpretive -- no source gives
  an exact multiplier), with the same claim-before-pay/rollback
  discipline every other purchase in this app uses. `assignPersonalSecurity`
  is a thin wrapper over `robots.js`'s own `deployRobot` -- "different
  attitudes" made real as a real, different robot type per protected
  person, not an invented personality field.
- **"Everybody who comes in the world will have a band similar to Vash
  Tap."** VASH TAP's own `POST /api/taps` is widened to accept a
  trusted-service caller with no end-user session to present
  (`actorOrService(requireSession())`, plus the same `req.callingService`
  check inside `requireCrossAppBusinessOwner`) -- VDP's `server.cjs`
  now calls it (`registerPersonalTap`) as a real, fire-and-forget
  personal Tap registration the moment a brand-new player record is
  created in `ensurePlayer`, since a first-time arrival has no live
  browser session of their own yet for VASH TAP to check.

What this instruction also raised, resolved afterward (9 Oct 2026,
later the same day): DREAMS' per-business screen-purchase scaling was
confirmed already real (`selectScreens` never had a cap), and DREAMS
gained a real, service-credential-only government emergency broadcast
(`lib/emergencyBroadcast.js`) -- not yet wired to a real VDP-side
trigger, since no app in this ecosystem has a real "wanted criminal"
or "missing person" game event yet to call it from. **Also resolved**:
"they also will look at the vacay app for rental properties, commercial
rental properties, homes for sale" -- VACAY Homes' own real listings
browse (`vacay/lib/home/listings.js`, confirmed already real, no new
VACAY code needed) now has a real VDP-side client
(`vacayClient.js`'s `listHomeListings`/`getHomeListing`) and a browse
panel in `VacayView.jsx`, read-only since a real sale or lease settles
outside VCoin.

Still carried into this document's own "what is still open" section
rather than guessed at: native mobile push and VENVS's VACON-C-derived
business/corporation migration path ("hunts" and "the Venus" -- read as
VENVS's own real marketplace, not VAGO's Venus Resort, on "sellers and
buyers" language). Real-time media and the full trait taxonomy are
both resolved below, the same day.

## The real 19-family, 98-trait sheet, and real-time voice/video (9 Oct 2026, a fifth instruction the same day)

Per direct instruction -- "make sure you bring in all the traits,
entrepreneurship, sneakiness, all the things we have from vacancy,"
and "make sure to finish any rendering media that is possible":

- **The real count, checked rather than assumed.** VACON-C's own
  `server/traits.js` is 20 families and 114 traits, not "hundreds or
  thousands" -- stated plainly before building anything, the same
  honesty this document already owes every other borrowed number.
  New `src/lib/traits.js` carries 19 of those 20 families (98 traits)
  copied verbatim, plus VACON-C's own real, derived-archetype layer
  (23 tags -- Natural Leader, Entrepreneur, Risk Taker, ...), a read
  computed fresh every call and never stored, exactly as VACON-C's own
  `archetypes.js` insists an archetype must be.
- **One family deliberately not ported: Skills.** VACON-C's own
  `skills` family is a static roll at generation; VDP already has a
  real, separate, PRACTISED skill system (`skills.js`) for nearly the
  same named subjects, rising through real work/reading/conversation
  rather than a birth draw. Carrying both would put two numbers named
  "Business" on the same person meaning two different things -- the
  "two disagreeing answers to the same question" failure VACON-C's own
  CLAUDE.md names as a standing rule. `Entrepreneur`'s own `when`
  clause is re-pointed at `economic.Risk Appetite` + `economic.Barter
  Skill` rather than the excluded family, carrying the same intent.
- **"Sneakiness," answered in the game itself, not just in
  conversation.** There is no single trait by that name in VACON-C's
  own list -- the honest answer, given directly, is that it maps to
  the real `criminal.Stealth`/`criminal.Deception` traits. A new,
  clearly-marked VDP-only archetype, `Sneaky` (both HIGH), makes that
  answer a real, legible tag rather than leaving it only in this
  document.
- `npcs.js`'s old, invented 6-name set (`ambition`/`diligence`/
  `creativity`/`sociability`/`frugality`/`boldness`) is gone --
  `createNpc`/`createPlayerState` now generate the real sheet.
  Everywhere the old names drove behavior (the petty-swipe gate, the
  friction/fight gate, the government-liaison trait bump), each is
  re-pointed at the single closest real trait (`behavioral
  .Recklessness` for "boldness," `economic.Frugality` for
  "frugality," `social.Charisma` for "sociability," `behavioral
  .Discipline` + `leadership.Command Presence` for a liaison's
  diligence/ambition) rather than guessing a new mapping sight unseen.
  `topTrait` now names the single highest of the real 98 rather than
  the highest of 6; `v4AgentClient.js`'s own NPC-conversation prompt is
  bounded to the top 5 plus any earned archetype tags, since dumping
  all 98 into a system prompt would bury what's actually distinctive
  about one NPC under 93 near-neutral numbers.

- **Real-time media, finished as far as it honestly can be without a
  deployed SFU.** `vaco-media` (this ecosystem's own shared session/
  grant control plane, built in an earlier session but never wired
  into VDP) is now a real VDP dependency: `server.cjs`'s WebSocket
  layer gained `call-invite`/`call-end`, opening a real vaco-media
  session and issuing one real, revocable join grant per side the
  moment two real, connected players want to talk -- VDP's server
  never sees or carries a byte of audio/video, only the session and
  the grants, the same control-plane-only split every other real
  consumer of vaco-media (CVNVO's speed dates, V4 agent calls) already
  uses. `src/lib/mediaRuntime.js` + `CallPanel.jsx` are the real client
  half: `resolveJoin` calls vaco-media's own public `/api/join`
  directly (the credential is the authorization, by that route's own
  design) and `connectCall` actually connects with `livekit-client`
  when a real SFU is configured (`VACO_MEDIA_TRANSPORT=livekit`) --
  and, per `vaco-media`'s own explicit rule ("do not add a `<video>`
  tag pointing at a placeholder file to make a demo look complete"),
  shows the control plane's own honest note instead of a fake video
  element when it is not, which is the real, current state of this
  whole ecosystem: no app anywhere in `deploy/` runs an SFU yet. Live-
  verified end to end: a real session opened, two real distinct join
  credentials issued, `POST /api/join` honestly resolving
  `mediaPlane: "none"` with its own real explanatory note, and a real
  hang-up ending the session for both sides.

## The real 2,100-trait target, fact-checked, and a real 21st family (9 Oct 2026, a sixth instruction the same day)

Per direct instruction: "add any traits or characteristics that could
be added to vdp or vacon c that would make it more efficient... I
thought we had 2100 verifiable traits."

- **The 2,100 figure is real, checked against the actual source
  document rather than taken on memory.** `vacon-c/VACANCY_TRAIT_
  DATABASE_ATTACHMENT.md` really does say "Full spec target: 2,100+
  traits." It is not misremembered. But it is a planning document's
  rough, additive-data-entry STARTING ALLOCATION across six tiers
  (individual ~1,400, family ~150, organization ~200, city ~150,
  civilization ~150, culture ~50) -- its own prose says twice that
  "the literal 2,100-entry catalogue does not exist in this material
  and must be generated." The real, current, implemented total in
  `vacon-c/server/` is far smaller: 122 individual traits (21
  families, after this instruction) plus a handful of real, single-
  scalar dimensions per tier-level entity (family/organization/city/
  civilization), most of which the real code already resolves to
  existing schema columns or computed rollups rather than new rows --
  checked directly in `familyTraits.js`/`organizationTraits.js`/
  `tierTraits.js`, not assumed from the stale planning doc.
- **Why tier-level expansion toward 2,100 is not attempted here.**
  The individual tier genuinely scales by adding named traits per
  family, which is what the addition below is an instance of. The
  other five tiers are each a single flat dimension per name (one
  `wealth` scalar, not fifty wealth-related sub-traits), and most of
  the spec's naively-listed tier-level dimensions already have a real
  home. Inventing dozens of new named sub-dimensions under e.g.
  "wealth" purely to chase 2,100 would be the exact "two disagreeing
  answers to the same question" failure VACON-C's own CLAUDE.md names
  as a standing rule -- not real progress, a second guess.
- **A real, new 21st individual family: `efficiency`** (Time
  Management, Resourcefulness, Process Optimization, Follow-Through,
  Multitasking, Delegation Skill, Waste Reduction, Prioritization) --
  genuinely missing from VACON-C's existing 20 families/114 traits
  (checked directly: no existing trait anywhere covers how well
  someone converts effort into results, distinct from raw skill or
  Discipline/Focus). Added to VACON-C's own `server/traits.js` first,
  then ported here verbatim, matching every other family's "pulled in
  from VACON-C" treatment. Given a real reader on the day it was
  added, in both apps: VACON-C's `economy.productivityOf` gained a
  third real modulator term (same 0.75-1.25 band as its existing
  health/focus terms), and this app's own `traits.js` gained a new
  derived archetype, `Efficient` (Process Optimization + Time
  Management, both HIGH) -- VDP's own addition, same footing as
  `Sneaky`.
- **Not done, flagged rather than silently skipped**: VDP's own
  `jobs.js` pays a flat per-shift wage with no skill/trait-based
  productivity scaling at all -- wiring `efficiency` (or any other
  trait) into VDP's own pay would mean building that scaling from
  nothing, which is a real, separate, larger piece of work than
  "bring in a trait," and is not done here.

## Social class, The Towers, a starter hospital, school and a technological daycare (9 Oct 2026, a seventh instruction the same day)

Per direct instruction: "once more people start to enter the
economy, people that start to accumulate tickets, crime, or face
deportation, or have a certain social class level, I guess we need
some type of class level, they will be moved out to a not
unauthorized area, but an area where people are deployed to for
criminal activity, living standards. They're moved to a project
style, public housing style environment, like a tower, towers, a
non-luxury version, but nice, of the of the village, but more of a
poor version, like a project version. This will also be, will turn
into like the red zones. We also will need a hospital, a starter
hospital, where we'll start off small. Then we will need also
school. We will do mostly online school, but we need to set up some
type of schooling program. We need some type of new technological
daycare."

- **Social class (`socialClass.js`) is a pure, derived READ, never a
  stored field** -- combining four already-real signals: `elite.js`'s
  own `isElite`, `demographics.js`'s drawn income level (carried on
  every player's own `state.demographics`), and `justice.js`'s real
  unpaid-ticket count and active-detention status. A stored class
  value could go stale the instant a ticket is paid off -- exactly
  the "two disagreeing answers to the same question" failure this
  whole ecosystem's own standing rules warn against, so it is
  computed fresh on every read (`GET /api/players/:id/social-class`)
  instead.
- **The Towers (`property.js`'s new `public-housing` type,
  `PUBLIC_HOUSING_NAME`) is a real, separate, non-luxury residential
  type, reassigned rather than sold** -- `assignPublicHousing` takes
  no `transferFn` at all, matching "deployed to" rather than "sold
  to." Relocation itself is automatic and server-side
  (`server.cjs`'s own `maybeRelocateToProjectHousing`), fired after a
  real `/api/justice/tickets/issue` or `/api/justice/detain` call,
  guarded to only ever act on a real player id
  (`store.players[personId]` must already exist) so an NPC's own id
  is never mistaken for one.
- **"Will turn into like the red zones" needed no new mechanic.**
  `security.js`'s own real `crimeByLocation` already derives per-
  location crime concentration purely from each ticket/detention's
  own `locationLabel` field -- giving The Towers a consistent, real
  `locationLabel` (`PUBLIC_HOUSING_NAME`) and letting ordinary future
  citations accumulate there makes it "turn into like a red zone"
  through the EXISTING mechanism. No second, parallel red-zone
  tracker was built.
- **Distinct from `immigration.js`'s `deportPerson`, on purpose.**
  Deportation only operates on a tracked illegal `arrival` record and
  throws if none exists -- necessarily narrower and more severe. The
  new relocation mechanic is broader: available to ANY resident,
  citizen or migrant, once their derived class drops to `at-risk`.
  The two are not chained together.
- **A starter hospital (`hospital.js`), real and intentionally
  small**: one flat-fee checkup (`TREATMENT_COST`, flagged
  interpretive) that bumps every real `health` trait
  (`traits.js`'s own Immune Response, Nutrition Status, Chronic
  Conditions, Sleep Quality -- a family that had zero readers
  anywhere in VDP until now). A `physician` job (see below) staffs
  it, government-run from day one via `PLANETARY_GOVERNORS_PAYROLL`,
  same framing as the water-treatment job -- "start off small" reads
  as scale, not a later arrival.
- **A school (`school.js`), real and mostly free**: "mostly online
  school" is why `attendSchool` takes no `transferFn` and no
  district-presence check at all -- it bumps the real `educational`
  trait family (Literacy, Technical Knowledge, Historical Knowledge,
  Self-Taught Aptitude -- the one trait family with zero readers
  anywhere in VDP before this), once per real school day
  (`ATTEND_COOLDOWN_MS`, flagged interpretive). A `teacher` job
  reuses VACON-C's own real tier-3 occupation entry (`skill:
  'Communication', employers: ['school']`) exactly -- no new skill
  added.
- **A technological daycare (`daycare.js`), honestly scoped.** VDP
  has no children/births/dependent-modeling system anywhere (checked
  directly: no such record in `households.js` or `immigration.js`),
  so this does NOT pretend to model literal child care or
  development. It models the real, bounded benefit the instruction's
  own framing implies: a guardian who enrolls gets a real, flagged-
  interpretive boost (`REST_BOOST_AMOUNT`) to their own `rest` need
  (`npcs.js`'s own need set) -- read as freed-up caregiver time, not
  invented child-development stats. A `daycare-technician` job
  (`Engineering` skill, reading "technological" as monitoring/robot-
  assisted care) is VDP's own flagged-interpretive choice -- no
  "daycare"/"childcare" entry exists in VACON-C's `occupations.js` at
  all, the same real gap `robot-patrol-officer` hit for "police."
- **`Medicine` joined VDP's own `skills.js`**, an exact match to
  VACON-C's real tier-4 `physician` entry (`skill: 'Medicine',
  source: 'medicine'`), the same treatment `hunter`/`farmer`/
  `plumber` already got.
- Four new districts in `world.js` (`towers`, `hospital`, `school`,
  `daycare`), each with a real settlement-tier assignment in
  `settlement.js`: Hospital and School unlock at `Village` (the
  earliest daily-needs cluster, alongside `food`), The Towers and
  Daycare at `Town` (specialized civic infrastructure that only has
  anyone to serve once a real population exists).

## Asylum seekers default to The Towers, with a real elite exception that is not absolute (9 Oct 2026, an eighth instruction the same day)

Per direct instruction: "actually we will do that anybody who is
coming over from the old world seeking asylum to the new world will
be sent to the public housing and only the elite families that come
over with some type of beneficial aspect, no matter if it's
political, resources, or anything of that nature, they will be sent
to the projects. And even some people that are elite will be sent
over there too."

- **A reading note, recorded rather than silently resolved.** Read
  completely literally, this contradicts itself: "public housing" and
  "the projects" are the same real place, named together by this
  same user the same day ("project style, public housing style
  environment... towers"), so a sentence that sends regular asylum
  seekers to public housing and then separately says elite,
  beneficial-aspect families are ALSO "sent to the projects" would
  mean the one named exception does nothing. Read as dictation
  dropping a "not" -- "...will NOT be sent to the projects" -- every
  clause does real, distinct work: a real default, a real exception,
  and a real reminder (the closing sentence) that the exception
  itself is not a guarantee. That is the reading this module
  implements; if it is wrong, the real rule is one boolean flip away
  in `shouldAssignAsylumHousing`.
- **`immigration.js`'s `admitWithPassport` gained two real fields**:
  `seekingAsylum` (boolean, default false) and `eliteSponsorship`
  (free text, default null -- "political, resources, or anything of
  that nature" is the instruction's own open phrasing, same
  discipline `originRegion`/`religion`/`smuggledGoods` already use
  for an explicitly unenumerated category). Kept separate from the
  existing `wealthTier` field on purpose: wealth tier is about
  ADMISSION ORDER ("who gets in first"), this is about HOUSING, a
  separate real fact an arrival can carry regardless of which wealth
  tier admitted them.
- **`shouldAssignAsylumHousing(arrival, { rng })` is a pure predicate**,
  not a side effect -- `property.js`'s own `assignPublicHousing` is
  what actually moves someone, called by `server.cjs` once the
  decision is already made. Default: any `seekingAsylum` arrival with
  no `eliteSponsorship` is assigned. Exception: a real, flagged-
  interpretive `ELITE_ASYLUM_HOUSING_CHANCE` (0.15 -- no document
  gives a real rate) is still rolled for an elite-sponsored arrival,
  so the exemption is a real tendency, never an absolute rule.
- **Wired into all three legal-admission routes**
  (`/api/immigration/admit`, `/apply-citizenship`,
  `/apply-temporary-passport`) -- `seekingAsylum`/`eliteSponsorship`
  now forward from the request body, and `maybeAssignAsylumHousing`
  fires right after a successful admission, for ANY arrival, real
  player or NPC. Unlike the earlier ticket/detention relocation
  trigger (`maybeRelocateToProjectHousing`), there is deliberately no
  real-player guard here -- the arriving person is exactly who this
  is about, not an unrelated id a ticket happened to name.

## Cultural bias in The Towers, and gangs negotiating over smuggling routes (9 Oct 2026, a ninth and tenth instruction the same day)

Per direct instruction: "as people are put into the towers, you'll
have all different type of people from all over the globe. They have
their own culture, so some people will have bias, racism, cultural
bias, cultural differences, and things of that nature." And,
separately: "once trade routes are found and migration routes are
found through the ice wall different groups of people religions gangs
organizations cultures will start to import things and smuggle things
across the border and then certain groups families organizations
tribes gangs will start to make deals and negotiate with each other
for smuggling routes."

- **Cultural bias is the honest, named counterpart to the already-
  real shared-background bonus** (`relationships.js`'s own
  `SHARED_BACKGROUND_MULTIPLIER` -- that comment's own "not built
  yet, but not precluded" parenthetical is exactly this). A
  DIFFERENT background amplifies a HOSTILE exchange
  (`DIFFERENT_BACKGROUND_BIAS_MULTIPLIER`, 1.5) the same way a shared
  one amplifies a warm one. "Some people" (not everyone, every time)
  is why `rollBiasIncident` rolls a real, flagged-interpretive chance
  (`BIAS_INCIDENT_CHANCE`, 0.3 -- no document gives a real rate)
  rather than applying a deterministic penalty on every hostile
  exchange across different backgrounds.
- **Not scoped to The Towers specifically, on purpose.** The
  instruction names Towers as WHY this matters most -- the same
  relocation mechanism that fills it (`socialClass.js`) doesn't
  filter by culture at all, so it's the one place the most different
  backgrounds end up forced into proximity -- but the mechanic itself
  is general, the same way `shareBackground` already is, so it
  applies everywhere two people actually talk.
- **Wiring fixed two pre-existing gaps along the way.** Neither
  `shareBackground` (task #166, built 9 Oct 2026 earlier the same day)
  nor `seedFromSmuggledGoods` (built with `barter.js` itself) had ever
  actually been called from `server.cjs` -- both are now real, live
  reads: a new `demographicsFor(personId)` helper resolves any real
  player OR NPC (`npc-<id>`) to their real demographics for
  `/api/relationships/conversation`, `/api/players/:id/talk`, and the
  WebSocket player-to-player chat handler; `/api/immigration/cross-
  illegally` now actually seeds the smuggler's own real barter
  inventory.
- **`organizations.js` gained a real `gang` type** -- named twice,
  explicitly, in the instruction. No new gate needed: the existing
  `foundOrganization`/`addMember` machinery and the new route-control
  functions below already take any real `organizationId`.
- **Smuggling spots now carry real `controllingOrgId`** (`immigration.js`).
  `claimSmugglingRoute` is first-come-first-claimed -- whichever real
  organization gets there first controls it, refusing to silently
  overwrite an existing claim. `negotiateRouteTransfer` is the real,
  recorded OUTCOME of a deal between two organizations -- like
  `sponsorFamilyMembers` above, this compresses a whole real social
  process (the actual back-and-forth of negotiating, which this
  module does not simulate turn-by-turn) into the one fact that
  matters for the world's own state: control changed hands, by real
  agreement. Checked against who REALLY controls the route right now,
  not merely asserted by the caller -- the same "re-check at the
  moment it matters" discipline `barter.js`'s own `acceptTrade`
  already applies. `server.cjs`'s new `claim-route`/`negotiate-route`
  routes require the acting user to be a real member of a real
  organization actually party to the deal.
- Smuggled goods now also credit the smuggler's real organization's
  shared inventory (if they belong to one), additive to their own --
  "different groups... will start to import things" reads as the
  group benefiting from one of its members' real smuggling run, not
  a replacement for the individual's own stake.

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
  further invented penalty attached. **Partially answered 8 Oct
  2026**: a big enough real organization now has a real alternative
  to being suppressed — `attemptUprising` — but what overpowering
  security actually changes about that area going forward, beyond the
  one revolt's own record, is not specified and not invented here.
- What deportation actually does to a real logged-in player, beyond
  the real record (`deportPerson`'s `deported: true`). An NPC is
  really removed from the live population; this server does not
  forcibly end a real person's own session, and nothing says it
  should — left as a real, visible fact on their own record rather
  than an invented account-level consequence.

This document records what has been confirmed and leaves the rest for
whenever more of the story is given, the same discipline `town.js`
already applies to Meridian's own name.
