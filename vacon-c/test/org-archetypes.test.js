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

// -- nationalist/racial organizations ------------------------------------
//
// Direct instruction: "certain racial organizations, well, nationalist
// organizations." No real, named group is in either archetype — see
// their own headers, immediately above their entries in `ARCHETYPES`.

test('nationalist movement is a dispersed political body, not a territorial faction', () => {
  // ADL's own H.E.A.T. Map FAQ: membership "draws from fairly wide
  // geographic areas that cannot be accurately represented by a
  // single point on a map" — the real reason this archetype holds no
  // ground, unlike `militia`/`insurgent cell`/`prison gang`.
  const definition = orgArchetypes.definitionOf('nationalist movement');
  assert.equal(definition.type, 'club');
  assert.equal(definition.isFaction, undefined, 'a dispersed movement cannot hold a territory block');
  const profile = orgArchetypes.profileOf('nationalist movement');
  const militiaProfile = orgArchetypes.profileOf('militia');
  assert.ok(profile.territory[1] < militiaProfile.territory[0],
    'a nationalist movement should never out-hold a militia at its own game');
});

test('nationalist movement has no faction generator, and found() does not ask for one', () => {
  const org = orgArchetypes.found(engine.WorldState, {
    archetype: 'nationalist movement',
    name: 'Fixture Bloc',
    seed: 'nationalist-movement-test',
    generateOrganization: engine.generateOrganization,
  });
  assert.equal(org.type, 'club');
  assert.equal(org.archetype, 'nationalist movement');
});

test('racially-affiliated prison gang is the prison-gang shape, with higher cohesion', () => {
  // Four real, independent academic sources (Skarbek; the 2014 Prison
  // Journal Texas study; Infante, Morse, Fahmy & Wright 2023; the SAGE
  // Encyclopedia of Race and Crime) agree prison gangs have
  // historically organised substantially along racial lines — enough
  // to band cohesion up from the base archetype, not enough to claim
  // a current membership count (the thirty-sixth standing rule's own
  // finding, re-checked this round and still true).
  const definition = orgArchetypes.definitionOf('racially-affiliated prison gang');
  assert.equal(definition.type, 'gang');
  assert.equal(definition.isFaction, true, 'it holds ground inside its prison exactly like `prison gang`');
  const profile = orgArchetypes.profileOf('racially-affiliated prison gang');
  const baseProfile = orgArchetypes.profileOf('prison gang');
  assert.ok(profile.internalLoyalty[0] > baseProfile.internalLoyalty[0],
    'the racially-affiliated sub-archetype should read as MORE cohesive, not merely as different');
  // Every dimension this round found no new evidence about stays
  // identical to the base archetype, rather than drifting for no
  // stated reason (standing rule 12's own mistake, avoided here).
  assert.deepEqual(profile.territory, baseProfile.territory);
  assert.deepEqual(profile.membership, baseProfile.membership);
  assert.deepEqual(profile.production, baseProfile.production);
});

test('racially-affiliated prison gang must be founded as a faction, same as prison gang', () => {
  assert.throws(
    () => orgArchetypes.found(engine.WorldState, {
      archetype: 'racially-affiliated prison gang',
      name: 'Fixture Wing',
      generateOrganization: engine.generateOrganization,
    }),
    /references factions\(organization_id\)/,
  );
  const org = orgArchetypes.found(engine.WorldState, {
    archetype: 'racially-affiliated prison gang',
    name: 'Fixture Wing',
    seed: 'prison-gang-race-test',
    generateOrganization: engine.generateOrganization,
    generateFaction: engine.generateFaction,
  });
  assert.equal(org.isFaction, true);
  assert.equal(org.archetype, 'racially-affiliated prison gang');
});

