// server/knowledge.js
//
// **§24 KNOWLEDGE RECOVERY, and what a book does to a person.**
//
// The spec is four lines and every one of them is load-bearing:
//
//     Knowledge is a civilization resource.
//
//     Sources: books, manuals, documents, libraries, universities,
//     experienced NPCs, artifacts, preserved records, blueprints,
//     archives.
//
//     Knowledge can unlock agriculture, medicine, engineering,
//     construction, manufacturing, government, science, education,
//     technology.
//
// `urbanSystems.js`'s Education entry has recorded for weeks that
// "the knowledge tiers of §25 are absent entirely", and §24 was worse
// than absent: `grep -rn "knowledge" server/` found `entity_knowledge`
// (who knows what about whom, which is a different thing entirely),
// `generationalKnowledge` (a family trait nothing reads) and the word
// `knowledge` sitting in TWO canonical vocabularies — `items.
// TRADE_CATEGORIES` and `items.RESOURCE_TYPES` both list it, from §26
// and §28 — with no item, no resource and no code of any kind behind
// either.
//
// ---------------------------------------------------------------------
// Three effects, and every one lands on something that already reads it
// ---------------------------------------------------------------------
// This is the whole design, and the reason it needed no new theory:
//
//   1. **`educational` traits** — Literacy, Technical Knowledge,
//      Historical Knowledge, Self-Taught Aptitude. `technology.
//      learningOf` averages exactly these across a civilization and
//      `canUnlock` uses the result to lower the reemergence bar for a
//      new era. So a people who read can recover a technology a people
//      who have forgotten how to read cannot — which is §24's first
//      line, "knowledge is a civilization resource", and its third,
//      "knowledge can unlock...", already wired and waiting for
//      somebody to move the traits.
//
//   2. **The field's `skills` trait.** §24's nine unlockable fields map
//      onto nine of the nineteenth family's sixteen skills, and
//      `occupations.js` already ties each occupation to one. Reading a
//      medicine manual makes you better at Medicine.
//
//   3. **`npcs.education` attainment**, for the self-taught. Until now
//      `statecraft.runSchooling` was the only writer and it refuses
//      anybody outside 5-30 or in a city whose schools are unfunded —
//      so an adult in a collapsed settlement could never learn
//      anything for the rest of their life, however many books were
//      lying around. Attainment is what `occupations.qualifiedFor`
//      gates a trade on, so this is the rung between finding a manual
//      and being able to hold the job it describes.
//
// The loop that closes is worth stating because it is the point of
// having built the last three files: a book raises attainment →
// attainment opens a tier of occupation → holding that occupation
// exercises its skill through `traitDrift` → the skill is what a
// takeover's specialist requirement asks for. Find a plumbing manual,
// learn to read, become a plumber, take the water plant.
//
// ---------------------------------------------------------------------
// What is NOT here, declared rather than fudged
// ---------------------------------------------------------------------
//   **Books are not tradeable.** `items.js` says in its own header
//   that its seventeen are "exactly the seventeen §27 actually gives,
//   verbatim, and nothing else. **No item is invented here.**" §27
//   gives no barter value for a book, so giving one a `Base_Value`
//   would put an invented number into the one table that exists to
//   hold sourced ones. A book is a holding and a source; it is not
//   priced. A world that wants to trade books supplies the value
//   through `worldState.barterItems`, which is the extension point
//   `items.js` already documents.
//
//   **No `knowledge` resource row.** §28 lists `knowledge` as a
//   resource type and `economy.generateResource` would happily make
//   one — but supply and demand for knowledge would need a consumption
//   rate, and knowledge is not consumed by being used. Declared in
//   `statistics.js` rather than modelled wrongly.

'use strict';

const { seededDraw } = require('./seeded.js');
const demographics = require('./demographics.js');
const occupations = require('./occupations.js');
const { getDefinition } = require('./traitDefinitions.js');
const entityTraits = require('./entityTraits.js');
const traitDrift = require('./traitDrift.js');
const inventory = require('./inventory.js');
const mortality = require('./mortality.js');

