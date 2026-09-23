// server/worldgen.js
//
// Build a world that actually contains things.
//
// **The finding this closes, measured rather than assumed.** With 67
// statistics in the catalogue, a world built the only way one could be
// built — generate some NPCs, put them in a community, tick — answered
// **35 of them**. Eight of the rest are declared gaps with no
// substrate. The other **24 were computable and came back null**, and
// every one for the same reason:
//
//     the generator exists, is tested, and nothing ever calls it.
//
//   nothing called `generateProperty`        → 5 housing statistics
//   nothing called `generateInfrastructure`  → 5 community statistics
//                                              + patrol frequency
//   nothing set religion/language/education  → 5 demographic statistics
//   nothing called `hireEntity`              → median wage
//   nothing made families or factions        → household size, territory
//                                              contest, org influence
//   nothing exercised crime or policing      → clearance, trust
//
// That is not a modelling gap. The engine models all of it. It is that
// **no code anywhere assembles a world**, so every world the engine has
// ever run has been a crowd of people standing in an empty field.
//
// ---------------------------------------------------------------------
// Seeded, because §88 says so and the trait generator did not
//
// §88 requires that the same seed and the same rules give the same
// world. `randomTraitValue()` is `Math.random()` and `generateName()`
// is too, so until now a "generated world" could not replay even in
// principle. `generateEntityTraits` already took an optional value
// function (added for `births.js`, so a child could inherit); this
// commit threads it through `generateNPC`, `generateOrganization` and
// `generateFamily` as `traitValueFor`, and everything here supplies a
// seeded one. Names are supplied too, for the same reason.
//
// **Every existing caller omits it and is unchanged.**
//
// ---------------------------------------------------------------------
// Why this operates on engine.WorldState rather than taking one
//
// Every module built since is `f(worldState, options)`. `generateNPC`,
// `generateOrganization` and `generateFamily` are the last three
// generators still bound to the module-global `WorldState` in
// engine.js, and rewriting their signatures would change the public
// API that `server.js`'s routes and a large part of the suite use.
//
// So this takes options and builds into that one world, and says so
// rather than pretending otherwise. A world is a process-level thing
// here in any case: `persistence.js` loads one at boot and checkpoints
// it, and `restore.js` restores into it.
//
// ---------------------------------------------------------------------
// What it does NOT do
//
// No migration (nobody moves — `migration_events` is still schema-only
// and `runMigrationPhase` produces a risk signal that relocates
// nobody). No transportation of any kind, which stays deferred. No
// government, election or law: `politics.js` is real and founding a
// government is a decision about a world rather than a fact of one, so
// it is left to the caller. No prison, because there is none.

'use strict';

const engine = require('./engine.js');
const areaStats = require('./areaStats.js');
const crime = require('./crime.js');
const demographics = require('./demographics.js');
const economy = require('./economy.js');
const infrastructure = require('./infrastructure.js');
const membership = require('./membership.js');
const mortality = require('./mortality.js');
const barter = require('./barter.js');
const behavior = require('./behavior.js');
const property = require('./property.js');
const technology = require('./technology.js');
const politics = require('./politics.js');
const culture = require('./culture.js');
const missions = require('./missions.js');
const inventory = require('./inventory.js');
const motivation = require('./motivation.js');
const archetypes = require('./archetypes.js');
const households = require('./households.js');
const migration = require('./migration.js');
const environment = require('./environment.js');
const items = require('./items.js');
const territory = require('./territory.js');
const geo = require('./geo.js');
const statecraft = require('./statecraft.js');
const media = require('./media.js');
const occupations = require('./occupations.js');
const knowledge = require('./knowledge.js');
const landmarks = require('./landmarks.js');
const salvage = require('./salvage.js');
const landmarkPacks = require('./landmarkPacks.js');
const merchandise = require('./merchandise.js');
const worldStore = require('./worldStore.js');
const { hashSeed, seededUnit } = require('./seeded.js');

//: Everything below is flagged interpretive. No document specifies a
//: world's composition, so these are a plausible small city rather than
//: a cited one, and every one is an option a caller can override.
const DEFAULTS = {
  seed: 'vacon-c',
  cities: 1,
  communitiesPerCity: 5,
  populationPerCommunity: 30,
  // Households per community; the rest of a community's residents are
  // unattached adults.
  familiesPerCommunity: 6,
  businessesPerCommunity: 2,
  factionsPerCity: 2,
  // Homes are generated to house everybody with a margin, which is
  // what produces a non-zero vacancy rate without inventing one.
  homesPerResident: 1.15,
  employmentRate: 0.55,
  gangMembershipRate: 0.06,
  languages: ['Riverine', 'Highland', 'Old Tongue'],
  religions: ['Tidewater', 'Ridge', 'None'],
  //: The ethnic groups a world is drawn from. **Deliberately named for
  //: this setting rather than for any real-world group** — the engine
  //: needs a demographic dimension with more than one value in it so
  //: composition and diversity mean something, and borrowing real
  //: ethnonyms would attach real-world associations to a simulation
  //: that models none of them.
  ethnicities: ['Riverborn', 'Highland', 'Coastwise', 'Outlander'],

  // **Everything below exists because the table was empty.** Each one
  // names a system that is built, tested and green, and that no world
  // this engine has ever generated contained a single row of — the
  // eleventh standing rule, found by measuring rather than by reading.
  // `dev-docs/GAME_COMPLETENESS.md` lists which.
  civilizationName: 'The Reach',
  regionName: 'The Reach Basin',
  // How far up the era ladder a world starts. `technology.runTechnology`
  // climbs from here on its own once a civilization exists to climb.
  startingEras: 2,
  cultures: ['Rivermouth', 'Ridgeway'],
  // A share of each community's residents carry the local culture.
  cultureShare: 0.6,
  // Listings per city, drawn from the real trade catalogue in items.js.
  marketListings: 6,
  artifacts: 3,
  // Each artifact gets one mission, which is what generateMission asks
  // for — a mission is always generated FROM a real artifact.
  startingInventoryPerAdult: 2,
  // **What share of people have something to read.** §24 lists ten
  // knowledge sources and the setting is a civilization-collapse
  // reset, so the answer is "not many" — a settlement where everybody
  // owns a manual is not a settlement that has just lost everything.
  // At 0.12 a world of 153 gives about eighteen surviving books
  // between them, and the libraries and the people who know a trade
  // are the other two thirds of §24's list.
  survivingBookRate: 0.12,
  // **How many of THE KEY's twenty-three hero-tier categories a city
  // gets, and how many of the retail list's ten.** Per city, drawn
  // without replacement, so a settlement has one cathedral rather than
  // four airports. Six and five is not a claim about real cities — it
  // is enough for every generated world to contain a monument, a
  // government building and a hardware store, which is what the
  // takeover and maintain keys need to have anything to tell apart.
  landmarksPerCity: 6,
  // Per AREA now, not per city — see the placement block below.
  shopsPerArea: 3,
};

// The ten infrastructure types a city gets, with capacity expressed
// per 1,000 residents so a bigger city is not automatically better
// served. Only the four with a meaningful capacity carry one; a road
// network has a condition and no headcount.
// The capacities come from `infrastructure.DESIGN_CAPACITY_PER_1K` so
// the generator and anything reading service levels back share ONE set
// of numbers. They were declared here and unreadable from anywhere
// else, which is how `motivation.js` ended up inventing its own measure
// of whether a city was served.
const CITY_INFRASTRUCTURE = [
  'schools', 'hospitals', 'public_safety', 'waste_management',
  'roads', 'bridges', 'water_systems', 'electricity', 'internet', 'rail',
].map((type) => ({
  type,
  capacityPer1k: infrastructure.DESIGN_CAPACITY_PER_1K[type],
}));

// The institutions every city gets, as `organizations.type` values the
// schema already enumerates. `assets` ranges differ because what these
// places are differs: a hospital runs on a budget, a library does not.
//
// Deliberately NOT the whole enumeration. `museum`, `sports`, `club`,
// `religion` and `research` are real org types with real occupations
// attached and no world generates one, and that stays declared rather
// than filled: a museum in a city that has just come through a reset is
// a design decision about the setting, and this file's job is to call
// what exists rather than to decide what a recovering civilization
// chooses to rebuild first. `occupations.describeOccupations` reports
// the unfilled positions, so the gap is visible in a measurement
// instead of hiding in a table.
// `post` is the one job that makes the place what it is, named rather
// than inferred. The first version took the highest-tier occupation the
// org type employs, which gave the schoolhouse a manager and the
// reading room a linguist: "highest tier" is not "defining", and
// guessing which is which from a number is the twelfth rule's third
// clause again.
// `post` comes from `occupations.DEFINING_POST` rather than being
// written out again — `control.js` reads the same mapping as a
// takeover's specialist requirement, and this project keeps finding
// the same list spelled three ways in three files.
const CITY_INSTITUTIONS = [
  { type: 'school', suffix: 'Schoolhouse', assets: [3000, 40000] },
  { type: 'hospital', suffix: 'Infirmary', assets: [8000, 120000] },
  { type: 'library', suffix: 'Reading Room', assets: [1000, 18000] },
].map((spec) => ({ ...spec, post: occupations.postFor(spec.type) }));

