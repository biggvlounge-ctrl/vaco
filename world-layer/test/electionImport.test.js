// County presidential election returns — a real civic fact about a
// place, reported, never a behavioral mechanism.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createWorldLayer, generateLocation } = require('../locations');
const election = require('../imports/electionImport');

function place(worldLayer) {
  return generateLocation(worldLayer, { name: 'County 1', lat: 38.6, lng: -90.2, tier: 'filler' });
}

test('a missing vote count gives no share — a share against an unknown base is invented', () => {
  assert.equal(election.toDemocraticShare(null, 20000), null);
  assert.equal(election.toDemocraticShare(20000, null), null);
});

test('both counts zero gives no share — an empty base is not a 0% or 100% share', () => {
  assert.equal(election.toDemocraticShare(0, 0), null);
});

test('a real two-party share computes correctly', () => {
  assert.equal(election.toDemocraticShare(60000, 40000), 0.6);
});

test('importCountyReturns requires a countyFips', () => {
  const w = createWorldLayer();
  const p = place(w);
  assert.throws(
    () => election.importCountyReturns(w, p.id, { democraticVotes: 100, republicanVotes: 100 }),
    /countyFips/,
  );
});

test('importCountyReturns writes a real share, and never a per-person fact', () => {
  const w = createWorldLayer();
  const p = place(w);
  election.importCountyReturns(w, p.id, {
    countyFips: '29510', countyName: 'St. Louis city', year: 2020,
    democraticVotes: 180000, republicanVotes: 40000,
  });
  assert.equal(p.populationData.politicalLean.source, 'mit-election-lab');
  assert.equal(p.populationData.politicalLean.democraticShare, 0.818182);
  assert.equal(p.populationData.containsIndividualAttributes, false);
});

test('describeElectionCoverage reports a median and the counties with no usable share', () => {
  const w = createWorldLayer();
  election.importCountyReturns(w, place(w).id, {
    countyFips: 'A', democraticVotes: 60000, republicanVotes: 40000,
  });
  election.importCountyReturns(w, place(w).id, { countyFips: 'B', democraticVotes: null });
  const report = election.describeElectionCoverage(w);
  assert.equal(report.counties, 2);
  assert.equal(report.withShare, 1);
  assert.equal(report.withoutShare, 1);
  assert.equal(report.medianDemocraticShare, 0.6);
});

test('fetchCountyReturns throws naming the block, like every importer in this registry', () => {
  assert.throws(election.fetchCountyReturns, (error) => {
    assert.ok(/not implemented/.test(error.message));
    assert.ok(/403 CONNECT|proxy allowlist/.test(error.message));
    return true;
  });
});