// ---------------------------------------------------------------------
// §24's nine fields, and the skill each one is
// ---------------------------------------------------------------------
//: Nine of `traits.js`'s sixteen `skills`, matched by name where the
//: name matches. Two are judgement calls and are flagged as such:
//: `manufacturing` is `Crafting` (the family has no Manufacturing and
//: making things is what Crafting is), and `education` is
//: `Communication` (the family has no Education; `personality.Teaching
//: Ability` exists but is a different family and a different question
//: — how good you are at teaching, not how much you know about
//: teaching). `government` is `Leadership` rather than `Management`
//: because §24 lists government beside science and medicine as a body
//: of knowledge, not as an administrative job.
const FIELDS = {
  agriculture: 'Agriculture',
  medicine: 'Medicine',
  engineering: 'Engineering',
  construction: 'Construction',
  manufacturing: 'Crafting',
  government: 'Leadership',
  science: 'Science',
  education: 'Communication',
  technology: 'Technology',
};

const FIELD_NAMES = Object.keys(FIELDS);

// ---------------------------------------------------------------------
// §24's ten sources
// ---------------------------------------------------------------------
//: Verbatim, in the spec's own order, with two properties added that
//: the spec does not give and this file has to decide:
//:
//:   `kind`  where it is found — a `holding` is an item somebody has,
//:           a `place` is an organization in their city, a `person` is
//:           somebody they could learn from. This is structural rather
//:           than interpretive: the spec's own list mixes all three.
//:
//:   `tier`  the §25 knowledge tier it can carry, which is the one
//:           real judgement here. Anchored on §25's own wording rather
//:           than felt: "documents" and "preserved records" are Tier 1
//:           because reading them is literacy; "basic trades" is Tier 2
//:           and a book is how a trade is taught; a manual is
//:           "intermediate professions"; a blueprint is "professional
//:           knowledge" (§25 Tier 4 names engineering); an archive is
//:           Tier 5's "logistics... advanced science"; a library holds
//:           Tier 4; a university is §25's Tier 6 "specialized
//:           research"; an artifact is Tier 6's "artifact manuals",
//:           which is the spec naming it outright.
//:
//: `experienced NPCs` has no fixed tier at all — it is whatever the
//: person knows, read from their occupation, which is the honest
//: answer and also the only one that makes recruiting a specialist
//: matter (TRIBE_GROWTH_MISSION_UNLOCK_SYSTEM.md).
const SOURCES = {
  books: { kind: 'holding', tier: 2 },
  manuals: { kind: 'holding', tier: 3 },
  documents: { kind: 'holding', tier: 1 },
  libraries: { kind: 'place', tier: 4, organizationType: 'library' },
  universities: { kind: 'place', tier: 6, organizationType: 'research' },
  'experienced NPCs': { kind: 'person', tier: null },
  artifacts: { kind: 'holding', tier: 6 },
  'preserved records': { kind: 'holding', tier: 1 },
  blueprints: { kind: 'holding', tier: 4 },
  archives: { kind: 'place', tier: 5, organizationType: 'school' },
};

const SOURCE_NAMES = Object.keys(SOURCES);
const HOLDING_SOURCES = SOURCE_NAMES.filter((n) => SOURCES[n].kind === 'holding');

// ---------------------------------------------------------------------
// What a holding is called
// ---------------------------------------------------------------------
// A book about medicine is `medicine book`; a plumbing manual is
// `engineering manual`. Two words, field first, so `inventory.holdings`
// — which keys on `item_name` and nothing else — can be asked for
// either half without a join table the schema does not have.
function itemNameFor(field, source) {
  return `${field} ${source.replace(/s$/, '')}`;
}

// The inverse. Returns null for anything that is not a knowledge item,
// which is most of what anybody is carrying.
//
// **Matched against the generated names rather than parsed**, and the
// first version parsed: it split on spaces and required exactly two
// parts, which is true of `medicine manual` and false of `medicine
// preserved record`. Measured immediately — 17 books placed in a
// generated world and 13 readable, with `preserved records` reported
// as a source the world did not contain while seventeen of them sat in
// people's hands. A parser that agrees with its own formatter for five
// of six cases is the worst kind, because the sixth looks like absence.
const NAME_INDEX = new Map();
function readItemName(name) {
  if (typeof name !== 'string') return null;
  if (NAME_INDEX.size === 0) {
    for (const field of FIELD_NAMES) {
      for (const source of HOLDING_SOURCES) {
        NAME_INDEX.set(itemNameFor(field, source), { field, source });
      }
    }
  }
  return NAME_INDEX.get(name) ?? null;
}

