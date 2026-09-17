// server/motivation.js
//
// What somebody wants.
//
// **Three tables, all empty, and a warning about how to build them.**
// `needs`, `values_db` and `goals` are defined in the schema and had no
// WorldState array and no code. Measured against a built world they
// came back as "no store" — the engine could say what a person was
// capable of, what they had done and who they knew, and nothing at all
// about what they were trying to get.
//
// ---------------------------------------------------------------------
// One module, because the architecture document says so
//
// §4.5 is explicit and it is the reason this is not three files:
//
//   "Motivation Engine = Value System DNA restated (don't duplicate)."
//
// So there is no separate motivation system sitting beside a values
// system. `values_db` IS the Value System DNA (§3.5), and needs and
// goals are the two things that hang off it:
//
//   values   what somebody cares about, and how much. Slow-moving.
//   needs    what is currently unmet. Fast-moving, depletes and is
//            satisfied.
//   goals    what they are pursuing about it. Named, with a horizon.
//
// §4.5 also settles the decision architecture in the same breath —
// "deterministic Key+Knowledge+Goals architecture is sufficient per the
// spec's own Master Design Law" — so goals are not decoration here.
// They are the third leg of how this engine decides things.
//
// ---------------------------------------------------------------------
// Every vocabulary is the document's, not invented
//
// This is the unusual case where the source package names all three
// lists outright, so nothing below is flagged interpretive:
//
//   VALUES            `VACANCY_TRAIT_DATABASE_ATTACHMENT.md`'s own 15,
//                     matching `values_db.value_name`'s enum comment
//   need_type         the schema's own 15, in its column comment
//   timeframe         the schema's own 7, in its column comment
//
// What IS interpretive is the rates, and those are flagged where they
// are declared.
//
// ---------------------------------------------------------------------
// Needs deplete; values drift; goals resolve
//
// The three move at different speeds on purpose, which is what stops
// them being one table:
//
// A need falls every tick and is restored when the world satisfies it —
// eating restores food, a wage restores income, a home restores
// housing. `last_satisfied_tick` is the schema's own column for exactly
// that and it is what makes an unmet need legible ("hungry since when")
// rather than a bare number.
//
// A value moves only through `change_rate`, which is the schema's own
// column, and only toward what somebody's life is actually like. That
// is the twelfth standing rule again: an ordinary life must not drift
// anybody's values, or reading the table would recalibrate the whole
// population.
//
// A goal is created from the most pressing unmet need weighted by what
// the person values, and closes when that need is met again. Goals that
// nothing can close would pile up forever, which is the seventh
// standing rule's shape in a different costume.

'use strict';

const { nextAfter } = require('./nextAfter.js');
const { getLiveEntity } = require('./entityTraits.js');
const areaStats = require('./areaStats.js');
const crime = require('./crime.js');
const economy = require('./economy.js');
const infrastructure = require('./infrastructure.js');

let nextGoalId = 1;

function reseedIds(worldState) {
  nextGoalId = nextAfter(worldState.goals, 'id');
  return { nextGoalId };
}

// ---------------------------------------------------------------------
// The vocabularies
// ---------------------------------------------------------------------

// `values_db.value_name`'s own enumeration, and the same fifteen
// `VACANCY_TRAIT_DATABASE_ATTACHMENT.md` lists under "Value System DNA".
// Stored in the schema's snake_case form; the document's display names
// are in VALUE_LABELS.
const VALUES = [
  'family_first', 'freedom', 'power', 'wealth', 'knowledge',
  'security', 'community', 'religion', 'adventure', 'fame',
  'innovation', 'tradition', 'justice', 'competition', 'peace',
];

const VALUE_LABELS = {
  family_first: 'Family First',
  freedom: 'Freedom',
  power: 'Power',
  wealth: 'Wealth',
  knowledge: 'Knowledge',
  security: 'Security',
  community: 'Community',
  religion: 'Religion',
  adventure: 'Adventure',
  fame: 'Fame',
  innovation: 'Innovation',
  tradition: 'Tradition',
  justice: 'Justice',
  competition: 'Competition',
  peace: 'Peace',
};

