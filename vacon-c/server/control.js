// server/control.js
//
// **The takeover key.** What it takes to hold something, from a
// one-bedroom apartment to an entire country.
//
// ---------------------------------------------------------------------
// This was specified in full and built nowhere
// ---------------------------------------------------------------------
// `COMPOSITION_REQUIREMENTS_TRIBE_COHESION.md` is forty-two lines and
// gives both shapes outright:
//
//     ControlKeyComposition {
//       locationId
//       requiredRoles: [
//         { role: "enforcer", count: 5 },
//         { role: "youth-labor", count: 10 },
//         { role: "elder", count: 1 }
//       ]
//     }
//
//     TakeoverAttemptResolution {
//       locationId, tribeId
//       compositionRequirementMet: boolean
//       tribeCohesionScore: number
//       finalSuccessProbability: number
//     }
//
// with the argument for why both halves are needed: "keeps the game
// from becoming a simple recruitment-counting exercise. A Tribe can
// meet every technical requirement and still fail because the people
// involved don't actually work well together."
// `TRIBE_GROWTH_MISSION_UNLOCK_SYSTEM.md` adds the specialist half —
// "a Hospital needs medical experts", and recruiting somebody with
// water-treatment experience is what makes the water plant a viable
// target. `VACANCY_SEED.md` records both as unbuilt, and it is right:
// `grep -rn "Control Key\|controlKey" server/` returned nothing.
//
// Two things it cites as already built were not, and both had to come
// first — they are separate commits for that reason:
//
//   **the Occupation Taxonomy** — `employment_records.position` was
//   written by nothing, so every job in every world was untitled and
//   "a Hospital needs medical experts" had no way to ask. Now
//   `server/occupations.js`.
//
//   **Family/Tribe unity and conflictLevel** — 50 and 0 on every
//   family in every world, written by nothing, so the cohesion
//   multiplier the document calls "a real, direct multiplier" would
//   have been the same near-constant for every tribe. Now
//   `familyTraits.advanceCohesion`.
//
// ---------------------------------------------------------------------
// Six scales, and each one's holders are already in the schema
// ---------------------------------------------------------------------
// "From a one bedroom apartment to an entire country, to a house, to a
// building" is a ladder, and the engine already has every rung:
//
//   property        `properties` — a flat, a house, a shop, a tower
//   organization    `organizations` — a business, a gang, a hospital,
//                   an assembly. Taking a country's government IS this
//                   rung applied to its government organization
//   infrastructure  `infrastructure` — the water plant, the power
//                   station, the schools. The document's own example
//   community       `communities` + `territory_blocks` — a block
//   city            `cities`
//   civilization    `civilizations` — the country
//
// **The requirement is proportional to who is holding it now**, which
// is the one design decision here and the one that needed no invented
// number. A flat with one occupant takes one person; a hospital with
// eleven staff takes eleven; a city with a garrison and a police force
// takes what that comes to. The document's example — 5 enforcers, 10
// youth-labor, 1 elder — is sixteen people, so it is exactly what this
// produces for something sixteen people are holding, and that is where
// the ratio below comes from rather than from a table of per-scale
// constants somebody would have had to guess.
//
// ---------------------------------------------------------------------
// The three roles, and why one of them is not an age
// ---------------------------------------------------------------------
//   enforcer     holds an occupation whose skill is Combat — enforcer,
//                hunter, officer. A job fact, checked against
//                `occupations.OCCUPATIONS`, not a trait threshold
//                somebody picked.
//   elder        65 or older, which is `statistics.elder_share`'s own
//                definition of an elder. Read from there, not restated.
//   youth-labor  the document's "Youth (general labor/support)": every
//                other working-age member. **There is no youth ceiling
//                anywhere in this engine** — `economy.WORKING_AGE` is
//                16 and nothing defines where youth ends — so rather
//                than invent one, this is the general body of labour:
//                working age, not an elder, not an enforcer. The three
//                roles then partition a tribe's adults exactly, which
//                is what makes a composition check answerable at all.
//                Named as the document names it, and this paragraph is
//                the reason the name and the meaning differ.

'use strict';

const { seededDraw } = require('./seeded.js');
const occupations = require('./occupations.js');
const familyTraits = require('./familyTraits.js');
const mortality = require('./mortality.js');
const membership = require('./membership.js');
const property = require('./property.js');
const worldStore = require('./worldStore.js');

// ---------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------

//: `statistics.elder_share` filters `a >= 65`. Same number, named once.
const ELDER_AGE = 65;

//: `economy.WORKING_AGE`. Required lazily below rather than imported,
//: because `economy` requires `occupations` which this file also uses
//: and the cycle is not worth the one constant.
const WORKING_AGE = 16;

//: The document's own composition, verbatim, used as a RATIO rather
//: than as counts. Sixteen people in the proportions it gives.
const COMPOSITION_RATIO = Object.freeze({
  enforcer: 5,
  'youth-labor': 10,
  elder: 1,
});

const ROLE_NAMES = Object.keys(COMPOSITION_RATIO);
const RATIO_TOTAL = ROLE_NAMES.reduce((sum, r) => sum + COMPOSITION_RATIO[r], 0);

//: How many people it takes relative to how many are holding it.
//: **One, and deliberately not a multiplier somebody chose.** Parity is
//: the only ratio with an argument behind it: you need as many people
//: as are already there, composed the document's way, and everything
//: that makes a takeover harder or easier than that lives in the
//: cohesion term where the document puts it.
const FORCE_PARITY = 1;

//: A specialist requirement is one person. The document says "a
//: Hospital needs medical experts" without a count, and one is the
//: smallest claim that is still a requirement — a second would be an
//: invention. **Superseded for anything with a crew** — see
//: `landmarks.staffingFor` — and kept for targets that have none.
const SPECIALISTS_REQUIRED = 1;

// ---------------------------------------------------------------------
// MATERIEL — a takeover needs things, not only bodies
// ---------------------------------------------------------------------
// **`assess` read only people.** A tribe of twenty could take a
// government building barehanded, which is the same "make it easy"
// failure the crew fixed on the maintenance side.
//
// **Requirements are §26 CATEGORIES, not named items**, and that is
// deliberate. §27 gives Base_Values for seventeen items and `items.js`
// says in its own header that no item is invented there — and there is
// not a single weapon among the seventeen. Naming one would put a
// fabricated item in the one table that exists to hold sourced ones.
// §26's twenty trade categories include `tools` and `protection`, which
// are the spec's own words for the two things the request named, so the
// requirement is expressed in those and any item a world carries in
// them counts.
//
//: One tool per pair of hands and one protective item per fighter.
//: Definitions rather than tunings: you cannot force a door without
//: something to force it with, and somebody going in first wants
//: something between them and what is inside. Both scale with the
//: composition, so a bigger job needs proportionally more — and neither
//: is a number picked to feel right.
const TOOLS_PER_HAND = 1;
const PROTECTION_PER_FIGHTER = 1;

