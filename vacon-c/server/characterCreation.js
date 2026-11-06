// server/characterCreation.js
//
// Character creation. The direction asked for, verbatim: a player
// picks a couple of things, and everything else — especially family —
// is random, and REVEALED to the player, never chosen by them.
//
// ---------------------------------------------------------------------
// What a player picks
// ---------------------------------------------------------------------
//   occupationName  - optional. One of `occupations.OCCUPATION_NAMES`.
//                      Validated against the SAME real qualification
//                      gate (`occupations.qualifiedFor`/`tierReachable`)
//                      any NPC's own hire already goes through — a
//                      player does not get to skip the gate everybody
//                      else is held to. Refused with a clear, specific
//                      error if it is not reachable (wrong education)
//                      or if no real organization anywhere in this
//                      world actually employs it — never a silent
//                      fallback to something else.
//   education       - optional, one of `demographics.EDUCATION_LEVELS`.
//                      Left unset, a freshly created character has
//                      `education: null` — "unmeasured", the exact
//                      same real starting condition `generateNPC`
//                      already gives any freshly generated adult (see
//                      worldgen.js's own "set below, but only for
//                      adults" default). Tiers 3+ need a real level
//                      set here to be reachable, same as for anybody.
//   countryKey      - optional, one of `countryPacks.COUNTRIES`' own
//                      real keys. This is real-world ANCESTRY/CONTEXT
//                      (the country pack's own economic, political and
//                      conflict data), not a binding to this engine's
//                      own generated cities — `countryPacks.js` has no
//                      structural link to `territory.js`'s cities at
//                      all (checked directly, not assumed: `cities`
//                      has no country column anywhere in the schema),
//                      so this file does not invent one. Omitted, a
//                      REAL random country is still drawn from the
//                      pack's own real keys — "random" is a real draw
//                      across what genuinely exists, never a fixed
//                      default.
//   communityId     - optional, an existing real community to start
//                      in. Omitted, a real existing community is drawn
//                      at random if this world has any; if it has
//                      none yet, the honest answer is the same
//                      `null`/"unplaced" `generateNPC` already allows
//                      for a world generated before it has anywhere to
//                      put people.
//
// ---------------------------------------------------------------------
// What is random, and reported back rather than chosen
// ---------------------------------------------------------------------
// A real family tree, built from the exact real generators
// (`generateNpc`/`generateFamily`/`addFamilyMember`, injected — see
// below) rather than a second copy of any of their logic:
//
//   - whether each parent is alive or deceased (a real draw; a
//     deceased parent is recorded through `mortality.recordDeath`,
//     the SAME real status transition and estate settlement any other
//     death in this engine goes through — never a second "is dead"
//     flag);
//   - a living parent's own real occupation, drawn the identical real
//     way any NPC's occupation is (`occupations.drawOccupation`
//     against whatever real organization in the world actually
//     employs that line of work — a parent with no real employer to
//     draw from simply has no occupation, same honest gap any NPC can
//     have);
//   - a real number of siblings (0 or more), added to the player's own
//     real family record;
//   - a real number of cousins, EACH ONE A FULLY SIMULATED REAL NPC —
//     not a flavor count. Per direct instruction: a cousin is not a
//     role added to the player's own family (`family_memberships` is
//     scoped to one lineage — a sibling, a parent, a child are all
//     positions in ONE family's own tree). A real cousin is the child
//     of the player's parent's own sibling, and that sibling (the
//     player's aunt or uncle) is a real NPC who heads an entirely
//     SEPARATE real family record of their own, placed at ITS OWN real
//     community — which may genuinely be a different one than the
//     player's own, exactly what "cousins somewhere else" means. The
//     cross-family link is the schema's own real, already-defined
//     `relationships.relationship_type` value `'family'` — one of
//     `family|friend|enemy|business|political|romantic|educational|
//     military|neighbor|mentor|student` in `VACANCY_POSTGRESQL_
//     SCHEMA.sql` — never a role invented on the wrong table.
//
// **Explicitly, deliberately out of scope for this round, named here
// rather than silently omitted**: grandparents, and any generation
// beyond parents/siblings/cousins. Nothing here builds or stubs that
// generation; the real tree stops at the player's own aunts/uncles and
// their children.
//
// **The player's own chosen location and the random family's location
// are independent.** A player can start in a community their random
// family has no connection to at all — this file never forces them
// together.
//
// ---------------------------------------------------------------------
// Why every generator this file calls is INJECTED, not required
// ---------------------------------------------------------------------
// `generateNpc`/`generateFamily`/`addFamilyMember` are not separate
// modules the way `missions.js` or `territory.js` are — their real
// logic lives directly inside `engine.js` (checked directly: there is
// no `npcs.js` or `families.js` generator file to require). Requiring
// `engine.js` from here would be circular — `engine.js` is this file's
// own caller — and duplicating NPC/family generation logic here would
// be a second, quietly disagreeing copy of it. So they are injected,
// the exact same seam `missions.js`'s own `resolveMission` already
// uses for `payReward`, for the identical reason stated in that file's
// own comment: keeping this module taking `worldState` explicitly
// without reaching into the module that wraps it.

