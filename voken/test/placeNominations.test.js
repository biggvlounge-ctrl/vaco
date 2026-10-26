// VOKEN -- real community place nominations, by direct instruction:
// "we will do a lot of the places ourselves. And then we will let
// people nominate places as well." The failure this file exists to
// catch: a nomination minting a card before any real operator ever
// looked at it, or an approved nomination colliding with (or
// shadowing) a real, hand-curated entry already in the fixed
// register.

const test = require('node:test');
const assert = require('node:assert');

const { createVokenStore } = require('../lib/store');
const {
  submitPlaceNomination, getPlaceNomination, reviewPlaceNomination,
  getApprovedCustomHistoricEntry, listApprovedCustomHistoricEntries, genuineSignificanceInputsForCustomEntry,
} = require('../lib/placeNominations');
const { mintHistoricCard } = require('../lib/cultureCards');
const { getHistoricEntry } = require('../lib/historicRegistry');

function baseNomination(overrides = {}) {
  return {
    nominatorId: 'community-member-sam',
    subjectType: 'monument',
    name: 'The Angkor Wat Temple',
    era: 'c. 1113–1150 CE',
    earliestYear: 1113,
    summary: 'A vast Hindu, later Buddhist, temple complex in Cambodia, the largest religious monument in the world.',
    recognitions: ['UNESCO World Heritage Site (1992)'],
    ...overrides,
  };
}

test('Vatican City is a real, complete, fixed-register place entry', () => {
  const entry = getHistoricEntry('vatican-city');
  assert.ok(entry);
  assert.equal(entry.subjectType, 'place');
  assert.equal(entry.earliestYear, 1929);
  assert.ok(entry.recognitions.includes('UNESCO World Heritage Site (1984)'));
});

test('a submitted nomination always starts pending-review, never auto-added', () => {
  const store = createVokenStore();
  const nomination = submitPlaceNomination(store, baseNomination());
  assert.equal(nomination.status, 'pending-review');
  assert.equal(nomination.slug, 'the-angkor-wat-temple');
  assert.equal(getApprovedCustomHistoricEntry(store, nomination.slug), null, 'not real until a real operator approves it');
});

test('a nomination is scoped to real physical places only', () => {
  const store = createVokenStore();
  assert.throws(
    () => submitPlaceNomination(store, baseNomination({ subjectType: 'person' })),
    /invalid subjectType/,
  );
  assert.throws(
    () => submitPlaceNomination(store, baseNomination({ subjectType: 'invention' })),
    /invalid subjectType/,
  );
});

test('an approved nomination becomes a real, runtime-extensible historic entry mintHistoricCard can use', () => {
  const store = createVokenStore();
  const nomination = submitPlaceNomination(store, baseNomination());
  reviewPlaceNomination(store, { nominationId: nomination.nominationId, approved: true, operatorName: 'operator-jane' });

  const entry = getApprovedCustomHistoricEntry(store, nomination.slug);
  assert.equal(entry.name, 'The Angkor Wat Temple');

  const card = mintHistoricCard(store, {
    historicSlug: nomination.slug, mintedByUserId: 'operator-jane',
    rarityTier: 'legendary', tokenizationType: 'digital', formats: ['digital'], plannedDigitalMintCount: 500,
  });
  assert.equal(card.historicSlug, nomination.slug);
  assert.equal(card.historicSubjectType, 'monument');
  assert.equal(card.historicFact.name, 'The Angkor Wat Temple');
});

test('a declined nomination never becomes mintable', () => {
  const store = createVokenStore();
  const nomination = submitPlaceNomination(store, baseNomination());
  reviewPlaceNomination(store, { nominationId: nomination.nominationId, approved: false, operatorName: 'operator-jane', reason: 'insufficient evidence' });
  assert.equal(getApprovedCustomHistoricEntry(store, nomination.slug), null);
  assert.throws(
    () => mintHistoricCard(store, {
      historicSlug: nomination.slug, mintedByUserId: 'operator-jane',
      rarityTier: 'rare', tokenizationType: 'digital', formats: ['digital'], plannedDigitalMintCount: 10,
    }),
    /no historic entry/,
  );
});

