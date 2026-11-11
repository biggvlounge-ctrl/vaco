'use strict';
const test=require('node:test');const assert=require('node:assert/strict');const {spawn}=require('node:child_process');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');const {signTestToken}=require('../backend/authentication');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'vdex-auth-test-'));const port=Number(51000+Math.floor(Math.random()*8000));const secret='auth-route-test-secret-with-at-least-32-bytes';let child,base;
const token=(role='owner',sub='owner-1',org='org-test')=>signTestToken({sub,org,role,membership_status:'active',iss:'vdex',aud:'vdex-api',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+300},secret);
async function req(route,options={}){const headers={'content-type':'application/json',...(options.token?{authorization:`Bearer ${options.token}`}:{})};const r=await fetch(base+route,{method:options.method||'GET',headers,body:options.body?JSON.stringify(options.body):undefined});return {status:r.status,body:await r.json()};}
test('required auth mode protects private APIs and gates workforce review',async t=>{
 child=spawn(process.execPath,['backend/server.js'],{cwd:path.join(__dirname,'..'),env:{...process.env,PORT:String(port),VDEX_DB_PATH:path.join(temp,'db.json'),VDEX_AUTH_MODE:'required',VDEX_SELLER_INTAKE_ORG_ID:'org-alpha',VDEX_JWT_SECRET:secret,VDEX_JWT_ISSUER:'vdex',VDEX_JWT_AUDIENCE:'vdex-api'},stdio:'ignore'});base=`http://127.0.0.1:${port}`;
 for(let i=0;i<50;i++){try{const r=await fetch(base+'/api/health');if(r.ok)break}catch{}await new Promise(x=>setTimeout(x,100));}
 t.after(()=>{child.kill();fs.rmSync(temp,{recursive:true,force:true});});
 assert.equal((await req('/api/health')).status,200);
 assert.equal((await req('/api/summary')).status,401);
 assert.equal((await req('/api/summary',{token:token('viewer')})).status,403);
 const registeredSource=await req('/api/acquisition-sources',{method:'POST',token:token('acquisitions','acq-a','org-alpha'),body:{name:'County assessor',sourceType:'county_assessor',jurisdiction:'St. Louis County, MO',referenceUrl:'https://example.gov/assessor',licenseScope:'Pending review'}});assert.equal(registeredSource.status,201);assert.equal(registeredSource.body.item.status,'pending_authorization');assert.equal(registeredSource.body.item.adapterImplemented,false);
 assert.equal((await req('/api/acquisition-sources',{token:token('owner','owner-b','org-beta')})).body.total,0);
 assert.equal((await req(`/api/acquisition-sources/${registeredSource.body.item.id}/authorize`,{method:'PATCH',token:token('acquisitions','acq-a','org-alpha'),body:{confirmAuthorization:true,authorizationEvidenceUrl:'https://example.gov/terms',confirmedLicenseScope:'Parcel data'}})).status,403);
 const authorizedSource=await req(`/api/acquisition-sources/${registeredSource.body.item.id}/authorize`,{method:'PATCH',token:token('admin','admin-a','org-alpha'),body:{confirmAuthorization:true,authorizationEvidenceUrl:'https://example.gov/terms',confirmedLicenseScope:'Parcel data for internal analysis'}});assert.equal(authorizedSource.status,200);assert.equal(authorizedSource.body.item.status,'authorized_not_connected');assert.equal(authorizedSource.body.item.connectionStatus,'not_connected');
 assert.equal((await req(`/api/acquisition-sources/${registeredSource.body.item.id}/authorize`,{method:'PATCH',token:token('admin','admin-b','org-beta'),body:{confirmAuthorization:true,authorizationEvidenceUrl:'https://example.gov/terms',confirmedLicenseScope:'Parcel data'}})).status,404);

 assert.equal((await req('/api/auth/session',{token:token()})).body.principal.organizationId,'org-test');
 const property=await req('/api/properties',{method:'POST',token:token('owner','owner-1','org-alpha'),body:{title:'Alpha parcel',address:'100 Main Street',city:'St Louis',state:'MO',propertyType:'Land',tenantId:'org-forged'}});assert.equal(property.status,201);assert.equal(property.body.item.tenantId,'org-alpha');
 assert.equal((await req('/api/properties',{token:token('owner','owner-2','org-beta')})).body.total,0);
 assert.equal((await req(`/api/properties/${property.body.item.id}`,{token:token('owner','owner-2','org-beta')})).status,404);
 assert.equal((await req('/api/summary',{token:token('owner','owner-2','org-beta')})).body.properties,0);
 assert.equal((await req('/api/buyer-mandates',{token:token('owner','owner-2','org-beta')})).body.total,0);
 assert.equal((await req(`/api/properties/${property.body.item.id}/dna`,{token:token('owner','owner-2','org-beta')})).status,404);
 const job=await req('/api/jobs',{method:'POST',token:token('workforce_manager'),body:{title:'Property Photographer',category:'Photography',description:'Take property photos with permission.'}});assert.equal(job.status,201);
 const application=await req(`/api/jobs/${job.body.item.id}/applications`,{method:'POST',body:{applicantName:'Applicant',contactEmail:'applicant@example.com',consent:true}});assert.equal(application.status,201);
 assert.equal((await req(`/api/jobs/${job.body.item.id}/applications`,{token:token('workforce_manager','manager-b','org-beta')})).status,404);
 assert.equal((await req(`/api/job-applications/${application.body.item.id}/review`,{method:'PATCH',token:token('workforce_manager','manager-b','org-beta'),body:{status:'Reviewing'}})).status,404);
 const seller=await req('/api/seller-leads',{method:'POST',body:{propertyAddress:'99 Intake Road',contactPreference:'Email',consent:true}});assert.equal(seller.status,201);assert.equal(seller.body.item.tenantId,'org-alpha');
 assert.equal((await req('/api/seller-leads',{token:token('acquisitions','buyer-b','org-beta')})).body.total,0);
 assert.equal((await req('/api/seller-leads',{token:token('acquisitions','buyer-a','org-alpha')})).body.total,1);
 assert.equal((await req(`/api/seller-leads/${seller.body.item.id}/review`,{method:'PATCH',token:token('acquisitions','buyer-b','org-beta'),body:{status:'Under review'}})).status,404);
 const sellerReview=await req(`/api/seller-leads/${seller.body.item.id}/review`,{method:'PATCH',token:token('acquisitions','buyer-a','org-alpha'),body:{status:'Qualified lead',reviewNote:'Owner requested email follow-up.'}});assert.equal(sellerReview.status,200);assert.equal(sellerReview.body.item.status,'Qualified lead');
 const withdrawnSeller=await req('/api/seller-leads',{method:'POST',body:{propertyAddress:'100 Intake Road',contactPreference:'Email',consent:true}});assert.equal(withdrawnSeller.status,201);
 const withdrawSeller=await req(`/api/seller-leads/${withdrawnSeller.body.item.id}/withdraw-consent`,{method:'POST',body:{confirm:true,withdrawalToken:withdrawnSeller.body.withdrawalToken}});assert.equal(withdrawSeller.status,200);
 assert.equal((await req(`/api/seller-leads/${withdrawnSeller.body.item.id}/review`,{method:'PATCH',token:token('acquisitions','buyer-a','org-alpha'),body:{status:'Qualified lead'}})).status,409);
 assert.equal((await req(`/api/seller-leads/${withdrawnSeller.body.item.id}/review`,{method:'PATCH',token:token('acquisitions','buyer-a','org-alpha'),body:{status:'Closed'}})).status,200);
 assert.equal((await req(`/api/jobs/${job.body.item.id}/applications`,{token:token('worker')})).status,403);
 const list=await req(`/api/jobs/${job.body.item.id}/applications`,{token:token('workforce_manager')});assert.equal(list.status,200);assert.equal(list.body.total,1);assert.equal(list.body.items[0].applicantName,'Applicant');
 const denied=await req(`/api/job-applications/${application.body.item.id}/review`,{method:'PATCH',token:token('worker'),body:{status:'Shortlisted'}});assert.equal(denied.status,403);
 const reviewed=await req(`/api/job-applications/${application.body.item.id}/review`,{method:'PATCH',token:token('workforce_manager'),body:{status:'Shortlisted'}});assert.equal(reviewed.status,200);assert.equal(reviewed.body.item.status,'Shortlisted');
 const invalid=await req(`/api/job-applications/${application.body.item.id}/review`,{method:'PATCH',token:token('workforce_manager'),body:{status:'Hired'}});assert.equal(invalid.status,400);
});
