'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { validateProperty, validateEvidence } = require('../src/validation/validators');
const { createPropertyDNA } = require('../src/domain/property');
const { generateTopThree } = require('../src/domain/highlights');
const { calculateOpportunityScore } = require('../src/domain/scoring');
const { calculateScenario } = require('../src/domain/development');

test('Property DNA preserves above-grade and below-grade areas separately', () => {
  const dna = createPropertyDNA({id:'p1',propertyType:'residential',measurements:{aboveGradeFinishedArea:1500,belowGradeFinishedArea:700,belowGradeUnfinishedArea:300}});
  assert.equal(dna.property.measurements.aboveGradeFinishedArea,1500);
  assert.equal(dna.property.measurements.belowGradeFinishedArea,700);
  assert.equal(dna.property.measurements.belowGradeUnfinishedArea,300);
});
test('property validation rejects negative areas and unsupported types', () => {
  assert.throws(()=>validateProperty({id:'p',propertyType:'residential',measurements:{parcelArea:-1}}));
  assert.throws(()=>validateProperty({id:'p',propertyType:'spaceship'}));
});
test('evidence validates provenance, confidence, and URL scheme', () => {
  const e = validateEvidence({id:'e1',propertyId:'p1',statement:'County record reviewed',status:'verified',confidence:.9,source:{name:'County',retrievedAt:'2026-11-07T00:00:00Z',sourceUrl:'https://example.gov'}});
  assert.equal(e.status,'verified');
  assert.throws(()=>validateEvidence({id:'e2',propertyId:'p1',statement:'Bad URL',status:'verified',source:{name:'X',retrievedAt:'now',sourceUrl:'javascript:alert(1)'}}));
});
test('three highlights always returned and unsupported slots disclose missing evidence', () => {
  const h = generateTopThree('p1',[{headline:'Flood record',explanation:'A reviewed record identifies flood exposure.',category:'risk_consideration',evidenceIds:['e1'],priority:10,confidence:.95}]);
  assert.equal(h.length,3);
  assert.equal(h[0].headline,'Flood record');
  assert.equal(h[1].verificationStatus,'insufficient_information');
  assert.deepEqual(h[1].evidenceIds,[]);
});
test('highlight generator rejects factual candidates without evidence', () => {
  const h = generateTopThree('p1',[{headline:'Great investment',explanation:'High returns',category:'opportunity',evidenceIds:[]}]);
  assert.equal(h[0].verificationStatus,'insufficient_information');
});
test('opportunity score ignores missing dimensions and keeps blocking risks visible', () => {
  const s = calculateOpportunityScore([{key:'comps',score:80,weight:2,confidence:.8,status:'available'},{key:'water',weight:1,confidence:0,status:'missing'}],['Potential contamination']);
  assert.equal(s.overallScore,80);
  assert.equal(s.confidence,.8);
  assert.equal(s.blockingRisks[0],'Potential contamination');
});
test('development scenario calculates transparent cost and net estimate', () => {
  const s = calculateScenario({landCost:100000,hardCosts:250000,softCosts:30000,contingency:25000,expectedRevenue:500000,operatingCosts:10000});
  assert.equal(s.totalDevelopmentCost,405000);
  assert.equal(s.projectedNetBeforeTax,85000);
  assert.equal(s.assumptionsOnly,true);
});
test('development scenario rejects negative assumptions', () => {
  assert.throws(()=>calculateScenario({hardCosts:-1}));
});
