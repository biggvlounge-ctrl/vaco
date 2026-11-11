'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {YEAR,DATASET,VARIABLES,buildUrl,fetchCountyObservations,adapterStatus}=require('../backend/census-acs-adapter');

test('Census ACS request is constrained to a valid state and county geography',()=>{
 const url=new URL(buildUrl({stateFips:'29',countyFips:'189',apiKey:'test-key'}));
 assert.equal(url.origin,'https://api.census.gov');assert.equal(url.pathname,`/data/${YEAR}/${DATASET}`);
 assert.equal(url.searchParams.get('for'),'county:189');assert.equal(url.searchParams.get('in'),'state:29');
 assert.equal(url.searchParams.get('key'),'test-key');assert.ok(VARIABLES.includes('B01003_001M'));
 assert.throws(()=>buildUrl({stateFips:'2',apiKey:'x'}),/stateFips/);
 assert.throws(()=>buildUrl({stateFips:'29',countyFips:'18',apiKey:'x'}),/countyFips/);
});

test('Census ACS adapter maps estimates, margins of error and geography into provenance-ready observations',async()=>{
 const headers=['NAME','B01003_001E','B01003_001M','B25001_001E','B25001_001M','B25002_003E','B25002_003M','B25003_002E','B25003_002M','B25003_003E','B25003_003M','B19013_001E','B19013_001M','B25064_001E','B25064_001M','state','county'];
 const values=['St. Louis County, Missouri','1000','20','500','15','50','8','300','12','200','10','65000','2500','900','30','29','189'];
 let requested='';
 const result=await fetchCountyObservations({stateFips:'29',countyFips:'189',apiKey:'fixture-key',now:()=>new Date('2026-11-11T12:00:00.000Z'),fetchImpl:async(url,options)=>{requested=url;assert.equal(options.headers.Accept,'application/json');return {ok:true,status:200,json:async()=>[headers,values]};}});
 assert.ok(requested.includes('fixture-key'));assert.equal(result.observations.length,1);
 const item=result.observations[0];assert.equal(item.externalId,'2024-acs5-county-29189');assert.equal(item.geography.geoid,'29189');
 assert.equal(item.attributes.estimates.population.estimate,1000);assert.equal(item.attributes.estimates.population.marginOfError,20);
 assert.equal(item.attributes.estimates.vacancyRatePercent,10);assert.equal(item.attributes.estimates.medianHouseholdIncomeUsd.estimate,65000);
 assert.equal(result.metadata.vintage,2024);assert.equal(result.metadata.recordCount,1);
});

test('Census adapter fails closed without credentials and reports configuration without claiming a connection',async()=>{
 await assert.rejects(()=>fetchCountyObservations({stateFips:'29',apiKey:''}),e=>e.code==='CENSUS_API_KEY_MISSING');
 assert.equal(adapterStatus({configured:false}).connectionStatus,'not_verified');
 assert.equal(adapterStatus({configured:false}).configured,false);
});

test('Census sentinel and unavailable values are not interpreted as negative estimates',async()=>{
 const headers=['NAME','B01003_001E','B01003_001M','B25001_001E','B25001_001M','B25002_003E','B25002_003M','B25003_002E','B25003_002M','B25003_003E','B25003_003M','B19013_001E','B19013_001M','B25064_001E','B25064_001M','state','county'];
 const values=['Example County, Missouri','-666666666','-1','100','5','10','2','60','3','40','3','-888888888','-1','700','20','29','001'];
 const result=await fetchCountyObservations({stateFips:'29',apiKey:'x',fetchImpl:async()=>({ok:true,status:200,json:async()=>[headers,values]})});
 assert.equal(result.observations[0].attributes.estimates.population.estimate,null);
 assert.equal(result.observations[0].attributes.estimates.medianHouseholdIncomeUsd.estimate,null);
 assert.equal(result.observations[0].attributes.estimates.vacancyRatePercent,10);
});

test('Census adapter rejects HTTP and malformed responses',async()=>{
 await assert.rejects(()=>fetchCountyObservations({stateFips:'29',apiKey:'x',fetchImpl:async()=>({ok:false,status:429})}),e=>e.status===429);
 await assert.rejects(()=>fetchCountyObservations({stateFips:'29',apiKey:'x',fetchImpl:async()=>({ok:true,status:200,json:async()=>({bad:true})})}),e=>e.code==='CENSUS_INVALID_RESPONSE');
});