//: How much a shared undertaking moves the trust between two people who
//: went through it. Small on purpose: `crime.FRICTION_RATE` moves a
//: relationship by 2% of its distance to a target every tick, so a
//: two-point step is one good day among many rather than a rewrite of a
//: friendship.
const SHARED_UNDERTAKING = 2;

//: Where a takeover stops being a neighbourhood matter. Sixteen is the
//: document's own example composition — 5 + 10 + 1 — so a takeover that
//: needs more people than the document's worked example is logged as
//: high severity and everything smaller is medium. A number from the
//: source rather than a feeling about scale.
const SIGNIFICANT_FORCE = RATIO_TOTAL;

const SCALE_NAMES = [
  'property', 'organization', 'infrastructure', 'community', 'city', 'civilization',
];

// ---------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------

function ageOf(worldState, npc, tick) {
  return mortality.ageInYears(worldState, npc, tick);
}

function isEnforcer(worldState, npc) {
  const held = occupations.occupationOf(worldState, npc.id);
  return held !== null && occupations.skillOf(held) === 'Combat';
}

// Which of the three roles this person counts as, or null if none —
// a child counts as nobody, which is the honest answer and also why
// `youth-labor` cannot simply mean "everyone else".
function roleOf(worldState, npc, tick = worldState.tick ?? 0) {
  const age = ageOf(worldState, npc, tick);
  // Unknown age is not a zero age (the `Number(null)` corollary): a
  // person the engine cannot date counts as nobody rather than as a
  // newborn or an elder.
  if (age === null) return null;
  if (age >= ELDER_AGE) return 'elder';
  if (age < WORKING_AGE) return null;
  return isEnforcer(worldState, npc) ? 'enforcer' : 'youth-labor';
}

// The roster a tribe can actually field: every living member, by role,
// plus the occupations they hold. `tribeId` is a family id — "Tribe" is
// what the recovered documents call a family, and `families` is the
// table (standing rule 4's shape: no new root entity for a word).
function rosterOf(worldState, tribeId, options = {}) {
  const { tick = worldState.tick ?? 0 } = options;
  const roles = Object.fromEntries(ROLE_NAMES.map((r) => [r, 0]));
  const held = new Map();
  const members = familyTraits.livingMembers(worldState, tribeId);

  for (const npc of members) {
    const role = roleOf(worldState, npc, tick);
    if (role !== null) roles[role] += 1;
    const occupation = occupations.occupationOf(worldState, npc.id);
    if (occupation !== null) held.set(occupation, (held.get(occupation) ?? 0) + 1);
  }

  return {
    tribeId,
    members: members.length,
    roles,
    occupations: Object.fromEntries(held),
    fielded: ROLE_NAMES.reduce((sum, r) => sum + roles[r], 0),
  };
}

// ---------------------------------------------------------------------
// The scales
// ---------------------------------------------------------------------
// Each scale answers three questions about a target: does it exist,
// who is holding it, and what does holding it require somebody to know.
// `seize` is the write-back, and where the schema has no place to
// record control the entry says so rather than inventing a column.

function employeesOf(worldState, organizationId) {
  const ids = (worldState.employmentRecords || [])
    .filter((r) => r.status === 'active' && r.employer_organization_id === organizationId)
    .map((r) => r.entity_id);
  return (worldState.npcs || []).filter((n) => ids.includes(n.id));
}

// `membership.membersOf` already returns npc rows rather than
// membership rows, so this is a rename and nothing more — kept as a
// local name so the two "who is here" reads below read alike.
function affiliatesOf(worldState, organizationId) {
  return membership.membersOf(worldState, organizationId);
}

function residentsOfCommunity(worldState, communityId) {
  return (worldState.npcs || []).filter((n) => n.communityId === communityId);
}

function communitiesOfCity(worldState, cityId) {
  return (worldState.communities || []).filter((c) => c.city_id === cityId);
}

