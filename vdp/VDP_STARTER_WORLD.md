# VDP — The Starter World, Stage 1 and Stage 2

Per direct instruction (9 Oct 2026): "get down the population, start off
how many people we need for population to start off and how much, how
big the world needs to be, how many apartments, how many houses we're
starting off, how many stores are in the mall... the woods, lakes,
rivers... so we at least have a starter world and then a second stage
of the starter world."

This records what Stage 1 **actually is today**, built from the real
code (not asserted), and names Stage 2 as the next real, scoped build —
not a third invented stage.

## Stage 1 — what is real right now

**Population at boot.** `npcs.createNpcWorld()`'s real founding count
(14) plus one real government liaison per real district
(`npcs.seedGovernmentLiaisons`, 9 Oct 2026) — **39 real NPCs**, zero
real players, the instant the server boots. Per `population.js`'s own
tiers (Hamlet 0 / Village 10 / Town 50 / City 200 / Metropolis 1000),
Meridian is already past **Village** before anyone logs in — the
small, deliberate start `VDP_FOUNDING.md` already describes, not a
number invented for this document.

**How big the world is.** `world.js`'s real grid: **25 built
districts**, 260×260 each, across a 9-row layout (860×2520 canvas
units). `settlement.js`'s real unlock ladder gates which of those 25
are actually open at a given population tier:

| Tier (min population) | Districts that unlock |
|---|---|
| Hamlet (0) | Village District |
| Village (10) | Food, Fashion, Dating Village, Venus Resort |
| Town (50) | VACAY, VOID, The Vavlt, Combat Sports, Meridian Commons |
| City (200) | CHOPZ, Stage, VENVS Publisher, HVNTZ, Vvltvre Music/Pods/Flix |
| Metropolis (1000) | VEX, VADO, VENVM, VACO Analytics, Beat Marketplace, Vvltvre Studios, VACON-C, VACO Merch |

At 39 real NPCs (Village tier), **9 districts are open**; the other 16
are real, walkable, built districts the settlement has not yet grown
into.

**Beyond the 25 built districts: the frontier and the underground
world.** `jobs.js`'s three frontier jobs (lumberjack, farmer, hunter)
work "the undeveloped land around Meridian" — not a `world.js`
district, real ground all the same. `zones.js` (9 Oct 2026) names four
real, distinct frontier zones (Timberline Reach, Stonecut Hollow,
Clearwater Flats, Game Run Thicket) — the real "woods" this document
was asked for, each with its own resource bias. The underground world
is reached through exactly one real smuggling spot
(`immigration.js`'s `leadsToUndergroundWorld`), once a robot patrol
actually finds and marks it, with three of its own real named zones
(The Hollow Market, The Lower Vents, The Sunken Quarter).

**Lakes/rivers.** `cityTiers.js`'s own real water-feature ladder
(Plaza Fountain at the smallest tier up to a real Fishing Lagoon at
the largest) is Meridian Commons' real landscape — `CommonsView.jsx`
reads it live. Honest limit, same one `cityTiers.js` already flags:
this is a real design field for the art pass, not yet drawn as terrain
(VDP's renderer is 2D canvas rectangles today).

**Housing — the real, honest gap this document surfaces.**
`property.js` has 5 real residential tiers (VXLLAGE Studio $500 up to
Penthouse $9000) and land at $200 — but **no pre-built starter
stock**. A home is created the instant someone buys or rents one, not
drawn from a finite starting pool. The instruction's own framing — "a
lot of the world... will be empty until things get established" — is
therefore already true, just not for a chosen reason: it is empty
because nothing has been pre-built there yet, not because a real
housing stock is sitting vacant waiting to fill. **Named as Stage 2's
first real item, below**, not invented here.

**Stores in "the mall."** There is no single mall building. The real
analog today is spread across real districts: Food District (11
sourced flagship restaurants), Fashion District (DEGVCHI's wearable
economy), CHOPZ Shorts (shoppable video), and `property.js`'s own
3-tier commercial slot (Market Kiosk $800 → Storefront $2200 →
Showroom $5000, created on demand, same as housing). "The villages,
the mall, the living quarters... together in a large area" is a real
map-layout request `world.js`'s fixed 3-column grid does not do today
— named as Stage 2's second item.

**Government jobs, and the real wage floor.** 10 real jobs total: 5
district jobs (food-cashier $15/shift up to combat-trainer $22) and 5
founder-run frontier/government jobs (lumberjack $14, farmer $14,
hunter $16, water-treatment-worker $15, robot-patrol-officer $18), all
paid from `jobs.PLANETARY_GOVERNORS_PAYROLL`. Every real shift now
withholds a real 10% income tax (`taxes.DEFAULT_INCOME_TAX_RATE`) into
`taxes.GOVERNMENT_TREASURY_ACCOUNT` — the real number "how much the
government is making through taxes" reads from
(`GET /api/taxes/total`).

**Security and robots.** 5 real robot types (`robots.js`), escalating
with crime from Patrol Drone (Basic tier, 1 deployed) to Military
Robot (Maximum Security, 8 deployed) — `security.js`'s own real,
crime-derived tier decides which.

**The old-world import stock.** `resources.js`'s real, one-way,
shared shipment: **500 units** (`STARTING_OLD_WORLD_STOCK`), drawn down
as the settlement builds, never replenished — "limit import, build from
this world," read literally.

**Migration, once a real survivor count exists.**
`generateMigrationWave`'s real defaults: each wave is 5% of the real
survivor population, 70% legal / 30% illegal, 10% dissident. No wave
fires until a real number is given for how many people actually
survived VACANCY's reset — this document does not invent one.

## Stage 2 — the next real, scoped build (not yet built)

Named here because the instruction explicitly asked for "a second
stage," not because any of this is built today:

1. **A real, finite starter housing stock.** A fixed number of
   pre-built units inside the Village District (a flagged interpretive
   count — e.g. 20 Studios, scaled against the 39-NPC Stage 1
   population rather than guessed independently) that new arrivals are
   actually allocated into, with `property.js`'s existing on-demand
   purchase/rent becoming the overflow path once the real stock is
   full — not the only path, as it is today.
2. **A real mall/village/living-quarters cluster in `world.js`'s own
   grid.** Group the Village District, Food District, Fashion
   District, and a new, real multi-storefront Mall district
   adjacently, with Meridian Commons' lagoon/trail landscape bordering
   that cluster specifically rather than placed as a separate, distant
   row — the literal "together in a large area, with room to grow"
   the instruction asks for. A real layout change, not a new mechanic.
3. **A named starting store count for that real Mall**, once it
   exists — e.g. a flagged interpretive 6 real storefront slots at
   Stage 1's own population, scaling with `cityTiers.js`'s own
   amenity-depth ladder as the settlement grows past Town/City.
4. **Visual placement of the frontier zones and farm distribution**
   near — not inside — the built districts, once VDP's renderer moves
   past flat canvas rectangles (the same honest limit `cityTiers.js`
   already flags for its own water features).

This document is Stage 1's own real inventory plus Stage 2's own
named, scoped next step — not a guess at a third stage beyond what the
instruction actually asked for.