// `needs.need_type`'s own enumeration, in its order. The order matters:
// it runs from the physical to the existential, and `defaultPriority`
// below uses the position rather than a second hand-written list.
const NEED_TYPES = [
  'food', 'water', 'sleep', 'safety', 'income', 'housing', 'healthcare',
  'education', 'love', 'friendship', 'respect', 'status', 'purpose',
  'freedom', 'legacy',
];

// `goals.timeframe`'s own enumeration.
const TIMEFRAMES = ['immediate', 'daily', 'weekly', 'monthly', 'lifetime', 'legacy', 'generational'];

// `goals.status` has a DEFAULT of 'active' in the schema and no
// enumeration, so these three are the states this module moves one
// through. A goal that is dropped is distinct from one that is met —
// the gap between them is what `reliabilityOf` is to `decision_log`.
const GOAL_STATUSES = ['active', 'met', 'abandoned'];

// ---------------------------------------------------------------------
// Rates — the interpretive part
// ---------------------------------------------------------------------

//: How far a need falls per tick when nothing satisfies it, as a share
//: of the 0-100 scale. Flagged interpretive: no document sets one.
//:
//: The three speeds are ordered by how long a person can actually go
//: without the thing, which is the only defensible basis available: a
//: day without food matters, a month without education does not.
const DEPLETION = {
  fast: 4,      // food, water, sleep
  steady: 0.6,  // safety, income, housing, healthcare
  slow: 0.1,    // everything social and existential
};

const DEPLETION_BY_NEED = {
  food: 'fast', water: 'fast', sleep: 'fast',
  safety: 'steady', income: 'steady', housing: 'steady', healthcare: 'steady',
};

//: How fast a value moves toward what somebody's life is actually like,
//: per tick. `values_db.change_rate` is the schema's own column and this
//: is its default; a world that wants faster-moving values changes the
//: column, not this constant.
//:
//: Small on purpose. Values are the slowest thing about a person — that
//: is what distinguishes them from needs, which move in days.
const VALUE_CHANGE_RATE = 0.02;

//: The need level below which somebody forms a goal about it, and the
//: level at which that goal closes. **Two thresholds, not one**, and the
//: gap between them is what stops a goal opening and closing every tick
//: for somebody hovering at the line — the seventh standing rule's
//: shape. A goal is a commitment, not a reading.
const GOAL_TRIGGER = 35;
const GOAL_MET = 65;

// ---------------------------------------------------------------------
// Values
// ---------------------------------------------------------------------

function valuesOf(worldState, entityId) {
  return (worldState.valuesDb || []).filter((v) => v.entity_id === entityId);
}

function valueOf(worldState, entityId, valueName) {
  return (worldState.valuesDb || []).find(
    (v) => v.entity_id === entityId && v.value_name === valueName,
  ) ?? null;
}

// One row per value per entity, which is what the composite primary key
// `(entity_id, value_name)` asks for.
//
// `strengthFor` is optional so a caller can derive a value sheet from
// something other than chance — the same seam `generateEntityTraits`
// has, and for the same reason: a child whose values were rolled fresh
// would make upbringing decorative.
function generateValues(worldState, entityId, options = {}) {
  const { strengthFor = null, tick = worldState.tick ?? 0 } = options;
  const rows = [];

  VALUES.forEach((valueName, index) => {
    if (valueOf(worldState, entityId, valueName)) return;
    const strength = strengthFor === null ? 50 : Number(strengthFor(valueName, index));
    const row = {
      entity_id: entityId,
      value_name: valueName,
      // Priority is the rank this value holds for this person, which is
      // derived from strength rather than stored separately — a stored
      // rank and a stored strength are two answers to one question and
      // they drift. Recomputed by `rankValues` after any write.
      priority: null,
      current_strength: Math.max(0, Math.min(100, Number.isFinite(strength) ? strength : 50)),
      change_rate: VALUE_CHANGE_RATE,
      // How much this value weighs on a decision. Equal at generation;
      // `rankValues` sets it from the rank, so the thing somebody cares
      // most about weighs most.
      influence_weight: null,
      tick,
    };
    (worldState.valuesDb || (worldState.valuesDb = [])).push(row);
    rows.push(row);
  });

  rankValues(worldState, entityId);
  return rows;
}

