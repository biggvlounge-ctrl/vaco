// server/fugitives.js
//
// By direct instruction: "the gameplay of Where in the World is
// Carmen Sandiego... it doesn't have to be for the world. It could
// just be for another town outside of that town... another city,
// another state... it doesn't have to be necessarily going to another
// country... but it can be for another country."
//
// ---------------------------------------------------------------------
// Who is a real "fugitive" here, and why no new status was invented
// ---------------------------------------------------------------------
// `justice.js`'s own real pipeline already has the exact gap this
// needs: `runJustice` charges every `cleared` incident whose area's
// regime prosecutes it, and where it does NOT (a contested area
// letting theft go, or a lawless one bringing no case at all) it
// checks whether the faction holding that ground answered instead
// (`answerByGroup`). When NEITHER happens, the incident gets a real
// `groupSanctions` row with `holder_organization_id: null` — "went
// unanswered" — and nothing in this engine has ever done anything
// else with that person since. That is the real, pre-existing,
// computed definition of "identified, and free" this file reads
// rather than duplicating with a second status field (standing rule
// 3): a cleared incident, a known living perpetrator who is not
// imprisoned, and a real `groupSanctions` row naming it unanswered.
//
// ---------------------------------------------------------------------
// Clues are real facts about the fugitive's own real current
// location, never invented
// ---------------------------------------------------------------------
// `clueFor` reads whatever real, NAMED landmark `landmarks.js` has
// actually designated in the fugitive's current real community (or,
// failing that, their city) — the same real `properties.name`/
// `landmark_category` the twenty-first standing rule's world-layer
// integration put there. There is no guessing: a community with no
// real named landmark honestly reports none, rather than inventing
// one to keep the clue flowing.
//
// ---------------------------------------------------------------------
// Scale: town, city, and "state"/"country" as honest narrative labels
// over the one real thing this engine actually has
// ---------------------------------------------------------------------
// This engine generates exactly one real region per world (the
// thirty-ninth standing rule), but real multiple cities and many real
// communities within it — so "another town" (a different real
// community) and "another city" (a different real city) are both
// real, simulated destinations a fugitive can actually flee to and a
// player can actually travel the chase across. "Another state" is the
// same real mechanism under a different narrative label for a distant
// city — there is no second real sub-region to flee to. "Another
// country" never relocates anybody: `countryPacks.js`'s own real,
// cited per-country facts are read purely as additional, honest CLUE
// FLAVOUR when the world's own real `countryKey` is set (climate,
// culture, signature exports — the same report-only posture every
// other `countryPacks.js`/`RESOURCE_PROFILES` field already holds),
// never as a claim that the fugitive left the simulated world.
//
// ---------------------------------------------------------------------
// A miss is not free — reuses `migration.relocate` directly, never a
// second movement mechanic
// ---------------------------------------------------------------------
// `attemptFlight` is the identical real `migration.relocate` call
// `runMigration` already makes for an ordinary move — a real
// destination community with a real vacant home, migration type
// `'forced'` (already real, already used for an unmet housing/safety
// need; evading apprehension is the same kind of involuntary move,
// not an eighth invented type). The chance is flagged interpretive,
// the same honest posture every other hand-fit constant in this
// engine carries where no document gives a number. Triggered only by
// a wrong `guessLocation` call — never automatically every tick —
// so this file adds no new tick-pipeline pass and changes the
// behaviour of no existing world that does not call it.
//
// ---------------------------------------------------------------------
// Capture reuses the real justice.js chain entirely
// ---------------------------------------------------------------------
// A correct guess calls `justice.judge` (against the ORIGINAL
// incident, so jurisdiction is still "where the offence happened,"
// matching that function's own real contract) and, on conviction,
// `justice.imprison` — the identical two real calls `runJustice`
// itself makes for a governed area's own cleared incident. No second
// conviction/sentencing model is invented for a manual capture.

'use strict';

const justice = require('./justice.js');
const migration = require('./migration.js');
const countryPacks = require('./countryPacks.js');
const worldStore = require('./worldStore.js');
const { seededDraw } = require('./seeded.js');

// Flagged interpretive — no document gives a real "how often does a
// free fugitive relocate" rate. Small and deliberate: most wrong
// guesses should NOT immediately scatter the trail, or the chase
// would never converge.
const FLIGHT_CHANCE = 0.35;

