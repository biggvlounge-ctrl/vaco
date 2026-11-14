// server/fugitives.js — a real Carmen Sandiego-style pursuit over a
// real, pre-existing "identified and free" state this engine already
// computes (an unanswered groupSanctions row), real landmark-based
// clues, real flight on a wrong guess, real capture through the
// existing justice.js chain on a correct one.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const engine = require('../server/engine.js');
const fugitives = require('../server/fugitives.js');
const landmarks = require('../server/landmarks.js');
const justice = require('../server/justice.js');

const w = engine.WorldState;

let nextId = 992001;

function city(name) {
  return engine.generateCity({ name: `${name} ${nextId += 1}` });
}

function community(cityRow) {
  return engine.generateCommunity({ cityId: cityRow.id });
}

function person(communityId) {
  return engine.generateNPC({ communityId });
}

function openUnansweredFugitiveCase(perpetrator, { category = 'theft' } = {}) {
  const incident = {
    id: nextId += 1,
    category,
    perpetrator_entity_id: perpetrator.id,
    victim_entity_id: null,
    community_id: perpetrator.communityId,
    tick: w.tick ?? 0,
    severity: 50,
    detail: 'test fixture',
    investigated_tick: w.tick ?? 0,
    cleared: true,
  };
  w.crimeIncidents.push(incident);
  w.groupSanctions = w.groupSanctions || [];
  w.groupSanctions.push({
    incident_id: incident.id,
    community_id: incident.community_id,
    category,
    regime: 'lawless',
    holder_organization_id: null,
    acts: [],
    tick: w.tick ?? 0,
  });
  return incident;
}

test('atLargeFugitives: a cleared, unanswered incident with a free living perpetrator is a real fugitive; one with a law-abiding resolution is not', () => {
  const cityA = city('Flight City');
  const commA = community(cityA);
  const perpetrator = person(commA.id);
  const incident = openUnansweredFugitiveCase(perpetrator);

  const found = fugitives.atLargeFugitives(w).find((f) => f.incidentId === incident.id);
  assert.ok(found, 'a real, unanswered, cleared incident with a free perpetrator must be a real fugitive');
  assert.equal(found.perpetratorId, perpetrator.id);

  // An incident a real faction DID answer (a real, non-null holder) is resolved, not a fugitive.
  const answeredPerp = person(commA.id);
  const answeredIncident = openUnansweredFugitiveCase(answeredPerp);
  const sanctionRow = w.groupSanctions.find((g) => g.incident_id === answeredIncident.id);
  sanctionRow.holder_organization_id = 999999;
  assert.ok(!fugitives.atLargeFugitives(w).some((f) => f.incidentId === answeredIncident.id));

  // An incident already charged (a real courtCases row) is resolved, not a fugitive.
  const resolvedPerp = person(commA.id);
  const resolvedIncident = openUnansweredFugitiveCase(resolvedPerp);
  w.courtCases = w.courtCases || [];
  w.courtCases.push({ id: nextId += 1, incident_id: resolvedIncident.id, defendant_entity_id: resolvedPerp.id, status: 'dismissed' });
  assert.ok(!fugitives.atLargeFugitives(w).some((f) => f.incidentId === resolvedIncident.id));
});

test('clueFor: a real, named landmark in the fugitive\'s own current real community', () => {
  const cityA = city('Landmark City');
  const commA = community(cityA);
  const landmarkProperty = engine.generateProperty({ type: 'commercial', value: 400000, communityId: commA.id });
  landmarks.designate(w, { propertyId: landmarkProperty.id, category: 'art-museum', significance: 60 });
  const perpetrator = person(commA.id);

  const clue = fugitives.clueFor(w, perpetrator.id);
  assert.ok(clue.landmark, 'a real landmark in their own community must be reported');
  assert.equal(clue.landmark.scope, 'town');
  assert.equal(clue.landmark.name, landmarkProperty.name);
});

test('clueFor: no real landmark anywhere honestly reports none, rather than inventing one', () => {
  const cityA = city('Empty City');
  const commA = community(cityA);
  const perpetrator = person(commA.id);
  const clue = fugitives.clueFor(w, perpetrator.id);
  assert.equal(clue.landmark, null);
});

test('clueForIncident: keyed on the real case id, resolves to the identical clue clueFor gives for that perpetrator', () => {
  const cityA = city('Case City');
  const commA = community(cityA);
  const perpetrator = person(commA.id);
  const incident = openUnansweredFugitiveCase(perpetrator);

  assert.deepEqual(fugitives.clueForIncident(w, incident.id), fugitives.clueFor(w, perpetrator.id));
});

