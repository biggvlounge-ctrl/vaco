'use strict';
const crypto = require('node:crypto');
const { generateTopThree } = require('./domain/highlights');

const ASSESSMENT_TYPES = new Set(['environmental','water','historic','building_safety','zoning','special_use']);
const SCENARIO_STATUSES = new Set(['concept','under_review','professionally_reviewed','approved','rejected']);
const now = () => new Date().toISOString();
const id = prefix => `${prefix}-${crypto.randomUUID()}`;
const clean = (v, max=2000) => String(v ?? '').trim().slice(0,max);

function ensureCollections(db) {
  for (const key of ['propertyEvidence','propertyHighlights','propertyAssessments','developmentScenarios']) {
    if (!Array.isArray(db[key])) db[key] = [];
  }
  return db;
}
function propertyExists(db, propertyId) { return (db.properties || []).some(p => p.id === propertyId); }
function validHttpUrl(value) {
  if (!value) return true;
  try { return ['http:','https:'].includes(new URL(value).protocol); } catch { return false; }
}
function addEvidence(db, propertyId, body) {
  ensureCollections(db);
  if (!body || !clean(body.statement) || !clean(body.category,80) || !clean(body.sourceName,160)) throw new Error('statement, category and sourceName are required');
  if (!validHttpUrl(body.sourceUrl)) throw new Error('sourceUrl must be a valid HTTP or HTTPS URL');
  const allowed = new Set(['verified','reported','estimated','inferred','conflicting','unverified','unavailable']);
  const status = body.status || 'unverified';
  if (!allowed.has(status)) throw new Error('Invalid evidence status');
  const item = {
    id: id('evidence'), propertyId, category: clean(body.category,80), statement: clean(body.statement), status,
    source: { name: clean(body.sourceName,160), sourceType: clean(body.sourceType || 'user_submitted',80), sourceUrl: clean(body.sourceUrl,1000), retrievedAt: now(), publicationDate: clean(body.publicationDate,80), jurisdiction: clean(body.jurisdiction,160) },
    confidence: Number.isFinite(Number(body.confidence)) ? Math.max(0,Math.min(1,Number(body.confidence))) : 0,
    limitations: Array.isArray(body.limitations) ? body.limitations.map(x=>clean(x,300)).slice(0,20) : [], createdAt: now()
  };
  db.propertyEvidence.unshift(item);
  return item;
}
function listEvidence(db, propertyId) { ensureCollections(db); return db.propertyEvidence.filter(x=>x.propertyId===propertyId); }
function saveHighlights(db, propertyId, candidates) {
  ensureCollections(db);
  const evidence = new Set(listEvidence(db,propertyId).map(x=>x.id));
  const safe = (Array.isArray(candidates) ? candidates : []).map(c => ({...c, evidenceIds: (c.evidenceIds||[]).filter(x=>evidence.has(x))}));
  const version = db.propertyHighlights.filter(x=>x.propertyId===propertyId).reduce((m,x)=>Math.max(m,x.version||0),0)+1;
  const result = generateTopThree(propertyId, safe, {version});
  db.propertyHighlights.unshift(...result);
  return result;
}
function latestHighlights(db, propertyId) {
  ensureCollections(db);
  const all = db.propertyHighlights.filter(x=>x.propertyId===propertyId);
  if (!all.length) return [];
  const version = Math.max(...all.map(x=>x.version||0));
  return all.filter(x=>x.version===version).sort((a,b)=>a.id.localeCompare(b.id));
}
function addAssessment(db, propertyId, body) {
  ensureCollections(db);
  if (!ASSESSMENT_TYPES.has(body.type)) throw new Error('Unsupported assessment type');
  if (!clean(body.status,80)) throw new Error('status is required');
  const item = { id:id('assessment'), propertyId, type:body.type, status:clean(body.status,80), summary:clean(body.summary), findings:Array.isArray(body.findings)?body.findings.map(x=>clean(x,1000)).slice(0,100):[], evidenceIds:Array.isArray(body.evidenceIds)?body.evidenceIds.filter(x=>listEvidence(db,propertyId).some(e=>e.id===x)):[], professionalReviewRequired:body.professionalReviewRequired===true, createdAt:now() };
  db.propertyAssessments.unshift(item);
  return item;
}
function addDevelopmentScenario(db, propertyId, body) {
  ensureCollections(db);
  if (!clean(body.name,120) || !clean(body.proposedUse,120)) throw new Error('name and proposedUse are required');
  const numeric = ['landCost','constructionCost','softCosts','contingency','financingCost','operatingCost','expectedRevenue','units','scheduleMonths'];
  const assumptions = {};
  for (const key of numeric) {
    if (body.assumptions?.[key] === undefined || body.assumptions[key] === null || body.assumptions[key] === '') continue;
    const n = Number(body.assumptions[key]);
    if (!Number.isFinite(n) || n < 0) throw new Error(`${key} must be a non-negative number`);
    assumptions[key] = n;
  }
  const status = body.status || 'concept';
  if (!SCENARIO_STATUSES.has(status)) throw new Error('Invalid scenario status');
  const item = { id:id('scenario'), propertyId, name:clean(body.name,120), proposedUse:clean(body.proposedUse,120), assumptions, constraints:Array.isArray(body.constraints)?body.constraints.map(x=>clean(x,500)).slice(0,50):[], approvalsRequired:Array.isArray(body.approvalsRequired)?body.approvalsRequired.map(x=>clean(x,300)).slice(0,50):[], status, createdAt:now(), updatedAt:now() };
  db.developmentScenarios.unshift(item);
  return item;
}

/** Framework-neutral handler. Supply the existing project's db object and writeDb callback. */
async function handlePropertyIntelligence({method, pathname, body, db, writeDb}) {
  ensureCollections(db);
  const match = pathname.match(/^\/api\/properties\/([^/]+)\/(evidence|highlights|assessments|development-scenarios)(?:\/generate)?$/);
  if (!match) return null;
  const propertyId = decodeURIComponent(match[1]);
  const resource = match[2];
  if (!propertyExists(db,propertyId)) return {status:404,body:{error:'Property not found'}};
  try {
    if (method==='GET' && resource==='evidence') return {status:200,body:{items:listEvidence(db,propertyId)}};
    if (method==='POST' && resource==='evidence') { const item=addEvidence(db,propertyId,body); writeDb(db); return {status:201,body:{item}}; }
    if (method==='GET' && resource==='highlights') return {status:200,body:{items:latestHighlights(db,propertyId),history:db.propertyHighlights.filter(x=>x.propertyId===propertyId)}};
    if (method==='POST' && resource==='highlights') { const items=saveHighlights(db,propertyId,body.candidates); writeDb(db); return {status:201,body:{items}}; }
    if (method==='GET' && resource==='assessments') return {status:200,body:{items:db.propertyAssessments.filter(x=>x.propertyId===propertyId)}};
    if (method==='POST' && resource==='assessments') { const item=addAssessment(db,propertyId,body); writeDb(db); return {status:201,body:{item}}; }
    if (method==='GET' && resource==='development-scenarios') return {status:200,body:{items:db.developmentScenarios.filter(x=>x.propertyId===propertyId)}};
    if (method==='POST' && resource==='development-scenarios') { const item=addDevelopmentScenario(db,propertyId,body); writeDb(db); return {status:201,body:{item}}; }
    return {status:405,body:{error:'Method not allowed'}};
  } catch (error) { return {status:400,body:{error:error.message}}; }
}
module.exports = { ensureCollections, addEvidence, listEvidence, saveHighlights, latestHighlights, addAssessment, addDevelopmentScenario, handlePropertyIntelligence };