'use strict';

const occupations = require('./occupations.js');
const economy = require('./economy.js');
const mortality = require('./mortality.js');
const countryPacks = require('./countryPacks.js');
const influence = require('./influence.js');
const { seededDraw } = require('./seeded.js');

//: A living parent is deceased in roughly this real-world-plausible
//: share of character creations — flagged as a chosen figure, same
//: posture every other undocumented probability in this engine
//: states its own number with (`control.SHARED_UNDERTAKING`,
//: `migration.MOVE_CHANCE`): no source document gives VACANCY's own
//: real rate, so one quarter is picked and named rather than hidden
//: inside an unlabelled magic number.
const PARENT_DECEASED_CHANCE = 0.25;

//: Sibling count, drawn 0..MAX_SIBLINGS inclusive, uniform. Not a
//: demographic claim — a real population pyramid is `worldgen.js`'s
//: job, not a single character's own backstory roll.
const MAX_SIBLINGS = 3;

//: How many of the player's parent's own siblings (aunts/uncles) exist
//: at all, 0..MAX_PARENT_SIBLINGS.
const MAX_PARENT_SIBLINGS = 3;

//: Cousins per aunt/uncle, 0..MAX_COUSINS_PER_AUNT_UNCLE.
const MAX_COUSINS_PER_AUNT_UNCLE = 4;

//: The same invented wage band `worldgen.js` itself falls back to when
//: no real labour-market median is available for a hire — reused
//: verbatim rather than re-guessed, see that file's own `hireEntity`
//: call.
const FALLBACK_WAGE_MIN = 8;
const FALLBACK_WAGE_MAX = 90;

function seededInt(parts, maxExclusive) {
  if (maxExclusive <= 0) return 0;
  return Math.min(maxExclusive - 1, Math.floor(seededDraw(parts) * maxExclusive));
}

function seededChance(parts, probability) {
  return seededDraw(parts) < probability;
}

function fallbackWage(parts) {
  return Math.round(FALLBACK_WAGE_MIN + seededDraw(parts) * (FALLBACK_WAGE_MAX - FALLBACK_WAGE_MIN));
}

// A real community to place somebody in, honoring an explicit choice,
// otherwise a real random pick among whatever communities this world
// already has — or the same honest `null` ("unplaced") `generateNPC`
// itself already allows when a world has nobody for them yet.
function resolveCommunity(worldState, requestedCommunityId, seedParts) {
  if (requestedCommunityId != null) {
    const found = (worldState.communities || [])
      .find((c) => c.id === Number(requestedCommunityId));
    if (!found) {
      throw new Error(`createCharacter: no community with id ${requestedCommunityId}.`);
    }
    return found;
  }
  const pool = worldState.communities || [];
  if (pool.length === 0) return null;
  return pool[seededInt(seedParts, pool.length)];
}