const SCALES = {
  // A one-bedroom apartment, a house, a shop, a tower.
  property: {
    find: (worldState, id) => (worldState.properties || []).find((p) => p.id === id) ?? null,
    // Whoever lives there, plus whoever works there if an organization
    // operates it. A flat is held by its occupants; a shop is held by
    // its staff. `properties.operating_organization_id` is the schema's
    // own link and `worldgen` sets it.
    // **Two columns say who is in a building, and they must not be
    // allowed to disagree quietly.** `npcs.home_property_id` is where
    // somebody lives; `properties.occupants` is the JSONB list
    // `households.js` writes from the same fact. In a generated world
    // they agree — but `property.upkeepFor` reads the second and this
    // reads the first, and the day they diverge, upkeep would silently
    // scale to zero and every building in the world would decay at the
    // full rate with nothing thrown. Caught by a fixture that set one
    // and not the other.
    //
    // The union is the fix: a disagreement becomes harmless instead of
    // catastrophic, and neither column has to be declared the winner.
    holders: (worldState, target) => {
      const byHome = (worldState.npcs || []).filter((n) => n.home_property_id === target.id);
      const listed = Array.isArray(target.occupants) ? target.occupants : [];
      const byList = (worldState.npcs || []).filter((n) => listed.includes(n.id));
      const staff = target.operating_organization_id
        ? employeesOf(worldState, target.operating_organization_id)
        : [];
      const seen = new Set();
      return [...byHome, ...byList, ...staff].filter((n) => !seen.has(n.id) && seen.add(n.id));
    },
    // None. A flat is a flat — there is nothing to know how to run.
    // A property OPERATED by an organization inherits that
    // organization's specialist, because what you are taking is the
    // business in the building.
    specialists: (worldState, target) => {
      if (!target.operating_organization_id) return [];
      const org = (worldState.organizations || [])
        .find((o) => o.id === target.operating_organization_id);
      const post = org ? occupations.postFor(org.type) : null;
      return post ? [{ occupation: post, count: SPECIALISTS_REQUIRED }] : [];
    },
    // `ownership_records` is append-only by shape and `stolen` is one
    // of the schema's own `acquired_method` values, so a takeover is a
    // real acquisition with a real history and no new column.
    seize: (worldState, target, tribeId, tick) => {
      property.recordOwnership(worldState, {
        entityId: target.id,
        ownerEntityId: tribeId,
        ownerType: 'family',
        acquiredMethod: 'stolen',
        tick,
      });
      return { recorded: 'ownership_records' };
    },
  },

  // A business, a gang, an institution — or an assembly, which is how
  // a country changes hands.
  organization: {
    find: (worldState, id) => (worldState.organizations || []).find((o) => o.id === id) ?? null,
    holders: (worldState, target) => {
      const staff = employeesOf(worldState, target.id);
      const affiliated = affiliatesOf(worldState, target.id);
      const seen = new Set();
      return [...staff, ...affiliated].filter((n) => !seen.has(n.id) && seen.add(n.id));
    },
    specialists: (worldState, target) => {
      const post = occupations.postFor(target.type);
      return post ? [{ occupation: post, count: SPECIALISTS_REQUIRED }] : [];
    },
    // `organizations.leader_id` is a real column that `generateOrganization`
    // sets and, before this, nothing else ever wrote. A takeover
    // installs the tribe's head.
    seize: (worldState, target, tribeId, tick) => {
      const tribe = (worldState.families || []).find((f) => f.id === tribeId);
      const head = tribe?.head_npc_id
        ?? familyTraits.livingMembers(worldState, tribeId)[0]?.id
        ?? null;
      target.leader_id = head;
      target.updatedTick = tick;
      return { recorded: 'organizations.leader_id', leaderId: head };
    },
  },

  // The water plant. The document's own example of a specialist
  // requirement, and the rung where a specialist can matter more than
  // a crowd.
  infrastructure: {
    find: (worldState, id) => (worldState.infrastructure || []).find((i) => i.id === id) ?? null,
    // **The schema gives infrastructure no operator and no staff**, so
    // its holders are the staff of the city organization that does the
    // same job, where the city has one. Where it does not — a road, a
    // bridge — there is nobody holding it, and that is a real answer:
    // an unmanned road is taken by standing on it. What still gates the
    // take is the specialist, below.
    holders: (worldState, target) => {
      const post = occupations.postForInfrastructure(target.type);
      if (!post) return [];
      return occupations.holdersOf(worldState, post, { cityId: target.city_id });
    },
    specialists: (worldState, target) => {
      const post = occupations.postForInfrastructure(target.type);
      return post ? [{ occupation: post, count: SPECIALISTS_REQUIRED }] : [];
    },
    //: **Declared, not invented.** `infrastructure` has no owner,
    //: operator or controller column anywhere in the schema, and adding
    //: one to record a takeover would be a second source of truth for
    //: who runs a city's water. The attempt resolves, the event is
    //: logged, and the world records the outcome in the event log only.
    //: Closing this needs a schema addition, which is a different
    //: decision from this one.
    seize: () => ({ recorded: null, declared: 'infrastructure has no control column in the schema' }),
  },

  // A block. `territory_blocks.faction_id` is the schema's own record
  // of who holds ground, and its FK is to `factions(organization_id)`
  // specifically — so a FAMILY taking a block cannot be written there,
  // which the entry says rather than working around.
  community: {
    find: (worldState, id) => (worldState.communities || []).find((c) => c.id === id) ?? null,
    // Everybody who lives there. A neighbourhood is held by its
    // residents — which makes a block far harder to take than the
    // building on it, and that is the right shape.
    holders: (worldState, target) => residentsOfCommunity(worldState, target.id),
    specialists: () => [],
    //: `territory_blocks.faction_id REFERENCES factions(organization_id)`.
    //: A tribe is a family, not a faction, so this records nothing and
    //: says why. A faction taking a block is `resolveTerritoryControl`
    //: and already exists.
    seize: () => ({
      recorded: null,
      declared: 'territory_blocks.faction_id references factions, not families',
    }),
  },

  // A city.
  city: {
    find: (worldState, id) => (worldState.cities || []).find((c) => c.id === id) ?? null,
    holders: (worldState, target) => communitiesOfCity(worldState, target.id)
      .flatMap((c) => residentsOfCommunity(worldState, c.id)),
    // Somebody has to be able to run the place. The government's
    // defining post, because a city is administered.
    specialists: () => [{ occupation: occupations.postFor('government'), count: SPECIALISTS_REQUIRED }],
    seize: () => ({ recorded: null, declared: 'cities have no control column in the schema' }),
  },

  // An entire country.
  civilization: {
    find: (worldState, id) => (worldState.civilizations || []).find((c) => c.id === id) ?? null,
    // Everybody in it — and **"in it" is the whole world, because
    // nothing links a city to a civilization.** `cities` has no
    // `civilization_id`; the schema puts that column on `entities` and
    // `regions`, `migrate.js` deliberately omits the `entities` one
    // ("NULL here, filled after civilizations exist" — and nothing
    // fills it), and only `migration.js` writes the `regions` one. So a
    // per-civilization population cannot be read, and returning the
    // living is the honest answer for a world with one civilization in
    // it, which is every world this engine generates. Narrowing it
    // needs the link written, not a filter invented here.
    //
    // The arithmetic then asks for a matching force, which is the
    // point: you do not take a country with a raiding party. What a
    // player actually does is take its ASSEMBLY, which is the
    // `organization` rung and is reachable.
    // Everybody in `npcs`, which IS the living — the dead are moved to
    // `worldState.deceased` rather than flagged. An earlier version of
    // this line filtered `status !== 'dead'`, a word that appears
    // nowhere in the vocabulary (`active | imprisoned | deceased`); it
    // happened to be harmless because it excluded nobody, which is
    // exactly why it was worth removing rather than correcting.
    holders: (worldState) => [...(worldState.npcs || [])],
    specialists: () => [
      { occupation: occupations.postFor('government'), count: SPECIALISTS_REQUIRED },
      { occupation: occupations.postFor('military'), count: SPECIALISTS_REQUIRED },
    ],
    seize: () => ({ recorded: null, declared: 'civilizations have no control column in the schema' }),
  },
};

