'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {verifyAccessToken,signTestToken}=require('../backend/authentication');
const secret='test-only-secret-that-is-at-least-thirty-two-bytes';
const base={sub:'user-1',org:'org-1',role:'acquisitions',membership_status:'active',iss:'vdex',aud:'vdex-api',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+300};
test('JWT verifier accepts a correctly signed active principal',()=>{const token=signTestToken(base,secret);assert.deepEqual(verifyAccessToken(token,secret,{issuer:'vdex',audience:'vdex-api'}),{userId:'user-1',organizationId:'org-1',role:'acquisitions',status:'active'});});
test('JWT verifier rejects bad signatures, expiry, issuer, audience and inactive membership',()=>{
 const token=signTestToken(base,secret);assert.throws(()=>verifyAccessToken(token,'wrong-secret'.padEnd(32,'x')),{status:401});
 assert.throws(()=>verifyAccessToken(signTestToken({...base,exp:1},secret),secret),{status:401});
 assert.throws(()=>verifyAccessToken(token,secret,{issuer:'other'}),{status:401});
 assert.throws(()=>verifyAccessToken(token,secret,{audience:'other'}),{status:401});
 assert.throws(()=>verifyAccessToken(signTestToken({...base,membership_status:'suspended'},secret),secret),{status:401});
 assert.throws(()=>verifyAccessToken(token,'short'),{status:503});
});
test('JWT verifier rejects unsupported algorithms and malformed claims',()=>{
 const enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url');
 const header=enc({alg:'none',typ:'JWT'}),body=enc(base),sig=crypto.createHmac('sha256',secret).update(`${header}.${body}`).digest('base64url');
 assert.throws(()=>verifyAccessToken(`${header}.${body}.${sig}`,secret),{status:401});
 assert.throws(()=>verifyAccessToken(signTestToken({...base,role:'root'},secret),secret),{status:401});
});
