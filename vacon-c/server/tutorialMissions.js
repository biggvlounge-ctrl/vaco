// server/tutorialMissions.js
//
// Mission Chain #1 — "Start Here" — Chain #2 — "Ask Around" — Chain #3
// — "Keep Enough Set Aside" — Chain #4 — "Take the Block" — and Chain
// #5 — "Pick Your Fights". See `dev-docs/TUTORIAL_MISSIONS_DESIGN.md`
// for the full design note (the six-reference mapping this closes all
// five real slices of, and why each step is real rather than
// invented).
//
// **Chain #1, three real steps, no new mechanic, no schema change:**
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
//      who holds a real occupation. `call-meeting`'s `shares` flag
//      spreads facts for every purpose; a deliberate `study` against
//      that same person as an `experienced NPCs` source afterward is a
//      second, real, additional gain — see the design note's
//      correction on what a meeting actually moves.
//
// **Chain #2, "Ask Around" — Carmen Sandiego's own loop, already real:**
//
//   `crime.recordCrime` gives a real victim a real, confidence-weighted
//   fact naming who (probably) wronged them. `meetings.shareAround`
//   (every real purpose, not just `teach`) copies that fact onto
//   whoever the player brings to the table. `GET /api/npcs/:id` already
//   answers what an NPC now knows — no new read route needed.
//
// **Chain #3, "Keep Enough Set Aside" — Oregon Trail's own loop:**
//
//   `mortality.survivalScarcity` is a real, measured 0..1 reading of
//   how short a city is of food, water or medicine. `areaStats
//   .povertyLine`/`isBelowPovertyLine` against the player's own real
//   `getNetWorth` is the same threshold `crime.js`'s deprivation
//   checks read — falling below it, in a city that is really short, is
//   a real, elevated chance of being pushed into theft by
//   `crime.advanceFriction`'s own already-running mechanism. This
//   mission names a stake that is already live rather than seeding
//   one, so it is the one chain of the three that can be unavailable
//   in an ordinary, well-supplied world — a real and correct null, not
//   a gap. `trade`/`barter.exchange` (`server/actions.js`) is the real
//   verb a player has to answer it with: sell something they carry to
//   build savings back above the line.
//
// **Chain #4, "Take the Block" — River City Ransom, 2026:**
//
//   `control.viableTargetsFor` already ranks every real, currently
//   winnable target for a real tribe — `assess`'s own composition and
//   cohesion math, not a guess. This mission names the easiest real
//   property it finds and hands the player the two real verbs
//   (`assess-takeover`/`attempt-takeover`) that were already sitting
//   unused by any mission. "The gang" is the player's own real family
//   (`control.js`'s own cohesion math is exactly the tribe-loyalty
//   mechanic the reference asks for); "tools and weapons" are honestly
//   `control.materielOf`'s real §26 `tools`/`protection` categories,
//   not an invented weapon system — the design note records why
//   nothing sharper exists here.
//
// **Chain #5, "Pick Your Fights" — Contra's own stakes:**
//
//   The one reference left with a genuine open question rather than a
//   missing system: `contest.js` could already resolve a real,
//   dangerous fight, but the design note's own earlier pass named the
//   gap precisely — "a decision about what a lost fight costs the
//   player". `server/engine.js#resolveContest` now answers it: entering
//   the `combat` discipline through the dispatcher applies real stress
//   to both entrants (more to the loser) and a real memory of the
//   fight, through `behavior.applyStress`/`worldStore.addMemory` —
//   both already real, neither previously reached by a contest. The
//   other four disciplines (`competition.js`'s own safe settlement
//   games) are untouched on purpose. This mission names the single
//   toughest real opponent in the citizen's own community, by real
//   `combat` rating, and hands them the existing `enter-contest` verb
//   — no new action needed, the same shape as Chain #4.
//
// Every function here takes `worldState` explicitly, same convention as
// economy.js/players.js/missions.js.

'use strict';

