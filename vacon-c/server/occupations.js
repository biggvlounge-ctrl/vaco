// server/occupations.js
//
// **What a person does for a living.**
//
// `employment_records.position` has been in the schema from the start.
// `economy.hireEntity` accepts it, names it in its own signature, and
// migrate/restore carry it. `grep -rn "position:" server/*.js` returned
// exactly one hit before this file existed, in `geo.js`, about
// coordinates. **Every job in every world this engine has ever run was
// untitled** — 55 people at work in a measured world and not one of
// them had a trade.
//
// That is the twenty-somethingth instance of the same shape, and it is
// worth naming precisely because of who cites it:
// `TRIBE_GROWTH_MISSION_UNLOCK_SYSTEM.md` builds its entire mechanic on
// "the Occupation Taxonomy already tracks exactly what real skill each
// NPC brings", and `VACANCY_SEED.md`'s audit of that claim says
// "Nothing — no occupation or profession field exists on an NPC at
// all". The audit was right about the substance and slightly wrong
// about the location: the field exists on the employment record rather
// than the person, which is the better place for it, and nothing wrote
// it.
//
// ---------------------------------------------------------------------
// The taxonomy is the spec's, not an invented one
// ---------------------------------------------------------------------
// §25 EDUCATION & KNOWLEDGE TIERS names seven tiers and, for six of
// them, the actual subjects: "carpentry, sewing, fishing, hunting,
// farming, tool usage" at Tier 2, "mechanics, plumbing, electrical" at
// Tier 3, "medicine, engineering, finance, business, navigation,
// agriculture science" at Tier 4, "architecture, logistics, military
// tactics, advanced science, diplomacy" at Tier 5, and so on. Every
// occupation below is one of those subjects turned into the person who
// practises it. `KNOWLEDGE_TIERS` carries §25's own wording so the
// derivation is checkable rather than asserted.
//
// Four occupations are NOT in §25 and are marked `implied` — teacher,
// librarian, curator, orderly. They come from `organizations.type`,
// whose schema enumeration already includes `school`, `library`,
// `museum` and `hospital`: an organization type that exists and employs
// nobody identifiable is the same dead end as a position nobody writes.
// A school employs a teacher by definition, not by invention. Marking
// them is the point — "we checked, and this one is not in the document"
// is exactly the knowledge that evaporates.
//
// ---------------------------------------------------------------------
// It attaches to a skill, because the skills family was already there
// ---------------------------------------------------------------------
// `traits.js`'s nineteenth family is `skills`, sixteen of them:
// Communication, Leadership, Engineering, Medicine, Science, Technology,
// Art, Music, Business, Agriculture, Construction, Combat, Athletics,
// Crafting, Research, Management. Each occupation names the one it
// exercises, and `traitDrift`'s `work` habit now grows THAT skill
// instead of growing `skills.Management` for everybody in the world
// regardless of trade — a farmer who has worked for thirty years was
// getting better at management and no better at agriculture.
//
// ---------------------------------------------------------------------
// The education gate does not lock anybody out
// ---------------------------------------------------------------------
// A tier-4 occupation asks for attainment; a tier-2 one does not. But
// the gate decides WHICH occupation, never WHETHER somebody is hired —
// `runLabour`'s only test stays productivity, for the §9 reason stated
// there. Somebody who qualifies for nothing an employer offers takes
// its lowest-tier position. That is deliberate and it is the twelfth
// rule's third clause: a sensitivity floor on the engine's only player
// verb was once a permanent lock, and a qualification floor on being
// employed at all would be the same mistake with a diploma on it.

'use strict';

const { seededDraw } = require('./seeded.js');
const demographics = require('./demographics.js');
const { getLiveEntity } = require('./entityTraits.js');