// =====================================================================
// THE MAINTAIN KEY
// =====================================================================
//
// **Taking a thing and keeping it are different numbers, and this
// engine only had the first.**
//
// `property.upkeepFor` was the whole of maintenance: two flat constants,
// one for "somebody lives here" and one for "somebody owns it". So a
// one-bedroom flat and a government building cost exactly the same to
// keep standing, and nothing anywhere asked for PEOPLE — a building
// with an owner four cities away held its condition as well as one with
// a staff of forty.
//
// ---------------------------------------------------------------------
// Need, not headcount — and that is what makes the two keys differ
// ---------------------------------------------------------------------
// The takeover key asks **who is there**: a requirement of
// `defenders x FORCE_PARITY`, because what you have to overcome is the
// people holding the ground.
//
// The maintain key asks **what the place needs**, from the place
// itself: how much building there is, and how much is asked of it.
// Neither term reads who currently holds it, which is the entire point
// — otherwise a building nobody looks after would need nothing.
//
// The relationship between the two then falls out rather than being
// declared, and it is the one the request described:
//
//   held properly   people present >= need, so the takeover requirement
//                   is at least the maintenance requirement, and
//                   strictly more as soon as anybody is there beyond
//                   the minimum. Taking it costs more than keeping it.
//
//   held exactly    present == need. The two keys meet. This is the
//                   knife edge and it is honest: a place staffed to the
//                   bone is as cheap to take as it is to keep.
//
//   neglected       present < need. **The takeover requirement drops
//                   BELOW the maintenance requirement** — the thing is
//                   cheap to seize and expensive to hold, which is the
//                   trap. "You would have to have a certain amount to
//                   maintain and keep it, because somebody else would
//                   try to take it from you."
//
// No new constant carries that. It is two honest readings of the same
// place, compared.
//
// ---------------------------------------------------------------------
// The size term is measured against the world, not against a ruler
// ---------------------------------------------------------------------
// `footprintOf` is `land_size x floors` — the schema's own two columns,
// multiplied, which is floor area. On its own that is a number in no
// units anybody agreed on, so it is divided by the world's OWN median
// building. Standing rule 17's corollary: the right reference is
// usually inside the model. A property of typical size scores 1; the
// airport in a measured world scores 28.
//
// A one-bedroom apartment therefore takes one person to maintain, and
// that is a definition rather than a tuning — it is the floor the
// request itself names, and every other number on the ladder is
// relative to it.

//: How much the importance of a place adds to what it costs to keep.
//: At 1.0 a monument at significance 100 needs twice the people a
//: warehouse of the same size needs, and one at significance 0 needs
//: exactly the same. Doubling at the top of the scale is the mildest
//: claim that still makes importance matter; anything less and a
//: cathedral is a shed with a view.
const SIGNIFICANCE_WEIGHT = 1.0;

//: Nothing needs less than one person to keep. A building with nobody
//: in it at all is what `property.advancePropertyLifecycle` already
//: models — it rots at the full rate and is abandoned in about 250
//: ticks — so zero is not a maintenance requirement, it is the absence
//: of one.
const MINIMUM_MAINTENANCE = 1;

// Floor area, from the two columns the schema already carries. Null for
// a target that is not a building — a community, a city and a country
// are measured by their people instead, below.
function footprintOf(property) {
  if (!property) return null;
  const land = Number(property.land_size);
  if (!Number.isFinite(land) || land <= 0) return null;
  return land * Math.max(1, Number(property.floors) || 1);
}

// The world's own typical building, so `footprintOf` becomes a multiple
// rather than a number in invented units. Median, not mean: one airport
// should not redefine what ordinary is.
function medianFootprint(worldState) {
  const values = (worldState.properties || [])
    .map(footprintOf)
    .filter((v) => v !== null)
    .sort((a, b) => a - b);
  if (values.length === 0) return null;
  return values[Math.floor(values.length / 2)];
}

// How many typical buildings this one is worth. 1 for a typical one,
// null where there is nothing to compare against.
function sizeOf(worldState, property) {
  const footprint = footprintOf(property);
  const median = medianFootprint(worldState);
  if (footprint === null || median === null || median <= 0) return null;
  return footprint / median;
}

// ---------------------------------------------------------------------
// maintenanceFor — the maintain key
// ---------------------------------------------------------------------
// Same shape as `compositionFor` on purpose: the two keys are read side
// by side and a caller should not have to translate between them. The
// roles come out of the same 5:10:1 ratio, because the document's
// composition is a statement about what a working group looks like and
// that is as true of a staff as of a raiding party — what differs is
// the magnitude and where it is measured from.
//
// `staff` is called out separately from `security` because the request
// separated them: "how many employees it needs to maintain, how much
// security". They are the specialist requirement and the enforcer share
// of the same composition, named so a caller does not have to know that.
function maintenanceFor(worldState, options = {}) {
  const { scale = null, locationId = null, tick = worldState.tick ?? 0 } = options;
  const definition = SCALES[scale];
  if (!definition) {
    throw new Error(`control: "${scale}" is not a scale (one of: ${SCALE_NAMES.join(', ')}).`);
  }
  const target = definition.find(worldState, locationId);
  if (target === null || target === undefined) return null;

  // eslint-disable-next-line global-require
  const landmarks = require('./landmarks.js');

  let need;
  let size = null;
  let significance = 0;

  if (scale === 'property') {
    size = sizeOf(worldState, target);
    significance = landmarks.significanceOf(worldState, target.id) ?? 0;
    // A world with no comparable buildings cannot size this one, and
    // an unsizeable building still needs somebody: the floor applies.
    const scaled = size === null
      ? MINIMUM_MAINTENANCE
      : size * (1 + SIGNIFICANCE_WEIGHT * (significance / 100));
    need = Math.max(MINIMUM_MAINTENANCE, Math.round(scaled));
  } else {
    // **Everything that is not a building is measured by its people**,
    // because that is what those scales ARE: an organization is its
    // staff, a community is its residents, a country is its population.
    // The share is `1 / RATIO_TOTAL` — the document's own composition
    // read as "one working group of sixteen keeps sixteen people's
    // worth of place going", which is the only anchor available that
    // is not a number chosen for the occasion.
    const holders = definition.holders(worldState, target);
    const people = holders.filter((n) => roleOf(worldState, n, tick) !== null).length;
    need = Math.max(MINIMUM_MAINTENANCE, Math.round(people / RATIO_TOTAL));
  }

  const requiredRoles = ROLE_NAMES
    .map((role) => ({ role, count: Math.round((need * COMPOSITION_RATIO[role]) / RATIO_TOTAL) }))
    .filter((r) => r.count > 0);
  if (requiredRoles.length === 0) {
    const largest = ROLE_NAMES.reduce(
      (best, r) => (COMPOSITION_RATIO[r] > COMPOSITION_RATIO[best] ? r : best),
    );
    requiredRoles.push({ role: largest, count: MINIMUM_MAINTENANCE });
  }

  // **The crew, and this is the half that was wrong.** The first
  // version asked for ONE specialist — a hospital needed "1 physician"
  // — and split everything else across the generic 5:10:1 role ratio.
  // That is the "make it easy" failure: a place is not kept by
  // thirty-one interchangeable bodies, it is kept by ten cooks, twenty
  // on security and an engineer.
  //
  // `landmarks.staffingFor` divides the measured total by the
  // category's own crew proportions, so a small government office and a
  // large one have the same SHAPE of staff and different numbers of
  // them. Where a target has no crew — an ordinary house, a community,
  // a city — the generic roles remain the answer, because there is no
  // named staff to ask for.
  const crew = scale === 'property' && target.landmark_category
    ? landmarks.staffingFor(target.landmark_category, need)
    : null;

  const requiredSpecialists = crew !== null
    ? crew
    : (scale === 'property'
      ? specialistsForProperty(worldState, target, landmarks)
      : definition.specialists(worldState, target).filter((s) => s.occupation));

  // **Security is a post, not a share of a ratio, wherever a crew says
  // so.** `officer` and `enforcer` are the two Combat-skill posts a
  // crew can name; for a target with no crew it falls back to the
  // enforcer share of the role composition, which is all there is.
  const security = crew !== null
    ? crew.filter((p) => occupations.skillOf(p.occupation) === 'Combat')
      .reduce((sum, p) => sum + p.count, 0)
    : (requiredRoles.find((r) => r.role === 'enforcer')?.count ?? 0);

  return {
    locationId,
    scale,
    size: size === null ? null : Math.round(size * 100) / 100,
    significance,
    // Kept for targets with no crew, and reported alongside one where
    // there is — a caller comparing two places should not have to know
    // which kind each is.
    requiredRoles,
    requiredSpecialists,
    crew,
    // The two the request named separately: "how many employees it
    // needs to maintain, how much security".
    staff: requiredSpecialists.reduce((sum, s) => sum + s.count, 0),
    security,
    // **The crew is the total where there is one.** Rounding every post
    // up to at least one means a crew can come to more than the
    // headcount that produced it — a small hospital still needs a
    // physician — and the requirement is the people you actually have
    // to find, not the number that generated them.
    total: crew !== null
      ? crew.reduce((sum, p) => sum + p.count, 0)
      : requiredRoles.reduce((sum, r) => sum + r.count, 0),
  };
}

