// Tribe Growth & Mission Unlock — the document's own mechanic.
//
// ---------------------------------------------------------------------
// What this closes
// ---------------------------------------------------------------------
// `dev-docs/PLAYTEST_19_SEP_2026.md` finding 2: `mAvail 3, mDone 0`,
// constant across 600 ticks. Three missions exist at generation and no
// world has ever had a fourth, because `grep -rn generateMission
// server/` returns exactly one real caller — `worldgen.js`, at tick 0.
// That is the eleventh standing rule: a generator nothing calls is
// indistinguishable from one that does not exist, and here it is a
// generator called precisely once at the beginning of time.
//
// ---------------------------------------------------------------------
// The mechanic is specified, not invented
// ---------------------------------------------------------------------
// `TRIBE_GROWTH_MISSION_UNLOCK_SYSTEM.md`, in full, is the source:
//
//: "recruiting the right person doesn't just add a body to the Tribe —
//:  it directly unlocks and suggests the specific mission their skill
//:  makes possible."
//:
//: "A location's Control Key already specifies real specialist
//:  requirements (a Hospital needs medical experts). The Occupation
//:  Taxonomy already tracks exactly what real skill each NPC brings.
//:  The moment a Tribe recruits someone whose occupation matches a
//:  nearby location's specialist requirement, that match itself becomes
//:  the trigger for a new, real, suggested mission."
//:
//: "recruit someone with real water-treatment experience, and the
//:  water plant takeover becomes a real, newly-viable mission"
//
// **The nineteenth standing rule says to check all three cited systems
// before scoping this as wiring**, because the last time this document
// was read, two of the three did not exist and had to be built first.
// Checked again, on a generated world, and this time all three are
// real:
//
//   - the specialist requirement    `occupations.DEFINING_POST` — five
//                                   of the seven organization types a
//                                   generated world contains name one
//                                   (school/teacher, hospital/physician,
//                                   library/librarian, media/reporter,
//                                   government/diplomat; `business` is
//                                   deliberately null)
//   - what each NPC brings          `occupations.occupationOf`, written
//                                   on every hire since the taxonomy
//                                   landed
//   - the tribe                     `family_memberships`, 112 rows
//                                   across 30 families
//
// So this file is wiring, and it adds no modelling of its own.
//
// ---------------------------------------------------------------------
// A mission belongs to a PLACE, not to a tribe
// ---------------------------------------------------------------------
// The obvious build gives each tribe its own mission for the hospital.
// It is wrong twice. The `missions` table has no tribe column and
// `controlling_faction_id` is validated against real factions, so a
// family cannot go there — inventing a column to hold it would be the
// third standing rule's shape, a second answer to a question the
// schema already answers. And it is wrong on the merits: that a
// hospital can be taken is a fact about the hospital, and two tribes
// finding out separately does not make two hospitals.
//
// So the world generates **one mission per location**, and which tribes
// it is *viable for* is computed per tribe and stored nowhere —
// `unlockedFor` below, which is the document's own
// `TribeGrowthOptionsExpansion`.
//
// That also supplies the crossing rather than the condition, which the
// seventh standing rule demands. A pass that fired on "this tribe can
// staff the hospital" would emit an identical event every tick forever.
// The memory here is the mission itself: a location that already has
// one is not unlocked again, and that is durable state the engine
// already keeps rather than a flag invented to remember a crossing.
//
// ---------------------------------------------------------------------
// The honest gate: a mission needs something to be about
// ---------------------------------------------------------------------
// `generateMission` requires a real artifact — `missions.artifact_id`
// references one and the function refuses an id that is not there. So a
// location can only become a mission once something has actually been
// found in it, which `discovery.js` does during play and records as
// `artifacts.location_id`. Measured on a 400-tick world: 8 artifacts,
// 5 of them with a location. That is a real constraint and it is left
// in place rather than worked around by fabricating a relic — a
// location nobody has searched is not a lead.
//
// (`generateArtifact`'s own header still says "no Property system
// exists anywhere in this project", which is why `location_id` was
// documented as permanently null. `server/property.js` has existed
// since Phase 2 and `discovery.js` passes a real property id. That
// comment is the twenty-first rule's stale-in-one-direction note and is
// corrected there.)