// ---------------------------------------------------------------------
// §25, verbatim in its own subjects
// ---------------------------------------------------------------------
//: Quoted so the occupations below can be checked against it. Tier 7
//: names no subjects in the spec — "multidisciplinary mastery" is the
//: whole of it — so its subject list is empty rather than guessed.
const KNOWLEDGE_TIERS = [
  {
    tier: 1,
    name: 'basic literacy and everyday skills',
    subjects: ['reading', 'writing', 'basic math', 'cooking', 'gardening', 'first aid', 'basic barter'],
  },
  {
    tier: 2,
    name: 'basic trades',
    subjects: ['carpentry', 'sewing', 'fishing', 'hunting', 'farming', 'tool usage'],
  },
  {
    tier: 3,
    name: 'intermediate professions',
    subjects: ['mechanics', 'plumbing', 'electrical', 'advanced fishing/hunting', 'food preservation'],
  },
  {
    tier: 4,
    name: 'professional knowledge',
    subjects: ['medicine', 'engineering', 'finance', 'business', 'navigation', 'agriculture science'],
  },
  {
    tier: 5,
    name: 'advanced technical/strategic knowledge',
    subjects: ['architecture', 'logistics', 'military tactics', 'advanced science', 'diplomacy'],
  },
  {
    tier: 6,
    name: 'rare/esoteric knowledge',
    subjects: ['ancient languages', 'specialized research', 'artifact manuals', 'rare scientific information'],
  },
  {
    tier: 7,
    name: 'expert knowledge',
    subjects: [],
  },
];

const TIER_COUNT = KNOWLEDGE_TIERS.length;

// ---------------------------------------------------------------------
// The occupations
// ---------------------------------------------------------------------
//: `source` is either the §25 subject this occupation practises, or
//: `implied` where the organization type demands a job §25 does not
//: name. `employers` are `organizations.type` values, the schema's own
//: enumeration and nothing wider.
const OCCUPATIONS = {
  // ---- Tier 1: everyday skills -----------------------------------------
  labourer: {
    tier: 1, skill: 'Construction', source: 'tool usage',
    employers: ['business', 'corporation', 'gang', 'government'],
  },
  cook: {
    tier: 1, skill: 'Crafting', source: 'cooking',
    employers: ['business', 'school', 'hospital'],
  },
  trader: {
    tier: 1, skill: 'Business', source: 'basic barter',
    employers: ['business', 'corporation', 'gang'],
  },

  // ---- Tier 2: basic trades --------------------------------------------
  carpenter: {
    tier: 2, skill: 'Construction', source: 'carpentry',
    employers: ['business', 'corporation'],
  },
  tailor: {
    tier: 2, skill: 'Crafting', source: 'sewing',
    employers: ['business'],
  },
  fisher: {
    tier: 2, skill: 'Agriculture', source: 'fishing',
    employers: ['business'],
  },
  hunter: {
    tier: 2, skill: 'Combat', source: 'hunting',
    employers: ['business', 'gang'],
  },
  farmer: {
    tier: 2, skill: 'Agriculture', source: 'farming',
    employers: ['business', 'corporation'],
  },

  // ---- Tier 3: intermediate professions --------------------------------
  mechanic: {
    tier: 3, skill: 'Technology', source: 'mechanics',
    employers: ['business', 'corporation', 'military'],
  },
  plumber: {
    tier: 3, skill: 'Engineering', source: 'plumbing',
    employers: ['business', 'government'],
  },
  electrician: {
    tier: 3, skill: 'Engineering', source: 'electrical',
    employers: ['business', 'government', 'corporation'],
  },
  preserver: {
    tier: 3, skill: 'Crafting', source: 'food preservation',
    employers: ['business'],
  },
  teacher: {
    tier: 3, skill: 'Communication', source: 'implied',
    employers: ['school'],
  },
  orderly: {
    tier: 3, skill: 'Medicine', source: 'implied',
    employers: ['hospital'],
  },
  librarian: {
    tier: 3, skill: 'Research', source: 'implied',
    employers: ['library'],
  },

  // ---- Tier 4: professional knowledge -----------------------------------
  physician: {
    tier: 4, skill: 'Medicine', source: 'medicine',
    employers: ['hospital', 'military'],
  },
  engineer: {
    tier: 4, skill: 'Engineering', source: 'engineering',
    employers: ['business', 'corporation', 'government', 'military', 'research'],
  },
  financier: {
    tier: 4, skill: 'Business', source: 'finance',
    employers: ['corporation', 'business', 'government'],
  },
  manager: {
    tier: 4, skill: 'Management', source: 'business',
    employers: ['business', 'corporation', 'government', 'media', 'school', 'hospital', 'library', 'museum', 'sports', 'club'],
  },
  navigator: {
    tier: 4, skill: 'Technology', source: 'navigation',
    employers: ['business', 'military'],
  },
  agronomist: {
    tier: 4, skill: 'Agriculture', source: 'agriculture science',
    employers: ['research', 'government', 'corporation'],
  },
  curator: {
    tier: 4, skill: 'Art', source: 'implied',
    employers: ['museum'],
  },

  // ---- Tier 5: advanced technical/strategic ----------------------------
  architect: {
    tier: 5, skill: 'Construction', source: 'architecture',
    employers: ['corporation', 'government'],
  },
  logistician: {
    tier: 5, skill: 'Management', source: 'logistics',
    employers: ['corporation', 'military', 'government'],
  },
  officer: {
    tier: 5, skill: 'Combat', source: 'military tactics',
    employers: ['military', 'government'],
  },
  scientist: {
    tier: 5, skill: 'Science', source: 'advanced science',
    employers: ['research', 'government'],
  },
  diplomat: {
    tier: 5, skill: 'Communication', source: 'diplomacy',
    employers: ['government'],
  },

  // ---- Tier 6: rare/esoteric -------------------------------------------
  linguist: {
    tier: 6, skill: 'Research', source: 'ancient languages',
    employers: ['research', 'library'],
  },
  researcher: {
    tier: 6, skill: 'Research', source: 'specialized research',
    employers: ['research'],
  },

  // ---- Tier 7: expert --------------------------------------------------
  //: §25 gives Tier 7 no subjects, so there is one occupation at it and
  //: it is the tier's own wording. Nothing in a generated world reaches
  //: it yet — `advanced` attainment requires the full school ladder —
  //: and that is honest rather than a gap: a reset civilization is not
  //: supposed to have polymaths in year one.
  polymath: {
    tier: 7, skill: 'Science', source: 'multidisciplinary mastery',
    employers: ['research'],
  },

  // ---- outside the tiers, and named by other documents ------------------
  //: `organizations.type` enumerates `gang`, `religion`, `sports` and
  //: `club`, and §25's ladder is about knowledge rather than every way
  //: a person can be employed. These four are tiered by what they ask
  //: of a person, not by a §25 subject, and say so.
  enforcer: {
    tier: 2, skill: 'Combat', source: 'organizations.type gang',
    employers: ['gang', 'military', 'government'],
  },
  preacher: {
    tier: 3, skill: 'Communication', source: 'organizations.type religion',
    employers: ['religion'],
  },
  athlete: {
    tier: 2, skill: 'Athletics', source: 'organizations.type sports',
    employers: ['sports', 'club'],
  },
  reporter: {
    tier: 3, skill: 'Communication', source: 'organizations.type media',
    employers: ['media'],
  },
};