// A real country-pack key, honoring an explicit choice (validated
// against the pack's own real keys) or a real random draw across
// whatever keys the pack genuinely has — never a fixed default.
function resolveCountryKey(requestedCountryKey, seedParts) {
  const keys = Object.keys(countryPacks.COUNTRIES);
  if (requestedCountryKey != null) {
    if (!keys.includes(requestedCountryKey)) {
      throw new Error(
        `createCharacter: "${requestedCountryKey}" is not a real country-pack key `
        + `(one of: ${keys.join(', ')}).`,
      );
    }
    return requestedCountryKey;
  }
  if (keys.length === 0) return null;
  return keys[seededInt(seedParts, keys.length)];
}

// The real employer + occupation a player's requested job actually
// resolves to, or a clear refusal — never a silent fallback to
// something else. Reuses `occupations.qualifiedFor`, the exact gate
// any NPC's own hire is held to.
function resolveRequestedOccupation(worldState, npcLike, occupationName) {
  const definition = occupations.definitionOf(occupationName);
  if (!definition) {
    throw new Error(
      `createCharacter: "${occupationName}" is not a real occupation `
      + `(one of occupations.OCCUPATION_NAMES).`,
    );
  }
  const employer = (worldState.organizations || [])
    .find((o) => definition.employers.includes(o.type));
  if (!employer) {
    throw new Error(
      `createCharacter: no real organization in this world employs "${occupationName}" `
      + `(it is only ever employed by: ${definition.employers.join(', ')}).`,
    );
  }
  const reachable = occupations.qualifiedFor(npcLike, employer.type);
  if (!reachable.includes(occupationName)) {
    throw new Error(
      `createCharacter: "${occupationName}" is Tier ${definition.tier} and this character's own `
      + `real education ("${npcLike.education ?? 'none recorded'}") does not reach it — `
      + 'set a higher real education, or pick a reachable occupation.',
    );
  }
  return { employer, occupationName };
}

// One real parent: generated, added to the player's own real family,
// and — on the real draw that says so — recorded dead through the one
// real mortality pipeline this engine has, never a second "is dead"
// field. A living parent draws a real occupation the identical way any
// NPC's is drawn, against whatever real organization in the world
// actually employs it; with none, they honestly have no occupation,
// same as any NPC can.
function generateParent(worldState, options) {
  const { role, generators, seed, tick, communityId, familyId } = options;
  const parent = generators.generateNpc({ communityId });
  generators.addFamilyMember(familyId, parent.id, role, 0);
  economy.generateIndividualFinances(worldState, parent.id, { tick });

  const deceased = seededChance([seed, 'parent-deceased', role, parent.id], PARENT_DECEASED_CHANCE);
  let occupationName = null;
  if (!deceased) {
    const employer = (worldState.organizations || [])[
      seededInt([seed, 'parent-employer', parent.id], (worldState.organizations || []).length)
    ] ?? null;
    if (employer) {
      occupationName = occupations.drawOccupation({
        npc: parent, organizationType: employer.type, worldState, seed, extra: ['parent', parent.id],
      });
      if (occupationName) {
        economy.hireEntity(worldState, {
          entityId: parent.id,
          employerOrganizationId: employer.id,
          wage: fallbackWage([seed, 'parent-wage', parent.id]),
          position: occupationName,
          tick,
        });
      }
    }
  } else {
    mortality.recordDeath(worldState, { entityId: parent.id, cause: 'age', tick });
  }

  return { entity: parent, alive: !deceased, occupationName };
}

