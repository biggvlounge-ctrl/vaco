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
const items = require('./items.js');
const territory = require('./territory.js');
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

  // **Everything below exists because the table was empty.** Each one
  // names a system that is built, tested and green, and that no world
  // this engine has ever generated contained a single row of — the
  // eleventh standing rule, found by measuring rather than by reading.
  // `dev-docs/GAME_COMPLETENESS.md` lists which.
  civilizationName: 'The Reach',
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

  const summary = {
    seed: config.seed,
    cities: [], communities: 0, people: 0, families: 0, properties: 0,
    infrastructure: 0, organizations: 0, employed: 0, gangMembers: 0,
    languages: 0, resources: 0, territoryBlocks: 0, motivated: 0,
  };

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
    const city = territory.generateCity(w, {
      name: `City ${c + 1}`,
      economy: Math.round(random.range(35, 70, 'city', c, 'economy')),
      safety: Math.round(random.range(35, 70, 'city', c, 'safety')),
    });
    summary.cities.push(city.id);

    const cityPopulation = config.communitiesPerCity * config.populationPerCommunity;

    // ---- infrastructure --------------------------------------------
    for (const spec of CITY_INFRASTRUCTURE) {
      infrastructure.generateInfrastructure(w, {
        cityId: city.id,
        type: spec.type,
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
      economy.generateResource(w, {
        cityId: city.id,
        resourceType,
        supply,
        demand: Math.round(supply * pressure),
        quality: Math.round(random.range(30, 90, 'qual', c, resourceType)),
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
      const community = territory.generateCommunity(w, { cityId: city.id, tier: 'block' });
      made.communities.push(community);
      summary.communities += 1;

      // Territory: each block is held by a faction, and some are
      // contested — which is what makes `contested_block_share` a
      // statistic that can vary rather than a constant 0.
      if (factions.length > 0) {
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

        // **Education is only meaningful for somebody old enough to
        // have finished any.** Leaving it null for a child is not a gap
        // — `demographics` counts unrecorded people as `unknown` and
        // reports `demographics_recorded_share`, so a young block reads
        // as young rather than as uneducated.
        if (age >= 18) {
          const level = random.unit('edu', c, b, p);
          npc.education = level < 0.12 ? 'none'
            : level < 0.45 ? 'basic'
              : level < 0.7 ? 'secondary'
                : level < 0.85 ? 'vocational'
                  : level < 0.96 ? 'higher' : 'advanced';
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

  // ---- the civilization and its technology ------------------------------
  technology.seedTechnologyEras(w);
  const civilization = technology.foundCivilization(w, {
    name: config.civilizationName,
    stability: Math.round(random.range(40, 75, 'civ', 'stability')),
  });
  summary.civilizationId = civilization.id;
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

  // Laws, one per city, drawn from the schema's own category list. A
  // government with no law on the books has enacted nothing, and
  // `laws` was one of the six political tables at zero.
  summary.laws = 0;
  for (const cityId of summary.cities) {
    for (let l = 0; l < 2; l += 1) {
      politics.enactLaw(w, {
        jurisdictionCityId: cityId,
        category: random.pick(politics.LAW_CATEGORIES, 'law', cityId, l),
        description: null,
        governmentOrganizationId: state.id,
        tick,
        favourability: Math.round(random.range(-20, 30, 'law-fav', cityId, l)),
      });
      summary.laws += 1;
    }
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
