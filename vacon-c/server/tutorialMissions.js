// server/tutorialMissions.js
//
// Mission Chain #0 — "Secure Your Household" — Chain #1 — "Start
// Here" — Chain #2 — "Ask Around" — Chain #3 — "Keep Enough Set
// Aside" — Chain #4 — "Take the Block" — and Chain #5 — "Pick Your
// Fights". See `dev-docs/TUTORIAL_MISSIONS_DESIGN.md` for the
// original five-chain design note (the six-reference mapping, and why
// each step is real rather than invented).
//
// ---------------------------------------------------------------------
// Chain #0, by direct instruction — real, before anything else
// ---------------------------------------------------------------------
// The original five chains are a gameplay-variety tour (explore,
// gather clues, manage scarcity, take territory, pick a fight) and
// none of them is about the one thing a person in this engine's own
// collapse premise would really do first: get their own household in
// order. **Numbered zero rather than inserted before Chain #1**,
// deliberately — renumbering 1-5 would have meant rewriting every
// existing reference to them (this file's own doc comments, dev-docs,
// CLAUDE.md) for no real behavioural reason; "zero" says "runs first"
// without disturbing five chains that already work and are already
// documented elsewhere.
//
// Five real, ordered steps, in the order asked for directly — "see
// what's going on, secure your household... get your family
// together... secure food, weapons, [check on] outside family and
// friends" — each anchored to the SAME real property once one exists,
// no new mechanic, no schema change:
//
//   0a. **Assess your surroundings.** `authority.writOf` (the real
//       regime — governed/contested/lawless) and `crime
//       .dangerByCommunity` (the real, already-measured danger
//       reading) are read directly into the objective text, not
//       re-derived or guessed at.
//   0b. **Secure your household.** `characterCreation.createCharacter`
//       never assigns a new player a home (checked directly before
//       writing this — `grep -n "home_property_id" server/
//       characterCreation.js` returns nothing), so this is a REAL gap
//       a new citizen starts in, not a fact to confirm. `migration
//       .vacanciesByCommunity` is the exact real vacant-property
//       finder `migration.js` already built for task #47's own
//       "vacant/abandoned/condemned property takeover" — this mission
//       names one real, reachable, non-condemned home and hands the
//       player the existing `attempt-takeover` verb, the identical
//       shape Chain #4 already uses for a harder target.
//   0c. **Gather who's coming with you.** Names the player's own real,
//       living immediate family (`family_memberships`) by name; the
//       player assembles them with the existing `assemble-party` verb
//       — never a new one, same precedent `party.js`'s own header
//       argues against inventing a second escort mechanic.
//   0d. **Secure food and water.** This is NOT a new, parallel check —
//       it is Chain #3's own `offerSurvivalMission`, reused directly
//       rather than duplicated, because "keep enough set aside" and
//       "secure food and water for your family" are the identical
//       real concern (`mortality.survivalScarcity` against the real
//       poverty line) asked for in two different rounds. Building a
//       second scarcity check here would be two disagreeing answers
//       to one question — the third standing rule's own shape.
//   0e. **Secure a way to defend it.** The same honest limit Chain
//       #4's own design note already states: "there is no dedicated
//       weapon category, only tools... and crafted `protection`
//       items." This names the real `salvage.make` crafting path
//       (e.g. `zip_gun`, a real Tier 2 `protection`-category
//       craftable) rather than implying a weapon shop this engine
//       does not model.
//   0f. **Check on everyone else.** `characterCreation
//       .describeFamilyTree` is the real, live read of the player's
//       own parents/siblings/cousins (alive or not — the same honest
//       accounting that function already gives); named directly in
//       the objective rather than left as "go find out."
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
// **The progress tracker.** `seedTutorialStart` hands back every
// mission it opened once, in the HTTP response — and nothing
// remembered which real Mission ids belonged to a citizen's own
// tutorial sequence afterward, so there was no way to ask "where am I
// in this" later without re-seeding. `tutorialProgressFor` answers it
// from `worldState.tutorialProgress` (ids only, never a status —
// status is read live from `missions.getMission`, standing rule 3's
// own argument against duplicating a computable rollup).
//
// Chain #1 is reported as its own two real Missions (explore, mentor)
// rather than one collapsed "done" boolean — collapsing it would mean
// inventing a rule for what "chain 1 complete" means that neither
// mission's own state machine asserts.
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
const migration = require('./migration.js');
const authority = require('./authority.js');
const characterCreation = require('./characterCreation.js');
const statecraft = require('./statecraft.js');
const schoolSystem = require('./schoolSystem.js');

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
const TUTORIAL_ASSESS_REWARD = 40;
const TUTORIAL_HOUSEHOLD_REWARD = 40;
const TUTORIAL_FAMILY_REWARD = 40;
const TUTORIAL_WEAPONS_REWARD = 40;
const TUTORIAL_CHECKIN_REWARD = 40;
const TUTORIAL_KIDS_REWARD = 40;
const TUTORIAL_COLLEAGUES_REWARD = 40;

