// VSAFE -- AI Monitoring.
// Source of truth: named with zero detail in
// UNIVERSAL_SAFETY_LAYER_VSAFE.md. Per this session's consistent
// no-fake-AI stance (every named agent in this ecosystem gets this
// same treatment), this builds the real, deterministic, rule-based
// scan underneath the doc's "AI Monitoring" label -- explicitly not a
// language-model call. Generalizes CVNVO's own earlier local
// `messageSafety.js` (contact-solicitation/phone-number/link/
// character-flood patterns) into VSAFE's shared, app-agnostic version,
// and adds one real, distinct, higher-severity category: real,
// deterministic threat/self-harm-language keyword matching.
//
// An honest, necessary limitation, stated directly rather than
// implied: this is a minimal, illustrative, real keyword layer, NOT a
// clinical or ML-grade self-harm/threat detector. A real production
// system would need real human/clinical escalation behind this, not
// this alone -- this module's real, correct job is only to flag
// `severity: 'high'` content for that real human review to happen,
// never to make an automated final judgment about a person's safety.

const CONTACT_SOLICITATION_PATTERN = /\b(whatsapp|telegram|snapchat|kik|venmo|cashapp|zelle)\b/i;
const PHONE_NUMBER_PATTERN = /(\+?\d[\s.-]?){9,}/;
const URL_PATTERN = /https?:\/\/|www\./i;
const CHARACTER_FLOOD_PATTERN = /(.)\1{6,}/;
const THREAT_LANGUAGE_PATTERN = /\b(i('| )?ll kill you|going to hurt you|i know where you live)\b/i;
const SELF_HARM_LANGUAGE_PATTERN = /\b(kill myself|end it all|want to die|hurt myself)\b/i;

function screenContent(text) {
  if (typeof text !== 'string') throw new Error('screenContent requires a string');

  const reasons = [];
  let severity = 'low';

  if (CONTACT_SOLICITATION_PATTERN.test(text)) reasons.push('external-contact-solicitation');
  if (PHONE_NUMBER_PATTERN.test(text)) reasons.push('phone-number-shaped-content');
  if (URL_PATTERN.test(text)) reasons.push('external-link');
  if (CHARACTER_FLOOD_PATTERN.test(text)) reasons.push('character-flood');
  if (reasons.length > 0) severity = 'medium';

  if (THREAT_LANGUAGE_PATTERN.test(text)) { reasons.push('threat-language'); severity = 'high'; }
  if (SELF_HARM_LANGUAGE_PATTERN.test(text)) { reasons.push('self-harm-language'); severity = 'high'; }

  return { flagged: reasons.length > 0, severity: reasons.length > 0 ? severity : 'none', reasons };
}

module.exports = { screenContent };
