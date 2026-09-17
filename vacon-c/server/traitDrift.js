// server/traitDrift.js
//
// **Whether a person can change.**
//
// Measured, and the answer was no. `entity_traits` carries seven
// contributing columns beside `base_value`. Over 200 ticks of a real
// world, across 17,358 trait rows:
//
//   base_value               0 rows moved
//   temporary_modifier       0
//   permanent_modifier       0
//   experience_modifier      0
//   environmental_modifier   0
//   relationship_modifier    0
//   key_modifier           405 (2.3%)
//
// Only Key resolvers ever wrote anything, and only to their own column.
// Nobody in this world learned a trade, was hardened or worn down by
// where they lived, or was changed by the people around them. A
// forty-year-old who had spent every tick working was, trait for trait,
// the person they were born as.
//
// And `trait_definitions` has carried `growth_rate` (0.01) and
// `decay_rate` (0.005) since the schema was written, applied by
// nothing. Two columns describing exactly this, migrated and restored
// on every row, read by no code anywhere.
//
// ---------------------------------------------------------------------
// One column per cause, which is what the schema is asking for
//
// The split is not decoration — a person's current value is
// `base + temporary + permanent + experience + environmental +
// relationship + key`, and keeping the causes apart is what makes the
// sum explicable. So each source here writes to its own column and
// never to another's:
//
//   experience     what you do. Practising a habit grows what it
//                  exercises; what you stop doing fades.
//   environmental  where you live. Deprivation, danger and decay press
//                  on everybody in a place, and let up when it does.
//   relationship   who you know. The people you are close to pull you
//                  toward them.
//   temporary      what is happening to you right now. Recovers on its
//                  own — which is what makes it temporary, and needs no
//                  expiry column the schema does not have.
//
// `base_value` is deliberately NOT written: base means the value you
// were born with, and change belongs in the modifiers. `permanent_
// modifier` is deliberately not written either — see the bottom of this
// file, where the reason is a missing mechanism rather than an
// oversight.
//
// ---------------------------------------------------------------------
// Centred, so reading a trait does not recalibrate the world
//
// The hard lesson from wiring the seven dead trait families, and the
// twelfth standing rule: an ordinary person in an ordinary place, doing
// ordinary things, must drift to zero. Every driver below is expressed
// as a distance from the middle, so the population spreads out around
// where it already was instead of all sliding one way. A world where
// everybody's Endurance climbs every tick is not a deeper simulation,
// it is a broken one.
//
// The bounds do the rest: nothing here can move a trait more than
// `DRIFT_CEILING` away from where it started, so a long run cannot turn
// a person into a different one by accumulation.

'use strict';

const { getDefinition } = require('./traitDefinitions.js');

//: The most any one drift column may move a trait, in points. Capped
//: because these apply every tick for a lifetime: at 0.01 growth
//: against a 100-point scale, an uncapped column would be pinned at the
//: ceiling inside a few years and stop carrying information — the exact
//: failure `habits.strength` had, where every habit in the world sat at
//: exactly 100.
//:
//: 15 keeps a lived life clearly legible against a generated one
//: (nobody mistakes a 65 for a 50) while leaving birth the dominant
//: term, which is what a trait IS. Flagged interpretive: no document
//: sets a figure.
const DRIFT_CEILING = 15;

//: How much of `growth_rate` a fully entrenched habit delivers per
//: tick. `trait_definitions.growth_rate` is 0.01 on every row — the
//: schema's own DEFAULT — and this scales it into points per tick so
//: the definition column is what drives the rate and this is only the
//: conversion. At 1.0 a habit at strength 100 moves a trait 0.01/tick,
//: reaching the ceiling in about four years of constant practice.
const EXPERIENCE_RATE = 1;

//: How strongly a place presses on the people in it, and how strongly
//: the people close to somebody pull them. Both are per-tick fractions
//: of the distance to the target, so they converge rather than
//: accumulate.
const ENVIRONMENT_RATE = 0.004;
const RELATIONSHIP_RATE = 0.002;

//: How fast a temporary modifier returns to nothing. At 0.05 a shock
//: is most of the way gone in a month of ticks, which is what
//: distinguishes `temporary_modifier` from the other three.
const TEMPORARY_RECOVERY = 0.05;

