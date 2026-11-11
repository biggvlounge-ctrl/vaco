'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {LOCAL_SOURCES,listLocalSources}=require('../backend/local-source-inventory');

test('St. Louis pilot directory contains official city and county discovery portals',()=>{
  assert.ok(LOCAL_SOURCES.length>=8);
  assert.ok(LOCAL_SOURCES.some(x=>x.id==='stl-city-lra-open-data'&&x.formats.includes('CSV')));
  assert.ok(LOCAL_SOURCES.some(x=>x.id==='stl-county-gis-open-data'&&x.category==='gis_parcels'));
  assert.ok(LOCAL_SOURCES.every(x=>x.url.startsWith('https://')&&x.status==='discovered'&&x.rightsStatus==='review_required'));
});

test('local source directory filters by state, jurisdiction and category',()=>{
  assert.equal(listLocalSources({state:'mo'}).length,8);
  assert.equal(listLocalSources({jurisdiction:'St. Louis County'}).length,2);
  assert.equal(listLocalSources({category:'land_bank_redevelopment'}).length,2);
  assert.ok(listLocalSources({q:'garden permits'}).some(x=>x.id==='stl-city-lra-open-data'));
});
