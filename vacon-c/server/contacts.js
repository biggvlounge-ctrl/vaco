// server/contacts.js
//
// Friends, classmates and associates — real relationships, never
// front-loaded at character creation or at ordinary NPC generation.
//
// ---------------------------------------------------------------------
// The worked example, and the real question it actually asks
// ---------------------------------------------------------------------
// "A cousin in Arkansas isn't 'in effect' until the player needs a
// real distribution contact outside their home region — the engine
// should check for a real existing match first, and only generate a
// new one if none exists." `findOrCreateContact` is that check,
// generalised past the one worked example: a player's action calls for
// SOME contact matching SOME real criteria, and the honest order of
// operations is always the same — look at who this person already
// really knows before inventing somebody new to know.
//
// **The real vocabulary this reuses, never a new one invented for
// "friend/classmate/associate".** `VACANCY_POSTGRESQL_SCHEMA.sql`'s own
// comment on `relationships.relationship_type` already enumerates
// `friend|business|educational|neighbor|student` among its ten real
// values — a classmate is `educational` or `student`, an associate is
// `business` or plain `friend`, a neighbour is `neighbor`. None of
// these needed a new column or a new value; they needed a real reader,
// the same gap `relationships.influence`/`families.political_influence`
// had before the influence economy was built.
//
// **"Outside home region" is scoped to what this engine's real
// geography actually supports.** `countryPacks.js`'s own thirty-ninth
// standing rule names the real constraint directly: this engine
// generates exactly ONE region per world. There is no second real
// region for a generated NPC to live in, so "outside home region" is
// honestly answered at the grain this engine DOES generate more than
// one of — the CITY (`worldgen.js` routinely builds two or more). A
// caller asking `outsideHomeCity: true` gets a contact in a real,
// different city; asking for a different COUNTRY or REGION would be a
// claim this engine's single-region generation cannot back.
//
// **The real family check is `characterCreation.describeFamilyTree`,
// not a second family lookup.** Cousins and aunts/uncles it already
// returns are read back here as ordinary candidates, same as any
// `friend`/`business` relationship — the Arkansas cousin is not a
// special case in this file's own logic, only in the example that
// named it.
//
// **Generation, when nothing qualifies, reuses the identical real
// cross-world placement `characterCreation.js#generateAuntOrUncle`
// already uses** — a real random draw across every community the
// world actually has, never a fixed default community. The caller
// supplies the same `generators` seam `characterCreation.createCharacter`
// already requires (`generateNpc`/`generateFamily`/`addFamilyMember`,
// injected because that logic lives directly in `engine.js` and
// requiring it back here would be circular — the identical reasoning
// that file's own header gives).

'use strict';

const worldStore = require('./worldStore.js');
const economy = require('./economy.js');
const characterCreation = require('./characterCreation.js');
const { seededDraw } = require('./seeded.js');

//: The real, already-enumerated values a "friend/classmate/associate"
//: contact can be. `family` is deliberately NOT here — extended family
//: is read as its own real candidate pool below, never generated fresh
//: by this file (that generation belongs to
//: `characterCreation.generateAuntOrUncle`, reused, not duplicated).
const CONTACT_RELATIONSHIP_TYPES = ['friend', 'business', 'educational', 'neighbor', 'student'];

function cityOf(worldState, entityId) {
  const npc = (worldState.npcs || []).find((n) => n.id === entityId);
  if (!npc || npc.communityId == null) return null;
  const community = (worldState.communities || []).find((c) => c.id === npc.communityId);
  return community ? community.city_id ?? null : null;
}