const OCCUPATION_NAMES = Object.keys(OCCUPATIONS);

// ---------------------------------------------------------------------
// Which post makes a place what it is
// ---------------------------------------------------------------------
// **One vocabulary, in one file.** `TRIBE_GROWTH_MISSION_UNLOCK_SYSTEM.
// md` turns on exactly this: "A location's Control Key already
// specifies real specialist requirements (a Hospital needs medical
// experts)... The moment a Tribe recruits someone whose occupation
// matches a nearby location's specialist requirement, that match itself
// becomes the trigger for a new, real, suggested mission." So the
// mapping is read by `worldgen` (to staff an institution with the
// person who defines it), by `control.js` (as a takeover's specialist
// requirement) and by nothing else — and it lives here rather than in
// either, because this project keeps finding the same list written out
// three times with three different spellings.
//
// Not "the highest tier the type employs", which was the first version
// and gave a schoolhouse a manager and a reading room a linguist. A
// tier is not a definition.
const DEFINING_POST = {
  school: 'teacher',
  hospital: 'physician',
  library: 'librarian',
  museum: 'curator',
  research: 'researcher',
  media: 'reporter',
  religion: 'preacher',
  sports: 'athlete',
  gang: 'enforcer',
  military: 'officer',
  government: 'diplomat',
  // `business`, `corporation` and `club` are deliberately absent. A
  // business is not defined by one trade — it is whatever it does — and
  // returning `manager` for all three would assert something about them
  // that is not true. `postFor` returns null and the caller decides.
  //: `business`, `corporation`, `club` → null, on purpose.
};