// ---------------------------------------------------------------------
// What each routine exercises
// ---------------------------------------------------------------------

//: Which traits a kept habit grows. **Every family and trait named here
//: is checked by `test/trait-drift.test.js` against `traits.js`**, so a
//: renamed trait fails the suite instead of silently exercising
//: nothing — standing rule 6's shape, and the reason this is a table
//: rather than string literals at the call site.
//:
//: Deliberately narrow. A routine grows what it plainly is: working
//: builds work capacity and discipline, resting and eating maintain the
//: body, gathering with others builds the social traits. Anything
//: broader would be inventing a theory of character development.
const EXERCISES = {
  // **`skills.Management` here is the DEFAULT, not the meaning of
  // work.** It was the whole of it until `occupations.js` existed, so a
  // farmer who had worked every tick of a forty-year life got steadily
  // better at management and no better at agriculture, and the same
  // three traits grew for every working person in the world. What a job
  // exercises is now the job: `occupationExercise` below replaces this
  // first pair with the occupation's own skill when the worker holds a
  // titled position, and leaves it in place for an untitled one — which
  // is also the honest reading of a restored world, where every
  // employment record predates the column being written.
  work: [
    ['skills', 'Management'],
    ['behavioral', 'Discipline'],
    ['physical', 'Endurance'],
  ],
  rest: [
    ['health', 'Sleep Quality'],
    ['emotional', 'Resilience'],
  ],
  eat: [
    ['health', 'Nutrition Status'],
    ['physical', 'Strength'],
  ],
  gathering: [
    ['social', 'Group Loyalty'],
    ['social', 'Charisma'],
  ],
  // **The habit of turning up to the community game**, formed by
  // `server/competition.js` on everybody who enters one. This is the
  // entry that makes athleticism something a person becomes rather than
  // something they were generated with: `contest.js` rates a bout from
  // Speed and Coordination, competing reinforces the habit, and the
  // habit grows the traits the next bout is rated from.
  //
  // Narrow on purpose, like the rest of this table. Playing regularly
  // makes somebody faster and better coordinated and builds stamina. It
  // does not make them a better person, and Competitive Drive is left
  // out deliberately — that is appetite rather than ability, and
  // growing it would make anybody who ever played turn up forever.
  //
  // **Measured, and small.** The same world run twice off one seed,
  // differing only in whether the tick holds games, moved a
  // population's mean athleticism from 48.92 to 49.10 over 600 ticks.
  // That is the drift model working as designed rather than a weak
  // link: `growth_rate` is 0.01 a tick, an individual plays about every
  // forty-five ticks, and the habit settles near 10, so the product is
  // a fraction of a point a year and reaches `DRIFT_CEILING` over a
  // lifetime. The number is stated here rather than tuned upward,
  // because inflating one of three defensible constants to make a new
  // system look consequential is how a model stops describing anything.
  compete: [
    ['sports', 'Speed'],
    ['sports', 'Coordination'],
    ['physical', 'Stamina'],
  ],
  'self-medicating': [
    // A harmful habit exercises something too — that is what makes it
    // harmful rather than merely sad. It is the only negative entry
    // here, and it is negative because the schema's own `harmful` flag
    // says this habit is not good for the person keeping it.
    ['health', 'Nutrition Status', -1],
    ['behavioral', 'Discipline', -1],
  ],
};

// ---------------------------------------------------------------------

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

//: **Four decimals, and the resolution is load-bearing.** These
//: modifiers move by fractions of a point per tick — the whole model is
//: that a life changes somebody slowly — so the stored value has to be
//: finer-grained than the smallest step, or the step is not slow, it is
//: absent.
//:
//: Rounding to two decimals, which is what this did first, silently
//: deleted every drift below 0.005 per tick: rounding `0 + 0.004` to
//: two places gives 0, so the column never changed and
//: `environmental_modifier` measured as a mechanism nobody had written
//: even though it was running on every person every tick. Nothing threw
//: and nothing accumulated, because the lost fraction was never carried
//: forward.
//:
//: The general rule this is an instance of: **a per-tick step smaller
//: than the resolution of the field it writes is no effect at all.**
const roundDrift = (n) => Math.round(n * 10000) / 10000;