// ---------------------------------------------------------------------
// Registering them as items
// ---------------------------------------------------------------------
// `inventory.give` refuses an item `items.findItem` does not know, and
// `items.js` says in its own header that a world adds items through
// `worldState.barterItems` — "definitions live as data, a world can
// override or extend them with no code change, and what the package
// specified stays distinguishable from what somebody added later".
// This is that extension point, used as documented.
//
// **Every one carries `category: 'knowledge'` and NO `baseValue`**, and
// that is the design rather than an omission. `knowledge` is in §26's
// twenty trade categories and §28's thirteen resource types — the spec
// names it twice and gives it no price — so an unpriced knowledge item
// is the honest shape. `barter.barterScore` throws for an item with no
// Base_Value, which is correct, and `trade.sellableOf` skips one, which
// means a starving person sells their tools and keeps their books.
// There is no market for a book here, and saying so is worth more than
// a number nobody chose.
//
// 9 fields x 6 holding sources = 54 items, which is why they are
// generated rather than written out.
function itemDefinitions() {
  const out = [];
  for (const field of FIELD_NAMES) {
    for (const source of HOLDING_SOURCES) {
      out.push({
        name: itemNameFor(field, source),
        category: 'knowledge',
        field,
        source,
        tier: SOURCES[source].tier,
      });
    }
  }
  return out;
}

// Adds them to a world's own item list, once. Idempotent by name, so
// calling it twice on a world leaves it unchanged (standing rule 15).
function registerItems(worldState) {
  if (!Array.isArray(worldState.barterItems)) worldState.barterItems = [];
  const known = new Set(worldState.barterItems.map((i) => i?.name));
  let added = 0;
  for (const definition of itemDefinitions()) {
    if (known.has(definition.name)) continue;
    worldState.barterItems.push(definition);
    added += 1;
  }
  return added;
}

// ---------------------------------------------------------------------
// Reachable sources
// ---------------------------------------------------------------------

function cityOf(worldState, npc) {
  const community = (worldState.communities || []).find((c) => c.id === npc.communityId);
  return community?.city_id ?? null;
}

// What this person could actually learn from, right now. The three
// kinds are gathered separately because they are found in three
// different places, and a `place` or a `person` is reachable only
// within the same city — the same rule `control.js` applies, for the
// same reason: the library three cities away is not one you can walk to.
function sourcesFor(worldState, entityId, options = {}) {
  const { tick = worldState.tick ?? 0 } = options;
  const npc = (worldState.npcs || []).find((n) => n.id === entityId);
  if (!npc) return [];
  const found = [];

  // Holdings.
  for (const holding of inventory.holdingsOf(worldState, entityId)) {
    const read = readItemName(holding.item_name);
    if (!read) continue;
    found.push({
      source: read.source, field: read.field, tier: SOURCES[read.source].tier, via: 'holding',
    });
  }

  // Places. An institution in the city teaches everything it is for —
  // a library has books on every subject, which is what a library is.
  const cityId = cityOf(worldState, npc);
  if (cityId !== null) {
    for (const name of SOURCE_NAMES) {
      const definition = SOURCES[name];
      if (definition.kind !== 'place') continue;
      const open = (worldState.organizations || [])
        .some((o) => o.type === definition.organizationType);
      if (!open) continue;
      for (const field of FIELD_NAMES) {
        found.push({
          source: name, field, tier: definition.tier, via: 'place',
        });
      }
    }
  }

  // People. Somebody in the same community who holds a trade, which is
  // §24's "experienced NPCs" — and it is the only source whose tier is
  // the teacher's rather than the medium's.
  for (const other of worldState.npcs || []) {
    if (other.id === entityId || other.communityId !== npc.communityId) continue;
    const occupation = occupations.occupationOf(worldState, other.id);
    if (!occupation) continue;
    const field = fieldForSkill(occupations.skillOf(occupation));
    if (!field) continue;
    found.push({
      source: 'experienced NPCs',
      field,
      tier: occupations.tierOf(occupation),
      via: 'person',
      teacherId: other.id,
    });
  }

  void tick;
  return found;
}

// The inverse of FIELDS. Returns null for a skill §24 does not name as
// a field — Art, Music, Business, Athletics, Combat, Management and
// Research have no §24 field, and a hunter teaching you to hunt is not
// knowledge recovery in the sense §24 means.
function fieldForSkill(skill) {
  return FIELD_NAMES.find((f) => FIELDS[f] === skill) ?? null;
}

