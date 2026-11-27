// server/objectives.js
//
// Task #106 — "a real, large objectives/checklist system (hundreds of
// concrete things to do)." Never a second, invented quest list: every
// entry here is one real action (`actions.js`'s own `ACTIONS`
// registry) aimed at one real, currently-existing target already in
// `worldState` — the same "generic action dispatcher, routes to what
// exists" discipline `actions.js`'s own header states for the
// dispatcher itself, applied one level up, to the LIST of what a
// player could aim it at.
//
// Deliberately narrow to the action types whose real validity is
// fully captured by "the target exists (and, where the real verb
// itself checks more, by that same real check, reused rather than
// duplicated)":
//
//   - `talk-to` / `ask-around` — any other real, living NPC
//     (`worldState.npcs` already excludes the dead, the convention
//     every mortality-aware reader in this engine already holds).
//     `discovery.searchableIn`'s own real, already-built, per-
//     community candidate pool ("everywhere in this area still worth
//     searching"), reused directly across every real community rather
//     than a second copy of its filter, so an objective here can
//     never be one `discovery.search` would immediately refuse.
//   - `accept-mission` — `engine.availableMissions`'s own real list,
//     not a second filter over `worldState.missions`.
//   - `consult-heist` — a pure, non-mutating read (task #104's own
//     header) against every real organization, but ONLY once the
//     player's own linked entity genuinely holds a real organization
//     or family membership to consult AS — `heists.js
//     #consultBeforeHeist` throws without exactly one of
//     `organizationId`/`familyId`, so a player with neither gets
//     none of these objectives rather than one that would error on
//     the first click.
//
// Every other registered action needs a real domain-specific validity
// check this module does not duplicate — `attempt-heist` needs a crew
// and a real asset threshold `heists.js` already owns;
// `attempt-takeover` needs `control.viableTargetsFor`'s own
// composition math. Rather than guess at validity for those (and risk
// listing "concrete things to do" that are not actually doable),
// this stays to the five where "the target exists" genuinely IS the
// real validity bar — the real dispatcher is still what decides
// whether attempting any of these actually works.
//
// "Hundreds" is not a hand-written list — it is what these five,
// crossed with a real, populated world, actually produce: every other
// living person is a real `talk-to`/`ask-around` target, every real
// searchable property a `search-location` target. A fresh, empty
// world correctly returns few or none; this reports that honestly
// rather than padding it.

'use strict';

const discovery = require('./discovery.js');
const missions = require('./missions.js');

const DEFAULT_LIMIT = 500;

function talkAndAskObjectives(worldState, selfId) {
  const objectives = [];
  (worldState.npcs || []).forEach((n) => {
    if (n.id === selfId) return;
    const who = n.name || `entity ${n.id}`;
    objectives.push({
      action: 'talk-to', label: `Talk to ${who}`, params: { npcEntityId: n.id },
    });
    objectives.push({
      action: 'ask-around', label: `Ask around about ${who}`, params: { subjectEntityId: n.id },
    });
  });
  return objectives;
}

// Reuses `discovery.searchableIn` directly — "everywhere in this area
// still worth searching," the exact real per-community candidate pool
// this engine already built and already tests — rather than a second
// copy of its own `landmark_category`/`poolFor`/`remainingAt` filter.
// Run once per real community actually present, not just the player's
// own, since `objectivesFor` is a world-wide checklist, not a local
// one (that narrower, location-aware read is `searchableIn` itself,
// still there for any caller that wants it).
function searchObjectives(worldState) {
  const communityIds = [...new Set(
    (worldState.properties || []).map((p) => p.community_id).filter((id) => id != null),
  )];
  return communityIds
    .flatMap((id) => discovery.searchableIn(worldState, id))
    .map((p) => ({
      action: 'search-location',
      label: `Search ${p.name || `property ${p.id}`}`,
      params: { propertyId: p.id },
    }));
}

function missionObjectives(worldState) {
  return missions.listMissions(worldState, { status: 'available' }).map((m) => ({
    action: 'accept-mission',
    label: `Accept: ${m.objective || `mission ${m.id}`}`,
    params: { missionId: m.id },
  }));
}

// Real sponsor context for `consult-heist` — exactly one of
// `organizationId`/`familyId`, read from the player's own real
// membership rows, never invented. Returns `null` when the player
// holds neither, which is the honest "no real sponsor to consult as"
// case this engine's own discipline treats as nothing rather than a
// guess (the same shape task #102's Combat-skill-has-no-field case
// holds).
function sponsorContextFor(worldState, selfId) {
  const orgMembership = (worldState.entityOrganizationMemberships || [])
    .find((m) => m.entity_id === selfId);
  if (orgMembership) return { organizationId: orgMembership.organization_id, familyId: null };
  const familyMembership = (worldState.familyMemberships || [])
    .find((m) => m.entity_id === selfId);
  if (familyMembership) return { organizationId: null, familyId: familyMembership.family_id };
  return null;
}

function consultHeistObjectives(worldState, selfId) {
  const sponsor = sponsorContextFor(worldState, selfId);
  if (!sponsor) return [];
  return (worldState.organizations || []).map((o) => ({
    action: 'consult-heist',
    label: `Consult before a heist on ${o.name || `organization ${o.id}`}`,
    params: { ...sponsor, targetOrganizationId: o.id },
  }));
}

// The real, computed-live checklist — never stored, same posture
// `tutorialMissions.tutorialProgressFor` already holds for "where am
// I in this": asked fresh every call, off real world state, never a
// cached flag that could drift from it. Takes the real ENTITY id, not
// a player id — the same shape `tutorialProgressFor`/`savedLocationsOf`
// already hold, with the player → entity lookup done once in
// `server.js`, not duplicated here.
function objectivesFor(worldState, selfId, options = {}) {
  const limit = options.limit ?? DEFAULT_LIMIT;
  if (!(worldState.npcs || []).some((n) => n.id === selfId)) {
    throw new Error(`objectivesFor: no entity with id ${selfId}`);
  }

  const objectives = [
    ...talkAndAskObjectives(worldState, selfId),
    ...searchObjectives(worldState),
    ...missionObjectives(worldState),
    ...consultHeistObjectives(worldState, selfId),
  ];

  return { total: objectives.length, objectives: objectives.slice(0, limit) };
}

module.exports = {
  DEFAULT_LIMIT,
  sponsorContextFor,
  objectivesFor,
};