'use strict';

const occupations = require('./occupations.js');
const missions = require('./missions.js');
const { seededDraw } = require('./seeded.js');

// ---------------------------------------------------------------------
// What a location asks for
// ---------------------------------------------------------------------

// The occupation a property's operator needs, or null where the type
// names none. `business`, `corporation` and `club` return null on
// purpose — `occupations.js` argues that a business is not defined by
// one trade — so those locations never unlock a mission this way, and
// that is the taxonomy's answer rather than a gap here.
function requirementFor(worldState, property) {
  const organizationId = property?.operating_organization_id ?? null;
  if (organizationId == null) return null;
  const organization = (worldState.organizations || [])
    .find((o) => o.id === organizationId);
  if (!organization) return null;
  return occupations.postFor(organization.type) ?? null;
}

// Every property in the world that asks for a specialist, with what it
// asks for. Built once per pass rather than per tribe.
function stafflessLocations(worldState) {
  const out = [];
  for (const property of worldState.properties || []) {
    const occupation = requirementFor(worldState, property);
    if (!occupation) continue;
    out.push({ property, occupation });
  }
  return out;
}

// ---------------------------------------------------------------------
// What a tribe brings
// ---------------------------------------------------------------------

function membersOf(worldState, tribeId) {
  return (worldState.familyMemberships || [])
    .filter((m) => m.family_id === tribeId)
    .map((m) => m.entity_id);
}

function tribeIds(worldState) {
  return [...new Set((worldState.familyMemberships || []).map((m) => m.family_id))]
    .sort((a, b) => a - b);
}

// The occupations a tribe's living members actually hold, as a map from
// occupation to the member ids holding it.
//
// Read off `employment_records.position` through `occupationOf`, which
// returns null for an untitled job — a real state for any world
// restored from before the taxonomy existed, and not one to guess at.
function rosterOccupations(worldState, tribeId) {
  const living = new Set((worldState.npcs || []).map((n) => n.id));
  const roster = new Map();
  for (const entityId of membersOf(worldState, tribeId)) {
    if (!living.has(entityId)) continue;
    const name = occupations.occupationOf(worldState, entityId);
    if (!name) continue;
    if (!roster.has(name)) roster.set(name, []);
    roster.get(name).push(entityId);
  }
  return roster;
}

// Where a tribe's members live. A match has to be with a NEARBY
// location — the document's own word — and the engine's unit of
// nearness is the community, which is also what `control.js` uses when
// it asks who could help take a building: "the engineers three cities
// away are not going to help take this building."
function communitiesOf(worldState, tribeId) {
  const members = new Set(membersOf(worldState, tribeId));
  const out = new Set();
  for (const npc of worldState.npcs || []) {
    if (!members.has(npc.id)) continue;
    if (npc.communityId == null) continue;
    out.add(npc.communityId);
  }
  return out;
}

// ---------------------------------------------------------------------
// TribeGrowthOptionsExpansion — computed, never stored
// ---------------------------------------------------------------------
// The document's second struct: given who is in the tribe right now,
// which locations does that roster make viable? The third standing rule
// says never to store a computable rollup, and this is one.
function unlockedFor(worldState, tribeId) {
  const roster = rosterOccupations(worldState, tribeId);
  const here = communitiesOf(worldState, tribeId);
  const matches = [];

  for (const { property, occupation } of stafflessLocations(worldState)) {
    if (!here.has(property.community_id)) continue;
    const holders = roster.get(occupation);
    if (!holders || holders.length === 0) continue;
    matches.push({
      locationId: property.id,
      locationName: property.name ?? null,
      communityId: property.community_id,
      occupation,
      // `suggestionSource` in the document is an enum of three. The
      // only one this engine can honestly report is the first: the
      // member whose occupation made the match. `elder` and
      // `tribe-leader` would need a role model the family sheet does
      // not carry, and naming one anyway would be inventing a fact.
      suggestedBy: holders[0],
      suggestionSource: 'the-new-member-themselves',
      missionId: missionForLocation(worldState, property.id)?.id ?? null,
    });
  }

  matches.sort((a, b) => a.locationId - b.locationId);
  return {
    tribeId,
    currentMemberOccupations: [...roster.keys()].sort(),
    unlocked: matches,
  };
}

