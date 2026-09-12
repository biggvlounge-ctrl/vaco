// server/technology.js
//
// Civilizations, technology eras, and the prerequisite chain that gates
// them — §40's bottleneck logic, which this repo claimed was built and
// was not.
//
// **The claim, and why it was wrong.** The implementation map marked
// §40 BUILT on the grounds that "`technology_eras.requirements` is the
// dependency chain". It is — as a JSONB column in a table **no engine
// code read**, alongside `civilization_technology_progress` and
// `civilizations`, all three dead. So nothing gated a technology on
// anything, and "the dependency chain exists" meant "a column exists
// where a dependency chain could go". Corrected in the map, and built
// here.
//
// Four dead tables become live together because they are one system:
// a civilization, the eras it can reach, the ladder between them, and
// the record of what it has unlocked.
//
// ---------------------------------------------------------------------
// What comes from the schema and what is a choice
//
// **The ten era names and their order are the schema's own.**
// `technology_eras.name` carries the enumeration verbatim:
// stone_tools | agriculture | metalworking | writing | engineering |
// industrialization | electricity | computing | ai |
// advanced_robotics. Nothing here adds an eleventh or reorders them.
//
// **The `requirements` shape is a choice**, because the column is
// JSONB with no specified structure. Two keys, both flagged
// interpretive below: `eras` (the ladder) and `minReemergence` (the
// world condition). A requirements object with neither is a starting
// era, which is how `stone_tools` is reachable from nothing.
//
// **What gates an unlock is the world, not a die roll.** §66 says
// technology advances "through discovery, knowledge, resources,
// specialists, manufacturing, infrastructure". The one real,
// already-computed signal for that is `worldState.reemergenceIndex`,
// which `runReemergencePhase` derives from the population's live
// Resilience and Adaptability. So an era needs its prerequisite eras
// AND a population capable of it. That is a formula where no document
// gives one — the same interpretive licence the z-score detector,
// world-layer's propagation and VACON-C's own territory thresholds
// took, flagged the same way.
//
// ---------------------------------------------------------------------
// Where this runs
//
// Inside `runReemergencePhase`, after the index it depends on is
// computed. The pipeline is locked at eleven phases and this is the
// same phase's subject — civilization coming back — so it is not a
// twelfth thing.

'use strict';

const { nextAfter } = require('./nextAfter.js');

let nextCivilizationId = 1;
let nextTechnologyEraId = 1;

// Verbatim from `technology_eras.name`'s enumeration comment, in the
// order the comment gives, which is what `era_order` records.
const ERA_NAMES = [
  'stone_tools', 'agriculture', 'metalworking', 'writing', 'engineering',
  'industrialization', 'electricity', 'computing', 'ai', 'advanced_robotics',
];

//: Flagged interpretive. No document sets a reemergence requirement per
//: era. This spaces the ten eras evenly across the index's 0..100
//: range — `stone_tools` needs nothing, `advanced_robotics` needs 90 —
//: so a collapsed world climbs the ladder as its people recover rather
//: than all at once.
function minReemergenceFor(order) {
  return (order - 1) * 10;
}

// -- civilizations ------------------------------------------------------

function foundCivilization(worldState, options = {}) {
  const { name, era = null, stabilityIndex = 50 } = options;
  if (!name) throw new Error('foundCivilization requires a name');
  if (!Number.isFinite(stabilityIndex)) {
    throw new Error('foundCivilization requires a finite stabilityIndex');
  }
  // `era` is the civilization's current era name, so it has to be one
  // of the ten or null. A free-text era would put a second, disagreeing
  // answer next to `civilization_technology_progress`.
  if (era !== null && !ERA_NAMES.includes(era)) {
    throw new Error(`foundCivilization: era must be null or one of ${ERA_NAMES.join(', ')}`);
  }

  const civilization = {
    id: nextCivilizationId++,
    name,
    era,
    stability_index: stabilityIndex,
  };
  worldState.civilizations.push(civilization);
  return civilization;
}

function getCivilization(worldState, civilizationId) {
  return worldState.civilizations.find((c) => c.id === civilizationId) || null;
}

// -- the era ladder -----------------------------------------------------

// Writes the ten eras with their order and requirements. Idempotent:
// calling it twice does not duplicate the ladder, because a world that
// is restored and then seeded again is a real sequence.
function seedTechnologyEras(worldState) {
  if (worldState.technologyEras.length > 0) return worldState.technologyEras;

  ERA_NAMES.forEach((name, index) => {
    const order = index + 1;
    worldState.technologyEras.push({
      id: nextTechnologyEraId++,
      name,
      era_order: order,
      // The ladder: each era requires the one before it. `stone_tools`
      // requires nothing, which is what makes a collapsed world able
      // to start.
      requirements: {
        eras: index === 0 ? [] : [ERA_NAMES[index - 1]],
        minReemergence: minReemergenceFor(order),
      },
    });
  });
  return worldState.technologyEras;
}

function getEra(worldState, name) {
  return worldState.technologyEras.find((e) => e.name === name) || null;
}

function unlockedEras(worldState, civilizationId) {
  const unlocked = worldState.civilizationTechnologyProgress
    .filter((p) => p.civilization_id === civilizationId);
  const byId = new Map(worldState.technologyEras.map((e) => [e.id, e]));
  return unlocked
    .map((p) => ({ ...p, era: byId.get(p.era_id) || null }))
    .filter((p) => p.era !== null)
    .sort((a, b) => a.era.era_order - b.era.era_order);
}