// ---------------------------------------------------------------------
// Whether somebody studies today
// ---------------------------------------------------------------------

//: How often somebody with something to read actually reads it, before
//: their own aptitude is taken into account. A tick is a day, so 0.1 is
//: about three times a month at the neutral aptitude of 50 — a person
//: who picks up a manual now and then rather than a scholar. Below
//: this the mechanism is unmeasurable over a world's life; above it,
//: everybody is a scholar.
const STUDY_RATE = 0.1;

//: The floor on being able to use a written source at all.
//: `demographics.EDUCATION_LEVELS[0]` is `'none'`, and somebody who
//: cannot read cannot learn from a book — but they CAN learn from a
//: person, which is how literacy is recovered at all and is why this
//: gates the medium rather than the study.
const READING_LEVELS = demographics.EDUCATION_LEVELS.slice(1);

function canRead(npc) {
  return READING_LEVELS.includes(npc?.education);
}

// Self-Taught Aptitude scales the rate around the ordinary person, so
// somebody at the population's midpoint studies at exactly STUDY_RATE
// and the trait spreads the population out around it rather than
// moving the baseline (standing rule 12's first clause).
function aptitudeOf(worldState, entityId) {
  const live = entityTraits.getLiveEntity(worldState, entityId);
  const value = Number(live?.traits?.educational?.['Self-Taught Aptitude']);
  return Number.isFinite(value) ? value : 50;
}

// ---------------------------------------------------------------------
// study — one session
// ---------------------------------------------------------------------
// Applies all three effects. Returns what moved, or null if the person
// could not study from this source.
//
// **The gain is expressed in the trait definition's own `growth_rate`**,
// which is what `traitDrift.driftExperience` uses for a day of a habit
// — so "a day spent studying" is literally a day of exercising the
// thing studied, times how far above the reader the source is. Nothing
// here picks a magnitude out of the air; the only new number is
// `SOURCE_REACH`, and it is a ratio of §25 tiers.
//
// It writes `experience_modifier`, the same column `driftExperience`
// owns, on purpose: a skill nobody practises fades, and that is the
// right model for something learned from a book and never used again.
// `permanent_modifier` is deliberately untouched — `traitDrift`'s
// footer declares why, and that declaration is about formative trauma
// rather than about learning, so overriding it here would be answering
// a question nobody asked.
function study(worldState, entityId, source, options = {}) {
  const { tick = worldState.tick ?? 0, index = null } = options;
  const npc = (worldState.npcs || []).find((n) => n.id === entityId);
  if (!npc) return null;
  // A written source needs a reader. A person does not.
  if (source.via !== 'person' && !canRead(npc)) return null;

  const skill = FIELDS[source.field];
  if (!skill) return null;

  const moved = { entityId, field: source.field, source: source.source, traits: [] };
  // **Built once per PASS, not once per session.** `indexRows` walks
  // every `entity_traits` row in the world — 19,200 of them in a
  // generated one — and rebuilding it inside each study call made the
  // Organization phase the slowest thing in the tick. `runStudy` hands
  // one in; a lone caller (a test, a player verb) can still omit it.
  const rows = index ?? traitDrift.indexRows(worldState);

  // How much this source has to give somebody at this attainment. A
  // Tier 6 archive read by somebody at Tier 1 is a lot; the same
  // archive read by a polymath is nothing new.
  const reach = sourceReach(npc, source);
  if (reach <= 0) return null;

  // 1. The field's skill.
  nudgeTrait(worldState, entityId, 'skills', skill, reach, tick, rows, moved);

  // 2. The `educational` family — what a PEOPLE know, which is what
  // `technology.learningOf` averages to decide whether a civilization
  // can recover an era. Literacy from any reading; Self-Taught
  // Aptitude from teaching yourself; Technical Knowledge from the
  // technical tiers; Historical Knowledge from the records.
  nudgeTrait(worldState, entityId, 'educational', 'Literacy', reach, tick, rows, moved);
  if (source.via === 'holding') {
    nudgeTrait(worldState, entityId, 'educational', 'Self-Taught Aptitude', reach, tick, rows, moved);
  }
  if ((source.tier ?? 0) >= TECHNICAL_TIER) {
    nudgeTrait(worldState, entityId, 'educational', 'Technical Knowledge', reach, tick, rows, moved);
  }
  if (source.source === 'preserved records' || source.source === 'archives') {
    nudgeTrait(worldState, entityId, 'educational', 'Historical Knowledge', reach, tick, rows, moved);
  }

  return moved;
}

