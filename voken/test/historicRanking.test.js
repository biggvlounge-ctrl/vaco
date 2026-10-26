// VOKEN -- the real historic-entry ranking, by direct instruction:
// "find a way also to rank those things. The age, the rarity of these
// places." The failure this file exists to catch: a rank that doesn't
// actually track the register's own real earliestYear/recognitions
// facts, or two new real entries (Cahokia Mounds, the Sears Tower)
// missing real required fields.

const test = require('node:test');
const assert = require('node:assert');

const { getHistoricEntry, rankHistoricEntries } = require('../lib/historicRegistry');

test('Cahokia Mounds is a real, complete place entry', () => {
  const entry = getHistoricEntry('cahokia-mounds');
  assert.ok(entry);
  assert.equal(entry.subjectType, 'place');
  assert.equal(entry.name, 'Cahokia Mounds');
  assert.equal(entry.earliestYear, 1050);
  assert.ok(entry.recognitions.includes('UNESCO World Heritage Site (1982)'));
});

test('the Sears Tower is a real, complete monument entry', () => {
  const entry = getHistoricEntry('sears-tower');
  assert.ok(entry);
  assert.equal(entry.subjectType, 'monument');
  assert.equal(entry.earliestYear, 1973);
  assert.ok(entry.summary.includes('Chicago'));
});

test('rankHistoricEntries ranks older entries first', () => {
  const now = new Date('2026-01-01').getTime();
  const ranked = rankHistoricEntries({ now });
  // The Wheel (earliestYear -3500) is the oldest real entry in the
  // whole register -- it must come out on top regardless of anything
  // else added to the register over time.
  assert.equal(ranked[0].slug, 'the-wheel');
  for (let i = 1; i < ranked.length; i++) {
    assert.ok(ranked[i - 1].ageYears >= ranked[i].ageYears, 'age must be non-increasing down the ranked list');
  }
});

test('rankHistoricEntries breaks ties by rarity (recognitions count)', () => {
  const now = new Date('2026-01-01').getTime();
  // Mount Rushmore (1927, 0 recognitions) and the Lincoln Memorial
  // (1922, 0 recognitions) are close in age but not tied -- instead
  // force a real tie using two entries from the same earliestYear by
  // checking the invariant generically: for any adjacent equal-age
  // pair, rarity must be non-increasing too.
  const ranked = rankHistoricEntries({ now });
  for (let i = 1; i < ranked.length; i++) {
    if (ranked[i - 1].ageYears === ranked[i].ageYears) {
      assert.ok(ranked[i - 1].rarityScore >= ranked[i].rarityScore, 'equal-age entries must be ordered by rarity next');
    }
  }
});

test('rankHistoricEntries assigns a real, contiguous 1-based rank', () => {
  const ranked = rankHistoricEntries();
  for (let i = 0; i < ranked.length; i++) {
    assert.equal(ranked[i].rank, i + 1);
  }
});

test('rankHistoricEntries can be scoped to one real subjectType', () => {
  const ranked = rankHistoricEntries({ subjectType: 'monument' });
  assert.ok(ranked.length > 0);
  for (const row of ranked) assert.equal(row.subjectType, 'monument');
  assert.ok(ranked.some((r) => r.slug === 'sears-tower'));
});

test('rankHistoricEntries rejects an invalid subjectType', () => {
  assert.throws(() => rankHistoricEntries({ subjectType: 'not-a-real-type' }), /invalid subjectType/);
});
