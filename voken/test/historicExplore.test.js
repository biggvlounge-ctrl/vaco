// VOKEN -- the Instagram-Explore-style browsing surface for historic
// Cvltvre Cards: one section per real subjectType, cards ranked within
// a section by real, live engagement, each carrying the real
// genuineSignificanceScore computed straight from the historic
// register. The failure this file exists to catch: a section that
// mixes subject types, or a feed that reshuffles identical input into
// a different order on every call (not actually deterministic).

const test = require('node:test');
const assert = require('node:assert');

const { createVokenStore } = require('../lib/store');
const { mintHistoricCard } = require('../lib/cultureCards');
const { recordEngagementEvent } = require('../lib/cardEngagement');
const { getHistoricExplorePage } = require('../lib/historicExplore');
const { HISTORIC_SUBJECT_TYPES } = require('../lib/historicRegistry');

function mint(store, historicSlug) {
  return mintHistoricCard(store, {
    historicSlug, mintedByUserId: 'operator-jane', rarityTier: 'rare',
    tokenizationType: 'digital', formats: ['digital'], plannedDigitalMintCount: 100,
  });
}

test('every real historic subjectType gets its own section, in the register\'s own fixed order', () => {
  const store = createVokenStore();
  mint(store, 'printing-press');
  mint(store, 'shakespeare-hamlet');

  const page = getHistoricExplorePage(store);
  assert.deepEqual(page.sections.map((s) => s.subjectType), HISTORIC_SUBJECT_TYPES);
});

test('a section contains only cards of its own real subjectType', () => {
  const store = createVokenStore();
  mint(store, 'printing-press'); // invention
  mint(store, 'telephone'); // invention
  mint(store, 'shakespeare-hamlet'); // book

  const page = getHistoricExplorePage(store);
  const inventionSection = page.sections.find((s) => s.subjectType === 'invention');
  const bookSection = page.sections.find((s) => s.subjectType === 'book');

  assert.equal(inventionSection.cards.length, 2);
  assert.ok(inventionSection.cards.every((c) => c.historicSubjectType === 'invention'));
  assert.equal(bookSection.cards.length, 1);
  assert.equal(bookSection.cards[0].historicSlug, 'shakespeare-hamlet');
});

test('a non-historic card never appears in the historic explore page', () => {
  const store = createVokenStore();
  mint(store, 'printing-press');
  // A real person-subject card, the other mint path entirely.
  const { mintCultureCard } = require('../lib/cultureCards');
  mintCultureCard(store, {
    subjectPersonId: 'creator-1', category: 'music', rarityTier: 'rare',
    tokenizationType: 'digital', formats: ['digital'], plannedDigitalMintCount: 10,
  });

  const page = getHistoricExplorePage(store);
  assert.equal(page.totalCards, 1);
});

test('within a section, cards rank by real, live attentionScore, not insertion order', () => {
  const store = createVokenStore();
  const quiet = mint(store, 'printing-press');
  const loud = mint(store, 'telephone');

  // `loud` gets real engagement events recorded after it; `quiet` gets
  // none -- if ranking were insertion order, `quiet` (minted first)
  // would still lead.
  for (let i = 0; i < 20; i += 1) recordEngagementEvent(store, { cardId: loud.id, type: 'like' });

  const page = getHistoricExplorePage(store);
  const inventionSection = page.sections.find((s) => s.subjectType === 'invention');
  assert.equal(inventionSection.cards[0].contentId, loud.id);
  assert.ok(inventionSection.cards[0].attentionScore > inventionSection.cards[1].attentionScore);
  assert.equal(inventionSection.cards[1].contentId, quiet.id);
});

test('each card carries its real historicFact and a real genuineSignificanceScore, not a placeholder', () => {
  const store = createVokenStore();
  mint(store, 'marie-curie');

  const page = getHistoricExplorePage(store);
  const personSection = page.sections.find((s) => s.subjectType === 'person');
  const card = personSection.cards[0];

  assert.equal(card.historicFact.name, 'Marie Curie');
  assert.ok(card.genuineSignificanceScore > 0);
  // Marie Curie's two real Nobel Prizes give her a strictly higher
  // significance score than a slug with zero recorded recognitions,
  // all else being the typical case -- a real, checkable difference,
  // not two cards scoring identically regardless of their real facts.
  mint(store, 'johannes-gutenberg');
  const page2 = getHistoricExplorePage(store);
  const curieCard = page2.sections.find((s) => s.subjectType === 'person').cards.find((c) => c.historicSlug === 'marie-curie');
  const gutenbergCard = page2.sections.find((s) => s.subjectType === 'person').cards.find((c) => c.historicSlug === 'johannes-gutenberg');
  assert.ok(curieCard.genuineSignificanceScore > gutenbergCard.genuineSignificanceScore);
});

test('calling the explore page twice with the same store produces the same result -- real, not randomized', () => {
  const store = createVokenStore();
  mint(store, 'printing-press');
  mint(store, 'stonehenge');

  const now = Date.now();
  assert.deepEqual(getHistoricExplorePage(store, { now }), getHistoricExplorePage(store, { now }));
});