//: §25's Tier 3 is "intermediate professions — mechanics, plumbing,
//: electrical", which is where a source stops being general reading and
//: starts being technical. From the spec's own tier descriptions, not
//: from a feeling about which sources sound technical.
const TECHNICAL_TIER = 3;

//: How much of a session's value survives the gap between what a source
//: carries and what the reader already has. One §25 tier of headroom is
//: a day's exercise; two tiers is two.
//:
//: **The reader's position is their attainment rung, and the first
//: version routed it through `occupations.TIER_MINIMUM_LEVEL`.** That
//: was wrong in a way the tests caught immediately: that table is a
//: floor on what job you can HOLD, and Tiers 1 and 2 ask for no
//: schooling at all because a trade is learned by doing it. Read as
//: knowledge, it put an unschooled person at Tier 2 — so documents,
//: preserved records and books, three of the six things somebody can
//: carry, could never teach anybody anything. Standing rule 14's shape
//: dressed up as a lookup: a source whose only readers are already
//: past it.
//:
//: Six attainment rungs map onto the first six of §25's seven tiers,
//: in order, and the seventh is deliberately out of reach —
//: "multidisciplinary mastery" is not something a school hands you.
//: The `+ 1` is what makes a source AT your own level still worth
//: reading: a manual on what you already do is not nothing, and only a
//: source BELOW you has nothing left to give.
function sourceReach(npc, source) {
  const attainment = occupations.attainmentOf(npc);
  const reached = (attainment === null ? 0 : attainment) + 1;
  const carries = source.tier ?? reached;
  return Math.max(0, Math.min(occupations.TIER_COUNT, carries - reached + 1));
}

// ---------------------------------------------------------------------
// sessionGain
// ---------------------------------------------------------------------
// **A session is worth the INTERVAL between sessions, not one day.**
//
// The first version was `growth_rate * EXPERIENCE_RATE * reach`, on the
// reasoning that a day spent studying is a day of exercising the thing
// studied. The reasoning is right and the arithmetic was wrong, and it
// took a measured world to see it: a HABIT exercises on every tick,
// while studying happens on about one tick in ten, and
// `driftExperience` fades an unexercised `experience_modifier` by
// `decay_rate` on EVERY tick in between. So a gain of 0.01 arriving
// every tenth day was met by 0.005 of decay nine days running.
//
// **Measured over 100 ticks of a generated world: 807 study sessions,
// and the mean educational trait moved from 51.91 to 51.91.** The
// mechanism ran, the draws fired, the rows were written, and the net
// effect on the world was exactly zero — which is the thirteenth rule
// inverted, a gain smaller than the inverse that opposes it.
//
// Dividing by `STUDY_RATE` is not a fudge factor: it makes one session
// carry the value of the interval it stands for, so somebody who
// studies whenever they can applies the same steady pressure a habit
// does, and `decay_rate` remains the honest inverse it was built to be.
// `reach` then scales that by how far above the reader the source is.
function sessionGain(definition, reach) {
  return (definition.growth_rate * traitDrift.EXPERIENCE_RATE * reach) / STUDY_RATE;
}

function nudgeTrait(worldState, entityId, family, name, reach, tick, index, moved) {
  const rows = index.get(entityId) ?? [];
  const row = rows.find((r) => {
    const def = getDefinition(r.trait_id);
    return def && def.family === family && def.name === name;
  });
  if (!row) return;
  const def = getDefinition(row.trait_id);
  const before = row.experience_modifier;
  const after = Math.max(
    -traitDrift.DRIFT_CEILING,
    Math.min(traitDrift.DRIFT_CEILING, before + sessionGain(def, reach)),
  );
  if (after === before) return;
  row.experience_modifier = Math.round(after * 10000) / 10000;
  traitDrift.recompute(row);
  row.last_updated_tick = tick;
  moved.traits.push({ family, name, from: before, to: row.experience_modifier });
}

