// server/culture.js
//
// Culture DNA — Phase 2, and one of the two systems the API map's
// Phase 2 list still had open.
//
// `VACANCY_TRAIT_DATABASE_ATTACHMENT.md` gives it a real definition, so
// nothing here is invented world content:
//
//   CULTURE_TRAIT_FAMILIES = { trustLevel, tradition, innovation,
//     competition, cooperation, communicationStyle, leadershipStyle,
//     conflictResolution, education, art, religion, values, customs,
//     language, cuisine, fashion }
//
// and states the rule that shapes this whole file: **tier-level, not
// individual — "individuals *belong to* a culture, they don't each
// carry their own."**
//
// ---------------------------------------------------------------------
// **A culture is its own object, not a column on a community.**
//
// `communities.culture` is `TEXT` in the schema — a single string. A
// sixteen-dimension DNA sheet does not fit in it, and the attachment
// document says why it should not try: a culture is a thing many
// entities belong to. So the TEXT column is read as the culture's
// NAME — the reference — and the sheet lives on the culture itself.
// One culture, many communities.
//
// There is no `cultures` table in `VACANCY_POSTGRESQL_SCHEMA.sql` (60
// tables, none of them this). Flagged rather than papered over: this
// is the first system in VACON-C whose backing table does not exist
// yet, and migrate.js will need one. The in-memory shape here is
// row-flat like every other array so that when the table is written it
// is a straight copy, not a reshape.
//
// ---------------------------------------------------------------------
// **The sixteen are not sixteen of the same kind of thing, and
// flattening them into sixteen 0-100 scores would be wrong.**
//
// familyTraits.js already set the precedent: `traditions` maps to a
// JSONB column and is "structurally a list of traditions, not a trait",
// so it is a field rather than an entity_traits row. The same reading
// applied here splits the sixteen three ways:
//
//   SCORED (0-100)   — a culture can be more or less of these, and the
//                      number means something on its own.
//   STYLE (one of N) — a culture does not have "more" communication
//                      style; it has a style. A 0-100 here would be a
//                      number with no referent.
//   DESCRIPTIVE      — lists. A culture's cuisine is not a score in any
//                      reading of the word.
//
// Only the SCORED eight become trait rows. That is the same test
// organizationTraits.js and familyTraits.js applied — a dimension earns
// a trait row only if it is genuinely a scored dimension — and it is
// the reason this file has eight trait families rather than sixteen.

'use strict';

let nextCultureId = 1;

// Verbatim from the attachment, in its order. Kept whole as the record
// of what was specified, separate from how each part is stored.
const CULTURE_TRAIT_FAMILIES = [
  'trustLevel', 'tradition', 'innovation', 'competition', 'cooperation',
  'communicationStyle', 'leadershipStyle', 'conflictResolution', 'education',
  'art', 'religion', 'values', 'customs', 'language', 'cuisine', 'fashion',
];

// The eight that are genuinely scored dimensions. These are the ones
// that become entity_traits rows, same as the organization and family
// tiers before them.
const CULTURE_SCORED_FAMILIES = [
  'trustLevel', 'tradition', 'innovation', 'competition', 'cooperation',
  'education', 'art', 'religion',
];

// `education` deserves a note, because the same word appears twice in
// this project meaning different things. `communities.education` is how
// educated a community IS. Culture DNA's `education` is how much a
// culture VALUES education. They move independently — a culture can
// prize learning while its communities have no schools — and conflating
// them would make one of the two unreadable.

// The three style dimensions. Each is one value from a named set, not a
// magnitude. The sets are interpretive and flagged as such: the
// attachment names the dimensions and does not enumerate their values.
const CULTURE_STYLES = {
  communicationStyle: ['direct', 'indirect', 'formal', 'expressive', 'reserved'],
  leadershipStyle: ['elder', 'elected', 'hereditary', 'militant', 'consensus', 'charismatic'],
  conflictResolution: ['mediation', 'duel', 'council', 'avoidance', 'restitution', 'exile'],
};

// The five descriptive dimensions. Lists, empty by default — a culture
// with no recorded cuisine is a culture nobody has written cuisine for
// yet, which is a true statement about a young world and better than a
// fabricated one.
const CULTURE_DESCRIPTIVE = ['values', 'customs', 'language', 'cuisine', 'fashion'];

// The tiers a culture may attach to, verbatim from the attachment:
// "Family/Community/Organization/City/Civilization". Individuals are
// deliberately absent — that is the rule this system exists to enforce.
const CULTURE_TIERS = ['family', 'community', 'organization', 'city', 'civilization'];

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const rows = (worldState, name) => worldState[name] || [];

function writable(worldState, name) {
  if (!Array.isArray(worldState[name])) {
    throw new Error(
      `culture.js: worldState.${name} does not exist. Culture DNA is not wired `
      + 'into this world (engine.js declares both arrays on WorldState).',
    );
  }
  return worldState[name];
}

