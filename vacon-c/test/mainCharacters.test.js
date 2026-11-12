// The real, computed local power hierarchy — "there'll be a kingpin,
// there'll be the strongest gang, the strongest political party, the
// strongest religious party... a power hierarchy in every town" — by
// direct instruction. `server/mainCharacters.js` adds no new storage
// and no new generation for three of its four categories; this file
// proves each one reads the real, already-existing substrate it
// claims to (`authority.holderOf`, real `governments` rows, the real
// highest-influence business operating in a community), and that the
// fourth (religious) is real end to end on a generated world.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const mainCharacters = require('../server/mainCharacters.js');
const engine = require('../server/engine.js');
const worldgen = require('../server/worldgen.js');
const orgArchetypes = require('../server/orgArchetypes.js');

// Standing rule 8: hand-built fixtures for the three categories that
// read pre-existing substrate directly, so each assertion is about
// the thing it names rather than about whatever a generated world
// happened to produce.
function baseWorld() {
  return {
    communities: [{ id: 9, city_id: 1 }],
    cities: [{ id: 1, region_id: 1 }],
    governments: [],
    organizations: [],
    properties: [],
    entityTraits: [],
  };
}

test('mainCharactersOf: unknown community is null, not an empty shell', () => {
  assert.equal(mainCharacters.mainCharactersOf(baseWorld(), 999), null);
});

test('criminal leader: the real faction holding this community\'s ground, read live', () => {
  const w = baseWorld();
  // Same pattern test/authority.test.js uses: a faction's hold has to
  // go through the real generator, because `authority.holderOf` reads
  // its traits through `getLiveEntity`, not a hand-set `.traits` sheet.
  const faction = engine.generateFaction({
    name: 'Holders', type: 'gang', traitValueFor: () => 80, leaderId: 501,
  });
  w.organizations.push(faction);
  w.entityTraits = engine.WorldState.entityTraits.filter((r) => r.entity_id === faction.id);
  w.territoryBlocks = [{ id: 1, faction_id: faction.id, city_id: 1, community_id: 9, status: 'controlled' }];

  const criminal = mainCharacters.criminalLeaderOf(w, 9);
  assert.deepEqual(criminal, { organizationId: faction.id, leaderId: 501 });
});

test('criminal leader: no faction holding ground here is honestly null, not a guess', () => {
  const w = baseWorld();
  w.territoryBlocks = [];
  assert.equal(mainCharacters.criminalLeaderOf(w, 9), null);
});

test('political leader: a community\'s own city government outranks its region and civ', () => {
  const w = baseWorld();
  w.organizations = [
    { id: 701, type: 'government', leader_id: 11 }, // civ
    { id: 702, type: 'government', leader_id: 22 }, // region
    { id: 703, type: 'government', leader_id: 33 }, // city — this one should win
  ];
  w.governments = [
    { organization_id: 701, scope_type: 'civilization', scope_id: null },
    { organization_id: 702, scope_type: 'region', scope_id: 1 },
    { organization_id: 703, scope_type: 'city', scope_id: 1 },
  ];
  assert.deepEqual(mainCharacters.politicalLeaderOf(w, 9), { organizationId: 703, leaderId: 33 });
});

test('political leader: falls back to the region, then the civilization, when no city government was founded', () => {
  const w = baseWorld();
  w.organizations = [{ id: 701, type: 'government', leader_id: 11 }];
  w.governments = [{ organization_id: 701, scope_type: 'civilization', scope_id: null }];
  assert.deepEqual(mainCharacters.politicalLeaderOf(w, 9), { organizationId: 701, leaderId: 11 });

  w.organizations.push({ id: 702, type: 'government', leader_id: 22 });
  w.governments.push({ organization_id: 702, scope_type: 'region', scope_id: 1 });
  assert.deepEqual(mainCharacters.politicalLeaderOf(w, 9), { organizationId: 702, leaderId: 22 });
});

test('political leader: a real government that has never held an election is honestly null', () => {
  const w = baseWorld();
  w.organizations = [{ id: 703, type: 'government', leader_id: null }];
  w.governments = [{ organization_id: 703, scope_type: 'city', scope_id: 1 }];
  assert.equal(mainCharacters.politicalLeaderOf(w, 9), null);
});

test('business leader: the highest-influence business actually operating a property here, ties broken by assets', () => {
  const w = baseWorld();
  w.organizations = [
    { id: 801, type: 'business', influence: 10, assets: 999999, leader_id: 44 },
    { id: 802, type: 'business', influence: 40, assets: 1, leader_id: 55 }, // wins on influence
    { id: 803, type: 'business', influence: 40, assets: 2, leader_id: 66 }, // same influence, more assets, not in this community
  ];
  w.properties = [
    { id: 1, community_id: 9, operating_organization_id: 801 },
    { id: 2, community_id: 9, operating_organization_id: 802 },
    { id: 3, community_id: 1, operating_organization_id: 803 }, // different community entirely
  ];
  assert.deepEqual(mainCharacters.businessLeaderOf(w, 9), { organizationId: 802, leaderId: 55 });
});

