// Kinds of organization, so a scenario can name its own.
//
// ---------------------------------------------------------------------
// What this is instead of
//
// The request behind `server/orgArchetypes.js` was for the
// geopolitical groups to be accounted for — intelligence agencies,
// federal law enforcement, foreign groups, political parties from
// Israel to the Middle East to America to the UK — "with statistics and
// characteristics of those groups".
//
// **All twenty specification documents in this directory were searched
// and none mentions any real agency, party or state.**
// `organizations.type`'s enumeration is categories, not named bodies.
// So there was nothing to implement from, and three reasons not to
// invent one: the numbers would be fabricated, which is the one thing
// this project's standards forbid outright; §9 forbids exactly the
// shape of a table of real national and religious groups with power
// scores attached; and the setting is a civilization RESET, after
// which the agencies and the parliaments do not exist — what re-forms
// is the kind of body.
//
// So this is a vocabulary of kinds, and `found` requires a name from
// the caller. The test at the bottom holds that: this file names
// nothing.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const orgArchetypes = require('../server/orgArchetypes.js');
const occupations = require('../server/occupations.js');
const { ORGANIZATION_TRAIT_FAMILIES } = require('../server/organizationTraits.js');
const entityTraits = require('../server/entityTraits.js');
const engine = require('../server/engine.js');

// The schema's own comment on `organizations.type`.
const SCHEMA_TYPES = [
  'business', 'government', 'club', 'religion', 'gang', 'corporation',
  'military', 'school', 'hospital', 'research', 'media', 'sports',
  'library', 'museum',
];

test('every archetype is an organizations.type the schema already enumerates', () => {
  // Nothing here extends the schema's vocabulary — the same rule
  // `items.js` follows for §27's seventeen.
  for (const [name, definition] of Object.entries(orgArchetypes.ARCHETYPES)) {
    assert.ok(SCHEMA_TYPES.includes(definition.type), `${name} is a "${definition.type}"`);
    assert.ok(orgArchetypes.REACHES.includes(definition.reach), `${name} has no reach`);
    assert.ok(definition.note, `${name} has no note saying what it is`);
  }
});

test('every dimension an archetype claims is a real organization trait', () => {
  // Standing rule 6: a band on a dimension that does not exist would
  // be applied to nothing, forever, silently.
  for (const name of orgArchetypes.ARCHETYPE_NAMES) {
    for (const dimension of orgArchetypes.claimsOf(name)) {
      assert.ok(
        ORGANIZATION_TRAIT_FAMILIES.includes(dimension),
        `${name} claims "${dimension}", which is not an organization dimension`,
      );
    }
  }
});

test('every band is a real band, inside the schema’s own 0-100 scale', () => {
  for (const name of orgArchetypes.ARCHETYPE_NAMES) {
    const profile = orgArchetypes.profileOf(name);
    for (const [dimension, band] of Object.entries(profile)) {
      assert.equal(band.length, 2, `${name}.${dimension} is not a band`);
      assert.ok(band[0] < band[1], `${name}.${dimension} is inverted or flat`);
      assert.ok(band[0] >= 0 && band[1] <= 100, `${name}.${dimension} leaves the scale`);
    }
  }
});

test('a profile covers every dimension, claimed or neutral', () => {
  // So a reader can see at a glance which dimensions an archetype is
  // opinionated about, without a ten-by-nine table burying it.
  for (const name of orgArchetypes.ARCHETYPE_NAMES) {
    assert.deepEqual(
      Object.keys(orgArchetypes.profileOf(name)).sort(),
      [...ORGANIZATION_TRAIT_FAMILIES].sort(),
    );
    const claimed = orgArchetypes.claimsOf(name);
    assert.ok(claimed.length > 0, `${name} claims nothing, so it is not a kind of anything`);
    assert.ok(claimed.length < ORGANIZATION_TRAIT_FAMILIES.length,
      `${name} claims every dimension, which is a specific organization rather than a kind`);
  }
});

test('every post an archetype asks for is a real occupation', () => {
  // A post no occupation answers is a requirement that can never be
  // met — the same check `control.test.js` makes on DEFINING_POST.
  for (const [name, definition] of Object.entries(orgArchetypes.ARCHETYPES)) {
    assert.ok(definition.posts.length > 0, `${name} employs nobody`);
    for (const post of definition.posts) {
      assert.ok(occupations.definitionOf(post), `${name} wants a "${post}", which is not an occupation`);
    }
  }
});

