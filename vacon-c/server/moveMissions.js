// server/moveMissions.js
//
// Event-triggered mission generation — task #98, "NPCs/orgs making a
// move." `missionTriggers.js` already covers the mirror case (a
// PLAYER visits real ground and a mission triggers from whoever
// already holds it); this is the other half, never built: a real
// ORG does something consequential on its own, independent of
// whether any player is anywhere near it, and a mission appears
// reacting to that specific move.
//
// ---------------------------------------------------------------------
// Opt-in, the same posture every additive tick-time mechanism in this
// registry already holds
// ---------------------------------------------------------------------
// `tick.js#advanceTick` only calls `runMoveMissions` when its own
// `options.eventTriggeredMissions` is truthy; `engine.js#advanceTick()`
// forwards `WorldState.eventTriggeredMissions` through automatically,
// unset by every existing caller — so a world that never opts in
// generates byte-for-byte identically to before this file existed.
//
// ---------------------------------------------------------------------
// The real substrate — `worldState.events`, not a second log
// ---------------------------------------------------------------------
// `tick.js#runEventPhase` already resolves and stores a real
// `community_id`/`city_id` on every tick-level event via `events.
// locationOfEvent` before this file ever sees it — so no location
// logic is duplicated here, only read. Three real event `type`s are
// curated as "a move," each already carrying a real organization id
// as the first entry of its own `affected_entity_ids`, confirmed by
// reading each push site directly rather than assumed:
//
//   - `dominant_power_claims_ground` (dominance.js, via tick.js) — a
//     real pre-existing local power converts into a territorial claim.
//   - `territory_status_change` (tick.js) — a real territory block's
//     control resolution actually moved it to a new status.
//   - `rogue_security_force_formed` (roguePolice.js, via tick.js) — a
//     real government organization's own officers defect and found a
//     new one.
//
// **Deliberately excluded, and named rather than silently left out.**
// `takeover_unlocked` (control.js) names a real HIRED INDIVIDUAL in
// `affected_entity_ids`, not an organization — its own `global_effects
// .tribeId` names a FAMILY, and `missions.generateMission`'s real
// `controllingFactionId` validation requires an `organizations` row
// with `isFaction`, which a family is never going to be. Folding a
// family in here would mean either inventing a second mission field
// this schema does not have, or silently mislabeling a family as an
// organization — worse than leaving the gap named. `chaos_recruitment`
// /`chaos_family_absorption` (recruitment.js) write to
// `worldStore.addHistoricalRecord` directly, a different real table
// with no `community_id`/`city_id` resolution step at all — merging
// two differently-shaped real logs into one reader would be exactly
// the "two disagreeing answers" the third standing rule warns against,
// so this file reads the one tick-level log, not both.
//
// ---------------------------------------------------------------------
// Reused, not reinvented — the exact `missionTriggers.js` conventions
// ---------------------------------------------------------------------
// `missionTriggers.MISSION_TRIGGER_CHANCE` (0.1, that file's own
// measured "neither instant nor decorative" rate) and `hasOpenMissionAt`
// are reused unchanged — a second, disagreeing rate or a second
// "already has a job" check would be the exact mistake the third
// standing rule exists to prevent. `tribeMissions.REWARD_FLOOR`/
// `REWARD_CEILING` supply the real reward range the same way. A real
// faction organization becomes `controllingFactionId`; any other real
// organization (a government that just lost officers to a rogue
// force, for instance) is attached via `issuing_organization_id`
// instead — the identical non-faction convention `missionTriggers.js`/
// `leadership.js#directMission` already established for "a real
// organization is behind this job, and it is not a faction."
//
// A property is picked deterministically from the real properties in
// the event's own community, seeded on the event's own id (never the
// tick or who happens to be nearby) — the same "a reward should not
// move depending on who triggered it or when" reasoning `tribeMissions
// .js` already gives, applied to location choice instead of payout.

'use strict';

const missions = require('./missions.js');
const missionTriggers = require('./missionTriggers.js');
const tribeMissions = require('./tribeMissions.js');
const seeded = require('./seeded.js');

const TRIGGERING_TYPES = [
  'dominant_power_claims_ground', 'territory_status_change', 'rogue_security_force_formed',
];

function organizationIdFor(event) {
  const [first] = event.affected_entity_ids || [];
  return first ?? null;
}

// A real property in this community, picked deterministically on the
// event's own id — never the tick, never who happens to be nearby.
function propertyIn(worldState, communityId, seedParts) {
  const candidates = (worldState.properties || []).filter((p) => p.community_id === communityId);
  if (candidates.length === 0) return null;
  const index = Math.min(
    candidates.length - 1,
    Math.floor(seeded.seededDraw(seedParts) * candidates.length),
  );
  return candidates[index];
}

const OBJECTIVE_BY_TYPE = {
  dominant_power_claims_ground: (org, place) => `${org?.name ?? 'A real local power'} just converted its hold on the area into a territorial claim near ${place}. Get out ahead of it.`,
  territory_status_change: (org, place) => `Territory near ${place} just changed hands. See what ${org?.name ?? 'whoever holds it now'} actually wants with it.`,
  rogue_security_force_formed: (org, place) => `A rogue security force, ${org?.name ?? 'newly formed'}, just stood up near ${place}. Find out what they are really doing.`,
};

// The one real entry point — called once per tick with that tick's
// own freshly-stored `events` rows (never the whole world's history),
// so an org's move only ever gets one chance to trigger a mission, the
// tick it actually happened.
function runMoveMissions(worldState, storedEvents, tick = worldState.tick ?? 0) {
  const generated = [];
  for (const event of storedEvents || []) {
    if (!TRIGGERING_TYPES.includes(event.type)) continue;
    if (event.community_id == null) continue;

    const organization = (worldState.organizations || [])
      .find((o) => o.id === organizationIdFor(event)) ?? null;
    if (!organization) continue;

    const property = propertyIn(worldState, event.community_id, ['move-mission-location', event.id]);
    if (!property) continue;
    if (missionTriggers.hasOpenMissionAt(worldState, property.id)) continue;

    const roll = seeded.seededDraw(['move-mission-trigger', event.id]);
    if (roll >= missionTriggers.MISSION_TRIGGER_CHANCE) continue;

    const spread = tribeMissions.REWARD_CEILING - tribeMissions.REWARD_FLOOR;
    const reward = tribeMissions.REWARD_FLOOR + Math.round(
      seeded.seededDraw(['move-mission-reward', property.id]) * spread,
    );

    const place = property.name ?? `location ${property.id}`;
    const objective = OBJECTIVE_BY_TYPE[event.type](organization, place);

    const missionOptions = { locationId: property.id, objective, reward };
    if (organization.isFaction) {
      missionOptions.controllingFactionId = organization.id;
    }
    const mission = missions.generateMission(worldState, missionOptions);
    if (!organization.isFaction) {
      mission.issuing_organization_id = organization.id;
    }
    generated.push(mission);
  }
  return generated;
}

module.exports = {
  TRIGGERING_TYPES, organizationIdFor, propertyIn, runMoveMissions,
};