// One real aunt/uncle — a sibling of the player's own parent — who
// heads an entirely separate real family of their own, at its own
// real (possibly different) community, with its own real children:
// the player's real cousins. The cross-family link is the schema's own
// real `relationships.relationship_type` value `'family'`.
function generateAuntOrUncle(worldState, options) {
  const {
    generators, seed, tick, parentEntityId, surname, index,
    // Tighter than this file's own default when a caller needs one —
    // `worldgen.js` reuses this exact function for ORDINARY NPCs, once
    // per generated family rather than once per player, and needs a
    // smaller cap for exactly that reason (see that file's own header
    // on the measured population cost). Every existing caller omits
    // this and gets the unchanged default.
    maxCousins = MAX_COUSINS_PER_AUNT_UNCLE,
  } = options;

  const auntUncle = generators.generateNpc({});
  const auntUncleFamily = generators.generateFamily({ surname, headNpcId: auntUncle.id });
  generators.addFamilyMember(auntUncleFamily.id, auntUncle.id, 'parent', 0);
  economy.generateIndividualFinances(worldState, auntUncle.id, { tick });

  if (parentEntityId != null) {
    // Baseline only, no immediate-family bonus — an aunt/uncle is real
    // kin, not a stranger, but the direct instruction behind
    // `IMMEDIATE_FAMILY_BOND_BONUS` is specifically that a player's own
    // parents and siblings start CLOSER than this.
    influence.seedFamilyBond(worldState, parentEntityId, auntUncle.id);
  }

  const auntUncleCommunity = resolveCommunity(worldState, null, [seed, 'aunt-uncle-community', index]);
  auntUncle.communityId = auntUncleCommunity ? auntUncleCommunity.id : null;

  const cousinCount = seededInt([seed, 'cousin-count', index], maxCousins + 1);
  const cousins = [];
  for (let c = 0; c < cousinCount; c += 1) {
    const cousin = generators.generateNpc({ communityId: auntUncle.communityId });
    generators.addFamilyMember(auntUncleFamily.id, cousin.id, 'child', 1);
    cousins.push(cousin);
  }

  return {
    auntOrUncle: auntUncle,
    family: auntUncleFamily,
    community: auntUncleCommunity,
    cousins,
  };
}

