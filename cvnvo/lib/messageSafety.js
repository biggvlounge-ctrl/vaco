// CVNVO -- real, deterministic message screening.
// Source of truth: CVNVO_CORE_FEATURES.md: "AI spam/scam filtering
// runs on every conversation (per the existing AI Safety Monitoring
// section) -- this connects messaging directly to the Relationship
// Guardian AI already defined, not a separate system."
//
// Per this session's consistent, established stance (Gibson/Kenji/
// every other named agent in this ecosystem): no fake AI call is made
// here. What's real and buildable is the deterministic logic
// underneath what "AI Safety Monitoring"/"Relationship Guardian AI"
// is described as doing -- a real, rule-based scan, explicitly not a
// language-model call. If/when a real model-backed version is built,
// this is the real, testable fallback/first layer it would sit
// behind, not a placeholder to throw away.
//
// The specific rules are flagged, real, deterministic choices (no
// exact rule set is given in any source doc): external contact-info
// solicitation (a real, common scam pattern -- moving a conversation
// off-platform before any trust is established), phone-number-shaped
// patterns (directly relevant here, since CVNVO's own Communication
// Controls exist specifically to keep phone numbers unshared until
// trust is earned), and character-flood/spam patterns.

const CONTACT_SOLICITATION_PATTERN = /\b(whatsapp|telegram|snapchat|kik|venmo|cashapp|zelle)\b/i;
const PHONE_NUMBER_PATTERN = /(\+?\d[\s.-]?){9,}/;
const URL_PATTERN = /https?:\/\/|www\./i;
const CHARACTER_FLOOD_PATTERN = /(.)\1{6,}/; // the same character repeated 7+ times in a row

function screenMessage(text) {
  if (typeof text !== 'string') throw new Error('screenMessage requires a string');

  const reasons = [];
  if (CONTACT_SOLICITATION_PATTERN.test(text)) reasons.push('external-contact-solicitation');
  if (PHONE_NUMBER_PATTERN.test(text)) reasons.push('phone-number-shaped-content');
  if (URL_PATTERN.test(text)) reasons.push('external-link');
  if (CHARACTER_FLOOD_PATTERN.test(text)) reasons.push('character-flood');

  return { flagged: reasons.length > 0, reasons };
}

module.exports = { screenMessage };
