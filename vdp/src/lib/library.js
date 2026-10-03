// VDP — what a purchased book actually does.
//
// VENVS's real Publishing arm (`venvs/src/lib/catalog.js`) stays the
// only place a book is bought and paid for — that's unchanged. This
// is the other half of the same split every cross-app integration in
// this repo already uses (VAGO owns the casino's money, VDP owns the
// venue; here VENVS owns the purchase, VDP owns the narrative effect):
// once VENVS tells VDP a real purchase happened
// (`POST /api/library/record`, service-authenticated — see
// `server.cjs`), this module applies the ONE real effect a book has,
// exactly once per order id.
//
// A book is tagged with either a `skillSubject` (a practical
// textbook — cooking, construction, mechanics) or a `beliefTopic` +
// `beliefType` (an influence/philosophy book — *The Secret*,
// *The Bible*). Never both; a book teaches a trade or moves a
// conviction, not both at once, which keeps the effect legible rather
// than a pile of simultaneous nudges for one purchase.

import { gainFromTextbook } from './skills.js';
import { shiftBelief } from './beliefs.js';

export const TEXTBOOK_BELIEF_SHIFT = 8;

export function createLibrary() {
  return { books: [], appliedOrderIds: [] };
}

// Idempotent per order id — VENVS may retry a failed delivery, and a
// book's effect must land once, the same discipline V3's idempotency
// keys use for a transfer.
export function applyBookEffect(library, player, { orderId, title, skillSubject, beliefTopic, beliefType } = {}) {
  if (!orderId) throw new Error('applyBookEffect requires an orderId');
  if (library.appliedOrderIds.includes(orderId)) {
    return { orderId, applied: false, reason: 'already applied' };
  }
  if (!skillSubject && !(beliefTopic && beliefType)) {
    throw new Error('applyBookEffect requires either skillSubject, or both beliefTopic and beliefType');
  }

  let effect;
  if (skillSubject) {
    const level = gainFromTextbook(player.skills, skillSubject);
    effect = { kind: 'skill', skill: skillSubject, level };
  } else {
    const strength = shiftBelief(player.beliefs, beliefTopic, beliefType, TEXTBOOK_BELIEF_SHIFT);
    effect = { kind: 'belief', topic: beliefTopic, beliefType, strength };
  }

  library.appliedOrderIds.push(orderId);
  library.books.push({ orderId, title, effect, readAt: Date.now() });
  return { orderId, applied: true, effect };
}

export function listLibrary(library) {
  return library.books;
}