// Every real existing person `entityId` could plausibly reach for a
// contact of one of `relationshipTypes` — ordinary relationships of
// those types, PLUS real extended family (cousins/aunts-uncles), read
// through `characterCreation.describeFamilyTree` rather than a second
// family lookup.
function realCandidates(worldState, entityId, relationshipTypes) {
  const typed = (worldState.relationships || [])
    .filter((r) => relationshipTypes.includes(r.relationship_type)
      && (r.entity_a_id === entityId || r.entity_b_id === entityId))
    .map((r) => ({
      contactId: r.entity_a_id === entityId ? r.entity_b_id : r.entity_a_id,
      relationshipType: r.relationship_type,
      trust: Number(r.trust) || 0,
    }))
    .filter(({ contactId }) => (worldState.npcs || []).some((n) => n.id === contactId));

  const family = characterCreation.describeFamilyTree(worldState, entityId);
  const kin = (family.cousins || []).flatMap(
    (group) => (group.children || [])
      .filter((child) => child.alive)
      .map((child) => ({ contactId: child.id, relationshipType: 'family', trust: 50 })),
  );

  return [...typed, ...kin];
}

// Search real existing candidates first; generate a new, real NPC only
// if none qualifies. Returns `{ contactId, relationshipType, generated }`.
//
// options:
//   relationshipTypes  - which real types count (default
//                        CONTACT_RELATIONSHIP_TYPES)
//   outsideHomeCity    - require the contact to live in a real,
//                        different city (default false)
//   generators         - { generateNpc, generateFamily, addFamilyMember },
//                        required only if generation is reached — the
//                        same injected seam `createCharacter` takes
//   tick               - defaults to worldState.tick
//   seed               - defaults to worldState.seed ?? 'world'
function findOrCreateContact(worldState, entityId, options = {}) {
  const {
    relationshipTypes = CONTACT_RELATIONSHIP_TYPES,
    outsideHomeCity = false,
    generators,
    tick = worldState.tick ?? 0,
    seed = worldState.seed ?? 'world',
  } = options;

  const invented = relationshipTypes.filter((t) => !CONTACT_RELATIONSHIP_TYPES.includes(t));
  if (invented.length > 0) {
    throw new Error(
      `findOrCreateContact: ${invented.join(', ')} is not a real contact relationship type `
      + `(one of: ${CONTACT_RELATIONSHIP_TYPES.join(', ')})`,
    );
  }

  const homeCity = cityOf(worldState, entityId);
  const pool = realCandidates(worldState, entityId, relationshipTypes);
  const qualifying = outsideHomeCity
    ? pool.filter(({ contactId }) => {
      const city = cityOf(worldState, contactId);
      return city !== null && city !== homeCity;
    })
    : pool;

  if (qualifying.length > 0) {
    // Highest real trust first, deterministic tie-break by lowest id —
    // the same shape `meetings.js#deepestTrade` already picks a best
    // candidate by, rather than an arbitrary "first match".
    qualifying.sort((a, b) => b.trust - a.trust || a.contactId - b.contactId);
    const best = qualifying[0];
    return { contactId: best.contactId, relationshipType: best.relationshipType, generated: false };
  }

  if (!generators) {
    throw new Error(
      'findOrCreateContact: no qualifying real contact exists, and generating one requires '
      + 'options.generators ({ generateNpc, generateFamily, addFamilyMember })',
    );
  }

  // Checked BEFORE anything is generated — a refusal must leave no
  // partial state behind it: no orphaned NPC with nowhere real to live.
  const communities = worldState.communities || [];
  const candidateCommunities = outsideHomeCity
    ? communities.filter((c) => c.city_id !== homeCity)
    : communities;
  if (outsideHomeCity && candidateCommunities.length === 0) {
    throw new Error('findOrCreateContact: this world has no other real city to place an outside contact in');
  }

  const contact = generators.generateNpc({});
  economy.generateIndividualFinances(worldState, contact.id, { tick });

  if (candidateCommunities.length > 0) {
    const index = Math.floor(
      seededDraw([seed, 'contact-community', entityId, tick]) * candidateCommunities.length,
    );
    contact.communityId = candidateCommunities[index].id;
  }

  const relationshipType = relationshipTypes[0];
  worldStore.getOrCreateRelationship(worldState, entityId, contact.id, relationshipType);

  return { contactId: contact.id, relationshipType, generated: true };
}

module.exports = {
  CONTACT_RELATIONSHIP_TYPES,
  cityOf,
  realCandidates,
  findOrCreateContact,
};
