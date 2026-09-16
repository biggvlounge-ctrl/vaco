// server/archetypes.js
//
// The tags a person's traits add up to, and the tastes they happen to
// have.
//
// Two tables, both empty in every world this engine had built, and the
// source package is unusually specific about both — including about the
// one thing that would have been easy to get wrong.
//
// ---------------------------------------------------------------------
// Archetypes are a READ, and the document says so twice
//
// `VACANCY_TRAIT_DATABASE_ATTACHMENT.md`:
//
//   "Trait Archetypes — derived, not source data. Discrete tags
//    computed from trait threshold combinations, never stored
//    independently."
//
//   "The `archetypes` table stores the *derived tag* plus which traits
//    produced it — never re-specify these as new scored trait families;
//    they are a read, not a write."
//
// And §3.7: "derived layer (~30 tags), not new source data; sits
// between raw Traits and Keys."
//
// So nothing here is a new number on a person. `tagsFor` computes the
// tags live from `entity_traits` every time it is asked, and the table
// is a HISTORY of when somebody became something — written on a
// crossing, never on a condition, which is the seventh standing rule and
// also what makes `derived_from_traits` worth storing: it records the
// values that produced the tag at the moment it appeared, so a later
// reader can see why.
//
// That distinction is the whole design. Storing the tag every tick would
// be duplicating a computable rollup (standing rule 3) and would bury
// the tick it actually happened on under a hundred identical rows —
// exactly what `behavior.js` did with habits before it was fixed.
//
// ---------------------------------------------------------------------
// Preferences are taste, not values, and that line is the document's
//
// The same file separates them explicitly: "Personal Preferences —
// individual, taste not values". A preference is what somebody likes; a
// value is what they would sacrifice for. `motivation.js` owns the
// second. This owns the first, and the six categories are the
// document's own `PREFERENCE_CATEGORIES`, matching
// `preferences.category`'s enum comment exactly.
//
// **What a preference does NOT do here: drive anything.** There is no
// music in this engine, no cuisine and no fashion, so a preference is
// recorded and read and changes no outcome. That is stated rather than
// hidden, and it is why this module does not pretend to a tick pass.

'use strict';

const { nextAfter } = require('./nextAfter.js');
const { getLiveEntity } = require('./entityTraits.js');

let nextArchetypeId = 1;

function reseedIds(worldState) {
  nextArchetypeId = nextAfter(worldState.archetypes, 'id');
  return { nextArchetypeId };
}

// ---------------------------------------------------------------------
// Preferences
// ---------------------------------------------------------------------

// `preferences.category`'s own enumeration, and the same six the trait
// document lists under PREFERENCE_CATEGORIES.
const PREFERENCE_CATEGORIES = [
  'music', 'food', 'fashion', 'hobby', 'entertainment', 'learning_style',
];

//: What somebody can prefer within each category. **Flagged
//: interpretive, and the only invented vocabulary in this file** — the
//: package names the categories and never their contents.
//:
//: Deliberately abstract rather than named genres and dishes. This
//: world has no music and no cuisine to name, so inventing "jazz" and
//: "noodles" would be writing setting into an engine; a shape ("driving",
//: "sparse") is a preference a world can later map onto its own content
//: without this file having decided what that content is.
const PREFERENCE_OPTIONS = {
  music: ['driving', 'sparse', 'melodic', 'percussive', 'choral'],
  food: ['plain', 'rich', 'spiced', 'preserved', 'fresh'],
  fashion: ['practical', 'ornate', 'severe', 'inherited', 'improvised'],
  hobby: ['making', 'collecting', 'competing', 'studying', 'wandering'],
  entertainment: ['stories', 'contests', 'gatherings', 'solitude', 'spectacle'],
  learning_style: ['watching', 'doing', 'reading', 'being told', 'trial and error'],
};

function preferencesOf(worldState, entityId) {
  return (worldState.preferences || []).filter((p) => p.entity_id === entityId);
}