// ---------------------------------------------------------------------
// Attainment, for the self-taught
// ---------------------------------------------------------------------
//: How many study sessions it takes to climb one rung of
//: `demographics.EDUCATION_LEVELS` alone. `statecraft.SCHOOL_YEARS_PER_
//: LEVEL` is 4 — four years of school per rung — and a year is 365
//: ticks, so a schooled child spends 1,460 ticks on a rung. Teaching
//: yourself is slower than being taught, and this is the one place that
//: comparison can be made: 400 sessions at STUDY_RATE 0.1 is 4,000
//: ticks, a little under three times as long. Stated as the ratio
//: rather than the count, so changing either stays honest.
//:
//: **A rung therefore takes about a decade, and will not appear in the
//: 200-400 tick worlds this project measures.** 390 sessions at
//: `STUDY_RATE` 0.1 is 3,900 ticks — 10.7 years against schooling's 4
//: — and the measured runs bear that out exactly: 807 sessions across
//: 150 people at tick 100 and 1,981 at tick 250, which is 13 each, so
//: `self_taught` events are 0 in both. That is the mechanism working
//: rather than failing, and it is written down here because the
//: alternative reading — "it fires zero times, so it never fires" — is
//: the fourteenth standing rule's shape and would be the obvious
//: conclusion to draw from a short run. An adult who starts at 20 and
//: lives to 70 has 18,250 ticks and climbs about four rungs. What DOES
//: show in a short run is the `educational` family moving, which is
//: the effect §24 actually turns on: **51.91 → 52.34 → 52.83 → 53.43
//: across 0, 100, 250 and 400 ticks of a generated world, on 3,084
//: study sessions**, with `technology.learningOf` following it digit
//: for digit. A civilization that reads is now measurably better at
//: recovering a technology than one that has forgotten how.
const SELF_TAUGHT_PENALTY = 2.7;

function sessionsPerLevel() {
  // Required lazily: `statecraft` requires half the engine and this is
  // one constant.
  // eslint-disable-next-line global-require
  const statecraft = require('./statecraft.js');
  const schooledTicks = statecraft.SCHOOL_YEARS_PER_LEVEL * 365;
  return Math.round((schooledTicks * SELF_TAUGHT_PENALTY) / (1 / STUDY_RATE) / 10) * 10;
}

// Somebody's running count of study sessions, kept on the NPC rather
// than in a table. **Declared**: there is no `study_sessions` column
// anywhere in the schema and inventing a table for one integer is what
// `restore.js` already refused to do for the world's tick. It migrates
// nowhere, so a restored world's self-taught learners start their
// current rung again — which is worth one sentence in `restore.js`
// rather than a table.
function sessionsOf(npc) {
  return Number(npc.studySessions ?? 0);
}

// ---------------------------------------------------------------------
// runStudy — the pass
// ---------------------------------------------------------------------
// Everybody with something to learn from, once a tick, seeded on the
// PERSON and the tick: the draw is about them, which is the §88
// exception this project already recognises for schooling, flashpoints,
// retellings and distress sales.
//
// Returns crossings only (standing rule 7). A study session is not an
// event — 153 people reading three times a month is 460 rows a month,
// which would bury everything else in the log. Reaching a new rung of
// attainment IS an event, and it happens to a person a handful of times
// in a life.
function runStudy(worldState, tick = worldState.tick ?? 0) {
  const events = [];
  const seed = worldState.seed ?? 'world';
  // Once for the whole pass — see `study`.
  const index = traitDrift.indexRows(worldState);

  for (const npc of worldState.npcs || []) {
    // **`npcs.status` is `active | imprisoned | deceased`**, and the
    // first version of this line tested for `'alive'` — a word that
    // appears nowhere in the vocabulary. `generateNPC` writes
    // `'active'`, so the guard excluded every person in every world and
    // **this entire pass would have been dead on arrival**: §24 built,
    // tested, wired into the Organization phase, and skipping all 153
    // people on every tick. Caught by a fixture built with the real
    // generator (standing rule 6), in a sibling file, one commit later.
    //
    // Being in `worldState.npcs` is what living means — the dead are
    // moved to `worldState.deceased` — so the only status to exclude is
    // the one that keeps somebody in the array: a person serving a
    // sentence has no library, no books and nobody to teach them.
    if (npc.status === 'imprisoned') continue;
    const age = mortality.ageInYears(worldState, npc, tick);
    if (age === null || age < STUDY_AGE_MIN) continue;

    const available = sourcesFor(worldState, npc.id, { tick });
    if (available.length === 0) continue;

    const rate = STUDY_RATE * (aptitudeOf(worldState, npc.id) / NEUTRAL_APTITUDE);
    if (seededDraw([seed, 'study', npc.id, tick]) >= rate) continue;

    // Which source. Seeded the same way, so a replay picks the same
    // book off the same shelf.
    const pick = available[
      Math.floor(seededDraw([seed, 'study-source', npc.id, tick]) * available.length)
      % available.length
    ];
    const moved = study(worldState, npc.id, pick, { tick, index });
    if (!moved) continue;

    npc.studySessions = sessionsOf(npc) + 1;
    const crossing = advanceAttainment(npc, tick);
    if (crossing) events.push(crossing);
  }

  return events;
}