// Priority 1 is what somebody cares about most. Derived, then written —
// this is the one place in the module that stores a rank, and it is
// stored because `values_db.priority` is a real column the schema asks
// for rather than because it could not be computed.
function rankValues(worldState, entityId) {
  const rows = valuesOf(worldState, entityId);
  const sorted = [...rows].sort((a, b) => Number(b.current_strength) - Number(a.current_strength));
  sorted.forEach((row, index) => {
    row.priority = index + 1;
    // Linear from 1 down to about 0.3 across fifteen values, so the top
    // value weighs roughly three times the bottom one rather than
    // everything weighing the same.
    row.influence_weight = Math.round((1 - (index / sorted.length) * 0.7) * 1000) / 1000;
  });
  return sorted;
}

// What somebody cares about most, or null when nobody has given them
// values. Null rather than a default value name — unknown is not
// "family first".
function topValue(worldState, entityId) {
  const ranked = valuesOf(worldState, entityId).sort(
    (a, b) => Number(a.priority ?? 99) - Number(b.priority ?? 99),
  );
  return ranked[0] ?? null;
}

// ---------------------------------------------------------------------
// Needs
// ---------------------------------------------------------------------

function needsOf(worldState, entityId) {
  return (worldState.needs || []).filter((n) => n.entity_id === entityId);
}

function needOf(worldState, entityId, needType) {
  return (worldState.needs || []).find(
    (n) => n.entity_id === entityId && n.need_type === needType,
  ) ?? null;
}

//: Where a need sits in the queue when nothing else says otherwise.
//: Taken from the position in `NEED_TYPES`, which the schema lists from
//: the physical to the existential — so food outranks legacy without a
//: second hand-written list that could disagree with the first.
function defaultPriority(needType) {
  const index = NEED_TYPES.indexOf(needType);
  return index === -1 ? NEED_TYPES.length : index + 1;
}

function generateNeeds(worldState, entityId, options = {}) {
  const { levelFor = null, tick = worldState.tick ?? 0 } = options;
  const rows = [];

  for (const needType of NEED_TYPES) {
    if (needOf(worldState, entityId, needType)) continue;
    const level = levelFor === null ? 70 : Number(levelFor(needType));
    const row = {
      entity_id: entityId,
      need_type: needType,
      current_level: Math.max(0, Math.min(100, Number.isFinite(level) ? level : 70)),
      priority: defaultPriority(needType),
      // **Null, not the current tick.** A need nobody has satisfied yet
      // is different from one satisfied at generation, and `null` says
      // the first while a tick stamp would claim the second.
      last_satisfied_tick: null,
    };
    (worldState.needs || (worldState.needs = [])).push(row);
    rows.push(row);
  }
  void tick;
  return rows;
}

// Restore a need. Returns the row so a caller can see where it landed.
function satisfyNeed(worldState, entityId, needType, options = {}) {
  const { amount = 100, tick = worldState.tick ?? 0 } = options;
  const row = needOf(worldState, entityId, needType);
  if (!row) return null;

  const before = Number(row.current_level);
  row.current_level = Math.max(0, Math.min(100, before + Number(amount)));
  // Stamped only when something actually moved. A "satisfaction" that
  // changed nothing did not happen, and recording it would make
  // `last_satisfied_tick` say somebody ate when they did not.
  if (row.current_level > before) row.last_satisfied_tick = tick;
  return row;
}

// The need most worth acting on: how unmet it is, weighted by where it
// sits in the queue. Null when this person has no needs recorded at all
// rather than a made-up one.
function mostPressing(worldState, entityId) {
  const rows = needsOf(worldState, entityId);
  if (rows.length === 0) return null;

  let worst = null;
  let worstScore = -Infinity;
  for (const row of rows) {
    const unmet = 100 - Number(row.current_level);
    // Priority 1 weighs most. `/ NEED_TYPES.length` keeps the weight in
    // a sane range rather than letting rank swamp the level.
    const weight = 1 + (NEED_TYPES.length - Number(row.priority)) / NEED_TYPES.length;
    const score = unmet * weight;
    if (score > worstScore) {
      worstScore = score;
      worst = row;
    }
  }
  return worst;
}

// ---------------------------------------------------------------------
// Goals
// ---------------------------------------------------------------------