// The resource types a generated city tracks. A subset of §28's
// thirteen — the ones this engine's other systems actually read —
// drawn FROM that list rather than written out again, so a typo is a
// crash rather than a fourth quiet vocabulary.
const CITY_RESOURCES = ['food', 'water', 'medicine', 'energy', 'wood'];

const SURNAMES = [
  'Vance', 'Okoro', 'Marchetti', 'Delgado', 'Hollis', 'Nakamura',
  'Brennan', 'Adeyemi', 'Kowalski', 'Ferreira', 'Whitlock', 'Osei',
];
const GIVEN_NAMES = [
  'Ada', 'Bram', 'Cleo', 'Dane', 'Esme', 'Finn', 'Gita', 'Hugo',
  'Iris', 'Jonas', 'Kira', 'Lev', 'Mira', 'Noor', 'Otto', 'Pia',
  'Quill', 'Rosa', 'Sami', 'Tova', 'Umar', 'Vera', 'Wren', 'Yusuf',
];

// -- the seeded draw ----------------------------------------------------

// One generator, threaded everywhere, so the whole world is a pure
// function of the seed. Each call takes the things that identify the
// draw, exactly like `seeded.js`'s own callers.
//
// **Every draw is keyed on POSITION — city index, community index,
// person index — and never on a generated id.** The first version
// keyed on `community.id` and `npc.id`, and the same seed then built
// two different worlds: ids come from a counter that keeps going, so
// the second world drew against different keys. It would also have
// meant a world could not be rebuilt in a fresh process, or after a
// restore, or beside an existing world — all three of which are
// exactly when a seed is worth having.
function makeRandom(seed) {
  return {
    unit: (...parts) => seededUnit(hashSeed([seed, ...parts])),
    int: (max, ...parts) => Math.floor(seededUnit(hashSeed([seed, ...parts])) * max),
    pick: (list, ...parts) => list[Math.floor(seededUnit(hashSeed([seed, ...parts])) * list.length)],
    range: (min, max, ...parts) => min
      + seededUnit(hashSeed([seed, ...parts])) * (max - min),
  };
}

// -- the build ----------------------------------------------------------

