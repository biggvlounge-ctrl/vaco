// VSAFE -- Security Features (the doc's general catch-all bucket).
// Source of truth: named with zero detail in
// UNIVERSAL_SAFETY_LAYER_VSAFE.md. With ID verification, communication
// controls, and privacy controls already covering the other, more
// specific real security concerns, the one real, distinct, well-known
// safety-app pattern left for a general "security features" bucket is
// a **safety word / duress code**: a real, established pattern from
// real domestic-violence-safety tooling -- a secret word that, if
// given, silently signals distress without alerting anyone who might
// be coercing the user in the moment.
//
// Real code reuse, not a parallel emergency system: a matched safety
// word calls straight into `safetyCheckIn.js`'s own real
// `triggerEmergency()` against the user's most recent active
// check-in, the same real escalation path a manual panic button uses.
// The word itself is stored as a real SHA-256 hash (Node's own
// `crypto`, the same real-hygiene instinct as VOID's
// `crypto.randomBytes` access codes), never plaintext.

const crypto = require('crypto');
const { triggerEmergency } = require('./safetyCheckIn');

function hashWord(word) {
  return crypto.createHash('sha256').update(word.trim().toLowerCase()).digest('hex');
}

function setSafetyWord(store, options = {}) {
  const { userId, word } = options;
  if (!userId) throw new Error('setSafetyWord requires a userId');
  if (!word || word.trim().length < 3) throw new Error('setSafetyWord requires a real word of at least 3 characters');

  const record = { userId, wordHash: hashWord(word), setAt: Date.now() };
  const existingIndex = store.safetyWords.findIndex((w) => w.userId === userId);
  if (existingIndex >= 0) store.safetyWords[existingIndex] = record;
  else store.safetyWords.push(record);
  return { userId, setAt: record.setAt };
}

// Real, silent escalation: if the word matches, the user's most
// recent real, still-active check-in is genuinely escalated via the
// same real emergency path a manual trigger uses -- no separate,
// parallel alert mechanism invented here.
function checkSafetyWord(store, options = {}) {
  const { userId, inputWord, now = Date.now() } = options;
  if (!userId) throw new Error('checkSafetyWord requires a userId');
  if (!inputWord) throw new Error('checkSafetyWord requires an inputWord');

  const record = store.safetyWords.find((w) => w.userId === userId);
  if (!record) return { matched: false, escalated: false };
  const matched = record.wordHash === hashWord(inputWord);
  if (!matched) return { matched: false, escalated: false };

  const activeCheckIn = store.safetyCheckIns
    .filter((c) => c.userId === userId && c.status === 'active')
    .sort((a, b) => b.createdAt - a.createdAt)[0];
  if (!activeCheckIn) return { matched: true, escalated: false };

  triggerEmergency(store, { checkInId: activeCheckIn.id, now });
  return { matched: true, escalated: true, checkInId: activeCheckIn.id };
}

module.exports = { setSafetyWord, checkSafetyWord };