function specialistsForProperty(worldState, property, landmarks) {
  const post = property.landmark_category
    ? landmarks.staffPostFor(property.landmark_category)
    : null;
  if (post) return [{ occupation: post, count: SPECIALISTS_REQUIRED }];
  return SCALES.property.specialists(worldState, property).filter((s) => s.occupation);
}

// ---------------------------------------------------------------------
// upkeepOf — is this place actually being kept?
// ---------------------------------------------------------------------
// The comparison the two keys exist to support. `ratio` below 1 is a
// neglected place: it has fewer people than it needs, so it is decaying
// AND its takeover requirement has fallen with its headcount.
//
// Returns null for a target that does not exist. `ratio` is null — not
// zero — where there is no maintenance requirement to divide by, which
// cannot currently happen but would be a silent 0/0 if it did.
function upkeepOf(worldState, options = {}) {
  const { scale = null, locationId = null, tick = worldState.tick ?? 0 } = options;
  const maintenance = maintenanceFor(worldState, { scale, locationId, tick });
  if (maintenance === null) return null;
  const composition = compositionFor(worldState, { scale, locationId, tick });
  const present = composition ? composition.defenders : 0;

  return {
    locationId,
    scale,
    present,
    needed: maintenance.total,
    ratio: maintenance.total === 0 ? null : Math.round((present / maintenance.total) * 100) / 100,
    neglected: present < maintenance.total,
    // What it would cost somebody else to take it as it stands. Stated
    // here so the trap is one reading rather than two calls: a
    // neglected place is cheaper to seize than to keep.
    takeoverCost: composition ? composition.total : null,
    maintainCost: maintenance.total,
  };
}

// ---------------------------------------------------------------------
// compositionFor — ControlKeyComposition
// ---------------------------------------------------------------------
// The document's shape, with `scale` added because `locationId` alone
// does not say which table it is an id in — property 4 and community 4
// are different places.
//
// Returns null for a target that does not exist, rather than a
// requirement for nothing.
function compositionFor(worldState, options = {}) {
  const { scale = null, locationId = null, tick = worldState.tick ?? 0 } = options;
  const definition = SCALES[scale];
  if (!definition) {
    throw new Error(`control: "${scale}" is not a scale (one of: ${SCALE_NAMES.join(', ')}).`);
  }
  const target = definition.find(worldState, locationId);
  if (!target) return null;

  const holders = definition.holders(worldState, target);
  // Only the people who could actually hold it count — a block's
  // children are not a garrison. Same partition the roster uses, so
  // both sides of the comparison are the same kind of number, which is
  // standing rule 17's point about measuring the joint population.
  const defenders = holders.filter((n) => roleOf(worldState, n, tick) !== null).length;

  // At least one person, always: something held by nobody still has to
  // be walked into.
  const force = Math.max(1, Math.round(defenders * FORCE_PARITY));

  const requiredRoles = ROLE_NAMES
    .map((role) => ({
      role,
      count: Math.round((force * COMPOSITION_RATIO[role]) / RATIO_TOTAL),
    }))
    .filter((r) => r.count > 0);

  // Rounding can lose everybody for a very small target — a flat with
  // one occupant distributes 1 across 5:10:1 and the enforcer and elder
  // round to nothing, which is correct, but so can the labourer if the
  // ratio ever changes. One person, at the ratio's largest share.
  if (requiredRoles.length === 0) {
    const largest = ROLE_NAMES.reduce(
      (best, r) => (COMPOSITION_RATIO[r] > COMPOSITION_RATIO[best] ? r : best),
    );
    requiredRoles.push({ role: largest, count: 1 });
  }

  const requiredSpecialists = definition.specialists(worldState, target)
    .filter((s) => s.occupation);

  const total = requiredRoles.reduce((sum, r) => sum + r.count, 0);
  const fighters = requiredRoles.find((r) => r.role === 'enforcer')?.count ?? 0;

  return {
    locationId,
    scale,
    defenders,
    requiredRoles,
    requiredSpecialists,
    // **What they have to bring**, in §26's own trade categories rather
    // than in named items — see the note on TOOLS_PER_HAND.
    requiredMateriel: [
      { category: 'tools', count: Math.max(1, Math.round(total * TOOLS_PER_HAND)) },
      ...(fighters > 0
        ? [{ category: 'protection', count: Math.round(fighters * PROTECTION_PER_FIGHTER) }]
        : []),
    ],
    total,
  };
}