const knowledge = require('./knowledge.js');
const inventory = require('./inventory.js');
const crime = require('./crime.js');
const discovery = require('./discovery.js');
const missions = require('./missions.js');
const occupations = require('./occupations.js');
const economy = require('./economy.js');
const areaStats = require('./areaStats.js');
const mortality = require('./mortality.js');
const control = require('./control.js');
const contest = require('./contest.js');

//: Chosen, not measured — there is nothing in this engine a tutorial
//: reward could be derived from, unlike the thresholds this project's
//: own standing rules insist on measuring. Small enough that a brand
//: new citizen's first missions do not distort the real economy
//: (`resolveMission` pays through the same real ledger every other
//: mission does); large enough to read as a real reward rather than a
//: token. Held here rather than inline so both missions agree.
const TUTORIAL_EXPLORE_REWARD = 40;
const TUTORIAL_MENTOR_REWARD = 40;
const TUTORIAL_MYSTERY_REWARD = 40;
const TUTORIAL_SURVIVAL_REWARD = 40;
const TUTORIAL_TAKEOVER_REWARD = 40;
const TUTORIAL_SHOWDOWN_REWARD = 40;

//: §26/crime.js's eight real categories, and the one that reads as
//: Carmen Sandiego's own register — mundane, solvable, not disturbing.
//: `violent`/`domestic`/`sex_offense` exist for a real simulation's own
//: reasons and have no place in a tutorial's first "who took this".
const TUTORIAL_CRIME_CATEGORY = 'theft';

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

// Chain #2, "Ask Around". Seeds one real crime incident (a real victim
// really comes away with a real, confidence-weighted fact about a real
// perpetrator — `crime.recordCrime`'s own §9 mechanic, not anything
// invented here) between two OTHER real NPCs in the citizen's
// community, then opens a real Mission naming the victim. The player
// learns the fact for real by `call-meeting`ing the victim — any real
// purpose shares it, per the design note's correction — and reads it
// back through the citizen's own already-real `GET /api/npcs/:id`.
//
// Returns null, not a thrown error, when the community does not have
// two other real people to cast as victim and perpetrator — a real,
// possible state for a small or freshly generated world.
function offerMysteryMission(worldState, npcId, options = {}) {
  const npc = (worldState.npcs || []).find((n) => n.id === npcId);
  if (!npc) throw new Error(`offerMysteryMission: no NPC ${npcId}`);
  if (npc.communityId == null) return null;

  const others = (worldState.npcs || []).filter(
    (other) => other.id !== npcId && other.communityId === npc.communityId,
  );
  if (others.length < 2) return null;
  const [victim, perpetrator] = others;

  const anchor = (worldState.properties || []).find((p) => p.community_id === npc.communityId);
  if (!anchor) return null;

  const incident = crime.recordCrime(worldState, {
    category: options.category ?? TUTORIAL_CRIME_CATEGORY,
    victimId: victim.id,
    perpetratorId: perpetrator.id,
    tick: worldState.tick,
  });

  const mission = missions.generateMission(worldState, {
    locationId: anchor.id,
    objective: `Find out who wronged ${victim.name} — ask around`,
    reward: options.reward ?? TUTORIAL_MYSTERY_REWARD,
  });
  return {
    mission, incident, victimId: victim.id, perpetratorId: perpetrator.id,
  };
}

// `knowledge.js` has its own private copy of exactly this lookup, for
// exactly the same reason `statecraft.js`/`trade.js`/`media.js` each
// do too — communities carry the real `city_id`, NPCs carry only
// `communityId`, and this file has no cause to reach into a sibling
// module's internals to save three lines.
function cityOf(worldState, npc) {
  const community = (worldState.communities || []).find((c) => c.id === npc.communityId);
  return community?.city_id ?? null;
}

