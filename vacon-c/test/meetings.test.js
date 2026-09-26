// Sitting down together — a conversation, a meeting, a sit-down, a
// planning session.
//
// ---------------------------------------------------------------------
// What this closes
//
// `negotiate` is in the spec's NPC vocabulary three separate times, and
// `teach`, `recruit` and `form alliance` once each. §"NPCs remember
// favors, betrayals, conversations, victories, losses" makes a
// conversation a thing that is remembered. `grep -rn
// "negotiate\|meeting" server/` returned NOTHING before
// `server/meetings.js` — five verbs about two or more people doing
// something together, absent from a simulation whose entire subject is
// people.
//
// ---------------------------------------------------------------------
// It invents no modifier, and that is the design
//
// The obvious build would be a "planning bonus" on a takeover's success
// probability: a number nobody chose, bolted onto a resolution whose
// every term is traceable. It is not needed, because the loop already
// exists — a meeting moves the trust between the people at it,
// `familyTraits.unityTarget` IS the mean trust between a family's
// members, `advanceCohesion` converges unity on it, and `cohesionOf` is
// the takeover key's multiplier. A tribe that sits down together really
// does take a building more easily, through four systems each built for
// its own reasons. The test at the bottom holds that chain.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const meetings = require('../server/meetings.js');
const familyTraits = require('../server/familyTraits.js');
const control = require('../server/control.js');
const knowledge = require('../server/knowledge.js');
const engine = require('../server/engine.js');
const actions = require('../server/actions.js');
const worldStore = require('../server/worldStore.js');
const { getTraitId } = require('../server/traitDefinitions.js');

const YEAR = 365;

// Constructed, not generated (standing rule 8): every assertion is
// about a specific trust value or a specific person at the table.
function room(options = {}) {
  const { people = 3, tick = 10000 } = options;
  const w = {
    tick,
    seed: 'meetings-test',
    npcs: [],
    communities: [{ id: 400, city_id: 900 }],
    cities: [{ id: 900 }],
    families: [{ id: 900, surname: 'Adeyemi', unity: 50, conflict: 0 }],
    familyMemberships: [],
    relationships: [],
    memories: [],
    entityKnowledge: [],
    employmentRecords: [],
    organizations: [],
    inventory: [],
    entityTraits: [],
    events: [],
    barterItems: [],
  };
  for (let i = 1; i <= people; i += 1) {
    w.npcs.push({
      id: i, status: 'active', communityId: 400, education: 'secondary', createdTick: tick - 30 * YEAR,
    });
    w.familyMemberships.push({
      entity_id: i, family_id: 900, role: 'sibling', generation_number: 1,
    });
  }
  // **A takeover needs things, not only bodies**, and this fixture was
  // written before that was true. `control.compositionFor` grew a
  // `requiredMateriel` term on 18 Sep 2026 and `control.test.js` got a
  // `kit()` helper the same day, whose comment says exactly this: a
  // fixture testing the PEOPLE half has to carry kit or every assertion
  // picks up a tools shortfall it is not about. This one was missed, so
  // "a tribe that sits down together takes a building more easily" had
  // been failing on `tools: need 1, have 0` — three willing siblings and
  // not a hammer between them — while its own subject, the meeting →
  // trust → unity → cohesion chain, worked perfectly.
  w.inventory.push({
    id: 1, holder_entity_id: 1, item_name: 'Hammer', quantity: 50, condition: 80,
  });
  return w;
}

const idsOf = (w) => w.npcs.map((n) => n.id);

// ---------------------------------------------------------------------
// The vocabulary is the spec's
// ---------------------------------------------------------------------

test('every purpose cites the spec line it comes from', () => {
  // The whole point of the table is that it is not a list somebody
  // thought up, so an entry with no provenance is a bug.
  for (const [name, definition] of Object.entries(meetings.PURPOSES)) {
    assert.ok(definition.source, `"${name}" names no source`);
    assert.equal(typeof definition.trust, 'number', `"${name}" moves nothing`);
  }
  assert.ok(meetings.PURPOSE_NAMES.includes('negotiate'), 'the spec’s own verb is missing');
});

test('a meeting is worth what a shared undertaking is worth', () => {
  // Deliberately the same figure as `control.SHARED_UNDERTAKING`:
  // doing something hard together and sitting down together are the
  // same size of event, and giving them different numbers would be
  // asserting something nobody knows.
  assert.equal(meetings.PURPOSES['sit-down'].trust, control.SHARED_UNDERTAKING);
});

// ---------------------------------------------------------------------
// Who can be at one
// ---------------------------------------------------------------------