function goalsOf(worldState, entityId, options = {}) {
  const { status = null } = options;
  return (worldState.goals || []).filter(
    (g) => g.entity_id === entityId && (status === null || g.status === status),
  );
}

function addGoal(worldState, options = {}) {
  const {
    entityId, description, timeframe, tick = worldState.tick ?? 0,
  } = options;

  if (entityId === undefined || entityId === null) {
    throw new Error('motivation.addGoal requires an entityId (goals.entity_id is NOT NULL)');
  }
  if (!description) {
    throw new Error('motivation.addGoal requires a description (goals.goal_description is NOT NULL)');
  }
  if (!TIMEFRAMES.includes(timeframe)) {
    throw new Error(
      `motivation.addGoal: "${timeframe}" is not a timeframe (one of: ${TIMEFRAMES.join(', ')})`,
    );
  }

  const goal = {
    id: nextGoalId++,
    entity_id: entityId,
    goal_description: description,
    timeframe,
    status: 'active',
    created_tick: tick,
    // Not schema columns, and deliberately so: `resolved_tick` and
    // `about_need` are what make a goal closable and explicable, and
    // they are carried in memory the same way `assigned_entity_id` was
    // added to missions. Neither is migrated — see migrate.js.
    resolved_tick: null,
    about_need: options.aboutNeed ?? null,
  };
  (worldState.goals || (worldState.goals = [])).push(goal);
  return goal;
}

function resolveGoal(worldState, goalId, status, tick = null) {
  if (!GOAL_STATUSES.includes(status)) {
    throw new Error(
      `motivation.resolveGoal: "${status}" is not a status (one of: ${GOAL_STATUSES.join(', ')})`,
    );
  }
  const goal = (worldState.goals || []).find((g) => g.id === goalId);
  if (!goal) throw new Error(`motivation.resolveGoal: no goal ${goalId}`);
  goal.status = status;
  goal.resolved_tick = tick ?? worldState.tick ?? 0;
  return goal;
}

//: Which horizon a goal about a given need gets. Derived from how fast
//: the need depletes, so a goal about food is `immediate` and one about
//: legacy is `generational` — the schema's own two enumerations lined up
//: against each other rather than a third hand-written mapping.
function timeframeFor(needType) {
  const speed = DEPLETION_BY_NEED[needType] ?? 'slow';
  if (speed === 'fast') return 'immediate';
  if (speed === 'steady') return 'monthly';
  return needType === 'legacy' ? 'generational' : 'lifetime';
}

// The sentence a goal is written as. Plain, and assembled from the
// fields rather than stored as prose somebody wrote at the call site —
// the same choice `decisions.explain` makes and for the same reason.
function describeGoal(needType, valueName) {
  const label = valueName ? VALUE_LABELS[valueName] ?? valueName : null;
  return label ? `secure ${needType} (${label})` : `secure ${needType}`;
}

// ---------------------------------------------------------------------
// The pass
// ---------------------------------------------------------------------

// ---------------------------------------------------------------------
// What actually meets a need
// ---------------------------------------------------------------------