// ---------------------------------------------------------------------
// createCharacter — the one real entry point
// ---------------------------------------------------------------------
// options:
//   generators        - required: { generateNpc, generateFamily, addFamilyMember },
//                        the real engine.js functions, injected (see header)
//   name              - optional
//   occupationName    - optional, player-chosen
//   education         - optional, player-chosen
//   countryKey        - optional, player-chosen (real context, not geography)
//   communityId        - optional, player-chosen (real placement)
//   tick              - defaults to worldState.tick
//   seed              - defaults to worldState.seed ?? 'world'
function createCharacter(worldState, options = {}) {
  const {
    generators, name = null, occupationName = null, education = null,
    countryKey: requestedCountryKey = null, communityId: requestedCommunityId = null,
    tick = worldState.tick ?? 0,
  } = options;

  if (!generators || typeof generators.generateNpc !== 'function'
    || typeof generators.generateFamily !== 'function'
    || typeof generators.addFamilyMember !== 'function') {
    throw new Error(
      'createCharacter requires options.generators: { generateNpc, generateFamily, addFamilyMember }.',
    );
  }

  const seed = options.seed ?? worldState.seed ?? 'world';
  const community = resolveCommunity(worldState, requestedCommunityId, [seed, 'player-community']);
  const countryKey = resolveCountryKey(requestedCountryKey, [seed, 'player-country']);

  const player = generators.generateNpc({
    name, education, communityId: community ? community.id : null,
  });

  let occupation = null;
  if (occupationName != null) {
    const resolved = resolveRequestedOccupation(worldState, player, occupationName);
    occupation = resolved.occupationName;
    economy.hireEntity(worldState, {
      entityId: player.id,
      employerOrganizationId: resolved.employer.id,
      wage: fallbackWage([seed, 'player-wage', player.id]),
      position: occupation,
      tick,
    });
  }
  economy.generateIndividualFinances(worldState, player.id, { tick });

  const surname = (name || player.name || 'Doe').trim().split(/\s+/).pop();
  const family = generators.generateFamily({ surname, headNpcId: null });
  generators.addFamilyMember(family.id, player.id, 'child', 0);

  const mother = generateParent(worldState, {
    role: 'parent', generators, seed, tick, familyId: family.id,
    communityId: community ? community.id : null,
  });
  const father = generateParent(worldState, {
    role: 'parent', generators, seed: `${seed}-2`, tick, familyId: family.id,
    communityId: community ? community.id : null,
  });

  const siblingCount = seededInt([seed, 'sibling-count', player.id], MAX_SIBLINGS + 1);
  const siblings = [];
  for (let s = 0; s < siblingCount; s += 1) {
    const sibling = generators.generateNpc({ communityId: community ? community.id : null });
    generators.addFamilyMember(family.id, sibling.id, 'sibling', 0);
    siblings.push(sibling);
  }

  // Cousins — real aunts/uncles (siblings of a REAL, LIVING parent
  // only; a deceased parent's own siblings are out of scope for this
  // round, same "declare the boundary" posture as grandparents) each
  // heading their own real, separately-placed family.
  const livingParents = [mother, father].filter((p) => p.alive);
  const auntsUncles = [];
  let auntUncleIndex = 0;
  for (const parent of livingParents) {
    const count = seededInt([seed, 'aunt-uncle-count', parent.entity.id], MAX_PARENT_SIBLINGS + 1);
    for (let i = 0; i < count; i += 1) {
      auntsUncles.push(generateAuntOrUncle(worldState, {
        generators, seed, tick, parentEntityId: parent.entity.id, surname, index: auntUncleIndex,
      }));
      auntUncleIndex += 1;
    }
  }
  const cousins = auntsUncles.flatMap((au) => au.cousins);
  // The player is really related to every real cousin — the schema's
  // own real `'family'` relationship_type, one row per real cousin, at
  // the real baseline rating (no bonus — see `seedFamilyBond`'s header).
  for (const cousin of cousins) {
    influence.seedFamilyBond(worldState, player.id, cousin.id);
  }

  // The player's own parents and siblings — closer kin than a cousin,
  // and seeded with the real `IMMEDIATE_FAMILY_BOND_BONUS` on top of
  // the baseline rating, by direct instruction: "the user's family
  // should have priority and have upper scales" over extended family.
  // Seeded regardless of whether a parent is alive or deceased — the
  // bond the row represents existed in life either way, same as a
  // `relationships` row for anyone else who has since died is still
  // read, never deleted, elsewhere in this engine.
  influence.seedFamilyBond(worldState, player.id, mother.entity.id, { immediate: true });
  influence.seedFamilyBond(worldState, player.id, father.entity.id, { immediate: true });
  for (const sibling of siblings) {
    influence.seedFamilyBond(worldState, player.id, sibling.id, { immediate: true });
  }

  return {
    player: { id: player.id, name: player.name, education: player.education },
    occupation,
    community: community ? { id: community.id, name: community.name, cityId: community.city_id } : null,
    countryContext: countryKey ? countryPacks.describeCountry(countryKey) : null,
    family: {
      id: family.id,
      surname: family.surname,
      parents: [
        {
          role: 'mother', alive: mother.alive, occupation: mother.occupationName,
          entityId: mother.entity.id,
        },
        {
          role: 'father', alive: father.alive, occupation: father.occupationName,
          entityId: father.entity.id,
        },
      ],
      siblings: siblings.map((s) => ({ id: s.id, name: s.name })),
    },
    cousins: auntsUncles.map((au) => ({
      auntOrUncle: { id: au.auntOrUncle.id, name: au.auntOrUncle.name },
      community: au.community ? { id: au.community.id, name: au.community.name } : null,
      children: au.cousins.map((c) => ({ id: c.id, name: c.name })),
    })),
  };
}

// ---------------------------------------------------------------------
// describeFamilyTree — the real LOOKUP, as opposed to createCharacter's
// real GENERATOR
// ---------------------------------------------------------------------
// `createCharacter`'s own return value is the only place this data was
// ever reported — asked once, at creation, and never again. This reads
// the same real, already-stored facts back for ANY entity (a player's
// own, or any ordinary NPC's), live, every time it is called, never
// from a cached snapshot — the same "observe and be affected by"
// posture `players.js#getCitizenDashboard` already holds itself to.
//
// Deliberately a pure read over `family_memberships`/`relationships`/
// `families`, not a second copy of `createCharacter`'s own generation
// logic — this function never calls `generateNpc`/`generateFamily`,
// it only looks at rows those functions (or `worldgen.js`'s own
// extended-family pass, see below) already wrote.
function entityBasics(worldState, entityId) {
  if (entityId == null) return null;
  const npc = (worldState.npcs || []).find((n) => n.id === entityId);
  if (npc) {
    return {
      id: entityId, name: npc.name, alive: true,
      occupation: occupations.occupationOf(worldState, entityId),
    };
  }
  const deceasedRecord = (worldState.deceased || []).find((n) => n.id === entityId);
  return {
    id: entityId, name: deceasedRecord ? deceasedRecord.name : null, alive: false, occupation: null,
  };
}

