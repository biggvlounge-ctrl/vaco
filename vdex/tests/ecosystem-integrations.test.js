'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {INTEGRATIONS,integrationStatus,listIntegrations,integrationSummary}=require('../backend/ecosystem-integrations');

test('integration registry covers required Vertical Vision services without merging app boundaries',()=>{
 const keys=new Set(INTEGRATIONS.map(x=>x.key));
 for(const key of ['vacay','dreams_network','vulcan','vaca','vash','vcoin','voken','vacon','void'])assert.ok(keys.has(key));
 const vacay=INTEGRATIONS.find(x=>x.key==='vacay');
 assert.ok(vacay.boundaries.some(x=>x.includes('separate application')));
 assert.ok(INTEGRATIONS.find(x=>x.key==='vulcan').boundaries.some(x=>x.includes('owns tokenization')));
 assert.ok(INTEGRATIONS.find(x=>x.key==='vcoin').boundaries.some(x=>x.includes('ledger')));
});

test('registry never treats environment configuration as a live connection',()=>{
 const configured={VDEX_VACAY_BASE_URL:'https://vacay.example.test',VDEX_VACAY_CONTRACT_ID:'contract-1',VDEX_VACAY_CREDENTIAL_REF:'vault://secret/1'};
 const status=integrationStatus(INTEGRATIONS.find(x=>x.key==='vacay'),configured);
 assert.equal(status.status,'configured_unverified');
 assert.equal(status.liveConnectionVerified,false);
 assert.deepEqual(status.missingFields,[]);
});

test('invalid non-HTTPS endpoint is not marked configured',()=>{
 const env={VDEX_VACA_BASE_URL:'http://identity.example.test',VDEX_VACA_CONTRACT_ID:'contract-1',VDEX_VACA_CREDENTIAL_REF:'vault://secret/1'};
 assert.equal(integrationStatus(INTEGRATIONS.find(x=>x.key==='vaca'),env).status,'configuration_invalid');
});

test('summary reports all services as not connected by default',()=>{
 const summary=integrationSummary({});
 assert.equal(summary.total,9);
 assert.equal(summary.liveConnected,0);
 assert.equal(summary.notConfigured,9);
 assert.equal(listIntegrations({}).length,9);
});
