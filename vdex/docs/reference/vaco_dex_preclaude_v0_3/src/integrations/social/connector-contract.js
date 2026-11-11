'use strict';

const CAPABILITIES = new Set(['share_link', 'oauth_connect', 'publish_text', 'publish_image', 'publish_video', 'campaign_analytics']);

function validateConnectorManifest(manifest) {
  const errors = [];
  if (!manifest || typeof manifest !== 'object') return { valid: false, errors: ['Manifest is required'] };
  if (!/^[a-z0-9_-]{2,40}$/.test(manifest.provider || '')) errors.push('Invalid provider key');
  if (!Array.isArray(manifest.capabilities)) errors.push('Capabilities must be an array');
  else for (const capability of manifest.capabilities) if (!CAPABILITIES.has(capability)) errors.push(`Unsupported capability: ${capability}`);
  if (!manifest.authMode || !['oauth2', 'share_intent', 'manual'].includes(manifest.authMode)) errors.push('Unsupported auth mode');
  return { valid: errors.length === 0, errors };
}

function buildCampaignShare({ campaignUrl, title, message, provider }) {
  if (typeof campaignUrl !== 'string' || !/^https:\/\//i.test(campaignUrl)) throw new Error('A secure HTTPS campaign URL is required');
  return { provider: provider || 'generic', title: String(title || '').slice(0, 120), message: String(message || '').slice(0, 2000), url: campaignUrl, requiresUserAction: true };
}

module.exports = { CAPABILITIES, validateConnectorManifest, buildCampaignShare };
