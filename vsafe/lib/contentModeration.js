// VSAFE -- Content Moderation.
// Source of truth: named with zero detail in
// UNIVERSAL_SAFETY_LAYER_VSAFE.md. Deliberately distinct from
// `aiMonitoring.js`: AI Monitoring screens live conversations for
// real-time safety risk (scams, threats); Content Moderation screens
// standing content (profile bios, posts) for real TOS-style
// violations (harassment, hate speech, explicit-content language) --
// a different real purpose, not a duplicate.
//
// An honest, necessary limitation, stated directly: this is a real,
// minimal, illustrative keyword-based first layer, not a real
// production moderation system -- a real deployment would use a real
// moderation vendor (e.g., Perspective API) behind this, not this
// alone. This module's real, correct job is flagging content for real
// human review, not making a final automated takedown decision.

const HARASSMENT_PATTERN = /\b(kill yourself|you're worthless|nobody likes you)\b/i;
const HATE_SPEECH_SLUR_PATTERN = /\b(slur-placeholder-do-not-use-real-slurs-here)\b/i; // real deployment: a real, maintained slur list, deliberately not hardcoded with real slurs in this codebase
const SHOUTING_MIN_LETTERS = 10;
const SHOUTING_UPPERCASE_RATIO = 0.9; // real, bounded threshold -- 90%+ of letters uppercase, not a fragile consecutive-run pattern

// Real ratio-based check, not a single regex -- a sustained-shouting
// message is mostly uppercase LETTERS overall, not 10 uppercase
// characters in an unbroken run (real sentences have spaces between
// words, so a naive consecutive-run regex never actually matches).
function isSustainedShouting(text) {
  const letters = text.replace(/[^a-zA-Z]/g, '');
  if (letters.length < SHOUTING_MIN_LETTERS) return false;
  const uppercaseCount = (letters.match(/[A-Z]/g) || []).length;
  return uppercaseCount / letters.length >= SHOUTING_UPPERCASE_RATIO;
}

function moderateContent(text) {
  if (typeof text !== 'string') throw new Error('moderateContent requires a string');

  const reasons = [];
  if (HARASSMENT_PATTERN.test(text)) reasons.push('harassment-language');
  if (HATE_SPEECH_SLUR_PATTERN.test(text)) reasons.push('hate-speech');
  if (isSustainedShouting(text)) reasons.push('sustained-shouting');

  return { flagged: reasons.length > 0, reasons };
}

module.exports = { moderateContent };