function isAtLarge(worldState, incident) {
  if (incident.cleared !== true) return false;
  if (incident.perpetrator_entity_id == null) return false;
  const perpetrator = (worldState.npcs || []).find((n) => n.id === incident.perpetrator_entity_id);
  if (!perpetrator || justice.isImprisoned(perpetrator)) return false;
  const alreadyCharged = (worldState.courtCases || []).some((c) => c.incident_id === incident.id);
  if (alreadyCharged) return false;
  const sanction = (worldState.groupSanctions || []).find((g) => g.incident_id === incident.id);
  return !!sanction && sanction.holder_organization_id === null;
}

function atLargeFugitives(worldState) {
  return (worldState.crimeIncidents || [])
    .filter((incident) => isAtLarge(worldState, incident))
    .map((incident) => ({
      incidentId: incident.id,
      perpetratorId: incident.perpetrator_entity_id,
      category: incident.category,
      communityId: (worldState.npcs || []).find((n) => n.id === incident.perpetrator_entity_id)
        ?.communityId ?? null,
    }));
}

// A real, named landmark in the fugitive's own current real
// community, falling back to their city, or honestly null.
function landmarkClueFor(worldState, communityId) {
  const community = (worldState.communities || []).find((c) => c.id === communityId) ?? null;
  const inCommunity = (worldState.properties || []).find(
    (p) => p.community_id === communityId && p.landmark_category && p.name,
  );
  if (inCommunity) return { scope: 'town', name: inCommunity.name, category: inCommunity.landmark_category };

  if (community?.city_id != null) {
    const inCity = (worldState.properties || []).find(
      (p) => p.city_id === community.city_id && p.landmark_category && p.name,
    );
    if (inCity) return { scope: 'city', name: inCity.name, category: inCity.landmark_category };
  }
  return null;
}

// Real, report-only country flavour -- never a claim the fugitive
// left the simulated region. `countryKey` is whatever
// `migration.generateRegion` was given; a world with none gets none.
function countryFlavorFor(worldState) {
  const region = (worldState.regions || [])[0] ?? null;
  if (!region?.countryKey) return null;
  const profile = countryPacks.resourceProfileFor(region.countryKey);
  if (!profile) return null;
  return { country: profile.country, knownFor: profile.knownFor };
}

// Keyed on the real incident/case id rather than the perpetrator's own
// entity id -- the player has a case to chase, not a name to look up;
// resolving the perpetrator internally keeps the API honest about
// what a player actually starts a chase holding.
function clueForIncident(worldState, incidentId) {
  const incident = (worldState.crimeIncidents || []).find((i) => i.id === Number(incidentId));
  if (!incident) throw new Error(`clueForIncident: no crime incident with id ${incidentId}.`);
  if (!isAtLarge(worldState, incident)) {
    throw new Error(`clueForIncident: incident ${incidentId} has no real at-large fugitive to chase.`);
  }
  return clueFor(worldState, incident.perpetrator_entity_id);
}

function clueFor(worldState, perpetratorId) {
  const perpetrator = (worldState.npcs || []).find((n) => n.id === perpetratorId);
  if (!perpetrator) throw new Error(`fugitives.clueFor: no entity ${perpetratorId}.`);
  if (perpetrator.communityId == null) {
    return { landmark: null, countryFlavor: countryFlavorFor(worldState) };
  }
  return {
    landmark: landmarkClueFor(worldState, perpetrator.communityId),
    countryFlavor: countryFlavorFor(worldState),
  };
}

// A real, bounded chance to flee to a different real community with
// a real vacant home -- the identical `migration.relocate` an
// ordinary move already uses. No real vacancy anywhere means no move,
// honestly, rather than inventing a destination.
function attemptFlight(worldState, perpetratorId, options = {}) {
  const { tick = worldState.tick ?? 0, seed = worldState.seed ?? 'fugitives' } = options;
  const perpetrator = (worldState.npcs || []).find((n) => n.id === perpetratorId);
  if (!perpetrator) throw new Error(`fugitives.attemptFlight: no entity ${perpetratorId}.`);

  if (seededDraw([seed, 'flee', perpetratorId, tick]) >= FLIGHT_CHANCE) {
    return { fled: false };
  }

  const vacancies = migration.vacanciesByCommunity(worldState);
  const candidates = [...vacancies.entries()]
    .filter(([communityId, homes]) => communityId !== perpetrator.communityId && homes.length > 0);
  if (candidates.length === 0) return { fled: false, reason: 'no real vacancy anywhere else' };

  const pick = Math.floor(seededDraw([seed, 'flee-destination', perpetratorId, tick]) * candidates.length);
  const [toCommunityId, homes] = candidates[Math.min(pick, candidates.length - 1)];
  const toPropertyId = homes[0];

  migration.relocate(worldState, {
    entityId: perpetratorId,
    toCommunityId,
    toPropertyId,
    migrationType: 'forced',
    reason: 'evading apprehension',
    tick,
  });
  return { fled: true, toCommunityId };
}