// Recompute `current_value` from every contributing column and clamp it
// to the definition's own range.
//
// **`current_value` is a plain stored column**, not a generated one —
// `entityTraits.js` says so in its header — so anything that writes a
// modifier must do this or the sum silently stops matching its parts.
function recompute(row) {
  const def = getDefinition(row.trait_id);
  if (!def) return row;
  const sum = row.base_value
    + row.temporary_modifier + row.permanent_modifier
    + row.experience_modifier + row.environmental_modifier
    + row.relationship_modifier + row.key_modifier;
  row.current_value = clamp(sum, def.min_value, def.max_value);
  return row;
}

// **Indexed once per pass, not filtered per person.** The first version
// filtered the whole `entity_traits` array for every lookup — four
// lookups per NPC per tick, against 17,000 rows and 150 people, which
// is ten million comparisons a tick to answer a question that one walk
// of the array answers for everybody. It added twenty seconds to the
// test suite and pushed it past the runner's per-suite timeout, which
// failed the whole suite rather than any assertion.
//
// A pass builds this once and hands it down. `rowsFor` stays for
// callers outside a pass (the unit tests, a one-off), so the cheap path
// is the default and the expensive one is still correct.
function indexRows(worldState) {
  const index = new Map();
  for (const row of worldState.entityTraits || []) {
    const existing = index.get(row.entity_id);
    if (existing) existing.push(row);
    else index.set(row.entity_id, [row]);
  }
  return index;
}

function rowsFor(worldState, entityId, index = null) {
  if (index) return index.get(entityId) ?? [];
  return (worldState.entityTraits || []).filter((r) => r.entity_id === entityId);
}

// Find one row by family and trait name, or null. Goes through the
// definition rather than a name index because `trait_id` is what the
// row carries.
function rowFor(rows, family, name) {
  return rows.find((r) => {
    const def = getDefinition(r.trait_id);
    return def && def.family === family && def.name === name;
  }) ?? null;
}

// ---------------------------------------------------------------------
// occupationExercise
// ---------------------------------------------------------------------
// What a habit exercises FOR THIS PERSON. Every habit but `work` is the
// same for everybody and comes straight out of the table; `work`
// depends on what their work is.
//
// `occupations.js` is required lazily, inside the call, for the reason
// `authority.gripTerm` requires `statecraft` lazily: both directions of
// that edge already exist at module scope elsewhere and a top-level
// require here is a cycle waiting for the next file to join it.
//
// Substitution, not addition: a titled worker grows their trade's skill
// in place of `Management`, so the number of traits a working person
// exercises is unchanged and an ordinary worker's total drift pressure
// is exactly what it was before this existed — standing rule 12's first
// clause, which is about not recalibrating a world by reading it.
function occupationExercise(worldState, entityId, habitName) {
  const targets = EXERCISES[habitName];
  if (!targets || habitName !== 'work') return targets ?? null;

  // eslint-disable-next-line global-require
  const occupations = require('./occupations.js');
  const skill = occupations.skillOf(occupations.occupationOf(worldState, entityId));
  if (!skill || skill === 'Management') return targets;
  return [['skills', skill], ...targets.slice(1)];
}

// Move one column toward a target, bounded by DRIFT_CEILING, and
// recompute. Returns true if anything actually moved — a caller can
// then stamp the tick, and a no-op stays a no-op.
function nudge(row, column, delta, tick) {
  if (!Number.isFinite(delta) || delta === 0) return false;
  const before = row[column];
  const after = roundDrift(clamp(before + delta, -DRIFT_CEILING, DRIFT_CEILING));
  if (after === before) return false;
  row[column] = after;
  recompute(row);
  row.last_updated_tick = tick;
  return true;
}

// ---------------------------------------------------------------------
// experience — what you do
// ---------------------------------------------------------------------