test('business leader: no business operating a property here is honestly null', () => {
  const w = baseWorld();
  w.organizations = [{ id: 801, type: 'business', influence: 99, leader_id: 1 }];
  w.properties = [];
  assert.equal(mainCharacters.businessLeaderOf(w, 9), null);
});

// -- religious: genuinely new this round, so it needs the real generator --

test('religious leader: a generated world founds one real religious order per community, with a real founding leader', () => {
  const w = engine.WorldState;
  const before = w.communities.length;
  worldgen.generateWorld({
    seed: 'main-characters-religious', religiousOrdersPerCommunity: true,
  });
  const communities = w.communities.slice(before);
  assert.ok(communities.length > 0);

  for (const community of communities) {
    const religious = mainCharacters.religiousLeaderOf(w, community.id);
    assert.ok(religious, `community ${community.id} should have a founded religious order`);
    assert.equal(typeof religious.leaderId, 'number');

    const organization = w.organizations.find((o) => o.id === religious.organizationId);
    assert.equal(organization.type, 'religion');
    assert.equal(organization.community_id, community.id);
  }
});

test('religious leader: the pack off means no religious order anywhere, same as before this round', () => {
  const w = engine.WorldState;
  const before = { communities: w.communities.length, organizations: w.organizations.length };
  worldgen.generateWorld({ seed: 'main-characters-no-religion' });
  const communities = w.communities.slice(before.communities);
  const newOrganizations = w.organizations.slice(before.organizations);
  assert.equal(newOrganizations.filter((o) => o.type === 'religion').length, 0);
  for (const community of communities) {
    assert.equal(mainCharacters.religiousLeaderOf(w, community.id), null);
  }
});

// -- the §9 firewall, held exactly as everywhere else in this engine --

test('the religious order archetype never reads npc.religion to found, lead, or join one', () => {
  // The same comment-stripped scan test/ethnicity.test.js uses, so a
  // comment explaining the firewall does not itself read as violating
  // it. `orgArchetypes.js` has no legitimate reason to ever touch
  // `npc.religion` — unlike `worldgen.js`, which legitimately WRITES
  // the field elsewhere (`religionPacks.js`'s own wiring) and is not
  // scanned whole here for exactly that reason; only the new
  // religious-order-founding block (between the two markers below) is
  // checked, isolating the one piece of code this round actually
  // added rather than flagging a pre-existing, unrelated writer.
  const fs = require('fs');
  const path = require('path');
  const codeOf = (file) => fs.readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

  const archetypesSource = codeOf(path.join(__dirname, '..', 'server', 'orgArchetypes.js'));
  assert.ok(!/\.religion\b/.test(archetypesSource), 'orgArchetypes.js must never read npc.religion');

  const worldgenSource = fs.readFileSync(path.join(__dirname, '..', 'server', 'worldgen.js'), 'utf8');
  const start = worldgenSource.indexOf('if (config.religiousOrdersPerCommunity) {');
  const end = worldgenSource.indexOf('summary.organizations += 1;', start);
  assert.ok(start >= 0 && end > start && end - start < 2000,
    'the religious-order-founding block must be found in worldgen.js, and only once');
  const rawBlock = worldgenSource.slice(start, end);
  const strippedBlock = rawBlock
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  assert.ok(!/\.religion\b/.test(strippedBlock), 'the religious-order-founding block must never read npc.religion');
});

test('mainCharactersOf: a real community reports all four categories honestly, present or null', () => {
  const w = engine.WorldState;
  const before = w.communities.length;
  const summary = worldgen.generateWorld({
    seed: 'main-characters-integration', religiousOrdersPerCommunity: true,
  });
  assert.ok(summary.communities > 0);
  const community = w.communities[before];
  const result = mainCharacters.mainCharactersOf(w, community.id);
  assert.equal(result.communityId, community.id);
  assert.ok('criminal' in result);
  assert.ok('political' in result);
  assert.ok('business' in result);
  // Religious is the one category this round's opt-in pack guarantees.
  assert.ok(result.religious);
});

// orgArchetypes.js's own ARCHETYPES object is exercised directly too,
// so a typo in the new entry's shape (missing a required trait band,
// wrong `type`) fails here rather than only inside a full worldgen run.
test('the religious order archetype is real, typed "religion", and holds no territory', () => {
  const archetype = orgArchetypes.ARCHETYPES['religious order'];
  assert.ok(archetype);
  assert.equal(archetype.type, 'religion');
  assert.ok(archetype.traits.territory[1] <= 10);
});
