// server/territory.js#buildBarricade -- task #138's real player verb
// for the 'fortified' status, which until now only ever emerged from
// resolveTerritoryControl's own tick-driven trait math. Read that
// function's own header in territory.js first.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const territory = require('../server/territory.js');
const membership = require('../server/membership.js');
const control = require('../server/control.js');
const { getTraitId } = require('../server/traitDefinitions.js');

let nextId = 980000;

function world() {
  return {
    tick: 10,
    npcs: [],
    organizations: [],
    territoryBlocks: [],
    entityOrganizationMemberships: [],
    entityTraits: [],
  };
}

function person(w) {
  const id = nextId++;
  w.npcs.push({ id, status: 'active' });
  return id;
}

function faction(w) {
  const id = nextId++;
  w.organizations.push({ id, name: `Faction ${id}`, type: 'gang', isFaction: true });
  return id;
}

// The full real row shape `entityTraits.generateEntityTraits` always
// produces -- `applyKeyModifier` sums EVERY modifier column to
// recompute `current_value`, so a fixture row missing one becomes NaN
// the moment it is touched, not merely wrong (the eighth standing
// rule's own lesson: build fixtures the same shape the real generator
// does).
function setOrgTrait(w, organizationId, name, value) {
  w.entityTraits.push({
    id: w.entityTraits.length + 1, entity_id: organizationId,
    trait_id: getTraitId('organization', name),
    current_value: value, base_value: value,
    temporary_modifier: 0, permanent_modifier: 0, experience_modifier: 0,
    environmental_modifier: 0, relationship_modifier: 0, key_modifier: 0,
  });
}

function block(w, { factionId }) {
  return territory.generateTerritoryBlock(w, { factionId, cityId: null, communityId: null });
}

test('BARRICADE_TERRITORY_BONUS reuses control.SHARED_UNDERTAKING -- no second invented number for the same real-world-sized event', () => {
  assert.equal(territory.BARRICADE_TERRITORY_BONUS, control.SHARED_UNDERTAKING);
});

test('buildBarricade refuses a block that does not exist', () => {
  const w = world();
  const member = person(w);
  assert.throws(
    () => territory.buildBarricade(w, { entityId: member, blockId: 999999 }),
    /no real territory block/,
  );
});

test('buildBarricade refuses a citizen who is not a real member of the controlling faction', () => {
  const w = world();
  const f = faction(w);
  const b = block(w, { factionId: f });
  const outsider = person(w);
  assert.throws(
    () => territory.buildBarricade(w, { entityId: outsider, blockId: b.id }),
    /is not a real member/,
  );
});

test('buildBarricade raises the controlling faction\'s own live territory trait by the real, reused bonus', () => {
  const w = world();
  const f = faction(w);
  setOrgTrait(w, f, 'territory', 50);
  setOrgTrait(w, f, 'power', 50);
  const b = block(w, { factionId: f });
  const member = person(w);
  membership.joinOrganization(w, { entityId: member, organizationId: f, tick: w.tick });

  territory.buildBarricade(w, { entityId: member, blockId: b.id });

  const row = w.entityTraits.find(
    (t) => t.entity_id === f && t.trait_id === getTraitId('organization', 'territory'),
  );
  assert.equal(row.current_value, 50 + territory.BARRICADE_TERRITORY_BONUS);
});

test('buildBarricade returns the block re-resolved through the one real resolver, not a second status writer', () => {
  const w = world();
  const f = faction(w);
  // Comfortably above FORTIFIED_THRESHOLD even after the real seeded
  // variance (±VARIANCE_RANGE/2), so this proves the real resolver ran
  // -- not a specific crossing, which the seeded draw could disturb.
  setOrgTrait(w, f, 'territory', 95);
  setOrgTrait(w, f, 'power', 95);
  const b = block(w, { factionId: f });
  const member = person(w);
  membership.joinOrganization(w, { entityId: member, organizationId: f, tick: w.tick });

  const result = territory.buildBarricade(w, { entityId: member, blockId: b.id });
  assert.equal(result.id, b.id);
  assert.equal(result.status, 'fortified');
});

test('mutation check: a version of buildBarricade that writes block.status directly, skipping the real resolver, is not what this returns', () => {
  const w = world();
  const f = faction(w);
  // Comfortably below CONTESTED_THRESHOLD even after variance, so the
  // real resolver would call this 'contested' -- a direct-write
  // mutation that just flips status to 'fortified' would disagree.
  setOrgTrait(w, f, 'territory', 5);
  setOrgTrait(w, f, 'power', 5);
  const b = block(w, { factionId: f });
  const member = person(w);
  membership.joinOrganization(w, { entityId: member, organizationId: f, tick: w.tick });

  const result = territory.buildBarricade(w, { entityId: member, blockId: b.id });
  assert.equal(result.status, 'contested',
    'a real resolver call, not a shortcut, is what decides the returned status');
});
