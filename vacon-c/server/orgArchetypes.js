// server/orgArchetypes.js
//
// **Kinds of organization, so a scenario can name its own.**
//
// ---------------------------------------------------------------------
// Why this is archetypes and not a roster
// ---------------------------------------------------------------------
// The request behind this file was for the geopolitical groups to be
// accounted for — intelligence agencies, federal law enforcement,
// foreign groups, political parties from Israel to the Middle East to
// America to the UK — "with statistics and characteristics of those
// groups as well".
//
// **Every one of the twenty specification documents in this directory
// was searched, and none of them mentions any real agency, party or
// state.** `organizations.type`'s schema enumeration is categories —
// `business|government|club|religion|gang|corporation|military|school|
// hospital|research|media|sports|library|museum` — not named bodies.
// So there is nothing here to implement from, and three reasons not to
// invent one:
//
//   **The numbers would be fabricated.** This project's whole standard
//   is that a threshold picked from what a number sounds like is a
//   guess (CLAUDE.md, twelfth rule). "Statistics and characteristics"
//   attached to a real, named, living organisation would be exactly
//   that, and worse, because a made-up number about a real body reads
//   as a claim about it.
//
//   **§9 forbids the shape of it.** Demographic modelling is permitted
//   and demographics deciding morality, criminality, intelligence or
//   worth is forbidden. A table of real national and religious groups
//   with power and loyalty scores attached is that firewall's
//   worked example of what not to build.
//
//   **The setting argues against it.** VACON-C is "a persistent,
//   real-world civilization-reset simulation" that "begins after a
//   civilization-collapse event". After a collapse the agencies and
//   the parliaments do not exist. What re-forms is the KIND of body —
//   somebody gathers information, somebody enforces, somebody
//   organises a faction around an idea — and that is what this file
//   holds.
//
// A scenario that wants a specific named organisation supplies the
// name. `found` takes one, and nothing here writes a name of its own.
//
// ---------------------------------------------------------------------
// What an archetype actually is
// ---------------------------------------------------------------------
// Not a new table and not a new entity tier (standing rule 4): an
// archetype is a way of GENERATING an `organizations` row, expressed as
// the schema's own `type`, a profile over the nine organization-tier
// trait dimensions, and the occupations it employs. Every one of those
// is read by something that already exists —
// `territory.resolveTerritoryControl` reads `territory` and `power`,
// `media.outletReach` reads `influence`, `control.js` reads staff and
// `occupations.postFor` reads the type — so founding one changes the
// world rather than labelling it.
//
// The profiles are `[low, high]` bands, not values: an intelligence
// service is generated SECRETIVE and CAPABLE, and how secretive and
// how capable this one is comes from the world's own seed. A band is a
// claim about the kind of thing; a value would be a claim about a
// particular one.
//
// **Bands are centred on the schema's own default of 50 unless the
// archetype is definitionally otherwise**, which is standing rule 12's
// first clause: a militia has low `production` because a militia does
// not produce anything, not because paramilitaries "feel" unproductive.
// Every band below has a one-line reason, and where there is no reason
// the band is the neutral one.

'use strict';

const { seededDraw } = require('./seeded.js');
const { ORGANIZATION_TRAIT_FAMILIES } = require('./organizationTraits.js');
const occupations = require('./occupations.js');

//: The neutral band. An archetype that says nothing about a dimension
//: gets this, so an ordinary organization of any kind is generated the
//: way `generateOrganization` already generates one.
const NEUTRAL = [35, 65];

//: How far an organization's writ runs. Not a schema column — it is
//: read by `describeArchetypes` and by a scenario deciding where to
//: place one, and it is stated because "an intelligence service and a
//: neighbourhood association are both organizations" is true and
//: useless.
const REACHES = ['community', 'city', 'world'];