// ---------------------------------------------------------------------
// The pass
// ---------------------------------------------------------------------

// The artifact somebody has actually found at this location, if any.
function artifactAt(worldState, locationId) {
  return (worldState.artifacts || []).find((a) => a.location_id === locationId) ?? null;
}

// A mission already standing for this location — either one named
// directly on it, or one about an artifact that was found there.
//
// **This is the memory that makes the unlock a CROSSING rather than a
// condition** (seventh standing rule), and it is durable state the
// engine already keeps rather than a flag invented to remember one. A
// pass that fired on "this tribe can staff the hospital" would put an
// identical event in the log every tick for as long as the tribe held
// a physician.
function missionForLocation(worldState, locationId) {
  const artifacts = new Set((worldState.artifacts || [])
    .filter((a) => a.location_id === locationId)
    .map((a) => a.id));
  return (worldState.missions || []).find(
    (m) => m.location_property_id === locationId
      || (m.artifact_id != null && artifacts.has(m.artifact_id)),
  ) ?? null;
}

//: What a recovered artifact pays. Deliberately the SAME band
//: `worldgen.js` already draws its three starting rewards from
//: (80..600) rather than a new scale keyed to the building's value.
//:
//: Two reasons, and the second is a caveat rather than a justification.
//: Giving two rewards of the same kind different numbers would be
//: asserting something nobody has measured — the same argument
//: `meetings.js` makes for setting its one constant equal to
//: `control.SHARED_UNDERTAKING`. And `payMissionReward` creates money
//: rather than moving it, so every mission completed adds to a supply
//: that finding 3 of the playtest already records as only ever growing.
//: This file does not make that worse per mission, but it does make
//: more missions, and that is stated here rather than discovered later.
const REWARD_FLOOR = 80;
const REWARD_CEILING = 600;

// One tick of the world noticing what its tribes can now do.
//
// Runs in the cross-cutting slot beside `flows.js`, `behavior.js` and
// `households.js`. The pipeline is locked at eleven phases and who can
// staff what is not a stage of a tick.
function runTribeMissions(worldState, options = {}) {
  const { tick = worldState.tick ?? 0, seed = worldState.seed ?? 'tribe-missions' } = options;
  const events = [];

  // One pass over the tribes, collecting the locations that are viable
  // for somebody and do not already have a mission. Keyed by location,
  // because a mission belongs to a place — two tribes qualifying for
  // the same hospital is one mission, not two.
  const opened = new Map();
  for (const tribeId of tribeIds(worldState)) {
    for (const match of unlockedFor(worldState, tribeId).unlocked) {
      if (match.missionId !== null) continue;
      if (opened.has(match.locationId)) continue;
      // An artifact found here makes it a recovery; otherwise the
      // mission is the document's own kind — take the place.
      //
      // **Gating on an artifact was the first version and it made the
      // mechanic fire by coincidence.** Measured on a 120-tick world:
      // 21 landmark properties, 17 operated ones, 6 both, and every
      // artifact discovered so far had landed in a `historical_site`
      // with no operator — so a staffed hospital could be unlocked by
      // a tribe forever and never become a mission, because nobody had
      // happened to find a relic in it. That is the twentieth standing
      // rule pointed at a build rather than a guard: a mechanism whose
      // trigger cannot realistically occur is decoration.
      opened.set(match.locationId, {
        ...match, tribeId, artifact: artifactAt(worldState, match.locationId),
      });
    }
  }

  for (const [locationId, match] of [...opened].sort((a, b) => a[0] - b[0])) {
    // Seeded on the LOCATION rather than on the tribe or the tick:
    // §88 wants the same world from the same seed, and a reward that
    // depended on which tribe happened to qualify first would move
    // when an unrelated hire changed.
    const spread = REWARD_CEILING - REWARD_FLOOR;
    const reward = REWARD_FLOOR + Math.round(
      seededDraw([seed, 'mission-reward', locationId]) * spread,
    );
    const place = match.locationName ?? `location ${locationId}`;
    const mission = missions.generateMission(worldState, match.artifact
      ? {
        artifactId: match.artifact.id,
        locationId,
        objective: `Recover ${match.artifact.name} from ${place}`,
        reward,
      }
      : {
        locationId,
        objective: `Take ${place}`,
        reward,
      });
    events.push({
      type: 'mission_unlocked',
      severity: 'low',
      note: `${match.occupation} in the tribe makes ${match.locationName ?? `location ${locationId}`} `
        + `a real target — mission ${mission.id} is open`,
      tick,
      affected_entity_ids: [match.suggestedBy],
      global_effects: {
        missionId: mission.id,
        locationId,
        communityId: match.communityId,
        occupation: match.occupation,
        tribeId: match.tribeId,
        suggestionSource: match.suggestionSource,
      },
    });
  }

  return events;
}