// **Flagged interpretive.** `statecraft.SCHOOL_AGE_MIN` (5) is reused
// directly; this upper bound is the standard compulsory K-12 age,
// chosen so it partitions cleanly against `students
// .COLLEGE_AGE_MIN` (18) rather than overlapping it — a school-age
// child is fetched FROM school, a college-age adult is not.
const CHILD_SCHOOL_AGE_MAX = 18;

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

// ---------------------------------------------------------------------
// Chain #0, "Secure Your Household" — real, before anything else.
// See the file header for the full real mapping.
// ---------------------------------------------------------------------

// A real, generic anchor property in the citizen's own community —
// the same fallback every Chain 1-5 function already uses when a
// mission is about something other than a specific place.
function communityAnchor(worldState, communityId) {
  return (worldState.properties || []).find((p) => p.community_id === communityId) ?? null;
}

// 0a. Real surroundings, read directly rather than guessed at.
// `authority.writOf` can read `writ: null` for an area with nothing
// measured yet — a real, honest state this names rather than hides.
function offerAssessSurroundingsMission(worldState, npcId, options = {}) {
  const npc = (worldState.npcs || []).find((n) => n.id === npcId);
  if (!npc) throw new Error(`offerAssessSurroundingsMission: no NPC ${npcId}`);
  if (npc.communityId == null) return null;

  const anchor = options.anchorPropertyId != null
    ? (worldState.properties || []).find((p) => p.id === options.anchorPropertyId)
    : communityAnchor(worldState, npc.communityId);
  if (!anchor) return null;

  const reading = authority.writOf(worldState, npc.communityId);
  const danger = crime.dangerByCommunity(worldState).get(npc.communityId) ?? null;
  const regimeText = reading.regime ?? 'an unmeasured area';
  const dangerText = danger === null ? 'an unmeasured danger level' : `a danger level of ${Math.round(danger * 100) / 100}`;

  const mission = missions.generateMission(worldState, {
    locationId: anchor.id,
    objective: `See what's really going on here first — this area reads ${regimeText}, with ${dangerText}`,
    reward: options.reward ?? TUTORIAL_ASSESS_REWARD,
  });
  return { mission, regime: reading.regime, danger };
}

// 0a2. "If you have kids, get the kids from school" — by direct
// instruction. A real child is a real `family_memberships` row with
// `role: 'child'` in the citizen's own family (the same real shape
// `births.js#runBirths` already writes for a newborn, read rather
// than duplicated), still really enrolled (`npc.schoolEnrolled`,
// `statecraft.runSchooling`'s own real field) and still under the
// real compulsory age. This engine has no PER-BUILDING attendance
// record for a K-12 student — `students.js` built that for
// university enrollment specifically (task #70) and school.js's own
// `schoolSystemInventory` reports buildings, never who is in one — so
// the real anchor is the nearest real school building in the
// citizen's own city, context for where to go, not a claim about
// which specific one this child attends.
function offerKidsFromSchoolMission(worldState, npcId, options = {}) {
  const npc = (worldState.npcs || []).find((n) => n.id === npcId);
  if (!npc) throw new Error(`offerKidsFromSchoolMission: no NPC ${npcId}`);

  const membership = (worldState.familyMemberships || []).find((m) => m.entity_id === npcId);
  if (!membership) return null;

  const children = (worldState.familyMemberships || [])
    .filter((m) => m.family_id === membership.family_id && m.role === 'child')
    .map((m) => (worldState.npcs || []).find((n) => n.id === m.entity_id))
    .filter((n) => n && n.status !== 'deceased' && n.schoolEnrolled === true)
    .filter((n) => {
      const age = mortality.ageInYears(worldState, n, worldState.tick);
      return age !== null && age >= statecraft.SCHOOL_AGE_MIN && age < CHILD_SCHOOL_AGE_MAX;
    });
  if (children.length === 0) return null;

  const cityId = npc.communityId == null ? null : cityOf(worldState, npc);
  const schools = cityId == null ? [] : schoolSystem.schoolsOf(worldState, cityId);
  const anchor = schools[0] ?? communityAnchor(worldState, npc.communityId);
  if (!anchor) return null;

  const names = children.map((c) => c.name ?? `entity ${c.id}`).join(', ');
  const mission = missions.generateMission(worldState, {
    locationId: anchor.id,
    objective: `Get your kids from school before anything else — ${names} are still there`,
    reward: options.reward ?? TUTORIAL_KIDS_REWARD,
  });
  return { mission, childIds: children.map((c) => c.id) };
}