// A habit grows what it exercises, in proportion to how entrenched it
// is, at the rate the trait's own definition states.
//
// **And what somebody stops doing fades**, which is the other half and
// the reason `decay_rate` exists on every definition. A trait with no
// habit exercising it drifts back toward its base — not past it, so
// this cannot itself become a downward ratchet on a person who simply
// has no routine.
function driftExperience(worldState, entityId, tick, index = null) {
  const rows = rowsFor(worldState, entityId, index);
  if (rows.length === 0) return 0;

  const exercised = new Map();
  for (const habit of worldState.habits || []) {
    if (habit.entity_id !== entityId) continue;
    const targets = occupationExercise(worldState, entityId, habit.habit_name);
    if (!targets) continue;
    const share = clamp(Number(habit.strength) / 100, 0, 1);
    for (const [family, name, sign = 1] of targets) {
      const key = `${family} ${name}`;
      exercised.set(key, (exercised.get(key) ?? 0) + share * sign);
    }
  }

  let moved = 0;
  for (const row of rows) {
    const def = getDefinition(row.trait_id);
    if (!def) continue;
    const pressure = exercised.get(`${def.family} ${def.name}`) ?? 0;

    if (pressure !== 0) {
      if (nudge(row, 'experience_modifier', def.growth_rate * EXPERIENCE_RATE * pressure, tick)) {
        moved += 1;
      }
      continue;
    }
    // Unexercised: fade toward zero at the definition's decay rate,
    // never past it into the opposite sign.
    if (row.experience_modifier === 0) continue;
    const step = Math.sign(row.experience_modifier) * -def.decay_rate;
    const capped = Math.abs(step) > Math.abs(row.experience_modifier)
      ? -row.experience_modifier
      : step;
    if (nudge(row, 'experience_modifier', capped, tick)) moved += 1;
  }
  return moved;
}

// ---------------------------------------------------------------------
// environmental — where you live
// ---------------------------------------------------------------------

//: What a place does to the people in it. Each entry names a real
//: measurement this engine already makes and the traits it presses on.
//: `pressure` is 0 at an ordinary place, positive where it is worse
//: than ordinary — so an ordinary community drifts nobody, which is the
//: twelfth standing rule applied to a whole population at once.
const ENVIRONMENT_EFFECTS = [
  {
    name: 'scarcity',
    traits: [
      ['environmental', 'Contamination Resistance', 1],
      ['physical', 'Endurance', 1],
      ['emotional', 'Optimism', -1],
    ],
  },
  {
    name: 'danger',
    traits: [
      ['emotional', 'Volatility', 1],
      ['psychological', 'Trust Threshold', 1],
      ['criminal', 'Heat Tolerance', 1],
    ],
  },
  {
    // **Two-sided, unlike the other two, and that is the point.**
    // Scarcity and danger are absent at zero — an ordinary place has
    // neither, so neither presses on anybody. A place's CONDITION is
    // different: everybody lives somewhere, and somewhere is always
    // either better or worse than ordinary. `pressuresFor` centres this
    // on 50 so a middling city drifts nobody, a crumbling one wears
    // people down, and a well-kept one leaves them better off.
    //
    // Without a two-sided effect `environmental_modifier` was a column
    // that could only move during a catastrophe, which made "where you
    // live changes you" true only of disasters.
    name: 'decay',
    traits: [
      ['mental', 'Focus', -1],
      ['emotional', 'Optimism', -1],
      ['environmental', 'Urban Navigation', 1],
    ],
  },
];

// Hardship makes people harder AND wears them down, which is why each
// effect above moves some traits up and others down. A place that is
// merely ordinary does neither.
function driftEnvironment(worldState, entityId, tick, pressures, index = null) {
  const rows = rowsFor(worldState, entityId, index);
  if (rows.length === 0) return 0;

  let moved = 0;
  for (const effect of ENVIRONMENT_EFFECTS) {
    const pressure = pressures[effect.name] ?? 0;
    if (pressure === 0) continue;
    for (const [family, name, sign] of effect.traits) {
      const row = rowFor(rows, family, name);
      if (!row) continue;
      if (nudge(row, 'environmental_modifier', ENVIRONMENT_RATE * pressure * sign, tick)) {
        moved += 1;
      }
    }
  }
  return moved;
}

// ---------------------------------------------------------------------
// relationship — who you know
// ---------------------------------------------------------------------

