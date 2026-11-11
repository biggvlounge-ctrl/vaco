'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {DATASETS,JURISDICTIONS,listDatasets,normalizeImportRecord,findDuplicate}=require('../backend/data-catalog');

test('national data catalog spans parcel, distress, environmental, market and commercial domains',()=>{
  const categories=new Set(DATASETS.map(x=>x.category));
  for(const category of ['parcel_assessment','distress_acquisition','public_redevelopment','zoning_permits','environmental_compliance','demographics_market','commercial_real_estate','infrastructure_utilities']) assert.ok(categories.has(category),category);
  assert.ok(listDatasets({q:'land bank'}).some(x=>x.key==='land_bank_lra'));
  assert.ok(listDatasets({access:'contract_required'}).some(x=>x.key==='mls_idx'));
});

test('import normalization maps common public-record field aliases without carrying raw PII',()=>{
  const dataset=DATASETS.find(x=>x.key==='county_assessor');
  const item=normalizeImportRecord({OBJECTID:17,APN:'12-34',county:'St Louis County',address:'10 Main St',city:'Florissant',state:'mo',assessed_value:'$125,000',owner_name:'Private Person',owner_email:'person@example.com'},dataset);
  assert.equal(item.externalRecordId,'17');
  assert.equal(item.parcelIdentifier,'12-34');
  assert.equal(item.state,'MO');
  assert.equal(item.assessedValue,125000);
  assert.equal(item.ownerName,undefined);
  assert.equal(item.rawFieldNames.includes('owner_email'),true);
});

test('staging duplicate detection prioritizes jurisdiction plus parcel id',()=>{
  const dataset=DATASETS.find(x=>x.key==='county_assessor');
  const item=normalizeImportRecord({APN:'12-34',county:'St Louis County',address:'Different address',city:'Florissant',state:'MO'},dataset);
  const match=findDuplicate(item,[{id:'prop-1',parcelIdentifier:'1234',parcelJurisdiction:'st louis county',address:'Old address',city:'Other',state:'MO'}]);
  assert.deepEqual(match,{propertyId:'prop-1',matchType:'parcel_identifier'});
});

test('jurisdiction scaffold includes all 50 states, DC and five inhabited territories',()=>{
  assert.equal(JURISDICTIONS.length,56);
  assert.ok(JURISDICTIONS.some(x=>x.code==='MO'));
  assert.ok(JURISDICTIONS.some(x=>x.code==='DC'));
  assert.ok(JURISDICTIONS.some(x=>x.code==='PR'));
  assert.ok(JURISDICTIONS.every(x=>x.coverageStatus==='not_assessed'));
});