// 0a3. "If you're coming from work, deal with your work colleagues"
// — by direct instruction. The citizen's own real, currently-active
// coworkers (`economy.listEmployment`, the same real employer id
// `economy.getEmployment` already reads), excluding the citizen
// themselves.
function offerWorkColleaguesMission(worldState, npcId, options = {}) {
  const npc = (worldState.npcs || []).find((n) => n.id === npcId);
  if (!npc) throw new Error(`offerWorkColleaguesMission: no NPC ${npcId}`);

  const employment = economy.getEmployment(worldState, npcId);
  if (!employment) return null;

  const colleagues = economy.listEmployment(worldState, {
    employerOrganizationId: employment.employer_organization_id, status: 'active',
  })
    .filter((r) => r.entity_id !== npcId)
    .map((r) => (worldState.npcs || []).find((n) => n.id === r.entity_id))
    .filter((n) => n && n.status !== 'deceased');
  if (colleagues.length === 0) return null;

  const anchor = options.anchorPropertyId != null
    ? (worldState.properties || []).find((p) => p.id === options.anchorPropertyId)
    : communityAnchor(worldState, npc.communityId);
  if (!anchor) return null;

  const names = colleagues.map((c) => c.name ?? `entity ${c.id}`).join(', ');
  const mission = missions.generateMission(worldState, {
    locationId: anchor.id,
    objective: `Deal with your own people at work before you go — ${names} are in this too`,
    reward: options.reward ?? TUTORIAL_COLLEAGUES_REWARD,
  });
  return { mission, colleagueIds: colleagues.map((c) => c.id) };
}

// 0b. The real gap: `createCharacter` never assigns a new player a
// home (see the file header). `migration.vacanciesByCommunity` is the
// exact real vacant-property finder task #47 already built — this
// names one real, reachable, non-condemned home and hands the player
// the existing `attempt-takeover` verb, the same shape Chain #4
// already uses for a harder target. Returns null when the citizen's
// own community genuinely has no real vacancy — possible, and honest,
// the same way every other chain here can come up empty.
function offerSecureHouseholdMission(worldState, npcId, options = {}) {
  const npc = (worldState.npcs || []).find((n) => n.id === npcId);
  if (!npc) throw new Error(`offerSecureHouseholdMission: no NPC ${npcId}`);
  if (npc.communityId == null) return null;

  // No separate "any vacancy at all" check — an empty real list makes
  // `vacancies[0]` `undefined`, which the real `!property` guard below
  // already catches on its own; a second check ahead of it would be
  // the twentieth standing rule's own decorative-guard shape, found by
  // mutating it and finding nothing broke.
  const vacancies = migration.vacanciesByCommunity(worldState).get(npc.communityId) ?? [];
  const property = (worldState.properties || []).find((p) => p.id === vacancies[0]);
  if (!property) return null;
  const label = property.name ?? 'a real, empty home nearby';

  const mission = missions.generateMission(worldState, {
    locationId: property.id,
    objective: `Secure your household first — ${label} stands empty; hold it, and it is yours`,
    reward: options.reward ?? TUTORIAL_HOUSEHOLD_REWARD,
  });
  return { mission, propertyId: property.id };
}