test('two people is a conversation; one person is not a meeting', () => {
  const w = room({ people: 3 });
  assert.ok(meetings.hold(w, { attendeeIds: [1, 2] }));
  assert.throws(() => meetings.hold(w, { attendeeIds: [1] }), /at least 2/);
  assert.throws(() => meetings.hold(w, { attendeeIds: [] }), /at least 2/);
});

test('a crowd is not a meeting either, and it says why', () => {
  const w = room({ people: 20 });
  assert.throws(() => meetings.hold(w, { attendeeIds: idsOf(w) }), /is a crowd, not a meeting/);
});

test('the dead and the imprisoned do not attend', () => {
  const w = room({ people: 3 });
  w.npcs[2].status = 'imprisoned';
  const held = meetings.hold(w, { attendeeIds: [1, 2, 3] });
  assert.deepEqual(held.attendees, [1, 2]);
  // And naming only people who cannot come is a meeting that did not
  // happen, refused rather than silently empty.
  w.npcs[0].status = 'imprisoned';
  w.npcs[1].status = 'deceased';
  assert.throws(() => meetings.hold(w, { attendeeIds: [1, 2, 3] }), /at least 2/);
});

test('naming somebody twice does not seat them twice', () => {
  const w = room({ people: 3 });
  const held = meetings.hold(w, { attendeeIds: [1, 1, 2, 2, 2] });
  assert.deepEqual(held.attendees, [1, 2]);
  assert.equal(held.relationships, 1);
});

test('a purpose nobody defined throws rather than doing something bland', () => {
  assert.throws(
    () => meetings.hold(room(), { attendeeIds: [1, 2], purpose: 'conspire' }),
    /is not a purpose/,
  );
});

// ---------------------------------------------------------------------
// What it changes
// ---------------------------------------------------------------------

test('everybody at the table ends up closer to everybody else', () => {
  const w = room({ people: 4 });
  meetings.hold(w, { attendeeIds: idsOf(w), purpose: 'sit-down' });
  // Four people is six pairs.
  assert.equal(w.relationships.length, 6);
  for (const rel of w.relationships) {
    assert.ok(rel.trust > 0, 'a pair left the table no closer than they arrived');
    assert.ok(rel.trust <= 100, `trust left the scale: ${rel.trust}`);
  }
});

test('trust cannot be pushed past the top of the scale', () => {
  // `worldStore.adjustRelationship` adds and does not clamp, which is
  // right for `interaction_count` and wrong for a 0-100 index.
  const w = room({ people: 2 });
  for (let i = 0; i < 200; i += 1) meetings.hold(w, { attendeeIds: [1, 2] });
  assert.equal(w.relationships[0].trust, 100);
});

test('a negotiation between people who have wronged each other goes badly', () => {
  // The only purpose whose outcome depends on what the parties already
  // think of each other. `keys.feelingToward` reads the memories one
  // holds about the other — the same function `resolveTrust` uses to
  // decide whether a known fact should raise or lower trust.
  const w = room({ people: 2 });
  w.memories.push({
    id: 1,
    entity_id: 1,
    memory_type: 'negative',
    category: 'conflict',
    description: 'was robbed by them',
    importance: 80,
    emotion_level: -80,
    related_entity_ids: [2],
    tick: 9000,
    reinforcement_count: 0,
  });
  // A relationship starts at whatever `getOrCreateRelationship`
  // defaults to, so what is asserted is the DIRECTION of the move
  // against an otherwise identical pair with no history — not an
  // absolute value, which would be a test of the default.
  const strangers = room({ people: 2 });
  meetings.hold(strangers, { attendeeIds: [1, 2], purpose: 'negotiate' });
  const neutral = strangers.relationships[0].trust;

  meetings.hold(w, { attendeeIds: [1, 2], purpose: 'negotiate' });
  assert.ok(
    w.relationships[0].trust < neutral,
    `a hostile negotiation went as well as a friendly one: ${w.relationships[0].trust} vs ${neutral}`,
  );
  // And between strangers it goes the ordinary way: a negotiation with
  // no history behind it moves trust by the purpose's own figure,
  // measured against a pair who never met.
  const untouched = room({ people: 2 });
  const baseline = worldStore.getOrCreateRelationship(untouched, 1, 2, 'social').trust;
  assert.equal(neutral - baseline, meetings.PURPOSES.negotiate.trust);
});

// ---------------------------------------------------------------------
// Manipulation — the one asymmetric thing a shared trust field cannot hold
// ---------------------------------------------------------------------

function withManipulation(entityId, value, w) {
  w.entityTraits.push({
    entity_id: entityId,
    trait_id: getTraitId('psychological', 'Manipulation'),
    base_value: value,
    key_modifier: 0,
    current_value: value,
  });
  return w;
}