// **This is §40.** Returns why, not just whether — an unlock that
// fails silently is indistinguishable from one nobody attempted, and a
// bottleneck you cannot see the reason for is not a bottleneck anybody
// can act on.
function canUnlock(worldState, options = {}) {
  const { civilizationId, eraName } = options;
  const era = getEra(worldState, eraName);
  if (!era) return { ok: false, reason: `no era "${eraName}"` };
  if (!getCivilization(worldState, civilizationId)) {
    return { ok: false, reason: `no civilization ${civilizationId}` };
  }

  const already = unlockedEras(worldState, civilizationId).some((p) => p.era.name === eraName);
  if (already) return { ok: false, reason: `${eraName} is already unlocked` };

  const requirements = era.requirements || {};
  const have = new Set(unlockedEras(worldState, civilizationId).map((p) => p.era.name));
  const missing = (requirements.eras || []).filter((name) => !have.has(name));
  if (missing.length > 0) {
    return { ok: false, reason: `requires ${missing.join(', ')}`, missingEras: missing };
  }

  const needed = requirements.minReemergence;
  // **`needed > 0`, not just finite.** `stone_tools` asks for 0, and
  // checking a requirement of zero against an uncomputed index refused
  // the FIRST era on a world that had not ticked yet — so a collapsed
  // world could never start, which is the one thing the zero is there
  // to permit. Found by the test for the null case: it asserted a
  // refusal reason and got a thrown error from the era above.
  //
  // A requirement of zero is not a requirement.
  if (Number.isFinite(needed) && needed > 0) {
    const index = worldState.reemergenceIndex;
    // **Null is not zero, again.** A world whose reemergence index has
    // never been computed has an unknown capability, not none — and
    // treating it as 0 would block every era above the first on a world
    // that simply has not ticked yet.
    if (index === null || index === undefined) {
      return { ok: false, reason: 'reemergence index not computed yet', needed };
    }
    if (Number(index) < needed) {
      return {
        ok: false,
        reason: `reemergence ${index} below the ${needed} this era needs`,
        needed,
        have: Number(index),
      };
    }
  }

  return { ok: true, reason: null };
}

function unlockEra(worldState, options = {}) {
  const { civilizationId, eraName, tick = worldState.tick ?? 0, force = false } = options;
  const check = canUnlock(worldState, { civilizationId, eraName });
  if (!check.ok) {
    // **Two refusals are fatal whatever `force` says**, and the first
    // version of this buried that in a three-clause boolean nobody
    // could read: an era or civilization that does not exist, and an
    // era already unlocked. Forcing either would write a row
    // referencing nothing, or a duplicate primary key.
    //
    // `force` exists for a restore or a scenario that places a world
    // mid-ladder, and it is a named argument rather than implicit so a
    // forced unlock is visible at the call site.
    const fatal = check.reason.startsWith('no ') || check.reason.includes('already');
    if (fatal || !force) throw new Error(`unlockEra: ${check.reason}`);
  }

  const era = getEra(worldState, eraName);
  const progress = {
    civilization_id: civilizationId,
    era_id: era.id,
    unlocked_tick: tick,
  };
  worldState.civilizationTechnologyProgress.push(progress);

  // The civilization's current era is the highest it has unlocked.
  // Stored on the row because the schema has the column — and kept
  // consistent here rather than left to callers, which is what would
  // put two disagreeing answers in the world.
  const highest = unlockedEras(worldState, civilizationId).at(-1);
  const civilization = getCivilization(worldState, civilizationId);
  if (civilization && highest) civilization.era = highest.era.name;

  return progress;
}

// The next era a civilization could reach, and what is stopping it.
// **The useful shape for a bottleneck**: a caller asking "why is this
// world stuck" gets an answer rather than a boolean.
function nextEraFor(worldState, civilizationId) {
  const have = new Set(unlockedEras(worldState, civilizationId).map((p) => p.era.name));
  const next = worldState.technologyEras
    .slice()
    .sort((a, b) => a.era_order - b.era_order)
    .find((e) => !have.has(e.name));
  if (!next) return { eraName: null, blocked: false, reason: 'every era is unlocked' };

  const check = canUnlock(worldState, { civilizationId, eraName: next.name });
  return {
    eraName: next.name,
    blocked: !check.ok,
    reason: check.reason,
    ...(check.needed !== undefined ? { needed: check.needed } : {}),
    ...(check.have !== undefined ? { have: check.have } : {}),
  };
}

// -- the phase hook -----------------------------------------------------

// Advances every civilization by at most one era per tick. One, not
// all it qualifies for: a world that sat below a threshold for a
// hundred ticks and then crossed it should not jump from stone tools
// to computing in a single tick because the index rose.
function runTechnology(worldState, tick) {
  const events = [];
  const unlocks = [];
  for (const civilization of worldState.civilizations) {
    const next = nextEraFor(worldState, civilization.id);
    if (next.eraName === null || next.blocked) continue;
    unlocks.push(unlockEra(worldState, {
      civilizationId: civilization.id, eraName: next.eraName, tick,
    }));
    events.push({
      type: 'technology_era_unlocked',
      civilizationId: civilization.id,
      era: next.eraName,
      reemergenceIndex: worldState.reemergenceIndex,
      tick,
    });
  }
  return { unlocks, events };
}

function reseedIds(worldState) {
  nextCivilizationId = nextAfter(worldState.civilizations);
  nextTechnologyEraId = nextAfter(worldState.technologyEras);
  return { nextCivilizationId, nextTechnologyEraId };
}

module.exports = {
  ERA_NAMES,
  minReemergenceFor,
  foundCivilization,
  getCivilization,
  seedTechnologyEras,
  getEra,
  unlockedEras,
  canUnlock,
  unlockEra,
  nextEraFor,
  runTechnology,
  reseedIds,
};