test('reviewPlaceNomination refuses a slug that already exists in the fixed register', () => {
  const store = createVokenStore();
  const nomination = submitPlaceNomination(store, baseNomination({ name: 'Vatican City', earliestYear: 1929 }));
  assert.equal(nomination.slug, 'vatican-city', 'collides with the real fixed entry');
  assert.throws(
    () => reviewPlaceNomination(store, { nominationId: nomination.nominationId, approved: true, operatorName: 'operator-jane' }),
    /already exists in the fixed historic register/,
  );
});

test('reviewPlaceNomination refuses approving the same real slug twice', () => {
  const store = createVokenStore();
  const first = submitPlaceNomination(store, baseNomination());
  reviewPlaceNomination(store, { nominationId: first.nominationId, approved: true, operatorName: 'operator-jane' });

  const second = submitPlaceNomination(store, baseNomination({ nominatorId: 'someone-else' }));
  assert.throws(
    () => reviewPlaceNomination(store, { nominationId: second.nominationId, approved: true, operatorName: 'operator-jane' }),
    /was already approved by nomination/,
  );
});

test('listApprovedCustomHistoricEntries returns only real approved entries, optionally scoped by subjectType', () => {
  const store = createVokenStore();
  const monument = submitPlaceNomination(store, baseNomination());
  const home = submitPlaceNomination(store, baseNomination({
    nominatorId: 'sam', subjectType: 'home', name: 'A Real Historic Home', earliestYear: 1800,
  }));
  reviewPlaceNomination(store, { nominationId: monument.nominationId, approved: true, operatorName: 'operator-jane' });
  reviewPlaceNomination(store, { nominationId: home.nominationId, approved: false, operatorName: 'operator-jane' });

  const all = listApprovedCustomHistoricEntries(store);
  assert.equal(all.length, 1);
  assert.equal(all[0].slug, 'the-angkor-wat-temple');

  const monumentsOnly = listApprovedCustomHistoricEntries(store, 'monument');
  assert.equal(monumentsOnly.length, 1);
  const homesOnly = listApprovedCustomHistoricEntries(store, 'home');
  assert.equal(homesOnly.length, 0);
});

test('genuineSignificanceInputsForCustomEntry computes the same real math as the fixed register, from the nomination\'s own facts', () => {
  const store = createVokenStore();
  const nomination = submitPlaceNomination(store, baseNomination());
  reviewPlaceNomination(store, { nominationId: nomination.nominationId, approved: true, operatorName: 'operator-jane' });

  const now = new Date('2026-01-01').getTime();
  const inputs = genuineSignificanceInputsForCustomEntry(store, nomination.slug, { now });
  assert.equal(inputs.longevityOfImpactYears, 2026 - 1113);
  assert.equal(inputs.institutionalRecognitionCount, 1);
  assert.equal(inputs.documentedHistoricalImpact, true);
});

test('submitPlaceNomination requires every real field', () => {
  const store = createVokenStore();
  assert.throws(() => submitPlaceNomination(store, baseNomination({ nominatorId: null })), /requires a nominatorId/);
  assert.throws(() => submitPlaceNomination(store, baseNomination({ name: null })), /requires a name/);
  assert.throws(() => submitPlaceNomination(store, baseNomination({ era: null })), /requires an era/);
  assert.throws(() => submitPlaceNomination(store, baseNomination({ earliestYear: 'old' })), /requires an integer earliestYear/);
  assert.throws(() => submitPlaceNomination(store, baseNomination({ summary: null })), /requires a summary/);
});

test('reviewPlaceNomination requires a real operatorName and refuses re-review', () => {
  const store = createVokenStore();
  const nomination = submitPlaceNomination(store, baseNomination());
  assert.throws(
    () => reviewPlaceNomination(store, { nominationId: nomination.nominationId, approved: true }),
    /requires an operatorName/,
  );
  reviewPlaceNomination(store, { nominationId: nomination.nominationId, approved: true, operatorName: 'operator-jane' });
  assert.throws(
    () => reviewPlaceNomination(store, { nominationId: nomination.nominationId, approved: true, operatorName: 'operator-jane' }),
    /not pending-review/,
  );
});

test('getPlaceNomination returns null for an unknown id', () => {
  const store = createVokenStore();
  assert.equal(getPlaceNomination(store, 999999), null);
});