// ---------------------------------------------------------------------
// What a tribe actually carries
// ---------------------------------------------------------------------
// Summed across every living member's holdings, by §26 category. A
// tribe's kit is what its people are carrying — there is no shared
// store in this schema and inventing one would be a table for a fact
// `inventory` already holds.
//
// Quantity, not rows: five hammers in one holding is five tools.
function materielOf(worldState, tribeId) {
  // eslint-disable-next-line global-require
  const inventory = require('./inventory.js');
  // eslint-disable-next-line global-require
  const items = require('./items.js');

  const held = {};
  for (const npc of familyTraits.livingMembers(worldState, tribeId)) {
    for (const holding of inventory.holdingsOf(worldState, npc.id)) {
      const item = items.findItem(worldState, holding.item_name);
      if (!item || !item.category) continue;
      const quantity = Number(holding.quantity);
      if (!Number.isFinite(quantity) || quantity <= 0) continue;
      held[item.category] = (held[item.category] ?? 0) + quantity;
    }
  }
  return held;
}

// ---------------------------------------------------------------------
// assess — TakeoverAttemptResolution, without attempting it
// ---------------------------------------------------------------------
// The document's second shape. Separated from `attempt` on purpose: a
// player has to be able to see what a target would take before
// committing to it, and `TribeGrowthOptionsExpansion` in
// `TRIBE_GROWTH_MISSION_UNLOCK_SYSTEM.md` is exactly a list of these.
//
// `finalSuccessProbability` is `margin * cohesion`:
//
//   margin    how far past the requirement the tribe is, capped at 1.
//             Meeting it exactly is 1. There is no bonus for bringing
//             three times what is needed, because the document's whole
//             argument is that numbers are not the story.
//   cohesion  `familyTraits.cohesionOf` — unity and cooperation pulling,
//             conflict discounting. A tribe at the schema's defaults
//             scores 0.5, so meeting the requirement exactly with an
//             ordinary family is a coin flip, and a family at war with
//             itself fails almost always however many people it brings.
//
// Composition unmet is probability 0 and not a small number: the
// document makes `compositionRequirementMet` a boolean and the unlock
// chain in the other document treats the match itself as what makes a
// mission viable. A tribe without the specialist is not unlucky, it is
// unable.
function assess(worldState, options = {}) {
  const {
    scale = null, locationId = null, tribeId = null, tick = worldState.tick ?? 0,
  } = options;

  const composition = compositionFor(worldState, { scale, locationId, tick });
  if (composition === null) return null;
  const tribe = (worldState.families || []).find((f) => f.id === tribeId);
  if (!tribe) return null;

  const roster = rosterOf(worldState, tribeId, { tick });

  const shortfalls = [];
  for (const requirement of composition.requiredRoles) {
    const have = roster.roles[requirement.role] ?? 0;
    if (have < requirement.count) {
      shortfalls.push({ role: requirement.role, need: requirement.count, have });
    }
  }
  for (const requirement of composition.requiredSpecialists) {
    const have = roster.occupations[requirement.occupation] ?? 0;
    if (have < requirement.count) {
      shortfalls.push({ occupation: requirement.occupation, need: requirement.count, have });
    }
  }
  // **What they are carrying**, which `assess` did not read at all: a
  // tribe of twenty could take a government building barehanded.
  const carried = materielOf(worldState, tribeId);
  for (const requirement of composition.requiredMateriel ?? []) {
    const have = carried[requirement.category] ?? 0;
    if (have < requirement.count) {
      shortfalls.push({ category: requirement.category, need: requirement.count, have });
    }
  }

  const compositionRequirementMet = shortfalls.length === 0;
  const tribeCohesionScore = familyTraits.cohesionOf(worldState, tribeId);
  const margin = composition.total === 0
    ? 1
    : Math.min(1, roster.fielded / composition.total);

  return {
    locationId,
    scale,
    tribeId,
    compositionRequirementMet,
    tribeCohesionScore,
    finalSuccessProbability: compositionRequirementMet
      ? Math.round(margin * tribeCohesionScore * 10000) / 10000
      : 0,
    composition,
    roster,
    // What they are actually carrying, by §26 category — so a refusal
    // says what to go and find rather than only that something is
    // missing.
    materiel: carried,
    shortfalls,
  };
}