function preferenceOf(worldState, entityId, category) {
  return (worldState.preferences || []).find(
    (p) => p.entity_id === entityId && p.category === category,
  ) ?? null;
}

// One row per category per entity, which is what the composite primary
// key `(entity_id, category)` asks for.
//
// `chooseFor` is required rather than optional: a preference drawn from
// `Math.random` would break §88's seeded determinism, and defaulting to
// the first option would give every person in the world identical taste
// — which is the placeholder problem this project keeps finding, in the
// one table whose entire purpose is that people differ.
function setPreference(worldState, options = {}) {
  const {
    entityId, category, value, tick = worldState.tick ?? 0,
  } = options;

  if (entityId === undefined || entityId === null) {
    throw new Error('archetypes.setPreference requires an entityId (preferences.entity_id is NOT NULL)');
  }
  if (!PREFERENCE_CATEGORIES.includes(category)) {
    throw new Error(
      `archetypes.setPreference: "${category}" is not a category `
      + `(one of: ${PREFERENCE_CATEGORIES.join(', ')})`,
    );
  }

  const existing = preferenceOf(worldState, entityId, category);
  if (existing) {
    existing.value = value ?? null;
    existing.tick = tick;
    return existing;
  }
  const row = {
    entity_id: entityId,
    category,
    value: value ?? null,
    tick,
  };
  (worldState.preferences || (worldState.preferences = [])).push(row);
  return row;
}

function generatePreferences(worldState, entityId, options = {}) {
  const { chooseFor, tick = worldState.tick ?? 0 } = options;
  if (typeof chooseFor !== 'function') {
    throw new Error(
      'archetypes.generatePreferences requires options.chooseFor — a preference drawn from '
      + 'Math.random breaks §88 determinism, and a default would give everybody identical taste',
    );
  }
  return PREFERENCE_CATEGORIES.map((category) => setPreference(worldState, {
    entityId,
    category,
    value: chooseFor(category, PREFERENCE_OPTIONS[category]),
    tick,
  }));
}

// ---------------------------------------------------------------------
// Archetypes
// ---------------------------------------------------------------------

//: The 23 individual tags, verbatim from
//: `VACANCY_TRAIT_DATABASE_ATTACHMENT.md`'s own list, each with the
//: trait threshold combination that produces it.
//:
//: **The tags are the document's; the thresholds are not** — it gives
//: the names and says "computed from trait threshold combinations"
//: without saying which. So every `when` below is flagged interpretive,
//: and each is written to read as its own name: "Natural Leader" is
//: high Command Presence AND high Charisma, because either alone is
//: something else the list already has a name for.
//:
//: Every family and trait cited is checked against `traits.js` by
//: `test/archetypes.test.js` — an invented trait name would produce a
//: tag nobody could ever earn, silently, forever (standing rule 6).
const HIGH = 70;
const LOW = 30;