//: **One entry per need, each naming substrate that already exists.**
//: Every function returns 0..1 — how well this person's circumstances
//: are meeting that need right now — and `null` where this engine has
//: nothing honest to read.
//:
//: This replaced a first version that restored a handful of needs from
//: habits alone and left the rest to decay untouched. Measured over 120
//: ticks of a real world it produced water at 0.0 on every person alive,
//: healthcare at 5.4, and 2.1 permanently-open goals each about a need
//: nothing could ever close. A need that depletes with no possible
//: satisfier is not a hardship, it is a bug — and a goal about one is
//: the seventh standing rule's failure in a new costume: an entry that
//: opens on a condition and can never resolve.
//:
//: So the rule is: **a need only moves if something in this engine could
//: meet it.** `freedom` is the single declared absence and holds at the
//: level it was generated with rather than decaying to zero and dragging
//: every population-level reading down with it.
const SATISFIERS = {
  // Eating, and whether there is food to eat. Both halves matter: a
  // kept routine in a famine feeds nobody.
  food: (ctx, npc) => {
    // **Null when the world does not track food at all**, not 1. The
    // first version read an untracked resource as scarcity 0 and so as
    // perfect supply — a world with no food in it reported everybody
    // fed. That is "unknown is not a zero" failing in the direction
    // that looks like abundance.
    const available = ctx.availabilityOf('food', npc.communityId);
    if (available === null) return null;
    // **The two halves multiply; they do not take the lower.** `min`
    // was the first version and it reads sensibly right up until you
    // measure it: the `eat` habit runs 0.54..0.81 and food availability
    // in a settled world sits near 0.50, so the minimum was availability
    // for essentially everybody, essentially always. 144 people, and
    // their food levels spanned 50 to 53.
    //
    // That is the twelfth standing rule's second clause exactly — a
    // computed field sitting above a spread of its own source is dead
    // code that looks live. Whether somebody keeps the routine made no
    // difference to whether they ate, in any world where supply was the
    // binding side, which is most of them.
    //
    // The product keeps both claims the header makes: a kept routine in
    // a famine still feeds nobody (availability 0 → 0), and somebody
    // diligent in a well-supplied place eats better than somebody who
    // is not.
    return ctx.habitStrength(npc.id, 'eat') * available;
  },
  // No habit for it — `seedRoutine` has no `drink` — so this is purely
  // whether the settlement has water. That is the honest reading, and
  // it is why water was the worst number in the measurement: nothing
  // was looking at the resource at all.
  water: (ctx, npc) => ctx.availabilityOf('water', npc.communityId),
  sleep: (ctx, npc) => ctx.habitStrength(npc.id, 'rest'),
  // Somewhere to be, and how dangerous it is there.
  safety: (ctx, npc) => (npc.home_property_id == null ? 0.2 : 1)
    * (1 - ctx.dangerIn(npc.communityId)),
  income: (ctx, npc) => (ctx.employed.has(npc.id) ? 1 : 0.15),
  housing: (ctx, npc) => (npc.home_property_id == null ? 0 : 1),
  // **Infrastructure the city already builds.** `CITY_INFRASTRUCTURE`
  // gives hospitals and schools a real per-1,000 capacity, and
  // `capacityOf` returns null both when nothing is built and when
  // nothing states a capacity — so an unserved city reads as unserved
  // rather than as well served.
  healthcare: (ctx, npc) => ctx.serviceIn(npc.communityId, 'hospitals'),
  education: (ctx, npc) => ctx.serviceIn(npc.communityId, 'schools'),
  // Somebody close. Family counts, and so does a strong bond.
  love: (ctx, npc) => (ctx.hasFamily.has(npc.id) || ctx.hasBond.has(npc.id) ? 1 : 0.2),
  friendship: (ctx, npc) => Math.max(
    ctx.habitStrength(npc.id, 'gathering'),
    Math.min(1, (ctx.trustedCount.get(npc.id) ?? 0) / 4),
  ),
  // What other people think of you, which `social.Reputation` is.
  respect: (ctx, npc) => ctx.traitShare(npc.id, 'social', 'Reputation'),
  // Where you stand economically, against the poverty line the world
  // computes for itself rather than an absolute figure.
  status: (ctx, npc) => ctx.standingOf(npc.id),
  // Something to be doing. A job, or something you are pursuing.
  purpose: (ctx, npc) => (ctx.employed.has(npc.id) || ctx.hasGoal.has(npc.id) ? 1 : 0.25),
  // **The declared absence.** Nothing in this engine represents being
  // free or not: there is no confinement, no conscription and no travel
  // restriction, and `governments.system_type` says how a government is
  // formed rather than what it permits. Reading it as a proxy would put
  // a whole political theory behind a constant nobody chose.
  freedom: () => null,
  // Whether anything of you carries on.
  legacy: (ctx, npc) => (ctx.hasChildren.has(npc.id) ? 1 : 0.3),
};

//: **A need converges on what supplies it**, and there is no margin
//: constant, because the first version had one and it was wrong.
//:
//: That version moved a need by `rate * (supply * 1.25 - 1)`, so a need
//: held steady only where supply was at least 0.8. Habit strength
//: settles around 0.70 for an ordinary person by design
//: (`behavior.HABIT_ROOM_FACTOR`), which meant food and sleep could
//: never hold for anybody: measured, both read 0.0 across the whole
//: population after 150 ticks while the routine that fed them was being
//: kept every single day.
//:
//: Converging on `supply * 100` instead needs no constant at all and
//: says something true: **the level of a need IS how well it is
//: supplied.** Somebody whose routine is 0.7 kept settles at 70;
//: somewhere with no water settles at 0. The rate then only decides how
//: fast they get there, which is what a rate should decide.
const SATISFACTION_MARGIN = null;