// Chain #3, "Keep Enough Set Aside" — Oregon Trail's own loop: real
// resource pressure, not survival dressed up as flavour text.
//
// `mortality.survivalScarcity` is a real, measured 0..1 reading of how
// short a city actually is of food, water or medicine (the worst of
// the three, not the average — a city drowning in food and out of
// water is not coping). `areaStats.povertyLine`/`isBelowPovertyLine`
// is the exact real threshold `crime.js`'s two deprivation checks
// already read: a resident below it, in a city that is really short,
// has a real, elevated per-tick chance of being pushed into theft by
// `crime.advanceFriction`'s own mechanism — already running, nothing
// invented here. This mission does not manufacture a stake the way
// Chain #2 seeds a crime; it names a stake that is already live in the
// world, which is why it can fail to apply.
//
// Returns null, not a thrown error, when the city has no real
// scarcity reading at all — no food/water/medicine resources tracked
// for it, so there is nothing real to stake an Oregon Trail mission
// on. A freshly generated citizen with plenty all around is a real,
// possible state, same as a community with nothing left to search.
function offerSurvivalMission(worldState, npcId, options = {}) {
  const npc = (worldState.npcs || []).find((n) => n.id === npcId);
  if (!npc) throw new Error(`offerSurvivalMission: no NPC ${npcId}`);
  if (npc.communityId == null) return null;

  const cityId = cityOf(worldState, npc);
  const scarcity = mortality.survivalScarcity(worldState, cityId);
  if (scarcity <= 0) return null;

  const anchor = (worldState.properties || []).find((p) => p.community_id === npc.communityId);
  if (!anchor) return null;

  const line = areaStats.povertyLine(worldState);
  const netWorth = economy.getNetWorth(worldState, npcId);
  const atRisk = line !== null && areaStats.isBelowPovertyLine(netWorth, line);

  const mission = missions.generateMission(worldState, {
    locationId: anchor.id,
    objective: `Food, water or medicine is running short here (${Math.round(scarcity * 100)}% `
      + 'shortage) — keep enough set aside that you are not the one caught short',
    reward: options.reward ?? TUTORIAL_SURVIVAL_REWARD,
  });
  return {
    mission, cityId, scarcity, povertyLine: line, netWorth, atRisk,
  };
}

// Chain #4, "Take the Block" — River City Ransom, 2026.
// `control.viableTargetsFor` already ranks every real, currently
// winnable target for a real tribe — `assess()`'s own composition and
// cohesion math, not a guess here — so this names the single easiest
// one rather than assessing anything itself. Scoped to `scale:
// 'property'` targets only: `community`, `infrastructure` and
// `organization` scales are real targets too, but
// `missions.generateMission`'s `locationId` references a real
// PROPERTY row, so only a property target has a real column to sit
// in.
//
// Returns null, not a thrown error, when the citizen has no real
// family to act as a tribe with (`control.js`'s own "a tribe of one
// has none [cohesion] to measure") or when no property anywhere
// reachable is currently winnable for it — both real, possible
// states, same as the other three chains' preconditions.
function offerTakeoverMission(worldState, npcId, options = {}) {
  const npc = (worldState.npcs || []).find((n) => n.id === npcId);
  if (!npc) throw new Error(`offerTakeoverMission: no NPC ${npcId}`);

  const membership = (worldState.familyMemberships || []).find((m) => m.entity_id === npcId);
  if (!membership) return null;
  const tribeId = membership.family_id;

  const cityId = npc.communityId == null ? null : cityOf(worldState, npc);
  const targets = control
    .viableTargetsFor(worldState, { tribeId, cityId, tick: worldState.tick })
    .filter((t) => t.scale === 'property');
  if (targets.length === 0) return null;

  // Already sorted by `viableTargetsFor` — best odds first, fewest
  // people required as the tiebreak — so the first entry is the
  // easiest real target, which is the right one to hand a citizen
  // still learning the takeover key.
  const target = targets[0];
  const property = (worldState.properties || []).find((p) => p.id === target.locationId);
  if (!property) return null;
  const label = property.name
    ?? (property.landmark_category ? property.landmark_category.replace(/-/g, ' ') : property.type)
    ?? 'this property';

  const mission = missions.generateMission(worldState, {
    locationId: property.id,
    objective: `Your family could really take ${label} — check what it would take, then try it`,
    reward: options.reward ?? TUTORIAL_TAKEOVER_REWARD,
  });
  return {
    mission,
    tribeId,
    locationId: property.id,
    finalSuccessProbability: target.finalSuccessProbability,
  };
}