// ---------------------------------------------------------------------
// describeUnlocks — the guard
// ---------------------------------------------------------------------
// The claim is that a tribe's composition opens specific doors. That is
// false if no location ever asks for anything, if no tribe ever holds a
// matching occupation, or if every location is unlocked for everybody —
// a door open to all is not a door. **The twentieth standing rule says
// this function has to be able to fail**, so it counts the things that
// would show the mechanic is decorative, and none of its evidence is
// its own output.
function describeUnlocks(worldState) {
  const locations = stafflessLocations(worldState);
  const tribes = tribeIds(worldState);

  const askedFor = new Map();
  for (const { occupation } of locations) {
    askedFor.set(occupation, (askedFor.get(occupation) ?? 0) + 1);
  }

  let tribesWithAny = 0;
  const unlockedLocations = new Set();
  const perTribe = [];
  for (const tribeId of tribes) {
    const view = unlockedFor(worldState, tribeId);
    if (view.unlocked.length > 0) tribesWithAny += 1;
    for (const m of view.unlocked) unlockedLocations.add(m.locationId);
    perTribe.push(view.unlocked.length);
  }

  const withArtifact = locations.filter(
    ({ property }) => artifactAt(worldState, property.id) !== null,
  ).length;

  return {
    // If this is zero the taxonomy names no specialist for anything in
    // the world and the mechanic cannot fire at all.
    locationsAskingForSomebody: locations.length,
    occupationsAskedFor: [...askedFor.keys()].sort(),
    // If this is zero no location has ever been searched, so no mission
    // can be generated however well staffed a tribe is.
    locationsWithSomethingFound: withArtifact,
    tribes: tribes.length,
    // Zero means no tribe can staff anything — the mechanic is inert.
    // Equal to `tribes` means every tribe qualifies for everything,
    // which is the other way for it to mean nothing.
    tribesWithAnyUnlock: tribesWithAny,
    locationsUnlockedBySomebody: unlockedLocations.size,
    missionsStanding: (worldState.missions || []).length,
    // The distribution matters more than the total: a mechanic where
    // one tribe holds every door is not the one the document describes.
    unlocksPerTribe: {
      max: perTribe.length ? Math.max(...perTribe) : 0,
      median: perTribe.length
        ? [...perTribe].sort((a, b) => a - b)[Math.floor(perTribe.length / 2)]
        : 0,
    },
  };
}

module.exports = {
  REWARD_FLOOR,
  REWARD_CEILING,
  requirementFor,
  stafflessLocations,
  membersOf,
  tribeIds,
  rosterOccupations,
  communitiesOf,
  unlockedFor,
  artifactAt,
  missionForLocation,
  runTribeMissions,
  describeUnlocks,
};