test('a lopsided negotiation leaves the manipulated party owing a debt', () => {
  const w = room({ people: 2 });
  withManipulation(1, 90, w);
  withManipulation(2, 10, w);
  meetings.hold(w, { attendeeIds: [1, 2], purpose: 'negotiate' });
  const rel = w.relationships[0];
  // 1 manipulated 2, so 2 owes 1 — asserted by direction against
  // `entity_a_id`/`entity_b_id` rather than a hard-coded sign, because
  // `getOrCreateRelationship` fixes that order on whichever id called
  // first, not on which id is the manipulator.
  const oneOwedByTwo = rel.entity_a_id === 1 ? rel.debt > 0 : rel.debt < 0;
  assert.ok(oneOwedByTwo, `debt did not point from the manipulated party to the manipulator: ${rel.debt}`);
});

test('an even negotiation creates no debt at all', () => {
  const w = room({ people: 2 });
  withManipulation(1, 55, w);
  withManipulation(2, 50, w);
  meetings.hold(w, { attendeeIds: [1, 2], purpose: 'negotiate' });
  assert.equal(w.relationships[0].debt, 0);
});

test('manipulation only reads on negotiate, not on a sit-down', () => {
  const w = room({ people: 2 });
  withManipulation(1, 95, w);
  withManipulation(2, 5, w);
  meetings.hold(w, { attendeeIds: [1, 2], purpose: 'sit-down' });
  assert.equal(w.relationships[0].debt, 0);
});

test('everybody remembers it, and remembers who else was there', () => {
  // §"NPCs remember favors, betrayals, conversations, victories,
  // losses" — the conversation IS the memory, which is why there is no
  // `meetings` table.
  const w = room({ people: 3 });
  meetings.hold(w, { attendeeIds: idsOf(w), topic: 'the water plant' });
  assert.equal(w.memories.length, 3);
  for (const memory of w.memories) {
    assert.match(memory.description, /the water plant/);
    assert.equal(memory.related_entity_ids.length, 2);
    assert.ok(!memory.related_entity_ids.includes(memory.entity_id));
  }
});

test('what one of them knows, the rest leave knowing', () => {
  const w = room({ people: 3 });
  w.entityKnowledge.push({
    id: 1,
    entity_id: 1,
    subject_entity_id: null,
    fact_type: 'known',
    fact_content: 'the granary is empty',
    confidence_level: 0.9,
    source_entity_id: null,
    spread_rate: 0.08,
    distortion_level: 0.1,
    tick: 9000,
  });
  const held = meetings.hold(w, { attendeeIds: idsOf(w) });
  assert.equal(held.shared, 2);
  const knowers = w.entityKnowledge.filter((k) => k.fact_content === 'the granary is empty');
  assert.equal(knowers.length, 3);
  // Heard from somebody in the room, so it is held less confidently
  // than the person who knew it first — the same treatment
  // `media.runWordOfMouth` gives a retelling, because it is the same act.
  const heard = knowers.find((k) => k.entity_id === 2);
  assert.ok(heard.confidence_level < 0.9);
  assert.equal(heard.source_entity_id, 1);
});

test('a meeting is not an interrogation', () => {
  // Facts ABOUT the people in the room are deliberately not passed
  // around. "Everybody now knows everything about everybody present" is
  // the total-information sweep that made `computeApproval`'s spread a
  // constant 1.0.
  const w = room({ people: 3 });
  w.entityKnowledge.push({
    id: 1,
    entity_id: 1,
    subject_entity_id: 2,
    fact_type: 'assumption',
    fact_content: 'entity 2 stole from the store',
    confidence_level: 0.6,
    tick: 9000,
  });
  const held = meetings.hold(w, { attendeeIds: idsOf(w) });
  assert.equal(held.shared, 0);
  assert.equal(w.entityKnowledge.length, 1);
});

test('the same fact is not shared twice', () => {
  const w = room({ people: 3 });
  w.entityKnowledge.push({
    id: 1, entity_id: 1, subject_entity_id: null, fact_type: 'known', fact_content: 'a fact', confidence_level: 0.8, tick: 9000,
  });
  meetings.hold(w, { attendeeIds: idsOf(w) });
  const after = w.entityKnowledge.length;
  meetings.hold(w, { attendeeIds: idsOf(w) });
  assert.equal(w.entityKnowledge.length, after, 'the same fact was told again');
});

// ---------------------------------------------------------------------
// Teaching
// ---------------------------------------------------------------------