// The infrastructure the schema defines has no operator column at all,
// so the link from a water plant to the person who runs it has to be
// stated somewhere. §25's own subject list is what names them:
// "plumbing, electrical" at Tier 3 and "engineering" at Tier 4.
//
// Six of `infrastructure.INFRASTRUCTURE_TYPES` are missing here and
// that is the honest answer rather than an omission: roads and bridges
// are built and then stand, and nobody in this engine's occupation
// taxonomy is a road. `postForInfrastructure` returns null for them,
// and `control.js` reads that as "no specialist is required to hold
// it", which is true — an unmanned road is taken by standing on it.
const INFRASTRUCTURE_POST = {
  hospitals: 'physician',
  schools: 'teacher',
  water_systems: 'plumber',
  electricity: 'electrician',
  internet: 'engineer',
  public_safety: 'officer',
  waste_management: 'labourer',
  rail: 'navigator',
};

function postFor(organizationType) {
  return DEFINING_POST[organizationType] ?? null;
}

function postForInfrastructure(infrastructureType) {
  return INFRASTRUCTURE_POST[infrastructureType] ?? null;
}

// ---------------------------------------------------------------------
// The education gate
// ---------------------------------------------------------------------
//: `demographics.EDUCATION_LEVELS` is six rungs — none, basic,
//: secondary, vocational, higher, advanced — and §25 is seven tiers.
//: They are not the same ladder and forcing one onto the other would
//: invent a correspondence, so this is a floor per tier rather than a
//: mapping: the minimum attainment at which a tier becomes reachable.
//: Tiers 1 and 2 ask for nothing, which is what "basic trades" means —
//: you learn them by doing them, which is what `traitDrift` then does.
const TIER_MINIMUM_LEVEL = {
  1: 'none',
  2: 'none',
  3: 'basic',
  4: 'secondary',
  5: 'vocational',
  6: 'higher',
  7: 'advanced',
};

function levelIndex(level) {
  return demographics.EDUCATION_LEVELS.indexOf(level);
}

// Attainment as a number, with unknown kept distinct from none. A
// person with no `education` field at all has not been measured; a
// person at `'none'` has. `Number(null)` is 0 and 0 is `'none'`, which
// is exactly the corollary in CLAUDE.md, so this returns null.
function attainmentOf(npc) {
  if (!npc || npc.education === null || npc.education === undefined) return null;
  const at = levelIndex(npc.education);
  return at === -1 ? null : at;
}

function tierReachable(npc, tier) {
  const at = attainmentOf(npc);
  // Unknown attainment reaches what no schooling reaches, and no more.
  const have = at === null ? 0 : at;
  return have >= levelIndex(TIER_MINIMUM_LEVEL[tier]);
}

// ---------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------

function definitionOf(name) {
  return OCCUPATIONS[name] ?? null;
}

function tierOf(name) {
  const def = definitionOf(name);
  return def ? def.tier : null;
}

function skillOf(name) {
  const def = definitionOf(name);
  return def ? def.skill : null;
}

// Every occupation an organization of this type employs, lowest tier
// first then alphabetical — a stable order, so a caller that wants "the
// least skilled thing this place needs done" can take the first without
// a draw.
function occupationsFor(organizationType) {
  return OCCUPATION_NAMES
    .filter((name) => OCCUPATIONS[name].employers.includes(organizationType))
    .sort((a, b) => OCCUPATIONS[a].tier - OCCUPATIONS[b].tier || (a < b ? -1 : 1));
}

// What this person could hold at this employer, given what they know.
function qualifiedFor(npc, organizationType) {
  return occupationsFor(organizationType).filter((name) => tierReachable(npc, OCCUPATIONS[name].tier));
}