// Chain #5, "Pick Your Fights" — Contra's own stakes. Names the
// single toughest real opponent in the citizen's own community, by
// real `combat` rating (`contest.rateEntity`) — the reference asks for
// gameplay ENERGY, and a fight against the easiest person in town has
// none. The stakes themselves live in `engine.js#resolveContest` (real
// stress, a real memory), not here — this function only ever picks a
// real opponent and opens a real Mission naming them.
//
// Returns null, not a thrown error, when the citizen has no community
// (nobody to challenge, nowhere to anchor the Mission) — a real,
// possible state, same as the other four chains' preconditions.
function offerShowdownMission(worldState, npcId, options = {}) {
  const npc = (worldState.npcs || []).find((n) => n.id === npcId);
  if (!npc) throw new Error(`offerShowdownMission: no NPC ${npcId}`);
  if (npc.communityId == null) return null;

  const others = (worldState.npcs || []).filter(
    (other) => other.id !== npcId && other.communityId === npc.communityId,
  );
  if (others.length === 0) return null;

  const rated = others
    .map((other) => ({ npc: other, rating: contest.rateEntity(worldState, other.id, 'combat').rating }))
    .sort((a, b) => b.rating - a.rating);
  const opponent = rated[0];

  const anchor = (worldState.properties || []).find((p) => p.community_id === npc.communityId);
  if (!anchor) return null;

  const mission = missions.generateMission(worldState, {
    locationId: anchor.id,
    objective: `${opponent.npc.name} is the one to beat here — a real fight, real stakes`,
    reward: options.reward ?? TUTORIAL_SHOWDOWN_REWARD,
  });
  return {
    mission, opponentId: opponent.npc.id, opponentRating: opponent.rating,
  };
}

// The whole chain, offered together — what a citizen-mode player
// binding gets the instant they exist. Each half is independently
// optional (a community with nothing searchable, or nobody else
// employed, is a real state) so this reports what it actually managed
// rather than pretending every world can offer all five.
function seedTutorialStart(worldState, npcId, options = {}) {
  const book = giveStartingBook(worldState, npcId, options);
  const exploreMission = offerExploreMission(worldState, npcId, options);
  const mentor = offerMentorMission(worldState, npcId, options);
  const mystery = offerMysteryMission(worldState, npcId, options);
  const survival = offerSurvivalMission(worldState, npcId, options);
  const takeover = offerTakeoverMission(worldState, npcId, options);
  const showdown = offerShowdownMission(worldState, npcId, options);
  return {
    book,
    exploreMission,
    mentorMission: mentor?.mission ?? null,
    mentorId: mentor?.mentorId ?? null,
    mysteryMission: mystery?.mission ?? null,
    mysteryVictimId: mystery?.victimId ?? null,
    survivalMission: survival?.mission ?? null,
    survivalScarcity: survival?.scarcity ?? null,
    takeoverMission: takeover?.mission ?? null,
    takeoverLocationId: takeover?.locationId ?? null,
    showdownMission: showdown?.mission ?? null,
    showdownOpponentId: showdown?.opponentId ?? null,
  };
}

module.exports = {
  TUTORIAL_EXPLORE_REWARD,
  TUTORIAL_MENTOR_REWARD,
  TUTORIAL_MYSTERY_REWARD,
  TUTORIAL_SURVIVAL_REWARD,
  TUTORIAL_TAKEOVER_REWARD,
  TUTORIAL_SHOWDOWN_REWARD,
  TUTORIAL_CRIME_CATEGORY,
  DEFAULT_FIELD,
  giveStartingBook,
  offerExploreMission,
  offerMentorMission,
  offerMysteryMission,
  offerSurvivalMission,
  offerTakeoverMission,
  offerShowdownMission,
  seedTutorialStart,
};