const INDIVIDUAL_ARCHETYPES = [
  { name: 'Natural Leader', when: (t) => t('leadership', 'Command Presence') >= HIGH && t('social', 'Charisma') >= HIGH },
  { name: 'Strategic Thinker', when: (t) => t('leadership', 'Strategic Vision') >= HIGH && t('mental', 'Problem Solving') >= HIGH },
  { name: 'Charismatic', when: (t) => t('social', 'Charisma') >= HIGH && t('social', 'Persuasion') >= HIGH },
  { name: 'Independent', when: (t) => t('behavioral', 'Conformity') <= LOW && t('social', 'Group Loyalty') <= LOW },
  { name: 'Disciplined', when: (t) => t('behavioral', 'Discipline') >= HIGH && t('behavioral', 'Recklessness') <= LOW },
  { name: 'Creative', when: (t) => t('mental', 'Creativity') >= HIGH },
  { name: 'Risk Taker', when: (t) => t('economic', 'Risk Appetite') >= HIGH && t('behavioral', 'Recklessness') >= HIGH },
  { name: 'Cautious', when: (t) => t('mental', 'Risk Assessment') >= HIGH && t('economic', 'Risk Appetite') <= LOW },
  { name: 'Trustworthy', when: (t) => t('reputation', 'Trustworthiness') >= HIGH && t('behavioral', 'Honesty') >= HIGH },
  { name: 'Unreliable', when: (t) => t('behavioral', 'Honesty') <= LOW && t('behavioral', 'Discipline') <= LOW },
  { name: 'Diplomatic', when: (t) => t('social', 'Persuasion') >= HIGH && t('behavioral', 'Patience') >= HIGH },
  { name: 'Aggressive', when: (t) => t('behavioral', 'Aggression') >= HIGH },
  { name: 'Generous', when: (t) => t('economic', 'Greed') <= LOW && t('emotional', 'Empathy') >= HIGH },
  { name: 'Selfish', when: (t) => t('economic', 'Greed') >= HIGH && t('emotional', 'Empathy') <= LOW },
  { name: 'Entrepreneur', when: (t) => t('economic', 'Risk Appetite') >= HIGH && t('skills', 'Business') >= HIGH },
  { name: 'Investor', when: (t) => t('economic', 'Frugality') >= HIGH && t('economic', 'Resource Hoarding') >= HIGH },
  { name: 'Worker Mentality', when: (t) => t('behavioral', 'Discipline') >= HIGH && t('economic', 'Risk Appetite') <= LOW },
  { name: 'Innovator', when: (t) => t('mental', 'Creativity') >= HIGH && t('technology', 'Machinery Aptitude') >= HIGH },
  { name: 'Prepared', when: (t) => t('environmental', 'Wilderness Survival') >= HIGH && t('mental', 'Risk Assessment') >= HIGH },
  { name: 'Adaptive', when: (t) => t('mental', 'Adaptability') >= HIGH && t('mental', 'Learning Speed') >= HIGH },
  { name: 'Fearless', when: (t) => t('combat', 'Composure Under Fire') >= HIGH && t('psychological', 'Paranoia') <= LOW },
  { name: 'Paranoid', when: (t) => t('psychological', 'Paranoia') >= HIGH && t('psychological', 'Trust Threshold') >= HIGH },
  { name: 'Community Focused', when: (t) => t('social', 'Group Loyalty') >= HIGH && t('emotional', 'Empathy') >= HIGH },
];

// Every trait a tag reads, so the test can check them all against
// `traits.js` without re-listing them here.
//
// **Read out of the source, not by calling the predicate**, and that
// took a second attempt. The first version passed a probe function that
// recorded each lookup and returned a neutral 50 — but `&&`
// short-circuits, so for `t(a) >= HIGH && t(b) >= HIGH` the probe's 50
// failed the first test and `b` was never evaluated. It reported 23
// citations for 23 tags that read 44 traits between them, and would
// have cheerfully passed an invented name in any second position.
//
// A trait a tag reads but that does not exist produces a tag nobody can
// ever earn, silently and forever — standing rule 6 — so this check has
// to see every citation, not the ones a particular input happens to
// reach.
function citedTraits() {
  const cited = [];
  for (const archetype of INDIVIDUAL_ARCHETYPES) {
    const source = archetype.when.toString();
    for (const m of source.matchAll(/t\(\s*'([^']+)'\s*,\s*'([^']+)'\s*\)/g)) {
      cited.push([m[1], m[2]]);
    }
  }
  return cited;
}

// Which tags this person's traits currently add up to, computed fresh.
//
// **A read, per the document.** Nothing is stored by calling this.
// Returns the tags and the trait values that produced each, which is
// what `archetypes.derived_from_traits` is for.
function tagsFor(worldState, entityId) {
  const live = getLiveEntity(worldState, entityId);
  if (!live) return null;

  const seen = [];
  const read = (family, name) => {
    const raw = Number(live.traits?.[family]?.[name]);
    const value = Number.isFinite(raw) ? raw : 50;
    seen.push({ family, name, value });
    return value;
  };

  const tags = [];
  for (const archetype of INDIVIDUAL_ARCHETYPES) {
    seen.length = 0;
    if (!archetype.when(read)) continue;
    // A copy, because `seen` is reused for the next tag.
    tags.push({ name: archetype.name, derivedFrom: seen.map((s) => ({ ...s })) });
  }
  return tags;
}