// ---------------------------------------------------------------------
// drawOccupation
// ---------------------------------------------------------------------
// Which position somebody takes. Seeded on the PERSON, which is the
// §88 exception this project already recognises in four places
// (schooling, flashpoints, retellings, distress sales): the draw is
// about them, so their identity is the right seed and re-running it has
// to give the same answer.
//
// **Weighted by tier, and the first version took the top tier the
// person qualified for.** That read like the obvious rule — somebody
// who went to school does not take a labourer's job while a qualified
// post is open — and measured, it built a town of professionals: 28 of
// 54 workers at Tier 4, a mean tier of 3.44, eight engineers and eight
// navigators in a settlement of 153 people, and not one labourer or
// farmer. The mistake is standing rule 12's third clause in a new
// place: attainment says what somebody COULD do, and the number of
// posts at a tier says how many people actually do it. Reading only
// the first makes every educated person a specialist because nothing
// was modelling the second.
//
// So the weight is `1 / tier`, which is a pyramid and not a fitted
// number: an economy has more hands than tradesmen and more tradesmen
// than architects. The only input is §25's own tier index. Measured
// after the change, the same world spreads across Tiers 1-4 with a
// mean near the trades, which is what a recovering civilization looks
// like.
//
// Returns the employer's lowest-tier position when nothing is
// reachable, and null only when the organization type employs nobody at
// all — a `club` or a `religion` with no listed occupation is a real
// answer, not an error.
// ---------------------------------------------------------------------
// Aptitude, and why the constant is 1
// ---------------------------------------------------------------------
// The tier pyramid says how many people do a job. It says nothing about
// WHICH people, so until now the answer was "whoever the seeded cut
// landed on". Measured on a 300-tick world, the mean skill value of the
// job people actually held was **59.1 out of 100** — barely above the
// average trait — in a population where one person's best skill beats
// their worst by 75.7 points. A town of specialists, each doing
// something else.
//
// `APTITUDE_PULL = 1` is not a fitted number. At exactly 1 the weight
// collapses to `value / 50`: the skill relative to the average person's
// skill, which is the same relationship `economy.productivityOf` reads
// for the same reason. Half as likely at half the skill, twice as
// likely at twice it. Any other value would be asserting something
// about how much aptitude matters that nobody has measured.
//
// Swept 0, 0.25, 0.5, 1, 1.5, 2, 3, 5 on the same world, replaying the
// real draw for the real hires at their real employers:
//
//     pull   mean skill of the job held   mean tier   tier 1 share
//     0      59.1                         1.77        53%
//     1      63.5                         1.79        53%
//     3      74.3                         1.90        49%
//
// So it does something (+4.4 points of skill) without overturning the
// pyramid (mean tier 1.77 -> 1.79), which is the trade this file cares
// about. Turning it higher buys more matching by making everybody a
// specialist, and the note above about a town of professionals is
// exactly why that is the wrong direction.
//
// **It still gates nothing.** A weight of 0 at skill 0 means somebody
// with no ability at all is not given that title while another is
// available; it is not a bar on being hired, which stays productivity
// and nothing else, and a pool whose weights all come to zero returns
// its first entry rather than failing.
const APTITUDE_PULL = 1;

function aptitudeWeight(sheet, name) {
  if (!sheet) return 1;
  const skill = OCCUPATIONS[name].skill;
  const value = Number(sheet.skills?.[skill]);
  // **Centred on 50, which is the trait scale's own centre.** Standing
  // rule 12's first clause: a modifier centred anywhere else silently
  // recalibrates the world the day it starts being read. A person flat
  // at 50 across all sixteen skills draws exactly the distribution this
  // function produced before aptitude was a term in it, and
  // `test/occupations.test.js` holds that.
  if (!Number.isFinite(value)) return 1;
  return Math.max(0, 1 + APTITUDE_PULL * ((value - 50) / 50));
}

function drawOccupation(options = {}) {
  const {
    npc = null, organizationType = null, seed = 'world', extra = [],
    worldState = null,
  } = options;
  if (!organizationType) return null;

  const all = occupationsFor(organizationType);
  if (all.length === 0) return null;

  const reachable = qualifiedFor(npc, organizationType);
  const pool = reachable.length > 0 ? reachable : [all[0]];
  if (pool.length === 1) return pool[0];

  // **Live traits, never `npc.traits`.** Standing rule 9: the sheet on
  // the NPC object is built once at generation and never refreshed, so
  // weighting on it would sort people by who they were born as and
  // ignore thirty years of work. `worldState` is optional because two
  // callers and every existing test call this without one; without it
  // the aptitude term is 1 for everything and the draw is the old
  // tier-only pyramid.
  const sheet = worldState && npc ? getLiveEntity(worldState, npc.id)?.traits ?? null : null;

  const weights = pool.map((name) => (1 / OCCUPATIONS[name].tier) * aptitudeWeight(sheet, name));
  const total = weights.reduce((sum, wt) => sum + wt, 0);
  let cut = seededDraw([seed, 'occupation', npc ? npc.id : 0, ...extra]) * total;
  for (let i = 0; i < pool.length; i += 1) {
    cut -= weights[i];
    if (cut <= 0) return pool[i];
  }
  return pool[pool.length - 1];
}