test('the person at the table who knows most is the one who teaches', () => {
  const w = room({ people: 3 });
  knowledge.registerItems(w);
  w.employmentRecords.push({
    id: 1, entity_id: 3, employer_organization_id: 500, status: 'active', wage: 40, position: 'physician',
  });
  w.npcs.forEach((n) => { n.education = 'basic'; });
  w.npcs[2].education = 'higher';

  assert.equal(meetings.deepestTrade(w, w.npcs).id, 3);
  const held = meetings.hold(w, { attendeeIds: idsOf(w), purpose: 'teach' });
  assert.equal(held.teacherId, 3);
  // The teacher does not teach themselves — that is what a book is for.
  assert.ok(!held.taught.some((t) => t.entityId === 3));
  assert.ok(held.taught.length > 0, 'a physician taught nobody anything');
  for (const t of held.taught) assert.equal(t.field, 'medicine');
});

test('a table where nobody knows a trade teaches nothing', () => {
  const w = room({ people: 3 });
  knowledge.registerItems(w);
  const held = meetings.hold(w, { attendeeIds: idsOf(w), purpose: 'teach' });
  assert.deepEqual(held.taught, []);
  assert.equal(held.teacherId, undefined);
});

// ---------------------------------------------------------------------
// couldAttend
// ---------------------------------------------------------------------

test('you can only sit down with people who are actually here', () => {
  const w = room({ people: 3 });
  w.npcs.push({
    id: 9, status: 'active', communityId: 401, education: 'basic', createdTick: w.tick - 30 * YEAR,
  });
  w.npcs.push({
    id: 10, status: 'active', communityId: 400, education: 'none', createdTick: w.tick - 8 * YEAR,
  });
  const could = meetings.couldAttend(w, 1).map((n) => n.id);
  assert.deepEqual(could, [2, 3], 'the far neighbour or the child was offered a seat');
});

// ---------------------------------------------------------------------
// The chain this exists to complete
// ---------------------------------------------------------------------

test('a tribe that sits down together takes a building more easily', () => {
  // Four systems, each built for its own reason, and no new modifier
  // anywhere: meeting -> trust -> unityTarget -> families.unity ->
  // cohesionOf -> finalSuccessProbability.
  const w = room({ people: 3 });
  w.organizations.push({ id: 500, type: 'club', leader_id: null });

  const before = control.assess(w, { scale: 'organization', locationId: 500, tribeId: 900 });
  assert.equal(before.compositionRequirementMet, true);

  // Sixty sit-downs over sixty days, with the cohesion pass running
  // between them exactly as the Social phase runs it.
  for (let t = 0; t < 60; t += 1) {
    meetings.hold(w, { attendeeIds: idsOf(w), purpose: 'plan', tick: 10000 + t });
    familyTraits.advanceCohesion(w, { tick: 10000 + t });
  }

  assert.ok(w.families[0].unity > 50, `unity did not move: ${w.families[0].unity}`);
  const after = control.assess(w, { scale: 'organization', locationId: 500, tribeId: 900 });
  assert.ok(
    after.finalSuccessProbability > before.finalSuccessProbability,
    `planning changed nothing: ${before.finalSuccessProbability} -> ${after.finalSuccessProbability}`,
  );
});

// ---------------------------------------------------------------------
// The player verb, and the measurement
// ---------------------------------------------------------------------

test('a player is always at their own meeting', () => {
  const npc = engine.generateNPC();
  npc.createdTick = engine.WorldState.tick - 30 * YEAR;
  const other = engine.generateNPC();
  other.createdTick = engine.WorldState.tick - 30 * YEAR;
  const player = engine.generatePlayer({ linkedEntityId: npc.id });

  const { result } = engine.dispatchAction(player.id, {
    action: 'call-meeting', attendeeIds: [other.id], purpose: 'sit-down',
  });
  assert.ok(result.attendees.includes(npc.id), 'the player was not at their own meeting');
  assert.ok(result.attendees.includes(other.id));
  assert.equal(result.events[0].id > 0, true, 'the event never went through the Event phase');
  assert.equal(result.events[0].type, 'meeting_held');
});

test('the action list offers it', () => {
  assert.ok(actions.listActions('citizen').map((a) => a.action).includes('call-meeting'));
});

test('describeMeetings reports zero rather than assuming', () => {
  // Standing rule 11's guard on this file specifically: nothing in the
  // tick calls `hold`, so until a player does, this system is real and
  // unexercised — and that has to be a visible fact.
  const described = meetings.describeMeetings({ events: [] });
  assert.equal(described.held, 0);
  assert.equal(described.purposes, meetings.PURPOSE_NAMES.length);
});