function archetypesOf(worldState, entityId) {
  return (worldState.archetypes || []).filter((a) => a.entity_id === entityId);
}

// What this person is currently recorded as, as a set of names. The
// table is a history, so "currently" means every tag that has appeared
// and not since been superseded — see `syncArchetypes`.
function currentTags(worldState, entityId) {
  return new Set(archetypesOf(worldState, entityId).map((a) => a.archetype_name));
}

// Record any tag this person has newly become, and nothing else.
//
// **Written on a CROSSING, not a condition** — standing rule 7, and the
// difference between a history and a hundred identical rows a tick.
// Somebody who has been Disciplined for a year has one row saying when
// they became it, not 365 saying they still are.
//
// A tag somebody has LOST is not deleted: `archetypes` has no status
// column and the row is a record of a moment that really happened.
// `tagsFor` is the live answer; this table is the history of it.
function syncArchetypes(worldState, entityId, tick = null) {
  const tags = tagsFor(worldState, entityId);
  if (tags === null) return [];

  const at = tick ?? worldState.tick ?? 0;
  const already = currentTags(worldState, entityId);
  const added = [];

  for (const tag of tags) {
    if (already.has(tag.name)) continue;
    const row = {
      id: nextArchetypeId++,
      entity_id: entityId,
      archetype_name: tag.name,
      // The values AT THE MOMENT the tag appeared, which is the whole
      // reason this column exists — a later reader can see what
      // produced it rather than recomputing against traits that have
      // since drifted.
      derived_from_traits: tag.derivedFrom,
      tick: at,
    };
    (worldState.archetypes || (worldState.archetypes = [])).push(row);
    added.push(row);
  }
  return added;
}

// One pass over everybody. Runs in the cross-cutting slot beside
// behavior, motivation and trait drift — the pipeline is locked at
// eleven and what somebody has become is not a stage of a tick.
//
// Cheap on purpose: `tagsFor` reads one entity's traits and the common
// case is that nothing changed, so this adds no rows on most ticks.
function runArchetypes(worldState, options = {}) {
  const { tick = worldState.tick ?? 0 } = options;
  const events = [];

  for (const npc of worldState.npcs || []) {
    for (const row of syncArchetypes(worldState, npc.id, tick)) {
      events.push({
        type: 'archetype_emerged',
        severity: 'low',
        note: row.archetype_name,
        tick,
        affected_entity_ids: [npc.id],
        global_effects: { archetype: row.archetype_name },
      });
    }
  }
  return events;
}

// ---------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------

function describeArchetypes(worldState, entityId) {
  const tags = tagsFor(worldState, entityId);
  if (tags === null) return null;
  return {
    entityId,
    // What they are now, computed.
    is: tags.map((t) => t.name),
    // When each was first recorded, from the history.
    since: archetypesOf(worldState, entityId)
      .map((a) => ({ archetype: a.archetype_name, tick: a.tick })),
    // Taste. Null rather than an empty list when nobody set any — the
    // difference between "has no preferences recorded" and "prefers
    // nothing".
    prefers: preferencesOf(worldState, entityId).length === 0
      ? null
      : Object.fromEntries(preferencesOf(worldState, entityId).map((p) => [p.category, p.value])),
  };
}

module.exports = {
  PREFERENCE_CATEGORIES,
  PREFERENCE_OPTIONS,
  INDIVIDUAL_ARCHETYPES,
  HIGH,
  LOW,
  reseedIds,
  preferencesOf,
  preferenceOf,
  setPreference,
  generatePreferences,
  citedTraits,
  tagsFor,
  archetypesOf,
  currentTags,
  syncArchetypes,
  runArchetypes,
  describeArchetypes,
};
