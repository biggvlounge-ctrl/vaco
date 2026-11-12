// server/missionTriggers.js
//
// "Every time we do something new, explore skyscraper, explore
// library... the missions should be made off of those... finding
// [main characters] will help us build missions that will happen in
// normal situations" — by direct instruction, the GTA-style half of
// the "main characters" request: a player visiting a real location
// controlled by a real criminal main character (`mainCharacters.js`'s
// own `criminalLeaderOf`) has a real, bounded chance of that visit
// turning into a real mission from the faction holding the ground —
// `generateMission({ locationId, controllingFactionId })`, exactly the
// call shape `missions.js` already validates.
//
// ---------------------------------------------------------------------
// Scope — what this wires, and what it deliberately does not
// ---------------------------------------------------------------------
//
// **`search-location` needs no new location vocabulary at all.**
// `server/landmarks.js` already has real `skyscraper` and `library`
// categories (the founder's own two named examples) among its
// thirty-three, and `discovery.search` already runs against ANY
// landmark category — so wiring the trigger onto `searchLocation`
// covers both examples, and every other landmark category, as a
// direct consequence of the mechanism being general rather than
// special-cased to those two names.
//
// **`practise-habit` has no location at all today, and no controlled
// vocabulary of habit names either** (`habits.habit_name` is free
// text — nothing in this engine enumerates "fishing" or "reading" as
// a closed set, unlike `landmarks.CATEGORIES`). Gating the trigger on
// specific habit-name strings would invent a vocabulary this engine
// has never had. The honest wiring is the one `adopt-routine` already
// established for schedules: an OPTIONAL `locationPropertyId` on the
// action itself. A player who names "fishing" and a real dock
// property, or "reading" and a real library, gets the same real
// chance `search-location` gets; a bare `practise-habit` with no
// location (most calls, honestly) triggers nothing, which is correct
// — there is no place for a mission to be ABOUT.
//
// **Deliberately deferred**: a dedicated "fishing spot" landmark
// category (none exists — checked directly against `landmarks.js`'s
// real thirty-three, and inventing one is a landmark-design decision,
// not a mission-trigger one); gating by habit name at all; triggering
// from any verb beyond these two (`adopt-routine` already has its own
// real purpose — scheduling, not acting — and firing a mission the
// moment a routine is merely ADOPTED, before it is ever practised,
// would reward planning instead of doing).
//
// ---------------------------------------------------------------------
// Why criminal, not political/religious/business
// ---------------------------------------------------------------------
//
// `missions.generateMission`'s own `controllingFactionId` validation
// requires `organizations.isFaction === true` — a real gang/faction,
// never a government, religious order or business. That is the
// schema's own distinction, not one invented here, and it matches the
// founder's own worked example exactly: "a kingpin... the strongest
// gangs" is the GTA-style job-giver, not the mayor or a shopkeeper.
// `mainCharacters.criminalLeaderOf` is the one category of the four
// built for exactly this shape.
//
// ---------------------------------------------------------------------
// A found, honest limitation, not a guess papered over
// ---------------------------------------------------------------------
//
// **On a freshly generated, never-ticked world, this almost never
// fires** — checked directly before calibrating anything, the
// seventeenth standing rule's own discipline. `organizations.leader_id`
// is written at generation for nothing worldgen creates except this
// round's own religious order (the forty-eighth standing rule's
// documented gap); a faction's `leader_id` is written only by a real
// election-equivalent for gangs, which is `control.js`'s own `seize` —
// itself only ever called from the real `attempt-takeover` player
// verb, never from the tick pipeline. Measured directly: a 6-community,
// 240-resident generated world produced authority.holderOf() holders
// in several communities and `leader_id` set on NONE of them. So the
// real sequence this mechanism rewards is: a real faction takes real
// ground (`attempt-takeover`, already a real verb), and ONLY THEN does
// visiting that ground start offering jobs from whoever just took it —
// which is the GTA shape being asked for, not a bug in this one.
//
// ---------------------------------------------------------------------
// The rate — measured, not guessed (standing rule 17)
// ---------------------------------------------------------------------
//
// Unlike `resolveAggression`'s per-tick draw against every eligible
// pair, this draw only ever runs on an explicit player action, and a
// location that already has an open mission is skipped outright (see
// `hasOpenMissionAt` below) — so there is no feedback loop and no
// repeated-sampling inflation to guard against, only "how many visits
// to a real kingpin's ground before a job shows up" to choose well.
// `seeded.seededDraw` is a real, already-verified uniform distribution
// (`test/seeded.test.js`) rather than something this file re-measures;
// what was measured here is how CHANCE maps to calls-to-first-trigger,
// over 200 distinct (propertyId, tick-sequence) draws each:
//
//     chance   mean calls   median calls
//     0.05     19.9         12
//     0.08     12.5          8
//     0.10     10.2          7
//     0.15      6.6          5
//     0.20      5.1          4
//     0.30      3.5          3
//
// 0.1 is chosen: a real job shows up after a handful of visits to a
// real controlled location (median 7), not on the first search and not
// after dozens — the same "neither instant nor decorative" judgment
// `discovery.js`'s own depletion rate was picked against, pointed at a
// different real distribution.