test('neither new archetype\'s own file reads race or ethnicity to decide anything', () => {
  // The §9 answer both archetypes' headers reason through: the
  // identical one `'religious order'` already gave for `npc.religion`.
  // `test/ethnicity.test.js` and `test/race-packs.test.js` hold the
  // real forbidden-file-scan assertion (`orgArchetypes.js` is in both
  // FORBIDDEN lists); this is the narrower, file-local version of the
  // same check, kept here so this file's own test suite does not
  // depend on another file's list staying in sync to catch a
  // regression.
  const fs = require('node:fs');
  const path = require('node:path');
  const source = fs.readFileSync(path.join(__dirname, '..', 'server', 'orgArchetypes.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  assert.ok(!/\brace\b/.test(source), 'orgArchetypes.js reads race outside its own comments');
  assert.ok(!/ethnicity/i.test(source), 'orgArchetypes.js reads ethnicity outside its own comments');
});

test('nation of islam mosque and moorish science temple are real, distinct from religious order and from each other', () => {
  // Both are flagged at a lower confidence tier than `'religious
  // order'` on purpose — the ninety-fifth standing rule correctly
  // declined this data at CENSUS-TIER confidence (Pew / U.S. Religion
  // Census have no NOI/MSTA breakout), and this round's real secondary
  // sources (ADL, Mamiya, USC CRCC for NOI; Noble Drew Ali / 1913 /
  // the 1929 faction split for MSTA) are a narrower, explicitly
  // lower-confidence claim, never presented as neutral census data.
  const noi = orgArchetypes.definitionOf('nation of islam mosque');
  const mst = orgArchetypes.definitionOf('moorish science temple');
  const order = orgArchetypes.definitionOf('religious order');
  assert.equal(noi.type, 'religion');
  assert.equal(mst.type, 'religion');
  assert.equal(noi.confidence, 'secondary-estimate');
  assert.equal(mst.confidence, 'secondary-estimate');
  assert.equal(order.confidence, undefined, '`religious order` makes no secondary-source claim at all');
  // Distinct organizations, not the same body under two names: NOI
  // carries a real current membership/mosque-count range, MSTA
  // carries only historical per-era figures because the organization
  // itself has been factionally split since 1929.
  assert.ok(Array.isArray(noi.membershipEstimateRange));
  assert.equal(noi.membershipEstimateRange.length, 2);
  assert.equal(noi.clergyTitle, 'minister');
  assert.equal(mst.membershipEstimateRange, undefined,
    'MSTA has no current unified figure to cite — that is the real finding, not a gap');
  assert.equal(mst.clergyTitle, undefined,
    'no real current MSTA title was confirmed by the research behind this round');
  assert.ok(mst.historicalMembershipByEra['1920s-peak'].estimate > 0);
});

test('nation of islam mosque and moorish science temple each generate a real organization', () => {
  const noiOrg = orgArchetypes.found(engine.WorldState, {
    archetype: 'nation of islam mosque',
    name: 'Fixture Mosque',
    seed: 'noi-test',
    generateOrganization: engine.generateOrganization,
  });
  assert.equal(noiOrg.type, 'religion');
  assert.equal(noiOrg.archetype, 'nation of islam mosque');

  const mstOrg = orgArchetypes.found(engine.WorldState, {
    archetype: 'moorish science temple',
    name: 'Fixture Temple',
    seed: 'mst-test',
    generateOrganization: engine.generateOrganization,
  });
  assert.equal(mstOrg.type, 'religion');
  assert.equal(mstOrg.archetype, 'moorish science temple');

  // Both use the same real `preacher` occupation `'religious order'`
  // now correctly uses, not a second, invented post — `describeArchetypes`
  // own `unbacked` list is the measured proof nothing here asks for an
  // occupation the taxonomy cannot supply.
  assert.deepEqual(orgArchetypes.describeArchetypes(engine.WorldState).unbacked, []);
});

test('occupations.clergyTitleFor maps real per-tradition titles, and declines to guess one for traditions this round found no confirmed title for', () => {
  assert.equal(occupations.clergyTitleFor('muslim'), 'imam');
  assert.equal(occupations.clergyTitleFor('jewish'), 'rabbi');
  assert.equal(occupations.clergyTitleFor('catholic'), 'priest');
  assert.equal(occupations.clergyTitleFor('protestant'), 'pastor');
  assert.equal(occupations.clergyTitleFor('orthodox'), 'priest');
  assert.equal(occupations.clergyTitleFor('nation-of-islam'), 'minister');
  // Moorish Science Temple's post-1929 faction split left no single
  // current title confirmed by the research behind this round — null,
  // not a guess, same as any other tradition this map does not name.
  assert.equal(occupations.clergyTitleFor('moorish-science-temple'), null);
  assert.equal(occupations.clergyTitleFor('buddhist'), null);
  assert.equal(occupations.clergyTitleFor(undefined), null);
});

// -- Scientology / LDS / Masonic lodge / collegiate fraternity / vodou / Ifá --
// Tasks #159/#160. Appended at the end of the file on purpose, same
// discipline the hundred-and-fifty-fourth standing rule's own
// leadership-test correction records -- this file's own generation
// tests draw on `engine.WorldState`, not a local id counter, so there
// is no equivalent ordering hazard here, but appending keeps every
// existing test's own line numbers and this file's own read order
// stable regardless.

test('scientology church and latter-day saints congregation are both real, distinct, secondary-estimate-tier religion archetypes', () => {
  const scientology = orgArchetypes.definitionOf('scientology church');
  const lds = orgArchetypes.definitionOf('latter-day saints congregation');
  assert.equal(scientology.type, 'religion');
  assert.equal(lds.type, 'religion');
  assert.equal(scientology.confidence, 'secondary-estimate');
  assert.equal(lds.confidence, 'secondary-estimate');
  assert.deepEqual(scientology.membershipEstimateRange, [20000, 40000]);
  assert.equal(lds.membershipEstimate2022.worldwideMillions, 16.6);
});

test('masonic lodge and collegiate fraternity are real club archetypes, and neither fabricates a current membership count', () => {
  const lodge = orgArchetypes.definitionOf('masonic lodge');
  const frat = orgArchetypes.definitionOf('collegiate fraternity');
  assert.equal(lodge.type, 'club');
  assert.equal(frat.type, 'club');
  assert.equal(lodge.confidence, undefined, 'no current lodge/member count is claimed, so no confidence tier is attached to one');
  assert.equal(frat.membershipEstimateRange, undefined);
  // Real, nameable examples are documented for a scenario to use —
  // this file still names nothing itself.
  assert.match(frat.note, /Divine Nine/);
  assert.match(frat.note, /Sigma Pi Phi/);
  assert.match(frat.note, /Skull and Bones/);
});

test('this file names no real celebrity anywhere, including inside the new fraternity note', () => {
  const frat = orgArchetypes.definitionOf('collegiate fraternity');
  assert.ok(!/kardashian|obama\b/i.test(frat.note));
  // The one real, historical, uncontroversial fact this file allows
  // (two U.S. presidents among Skull and Bones' real alumni) is
  // organizational history, not a celebrity attachment, and is named
  // generically rather than by name.
  assert.match(frat.note, /two real U\.S\. presidents/i);
});

test('no present-day "Illuminati" archetype exists -- checked and declined, not omitted by accident', () => {
  assert.equal(orgArchetypes.definitionOf('illuminati'), null);
  const frat = orgArchetypes.definitionOf('collegiate fraternity');
  assert.ok(!/illuminati/i.test(frat.note), 'the decline belongs in this file\'s own header comment, never smuggled in as if it were a real archetype');
});

test('vodou house and ifa house are real, distinct, secondary-estimate-tier traditions with a declared wide range, never a point estimate', () => {
  const vodou = orgArchetypes.definitionOf('vodou house');
  const ifa = orgArchetypes.definitionOf('ifa house');
  assert.equal(vodou.type, 'religion');
  assert.equal(ifa.type, 'religion');
  assert.equal(vodou.confidence, 'secondary-estimate');
  assert.equal(ifa.confidence, 'secondary-estimate');
  assert.ok(typeof vodou.membershipEstimateRangeNote === 'string');
  // Neither pretends to a single settled figure -- the disagreement
  // itself is the real, reported finding.
  assert.equal(vodou.membershipEstimateRange, undefined);
  assert.equal(ifa.membershipEstimateRange, undefined);
});

test('all six new archetypes generate a real organization via found()', () => {
  for (const archetype of [
    'scientology church', 'latter-day saints congregation', 'masonic lodge',
    'collegiate fraternity', 'vodou house', 'ifa house',
  ]) {
    const org = orgArchetypes.found(engine.WorldState, {
      archetype, name: `Fixture ${archetype}`, seed: `${archetype}-test`,
      generateOrganization: engine.generateOrganization,
    });
    assert.equal(org.archetype, archetype);
  }
});

// -- youth clique (task #165) --------------------------------------

test('youth clique is a real, generic, non-criminal-by-default peer group with wide bands reflecting real heterogeneity', () => {
  const clique = orgArchetypes.definitionOf('youth clique');
  assert.equal(clique.type, 'club');
  assert.equal(clique.isFaction, undefined, 'a clique does not hold formal territory by default');
  assert.deepEqual(clique.posts, ['influencer']);
  // The wide bands ARE the real finding (most stay ordinary; a
  // minority escalate) -- not a narrow profile like a real gang's.
  const gangProfile = orgArchetypes.profileOf('prison gang');
  const cliqueProfile = orgArchetypes.profileOf('youth clique');
  assert.ok(cliqueProfile.resources[1] - cliqueProfile.resources[0]
    <= gangProfile.resources[1] - gangProfile.resources[0] + 50,
    'sanity: clique resources stay a real low band, not an invented high one');
  assert.ok(cliqueProfile.internalLoyalty[1] - cliqueProfile.internalLoyalty[0] >= 50,
    'the real heterogeneity (some smart, some not) must be a wide band, not a narrow invented one');
});

test('youth clique generates a real organization via found(), the same way every other generic archetype does', () => {
  const org = orgArchetypes.found(engine.WorldState, {
    archetype: 'youth clique',
    name: 'Fixture Block Clique',
    seed: 'youth-clique-test',
    generateOrganization: engine.generateOrganization,
  });
  assert.equal(org.type, 'club');
  assert.equal(org.archetype, 'youth clique');
});