// ---------------------------------------------------------------------
// attempt
// ---------------------------------------------------------------------
// Resolves the assessment against a seeded draw and, on success, writes
// back. Standing rule 1's three write-backs, for a group action:
//
//   memory        every participant remembers it, weighted by whether
//                 it worked. The document's tribes are made of people
//                 who remember what they did together.
//   relationship  a takeover is a shared undertaking, so the
//                 participants' trust in each other moves — which
//                 feeds `familyTraits.unityTarget` and therefore the
//                 cohesion of the NEXT attempt.
//   world         the seize, or the declared absence of a column.
//
// Seeded on the OCCASION — target, tribe and tick — not on anybody's
// identity. §88, and the attempt is the subject of the draw.
function attempt(worldState, options = {}) {
  const {
    scale = null, locationId = null, tribeId = null, tick = worldState.tick ?? 0,
    seed = worldState.seed ?? 'world',
  } = options;

  const resolution = assess(worldState, { scale, locationId, tribeId, tick });
  if (resolution === null) return null;

  const draw = seededDraw([seed, 'takeover', scale, locationId, tribeId, tick]);
  const succeeded = resolution.compositionRequirementMet
    && draw < resolution.finalSuccessProbability;

  const participants = familyTraits.livingMembers(worldState, tribeId)
    .filter((n) => roleOf(worldState, n, tick) !== null);

  let seized = null;
  if (succeeded) {
    const target = SCALES[scale].find(worldState, locationId);
    seized = SCALES[scale].seize(worldState, target, tribeId, tick);
  }

  // Memory. `importance` and `emotionLevel` scale with the attempt: a
  // country is not a flat, and losing is not the same as winning.
  const weight = Math.min(100, Math.round(resolution.composition.total * 5));
  for (const npc of participants) {
    worldStore.addMemory(worldState, {
      entityId: npc.id,
      memoryType: succeeded ? 'positive' : 'negative',
      category: 'conflict',
      description: succeeded
        ? `took control of ${scale} ${locationId}`
        : `failed to take ${scale} ${locationId}`,
      importance: Math.max(10, weight),
      emotionLevel: succeeded ? weight : -weight,
      tick,
      relatedEntityIds: participants.map((p) => p.id).filter((id) => id !== npc.id),
      // A takeover is not something somebody forgets.
      // `memories.expiration` is `never|temporary|permanent` in the
      // schema's own comment and every caller in the engine has taken
      // the `temporary` default until now — this is the first row that
      // has a reason not to.
      expiration: 'permanent',
    });
  }

  // Relationships. Doing something hard together moves people toward
  // each other; failing at it moves them apart. A small, symmetric
  // nudge — not a rewrite — because `advanceCohesion` is what turns
  // this into the tribe's unity and it is deliberately slow.
  for (let i = 0; i < participants.length; i += 1) {
    for (let j = i + 1; j < participants.length; j += 1) {
      const rel = worldStore.adjustRelationship(
        worldState, participants[i].id, participants[j].id, 'family',
        { trust: succeeded ? SHARED_UNDERTAKING : -SHARED_UNDERTAKING },
      );
      // **`adjustRelationship` adds and does not clamp**, which is
      // fine for `interaction_count` and wrong for a 0-100 index:
      // `keys.resolveTrust` clamps its own writes for exactly this
      // reason, so a caller that nudges trust directly has to do the
      // same or a tribe that keeps winning ends up above the scale.
      rel.trust = Math.max(0, Math.min(100, rel.trust));
    }
  }

  const event = {
    type: succeeded ? 'takeover_succeeded' : 'takeover_failed',
    severity: resolution.composition.total >= SIGNIFICANT_FORCE ? 'high' : 'medium',
    note: `the ${(worldState.families || []).find((f) => f.id === tribeId)?.surname ?? tribeId} `
      + `${succeeded ? 'took' : 'failed to take'} ${scale} ${locationId}`,
    tick,
    affected_entity_ids: participants.map((n) => n.id),
    global_effects: {
      scale,
      locationId,
      tribeId,
      compositionRequirementMet: resolution.compositionRequirementMet,
      tribeCohesionScore: resolution.tribeCohesionScore,
      finalSuccessProbability: resolution.finalSuccessProbability,
      seized,
    },
  };

  return {
    ...resolution, succeeded, draw: Math.round(draw * 10000) / 10000, seized, events: [event],
  };
}

// ---------------------------------------------------------------------
// viableTargetsFor — TribeGrowthOptionsExpansion
// ---------------------------------------------------------------------
// `TRIBE_GROWTH_MISSION_UNLOCK_SYSTEM.md`'s second shape: what this
// roster can currently take. "A player doesn't just want more people —
// they want the right people, because each new specialist genuinely
// opens a real, specific door that was locked before."
//
// Scoped to a city, because the alternative is assessing every property
// in the world against every family in it, and because the engineers
// three cities away are not going to help take this building.
function viableTargetsFor(worldState, options = {}) {
  const {
    tribeId = null, cityId = null, tick = worldState.tick ?? 0, includeUnmet = false,
  } = options;
  const out = [];

  const candidates = [];
  const communities = cityId === null
    ? (worldState.communities || [])
    : communitiesOfCity(worldState, cityId);
  const communityIds = new Set(communities.map((c) => c.id));

  for (const p of worldState.properties || []) {
    if (cityId !== null && !communityIds.has(p.community_id)) continue;
    candidates.push({ scale: 'property', locationId: p.id });
  }
  for (const c of communities) {
    candidates.push({ scale: 'community', locationId: c.id });
  }
  for (const i of worldState.infrastructure || []) {
    if (cityId !== null && i.city_id !== cityId) continue;
    candidates.push({ scale: 'infrastructure', locationId: i.id });
  }
  // Organizations have no city of their own in the schema, so they are
  // offered whole. Stated rather than filtered on a column that is not
  // there.
  for (const o of worldState.organizations || []) {
    candidates.push({ scale: 'organization', locationId: o.id });
  }

  for (const candidate of candidates) {
    const resolution = assess(worldState, { ...candidate, tribeId, tick });
    if (resolution === null) continue;
    if (!includeUnmet && !resolution.compositionRequirementMet) continue;
    out.push({
      scale: candidate.scale,
      locationId: candidate.locationId,
      compositionRequirementMet: resolution.compositionRequirementMet,
      finalSuccessProbability: resolution.finalSuccessProbability,
      shortfalls: resolution.shortfalls,
      required: resolution.composition.total,
    });
  }

  return out.sort(
    (a, b) => b.finalSuccessProbability - a.finalSuccessProbability || a.required - b.required,
  );
}

// ---------------------------------------------------------------------
// noteRecruitment — TribeSkillMissionUnlock
// ---------------------------------------------------------------------
// `TRIBE_GROWTH_MISSION_UNLOCK_SYSTEM.md`: "The moment a Tribe recruits
// someone whose occupation matches a nearby location's specialist
// requirement, that match itself becomes the trigger for a new, real,
// suggested mission. Recruit someone with real water-treatment
// experience, and the water plant takeover becomes a real,
// newly-viable mission... Recruit a pastor, and a church becomes a
// real, newly-viable target."
//
// **The moment is a hire, and that is why this is called from the
// Economy phase with `runLabour`'s own list rather than scanning.** A
// periodic scan would be a condition rather than a crossing (standing
// rule 7): at generation every tribe already qualifies for something,
// so a scan emits thousands of "newly viable" notices on tick 1 and
// nothing ever again.
//
// **It emits an event, not a `missions` row, and that is declared
// rather than worked around.** `missions.artifact_id` is NOT NULL and
// `generateMission` refuses an id that is not a real artifact — the
// mission table in this schema is an ARTIFACT-recovery table. A
// takeover has no artifact, and inventing one so the row would insert
// would put a fictional object in `artifacts` to satisfy a foreign
// key. So the suggestion is an event plus `viableTargetsFor`, and
// closing it properly needs `missions` to admit a mission that is not
// about an object, which is a schema decision and not this one.
//
// "Newly" is what makes it a crossing: the hire counts only if this is
// the FIRST holder of that occupation in the tribe. The second
// physician unlocks nothing.
// An event note is read by a person, so "a engineer" is a bug in it.
// Crude on purpose — the taxonomy is thirty-four known words and none
// of them is `hour` or `union`.
function article(word) {
  return 'aeiou'.includes(String(word)[0]) ? 'an' : 'a';
}