'use strict';

const mainCharacters = require('./mainCharacters.js');
const missions = require('./missions.js');
const seeded = require('./seeded.js');
const tribeMissions = require('./tribeMissions.js');

const MISSION_TRIGGER_CHANCE = 0.1;

// A location already carrying an open job from its own main character
// does not get a second one stacked on top — the real, structural
// bound on this mechanism (see header). `available` and `accepted`
// are the two states a mission is still live in; `resolved`/`failed`
// free the location up again.
function hasOpenMissionAt(worldState, propertyId) {
  return (worldState.missions || []).some(
    (m) => m.location_property_id === propertyId
      && (m.status === 'available' || m.status === 'accepted'),
  );
}

// The one real entry point both `search-location` and a location-aware
// `practise-habit` call. Returns the generated mission, or `null` —
// honestly, for any of several real reasons (no such property, no
// faction holding this ground, this ground's hold has no leader yet,
// a mission here is already open, or simply the draw not landing) —
// never an error, since "nothing happened this time" is this
// mechanism's own ordinary, intended outcome.
function maybeTriggerMission(worldState, entityId, propertyId, options = {}) {
  const { tick = worldState.tick ?? 0 } = options;
  const property = (worldState.properties || []).find((p) => p.id === propertyId);
  if (!property || property.community_id == null) return null;
  if (hasOpenMissionAt(worldState, propertyId)) return null;

  const criminal = mainCharacters.criminalLeaderOf(worldState, property.community_id);
  if (!criminal || criminal.leaderId == null) return null;

  const roll = seeded.seededDraw(['mission-trigger', tick, propertyId, entityId]);
  if (roll >= MISSION_TRIGGER_CHANCE) return null;

  // Seeded on the location alone (not the tick or the visitor), same
  // reasoning `tribeMissions.js` already gives: a reward should not
  // move depending on who happened to trigger it or when.
  const spread = tribeMissions.REWARD_CEILING - tribeMissions.REWARD_FLOOR;
  const reward = tribeMissions.REWARD_FLOOR + Math.round(
    seeded.seededDraw(['mission-trigger-reward', propertyId]) * spread,
  );

  const faction = worldState.organizations.find((o) => o.id === criminal.organizationId);
  const place = property.name ?? `location ${property.id}`;
  return missions.generateMission(worldState, {
    locationId: propertyId,
    controllingFactionId: criminal.organizationId,
    objective: `Run an errand for ${faction?.name ?? 'whoever runs this block'} at ${place}`,
    reward,
  });
}

module.exports = { MISSION_TRIGGER_CHANCE, hasOpenMissionAt, maybeTriggerMission };
