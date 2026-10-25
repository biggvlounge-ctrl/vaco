// VOKEN -- Cvltvre Cards about a non-person subject (a World Layer
// location, a Vavlt Stvdios casino event). `mintCultureCard`'s own
// consent mechanism -- the subject's guaranteed first copy -- exists
// because a card is normally about a real person's likeness.
// `mintExternalEntityCard` is the other path: no `subjectPersonId`,
// and `mintedByRole` decides what the mint actually guarantees.
//
// The failure this file exists to catch: an `operator`-minted card
// quietly handing the operator themselves a free guaranteed edition --
// the self-enrichment path a curator-only role must never have.

const test = require('node:test');
const assert = require('node:assert');

const { createVokenStore } = require('../lib/store');
const {
  SOURCE_APPS, SOURCE_TYPES_BY_APP, MINTED_BY_ROLES, mintExternalEntityCard,
} = require('../lib/cultureCards');

function baseArgs(overrides = {}) {
  return {
    sourceApp: 'vavlt-stvdios',
    sourceType: 'casino-event',
    externalRef: '42',
    mintedByUserId: 'host-1',
    mintedByRole: 'owner',
    category: 'eventMoments',
    rarityTier: 'rare',
    tokenizationType: 'digital',
    formats: ['digital'],
    plannedDigitalMintCount: 100,
    plannedPhysicalMintCount: 0,
    ...overrides,
  };
}

test('real enums are exported and cover all three wired apps', () => {
  assert.deepEqual(SOURCE_APPS, ['world-layer', 'vavlt-stvdios', 'cvllex']);
  assert.deepEqual(SOURCE_TYPES_BY_APP['world-layer'], ['location']);
  assert.deepEqual(SOURCE_TYPES_BY_APP['vavlt-stvdios'], ['casino-event']);
  assert.deepEqual(SOURCE_TYPES_BY_APP.cvllex, ['production-order']);
  assert.deepEqual(MINTED_BY_ROLES, ['owner', 'operator']);
});

test('mintExternalEntityCard accepts a real cvllex production-order mint', () => {
  const store = createVokenStore();
  const card = mintExternalEntityCard(store, baseArgs({
    sourceApp: 'cvllex', sourceType: 'production-order', externalRef: '7',
  }));
  assert.strictEqual(card.sourceApp, 'cvllex');
  assert.strictEqual(card.sourceType, 'production-order');
  assert.strictEqual(card.externalRef, '7');
});

test('mintExternalEntityCard validates sourceApp, sourceType, externalRef, mintedByRole, mintedByUserId', () => {
  const store = createVokenStore();
  assert.throws(
    () => mintExternalEntityCard(store, baseArgs({ sourceApp: 'not-a-real-app' })),
    /invalid sourceApp/,
  );
  assert.throws(
    () => mintExternalEntityCard(store, baseArgs({ sourceType: 'location' })), // location is a world-layer type, not vavlt-stvdios
    /invalid sourceType "location" for vavlt-stvdios/,
  );
  assert.throws(
    () => mintExternalEntityCard(store, baseArgs({ externalRef: null })),
    /requires an externalRef/,
  );
  assert.throws(
    () => mintExternalEntityCard(store, baseArgs({ mintedByRole: 'subject' })),
    /mintedByRole must be one of/,
  );
  assert.throws(
    () => mintExternalEntityCard(store, baseArgs({ mintedByUserId: null })),
    /requires a mintedByUserId/,
  );
});

test('mintExternalEntityCard still validates category/rarity/tokenization/format/mint-count like mintCultureCard does', () => {
  const store = createVokenStore();
  assert.throws(
    () => mintExternalEntityCard(store, baseArgs({ category: 'not-a-real-category' })),
    /invalid category/,
  );
  assert.throws(
    () => mintExternalEntityCard(store, baseArgs({ plannedDigitalMintCount: 0 })),
    /positive integer plannedDigitalMintCount/,
  );
});

test('a card has no subjectPersonId and carries the real external reference', () => {
  const store = createVokenStore();
  const card = mintExternalEntityCard(store, baseArgs());
  assert.equal(card.subjectPersonId, null);
  assert.equal(card.sourceApp, 'vavlt-stvdios');
  assert.equal(card.sourceType, 'casino-event');
  assert.equal(card.externalRef, '42');
  assert.equal(card.mintedByUserId, 'host-1');
  assert.equal(card.mintedByRole, 'owner');
});

test('an owner-minted card gets the same guaranteed-first-copy treatment a person subject gets', () => {
  const store = createVokenStore();
  const card = mintExternalEntityCard(store, baseArgs({
    mintedByRole: 'owner', mintedByUserId: 'host-1', plannedPhysicalMintCount: 5,
  }));
  assert.equal(card.editions.length, 2, 'digital edition #1 and physical edition #1');
  assert.ok(card.editions.every((e) => e.editionNumber === 1 && e.ownerId === 'host-1'));
  assert.deepEqual(card.editions.map((e) => e.format).sort(), ['digital', 'physical']);
  assert.equal(card.provenance[0].ownerId, 'host-1');
});

test('an operator-minted card mints NO guaranteed edition to anyone, including the operator themselves', () => {
  const store = createVokenStore();
  const card = mintExternalEntityCard(store, baseArgs({
    sourceApp: 'world-layer', sourceType: 'location', externalRef: 'loc-9',
    category: 'landmarks', mintedByRole: 'operator', mintedByUserId: 'operator-jane',
    plannedPhysicalMintCount: 3,
  }));
  assert.deepEqual(card.editions, [], 'an operator must receive no free edition for curating a card into existence');
  assert.equal(card.provenance[0].ownerId, null);
  assert.equal(card.mintedByUserId, 'operator-jane', 'who decided this is still recorded, just not rewarded with an edition');
});

test('a world-layer card can carry the landmarks category and a location externalRef', () => {
  const store = createVokenStore();
  const card = mintExternalEntityCard(store, baseArgs({
    sourceApp: 'world-layer', sourceType: 'location', externalRef: 'WL-LOC-0007',
    category: 'landmarks', mintedByRole: 'operator', mintedByUserId: 'operator-jane',
  }));
  assert.equal(card.sourceApp, 'world-layer');
  assert.equal(card.externalRef, 'WL-LOC-0007');
});

test('every minted external-entity card still gets a real incrementing id in the shared cultureCards collection', () => {
  const store = createVokenStore();
  const a = mintExternalEntityCard(store, baseArgs());
  const b = mintExternalEntityCard(store, baseArgs({ externalRef: '43' }));
  assert.equal(b.id, a.id + 1);
  assert.equal(store.cultureCards.length, 2);
});