// Everything the satisfiers read, built once for a whole pass rather
// than per person. `traitDrift.indexRows` learned this the expensive
// way — the per-person version walked every array in the world once per
// resident per tick.
function contextFor(worldState) {
  const habits = new Map();
  for (const habit of worldState.habits || []) {
    habits.set(`${habit.entity_id}:${habit.habit_name}`, Number(habit.strength));
  }

  const employed = new Set(
    (worldState.employmentRecords || [])
      .filter((r) => r.status === 'active')
      .map((r) => r.entity_id),
  );
  const hasFamily = new Set((worldState.familyMemberships || []).map((m) => m.entity_id));
  const hasGoal = new Set(
    (worldState.goals || []).filter((g) => g.status === 'active').map((g) => g.entity_id),
  );

  const hasChildren = new Set();
  for (const record of worldState.historicalRecords || []) {
    if (record.event_type !== 'birth') continue;
    for (const id of record.participants || []) hasChildren.add(id);
  }

  const trustedCount = new Map();
  const hasBond = new Set();
  for (const rel of worldState.relationships || []) {
    if (rel.entity_a_id === rel.entity_b_id) continue;
    if (Number(rel.trust) >= 60) {
      for (const id of [rel.entity_a_id, rel.entity_b_id]) {
        trustedCount.set(id, (trustedCount.get(id) ?? 0) + 1);
      }
    }
    if (Number(rel.love ?? 0) >= 50) {
      hasBond.add(rel.entity_a_id);
      hasBond.add(rel.entity_b_id);
    }
  }

  const cityOf = new Map(
    (worldState.communities || []).map((community) => [community.id, community.city_id]),
  );

  // **Scarcity is a fact about a place, and this map used to forget
  // which place.** It was keyed on `resource_type` alone, so the last
  // city's food row in the array decided how well fed every person in
  // the world was. Measured: 127 people across two cities, one of them
  // in total famine and the other comfortable, and all 127 read exactly
  // the same food level to the decimal.
  //
  // The same defect, in the same words, was fixed in `tick.js`'s
  // condition applier when weather started producing city-scoped
  // droughts — one city's drought drained every city. It was here too,
  // one layer up, and nothing caught it because a need with no spread
  // still looks like a working need.
  //
  // A resource with no `city_id` is genuinely world-wide (the column is
  // nullable and a scenario-level shortage is a real thing), so it is
  // kept under a separate key and used when the city has no row of its
  // own.
  const WORLD = '*';
  const scarcity = new Map();
  for (const resource of worldState.resources || []) {
    const value = Number(economy.getScarcity(resource));
    const level = Number.isFinite(value) ? value / 100 : 0;
    scarcity.set(`${resource.city_id ?? WORLD}:${resource.resource_type}`, level);
  }
  const residentsPerCity = new Map();
  for (const npc of worldState.npcs || []) {
    const cityId = cityOf.get(npc.communityId);
    if (cityId === undefined) continue;
    residentsPerCity.set(cityId, (residentsPerCity.get(cityId) ?? 0) + 1);
  }

  const danger = crime.dangerByCommunity(worldState);
  const line = Number(areaStats.povertyLine(worldState));

  return {
    employed,
    hasFamily,
    hasGoal,
    hasChildren,
    hasBond,
    trustedCount,

    habitStrength: (entityId, name) => {
      const value = habits.get(`${entityId}:${name}`);
      return Number.isFinite(value) ? Math.max(0, Math.min(1, value / 100)) : 0;
    },
    // **How much of this resource there is where this person is,
    // 0..1 — or null when the world does not track it.** Named for what
    // the caller wants rather than for scarcity, because the first
    // version returned scarcity and every call site had to remember to
    // invert it; one that forgot would read a famine as plenty.
    //
    // `communityId` is how the person's city is found. Omitting it
    // falls back to a world-wide row, which is the honest answer for a
    // caller who has no place to ask about — and null, not 1, when
    // there is no row at all.
    availabilityOf: (resourceType, communityId = null) => {
      const cityId = communityId === null ? undefined : cityOf.get(communityId);
      const local = cityId === undefined ? undefined : scarcity.get(`${cityId}:${resourceType}`);
      const value = local !== undefined ? local : scarcity.get(`${WORLD}:${resourceType}`);
      if (value === undefined) return null;
      return Math.max(0, Math.min(1, 1 - value));
    },
    dangerIn: (communityId) => Math.max(0, Math.min(1, danger.get(communityId) ?? 0)),

    // Capacity per resident, capped at 1. A null capacity — nothing
    // built, or nothing stating a headcount — reads as unserved,
    // because unknown is not "well served".
    serviceIn: (communityId, type) => {
      const cityId = cityOf.get(communityId);
      if (cityId === undefined) return 0;
      const level = infrastructure.serviceLevel(
        worldState, cityId, type, residentsPerCity.get(cityId) ?? 0,
      );
      // Null means nothing is built or nothing states a capacity, which
      // is genuinely unserved for the person standing in it.
      return level === null ? 0 : level;
    },

    traitShare: (entityId, family, name) => {
      const live = getLiveEntity(worldState, entityId);
      const raw = Number(live?.traits?.[family]?.[name] ?? 50);
      return Math.max(0, Math.min(1, (Number.isFinite(raw) ? raw : 50) / 100));
    },

    // Net worth against the world's own poverty line. 0.5 — neither
    // high nor low standing — when there is no line to measure against,
    // rather than 0, which would say everybody is destitute.
    standingOf: (entityId) => {
      if (!Number.isFinite(line) || line <= 0) return 0.5;
      const worth = Number(economy.getNetWorth(worldState, entityId) ?? 0);
      return Math.max(0, Math.min(1, worth / (line * 4)));
    },
  };
}