// 0c. The player's own real, living immediate family, named directly
// — the player assembles them with the existing `assemble-party`
// verb. Returns null when the citizen has no real family at all
// (createCharacter always gives one, but a world built another way
// might not) — the same honest-null posture Chain #4 already takes
// for the identical "no family to act as a tribe" precondition.
function offerGatherFamilyMission(worldState, npcId, options = {}) {
  const npc = (worldState.npcs || []).find((n) => n.id === npcId);
  if (!npc) throw new Error(`offerGatherFamilyMission: no NPC ${npcId}`);

  const membership = (worldState.familyMemberships || []).find((m) => m.entity_id === npcId);
  if (!membership) return null;

  const members = (worldState.familyMemberships || [])
    .filter((m) => m.family_id === membership.family_id && m.entity_id !== npcId)
    .map((m) => (worldState.npcs || []).find((n) => n.id === m.entity_id))
    .filter((n) => n && n.status !== 'deceased');
  if (members.length === 0) return null;

  const anchor = options.anchorPropertyId != null
    ? (worldState.properties || []).find((p) => p.id === options.anchorPropertyId)
    : communityAnchor(worldState, npc.communityId);
  if (!anchor) return null;

  const names = members.map((m) => m.name ?? `entity ${m.id}`).join(', ');
  const mission = missions.generateMission(worldState, {
    locationId: anchor.id,
    objective: `Choose who's coming with you — gather ${names} before you do anything else`,
    reward: options.reward ?? TUTORIAL_FAMILY_REWARD,
  });
  return { mission, memberIds: members.map((m) => m.id) };
}

// 0e. The same honest limit Chain #4's own design note already states
// — no dedicated weapon category, only crafted real `protection`
// items (`salvage.make`). Named directly rather than implying a
// weapon shop this engine does not model.
function offerWeaponsMission(worldState, npcId, options = {}) {
  const npc = (worldState.npcs || []).find((n) => n.id === npcId);
  if (!npc) throw new Error(`offerWeaponsMission: no NPC ${npcId}`);
  if (npc.communityId == null) return null;

  const anchor = options.anchorPropertyId != null
    ? (worldState.properties || []).find((p) => p.id === options.anchorPropertyId)
    : communityAnchor(worldState, npc.communityId);
  if (!anchor) return null;

  const mission = missions.generateMission(worldState, {
    locationId: anchor.id,
    objective: 'Find a real way to defend what\'s now yours — craft or carry something real, not nothing',
    reward: options.reward ?? TUTORIAL_WEAPONS_REWARD,
  });
  return { mission };
}

// 0f. `characterCreation.describeFamilyTree` is the real, live read of
// the player's own parents/siblings/cousins — named directly, alive
// or not, the same honest accounting that function already gives.
function offerCheckOnFamilyMission(worldState, npcId, options = {}) {
  const npc = (worldState.npcs || []).find((n) => n.id === npcId);
  if (!npc) throw new Error(`offerCheckOnFamilyMission: no NPC ${npcId}`);

  const tree = characterCreation.describeFamilyTree(worldState, npcId);
  const named = [...tree.parents, ...tree.siblings, ...tree.cousins]
    .map((p) => p.name ?? `entity ${p.id}`);
  if (named.length === 0) return null;

  const anchor = options.anchorPropertyId != null
    ? (worldState.properties || []).find((p) => p.id === options.anchorPropertyId)
    : communityAnchor(worldState, npc.communityId);
  if (!anchor) return null;

  const mission = missions.generateMission(worldState, {
    locationId: anchor.id,
    objective: `Check on everyone else once your own house is in order — ${named.join(', ')}`,
    reward: options.reward ?? TUTORIAL_CHECKIN_REWARD,
  });
  return { mission, namedCount: named.length };
}

