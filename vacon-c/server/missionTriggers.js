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
// Criminal, political, religious, and business — all four now, through
// two different real mission fields
// ---------------------------------------------------------------------
//
// `missions.generateMission`'s own `controllingFactionId` validation
// requires `organizations.isFaction === true` — a real gang/faction,
// never a government, religious order or business. That is the
// schema's own distinction, not one invented here: `controlling_
// faction_id` means a faction genuinely controls this ground by force,
// which is true of a criminal hold and not of a government seat, a
// religious order, or a shop.
//
// The other three categories are not locked out by that — they are
// routed through a DIFFERENT real field instead.
// `leadership.js#directMission` already established the shape a real,
// non-faction organization needs to stand behind a mission: generate
// it with no `controllingFactionId` at all, then set
// `mission.issuing_organization_id`/`.issued_by_entity_id` directly,
// the same in-memory-only pair that file already writes (no schema
// column exists for either — `migrate.js`'s own `missions` INSERT
// does not name them, the identical "real field, no persistence yet"
// posture this file's own `city.healthBaseline`-class fields already
// hold elsewhere in this registry). Reused here rather than inventing
// a second convention for the identical real situation: a real
// organization is behind this job, and it is not a faction.
//
// `mainCharacters.mainCharactersOf` already resolves all four
// categories per community; `maybeTriggerMission` checks them in that
// function's own listed order (criminal, political, religious,
// business) and uses the first one with a real, installed leader. One
// combined roll decides whether a mission triggers at all — the
// overall rate is unchanged from the criminal-only version — so
// opening this to four categories widens WHO a job can come from
// without widening HOW OFTEN one appears.
//
// ---------------------------------------------------------------------
// A found, honest limitation, not a guess papered over
// ---------------------------------------------------------------------
//
// **On a freshly generated, never-ticked world, this almost never
// fires for three of the four categories** — checked directly before
// calibrating anything, the seventeenth standing rule's own
// discipline. `organizations.leader_id` is written at generation for
// nothing worldgen creates except the religious-order archetype (the
// forty-eighth standing rule's documented gap) — a gang's `leader_id`
// is written only by `control.js#seize`, itself only ever called from
// the real `attempt-takeover` player verb; a government's and a
// business's are written only by a real election or takeover
// equivalent, neither of which runs automatically from the tick
// pipeline either. Measured directly: a 6-community, 240-resident
// generated world produced `authority.holderOf()` holders in several
// communities and `leader_id` set on NONE of them. So the real
// sequence criminal, political, and business missions reward is: a
// real faction takes real ground, a real government seat or business
// changes real hands (whichever mechanism each already has), and ONLY
// THEN does visiting that ground start offering jobs from whoever just
// took it. Religious missions are the one category reachable from a
// freshly generated world, because that archetype alone installs a
// real founding leader immediately — not a bug in the other three,
// the honest shape of what each category's own leadership mechanism
// actually is.
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

// Checked in this fixed order — the same order `mainCharacters
// .mainCharactersOf` itself lists its four fields in — so a location
// with more than one real, led category still produces exactly one
// mission from exactly one of them, deterministically, never a
// surprise pick that changes between two reads of the same world.
const CATEGORY_ORDER = ['criminal', 'political', 'religious', 'business'];

// One line of real flavor text per category. `org` is the real
// organization behind the job, or `null` when `mainCharacters` found a
// leader but this lookup somehow misses the organization row (should
// not happen against real state, handled the same honest way a
// missing name is handled everywhere else in this file).
const OBJECTIVE_BY_CATEGORY = {
  criminal: (org, place) => `Run an errand for ${org?.name ?? 'whoever runs this block'} at ${place}`,
  political: (org, place) => `Handle a constituent matter for ${org?.name ?? 'the local government'} at ${place}`,
  religious: (org, place) => `Do a favor for ${org?.name ?? 'the local religious order'} at ${place}`,
  business: (org, place) => `Pick up some work for ${org?.name ?? 'whoever runs this place'} at ${place}`,
};

// The one real entry point both `search-location` and a location-aware
// `practise-habit` call. Returns the generated mission, or `null` —
// honestly, for any of several real reasons (no such property, no
// category with a real, installed leader controls this ground, a
// mission here is already open, or simply the draw not landing) —
// never an error, since "nothing happened this time" is this
// mechanism's own ordinary, intended outcome.
function maybeTriggerMission(worldState, entityId, propertyId, options = {}) {
  const { tick = worldState.tick ?? 0 } = options;
  const property = (worldState.properties || []).find((p) => p.id === propertyId);
  if (!property || property.community_id == null) return null;
  if (hasOpenMissionAt(worldState, propertyId)) return null;

  const characters = mainCharacters.mainCharactersOf(worldState, property.community_id);
  if (!characters) return null;

  let category = null;
  let leader = null;
  for (const candidate of CATEGORY_ORDER) {
    const found = characters[candidate];
    if (found && found.leaderId != null) {
      category = candidate;
      leader = found;
      break;
    }
  }
  if (!category) return null;

  const roll = seeded.seededDraw(['mission-trigger', tick, propertyId, entityId]);
  if (roll >= MISSION_TRIGGER_CHANCE) return null;

  // Seeded on the location alone (not the tick or the visitor), same
  // reasoning `tribeMissions.js` already gives: a reward should not
  // move depending on who happened to trigger it or when.
  const spread = tribeMissions.REWARD_CEILING - tribeMissions.REWARD_FLOOR;
  const reward = tribeMissions.REWARD_FLOOR + Math.round(
    seeded.seededDraw(['mission-trigger-reward', propertyId]) * spread,
  );

  const organization = worldState.organizations.find((o) => o.id === leader.organizationId);
  const place = property.name ?? `location ${property.id}`;
  const objective = OBJECTIVE_BY_CATEGORY[category](organization, place);

  const missionOptions = { locationId: propertyId, objective, reward };
  // Only a real faction can be a `controllingFactionId` — see this
  // file's own header. The other three categories route the real
  // organization behind the job through `issuing_organization_id`/
  // `issued_by_entity_id` instead, the same in-memory-only pair
  // `leadership.js#directMission` already established for exactly this
  // shape, reused rather than duplicated.
  if (category === 'criminal') {
    missionOptions.controllingFactionId = leader.organizationId;
  }
  const mission = missions.generateMission(worldState, missionOptions);
  if (category !== 'criminal') {
    mission.issuing_organization_id = leader.organizationId;
    mission.issued_by_entity_id = leader.leaderId;
  }
  return mission;
}

module.exports = {
  MISSION_TRIGGER_CHANCE, CATEGORY_ORDER, hasOpenMissionAt, maybeTriggerMission,
};