// One tick of wanting things.
//
// Runs in the cross-cutting slot beside behavior and trait drift — the
// pipeline is locked at eleven phases and what somebody wants is not a
// stage of a tick.
function runMotivation(worldState, options = {}) {
  const { tick = worldState.tick ?? 0 } = options;
  const events = [];
  const ctx = contextFor(worldState);

  for (const npc of worldState.npcs || []) {
    const rows = needsOf(worldState, npc.id);
    if (rows.length === 0) continue;

    // ---- needs move toward what this person's life supplies ----------
    for (const row of rows) {
      const satisfier = SATISFIERS[row.need_type];
      const supply = satisfier ? satisfier(ctx, npc) : null;
      // **A null holds the level rather than decaying it.** A need this
      // engine cannot meet is not one somebody is failing to meet.
      if (supply === null || supply === undefined) continue;

      const rate = DEPLETION[DEPLETION_BY_NEED[row.need_type] ?? 'slow'];
      const before = Number(row.current_level);
      const target = Math.max(0, Math.min(1, supply)) * 100;
      // Toward the target at `rate` points per tick, never past it — an
      // overshoot would oscillate forever.
      const step = Math.sign(target - before) * Math.min(rate, Math.abs(target - before));
      row.current_level = Math.max(0, Math.min(100, before + step));
      if (row.current_level > before) row.last_satisfied_tick = tick;
    }
    // ---- goals open and close -----------------------------------------
    const active = goalsOf(worldState, npc.id, { status: 'active' });
    for (const goal of active) {
      if (!goal.about_need) continue;
      const need = needOf(worldState, npc.id, goal.about_need);
      if (need && Number(need.current_level) >= GOAL_MET) {
        resolveGoal(worldState, goal.id, 'met', tick);
        events.push({
          type: 'goal_met',
          severity: 'low',
          note: goal.goal_description,
          tick,
          affected_entity_ids: [npc.id],
          global_effects: { goalId: goal.id, need: goal.about_need },
        });
      }
    }

    // One active goal per need at a time — otherwise somebody hungry
    // for a hundred ticks accumulates a hundred identical goals, which
    // is the seventh standing rule's failure exactly.
    const pressing = mostPressing(worldState, npc.id);
    if (pressing && Number(pressing.current_level) < GOAL_TRIGGER) {
      const already = goalsOf(worldState, npc.id, { status: 'active' })
        .some((g) => g.about_need === pressing.need_type);
      if (!already) {
        const top = topValue(worldState, npc.id);
        addGoal(worldState, {
          entityId: npc.id,
          description: describeGoal(pressing.need_type, top?.value_name),
          timeframe: timeframeFor(pressing.need_type),
          aboutNeed: pressing.need_type,
          tick,
        });
      }
    }

    // ---- values drift toward the life being lived ---------------------
    // **Centred, per the twelfth standing rule.** Each value is pulled
    // toward what this person's circumstances actually support, so an
    // ordinary life leaves an ordinary person where they were. Only two
    // values have substrate honest enough to read today; the rest hold.
    const security = valueOf(worldState, npc.id, 'security');
    if (security) {
      const safety = needOf(worldState, npc.id, 'safety');
      if (safety) driftValue(security, 100 - Number(safety.current_level));
    }
    const community = valueOf(worldState, npc.id, 'community');
    if (community) {
      const friendship = needOf(worldState, npc.id, 'friendship');
      if (friendship) driftValue(community, Number(friendship.current_level));
    }
  }

  return events;
}