function communityOf(worldState, entityId) {
  const npc = (worldState.npcs || []).find((n) => n.id === entityId);
  if (!npc || npc.communityId == null) return null;
  const community = (worldState.communities || []).find((c) => c.id === npc.communityId);
  return community ? { id: community.id, name: community.name } : null;
}

function familyIdFor(worldState, entityId) {
  const row = (worldState.familyMemberships || []).find((m) => m.entity_id === entityId);
  return row ? row.family_id : null;
}

function familyMembersWithRole(worldState, familyId, role) {
  return (worldState.familyMemberships || [])
    .filter((m) => m.family_id === familyId && m.role === role)
    .map((m) => m.entity_id);
}

// Real cousins for a real parent: every `relationship_type: 'family'`
// row touching that parent whose OTHER party heads a REAL, DIFFERENT
// family record is that parent's own sibling — a real aunt or uncle —
// and that family's own `role: 'child'` members are the real cousins.
// The inverse of what `generateAuntOrUncle` builds, read back rather
// than re-derived.
function cousinsThroughParent(worldState, parentEntityId, ownFamilyId) {
  const groups = [];
  const touching = (worldState.relationships || []).filter(
    (r) => r.relationship_type === 'family'
      && (r.entity_a_id === parentEntityId || r.entity_b_id === parentEntityId),
  );
  for (const rel of touching) {
    const otherId = rel.entity_a_id === parentEntityId ? rel.entity_b_id : rel.entity_a_id;
    const auntUncleFamily = (worldState.families || []).find((f) => f.head_npc_id === otherId);
    if (!auntUncleFamily || auntUncleFamily.id === ownFamilyId) continue;
    const cousinIds = familyMembersWithRole(worldState, auntUncleFamily.id, 'child');
    groups.push({
      auntOrUncle: entityBasics(worldState, otherId),
      community: communityOf(worldState, otherId),
      children: cousinIds.map((id) => entityBasics(worldState, id)),
    });
  }
  return groups;
}

function describeFamilyTree(worldState, entityId) {
  const familyId = familyIdFor(worldState, entityId);
  if (familyId == null) {
    return { entityId, family: null, parents: [], siblings: [], cousins: [] };
  }
  const family = (worldState.families || []).find((f) => f.id === familyId);
  const parentIds = familyMembersWithRole(worldState, familyId, 'parent');
  const siblingIds = familyMembersWithRole(worldState, familyId, 'sibling');

  const cousins = parentIds.flatMap((pid) => cousinsThroughParent(worldState, pid, familyId));

  return {
    entityId,
    family: family ? { id: family.id, surname: family.surname } : null,
    parents: parentIds.map((pid) => entityBasics(worldState, pid)),
    siblings: siblingIds.map((sid) => entityBasics(worldState, sid)),
    cousins,
  };
}

module.exports = {
  PARENT_DECEASED_CHANCE,
  MAX_SIBLINGS,
  MAX_PARENT_SIBLINGS,
  MAX_COUSINS_PER_AUNT_UNCLE,
  createCharacter,
  describeFamilyTree,
  // Exported for `worldgen.js` to reuse directly — see that file's own
  // extended-family block for why this is the one piece of real
  // generation logic ordinary NPCs needed and createCharacter() already
  // had, rather than a second copy of "a new NPC, a new family, a
  // cross-family 'family' relationship link" living in worldgen.js too.
  generateAuntOrUncle,
};
