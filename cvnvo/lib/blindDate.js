// CVNVO -- Blind Date Mode, AI-chosen, one match at a time.
// Source of truth: `CVNVO_ARCHITECTURE.md`'s own `BlindDateSession {
// id, userId, aiAssignedMatchId, photosRevealed: boolean }` and
// `CVNVO_DATING_COMPARABLES.md`'s own research across four real,
// funded apps (The Blinded, Ditto, Blind Match, Amata): "an AI-driven
// interview... feeding a one-match-at-a-time assignment, blurred/
// hidden photos until real conversation happens, and a real commitment
// mechanic (small cost + a genuine consequence for repeated
// cancellations, per Amata's model)."
//
// **Real, consistent no-fake-AI stance**: per this session's
// established posture (MIA's real deterministic routing, DREA's real
// rule-checking, never a simulated model call), "AI-driven interview"
// is not built as a fake LLM conversation here. What's real and
// buildable is the deterministic assignment underneath it:
// `assignBlindDate` picks the single best-ranked candidate using
// `matching.js`'s own real, reliability-aware `computePreferenceList`
// -- the same real ranking logic behind ordinary matching, applied
// one-at-a-time instead of surfaced as a browsable stack.
//
// `aiAssignedMatchId` is a real `Match` record's id (created here with
// `matchType: 'blind-ai'`, already a real enum value in `matching.js`)
// -- not a bare candidate id -- so a blind date genuinely reuses
// `messages.js`'s own real conversation tracking for the "real
// conversation happens" reveal gate, rather than a second, parallel
// messaging concept.
//
// **Real commitment mechanic, grounded in Amata's own cited real
// number**: `DATE_TOKEN_PRICE_VCOIN = 20`, directly from the doc's own
// "purchase a $20 'date token.'" No real VCoin-to-dollar peg exists
// anywhere in this ecosystem, so this is a real, flagged, grounded
// choice (reusing the doc's own cited figure) rather than an invented
// one. `MAX_CONSECUTIVE_CANCELLATIONS = 2`, directly from the doc's
// own "cancelling two dates in a row."

const { getUserProfile } = require('./profiles');
const { computePreferenceList, createMatch } = require('./matching');
const { getMessagesForMatch } = require('./messages');

const DATE_TOKEN_PRICE_VCOIN = 20;
const CVNVO_PLATFORM_ACCOUNT = 'cvnvo-platform';
const MAX_CONSECUTIVE_CANCELLATIONS = 2;
const MIN_MESSAGES_BEFORE_REVEAL = 3; // real, flagged, bounded -- no exact number is given for "real conversation happens"

async function purchaseDateToken(store, options = {}) {
  const { userId, transferFn } = options;
  if (!userId) throw new Error('purchaseDateToken requires a userId');
  if (typeof transferFn !== 'function') throw new Error('purchaseDateToken requires a transferFn(fromUserId, toUserId, amount, reason)');

  await transferFn(userId, CVNVO_PLATFORM_ACCOUNT, DATE_TOKEN_PRICE_VCOIN, `cvnvo_blind_date_token:${userId}`);
  const token = {
    id: store.nextBlindDateTokenId++, userId, purchasedAt: Date.now(), usedAt: null,
  };
  store.blindDateTokens.push(token);
  return token;
}

function getCancellationStreak(store, userId) {
  const entry = store.blindDateCancellationStreaks.find((s) => s.userId === userId);
  return entry ? entry.consecutiveCancellations : 0;
}

function isUserBlockedFromBlindDating(store, userId) {
  return getCancellationStreak(store, userId) >= MAX_CONSECUTIVE_CANCELLATIONS;
}

function assignBlindDate(store, options = {}) {
  const { userId, candidateIds, now = Date.now() } = options;
  if (!userId) throw new Error('assignBlindDate requires a userId');
  if (!Array.isArray(candidateIds) || candidateIds.length === 0) throw new Error('assignBlindDate requires a non-empty candidateIds');
  if (!getUserProfile(store, userId)) throw new Error(`assignBlindDate: no real profile for ${userId}`);
  if (isUserBlockedFromBlindDating(store, userId)) {
    throw new Error(`assignBlindDate: ${userId} is temporarily blocked after ${MAX_CONSECUTIVE_CANCELLATIONS} consecutive cancellations`);
  }

  const token = store.blindDateTokens.find((t) => t.userId === userId && t.usedAt === null);
  if (!token) throw new Error(`assignBlindDate: ${userId} has no real, unused date token -- purchase one first`);

  const ranked = computePreferenceList(store, userId, candidateIds);
  const assignedUserId = ranked[0];
  const match = createMatch(store, {
    userAId: userId, userBId: assignedUserId, compatibilityScore: 100, matchType: 'blind-ai', now,
  });

  token.usedAt = now;

  const session = {
    id: store.nextBlindDateSessionId++, userId, aiAssignedMatchId: match.id, photosRevealed: false, cancelled: false, createdAt: now,
  };
  store.blindDateSessions.push(session);
  return session;
}

function getBlindDateSession(store, sessionId) {
  return store.blindDateSessions.find((s) => s.id === sessionId) || null;
}

function revealPhotos(store, options = {}) {
  const { sessionId } = options;
  const session = getBlindDateSession(store, sessionId);
  if (!session) throw new Error(`revealPhotos: no blind date session with id ${sessionId}`);
  if (session.cancelled) throw new Error(`revealPhotos: session ${sessionId} was cancelled`);
  if (session.photosRevealed) throw new Error(`revealPhotos: session ${sessionId} already has photos revealed`);

  const messageCount = getMessagesForMatch(store, session.aiAssignedMatchId).length;
  if (messageCount < MIN_MESSAGES_BEFORE_REVEAL) {
    throw new Error(`revealPhotos: real conversation hasn't happened yet (${messageCount}/${MIN_MESSAGES_BEFORE_REVEAL} messages)`);
  }

  session.photosRevealed = true;

  // A real reveal is the real evidence available here that this
  // commitment didn't flake out -- the cancellation streak clears.
  const streakEntry = store.blindDateCancellationStreaks.find((s) => s.userId === session.userId);
  if (streakEntry) streakEntry.consecutiveCancellations = 0;

  return session;
}

function cancelBlindDate(store, options = {}) {
  const { sessionId, now = Date.now() } = options;
  const session = getBlindDateSession(store, sessionId);
  if (!session) throw new Error(`cancelBlindDate: no blind date session with id ${sessionId}`);
  if (session.cancelled) throw new Error(`cancelBlindDate: session ${sessionId} is already cancelled`);
  if (session.photosRevealed) throw new Error(`cancelBlindDate: session ${sessionId} already had photos revealed`);

  session.cancelled = true;
  session.cancelledAt = now;

  let streakEntry = store.blindDateCancellationStreaks.find((s) => s.userId === session.userId);
  if (!streakEntry) {
    streakEntry = { userId: session.userId, consecutiveCancellations: 0 };
    store.blindDateCancellationStreaks.push(streakEntry);
  }
  streakEntry.consecutiveCancellations += 1;

  return session;
}

module.exports = {
  DATE_TOKEN_PRICE_VCOIN,
  CVNVO_PLATFORM_ACCOUNT,
  MAX_CONSECUTIVE_CANCELLATIONS,
  MIN_MESSAGES_BEFORE_REVEAL,
  purchaseDateToken,
  isUserBlockedFromBlindDating,
  assignBlindDate,
  getBlindDateSession,
  revealPhotos,
  cancelBlindDate,
};