// ---------------------------------------------------------------------
// The archetypes
// ---------------------------------------------------------------------
//: `type` is always one of `organizations.type`'s own enumerated
//: values. Nothing here extends that vocabulary — the schema is the
//: source of truth for shape, which is the same rule `items.js`
//: follows for §27's seventeen.
const ARCHETYPES = {
  'intelligence service': {
    type: 'government',
    reach: 'world',
    note: 'Gathers what others would rather it did not. The generic form of an agency; '
      + 'a scenario supplies the name.',
    traits: {
      // It exists to know things and to act on them quietly.
      diplomacy: [55, 90],
      // Secrecy IS internal loyalty here: an organization that cannot
      // keep its own people is not an intelligence service.
      internalLoyalty: [60, 95],
      // It holds no ground and makes nothing.
      territory: [5, 25],
      production: [5, 25],
    },
    posts: ['diplomat', 'officer', 'engineer'],
  },

  'federal law enforcement': {
    type: 'government',
    reach: 'world',
    note: 'Enforces one body of law across every jurisdiction under it, rather than the '
      + 'city policing `server/policing.js` already models per area.',
    traits: {
      // Its whole claim is reach across jurisdictions.
      territory: [60, 90],
      power: [55, 85],
      production: [5, 25],
    },
    posts: ['officer', 'enforcer', 'diplomat'],
  },

  'political party': {
    type: 'club',
    reach: 'city',
    note: 'An organised body that contests power by persuasion. `club` rather than '
      + '`government`, because a party is not the state — it is what tries to become it, '
      + 'and `politics.js` already models the state separately.',
    traits: {
      // Persuasion and numbers are the whole mechanism.
      diplomacy: [55, 90],
      membership: [55, 90],
      production: [5, 25],
      territory: [10, 35],
    },
    posts: ['diplomat', 'manager'],
  },

  paramilitary: {
    type: 'military',
    reach: 'city',
    note: 'Armed, organised, and not the state\'s. The distinction from `militia` below is '
      + 'organisation rather than weaponry.',
    traits: {
      power: [60, 90],
      internalLoyalty: [55, 85],
      territory: [45, 75],
      // It consumes rather than produces.
      production: [5, 25],
      diplomacy: [10, 35],
    },
    posts: ['officer', 'enforcer', 'mechanic'],
  },

  militia: {
    type: 'gang',
    reach: 'community',
    note: 'Neighbours with weapons. `gang` is the schema\'s word for an organization that '
      + 'holds ground without holding office — `territory_blocks.faction_id` references '
      + '`factions(organization_id)`, so this is the one archetype that can hold a block.',
    isFaction: true,
    traits: {
      // It is its neighbourhood, so it holds ground and little else.
      territory: [50, 80],
      production: [5, 25],
      leadershipQuality: [20, 50],
      growthPotential: [15, 45],
    },
    posts: ['enforcer', 'hunter'],
  },

  'insurgent cell': {
    type: 'gang',
    reach: 'community',
    note: 'Small, committed, and deliberately hard to find. The opposite trade to a militia: '
      + 'it gives up ground to keep cohesion.',
    isFaction: true,
    traits: {
      internalLoyalty: [70, 95],
      // Few people on purpose.
      membership: [5, 30],
      territory: [5, 25],
      production: [5, 20],
    },
    posts: ['enforcer'],
  },

  clan: {
    type: 'club',
    reach: 'community',
    note: 'A kinship group acting as an organization. The one archetype whose members are '
      + 'related, which `server/familyTraits.js` models separately and better — this is the '
      + 'org-tier shell around it.',
    traits: {
      internalLoyalty: [65, 95],
      membership: [40, 70],
      diplomacy: [20, 50],
    },
    posts: ['trader', 'enforcer', 'farmer'],
  },

  'foreign mission': {
    type: 'government',
    reach: 'world',
    note: 'Somebody else\'s state, here. Generic by construction: whose state is the '
      + 'scenario\'s to say.',
    traits: {
      diplomacy: [65, 95],
      territory: [5, 20],
      production: [5, 20],
      power: [25, 55],
    },
    posts: ['diplomat'],
  },

  'aid organization': {
    type: 'club',
    reach: 'city',
    note: 'Distributes what it does not produce. Included because the spec\'s own reset '
      + 'premise makes relief a likelier institution than most of the above, and because an '
      + 'archetype list with only armed and covert bodies on it would be a claim about the '
      + 'world rather than a vocabulary for it.',
    traits: {
      diplomacy: [55, 85],
      resources: [50, 80],
      power: [10, 40],
      territory: [5, 25],
    },
    posts: ['physician', 'orderly', 'manager'],
  },

  'trade union': {
    type: 'club',
    reach: 'city',
    note: 'Organised labour. The counterpart to `business` in a world that has employment '
      + 'records and a labour market and nothing that organises the people in them.',
    traits: {
      membership: [55, 85],
      internalLoyalty: [50, 80],
      production: [5, 25],
      diplomacy: [45, 75],
    },
    posts: ['labourer', 'manager'],
  },
};

const ARCHETYPE_NAMES = Object.keys(ARCHETYPES);

// ---------------------------------------------------------------------
// Reading one
// ---------------------------------------------------------------------

function definitionOf(name) {
  return ARCHETYPES[name] ?? null;
}

// The full profile, with every dimension filled in — the archetype's
// own bands where it has an opinion, NEUTRAL where it does not. Exposed
// because "which dimensions does this archetype actually claim
// anything about" is the question a reader has, and a table of ten
// entries each listing nine bands would bury it.
function profileOf(name) {
  const definition = definitionOf(name);
  if (!definition) return null;
  const out = {};
  for (const dimension of ORGANIZATION_TRAIT_FAMILIES) {
    out[dimension] = definition.traits[dimension] ?? NEUTRAL;
  }
  return out;
}

// Which dimensions this archetype is actually opinionated about.
function claimsOf(name) {
  const definition = definitionOf(name);
  return definition ? Object.keys(definition.traits) : [];
}