//: Old enough to be taught. `statecraft.SCHOOL_AGE_MIN` is 5 and this
//: is the same threshold for the same reason — there is no second
//: opinion in the engine about when a person can start learning.
const STUDY_AGE_MIN = 5;

//: The midpoint of a 0-100 trait, so an ordinary person studies at
//: exactly `STUDY_RATE`.
const NEUTRAL_APTITUDE = 50;

// One rung, when the sessions have been put in. Returns the event or
// null — and the event is the crossing, so somebody who reaches
// `advanced` and keeps reading produces nothing further.
function advanceAttainment(npc, tick) {
  const levels = demographics.EDUCATION_LEVELS;
  const at = levels.indexOf(npc.education);
  // Unknown attainment is not `none` — somebody the engine has never
  // measured is not somebody it has measured as unschooled, and
  // promoting them would be inventing a fact about them.
  if (at === -1 || at >= levels.length - 1) return null;
  if (sessionsOf(npc) < sessionsPerLevel() * (at + 1)) return null;

  npc.education = levels[at + 1];
  return {
    type: 'self_taught',
    severity: 'low',
    note: `entity ${npc.id} taught themselves to ${levels[at + 1]} level`,
    tick,
    affected_entity_ids: [npc.id],
    global_effects: { from: levels[at], to: levels[at + 1], sessions: sessionsOf(npc) },
  };
}

// ---------------------------------------------------------------------
// describeKnowledge
// ---------------------------------------------------------------------
// The measurement. How much of §24's source list a world actually
// contains, and how many people can reach any of it — the number that
// would have caught "the knowledge tiers of §25 are absent entirely"
// on the day it became untrue.
function describeKnowledge(worldState, options = {}) {
  const { tick = worldState.tick ?? 0 } = options;
  const present = new Set();
  let holdings = 0;
  // `worldState.inventory`, named once. An `a || b` fallback here would
  // be worse than useless: an empty array is TRUTHY in JavaScript, so a
  // world with an empty `inventoryItems` would report no books while
  // holding a shelf of them.
  for (const holding of worldState.inventory || []) {
    const read = readItemName(holding.item_name);
    if (!read) continue;
    present.add(read.source);
    holdings += Number(holding.quantity ?? 1);
  }
  for (const name of SOURCE_NAMES) {
    const definition = SOURCES[name];
    if (definition.kind === 'place'
      && (worldState.organizations || []).some((o) => o.type === definition.organizationType)) {
      present.add(name);
    }
  }

  let reached = 0;
  let sessions = 0;
  for (const npc of worldState.npcs || []) {
    if (sourcesFor(worldState, npc.id, { tick }).length > 0) reached += 1;
    sessions += sessionsOf(npc);
    if (occupations.occupationOf(worldState, npc.id)) present.add('experienced NPCs');
  }

  return {
    sources: SOURCE_NAMES.length,
    present: [...present].sort(),
    absent: SOURCE_NAMES.filter((n) => !present.has(n)).sort(),
    holdings,
    peopleWithAnySource: reached,
    population: (worldState.npcs || []).length,
    sessions,
    sessionsPerLevel: sessionsPerLevel(),
  };
}

module.exports = {
  FIELDS,
  FIELD_NAMES,
  SOURCES,
  SOURCE_NAMES,
  HOLDING_SOURCES,
  STUDY_RATE,
  STUDY_AGE_MIN,
  NEUTRAL_APTITUDE,
  TECHNICAL_TIER,
  SELF_TAUGHT_PENALTY,
  READING_LEVELS,
  itemNameFor,
  readItemName,
  itemDefinitions,
  registerItems,
  fieldForSkill,
  canRead,
  aptitudeOf,
  sourcesFor,
  sourceReach,
  study,
  sessionsOf,
  sessionsPerLevel,
  advanceAttainment,
  runStudy,
  describeKnowledge,
};