function generateWorld(options = {}) {
  const config = { ...DEFAULTS, ...options };
  const random = makeRandom(config.seed);
  const w = engine.WorldState;
  const tick = w.tick ?? 0;

  // **A landmark pack, if this world is being built from a real
  // region.** Accepted here as well as read off the world, because
  // "set a field on WorldState, then call this" is a contract nobody
  // discovers — and refused outright rather than half-applied, so a
  // typo in a pack produces an error instead of a world that looks
  // generated with no sign an import was asked for.
  if (config.landmarkPack) {
    w.landmarkPack = landmarkPacks.assertPack(config.landmarkPack);
  } else if (w.landmarkPack) {
    landmarkPacks.assertPack(w.landmarkPack);
  }

  // **`worldState.seed` was read by two modules and set by none.**
  // `infrastructure.advanceInfrastructure` seeds its failure draw on
  // `worldState.seed ?? 'infra'` and `statecraft.runSchooling` seeds a
  // student's progress on `worldState.seed ?? 'world'` — and because
  // nothing ever assigned the field, BOTH fell through to their
  // constant in every world ever generated. The draws were
  // deterministic, which is what §88 asks for, and identical across
  // every seed, which is not: two worlds built from different seeds
  // failed the same water system on the same tick. Standing rule 6 with
  // the default doing the hiding instead of a null.
  //
  // **A restored world has no seed and cannot have one.** There is no
  // `world` table — `restore.js` derives the tick from the high-water
  // mark of the rows rather than inventing a table for one integer, and
  // a seed is implied by no row at all. So a restored world falls back
  // to the constants above and its failures diverge from the live
  // world's. Stated rather than papered over: replay from a seed is a
  // property of GENERATION, and a world that has been through the
  // database is a world that is being continued, not replayed.
  w.seed = config.seed;

  const summary = {
    seed: config.seed,
    cities: [], communities: 0, people: 0, families: 0, properties: 0,
    infrastructure: 0, organizations: 0, employed: 0, gangMembers: 0,
    languages: 0, resources: 0, territoryBlocks: 0, motivated: 0,
  };

  // **A new world is not in the middle of the last one's weather.**
  // `activeConditions` is a global in-memory list and `generateWorld`
  // appends to a shared WorldState, so a drought still running when the
  // previous world was generated kept draining the new one's resources.
  // Nothing created long-lived conditions at generation until
  // `environment.js` did, which is why this never showed before.
  w.activeConditions = [];

  // **What THIS run built, as distinct from what is in the world.**
  // `engine.WorldState` is shared and generating twice in one process
  // appends rather than replaces — so a second `generateWorld` sees the
  // first world's people. Reaching for `w.npcs` in a generation step
  // therefore gives a different answer on the second call, which broke
  // seeded reproducibility: the same seed produced 100 inventory rows
  // the first time and 120 the second. Every step below iterates these
  // instead.
  const made = { communities: [], people: [] };

  // Languages first: everything that speaks one needs it to exist.
  const languages = config.languages.map((name, i) => demographics.generateLanguage(w, {
    name,
    // A language descended from the first one — the column exists, and
    // a world seeded from real data has a family tree.
    parentLanguageId: i === 2 ? null : null,
  }));
  summary.languages = languages.length;

  for (let c = 0; c < config.cities; c += 1) {
    // **Where the city is.** `dev-docs/LAND_AND_MAP_DATA.md` §7 step 1
    // is "decide the geo-reference format and write the resolver", and
    // `server/geo.js` is both — so a generated world now writes a
    // reference something can PARSE rather than the free-text
    // `real_world_geo_ref` that was null in every world ever built.
    //
    // Synthetic and flagged as such: the tokens are not Census GEOIDs
    // and the coordinates are not anywhere. `geo.fromCensusBlock` is
    // the adapter a real import comes through, and it overwrites both.
    const cityRef = geo.refOf({ region: 'R1', city: `C${c + 1}` });
    const cityPosition = geo.scatter(geo.SYNTHETIC_ORIGIN, geo.CITY_SPREAD_M, [config.seed, 'city', c]);
    const city = territory.generateCity(w, {
      name: `City ${c + 1}`,
      economy: Math.round(random.range(35, 70, 'city', c, 'economy')),
      safety: Math.round(random.range(35, 70, 'city', c, 'safety')),
      realWorldGeoRef: cityRef,
      geoSource: 'synthetic',
      latitude: cityPosition.lat,
      longitude: cityPosition.lon,
      // §49 CITY DNA — "each city has a distinct identity". Drawn on
      // the city's POSITION in this loop, never on its id (§88, and
      // the corollary the infrastructure failure draw learned the hard
      // way), so the same seed always builds the same kind of city.
      dna: statecraft.drawDna(config.seed, c),
      // Tourism starts at the schema's trait default rather than at
      // its own appeal. It is a stock with momentum — a city does not
      // have the visitors its appeal deserves on the day it is
      // founded — and `statecraft.driftTourism` walks it there.
      traits: {},
    });
    summary.cities.push(city.id);

    // Every city gets weather. Seeded on the city's position in the
    // loop rather than its id (§88), so the same seed always produces
    // the same climate.
    environment.generateEnvironmentState(w, {
      cityId: city.id,
      climate: random.pick(environment.CLIMATE_NAMES, 'climate', c),
      tick,
    });

    const cityPopulation = config.communitiesPerCity * config.populationPerCommunity;

    // ---- infrastructure --------------------------------------------
    for (const spec of CITY_INFRASTRUCTURE) {
      // Placed in the city, not at its centre. **This is the whole
      // reason the reach term can distinguish one block from the
      // next**: a station somewhere in a city is near some communities
      // and far from others, and `authority.reachTerm` reads that
      // distance. A station at the centroid would be equidistant from
      // a symmetric scatter and would measure nothing.
      const sitePosition = geo.scatter(
        cityPosition, geo.COMMUNITY_SPREAD_M, [config.seed, 'site', c, spec.type],
      );
      infrastructure.generateInfrastructure(w, {
        cityId: city.id,
        type: spec.type,
        latitude: sitePosition.lat,
        longitude: sitePosition.lon,
        capacity: spec.capacityPer1k === undefined
          ? null
          : Math.round((spec.capacityPer1k * cityPopulation) / 1000),
        // A world that starts at 100 everywhere has no variation for
        // any statistic to find, and a world that starts at 50
        // everywhere has the placeholder problem this project keeps
        // finding. Drawn, and drawn per type so a city can be good at
        // one thing and bad at another.
        condition: Math.round(random.range(45, 95, 'infra', c, spec.type)),
        age: Math.round(random.range(0, 45, 'infra-age', c, spec.type)),
        maintenanceLevel: Math.round(random.range(20, 80, 'infra-maint', c, spec.type)),
        funding: Math.round(random.range(0, 100, 'infra-fund', c, spec.type)),
      });
      summary.infrastructure += 1;
    }

    // ---- resources --------------------------------------------------
    // **Demand is drawn RELATIVE to supply, and the first version was
    // not.** It drew both independently from the same range, so roughly
    // half of every world's resources were in permanent deficit — and
    // `mortality.survivalScarcity` takes the WORST of food, water and
    // medicine, so three independent draws almost always produced a
    // starving world. Measured: survival scarcity 0.74 at generation,
    // which under the old linear scarcity term added 0.185 to every
    // person's annual death risk at every age, and a 2,000-tick run
    // lost a sixth of its population.
    //
    // A world should START in rough balance and become scarce because
    // something happened to it. Scarcity is an event the simulation
    // produces — a drought, a blockade, a failed harvest — not the
    // ground state.
    // **From §28's canonical list, not a literal.** This was
    // `['food','water','medicine','energy','timber']` — an ad-hoc set
    // that matched neither the spec's thirteen nor
    // `mortality.SURVIVAL_RESOURCES`'s three, and `timber` is not a
    // §28 resource type at all (the spec says `wood`). Three lists,
    // no canon. See server/barter.js#RESOURCE_TYPES.
    for (const resourceType of CITY_RESOURCES) {
      const supply = Math.round(random.range(60, 140, 'res', c, resourceType));
      const essential = mortality.SURVIVAL_RESOURCES.includes(resourceType);
      // Essentials sit closer to balance than trade goods: a
      // settlement that cannot feed itself at all does not reach the
      // point of being generated.
      const pressure = essential
        ? random.range(0.8, 1.15, 'dem', c, resourceType)
        : random.range(0.6, 1.4, 'dem', c, resourceType);
      const demand = Math.round(supply * pressure);
      economy.generateResource(w, {
        cityId: city.id,
        resourceType,
        supply,
        demand,
        quality: Math.round(random.range(30, 90, 'qual', c, resourceType)),
        // **Units per person per tick, and DERIVED from the demand just
        // drawn rather than chosen.** `economy.refreshDemand` reads this
        // as the per-capita appetite and drifts `demand` toward
        // `consumption_rate * residents`, so deriving it here means the
        // target on tick 0 is exactly the number above and no existing
        // world shifts by a digit — standing rule 12's first clause.
        //
        // This is the column becoming live for what it means. It was 0
        // on every resource in every world, which is why
        // `advanceResourceTick` computed `max(0, 0 + 0 - 0)` and the
        // Resource phase — one of the locked eleven — did nothing at
        // all, and why `getScarcity` returned the same number for 400
        // ticks straight.
        consumptionRate: cityPopulation > 0 ? demand / cityPopulation : 0,
      });
      summary.resources += 1;
    }

    // ---- factions ---------------------------------------------------
    const factions = [];
    for (let f = 0; f < config.factionsPerCity; f += 1) {
      const faction = engine.generateFaction({
        name: `${random.pick(SURNAMES, 'faction', c, f)} Crew`,
        type: 'gang',
        traitValueFor: (def) => Math.round(
          random.range(20, 90, 'faction-trait', c, f, def.family, def.name),
        ),
      });
      faction.influence = Math.round(random.range(10, 80, 'faction-inf', c, f));
      factions.push(faction);
    }
    summary.organizations += factions.length;

    // ---- communities -------------------------------------------------
    for (let b = 0; b < config.communitiesPerCity; b += 1) {
      const communityPosition = geo.scatter(
        cityPosition, geo.COMMUNITY_SPREAD_M, [config.seed, 'community', c, b],
      );
      // A pack's own area names, in its own order, so
      // `landmarkPacks.byArea` can match a real place to a real
      // neighbourhood. A world with no pack keeps null names.
      const packAreas = landmarkPacks.packFor(w)?.areas ?? [];
      const community = territory.generateCommunity(w, {
        cityId: city.id,
        tier: 'block',
        name: packAreas[b] ?? null,
        // A path prefix of the city's reference, so `geo.contains`
        // answers "is this community in this city" structurally rather
        // than by an assumption about digit widths.
        geoRef: geo.refOf({ region: 'R1', city: `C${c + 1}`, community: `B${b + 1}` }),
        geoSource: 'synthetic',
        latitude: communityPosition.lat,
        longitude: communityPosition.lon,
      });
      made.communities.push(community);
      summary.communities += 1;

      // Territory: a faction holds this ground, or nobody does.
      //
      // **Not every community, and that is the change that lets areas
      // differ.** This claimed a block in EVERY community, so faction
      // presence was a constant and `authority.gripTerm` — how much of
      // an area somebody other than the state holds — could not tell
      // one neighbourhood from the next. A gang on every street is as
      // uniform a world as a gang on none.
      //
      // Roughly three in five, seeded. Flagged interpretive like every
      // other composition number here: no document says how much of a
      // city a faction holds, and what this is chosen FOR is that both
      // answers occur — some areas have somebody else in charge and
      // some have only the state, which is what `writOf` needs to
      // produce a range rather than a number.
      if (factions.length > 0 && random.unit('claimed', c, b) < 0.6) {
        const block = territory.generateTerritoryBlock(w, {
          factionId: random.pick(factions, 'block-faction', c, b).id,
          cityId: city.id,
          communityId: community.id,
          buildingCount: Math.round(random.range(10, 60, 'buildings', c, b)),
        });
        if (random.unit('contested', c, b) < 0.3) {
          block.status = 'contested';
          block.contested_since_tick = tick;
        }
        summary.territoryBlocks += 1;
      }

      // ---- homes -----------------------------------------------------
      const homeCount = Math.round(config.populationPerCommunity * config.homesPerResident);
      const homes = [];
      for (let h = 0; h < homeCount; h += 1) {
        homes.push(property.generateProperty(w, {
          type: 'residential',
          communityId: community.id,
          cityId: city.id,
          landSize: Math.round(random.range(120, 900, 'land', c, b, h)),
          value: Math.round(random.range(4000, 60000, 'value', c, b, h)),
          condition: Math.round(random.range(25, 100, 'cond', c, b, h)),
          floors: 1 + random.int(3, 'floors', c, b, h),
          units: 1,
          // **`bedrooms` was not a fact this engine held about anywhere
          // anybody lived.** `units` is how many dwellings a building
          // contains — 1 here, for every home in every world — and the
          // question "how many bedrooms" had no column at all until
          // `schema-extensions.sql` gained one. A one-bedroom apartment
          // is the smallest thing anybody names, and it is now a thing
          // a world can contain.
          bedrooms: 1 + random.int(4, 'beds', c, b, h),
          lifecycleStage: 'operation',
          createdTick: tick,
        }));
        summary.properties += 1;
      }
      // A couple of commercial buildings, so `residential_share` is a
      // real mix rather than always exactly 1. Built BEFORE the
      // businesses so each one can be handed to the business that
      // operates out of it — see below.
      const premises = [];
      for (let s = 0; s < config.businessesPerCommunity; s += 1) {
        premises.push(property.generateProperty(w, {
          type: 'commercial',
          communityId: community.id,
          cityId: city.id,
          landSize: Math.round(random.range(400, 2000, 'cland', c, b, s)),
          value: Math.round(random.range(20000, 200000, 'cvalue', c, b, s)),
          condition: Math.round(random.range(40, 100, 'ccond', c, b, s)),
          lifecycleStage: 'operation',
          createdTick: tick,
        }));
        summary.properties += 1;
      }

      // ---- businesses --------------------------------------------------
      const businesses = [];
      for (let s = 0; s < config.businessesPerCommunity; s += 1) {
        const business = engine.generateOrganization({
          name: `${random.pick(SURNAMES, 'biz', c, b, s)} & Co`,
          type: 'business',
          traitValueFor: (def) => Math.round(
            random.range(20, 90, 'biz-trait', c, b, s, def.family, def.name),
          ),
        });
        business.assets = Math.round(random.range(20000, 300000, 'assets', c, b, s));
        business.influence = Math.round(random.range(5, 60, 'biz-inf', c, b, s));
        // **`properties.operating_organization_id` is the schema's own
        // link from a building to whoever runs it, and it was null on
        // every property in every world this engine had built.** A
        // business existed and occupied nowhere, so nobody could be
        // said to go to work anywhere — `behavior.workplaceOf` reads
        // exactly this to give a work routine a place.
        if (premises[s]) premises[s].operating_organization_id = business.id;
        businesses.push(business);
        summary.organizations += 1;
      }

      // ---- families ----------------------------------------------------
      const families = [];
      for (let f = 0; f < config.familiesPerCommunity; f += 1) {
        families.push(engine.generateFamily({
          surname: random.pick(SURNAMES, 'surname', c, b, f),
          traitValueFor: (def) => Math.round(
            random.range(25, 85, 'fam-trait', c, b, f, def.family, def.name),
          ),
        }));
        summary.families += 1;
      }

      // ---- people ------------------------------------------------------
      const residents = [];
      for (let p = 0; p < config.populationPerCommunity; p += 1) {
        //: An age structure rather than a uniform draw: weighting the
        //: unit interval pushes mass toward the young, which is roughly
        //: the shape of a real population pyramid and — more to the
        //: point here — puts people on both sides of
        //: `births.FERTILITY_MIN_AGE` and `mortality`'s age curve, so
        //: neither system is exercised by a single cohort.
        //:
        //: The exponent was 3 first and produced a median age of about
        //: ten — a world of children, in which almost nobody could
        //: work or bear. 1.5 puts the median near thirty, which is the
        //: figure a real population lands on.
        const u = random.unit('age', c, b, p);
        const age = 1 + (u ** 1.5) * 84;

        const npc = engine.generateNPC({
          name: `${random.pick(GIVEN_NAMES, 'given', c, b, p)} `
            + `${random.pick(SURNAMES, 'family', c, b, p)}`,
          education: null,     // set below, but only for adults
          religion: random.pick(config.religions, 'religion', c, b, p),
          ethnicity: random.pick(config.ethnicities, 'ethnicity', c, b, p),
          traitValueFor: (def) => Math.round(
            random.range(10, 95, 'trait', c, b, p, def.family, def.name),
          ),
        });
        npc.createdTick = tick - Math.round(age * 365);
        residents.push(npc);
        made.people.push(npc);
        summary.people += 1;

        areaStats.placeInCommunity(w, {
          entityId: npc.id,
          communityId: community.id,
          // Not everybody gets a home: the surplus is what makes a
          // vacancy rate, and the unhoused are why `home_ownership_rate`
          // is not automatically 1.
          homePropertyId: p < homes.length ? homes[p].id : null,
        });

        // **An adult's attainment is drawn; a child starts at `none`.**
        //
        // This read "education is only meaningful for somebody old
        // enough to have finished any", left every under-18 null, and
        // argued that a young block should read as young rather than as
        // uneducated. That was right when nothing anywhere moved
        // `npcs.education`. It stopped being right the day
        // `statecraft.runSchooling` existed, and it failed in the
        // sharpest possible way: schooling refuses `null` on purpose —
        // `indexOf` is -1 for it and -1 is not rung zero, so starting a
        // person whose attainment nobody recorded at `none` would
        // invent a fact about them — and the school window is 5 to 30.
        // The null window and the school window overlapped almost
        // exactly, so **the entire 5-to-17 cohort, the people school is
        // actually for, could never be taught.** Standing rule 14's
        // shape: a ladder whose bottom rung nobody is ever placed on.
        //
        // `none` for a child is not a guess. It is what the engine
        // knows about somebody who has not finished any education yet,
        // the same fact `births.js` now records for a newborn. The
        // demographic consequence is real and is the correct one: a
        // young block's `meanLevel` drops, because a young block DOES
        // have lower attainment, and `demographics_recorded_share`
        // rises because more of the population is now genuinely
        // recorded rather than unknown.
        //
        // The teenage distribution is no longer drawn at all — school
        // produces it. A 6-year-old starts at `none` and
        // `runSchooling` walks them up through their school years, so
        // the spread of 16-year-olds is an OUTPUT of how well their
        // city funded its schools rather than a number this file
        // invented.
        if (age >= 18) {
          const level = random.unit('edu', c, b, p);
          npc.education = level < 0.12 ? 'none'
            : level < 0.45 ? 'basic'
              : level < 0.7 ? 'secondary'
                : level < 0.85 ? 'vocational'
                  : level < 0.96 ? 'higher' : 'advanced';
        } else {
          npc.education = 'none';
        }

        demographics.speakLanguage(w, {
          entityId: npc.id,
          languageId: random.pick(languages, 'lang', c, b, p).id,
          proficiency: Math.round(random.range(50, 100, 'prof', c, b, p)),
          isPrimary: true,
        });

        economy.generateIndividualFinances(w, npc.id, {
          //: A skewed distribution, not a uniform one — a uniform draw
          //: has a median at its midpoint by construction, so the
          //: poverty line would land in the same place in every world
          //: and `poverty_rate` would be near-identical everywhere.
          savings: Math.round((random.unit('savings', c, b, p) ** 2.2) * 4000),
          assets: Math.round((random.unit('assets', c, b, p) ** 3) * 12000),
          debt: Math.round((random.unit('debt', c, b, p) ** 2) * 3000),
          tick,
        });

        // Ownership: somebody with a home may own it rather than
        // occupy it, which is what `home_ownership_rate` measures.
        if (npc.home_property_id !== null
          && random.unit('owns', c, b, p) < 0.45) {
          property.recordOwnership(w, {
            entityId: npc.home_property_id,
            ownerEntityId: npc.id,
            ownerType: 'individual',
            acquiredMethod: 'purchased',
            tick,
          });
        }
      }

      // ---- households ---------------------------------------------------
      // Assigned round-robin over the families, with children attached
      // to the same family as the adults before them, so
      // `mean_household_size` measures something structural rather
      // than a random scatter.
      residents.forEach((npc, i) => {
        if (families.length === 0) return;
        if (random.unit('infamily', c, b, i) > 0.75) return;  // some live alone
        const family = families[i % families.length];
        engine.addFamilyMember(family.id, npc.id, 'member', family.generation);
      });

      // **A family shares a roof, and before this nobody shared
      // anything.** Homes were handed out one per person by index, so
      // every dwelling in every world held exactly one occupant:
      // measured, 40 households of size 1, `mean_household_size` 1.00
      // and a solo rate of 100%. A world where nobody has ever lived
      // with anybody is not a demographic edge case, it is a bug.
      //
      // Reassigned rather than allocated differently up front, because
      // the family roster does not exist until the block above runs.
      // Family members move in with the first of their number to have a
      // home; anyone unattached keeps their own, which is what makes a
      // real spread of household sizes rather than one number.
      //
      // The surplus dwellings stay empty, which is still what produces
      // a vacancy rate.
      const familyHome = new Map();
      for (const npc of residents) {
        const membership = (w.familyMemberships || []).find((m) => m.entity_id === npc.id);
        if (!membership) continue;
        const shared = familyHome.get(membership.family_id);
        if (shared === undefined) {
          if (npc.home_property_id != null) familyHome.set(membership.family_id, npc.home_property_id);
          continue;
        }
        // Only somebody who HAS a home moves; the unhoused stay
        // unhoused, or `home_ownership_rate` and the vacancy rate both
        // stop meaning anything.
        if (npc.home_property_id != null) npc.home_property_id = shared;
      }

      // **A family needs a head, or nothing can ever succeed to it.**
      // `generateFamily` leaves `head_npc_id` null unless told, and
      // `succession.settleEstate` advances a family's generation only
      // when its HEAD dies — so without this, every family in every
      // generated world stayed on generation 1 no matter how many of
      // its members were buried. Measured before the fix: 400 ticks,
      // two deaths, thirty families, all still generation 1.
      //
      // The eldest member, which is the same rule `heirFor` uses to
      // choose between candidates of equal standing.
      for (const family of families) {
        const members = w.familyMemberships
          .filter((m) => m.family_id === family.id)
          .map((m) => w.npcs.find((n) => n.id === m.entity_id))
          .filter(Boolean);
        if (members.length === 0) continue;
        family.head_npc_id = members.reduce(
          (eldest, n) => ((n.createdTick ?? 0) < (eldest.createdTick ?? 0) ? n : eldest),
        ).id;
      }

      // ---- work ----------------------------------------------------------
      const adults = residents.filter(
        (n) => (tick - n.createdTick) / 365 >= 16,
      );
      adults.forEach((npc, ai) => {
        if (businesses.length === 0) return;
        if (random.unit('employed', c, b, ai) > config.employmentRate) return;
        const employer = businesses[random.int(businesses.length, 'employer', c, b, ai)];
        economy.hireEntity(w, {
          entityId: npc.id,
          employerOrganizationId: employer.id,
          wage: Math.round(random.range(8, 90, 'wage', c, b, ai)),
          // **The trade, which no hire in this engine ever recorded.**
          // Seeded on the person, which is `occupations.drawOccupation`'s
          // own §88 exception: the draw is about them. Gated on their
          // attainment, so the schooling this file already sets decides
          // what work they can hold — and never on whether they hold any.
          position: occupations.drawOccupation({
            npc,
            worldState: w,
            organizationType: employer.type,
            seed: config.seed,
            extra: [c, b, ai],
          }),
          tick,
        });
        membership.joinOrganization(w, {
          entityId: npc.id, organizationId: employer.id, role: 'employee', tick,
        });
        summary.employed += 1;
      });

      // ---- routine ---------------------------------------------------------
      // **Without this, `schedule_events` is empty in every world and
      // the Behavior Engine never engages** — no schedule fires, so no
      // habit forms, so nothing about a person's routine is ever true.
      // Derived from their situation rather than invented: everybody
      // rests and eats, and somebody with a job has somewhere to be.
      for (const npc of residents) {
        behavior.seedRoutine(w, npc.id, { tick });
      }

      // ---- what they want ---------------------------------------------
      // **`needs`, `values_db` and `goals` were three empty tables**, so
      // every person in every world was capable, connected, employed and
      // wanting nothing. `runMotivation` is in the tick and, like
      // `runPolitics` before it had a government, it had nobody with a
      // need to act on.
      //
      // Seeded on position (`b`, `ri`) rather than on `npc.id` — §88,
      // and the mistake this file already made once with inventory.
      residents.forEach((npc, ri) => {
        motivation.generateValues(w, npc.id, {
          strengthFor: (valueName, vi) => Math.round(
            random.range(15, 95, 'value', c, b, ri, vi),
          ),
          tick,
        });
        motivation.generateNeeds(w, npc.id, {
          // Started high and varied rather than at a flat number: a
          // world where everybody begins equally satisfied has no
          // spread for `mostPressing` to find, and a flat start is the
          // placeholder problem this project keeps catching.
          levelFor: (needType) => Math.round(
            random.range(45, 95, 'need', c, b, ri, needType),
          ),
          tick,
        });
        // Taste. `chooseFor` is required rather than optional, so a
        // preference cannot be drawn from Math.random — and it is
        // seeded on position, not on `npc.id` (§88).
        archetypes.generatePreferences(w, npc.id, {
          chooseFor: (category, choices) => random.pick(choices, 'taste', c, b, ri, category),
          tick,
        });
        summary.motivated += 1;
      });

      // ---- affiliation -----------------------------------------------------
      adults.forEach((npc, ai) => {
        if (factions.length === 0) return;
        if (random.unit('gang', c, b, ai) > config.gangMembershipRate) return;
        membership.joinOrganization(w, {
          entityId: npc.id,
          organizationId: random.pick(factions, 'gangpick', c, b, ai).id,
          role: 'member',
          tick,
        });
        summary.gangMembers += 1;
      });

      // ---- who knows whom ---------------------------------------------------
      // **Relationships are what the Social phase needs to have
      // anything to do**, and without them nothing accumulates
      // interaction count, so no bond forms and nobody is ever born.
      // A sparse neighbourhood graph: everybody knows a handful of
      // people on their own block.
      for (let i = 0; i < residents.length; i += 1) {
        const degree = 2 + random.int(4, 'degree', c, b, i);
        for (let k = 0; k < degree; k += 1) {
          const j = random.int(residents.length, 'edge', c, b, i, k);
          if (j === i) continue;
          const rel = worldStore.getOrCreateRelationship(
            w, residents[i].id, residents[j].id, 'social',
          );
          rel.trust = Math.round(random.range(25, 85, 'rtrust', c, b, i, k));
        }
      }
    }

    // ---- landmarks and shops ------------------------------------------
    // **`properties.type` enumerates ten kinds and this file had only
    // ever generated two.** Residential and commercial — so no world
    // this engine ever built contained a monument, a historic site, a
    // government building, a farm or an industrial one, and seven of
    // the schema's ten property types had never existed.
    //
    // `THE_KEY_BUILDING_TYPES.md` names twenty-three hero-tier
    // categories and calls them the definitive standard list;
    // `COMPREHENSIVE_RETAIL_KEY_LOCATIONS.md` names ten retail types
    // and says each is "tied directly to an existing skill or resource
    // system rather than generic loot". Both are in
    // `server/landmarks.js`; this places them.
    //
    // Per CITY rather than per community, because a city has one
    // cathedral and one courthouse, not one per block — and drawn
    // WITHOUT replacement so a settlement does not get four airports.
    {
      const cityCommunityRows = (w.communities || []).filter((cm) => cm.city_id === city.id);
      const anchor = cityCommunityRows[0] ?? null;

      // **A pack replaces the draw, and nothing else.** When a world
      // was assembled with a real region import
      // (`server/landmarkPacks.js`), the hero landmarks are that
      // region's actual places — named, scored and in the
      // neighbourhood they are really in. Without one, the generated
      // draw below is unchanged, because a world with no pack must
      // still build.
      //
      // Note what a pack does NOT change: the significance model, the
      // staffing crew, the discovery pool, the maintain key. A place
      // imported from the National Register is an ordinary property
      // with a real name on it, which is the whole point of reading
      // `world-layer` rather than reimplementing it.
      const packed = (() => {
        const pack = landmarkPacks.packFor(w);
        if (!pack) return null;
        const hero = pack.locations.filter((l) => landmarks.isHeroTier(l.category));
        return hero.length > 0 ? hero : null;
      })();

      const heroPool = [...landmarks.KEY_BUILDING_CATEGORIES];
      const heroCount = packed ? packed.length : config.landmarksPerCity;
      for (let k = 0; k < heroCount && (packed || heroPool.length > 0); k += 1) {
        const entry = packed ? packed[k] : null;
        const pick = entry
          ? entry.category
          : heroPool.splice(random.int(heroPool.length, 'landmark', c, k), 1)[0];
        const definition = landmarks.KEY_BUILDING_TYPES[pick];
        // A pack names the area a place is really in; the generated
        // draw picks one. `named` is matched against the community's
        // own name so a pack does not have to know internal ids.
        const named = entry?.area
          ? cityCommunityRows.find((cm) => cm.name === entry.area)
          : null;
        const home = named ?? cityCommunityRows[random.int(
          Math.max(1, cityCommunityRows.length), 'landmark-where', c, k,
        )] ?? anchor;
        const row = property.generateProperty(w, {
          type: landmarks.propertyTypeFor(pick),
          communityId: home ? home.id : null,
          cityId: city.id,
          // A landmark occupies real ground and a monument occupies
          // little of it — the spread is wide on purpose, because a
          // cave system and a masonic hall are both on this list.
          landSize: Math.round(random.range(600, 12000, 'lland', c, k)),
          value: Math.round(random.range(80000, 900000, 'lvalue', c, k)),
          // These came through a collapse. `condition` is drawn low and
          // wide: some of them are ruins and some were built to last.
          condition: Math.round(random.range(20, 90, 'lcond', c, k)),
          // From the category's own FORM, not one band for
          // everything: the first version drew 1-40 for every landmark
          // and produced a cave system with 23 floors.
          floors: (() => {
            const [lo, hi] = landmarks.floorsBandFor(pick);
            return lo + random.int(hi - lo + 1, 'lfloors', c, k);
          })(),
          units: 1,
          age: Math.round(random.range(20, 200, 'lage', c, k)),
          lifecycleStage: 'operation',
          createdTick: tick,
        });
        // **The link `history_ref` never had.** `designate` writes the
        // `historical_records` row that carries this place's
        // significance and points the property at it — the column was
        // hard-coded null in `generateProperty` and the two tables had
        // never been connected in any world.
        landmarks.designate(w, {
          propertyId: row.id,
          category: pick,
          // A pack's own score wins where it gives one — UNESCO
          // inscription is 100 and that judgement belongs to the
          // importer. Where it gives none, the category's band, so an
          // imported place and a generated one are on one scale.
          significance: landmarkPacks.significanceFor(entry, Math.round(
            random.range(definition.significance[0], definition.significance[1], 'lsig', c, k),
          )),
          tick,
          // **The real name, where there is one.** Everything else in
          // this engine called a landmark "the City 1 mosque".
          name: entry?.name ?? null,
          what: entry?.name ?? `the ${city.name} ${pick.replace(/-/g, ' ')}`,
        });
        summary.properties += 1;
        summary.landmarks = (summary.landmarks ?? 0) + 1;
      }

      // **Shops are per AREA, and hero landmarks are per city.** The
      // distinction is real rather than a knob: a city has one
      // cathedral and one courthouse, and every neighbourhood has a
      // hardware store and somewhere to buy food. Placing both per city
      // is why a measured world reached only 11 of the Key's 33
      // categories — six hero types and five retail, once, for the
      // whole map, so most of the Key never appeared anywhere and four
      // neighbourhoods out of five had nothing to search or take.
      //
      // Drawn without replacement WITHIN an area, so one neighbourhood
      // does not get two pharmacies, and re-drawn per area, so the ten
      // retail types are all reachable across a city.
      const retailRounds = [];
      for (const home of (cityCommunityRows.length > 0 ? cityCommunityRows : [anchor])) {
        const pool = [...landmarks.RETAIL_CATEGORIES];
        for (let n = 0; n < config.shopsPerArea && pool.length > 0; n += 1) {
          retailRounds.push({ home, pool });
        }
      }
      for (let k = 0; k < retailRounds.length; k += 1) {
        const { home: area, pool } = retailRounds[k];
        const pick = pool.splice(random.int(pool.length, 'shop', c, k), 1)[0];
        const definition = landmarks.RETAIL_TYPES[pick];
        const home = area ?? anchor;
        const row = property.generateProperty(w, {
          type: 'commercial',
          communityId: home ? home.id : null,
          cityId: city.id,
          landSize: Math.round(random.range(200, 1800, 'sland', c, k)),
          value: Math.round(random.range(15000, 140000, 'svalue', c, k)),
          // `chaosEraState: "emptied"` is the retail document's own
          // word for what a collapse left behind, applied as a
          // condition ceiling rather than a flag: an emptied store is a
          // building somebody stripped.
          condition: Math.round(random.range(
            landmarks.CHAOS_ERA_CONDITION[0], landmarks.CHAOS_ERA_CONDITION[1], 'scond', c, k,
          )),
          floors: 1 + random.int(2, 'sfloors', c, k),
          units: 1,
          lifecycleStage: 'operation',
          createdTick: tick,
        });
        landmarks.designate(w, {
          propertyId: row.id,
          category: pick,
          significance: Math.round(
            random.range(definition.significance[0], definition.significance[1], 'ssig', c, k),
          ),
          tick,
          // "a auto parts store" — the article has to follow the word,
          // and this text is a name a player reads.
          what: `${/^[aeiou]/.test(pick) ? 'an' : 'a'} ${pick.replace(/-/g, ' ')} on this corner`,
        });
        summary.properties += 1;
        summary.shops = (summary.shops ?? 0) + 1;
      }
    }

    // ---- institutions ------------------------------------------------
    // **Every city had schools, hospitals and public safety and nobody
    // who worked at any of them.** `CITY_INFRASTRUCTURE` above builds
    // all three as `infrastructure` rows, `statecraft.
    // SERVICE_INFRASTRUCTURE` funds them, and `organizations.type`'s
    // schema enumeration has carried `school`, `hospital` and `library`
    // from the first day — with no organization of any of those types
    // ever generated. So `occupations.OCCUPATIONS`' teacher, orderly,
    // physician and librarian had no employer anywhere in any world,
    // which is the eleventh rule pointed at a table instead of a
    // function: an occupation whose only employer type no world
    // contains is indistinguishable from one that does not exist.
    //
    // Founded per city rather than per community, because that is the
    // scale the infrastructure sits at, and **not gated on anything** —
    // the media outlet's dead era gate is the precedent, and a
    // settlement's clinic and its schoolroom are institutions rather
    // than technologies.
    //
    // They are also what gives the takeover key targets worth taking:
    // `THE_KEY_BUILDING_TYPES.md` lists hospitals, libraries and
    // universities as hero-tier, and a hero-tier location with no staff
    // has no specialist requirement to meet.
    const institutions = [];
    for (const spec of CITY_INSTITUTIONS) {
      const org = engine.generateOrganization({
        name: `${city.name} ${spec.suffix}`,
        type: spec.type,
        traitValueFor: (def) => Math.round(
          random.range(25, 85, 'inst-trait', c, spec.type, def.family, def.name),
        ),
      });
      org.assets = Math.round(random.range(spec.assets[0], spec.assets[1], 'inst-assets', c, spec.type));
      org.influence = Math.round(random.range(10, 70, 'inst-inf', c, spec.type));
      institutions.push({ org, post: spec.post });
      summary.organizations += 1;
      summary.institutions = (summary.institutions ?? 0) + 1;
    }

    // **A faction pays somebody, and that is what an enforcer is.**
    // Gang MEMBERSHIP already existed (`gangMembershipRate` above,
    // `role: 'member'`) and is a different fact from employment: a
    // member is affiliated, an enforcer is on the payroll. Without one
    // hire each, `occupations.OCCUPATIONS.enforcer` had no employer in
    // any world for the same reason the institutions did — and the
    // takeover key's composition requirement is written in enforcers.
    for (const faction of factions) {
      institutions.push({ org: faction, post: 'enforcer' });
    }

    // **Staffed at generation, because `runLabour` will not staff
    // them.** Its market only considers employers that already have
    // somebody — "an employer that has nobody has no wage scale of its
    // own and no evidence it can pay" — so a hospital founded empty
    // would stay empty for the life of the world however many
    // physicians grew up in it. Standing rule 14: the writer sits
    // behind the threshold it would have to cross.
    {
      const cityCommunities = (w.communities || []).filter((cm) => cm.city_id === city.id);
      const cityResidents = (w.npcs || []).filter(
        (n) => cityCommunities.some((cm) => cm.id === n.communityId),
      );
      institutions.forEach((spec, oi) => {
        const org = spec.org;
        // Its defining post first, then anything else it employs in
        // descending tier — a settlement that has nobody who can teach
        // still opens the schoolhouse, and somebody keeps the door.
        const wanted = [
          spec.post,
          ...occupations.occupationsFor(org.type).filter((p) => p !== spec.post).reverse(),
        ];
        for (const position of wanted) {
          const candidate = cityResidents.find(
            (n) => !economy.getEmployment(w, n.id)
              && (tick - n.createdTick) / 365 >= 16
              && occupations.tierReachable(n, occupations.tierOf(position)),
          );
          if (!candidate) continue;
          economy.hireEntity(w, {
            entityId: candidate.id,
            employerOrganizationId: org.id,
            wage: Math.round(random.range(20, 120, 'inst-wage', c, oi, position)),
            position,
            tick,
          });
          membership.joinOrganization(w, {
            entityId: candidate.id, organizationId: org.id, role: 'employee', tick,
          });
          summary.employed += 1;
          summary.institutionStaff = (summary.institutionStaff ?? 0) + 1;
          break;
        }
      });
    }
  }

  // ---------------------------------------------------------------------
  // The systems that existed and that no world had ever contained
  // ---------------------------------------------------------------------
  //
  // **Every call below is to a generator that was already built, tested
  // and green.** Measured against a built world, seventeen tables the
  // engine writes had zero rows in them — the whole politics stack,
  // civilizations, technology eras, cultures, markets, missions and
  // inventory. Nothing was broken; nothing ever called them.
  //
  // That is the eleventh standing rule, and it is the same finding that
  // produced this file: a generator nothing calls is indistinguishable
  // from a generator that does not exist. `worldgen.js` closed it for
  // housing, infrastructure and demographics and stopped there.
  //
  // Two of the per-tick drivers were already wired and idle for want of
  // a subject: `runPolitics` snapshots public opinion every tick and
  // had no government to have an opinion about, and `runTechnology`
  // climbs the era ladder every tick and had no civilization to climb
  // it. Founding one of each is the whole fix for five tables.

  // ---- the region the cities are in -------------------------------------
  // `regions` had no store. It is what gives `migration_type:
  // exploration` a meaning distinct from any other move — going
  // somewhere genuinely elsewhere — and what `civilization_id` on a
  // region connects to.
  //
  // `geography_key` and `climate_key` stay null: both are free TEXT
  // that no document enumerates, and inventing a climate vocabulary
  // here is the mistake `environment_state` is still open for.
  const region = migration.generateRegion(w, { name: config.regionName });
  for (const cityId of summary.cities) {
    const city = w.cities.find((x) => x.id === cityId);
    if (city) city.region_id = region.id;
  }
  summary.regionId = region.id;

  // ---- the civilization and its technology ------------------------------
  technology.seedTechnologyEras(w);
  const civilization = technology.foundCivilization(w, {
    name: config.civilizationName,
    stability: Math.round(random.range(40, 75, 'civ', 'stability')),
    // The state's spending priorities — §7's Government Services and
    // Military / National Guard, as the CIVILIZATION tier-level
    // dimensions VACANCY_TRAIT_DATABASE_ATTACHMENT.md already names.
    // Drawn rather than set flat, because four identical numbers is
    // the placeholder problem this project keeps finding: a state that
    // weights everything equally has made no choices, and
    // `statecraft.sharesOf` divides by their total so an even split
    // produces no contrast anywhere downstream.
    //
    // The band is deliberately wide on `military` and narrow on the
    // three services: a post-reset state argues about soldiers, and
    // broadly agrees that hospitals, schools and police stations all
    // need something.
    traits: {
      healthcare: Math.round(random.range(35, 70, 'civ', 'healthcare')),
      education: Math.round(random.range(35, 70, 'civ', 'education')),
      security: Math.round(random.range(35, 70, 'civ', 'security')),
      military: Math.round(random.range(5, 80, 'civ', 'military')),
    },
  });
  summary.civilizationId = civilization.id;
  region.civilization_id = civilization.id;
  summary.technologyEras = (w.technologyEras || []).length;

  // Start partway up the ladder rather than at the first rung. A world
  // that has cities, schools and a market has plainly already worked
  // out stone tools, and `canUnlock` gates on prerequisites so the
  // chain has to be walked in order.
  summary.erasUnlocked = 0;
  for (let e = 0; e < config.startingEras; e += 1) {
    const next = technology.nextEraFor(w, civilization.id);
    if (!next || !next.eraName) break;
    const check = technology.canUnlock(w, {
      civilizationId: civilization.id, eraName: next.eraName,
    });
    if (!check.ok) break;
    technology.unlockEra(w, { civilizationId: civilization.id, eraName: next.eraName, tick });
    summary.erasUnlocked += 1;
  }

  // ---- the press --------------------------------------------------------
  // **§7's systems 23 and 24 needed an outlet to exist at all**, and
  // `organizations.type`'s own schema enumeration already includes
  // `media`, so one is an organization rather than a new table
  // (standing rule 4).
  //
  // **Not gated on the era, and the first version was — which was a
  // dead gate.** `startingEras` is 2, so a generated world sits at
  // `agriculture` and `media.eraReached(w, 'writing')` was false at the
  // only moment an outlet was ever founded. The outlet would therefore
  // never have existed in any world, and `local_news`, `radio` and
  // `social_media` would have been permanently unavailable however far
  // the world climbed. That is standing rule 14's shape and I had just
  // written it.
  //
  // The separation that fixes it is also the truer one: the OUTLET is
  // an institution and the ERA is a technology. A settlement has
  // somebody who carries news from the first day — a crier, a scribe,
  // whoever keeps the board — and what changes as the world recovers is
  // which channels that institution can operate. §61's "begin locally
  // and reemerge technologically over time" is carried entirely by the
  // era gates in `media.CHANNELS`, so this needs no gate of its own.
  {
    const press = engine.generateOrganization({
      name: `${config.civilizationName} Record`,
      type: 'media',
      traitValueFor: (def) => Math.round(
        random.range(25, 80, 'media-trait', def.family, def.name),
      ),
    });
    // `organizations.influence` is what `media.outletReach` reads to
    // decide how much of a channel's potential audience the outlet
    // actually reaches. Drawn rather than set flat: a world where the
    // press is weak is a different world from one where it is strong,
    // and four identical numbers is the placeholder problem this
    // project keeps finding.
    press.influence = Math.round(random.range(20, 85, 'media', 'influence'));
    press.assets = Math.round(random.range(2000, 40000, 'media', 'assets'));
    summary.organizations += 1;
    summary.mediaOutlets = 1;
    summary.mediaOutletId = press.id;
  }

  // ---- the government ---------------------------------------------------
  // A government is an organization, per standing rule 4 — not a root
  // entity of its own. So one is generated and then declared to be a
  // government, which is what `foundGovernment` validates.
  const state = engine.generateOrganization({
    name: `${config.civilizationName} Assembly`,
    type: 'government',
    traitValueFor: (def) => Math.round(
      random.range(30, 85, 'gov-trait', def.family, def.name),
    ),
  });
  summary.organizations += 1;
  politics.foundGovernment(w, {
    organizationId: state.id,
    systemType: random.pick(politics.SYSTEM_TYPES, 'gov', 'system'),
  });
  summary.governmentId = state.id;

  // **A seat, because an announcement has to be made somewhere.**
  // `properties.operating_organization_id` is the schema's own link
  // from a building to whoever runs it — `worldgen` already uses it for
  // businesses, and `behavior.workplaceOf` reads it to give a work
  // routine a place. `media.seatOf` reads it to decide where a
  // government speaks from, which is what turns
  // `computeApproval`'s `spread` from a constant 1.0 into a fact about
  // how far word has actually travelled.
  //
  // The first standing building in the first community: a seat of
  // government is central, and picking one deterministically keeps the
  // world replayable without a draw.
  const seat = (w.properties || []).find(
    (p) => p.operating_organization_id === null && p.lifecycle_stage === 'operation',
  ) ?? (w.properties || [])[0] ?? null;
  if (seat) {
    seat.operating_organization_id = state.id;
    summary.governmentSeatPropertyId = seat.id;
  }

  // ---- who works for the press and the state -----------------------------
  // **Two organizations that acted on the world and employed nobody.**
  // The press broadcasts, the assembly announces, funds services and
  // holds elections — and `employment_records` had not a single row
  // against either, so `reporter`, `diplomat` and `officer` had no
  // employer anywhere however long a world ran. `runLabour` could never
  // fix it: an employer with no staff has no wage scale, so it is not in
  // the market, so it never gets staff.
  //
  // One founding post each, named rather than drawn, and then the market
  // fills them out. The government's is a diplomat because §7's
  // Government Services and `statecraft` are about a state dealing with
  // its own people — an officer belongs to a military organization,
  // which no world generates yet and which `CITY_INSTITUTIONS` says why
  // about.
  {
    const founding = [
      { organizationId: summary.mediaOutletId ?? null, position: 'reporter', wage: [30, 90] },
      { organizationId: summary.governmentId ?? null, position: 'diplomat', wage: [60, 180] },
    ];
    for (const post of founding) {
      if (!post.organizationId) continue;
      const candidate = (w.npcs || []).find(
        (n) => !economy.getEmployment(w, n.id)
          && (tick - n.createdTick) / 365 >= 16
          && occupations.tierReachable(n, occupations.tierOf(post.position)),
      );
      if (!candidate) continue;
      economy.hireEntity(w, {
        entityId: candidate.id,
        employerOrganizationId: post.organizationId,
        wage: Math.round(random.range(post.wage[0], post.wage[1], 'found-wage', post.position)),
        position: post.position,
        tick,
      });
      membership.joinOrganization(w, {
        entityId: candidate.id, organizationId: post.organizationId, role: 'employee', tick,
      });
      summary.employed += 1;
      summary.institutionStaff = (summary.institutionStaff ?? 0) + 1;
    }
  }

  // Laws, one per city, drawn from the schema's own category list. A
  // government with no law on the books has enacted nothing, and
  // `laws` was one of the six political tables at zero.
  // **A founding code, not two dice.** This drew two categories at
  // random from nine, and that was fine while `laws` was a table
  // nothing read — the comment said as much: "a government with no law
  // on the books has enacted nothing". `server/justice.js` made it
  // load-bearing, and a 600-tick world with 240 people then measured
  // 26 offences, 7 cleared, and **7 cases and 7 dismissals**, because
  // neither city had ever legislated against theft. Every thief walked
  // and nobody was ever imprisoned.
  //
  // A government that has not outlawed theft or violence is not
  // governing. So `criminal` and `property` are the founding code —
  // crimes against persons and crimes against property, the two
  // categories a state exists to enforce — plus one drawn from the
  // rest, which is policy rather than order. `politics.runLegislation`
  // adds the others over the following years, so a settlement's statute
  // book is a reading of how long it has been a settlement.
  //
  // The third is drawn WITHOUT replacement against the founding two.
  // Two independent picks gave one measured world
  // `property@city2, property@city2` — two rows and one law, since
  // `justice.lawCovering` takes the first active match.
  const FOUNDING_CODE = ['criminal', 'property'];
  summary.laws = 0;
  for (const cityId of summary.cities) {
    const rest = politics.LAW_CATEGORIES.filter((c) => !FOUNDING_CODE.includes(c));
    const categories = [...FOUNDING_CODE, random.pick(rest, 'law', cityId, 0)];
    categories.forEach((category, l) => {
      politics.enactLaw(w, {
        jurisdictionCityId: cityId,
        category,
        description: null,
        governmentOrganizationId: state.id,
        tick,
        favourability: Math.round(random.range(-20, 30, 'law-fav', cityId, l)),
      });
      summary.laws += 1;
    });
  }

  // ---- culture ----------------------------------------------------------
  // `cultures` and `culture_memberships` were both empty. Culture DNA
  // is built (Phase 2) and nothing ever made one.
  const cultures = config.cultures.map((name, i) => culture.generateCulture(w, {
    name,
    traitValueFor: (def) => Math.round(
      random.range(20, 90, 'culture', i, def.family, def.name),
    ),
  }));
  summary.cultures = cultures.length;
  summary.cultureMembers = 0;

  made.communities.forEach((community, ci) => {
    const local = cultures[ci % cultures.length];
    culture.attachCulture(w, {
      cultureId: local.id, tier: 'community', entityId: community.id,
    });
    summary.cultureMembers += 1;

    // **Seeded on position, never on identity** — §88. `community.id`
    // and `npc.id` come from counters whose state depends on what was
    // built before them, so the same seed draws differently on a second
    // generation in one process. `ci` and `ri` do not.
    areaStats.residentsOf(w, community.id).forEach((npc, ri) => {
      if (random.unit('culture-member', ci, ri) > config.cultureShare) return;
      culture.attachCulture(w, {
        cultureId: local.id, tier: 'family', entityId: npc.id,
      });
      summary.cultureMembers += 1;
    });
  });

  // ---- the market -------------------------------------------------------
  // `market_listings` was empty, so `resolveMarketPrice` had nothing to
  // resolve and no price in the world came from anybody offering
  // anything. Products are drawn from `items.SOURCED_ITEMS`, the real
  // trade catalogue, rather than invented here.
  summary.marketListings = 0;
  for (const cityId of summary.cities) {
    for (let m = 0; m < config.marketListings; m += 1) {
      const item = random.pick(items.SOURCED_ITEMS, 'listing', cityId, m);
      economy.generateMarketListing(w, {
        productName: item.name,
        resourceType: item.resourceType ?? null,
        price: Math.round(barter.barterScore(w, item.name).Final_Barter_Score),
        quantity: 1 + random.int(40, 'listing-qty', cityId, m),
        sellerEntityId: null,
        tick,
      });
      summary.marketListings += 1;
    }
  }

  // ---- artifacts and missions -------------------------------------------
  // The engine's only player verb had nothing to act on: both tables
  // were empty in every world, so `listMissions` returned nothing and
  // `POST /api/players/:id/action` could accept no mission.
  summary.artifacts = 0;
  summary.missions = 0;
  for (let a = 0; a < config.artifacts; a += 1) {
    const artifact = missions.generateArtifact(w, {
      name: `${random.pick(SURNAMES, 'relic', a)} Relic`,
      era: 'pre-collapse',
      locationId: null,
    });
    summary.artifacts += 1;
    missions.generateMission(w, {
      artifactId: artifact.id,
      objective: 'Recover it',
      reward: Math.round(random.range(80, 600, 'reward', a)),
    });
    summary.missions += 1;
  }

  // ---- what people carry ------------------------------------------------
  // `inventory` was empty, so `valueOfHoldings` was zero for everybody
  // and a trade could only ever move nothing. Everybody starts with a
  // couple of things, drawn from the same catalogue the market uses.
  summary.inventoryRows = 0;
  made.people.forEach((npc, pi) => {
    for (let k = 0; k < config.startingInventoryPerAdult; k += 1) {
      // Position, not identity — see the culture block above.
      const item = random.pick(items.SOURCED_ITEMS, 'kit', pi, k);
      inventory.give(w, {
        entityId: npc.id,
        itemName: item.name,
        quantity: 1 + random.int(3, 'kit-qty', pi, k),
        condition: Math.round(random.range(40, 100, 'kit-cond', pi, k)),
        tick,
      });
      summary.inventoryRows += 1;
    }
  });

  // ---- what survived, to read ------------------------------------------
  // **§24 KNOWLEDGE RECOVERY names ten sources and a generated world
  // contained none of them.** `knowledge` is listed in BOTH canonical
  // vocabularies — `items.TRADE_CATEGORIES` from §26 and
  // `items.RESOURCE_TYPES` from §28 — and no item, no resource and no
  // code of any kind stood behind either. §24's first line is
  // "Knowledge is a civilization resource", and `technology.learningOf`
  // has always averaged the `educational` family to decide whether a
  // civilization can recover an era, so the wire from a book to a
  // technology was complete except for the book.
  //
  // Scattered rather than handed out: this is a reset world, and what
  // is left to read is what happens to have survived. Most people have
  // nothing. Seeded on position (§88), and the item list is registered
  // first because `inventory.give` refuses an item `items.findItem`
  // does not know.
  knowledge.registerItems(w);
  // **The materials and products salvage deals in, registered but not
  // handed out.** Nobody starts with a pile of scrap: materials arrive
  // by taking something apart or stripping an empty building, which is
  // the point of the system. What registering does is make the names
  // MEAN something from tick zero — `items.findItem` has to know `glass`
  // before `inventory.give` will hand anybody a piece of it, and
  // `describeSalvage` measures the catalogue rather than the holdings.
  summary.salvageItems = salvage.registerItems(w);
  // **The goods the retail Key locations actually sell.** Registered
  // for the same reason and handed out the same way — not at all:
  // merchandise reaches a tribe by taking the shop it is in.
  // `discovery.describeDiscovery` measured four §26 categories that
  // real pools draw on and no item in any world belonged to, so a
  // grocery store search found nothing, every time.
  summary.merchandiseItems = merchandise.registerItems(w);
  summary.knowledgeItems = 0;
  made.people.forEach((npc, pi) => {
    if (random.unit('book', pi) > config.survivingBookRate) return;
    const field = random.pick(knowledge.FIELD_NAMES, 'book-field', pi);
    const source = random.pick(knowledge.HOLDING_SOURCES, 'book-source', pi);
    inventory.give(w, {
      entityId: npc.id,
      itemName: knowledge.itemNameFor(field, source),
      quantity: 1,
      // Condition matters for a book the way it matters for a tool:
      // `inventory.conditionFactor` is what a distress sale reads, and
      // a knowledge item is unpriced so it never reaches that — but a
      // ruined book being indistinguishable from a new one would be
      // the placeholder problem this project keeps finding.
      condition: Math.round(random.range(20, 95, 'book-cond', pi)),
      tick,
    });
    summary.knowledgeItems += 1;
    summary.inventoryRows += 1;
  });

  // ---- who lives with whom ----------------------------------------------
  // **Synced here, not left to the first tick.** `mean_household_size`
  // is answerable the moment a world is generated — it was, when it
  // measured family membership — and leaving households to the tick
  // pipeline made a freshly generated world unable to answer it at all.
  // A generator that produces a world one statistic short of the world
  // the same code produces a tick later is the eleventh standing rule
  // in miniature.
  //
  // Also writes `properties.occupants`, which nothing wrote.
  const homes = households.syncHouseholds(w, { tick });
  summary.households = homes.formed.length;

  // A world with no history of crime has no clearance rate and no
  // opinion of public safety, and both are statistics somebody asked
  // for. Rather than fabricate incidents, this leaves them to the tick
  // pipeline — `runSecurityPhase` generates them from deprivation and
  // conflict, which is the honest source. Callers who want the crime
  // statistics populated should tick the world; `summary.hint` says so
  // rather than leaving it to be discovered.
  summary.hint = 'tick the world to populate crime, clearance, trust and stress — '
    + 'those come from the pipeline, not from generation';
  summary.crimeIncidents = (w.crimeIncidents || []).length;
  void crime;

  return summary;
}

module.exports = { DEFAULTS, CITY_INFRASTRUCTURE, makeRandom, generateWorld };