// ---------------------------------------------------------------------
// Reading it back off a world
// ---------------------------------------------------------------------

function employmentOf(worldState, entityId) {
  return (worldState.employmentRecords || [])
    .find((r) => r.entity_id === entityId && r.status === 'active') ?? null;
}

// The occupation somebody currently holds, or null if they hold no job
// or hold an untitled one. Untitled is possible on purpose: a restored
// world from before this file existed has `position: null` on every
// record, and reporting those as some default occupation would be
// inventing a fact about a person.
function occupationOf(worldState, entityId) {
  const record = employmentOf(worldState, entityId);
  if (!record) return null;
  const name = record.position ?? null;
  return name && OCCUPATIONS[name] ? name : null;
}

// Everybody in the world holding this occupation. `within` narrows to a
// community when given, which is what a composition check needs — the
// engineers three cities away are not going to help take this building.
function holdersOf(worldState, name, options = {}) {
  const { communityId = undefined, cityId = undefined } = options;
  const out = [];
  for (const record of worldState.employmentRecords || []) {
    if (record.status !== 'active' || record.position !== name) continue;
    const npc = (worldState.npcs || []).find((n) => n.id === record.entity_id);
    if (!npc) continue;
    if (communityId !== undefined && npc.communityId !== communityId) continue;
    if (cityId !== undefined) {
      // `communities.city_id`, not `cityId` — the community row uses the
      // schema's own snake_case for this one field while the NPC uses
      // `communityId`, and `statistics.contextFor` reads it the same way.
      const community = (worldState.communities || []).find((c) => c.id === npc.communityId);
      if (!community || community.city_id !== cityId) continue;
    }
    out.push(npc);
  }
  return out;
}

// ---------------------------------------------------------------------
// describeOccupations
// ---------------------------------------------------------------------
// The measurement, not a rollup — how many of the taxonomy's positions
// a world actually fills, which is the number that would have caught
// the empty `position` column on day one.
function describeOccupations(worldState) {
  const held = new Map();
  let titled = 0;
  let untitled = 0;
  for (const record of worldState.employmentRecords || []) {
    if (record.status !== 'active') continue;
    const name = record.position ?? null;
    if (name && OCCUPATIONS[name]) {
      titled += 1;
      held.set(name, (held.get(name) ?? 0) + 1);
    } else {
      untitled += 1;
    }
  }
  const tiers = {};
  for (const [name, count] of held) {
    const tier = OCCUPATIONS[name].tier;
    tiers[tier] = (tiers[tier] ?? 0) + count;
  }
  return {
    defined: OCCUPATION_NAMES.length,
    held: held.size,
    titled,
    untitled,
    byOccupation: Object.fromEntries([...held].sort((a, b) => b[1] - a[1])),
    byTier: tiers,
    meanTier: titled === 0 ? null : Math.round(
      ([...held].reduce((sum, [name, count]) => sum + OCCUPATIONS[name].tier * count, 0) / titled) * 100,
    ) / 100,
  };
}

module.exports = {
  KNOWLEDGE_TIERS,
  TIER_COUNT,
  OCCUPATIONS,
  OCCUPATION_NAMES,
  DEFINING_POST,
  INFRASTRUCTURE_POST,
  postFor,
  postForInfrastructure,
  TIER_MINIMUM_LEVEL,
  attainmentOf,
  tierReachable,
  definitionOf,
  tierOf,
  skillOf,
  occupationsFor,
  qualifiedFor,
  drawOccupation,
  employmentOf,
  occupationOf,
  holdersOf,
  describeOccupations,
};
