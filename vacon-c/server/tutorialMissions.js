// server/tutorialMissions.js
//
// Mission Chain #1 — "Start Here". See
// `dev-docs/TUTORIAL_MISSIONS_DESIGN.md` for the full design note (the
// six-reference mapping this closes the first slice of, and why each
// step is real rather than invented).
//
// **Three real steps, no new mechanic, no schema change:**
//
//   1. A starting book, seeded directly — not a mission. `generateMission`
//      requires a real artifact or a real location; "study the book you
//      were given" is about neither, and forcing it into the mission
//      state machine would mean inventing a fourth kind of mission
//      subject the schema does not have. The player can call `study` on
//      it the instant they exist.
//   2. A real Mission to explore a real landmark
//      (`discovery.search`, repeatable — the Maniac Mansion finding: a
//      landmark's finite capacity still supports several distinct real
//      finds before it is searched out).
//   3. A real Mission to meet, and separately learn from, a real NPC
//      who holds a real occupation. `call-meeting` moves trust;
//      `study` against that same person as an `experienced NPCs`
//      source is the actual knowledge transfer — two real mechanics,
//      not one pretending to be two.
//
// Every function here takes `worldState` explicitly, same convention as
// economy.js/players.js/missions.js.

'use strict';

const knowledge = require('./knowledge.js');
const inventory = require('./inventory.js');
const discovery = require('./discovery.js');
const missions = require('./missions.js');
const occupations = require('./occupations.js');

//: Chosen, not measured — there is nothing in this engine a tutorial
//: reward could be derived from, unlike the thresholds this project's
//: own standing rules insist on measuring. Small enough that a brand
//: new citizen's first missions do not distort the real economy
//: (`resolveMission` pays through the same real ledger every other
//: mission does); large enough to read as a real reward rather than a
//: token. Held here rather than inline so both missions agree.
const TUTORIAL_EXPLORE_REWARD = 40;
const TUTORIAL_MENTOR_REWARD = 40;

//: The field a fresh citizen starts a book in, when the caller does not
//: choose one. Agriculture is §24's own first-listed field and needs no
//: prior schooling to start reading at (`sourceReach`'s six rungs put a
//: Tier 2 book within reach of an unschooled beginner).
const DEFAULT_FIELD = 'agriculture';

// Step 1. Not a mission — see the file header for why. Idempotent by
// item name the way `inventory.give` already is: calling this twice on
// the same NPC adds a second copy rather than erroring, which is the
// right behaviour for a real held book.
function giveStartingBook(worldState, npcId, options = {}) {
  const npc = (worldState.npcs || []).find((n) => n.id === npcId);
  if (!npc) throw new Error(`giveStartingBook: no NPC ${npcId}`);

  const field = options.field ?? DEFAULT_FIELD;
  if (!knowledge.FIELD_NAMES.includes(field)) {
    throw new Error(`giveStartingBook: "${field}" is not a real §24 field (one of: ${knowledge.FIELD_NAMES.join(', ')})`);
  }

  knowledge.registerItems(worldState);
  const itemName = knowledge.itemNameFor(field, 'books');
  const holding = inventory.give(worldState, {
    entityId: npcId, itemName, quantity: 1, tick: worldState.tick,
  });
  return { field, source: 'books', itemName, holding };
}

// Step 2. A real Mission about a real, currently-searchable landmark in
// the citizen's own community — `discovery.searchableIn` is the exact
// "everywhere in this area still worth searching" read the file it
// lives in was built for, so this asks it rather than guessing.
// Returns null, not a thrown error, when the community has nothing
// left to search — a real and possible state (every landmark already
// searched out), not a bug in this function.
function offerExploreMission(worldState, npcId, options = {}) {
  const npc = (worldState.npcs || []).find((n) => n.id === npcId);
  if (!npc) throw new Error(`offerExploreMission: no NPC ${npcId}`);
  if (npc.communityId == null) return null;

  const candidates = discovery.searchableIn(worldState, npc.communityId);
  if (candidates.length === 0) return null;

  const site = candidates[0];
  return missions.generateMission(worldState, {
    locationId: site.id,
    objective: `See what the ${site.landmark_category.replace(/-/g, ' ')} still holds`,
    reward: options.reward ?? TUTORIAL_EXPLORE_REWARD,
  });
}

// Step 3. A real Mission naming a real mentor — the first other NPC in
// the same community who holds a real occupation, the same
// `occupations.occupationOf` check `knowledge.sourcesFor` already
// applies when it looks for a real `experienced NPCs` source. Anchored
// to a real property in the shared community, since `generateMission`
// requires a real place or a real artifact and this mission is about
// neither — the location is context, not the point; the mentor named
// in the objective is.
function offerMentorMission(worldState, npcId, options = {}) {
  const npc = (worldState.npcs || []).find((n) => n.id === npcId);
  if (!npc) throw new Error(`offerMentorMission: no NPC ${npcId}`);
  if (npc.communityId == null) return null;

  const mentor = (worldState.npcs || []).find(
    (other) => other.id !== npcId
      && other.communityId === npc.communityId
      && occupations.occupationOf(worldState, other.id),
  );
  if (!mentor) return null;

  const anchor = (worldState.properties || []).find((p) => p.community_id === npc.communityId);
  if (!anchor) return null;

  const mission = missions.generateMission(worldState, {
    locationId: anchor.id,
    objective: `Meet ${mentor.name} and learn what they know about their trade`,
    reward: options.reward ?? TUTORIAL_MENTOR_REWARD,
  });
  return { mission, mentorId: mentor.id };
}

// The whole chain, offered together — what a citizen-mode player
// binding gets the instant they exist. Each half is independently
// optional (a community with nothing searchable, or nobody else
// employed, is a real state) so this reports what it actually managed
// rather than pretending every world can offer all three.
function seedTutorialStart(worldState, npcId, options = {}) {
  const book = giveStartingBook(worldState, npcId, options);
  const exploreMission = offerExploreMission(worldState, npcId, options);
  const mentor = offerMentorMission(worldState, npcId, options);
  return {
    book,
    exploreMission,
    mentorMission: mentor?.mission ?? null,
    mentorId: mentor?.mentorId ?? null,
  };
}

module.exports = {
  TUTORIAL_EXPLORE_REWARD,
  TUTORIAL_MENTOR_REWARD,
  DEFAULT_FIELD,
  giveStartingBook,
  offerExploreMission,
  offerMentorMission,
  seedTutorialStart,
};
