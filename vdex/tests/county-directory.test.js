'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {CATEGORIES,MISSOURI_COUNTY_EQUIVALENTS,listCountyEquivalents,coverageSummary}=require('../backend/county-directory');

test('Missouri county-equivalent pilot includes all 114 counties and St. Louis independent city',()=>{
  assert.equal(MISSOURI_COUNTY_EQUIVALENTS.length,115);
  assert.equal(new Set(MISSOURI_COUNTY_EQUIVALENTS.map(x=>x.geoid)).size,115);
  assert.ok(MISSOURI_COUNTY_EQUIVALENTS.some(x=>x.geoid==='29510'&&x.entityType==='independent_city'));
  assert.ok(MISSOURI_COUNTY_EQUIVALENTS.every(x=>x.geoid.startsWith('29')&&x.categories.length===9));
});

test('county directory supports GEOID/name and category/status filters without implying source coverage',()=>{
  assert.equal(listCountyEquivalents({q:'29510'}).length,1);
  assert.equal(listCountyEquivalents({q:'St. Louis'}).length,2);
  assert.equal(listCountyEquivalents({category:'assessor',status:'not_assessed'}).length,115);
  const summary=coverageSummary();
  assert.equal(summary.jurisdictions,115);
  assert.ok(summary.categories.every(x=>x.connected===0&&x.sourceLocated===0&&x.notAssessed===115));
});

test('national county geography is represented as a public Census source, not parcel ownership data',()=>{
  const catalog=require('../backend/data-catalog').DATASETS;
  const tiger=catalog.find(x=>x.key==='census_county_equiv_2026');
  assert.ok(tiger);
  assert.match(tiger.url,/TIGER2026\/COUNTY/);
  assert.ok(tiger.caveat.includes('does not contain assessor'));
  assert.equal(CATEGORIES.length,9);
});
