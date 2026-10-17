// OJJDP National Youth Gang Survey (NYGS) — the one source in this
// registry that is not current. See the importer's own header for
// why FBI's National Gang Intelligence Center, GangNET and state
// systems like CalGang were checked and ruled out before this one.

'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { createWorldLayer, generateLocation } = require('../locations');
const nygs = require('../imports/nygsImport');

function place(worldLayer) {
  return generateLocation(worldLayer, { name: 'Jurisdiction 1', lat: 38.6, lng: -90.2, tier: 'filler' });
}

test('a year after the survey was discontinued is refused, not silently accepted', () => {
  const w = createWorldLayer();
  const p = place(w);
  assert.throws(
    () => nygs.importNygsJurisdiction(w, p.id, { jurisdictionName: 'Testville PD', year: 2020 }),
    /2012/,
  );
});

test('a real year within the survey\'s run is accepted', () => {
  const w = createWorldLayer();
  const p = place(w);
  nygs.importNygsJurisdiction(w, p.id, { jurisdictionName: 'Testville PD', year: 2012, gangCount: 3 });
  assert.equal(p.populationData.gangActivity.year, 2012);
});

test('toMembershipRate requires a real population figure, not an invented denominator', () => {
  assert.equal(nygs.toMembershipRate(500, null), null);
  assert.equal(nygs.toMembershipRate(500, 100000), 0.005);
});

test('a rate outside the sanity bound is refused', () => {
  assert.equal(nygs.toMembershipRate(90000, 100000), null, '90% gang membership is a units error');
});

test('importNygsJurisdiction requires a jurisdictionName', () => {
  const w = createWorldLayer();
  const p = place(w);
  assert.throws(() => nygs.importNygsJurisdiction(w, p.id, { year: 2012 }), /jurisdictionName/);
});

test('importNygsJurisdiction carries staleness on every row, and never a per-person fact', () => {
  const w = createWorldLayer();
  const p = place(w);
  nygs.importNygsJurisdiction(w, p.id, {
    jurisdictionName: 'Testville PD', year: 2012, gangCount: 4, memberCount: 200, population: 50000,
  });
  const data = p.populationData.gangActivity;
  assert.equal(data.source, 'ojjdp-nygs');
  assert.ok(/2012/.test(data.staleness));
  assert.ok(/self-reported/.test(data.staleness));
  assert.equal(data.membershipRate, 0.004);
  assert.equal(p.populationData.containsIndividualAttributes, false);
});

test('describeGangCoverage reports the newest year in the import, against the real last survey wave', () => {
  const w = createWorldLayer();
  nygs.importNygsJurisdiction(w, place(w).id, { jurisdictionName: 'A', year: 2010, gangCount: 2 });
  nygs.importNygsJurisdiction(w, place(w).id, { jurisdictionName: 'B', year: 2012, memberCount: 100, population: 10000 });
  const report = nygs.describeGangCoverage(w);
  assert.equal(report.jurisdictions, 2);
  assert.equal(report.newestYear, 2012);
  assert.equal(report.lastRealSurveyYear, 2012);
});

test('fetchNygsData throws naming the block, like every importer in this registry', () => {
  assert.throws(nygs.fetchNygsData, (error) => {
    assert.ok(/not implemented/.test(error.message));
    assert.ok(/403 CONNECT|proxy allowlist/.test(error.message));
    return true;
  });
});