// Move one value toward a target at its own `change_rate`. Toward,
// never past — a value that overshot would oscillate forever.
function driftValue(row, target) {
  const rate = Number(row.change_rate);
  if (!Number.isFinite(rate) || rate === 0) return row;
  const gap = Math.max(0, Math.min(100, target)) - Number(row.current_strength);
  row.current_strength = Math.max(0, Math.min(100,
    Math.round((Number(row.current_strength) + gap * rate) * 10000) / 10000));
  return row;
}

// ---------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------

// Why this person is doing anything: what they want, what they lack,
// and what they are pursuing about it.
function describeMotivation(worldState, entityId) {
  const live = getLiveEntity(worldState, entityId);
  if (!live) return null;

  const pressing = mostPressing(worldState, entityId);
  const top = topValue(worldState, entityId);
  return {
    entityId,
    // Null rather than a default: an entity nobody gave values to has
    // no top value, which is a different fact from valuing family most.
    values: valuesOf(worldState, entityId).length === 0 ? null : rankValues(worldState, entityId)
      .slice(0, 3)
      .map((v) => ({ value: v.value_name, label: VALUE_LABELS[v.value_name], strength: v.current_strength })),
    needs: needsOf(worldState, entityId).length === 0 ? null : {
      mostPressing: pressing ? pressing.need_type : null,
      level: pressing ? pressing.current_level : null,
      lastSatisfiedTick: pressing ? pressing.last_satisfied_tick : null,
    },
    pursuing: goalsOf(worldState, entityId, { status: 'active' })
      .map((g) => ({ id: g.id, what: g.goal_description, timeframe: g.timeframe })),
    caresMostAbout: top ? VALUE_LABELS[top.value_name] : null,
  };
}

// How well this population's needs are being met, 0..100, or null when
// nobody has needs recorded. A community-level read, for statistics.
function meanNeedLevel(worldState, entityIds) {
  const levels = [];
  for (const entityId of entityIds) {
    for (const row of needsOf(worldState, entityId)) levels.push(Number(row.current_level));
  }
  if (levels.length === 0) return null;
  return Math.round((levels.reduce((a, b) => a + b, 0) / levels.length) * 100) / 100;
}

module.exports = {
  VALUES,
  VALUE_LABELS,
  NEED_TYPES,
  TIMEFRAMES,
  GOAL_STATUSES,
  DEPLETION,
  DEPLETION_BY_NEED,
  VALUE_CHANGE_RATE,
  GOAL_TRIGGER,
  GOAL_MET,
  SATISFIERS,
  SATISFACTION_MARGIN,
  contextFor,
  reseedIds,
  generateValues,
  valuesOf,
  valueOf,
  rankValues,
  topValue,
  generateNeeds,
  needsOf,
  needOf,
  defaultPriority,
  satisfyNeed,
  mostPressing,
  goalsOf,
  addGoal,
  resolveGoal,
  timeframeFor,
  describeGoal,
  driftValue,
  runMotivation,
  describeMotivation,
  meanNeedLevel,
};