//: How close somebody has to be before they rub off. `relationships`
//: carries `trust` on a 0-100 scale; above the midpoint is somebody
//: whose company is a positive influence rather than an acquaintance.
const CLOSE_TRUST = 60;

//: Which traits the people around you move. Social ones only, and
//: deliberately: being close to a strong person does not make you
//: strong, but being close to a trusting one does make you more
//: trusting. Anything wider would be inventing a theory of influence.
const CONTAGIOUS = [
  ['psychological', 'Trust Threshold'],
  ['social', 'Group Loyalty'],
  ['emotional', 'Optimism'],
  ['behavioral', 'Aggression'],
];

// Somebody's close relations pull their social traits toward the mean
// of those relations'. Toward, never past — this converges on the
// people around you rather than overshooting them, so a sociable world
// grows more alike without everybody ending up identical.
function driftRelationships(worldState, entityId, tick, valuesById, index = null) {
  const rows = rowsFor(worldState, entityId, index);
  if (rows.length === 0) return 0;

  const close = [];
  for (const rel of worldState.relationships || []) {
    if (Number(rel.trust) < CLOSE_TRUST) continue;
    const other = rel.entity_a_id === entityId ? rel.entity_b_id
      : rel.entity_b_id === entityId ? rel.entity_a_id : null;
    if (other === null || other === entityId) continue;
    close.push(other);
  }
  if (close.length === 0) return 0;

  let moved = 0;
  for (const [family, name] of CONTAGIOUS) {
    const row = rowFor(rows, family, name);
    if (!row) continue;

    const theirs = [];
    for (const otherId of close) {
      const value = valuesById.get(`${otherId} ${family} ${name}`);
      if (Number.isFinite(value)) theirs.push(value);
    }
    if (theirs.length === 0) continue;

    const mean = theirs.reduce((a, b) => a + b, 0) / theirs.length;
    // Distance from where this person currently sits, so the pull ends
    // when they match — an ordinary person among people like them does
    // not drift.
    const gap = mean - row.current_value;
    if (nudge(row, 'relationship_modifier', RELATIONSHIP_RATE * gap, tick)) moved += 1;
  }
  return moved;
}

// ---------------------------------------------------------------------
// temporary — what is happening right now
// ---------------------------------------------------------------------

//: Which traits acute strain depresses while it lasts. Stress above
//: the `strained` band is a person not at their best today; below it
//: they recover. This is the only column that returns to zero on its
//: own, which is what `temporary` means and is why it needs no expiry
//: column — the schema has none to offer.
const STRAIN_DEPRESSES = [
  ['mental', 'Focus'],
  ['emotional', 'Resilience'],
  ['social', 'Charisma'],
];

//: Where acute strain starts, and how hard it bites. The threshold is
//: the top of the `strained` band in `behavior.MOOD_BANDS` — reused, not
//: invented.
//:
//: **The rate is 0.2 because 0.03 was below the resolution it is stored
//: at.** Modifiers round to two decimals, and at 0.03 a person at stress
//: 65 moved 0.00375 per tick, which rounds to zero — so the column
//: never changed, on anybody, ever, and looked exactly like a mechanism
//: nobody had written. A per-tick step smaller than the rounding of the
//: field it writes is not a slow effect, it is no effect.
const STRAIN_THRESHOLD = 60;
const STRAIN_RATE = 0.2;

function driftTemporary(worldState, entityId, tick, stress, index = null) {
  const rows = rowsFor(worldState, entityId, index);
  if (rows.length === 0) return 0;

  let moved = 0;
  for (const [family, name] of STRAIN_DEPRESSES) {
    const row = rowFor(rows, family, name);
    if (!row) continue;

    if (stress !== null && stress > STRAIN_THRESHOLD) {
      const over = (stress - STRAIN_THRESHOLD) / (100 - STRAIN_THRESHOLD);
      if (nudge(row, 'temporary_modifier', -STRAIN_RATE * over, tick)) moved += 1;
      continue;
    }
    // Recovering. Toward zero, never through it.
    if (row.temporary_modifier === 0) continue;
    const step = -row.temporary_modifier * TEMPORARY_RECOVERY;
    if (nudge(row, 'temporary_modifier', step, tick)) moved += 1;
  }
  return moved;
}