// ---------------------------------------------------------------------------
// generateCulture()
// ---------------------------------------------------------------------------
// Scored dimensions default to 50 — the schema's own `default_value`
// for every trait definition in this project, not a number chosen here.
function generateCulture(worldState, options = {}) {
  if (!options.name) {
    throw new Error('generateCulture requires options.name (a culture is referenced by name — communities.culture is TEXT).');
  }

  const store = writable(worldState, 'cultures');
  if (typeof worldState.nextEntityId !== 'number') {
    throw new Error('culture.js: worldState.nextEntityId is not a number.');
  }

  const traits = {};
  for (const family of CULTURE_SCORED_FAMILIES) {
    const given = options.traits?.[family];
    traits[family] = given == null ? 50 : clamp(Number(given), 0, 100);
  }

  const styles = {};
  for (const [dimension, allowed] of Object.entries(CULTURE_STYLES)) {
    const given = options[dimension];
    if (given != null && !allowed.includes(given)) {
      throw new Error(
        `generateCulture: "${given}" is not a ${dimension} (one of: ${allowed.join(', ')}).`,
      );
    }
    styles[dimension] = given ?? null;
  }

  const descriptive = {};
  for (const dimension of CULTURE_DESCRIPTIVE) {
    const given = options[dimension];
    descriptive[dimension] = Array.isArray(given) ? given : [];
  }

  const culture = {
    id: nextCultureId++,
    name: options.name,
    // The shared entity counter as well as a local id: a culture is a
    // tier-level entity that other rows will need to reference, and the
    // property.js lesson was that a local counter collides the moment
    // something points at it from the entity id space.
    entity_id: worldState.nextEntityId++,
    era: options.era ?? null,
    traits,
    ...styles,
    ...descriptive,
  };
  store.push(culture);
  return culture;
}

// ---------------------------------------------------------------------------
// Attachment — who belongs to which culture
// ---------------------------------------------------------------------------
// A join, not a column, because the same culture spans many entities
// across several tiers. `communities.culture` still gets the culture's
// NAME written into it so the schema column stays meaningful and a
// straight SELECT on communities is not misleading.
function attachCulture(worldState, options = {}) {
  const { cultureId, tier, entityId } = options;
  if (cultureId == null) throw new Error('attachCulture requires options.cultureId.');
  if (entityId == null) throw new Error('attachCulture requires options.entityId.');
  if (!tier) {
    throw new Error(`attachCulture requires options.tier (one of: ${CULTURE_TIERS.join(', ')}).`);
  }
  if (!CULTURE_TIERS.includes(tier)) {
    throw new Error(
      `attachCulture: "${tier}" is not a tier a culture attaches to (one of: ${CULTURE_TIERS.join(', ')}). `
      + 'Individuals belong to a culture through their family or community; they do not carry one.',
    );
  }

  const culture = getCulture(worldState, cultureId);
  if (!culture) throw new Error(`attachCulture: no culture with id ${cultureId}.`);

  const store = writable(worldState, 'cultureMemberships');
  // Re-attaching moves an entity rather than duplicating it: an entity
  // belongs to one culture at a tier, not to a growing list.
  const existing = store.find((m) => m.tier === tier && m.entity_id === Number(entityId));
  if (existing) {
    existing.culture_id = culture.id;
  } else {
    store.push({ culture_id: culture.id, tier, entity_id: Number(entityId) });
  }

  // Keep the schema's own TEXT column truthful.
  if (tier === 'community') {
    const community = rows(worldState, 'communities').find((c) => c.id === Number(entityId));
    if (community) community.culture = culture.name;
  }

  return { cultureId: culture.id, tier, entityId: Number(entityId) };
}

function getCulture(worldState, cultureId) {
  return rows(worldState, 'cultures').find((c) => c.id === Number(cultureId)) ?? null;
}

function listCultures(worldState) {
  return rows(worldState, 'cultures');
}

// `GET /api/culture/:tierEntityId` — the map names one route taking one
// id, with no tier alongside it, so the lookup searches every tier. An
// id is unambiguous in practice because attachment records the tier;
// if the same numeric id is attached at two tiers the answer names both
// rather than silently picking one.
function getCultureFor(worldState, entityId) {
  const matches = rows(worldState, 'cultureMemberships')
    .filter((m) => m.entity_id === Number(entityId));
  if (matches.length === 0) return null;

  const results = matches.map((m) => ({
    tier: m.tier,
    culture: getCulture(worldState, m.culture_id),
  })).filter((r) => r.culture);

  if (results.length === 0) return null;
  return {
    entityId: Number(entityId),
    tier: results[0].tier,
    culture: results[0].culture,
    // Present only when it is genuinely ambiguous, so the common case
    // stays a clean single answer.
    ...(results.length > 1 ? { alsoAttachedAs: results.slice(1) } : {}),
  };
}

// Everything belonging to one culture, across every tier.
function getCultureMembers(worldState, cultureId) {
  const culture = getCulture(worldState, cultureId);
  if (!culture) return null;
  const members = rows(worldState, 'cultureMemberships')
    .filter((m) => m.culture_id === culture.id);
  const byTier = {};
  for (const tier of CULTURE_TIERS) {
    const ids = members.filter((m) => m.tier === tier).map((m) => m.entity_id);
    if (ids.length) byTier[tier] = ids;
  }
  return { cultureId: culture.id, name: culture.name, total: members.length, byTier };
}

module.exports = {
  CULTURE_TRAIT_FAMILIES,
  CULTURE_SCORED_FAMILIES,
  CULTURE_STYLES,
  CULTURE_DESCRIPTIVE,
  CULTURE_TIERS,
  generateCulture,
  attachCulture,
  getCulture,
  listCultures,
  getCultureFor,
  getCultureMembers,
};