test('an archetype generates an organization that is recognisably one', () => {
  const org = orgArchetypes.found(engine.WorldState, {
    archetype: 'intelligence service',
    name: 'The Listening Room',
    seed: 'archetype-test',
    generateOrganization: engine.generateOrganization,
  });
  assert.equal(org.type, 'government');
  assert.equal(org.archetype, 'intelligence service');

  const traits = entityTraits.getLiveEntity(engine.WorldState, org.id).traits.organization;
  // The claims it actually makes, checked against the bands rather than
  // against numbers written out here a second time.
  const profile = orgArchetypes.profileOf('intelligence service');
  for (const dimension of orgArchetypes.claimsOf('intelligence service')) {
    const [low, high] = profile[dimension];
    assert.ok(
      traits[dimension] >= low && traits[dimension] <= high,
      `${dimension} came out at ${traits[dimension]}, outside [${low}, ${high}]`,
    );
  }
  // And it differs from a body of another kind in the direction the
  // archetypes claim: a militia holds ground, an agency does not.
  const militia = orgArchetypes.found(engine.WorldState, {
    archetype: 'militia',
    name: 'The Eastside Watch',
    seed: 'archetype-test',
    generateOrganization: engine.generateOrganization,
    generateFaction: engine.generateFaction,
  });
  const militiaTraits = entityTraits.getLiveEntity(engine.WorldState, militia.id).traits.organization;
  assert.ok(militiaTraits.territory > traits.territory);
  assert.equal(militia.isFaction, true, 'a militia cannot hold a territory block');
});

test('the draw is seeded, and is not seeded on the id', () => {
  // §88, and the corollary: ids come from a counter whose state depends
  // on what was built before, so seeding on one is not reproducible.
  const values = (key) => {
    const fn = orgArchetypes.traitValueFor('political party', 'same-seed', key);
    return ORGANIZATION_TRAIT_FAMILIES.map(
      (name) => fn({ family: 'organization', name }),
    );
  };
  assert.deepEqual(values(1), values(1));
  assert.notDeepEqual(values(1), values(2));
});

test('this file names nothing, and refuses to be asked to', () => {
  // The whole point. An archetype is a kind of organization; what it is
  // CALLED is the scenario's to say, and a generated name would be a
  // fictional institution with a plausible-sounding name attached.
  assert.throws(
    () => orgArchetypes.found(engine.WorldState, {
      archetype: 'political party',
      generateOrganization: engine.generateOrganization,
    }),
    /requires a name/,
  );
  // And no archetype's own definition carries a name of any kind.
  for (const definition of Object.values(orgArchetypes.ARCHETYPES)) {
    assert.equal(definition.name, undefined);
  }
});

test('an archetype nobody defined throws, and says what there is', () => {
  assert.throws(
    () => orgArchetypes.found(engine.WorldState, {
      archetype: 'the CIA',
      name: 'the CIA',
      generateOrganization: engine.generateOrganization,
    }),
    /is not an archetype/,
  );
});

test('an archetype that holds ground must be made as a faction', () => {
  // `territory_blocks.faction_id REFERENCES factions(organization_id)`,
  // so a militia made the ordinary way would be an organization that
  // claims to hold ground and cannot be written to a block. Refused
  // with the reason rather than produced and left broken.
  assert.throws(
    () => orgArchetypes.found(engine.WorldState, {
      archetype: 'militia',
      name: 'The Westside Watch',
      generateOrganization: engine.generateOrganization,
    }),
    /references factions\(organization_id\)/,
  );
});

test('it does not reach into engine.js', () => {
  // `generateOrganization` is injected for the reason
  // `missions.resolveMission` takes `payReward`: requiring `engine.js`
  // from here would close a cycle.
  assert.throws(
    () => orgArchetypes.found(engine.WorldState, { archetype: 'clan', name: 'Okoro' }),
    /requires options\.generateOrganization/,
  );
});

test('describeArchetypes reports zero founded rather than assuming', () => {
  // Standing rule 11's guard on this file: nothing in `worldgen` founds
  // an archetype, because deciding that a recovering settlement has an
  // intelligence service would be this file making exactly the claim
  // about the world it exists to avoid.
  const described = orgArchetypes.describeArchetypes({ organizations: [] });
  assert.equal(described.defined, orgArchetypes.ARCHETYPE_NAMES.length);
  assert.equal(described.founded, 0);
  assert.deepEqual(described.unbacked, [], 'an archetype wants a post no occupation supplies');
});
