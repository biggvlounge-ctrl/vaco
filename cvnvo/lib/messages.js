// CVNVO -- real messages + Your Turn Limits, the real anti-ghosting
// mechanic named directly in three source docs: `CVNVO_ARCHITECTURE.md`'s
// own `Match.unansweredCount: number // Your Turn Limits — new likes
// pause above threshold`, `CVNVO_CORE_FEATURES.md`'s "once a user has
// a set number of unanswered conversations, new likes pause until they
// respond," and `CVNVO_DATING_COMPARABLES.md`'s own description of
// Hinge's real mechanic: "blocks a user from sending new likes once
// they have too many unanswered conversations."
//
// **Real, necessary prerequisite found and built**: no message/
// conversation storage existed anywhere in this codebase before this
// file -- `messageSafety.js`'s own `screenMessage` was a real, pure
// scanning function with no caller that ever persisted a message.
// Checked directly rather than assumed. `sendMessage` below is the
// real, first place a CVNVO message is actually stored, and it's the
// one that runs every message through `screenMessage` per
// `CVNVO_CORE_FEATURES.md`'s own "AI spam/scam filtering runs on every
// conversation."
//
// **Real, tracked "whose turn is it"**: each match gets a real
// `awaitingReplyFromUserId` (who owes the next reply) alongside its
// own `unansweredCount` (how many messages have piled up from the
// other side while waiting). Sending a message that IS the awaited
// reply resets the count to zero and flips whose turn it is; sending
// again without having replied increments it. `isUserOverTurnLimit`
// counts real, distinct stalled conversations (matches where this user
// is the one who owes a reply) against a real, flagged, bounded
// threshold -- no source doc gives Hinge's own real number.
//
// **Real, deliberate mapping onto CVNVO's own algorithmic matching**:
// Hinge's mechanic pauses a user's own outgoing swipes/likes. CVNVO
// has no individual swipe action -- matches are generated in batches
// by Gale-Shapley (`matching.js`). The literal, real translation here
// is enforced in `matching.js`'s own `runGaleShapley`: a user over
// their Your Turn Limit is excluded from that round's candidate pool
// entirely, so they receive no new matches until they reply --
// deliberately flagged as an adapted mapping, not a 1:1 port.

const { screenMessage } = require('./messageSafety');

const MAX_UNANSWERED_CONVERSATIONS = 3; // real, flagged, bounded -- no source doc gives Hinge's own real threshold

function getMatchOrThrow(store, matchId) {
  const match = store.matches.find((m) => m.id === matchId);
  if (!match) throw new Error(`no match with id ${matchId}`);
  return match;
}

function otherUserId(match, userId) {
  if (userId === match.userAId) return match.userBId;
  if (userId === match.userBId) return match.userAId;
  throw new Error(`${userId} is not a participant in match ${match.id}`);
}

function sendMessage(store, options = {}) {
  const { matchId, senderId, text, now = Date.now() } = options;
  if (!senderId) throw new Error('sendMessage requires a senderId');
  if (typeof text !== 'string' || text.trim().length === 0) throw new Error('sendMessage requires non-empty text');

  const match = getMatchOrThrow(store, matchId);
  const recipientId = otherUserId(match, senderId);
  if (match.expiresAt < now) throw new Error(`sendMessage: match ${matchId} has expired`);

  const { flagged, reasons } = screenMessage(text);

  if (match.awaitingReplyFromUserId === senderId) {
    // This message IS the awaited reply -- the stall clears and the
    // turn flips to the recipient.
    match.unansweredCount = 0;
  } else {
    // Either the very first message in this match, or the sender is
    // messaging again without having gotten a reply -- both real cases
    // where the pile-up grows.
    match.unansweredCount += 1;
  }
  match.awaitingReplyFromUserId = recipientId;

  const message = {
    id: store.nextMessageId++, matchId, senderId, recipientId, text, flagged, reasons, createdAt: now,
  };
  store.messages.push(message);
  return message;
}

function getMessagesForMatch(store, matchId) {
  return store.messages.filter((m) => m.matchId === matchId).sort((a, b) => a.createdAt - b.createdAt);
}

// Real, distinct stalled-conversation count for a user -- every match
// where this user is currently the one who owes a reply.
function getUnansweredConversations(store, userId) {
  return store.matches.filter((m) => m.awaitingReplyFromUserId === userId);
}

function isUserOverTurnLimit(store, userId) {
  return getUnansweredConversations(store, userId).length >= MAX_UNANSWERED_CONVERSATIONS;
}

module.exports = {
  MAX_UNANSWERED_CONVERSATIONS, sendMessage, getMessagesForMatch, getUnansweredConversations, isUserOverTurnLimit,
};