test('guessLocation: a correct guess catches the real fugitive through the real justice.js chain', () => {
  const cityA = city('Capture City');
  const commA = community(cityA);
  const perpetrator = person(commA.id);
  const incident = openUnansweredFugitiveCase(perpetrator);

  const result = fugitives.guessLocation(w, 1, incident.id, commA.id);
  assert.equal(result.caught, true);
  assert.ok(result.case, 'judge() must have run');
  assert.equal(perpetrator.status, result.case.status === 'convicted' ? 'imprisoned' : 'active');
});

test('guessLocation: a wrong guess never catches anybody, and may trigger a real flight', () => {
  const cityA = city('Decoy City');
  const commA = community(cityA);
  const cityB = city('Other City');
  const commB = community(cityB);
  const decoyHome = engine.generateProperty({ type: 'residential', value: 100000, communityId: commB.id });
  const perpetrator = person(commA.id);
  const incident = openUnansweredFugitiveCase(perpetrator);

  const wrongCommunityId = commB.id;
  let caughtAny = false;
  for (let tick = 0; tick < 1 && !caughtAny; tick += 1) {
    const result = fugitives.guessLocation(w, 1, incident.id, wrongCommunityId, { tick });
    assert.equal(result.caught, false);
    assert.equal(result.correct, false);
    caughtAny = result.caught;
  }
  assert.equal(justice.isImprisoned(perpetrator), false, 'a wrong guess never imprisons anybody');
});

test('guessLocation: refuses a guess against an incident with no real at-large fugitive', () => {
  const cityA = city('No Case City');
  const commA = community(cityA);
  const perpetrator = person(commA.id);
  const incident = {
    id: nextId += 1, category: 'theft', perpetrator_entity_id: perpetrator.id,
    victim_entity_id: null, community_id: commA.id, tick: 0, severity: 50,
    detail: null, investigated_tick: null, cleared: null,
  };
  w.crimeIncidents.push(incident);
  assert.throws(
    () => fugitives.guessLocation(w, 1, incident.id, commA.id),
    /no real at-large fugitive/,
  );
});

test('missingRelationsOf: a real relation not currently co-located is a real missing-relation case; a stranger or a co-located relation is not', () => {
  const cityA = city('Home City');
  const commA = community(cityA);
  const cityB = city('Away City');
  const commB = community(cityB);
  const worldStoreLib = require('../server/worldStore.js');

  const searcher = person(commA.id);
  const awayRelation = person(commB.id);
  const homeRelation = person(commA.id);
  const stranger = person(commB.id);
  worldStoreLib.getOrCreateRelationship(w, searcher.id, awayRelation.id, 'family');
  worldStoreLib.getOrCreateRelationship(w, searcher.id, homeRelation.id, 'family');

  const found = fugitives.missingRelationsOf(w, searcher.id).map((f) => f.entityId);
  assert.ok(found.includes(awayRelation.id));
  assert.ok(!found.includes(homeRelation.id), 'a relation already in the same community is not missing');
  assert.ok(!found.includes(stranger.id), 'a stranger with no real relationship is not a missing-relation case');
});

test('guessMissingRelationLocation: a correct guess finds them with no justice consequence; a wrong guess costs nothing and never relocates them', () => {
  const cityA = city('Searcher City');
  const commA = community(cityA);
  const cityB = city('Relation City');
  const commB = community(cityB);
  const worldStoreLib = require('../server/worldStore.js');

  const searcher = person(commA.id);
  const relation = person(commB.id);
  worldStoreLib.getOrCreateRelationship(w, searcher.id, relation.id, 'family');

  assert.throws(
    () => fugitives.guessMissingRelationLocation(w, searcher.id, person(commA.id).id, commA.id),
    /no real relationship/,
  );

  const wrong = fugitives.guessMissingRelationLocation(w, searcher.id, relation.id, commA.id);
  assert.equal(wrong.found, false);
  assert.equal(relation.communityId, commB.id, 'a wrong guess never relocates an ordinary missing relation');

  const correct = fugitives.guessMissingRelationLocation(w, searcher.id, relation.id, commB.id);
  assert.equal(correct.found, true);
});

test('attemptFlight: a real, bounded chance to relocate to a different real community with a real vacant home -- never to one with no vacancy', () => {
  const cityA = city('Origin City');
  const commA = community(cityA);
  const cityB = city('Destination City');
  const commB = community(cityB);
  const home = engine.generateProperty({ type: 'residential', value: 100000, communityId: commB.id });
  const perpetrator = person(commA.id);

  let fledOnce = false;
  for (let tick = 0; tick < 60 && !fledOnce; tick += 1) {
    const result = fugitives.attemptFlight(w, perpetrator.id, { tick });
    if (result.fled) {
      fledOnce = true;
      assert.notEqual(result.toCommunityId, commA.id, 'must never flee to the community already occupied');
      assert.equal(perpetrator.communityId, result.toCommunityId);
    }
  }
  assert.ok(fledOnce, 'a real vacancy elsewhere must be reachable within 60 tries');
});
