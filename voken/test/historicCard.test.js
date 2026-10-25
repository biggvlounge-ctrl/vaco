// VOKEN -- Cvltvre Cards about real historic places, people, inventions,
// and books. The failure this file exists to catch: minting against a
// slug that is not in the real register, which would let a "historic"
// card carry whatever an operator typed rather than real, checkable
// information -- the one thing this category exists to guarantee.

const test = require('node:test');
const assert = require('node:assert');

const { createVokenStore } = require('../lib/store');
const { mintHistoricCard, listHistoricCards } = require('../lib/cultureCards');
const {
  HISTORIC_SUBJECT_TYPES, HISTORIC_REGISTRY, listHistoricEntries, getHistoricEntry, genuineSignificanceInputsFor,
} = require('../lib/historicRegistry');
const { computeGenuineSignificanceScore } = require('../lib/valueAlgorithm');

function baseArgs(overrides = {}) {
  return {
    historicSlug: 'printing-press',
    mintedByUserId: 'operator-jane',
    rarityTier: 'rare',
    tokenizationType: 'digital',
    formats: ['digital'],
    plannedDigitalMintCount: 100,
    plannedPhysicalMintCount: 0,
    ...overrides,
  };
}

test('the historic register covers all six real subject types with at least one real entry each', () => {
  assert.deepEqual(HISTORIC_SUBJECT_TYPES, ['place', 'monument', 'home', 'person', 'invention', 'book']);
  for (const subjectType of HISTORIC_SUBJECT_TYPES) {
    const entries = listHistoricEntries(subjectType);
    assert.ok(entries.length > 0, `expected at least one real "${subjectType}" entry`);
    for (const e of entries) {
      assert.equal(e.subjectType, subjectType);
      assert.ok(e.slug && e.name && e.era && e.summary, `entry "${e.slug}" is missing a real field`);
      assert.ok(Number.isInteger(e.earliestYear), `entry "${e.slug}" is missing a real integer earliestYear`);
      assert.ok(Array.isArray(e.recognitions), `entry "${e.slug}" is missing a real recognitions array`);
    }
  }
});

test('genuineSignificanceInputsFor computes real, deterministic inputs from the register, not a per-call guess', () => {
  // Marie Curie's two Nobel Prizes are the clearest real case: a fixed,
  // citable recognitionCount of 2, and a longevity computed from her
  // own earliestYear (1898), not asserted separately.
  const now = new Date('2026-06-15').getTime();
  const inputs = genuineSignificanceInputsFor('marie-curie', { now });
  assert.equal(inputs.longevityOfImpactYears, 2026 - 1898);
  assert.equal(inputs.institutionalRecognitionCount, 2);
  assert.equal(inputs.documentedHistoricalImpact, true);

  // Calling it again with the same slug and the same `now` must
  // produce the exact same numbers -- no hidden randomness or drift.
  assert.deepEqual(genuineSignificanceInputsFor('marie-curie', { now }), inputs);

  // And the numbers it produces must themselves be valid inputs to the
  // real significance-score function, not merely shaped like them.
  const score = computeGenuineSignificanceScore(inputs);
  assert.ok(score.genuineSignificanceScore > 0);
});

test('genuineSignificanceInputsFor refuses a slug not in the register', () => {
  assert.throws(
    () => genuineSignificanceInputsFor('not-a-real-slug'),
    /no historic entry "not-a-real-slug" in the register/,
  );
});

test('listHistoricEntries with no subjectType returns the whole register, and rejects an unknown subjectType', () => {
  assert.deepEqual(listHistoricEntries(), HISTORIC_REGISTRY);
  assert.throws(() => listHistoricEntries('not-a-real-type'), /invalid subjectType/);
});

test('getHistoricEntry looks up a real entry by slug and returns null for an unknown one', () => {
  const entry = getHistoricEntry('johannes-gutenberg');
  assert.equal(entry.name, 'Johannes Gutenberg');
  assert.equal(entry.subjectType, 'person');
  assert.equal(getHistoricEntry('not-a-real-slug'), null);
});

test('mintHistoricCard refuses a slug not in the real register', () => {
  const store = createVokenStore();
  assert.throws(
    () => mintHistoricCard(store, baseArgs({ historicSlug: 'not-a-real-slug' })),
    /no historic entry "not-a-real-slug" in the register/,
  );
});

test('mintHistoricCard requires a historicSlug and a mintedByUserId', () => {
  const store = createVokenStore();
  assert.throws(
    () => mintHistoricCard(store, baseArgs({ historicSlug: null })),
    /requires a historicSlug/,
  );
  assert.throws(
    () => mintHistoricCard(store, baseArgs({ mintedByUserId: null })),
    /requires a mintedByUserId/,
  );
});

test('mintHistoricCard still validates rarity/tokenization/format/mint-count like every other mint path', () => {
  const store = createVokenStore();
  assert.throws(
    () => mintHistoricCard(store, baseArgs({ rarityTier: 'not-a-real-tier' })),
    /invalid rarityTier/,
  );
  assert.throws(
    () => mintHistoricCard(store, baseArgs({ plannedDigitalMintCount: 0 })),
    /positive integer plannedDigitalMintCount/,
  );
});

test('a minted historic card is fixed to category "historic" and carries the real fact from the register', () => {
  const store = createVokenStore();
  const card = mintHistoricCard(store, baseArgs({ historicSlug: 'machu-picchu' }));
  assert.equal(card.category, 'historic');
  assert.equal(card.historicSlug, 'machu-picchu');
  assert.equal(card.historicSubjectType, 'place');
  assert.deepEqual(card.historicFact, {
    name: 'Machu Picchu', era: 'c. 1450 CE',
    summary: 'A 15th-century Inca citadel set high in the Andes Mountains of Peru, built during the reign of Pachacuti and brought to wider international attention in 1911 by Hiram Bingham.',
  });
});

test('a historic card mints NO guaranteed edition to anyone, including the operator who curated it', () => {
  const store = createVokenStore();
  const card = mintHistoricCard(store, baseArgs({ plannedPhysicalMintCount: 3 }));
  assert.deepEqual(card.editions, [], 'nobody owns the printing press -- no free edition to anyone');
  assert.equal(card.subjectPersonId, null);
  assert.equal(card.mintedByRole, 'operator');
  assert.equal(card.provenance[0].ownerId, null);
  assert.equal(card.mintedByUserId, 'operator-jane', 'who curated this is still recorded, just not rewarded with an edition');
});

test('listHistoricCards returns only historic cards, optionally scoped to a subjectType', () => {
  const store = createVokenStore();
  mintHistoricCard(store, baseArgs({ historicSlug: 'printing-press' }));
  mintHistoricCard(store, baseArgs({ historicSlug: 'shakespeare-hamlet' }));

  const all = listHistoricCards(store);
  assert.equal(all.length, 2);

  const inventionsOnly = listHistoricCards(store, 'invention');
  assert.equal(inventionsOnly.length, 1);
  assert.equal(inventionsOnly[0].historicSlug, 'printing-press');
});

test('every minted historic card still gets a real incrementing id in the shared cultureCards collection', () => {
  const store = createVokenStore();
  const a = mintHistoricCard(store, baseArgs({ historicSlug: 'printing-press' }));
  const b = mintHistoricCard(store, baseArgs({ historicSlug: 'telephone' }));
  assert.equal(b.id, a.id + 1);
  assert.equal(store.cultureCards.length, 2);
});