// The chase's one real decision point. `communityIdGuess` is the
// player's answer; correct catches them through the real
// justice.js chain, wrong gives them one real, bounded chance to run
// again.
function guessLocation(worldState, guesserEntityId, incidentId, communityIdGuess, options = {}) {
  const { tick = worldState.tick ?? 0 } = options;
  const incident = (worldState.crimeIncidents || []).find((i) => i.id === Number(incidentId));
  if (!incident) throw new Error(`guessLocation: no crime incident with id ${incidentId}.`);
  if (!isAtLarge(worldState, incident)) {
    throw new Error(`guessLocation: incident ${incidentId} has no real at-large fugitive to chase.`);
  }

  const perpetrator = (worldState.npcs || []).find((n) => n.id === incident.perpetrator_entity_id);
  const correct = perpetrator.communityId === Number(communityIdGuess);

  if (!correct) {
    const flight = attemptFlight(worldState, perpetrator.id, { tick });
    return { caught: false, correct: false, ...flight };
  }

  const caseRow = justice.judge(worldState, { incident, tick });
  if (caseRow && caseRow.status === 'convicted') {
    justice.imprison(worldState, caseRow, { tick });
  }
  return { caught: true, correct: true, case: caseRow };
}

// ---------------------------------------------------------------------
// Not every search is a chase — by direct instruction: "it doesn't
// necessarily have to be a fugitive too. It could just be somebody
// trying to find somebody, or locate an area, or locate a family
// member."
// ---------------------------------------------------------------------
// "Locate an area" already has a real answer and needed no new code
// here: `discovery.js`'s `search-location` player verb is exactly
// that. What did not exist is locating a real PERSON who is not a
// criminal — a family member or contact you have simply lost touch
// with, reusing `clueFor`'s identical real landmark-clue mechanism
// over ANY real relationship (`worldStore.findRelationship`), not
// only `characterCreation.js`'s own extended family.
//
// **Deliberately does NOT reuse `attemptFlight` on a wrong guess.**
// A fugitive has a real, rational reason to run once a pursuer gets
// close — they know they are being hunted. An ordinary family member
// or contact does not; they are simply living their life, and any
// real movement they make is `migration.runMigration`'s own,
// completely unrelated business. Calling `attemptFlight` here would
// silently give every missing-relation search the exact same
// evasive-fugitive behaviour the request never asked for. A wrong
// guess here costs the searcher nothing but a try — the real,
// honest shape of "you guessed wrong, look again."

function missingRelationsOf(worldState, searcherEntityId) {
  const searcher = (worldState.npcs || []).find((n) => n.id === Number(searcherEntityId));
  if (!searcher) throw new Error(`missingRelationsOf: no entity ${searcherEntityId}.`);

  const relatedIds = new Set();
  for (const relationship of worldState.relationships || []) {
    if (relationship.entity_a_id === searcher.id) relatedIds.add(relationship.entity_b_id);
    else if (relationship.entity_b_id === searcher.id) relatedIds.add(relationship.entity_a_id);
  }

  return (worldState.npcs || [])
    .filter((n) => relatedIds.has(n.id) && n.status === 'active' && n.communityId !== searcher.communityId)
    .map((n) => ({ entityId: n.id }));
}

function guessMissingRelationLocation(worldState, searcherEntityId, targetEntityId, communityIdGuess) {
  const target = (worldState.npcs || []).find((n) => n.id === Number(targetEntityId));
  if (!target || target.status !== 'active') {
    throw new Error(`guessMissingRelationLocation: no living entity ${targetEntityId}.`);
  }
  const relationship = worldStore.findRelationship(worldState, Number(searcherEntityId), target.id);
  if (!relationship) {
    throw new Error(
      `guessMissingRelationLocation: entity ${searcherEntityId} has no real relationship `
      + `with ${targetEntityId} to search for them over.`,
    );
  }
  const correct = target.communityId === Number(communityIdGuess);
  return { found: correct, correct };
}

module.exports = {
  FLIGHT_CHANCE,
  isAtLarge,
  atLargeFugitives,
  landmarkClueFor,
  countryFlavorFor,
  clueFor,
  clueForIncident,
  attemptFlight,
  guessLocation,
  missingRelationsOf,
  guessMissingRelationLocation,
};