// Every target in this city whose specialist requirement IS this
// occupation. Reads the two mappings that produce a requirement rather
// than assessing targets and filtering — see the note in
// `noteRecruitment`.
//
// `city` and `civilization` are included when the position is one they
// name, and that is deliberate even though a tribe will essentially
// never meet a city's composition: the point of the unlock notice is
// that a door opened, and a door the tribe cannot yet walk through is
// still a door. `assess` decides whether it can.
function targetsRequiring(worldState, position, cityId) {
  const out = [];

  for (const organization of worldState.organizations || []) {
    if (occupations.postFor(organization.type) === position) {
      out.push({ scale: 'organization', locationId: organization.id });
    }
  }

  for (const row of worldState.infrastructure || []) {
    if (cityId !== null && row.city_id !== cityId) continue;
    if (occupations.postForInfrastructure(row.type) === position) {
      out.push({ scale: 'infrastructure', locationId: row.id });
    }
  }

  // A property inherits the specialist of whoever operates it, because
  // what you are taking is the business in the building.
  const communityIds = new Set(
    (cityId === null
      ? (worldState.communities || [])
      : communitiesOfCity(worldState, cityId)).map((c) => c.id),
  );
  for (const p of worldState.properties || []) {
    if (!p.operating_organization_id) continue;
    if (cityId !== null && !communityIds.has(p.community_id)) continue;
    const operator = (worldState.organizations || [])
      .find((o) => o.id === p.operating_organization_id);
    if (operator && occupations.postFor(operator.type) === position) {
      out.push({ scale: 'property', locationId: p.id });
    }
  }

  if (occupations.postFor('government') === position) {
    for (const city of worldState.cities || []) {
      if (cityId !== null && city.id !== cityId) continue;
      out.push({ scale: 'city', locationId: city.id });
    }
  }
  if (occupations.postFor('government') === position
    || occupations.postFor('military') === position) {
    for (const civilization of worldState.civilizations || []) {
      out.push({ scale: 'civilization', locationId: civilization.id });
    }
  }

  return out;
}

function noteRecruitment(worldState, hires = [], tick = worldState.tick ?? 0) {
  const events = [];

  for (const hire of hires) {
    const { entityId = null, position = null } = hire || {};
    if (!entityId || !position) continue;

    const membershipRow = (worldState.familyMemberships || [])
      .find((m) => m.entity_id === entityId);
    if (!membershipRow) continue;
    const tribeId = membershipRow.family_id;

    // First of their trade in the tribe, or nothing has changed.
    const holders = familyTraits.livingMembers(worldState, tribeId)
      .filter((n) => occupations.occupationOf(worldState, n.id) === position);
    if (holders.length !== 1) continue;

    // Which nearby targets that trade is the specialist requirement
    // for. Nearby is their own city — `TRIBE_GROWTH_MISSION_UNLOCK_
    // SYSTEM.md` says "a nearby location", and the specialists three
    // cities away are the thing this whole file says do not count.
    const npc = (worldState.npcs || []).find((n) => n.id === entityId);
    const community = (worldState.communities || [])
      .find((c) => c.id === npc?.communityId);
    const cityId = community?.city_id ?? null;

    // **Only the targets this trade could possibly unlock**, which is
    // the difference between a cheap check and a quadratic one. The
    // first version called `viableTargetsFor` and filtered the result:
    // that assesses every property, community, organization and piece
    // of infrastructure in the city against this tribe — roughly two
    // hundred full resolutions — and then throws away all but the two
    // or three a new physician could have changed. Measured as a tick
    // that had become too slow to run four hundred of.
    //
    // A specialist requirement comes from exactly two mappings
    // (`occupations.postFor` and `postForInfrastructure`), so the
    // targets worth assessing can be found by asking which types name
    // THIS position — and for most hires the answer is none and the
    // work is a handful of comparisons.
    const candidates = targetsRequiring(worldState, position, cityId);
    if (candidates.length === 0) continue;

    const unlocked = [];
    for (const candidate of candidates) {
      const resolution = assess(worldState, { ...candidate, tribeId, tick });
      if (resolution && resolution.compositionRequirementMet) unlocked.push(candidate);
    }
    if (unlocked.length === 0) continue;

    events.push({
      type: 'takeover_unlocked',
      severity: 'low',
      note: `the ${(worldState.families || []).find((f) => f.id === tribeId)?.surname ?? tribeId} `
        + `took on ${article(position)} ${position}, and ${unlocked.length} `
        + `${unlocked.length === 1 ? 'target' : 'targets'} became viable`,
      tick,
      affected_entity_ids: [entityId],
      global_effects: {
        tribeId,
        occupation: position,
        cityId,
        unlocked: unlocked.map((t) => ({ scale: t.scale, locationId: t.locationId })),
      },
    });
  }

  return events;
}

// ---------------------------------------------------------------------
// describeControl
// ---------------------------------------------------------------------
// What the takeover key can see in a world: how many targets exist at
// each scale, and how many of them any tribe could currently take. The
// measurement, so "nobody can take anything" cannot hide.
function describeControl(worldState, options = {}) {
  const { tick = worldState.tick ?? 0 } = options;
  const counts = {
    property: (worldState.properties || []).length,
    organization: (worldState.organizations || []).length,
    infrastructure: (worldState.infrastructure || []).length,
    community: (worldState.communities || []).length,
    city: (worldState.cities || []).length,
    civilization: (worldState.civilizations || []).length,
  };

  let viable = 0;
  let tribesThatCanTakeSomething = 0;
  for (const family of worldState.families || []) {
    const targets = viableTargetsFor(worldState, { tribeId: family.id, tick });
    if (targets.length > 0) tribesThatCanTakeSomething += 1;
    viable += targets.length;
  }

  return {
    targets: counts,
    tribes: (worldState.families || []).length,
    tribesThatCanTakeSomething,
    viableTargetPairs: viable,
  };
}

module.exports = {
  ELDER_AGE,
  WORKING_AGE,
  COMPOSITION_RATIO,
  ROLE_NAMES,
  RATIO_TOTAL,
  FORCE_PARITY,
  SPECIALISTS_REQUIRED,
  TOOLS_PER_HAND,
  PROTECTION_PER_FIGHTER,
  materielOf,
  SHARED_UNDERTAKING,
  SIGNIFICANT_FORCE,
  SCALE_NAMES,
  SCALES,
  roleOf,
  isEnforcer,
  rosterOf,
  SIGNIFICANCE_WEIGHT,
  MINIMUM_MAINTENANCE,
  footprintOf,
  medianFootprint,
  sizeOf,
  maintenanceFor,
  upkeepOf,
  compositionFor,
  assess,
  attempt,
  viableTargetsFor,
  noteRecruitment,
  describeControl,
};