// ---------------------------------------------------------------------
// traitValueFor
// ---------------------------------------------------------------------
// The function `engine.generateOrganization` already takes. Seeded on
// the archetype, the caller's own key and the dimension — never on the
// organization's id, which does not exist yet and which §88 forbids
// seeding on anyway (ids come from a counter whose state depends on
// what was built before).
function traitValueFor(name, seed, key) {
  const profile = profileOf(name);
  if (!profile) throw new Error(`orgArchetypes: "${name}" is not an archetype.`);
  return (definition) => {
    const band = profile[definition.name] ?? NEUTRAL;
    const draw = seededDraw([seed, 'archetype', name, key, definition.family, definition.name]);
    return Math.round(band[0] + draw * (band[1] - band[0]));
  };
}

// ---------------------------------------------------------------------
// found
// ---------------------------------------------------------------------
// Generates an organization of this kind, with the NAME the caller
// supplies. Nothing here names anything: a scenario that wants a
// specific body says so, and a scenario that does not gets an
// organization of a kind rather than a fictional institution with a
// plausible-sounding name attached.
//
// `generateOrganization` is passed in rather than required, for the
// reason `missions.resolveMission` takes `payReward`: this file must
// not reach into `engine.js`, which requires half the tree and would
// close a cycle.
function found(worldState, options = {}) {
  const {
    archetype = null, name = null, seed = worldState.seed ?? 'world', key = 0,
    generateOrganization = null, generateFaction = null,
  } = options;

  const definition = definitionOf(archetype);
  if (!definition) {
    throw new Error(
      `orgArchetypes.found: "${archetype}" is not an archetype (one of: ${ARCHETYPE_NAMES.join(', ')}).`,
    );
  }
  if (!name) {
    throw new Error(
      'orgArchetypes.found requires a name. This file deliberately names nothing — '
      + 'an archetype is a kind of organization and what it is CALLED is the scenario\'s '
      + 'to say. See the header.',
    );
  }
  if (typeof generateOrganization !== 'function') {
    throw new Error(
      'orgArchetypes.found requires options.generateOrganization (engine.generateOrganization), '
      + 'so this module does not have to require engine.js and close a cycle.',
    );
  }

  // **A faction is a different generator, not a flag.**
  // `generateOrganization` ignores `isFaction`; only `generateFaction`
  // sets it, along with `morale`, `factionStatus` and `color` — and
  // `territory_blocks.faction_id REFERENCES factions(organization_id)`,
  // so an archetype that holds ground and was made the ordinary way
  // could never be written to a block. Passing the flag and hoping was
  // the first version, and it produced an organization that claimed to
  // be a militia and could not act like one.
  if (definition.isFaction && typeof generateFaction !== 'function') {
    throw new Error(
      `orgArchetypes.found: "${archetype}" holds territory, so it must be made with `
      + 'options.generateFaction (engine.generateFaction) — territory_blocks.faction_id '
      + 'references factions(organization_id), not organizations(id).',
    );
  }
  const make = definition.isFaction ? generateFaction : generateOrganization;
  const organization = make({
    name,
    type: definition.type,
    traitValueFor: traitValueFor(archetype, seed, key),
  });
  // Recorded on the row so anything reading a world back can tell what
  // KIND of body this is without re-deriving it from trait values.
  // `organizations` has no column for it and this is deliberately an
  // in-memory field rather than a schema addition — same treatment
  // `cities.dna` got before it earned a column, and `describeArchetypes`
  // is what makes its absence from a restored world visible.
  organization.archetype = archetype;
  return organization;
}

// ---------------------------------------------------------------------
// describeArchetypes
// ---------------------------------------------------------------------
// **Standing rule 11's guard on this file.** Nothing in `worldgen`
// founds an archetype — a recovering settlement's institutions are its
// schoolhouse, its infirmary and its reading room, and deciding that it
// also has an intelligence service would be this file making exactly
// the claim about the world it exists to avoid. So this is a vocabulary
// with no caller in generation, on purpose, and the measurement says so
// rather than leaving a reader to assume otherwise.
function describeArchetypes(worldState) {
  const founded = (worldState.organizations || []).filter((o) => o.archetype);
  const byArchetype = {};
  for (const organization of founded) {
    byArchetype[organization.archetype] = (byArchetype[organization.archetype] ?? 0) + 1;
  }
  return {
    defined: ARCHETYPE_NAMES.length,
    founded: founded.length,
    byArchetype,
    // Which occupations the vocabulary asks for that the taxonomy can
    // supply. A post no occupation answers is standing rule 6's shape.
    posts: [...new Set(ARCHETYPE_NAMES.flatMap((n) => ARCHETYPES[n].posts))].sort(),
    unbacked: [...new Set(ARCHETYPE_NAMES.flatMap((n) => ARCHETYPES[n].posts))]
      .filter((p) => !occupations.definitionOf(p)).sort(),
  };
}

module.exports = {
  NEUTRAL,
  REACHES,
  ARCHETYPES,
  ARCHETYPE_NAMES,
  definitionOf,
  profileOf,
  claimsOf,
  traitValueFor,
  found,
  describeArchetypes,
};
