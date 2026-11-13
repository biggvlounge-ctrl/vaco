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

  // **Prison gang, and it is the SAME archetype shape as `militia`,
  // not a separate mechanism.** Task #151's own gang-politics ask is
  // answered by reusing `control.js`'s real takeover machinery and
  // `authority.js`'s real regime system, scoped to the community a
  // real prison stands in (`justice.js`'s own header explains why: no
  // interior-building geography — a "wing" or "cell block" — exists
  // anywhere in this schema, so territory stays at the grain the
  // engine actually supports). `isFaction: true` for the identical
  // reason `militia` has it: a prison gang that could not hold a real
  // `territory_blocks` row could not be "taken over" or "taken over
  // from" by anything real either.
  'prison gang': {
    type: 'gang',
    reach: 'community',
    note: 'Holds what it can inside one real prison\'s own community rather than a city — '
      + 'small, bounded membership (its members are, structurally, people this engine has '
      + 'actually imprisoned at one real property), high internal loyalty for the same reason '
      + 'an `insurgent cell`\'s is high: there is nowhere to recruit from but who is already '
      + 'inside.',
    isFaction: true,
    traits: {
      internalLoyalty: [65, 95],
      territory: [20, 55],
      membership: [5, 35],
      production: [0, 10],
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

  // **Genuinely new: the schema's own real `type: 'religion'` has had
  // zero archetypes and zero callers anywhere in this engine until
  // now** (`organizations.type`'s own comment already named `religion`
  // alongside `gang`/`government`/`library`/`museum`, unused). Direct
  // instruction: "the strongest religious party... a power hierarchy
  // in every town." `reach: 'community'`, the same grain `militia`
  // holds its own neighbourhood at, since a congregation is a
  // neighbourhood institution first.
  //
  // **The §9 firewall holds here exactly as it holds for `npc.religion`
  // itself.** This archetype generates and leads the identical generic,
  // trait-driven way every other organization here does —
  // `generateOrganization`'s own caller never reads any NPC's own real
  // `npc.religion` field to decide who founds, joins or leads one. A
  // world's in-game religious institutions and its NPCs' own private,
  // real-Census-sourced religious identity stay two deliberately
  // unconnected facts, same as `npc.ethnicity`/`npc.politicalTypology`
  // already are everywhere else in this engine.
  'religious order': {
    type: 'religion',
    reach: 'community',
    note: 'A congregation with real institutional weight — high internal loyalty by '
      + 'construction (the thing a religious order most durably has), real but modest '
      + 'resources, and no claim on territory (a `militia`\'s counterpart that persuades '
      + 'rather than holds ground).',
    traits: {
      internalLoyalty: [60, 90],
      diplomacy: [40, 70],
      resources: [15, 45],
      territory: [0, 10],
    },
    // `teacher` is this file's own closest real occupation to
    // "someone who leads a congregation" (`occupations.js` has no
    // `priest`/`clergy` role) — named here rather than invented, the
    // same honesty `aid organization`'s own posts already apply
    // choosing `physician`/`orderly` over a role this engine does not
    // have.
    posts: ['teacher'],
  },

  // **Genuinely new again, by direct instruction: "certain racial
  // organizations, well, nationalist organizations." Confirmed scoped
  // to two things — a civilian archetype and a prison-gang
  // sub-category — and this file's own header reasoning above applies
  // unchanged: no real, named, identifiable group goes here. SPLC's
  // own "Year in Hate and Extremism" counted 1,371 hate and
  // antigovernment extremist groups nationally in 2024 (down from
  // 1,430 in 2023), 533 of them active hate groups (down from a 2018
  // peak of 1,021) — real, current, and the reason this archetype is
  // GENERIC rather than a roster: there are hundreds of small, mostly
  // unrelated bodies, not one organization to name.
  //
  // **Why `type: 'club'`, not `'gang'`.** `militia`/`insurgent cell`/
  // `prison gang` are `type: 'gang'` because they hold ground by force
  // — `isFaction: true`, a real row in `territory_blocks`. ADL's own
  // H.E.A.T. Map FAQ says plainly why this archetype does not: a
  // movement's membership "draws from fairly wide geographic areas
  // that cannot be accurately represented by a single point on a
  // map" — real, direct, and the reason `territory` is banded near
  // zero and `isFaction` is absent rather than false-by-omission. This
  // is a political-social movement — propaganda, recruitment, rallies
  // — the same `club` category `aid organization`/`trade union`
  // already use for civil-society bodies that are not businesses,
  // governments or armed factions.
  //
  // **Growth is banded DOWN, on a real cited trend, not up.** SPLC's
  // own count of active hate groups has fallen for six straight years
  // from its 2018 peak — real and current, even though SPLC's and
  // ADL's own reporting both note the groups' online REACH growing as
  // their formal membership count shrinks. This archetype bands the
  // measured thing (group count) and does not invent a number for the
  // unmeasured one (online reach).
  //
  // **Posts carry the one real violence finding this file has no
  // trait dimension for, rather than forcing a trait that does not
  // exist.** `ORGANIZATION_TRAIT_FAMILIES` has no "violence propensity"
  // dimension at the organization tier — crime and violence are
  // per-NPC mechanics (`crime.js`, `keys.resolveAggression`), not an
  // organization trait, and standing rule 6 says a band on a
  // dimension that does not exist is applied to nothing forever. The
  // real finding — DHS's Homeland Threat Assessment has named
  // racially/ethnically motivated violent extremism (RMVE), white
  // supremacist extremism specifically, the most persistent and
  // lethal domestic terrorism threat category every year since 2020
  // through its 2024 edition, and ADL's 2024 murder report found
  // white supremacists committed 8 of that year's 13 extremist-related
  // murders (62%) — is instead the real reason `enforcer` is one of
  // this archetype's two posts: a small, violence-capable minority
  // within an otherwise propaganda-and-recruitment body, the same
  // "real finding without an invented number" shape the eighteenth
  // standing rule's own corollary already follows. `influencer` is
  // the other post — SPLC's report names Telegram as a real recruiting
  // hub cross-pollinating neo-Nazi, QAnon and white-nationalist
  // audiences, and `influencer` is already this engine's "no
  // institution, no credential" occupation (CLAUDE.md's forty-second
  // standing rule), the honest fit for exactly that real recruiting
  // shape.
  //
  // ---------------------------------------------------------------------
  // The §9 question this archetype actually raises, reasoned through
  // rather than assumed either way
  // ---------------------------------------------------------------------
  // §9's own text: demographics "must never determine an NPC's
  // morality, criminality, intelligence or worth." A real-world
  // ethno-nationalist movement's defining real structural trait IS
  // race/ethnicity-restricted membership — so the live question is
  // whether gating eligibility to FOUND or JOIN this one archetype on
  // an NPC's real `race`/`ethnicity` field is a narrow, factual
  // modelling choice, or the exact thing §9 exists to stop.
  //
  // **Decided: no gate, and the reason is a precedent already on this
  // page rather than a new argument.** `'religious order'`'s own
  // header, four entries up, already answered the identical-shaped
  // question for religion and declined the gate: "a world's in-game
  // religious institutions and its NPCs' own private, real-Census-
  // sourced religious identity stay two deliberately unconnected
  // facts." A congregation's real-world defining trait is shared
  // religious identity, exactly the same shape as a nationalist
  // movement's defining trait being shared race/ethnicity — and if
  // `npc.religion` was not allowed to decide who founds, joins or
  // leads a `'religious order'`, there is no principled reason
  // `npc.race`/`npc.ethnicity` should be allowed to decide who founds,
  // joins or leads this one. Generation stays the identical generic,
  // trait-driven process every archetype in this file already uses;
  // `test/org-archetypes.test.js`'s own new test (below) asserts this
  // file reads neither field, the same forbidden-file-scan shape
  // `test/ethnicity.test.js`/`test/race-packs.test.js` already hold
  // for every outcome-deciding module.
  'nationalist movement': {
    type: 'club',
    reach: 'city',
    note: 'A political-social movement organised around racial or ethnic exclusivity — '
      + 'propaganda and recruitment rather than territory, per ADL\'s own finding that this '
      + 'kind of group\'s membership is too geographically dispersed to hold ground the way '
      + '`militia` does.',
    traits: {
      territory: [0, 15],
      diplomacy: [5, 20],
      internalLoyalty: [55, 85],
      growthPotential: [10, 30],
      power: [15, 40],
      production: [5, 20],
    },
    posts: ['influencer', 'enforcer'],
  },

  // **The prison-gang half of the same instruction, and the thirty-
  // sixth standing rule's own finding re-checked before building
  // anything on it.** That rule already found there is no current
  // public, structured dataset on prison gang (STG) racial
  // composition — CDCR abandoned validation-based indefinite SHU
  // isolation after *Ashker v. Brown*, the only public figure was a
  // single stale 2012 press snapshot, and LA County's own Inspector
  // General found its own jail-gang data too unreliable to release.
  // Re-checked this round rather than trusted: still true. A real,
  // CURRENT (2014-2025) CDCR chart was found showing Hispanic
  // admissions at ~71% of admissions carrying a gang ENHANCEMENT
  // against ~44% of all admissions — but a gang enhancement is a
  // court-applied sentencing outcome, not an STG membership
  // validation, the chart's authorship could not be confirmed this
  // session, and PPIC separately notes CDCR does not publicly
  // disaggregate Asian American, Native American or other groups at
  // all. Named here and NOT wired in, for the same reason this
  // project has already declined CalGang, the 2012 STG snapshot and
  // the Chicago gang-boundary FOIA release: a real number found at too
  // low a confidence to stand behind is a gap to declare, not a
  // number to use.
  //
  // **What IS real and citable is the general academic pattern, not a
  // current membership count — exactly the distinction this file's
  // own header draws between "statistics about a kind" and "a roster
  // of named bodies."** Skarbek's political-economy account of
  // California prison gangs forming along racial lines; a 2014
  // *Prison Journal* study finding Texas prison-gang formation aided
  // by historical racial segregation, persisting after segregation was
  // outlawed in 1979; Infante, Morse, Fahmy & Wright's 2023 *Criminal
  // Justice and Behavior* study of a distinct "racial code" in Arizona
  // prisons; and the *SAGE Encyclopedia of Race and Crime*'s own
  // reference entry, stating plainly that prison gangs coalesce around
  // race, ethnicity, nationality and neighbourhood. Four real,
  // independent, citable sources agreeing on the same general
  // structural pattern — enough to band a generic sub-archetype's
  // `internalLoyalty` up from the base `'prison gang'`, not enough to
  // claim a membership count for one.
  //
  // **Same shape as `'prison gang'` in every dimension this round has
  // no new real information about** (`territory`, `membership`,
  // `production`) — copied rather than re-derived, because inventing a
  // reason to change a band with no new evidence behind it is the
  // twelfth standing rule's own mistake in a new place. `diplomacy` is
  // banded slightly lower than the base archetype's neutral default,
  // citing the National Gang Crime Research Center's 1995
  // administrator survey finding racial conflict raises the
  // probability of gang disturbances — real, if dated, and flagged as
  // such rather than presented as current.
  //
  // **The identical §9 answer as `'nationalist movement'`, for the
  // identical reason.** This archetype's generation is exactly as
  // generic and trait-driven as the base `'prison gang'`'s — no NPC's
  // real `race`/`ethnicity` field is read to decide who is generated
  // into this archetype rather than the base one. A believable
  // facility population's own racial composition is `prisonPacks.js`'s
  // job (real BJS data, already firewalled), not this file's — the two
  // stay the same two deliberately unconnected facts `'religious
  // order'` and `'nationalist movement'` already establish.
  'racially-affiliated prison gang': {
    type: 'gang',
    reach: 'community',
    note: 'The same shape as `prison gang` — bounded membership, nowhere to recruit from but '
      + 'who is already inside — with higher internal loyalty, on real cited academic '
      + 'literature finding U.S. prison gangs have historically organised substantially along '
      + 'racial lines.',
    isFaction: true,
    traits: {
      internalLoyalty: [75, 98],
      territory: [20, 55],
      membership: [5, 35],
      production: [0, 10],
      diplomacy: [5, 25],
    },
    posts: ['enforcer'],
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