// The whole chain, offered together — what a citizen-mode player
// binding gets the instant they exist. Each half is independently
// optional (a community with nothing searchable, or nobody else
// employed, is a real state) so this reports what it actually managed
// rather than pretending every world can offer all five.
function seedTutorialStart(worldState, npcId, options = {}) {
  // Chain #0 first, in the real order asked for — "secure your
  // household" before anything else, so every later Chain #0 step
  // anchors at the player's own new real home once one exists, same
  // `(worldState.properties || []).find(...)` fallback otherwise.
  const assess = offerAssessSurroundingsMission(worldState, npcId, options);
  const kids = offerKidsFromSchoolMission(worldState, npcId, options);
  const colleagues = offerWorkColleaguesMission(worldState, npcId, options);
  const household = offerSecureHouseholdMission(worldState, npcId, options);
  const chain0Options = { ...options, anchorPropertyId: household?.propertyId ?? null };
  const gatherFamily = offerGatherFamilyMission(worldState, npcId, chain0Options);
  const weapons = offerWeaponsMission(worldState, npcId, chain0Options);
  const checkOnFamily = offerCheckOnFamilyMission(worldState, npcId, chain0Options);

  const book = giveStartingBook(worldState, npcId, options);
  const exploreMission = offerExploreMission(worldState, npcId, options);
  const mentor = offerMentorMission(worldState, npcId, options);
  const mystery = offerMysteryMission(worldState, npcId, options);
  // **One real call, two real roles.** Chain #0's own "secure food and
  // water" step and Chain #3's "Keep Enough Set Aside" are the
  // identical real concern (see the file header) — calling
  // `offerSurvivalMission` a second time here would open a second,
  // nearly-identical real Mission for the same scarcity reading,
  // which is the third standing rule's own shape. One call, reported
  // under both labels below.
  const survival = offerSurvivalMission(worldState, npcId, chain0Options);
  const takeover = offerTakeoverMission(worldState, npcId, options);
  const showdown = offerShowdownMission(worldState, npcId, options);
  const start = {
    assessMission: assess?.mission ?? null,
    assessRegime: assess?.regime ?? null,
    kidsFromSchoolMission: kids?.mission ?? null,
    kidsFromSchoolChildIds: kids?.childIds ?? null,
    workColleaguesMission: colleagues?.mission ?? null,
    workColleaguesIds: colleagues?.colleagueIds ?? null,
    householdMission: household?.mission ?? null,
    householdPropertyId: household?.propertyId ?? null,
    gatherFamilyMission: gatherFamily?.mission ?? null,
    gatherFamilyMemberIds: gatherFamily?.memberIds ?? null,
    weaponsMission: weapons?.mission ?? null,
    checkOnFamilyMission: checkOnFamily?.mission ?? null,
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
  recordTutorialProgress(worldState, npcId, start);
  return start;
}

// ---------------------------------------------------------------------
// The progress tracker
// ---------------------------------------------------------------------
// **Chain 1, "Start Here", is really two real Missions** (explore the
// landmark, learn from the mentor) plus the seeded book — see the file
// header for why the book is not a third. Reported as two rows under
// one chain label rather than collapsed into a single "done" boolean,
// because collapsing would mean inventing a rule for what "chain 1
// complete" means that neither mission's own state machine asserts.
//
// `missionKey` names the field `seedTutorialStart`'s own return object
// already uses — one table, read in both directions, so a renamed
// field here fails loudly instead of quietly tracking nothing.
// **Chain 0's own "secure food and water" step and Chain 3's "Keep
// Enough Set Aside" share one missionKey (`survivalMission`) on
// purpose — see the file header and `seedTutorialStart`'s own
// comment. Listing it twice here, once per real label, means
// completing the one real mission correctly advances both chains'
// own count rather than one of them silently never reaching 100%.**
const CHAIN_MISSIONS = [
  { chain: 0, name: 'Secure Your Household', part: 'see what\'s going on', missionKey: 'assessMission' },
  { chain: 0, name: 'Secure Your Household', part: 'get your kids from school', missionKey: 'kidsFromSchoolMission' },
  { chain: 0, name: 'Secure Your Household', part: 'deal with your work colleagues', missionKey: 'workColleaguesMission' },
  { chain: 0, name: 'Secure Your Household', part: 'secure your household', missionKey: 'householdMission' },
  { chain: 0, name: 'Secure Your Household', part: 'gather who\'s coming with you', missionKey: 'gatherFamilyMission' },
  { chain: 0, name: 'Secure Your Household', part: 'secure food and water', missionKey: 'survivalMission' },
  { chain: 0, name: 'Secure Your Household', part: 'secure a way to defend it', missionKey: 'weaponsMission' },
  { chain: 0, name: 'Secure Your Household', part: 'check on everyone else', missionKey: 'checkOnFamilyMission' },
  { chain: 1, name: 'Start Here', part: 'explore the landmark', missionKey: 'exploreMission' },
  { chain: 1, name: 'Start Here', part: 'learn from the mentor', missionKey: 'mentorMission' },
  { chain: 2, name: 'Ask Around', part: null, missionKey: 'mysteryMission' },
  { chain: 3, name: 'Keep Enough Set Aside', part: null, missionKey: 'survivalMission' },
  { chain: 4, name: 'Take the Block', part: null, missionKey: 'takeoverMission' },
  { chain: 5, name: 'Pick Your Fights', part: null, missionKey: 'showdownMission' },
];

// **Only the mission id is stored — never a status.** A mission's
// status is computable from the mission itself at any time
// (`missions.getMission`), and standing rule 3 is explicit that a
// computable rollup is never duplicated. The id is the one fact this
// row exists to remember: nothing else in the engine records which
// Missions belong to a citizen's own tutorial sequence, and without it
// a progress read after the seeding response is gone would have
// nothing to look up.
function recordTutorialProgress(worldState, npcId, start) {
  if (!Array.isArray(worldState.tutorialProgress)) worldState.tutorialProgress = [];
  const row = {
    entityId: npcId,
    assessMissionId: start.assessMission?.id ?? null,
    kidsFromSchoolMissionId: start.kidsFromSchoolMission?.id ?? null,
    workColleaguesMissionId: start.workColleaguesMission?.id ?? null,
    householdMissionId: start.householdMission?.id ?? null,
    gatherFamilyMissionId: start.gatherFamilyMission?.id ?? null,
    weaponsMissionId: start.weaponsMission?.id ?? null,
    checkOnFamilyMissionId: start.checkOnFamilyMission?.id ?? null,
    bookField: start.book?.field ?? null,
    exploreMissionId: start.exploreMission?.id ?? null,
    mentorMissionId: start.mentorMission?.id ?? null,
    mysteryMissionId: start.mysteryMission?.id ?? null,
    survivalMissionId: start.survivalMission?.id ?? null,
    takeoverMissionId: start.takeoverMission?.id ?? null,
    showdownMissionId: start.showdownMission?.id ?? null,
  };
  const existing = (worldState.tutorialProgress || []).findIndex((r) => r.entityId === npcId);
  if (existing === -1) worldState.tutorialProgress.push(row);
  else worldState.tutorialProgress[existing] = row;
  return row;
}

// The real, live read a tracker needs: every tutorial Mission this
// citizen was ever offered, with its CURRENT status, not the status at
// the moment it was seeded. Returns an honest "not offered" rather
// than a thrown error for a chain whose real precondition never held
// (no community, no family, nobody to fight) — the same null-is-not-a-
// gap posture every `offer*Mission` function already takes.
function tutorialProgressFor(worldState, npcId) {
  const npc = (worldState.npcs || []).find((n) => n.id === npcId);
  if (!npc) throw new Error(`tutorialProgressFor: no NPC ${npcId}`);

  const row = (worldState.tutorialProgress || []).find((r) => r.entityId === npcId) ?? null;
  const chainMissions = CHAIN_MISSIONS.map((entry) => {
    const missionId = row ? row[`${entry.missionKey}Id`] ?? null : null;
    const mission = missionId != null ? missions.getMission(worldState, missionId) : null;
    return {
      chain: entry.chain,
      name: entry.name,
      part: entry.part,
      missionId,
      status: missionId == null ? 'not offered' : (mission?.status ?? 'unknown'),
    };
  });

  const completedCount = chainMissions.filter((m) => m.status === 'completed').length;
  return {
    book: { given: row?.bookField != null, field: row?.bookField ?? null },
    chainMissions,
    totalMissions: chainMissions.length,
    completedCount,
    allComplete: completedCount === chainMissions.length,
  };
}

module.exports = {
  TUTORIAL_EXPLORE_REWARD,
  TUTORIAL_MENTOR_REWARD,
  TUTORIAL_MYSTERY_REWARD,
  TUTORIAL_SURVIVAL_REWARD,
  TUTORIAL_TAKEOVER_REWARD,
  TUTORIAL_SHOWDOWN_REWARD,
  TUTORIAL_ASSESS_REWARD,
  TUTORIAL_KIDS_REWARD,
  TUTORIAL_COLLEAGUES_REWARD,
  TUTORIAL_HOUSEHOLD_REWARD,
  TUTORIAL_FAMILY_REWARD,
  TUTORIAL_WEAPONS_REWARD,
  TUTORIAL_CHECKIN_REWARD,
  TUTORIAL_CRIME_CATEGORY,
  DEFAULT_FIELD,
  giveStartingBook,
  offerAssessSurroundingsMission,
  offerKidsFromSchoolMission,
  offerWorkColleaguesMission,
  offerSecureHouseholdMission,
  offerGatherFamilyMission,
  offerWeaponsMission,
  offerCheckOnFamilyMission,
  offerExploreMission,
  offerMentorMission,
  offerMysteryMission,
  offerSurvivalMission,
  offerTakeoverMission,
  offerShowdownMission,
  seedTutorialStart,
  CHAIN_MISSIONS,
  recordTutorialProgress,
  tutorialProgressFor,
};
