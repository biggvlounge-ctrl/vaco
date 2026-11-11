'use strict';

// Contract-first integration registry. Configuration is never treated as proof
// of a live connection; adapters remain disabled until a provider contract and
// an authenticated, end-to-end health check are implemented.
const INTEGRATIONS = Object.freeze([
  { key:'vacay', name:'VACAY', purpose:'Authorized property and vehicle listing discovery, seller/owner workflows, leads, inquiries, viewing requests and transaction handoffs.', envPrefix:'VDEX_VACAY', required:['BASE_URL','CONTRACT_ID','CREDENTIAL_REF'], capabilities:['listings.read','listings.publish_draft','leads.handoff','inquiries.handoff','viewings.request','transactions.handoff'], boundaries:['VDEX remains a separate application.','Only authorized listings and purpose-limited records may be shared.','VACAY remains the listing/marketplace system of record.'] },
  { key:'dreams_network', name:'DREAMS Network', purpose:'Approved project distribution, discovery, community visibility and referral handoffs.', envPrefix:'VDEX_DREAMS', required:['BASE_URL','CONTRACT_ID','CREDENTIAL_REF'], capabilities:['projects.publish_draft','projects.discover','referrals.handoff'], boundaries:['Publishing requires human approval and rights review.','No social connector or live DREAMS endpoint is assumed.'] },
  { key:'vulcan', name:'VULCAN', purpose:'Approved property and development-project tokenization requests and status handoffs.', envPrefix:'VDEX_VULCAN', required:['BASE_URL','CONTRACT_ID','CREDENTIAL_REF'], capabilities:['tokenization.request','tokenization.status.read'], boundaries:['VULCAN owns tokenization and token issuance.','No security/token offering or transfer occurs from VDEX.','Legal, issuer and asset approvals remain mandatory.'] },
  { key:'vaca', name:'VACA', purpose:'Identity, person and organization verification.', envPrefix:'VDEX_VACA', required:['BASE_URL','CONTRACT_ID','CREDENTIAL_REF'], capabilities:['identity.verify','organization.verify'], boundaries:['VDEX must not create a replacement identity provider.','Only minimum necessary verification results should be retained.'] },
  { key:'vash', name:'VASH', purpose:'Authorized financing workflow and financial-service handoffs.', envPrefix:'VDEX_VASH', required:['BASE_URL','CONTRACT_ID','CREDENTIAL_REF'], capabilities:['financing.referral','financing.status.read'], boundaries:['VASH owns financial products and underwriting.','VDEX does not originate credit or represent prequalification as approval.'] },
  { key:'vcoin', name:'VCoin', purpose:'Approved settlement references and payment-status handoffs.', envPrefix:'VDEX_VCOIN', required:['BASE_URL','CONTRACT_ID','CREDENTIAL_REF'], capabilities:['settlement.request','settlement.status.read'], boundaries:['VCoin remains the settlement ledger.','No local wallet, balance or ledger is created.','Money movement requires explicit authorization and production controls.'] },
  { key:'voken', name:'VOKEN', purpose:'Supported credential, trust-history and verification references.', envPrefix:'VDEX_VOKEN', required:['BASE_URL','CONTRACT_ID','CREDENTIAL_REF'], capabilities:['credential.reference','trust_history.read'], boundaries:['VOKEN remains authoritative for supported credentials.','A reference is not a substitute for professional license verification.'] },
  { key:'vacon', name:'VACO / VACON', purpose:'App registration, account context and approved AI/orchestration services.', envPrefix:'VDEX_VACON', required:['BASE_URL','CONTRACT_ID','CREDENTIAL_REF'], capabilities:['app.registration','account.context','ai.orchestration'], boundaries:['VACO/VACON remain platform and orchestration layers.','No duplicate identity, wallet, ledger or token factory.'] },
  { key:'void', name:'VOID', purpose:'Approved cross-app discovery and service referrals.', envPrefix:'VDEX_VOID', required:['BASE_URL','CONTRACT_ID','CREDENTIAL_REF'], capabilities:['discovery.referral','service.referral'], boundaries:['Only approved, rights-cleared discovery records are shared.','VOID is not merged into VDEX.'] }
]);

function integrationStatus(item, env=process.env) {
  const present = item.required.filter(key => typeof env[`${item.envPrefix}_${key}`] === 'string' && env[`${item.envPrefix}_${key}`].trim());
  const missing = item.required.filter(key => !present.includes(key));
  const baseUrl = env[`${item.envPrefix}_BASE_URL`];
  let validBaseUrl = false;
  if (baseUrl) { try { const u = new URL(baseUrl); validBaseUrl = u.protocol === 'https:'; } catch {} }
  const status = missing.length ? 'not_configured' : validBaseUrl ? 'configured_unverified' : 'configuration_invalid';
  return { key:item.key, name:item.name, purpose:item.purpose, status, configuredFields:present, missingFields:missing, capabilities:[...item.capabilities], boundaries:[...item.boundaries], liveConnectionVerified:false, note: status === 'configured_unverified' ? 'Configuration is present, but no authenticated provider health check or end-to-end transaction has been performed.' : status === 'configuration_invalid' ? 'A valid HTTPS base URL is required; configuration is not usable.' : 'Provider contract, endpoint and secret reference are not fully configured. No live connection is implied.' };
}
function listIntegrations(env=process.env) { return INTEGRATIONS.map(item=>integrationStatus(item,env)); }
function integrationSummary(env=process.env) {
  const items=listIntegrations(env);
  return { total:items.length, notConfigured:items.filter(x=>x.status==='not_configured').length, configuredUnverified:items.filter(x=>x.status==='configured_unverified').length, configurationInvalid:items.filter(x=>x.status==='configuration_invalid').length, liveConnected:0, items, notice:'Contract-first registry only. No external service is connected or called by this registry.' };
}
module.exports={INTEGRATIONS,integrationStatus,listIntegrations,integrationSummary};