// ---------------------------------------------------------------------
// The pass
// ---------------------------------------------------------------------

// How hard a community presses on the people in it, 0 at ordinary.
// Taken from measurements the engine already makes rather than new
// state: `survivalScarcity` is what `mortality.js` already computes for
// deprivation deaths, and crime is counted per resident from the
// incidents `crime.js` already records.
function pressuresFor(worldState, scarcity, crimeByCommunity, conditionByCommunity, communityId) {
  const condition = conditionByCommunity.get(communityId);
  return {
    scarcity: clamp(scarcity, 0, 1),
    danger: clamp(crimeByCommunity.get(communityId) ?? 0, 0, 1),
    // Centred on 50 and signed: negative where a place is better kept
    // than ordinary, positive where it is worse. Null — a community in
    // no city, or a city with nothing built — is 0 rather than
    // "terrible", because unknown is not a zero and here a zero on the
    // raw scale would mean total collapse.
    decay: condition === null || condition === undefined
      ? 0
      : clamp((50 - condition) / 50, -1, 1),
  };
}

// One tick of living. Runs in the cross-cutting slot beside
// `behavior.js` — the pipeline is locked at eleven phases and this is
// not a twelfth.
//
// **Order matters in one direction.** Relationship drift reads other
// people's `current_value`, so every value is snapshotted first and the
// whole pass reads that snapshot. Without it, whether A pulls B or B
// pulls A would depend on array order, which is the same class of
// mistake as a stress level feeding the phase that computed it.
function runTraitDrift(worldState, options = {}) {
  const {
    tick = worldState.tick ?? 0,
    scarcity = 0,
    crimeByCommunity = new Map(),
    conditionByCommunity = new Map(),
  } = options;

  const index = indexRows(worldState);
  const valuesById = new Map();
  for (const row of worldState.entityTraits || []) {
    const def = getDefinition(row.trait_id);
    if (!def) continue;
    valuesById.set(`${row.entity_id} ${def.family} ${def.name}`, row.current_value);
  }

  const stressById = new Map(
    (worldState.entityState || []).map((s) => [s.entity_id, Number(s.stress_level)]),
  );

  let moved = 0;
  for (const npc of worldState.npcs || []) {
    moved += driftExperience(worldState, npc.id, tick, index);
    moved += driftEnvironment(
      worldState, npc.id, tick,
      pressuresFor(
        worldState, scarcity, crimeByCommunity, conditionByCommunity, npc.communityId,
      ),
      index,
    );
    moved += driftRelationships(worldState, npc.id, tick, valuesById, index);
    moved += driftTemporary(worldState, npc.id, tick, stressById.get(npc.id) ?? null, index);
  }
  return moved;
}

// ---------------------------------------------------------------------
// What this does NOT do
// ---------------------------------------------------------------------
//
// **`permanent_modifier` stays at zero, and that is a declared absence
// rather than an omission.** A permanent change to a person is the
// output of a formative event — an injury that does not heal, a
// survival that leaves somebody harder for the rest of their life. This
// engine records events, but nothing in it distinguishes an event
// somebody walks away from unchanged from one that marks them, and
// inventing that distinction here would put a whole theory of trauma
// behind a constant nobody chose.
//
// Writing it anyway would be worse than leaving it: a permanent
// modifier applied on a guess never decays and never gets re-examined,
// so an arbitrary choice made here would be the least reversible thing
// in the whole trait system.
//
// **`base_value` stays at its birth value by definition.** Base is what
// you were born with; everything that happens afterwards belongs in a
// modifier, which is the entire reason the schema has six of them.

module.exports = {
  DRIFT_CEILING,
  EXPERIENCE_RATE,
  ENVIRONMENT_RATE,
  RELATIONSHIP_RATE,
  TEMPORARY_RECOVERY,
  STRAIN_THRESHOLD,
  STRAIN_RATE,
  CLOSE_TRUST,
  EXERCISES,
  ENVIRONMENT_EFFECTS,
  CONTAGIOUS,
  STRAIN_DEPRESSES,
  indexRows,
  recompute,
  occupationExercise,
  driftExperience,
  driftEnvironment,
  driftRelationships,
  driftTemporary,
  runTraitDrift,
};
