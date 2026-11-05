// CVNVO -- messages + Your Turn Limits, now screened via a real
// injected `vsafeScreenMessageFn(text)` instead of a local
// `messageSafety.js` duplicate. See lib/messages.js's own header for
// why: VSAFE's `aiMonitoring.js` already generalized that exact logic
// into its real, shared `screenContent`, reachable at its open
// `/api/monitor/screen` route.

const test = require('node:test');
const assert = require('node:assert');

const { createCvnvoStore } = require('../lib/store');
const { createMatch } = require('../lib/matching');
const { sendMessage, getMessagesForMatch, getUnansweredConversations, isUserOverTurnLimit } = require('../lib/messages');

const NOW = Date.UTC(2026, 10, 5);

function cleanScreen() {
  return async () => ({ flagged: false, severity: 'none', reasons: [] });
}

function flaggingScreen(severity = 'medium', reasons = ['external-link']) {
  return async (text) => (/http/i.test(text) ? { flagged: true, severity, reasons } : { flagged: false, severity: 'none', reasons: [] });
}

function makeMatch(store) {
  return createMatch(store, { userAId: 'ann', userBId: 'bo', compatibilityScore: 80, now: NOW });
}

test('sendMessage requires a real, injected vsafeScreenMessageFn', async () => {
  const store = createCvnvoStore();
  const match = makeMatch(store);
  await assert.rejects(
    () => sendMessage(store, { matchId: match.id, senderId: 'ann', text: 'hey', now: NOW }),
    /vsafeScreenMessageFn/,
  );
});

test('sendMessage stores the real flagged/severity/reasons VSAFE returns, not a fabricated verdict', async () => {
  const store = createCvnvoStore();
  const match = makeMatch(store);

  const clean = await sendMessage(store, {
    matchId: match.id, senderId: 'ann', text: 'hey, how was your day?', now: NOW, vsafeScreenMessageFn: cleanScreen(),
  });
  assert.equal(clean.flagged, false);
  assert.equal(clean.severity, 'none');
  assert.deepStrictEqual(clean.reasons, []);

  const flagged = await sendMessage(store, {
    matchId: match.id, senderId: 'bo', text: 'check this out https://example.test', now: NOW + 1000, vsafeScreenMessageFn: flaggingScreen(),
  });
  assert.equal(flagged.flagged, true);
  assert.equal(flagged.severity, 'medium');
  assert.deepStrictEqual(flagged.reasons, ['external-link']);

  assert.equal(getMessagesForMatch(store, match.id).length, 2);
});

test('a message flagged high-severity is still delivered -- VSAFE flags for real human review, this layer never silently blocks it', async () => {
  const store = createCvnvoStore();
  const match = makeMatch(store);
  const message = await sendMessage(store, {
    matchId: match.id, senderId: 'ann', text: 'http://threat.test', now: NOW, vsafeScreenMessageFn: flaggingScreen('high', ['threat-language']),
  });
  assert.equal(message.severity, 'high');
  assert.equal(getMessagesForMatch(store, match.id).length, 1, 'a flagged message is still a real, stored message');
});

// -- Your Turn Limits is real, local CVNVO logic untouched by the VSAFE migration --

test('Your Turn Limits still tracks awaiting-reply/unanswered count correctly alongside the real VSAFE screen', async () => {
  const store = createCvnvoStore();
  const match = makeMatch(store);
  const screen = cleanScreen();

  await sendMessage(store, { matchId: match.id, senderId: 'ann', text: 'hi', now: NOW, vsafeScreenMessageFn: screen });
  let m = createMatchLookup(store, match.id);
  assert.equal(m.unansweredCount, 1);
  assert.equal(m.awaitingReplyFromUserId, 'bo');

  await sendMessage(store, { matchId: match.id, senderId: 'ann', text: 'still there?', now: NOW + 1000, vsafeScreenMessageFn: screen });
  m = createMatchLookup(store, match.id);
  assert.equal(m.unansweredCount, 2, 'a second message with no reply piles up');

  await sendMessage(store, { matchId: match.id, senderId: 'bo', text: 'yeah, hi!', now: NOW + 2000, vsafeScreenMessageFn: screen });
  m = createMatchLookup(store, match.id);
  assert.equal(m.unansweredCount, 0, 'the awaited reply clears the stall');
  assert.equal(m.awaitingReplyFromUserId, 'ann');
});

test('isUserOverTurnLimit counts real stalled matches against the real threshold', async () => {
  const store = createCvnvoStore();
  const screen = cleanScreen();
  const partners = ['bo', 'cal', 'dee'];
  for (const partnerId of partners) {
    const match = createMatch(store, { userAId: 'ann', userBId: partnerId, compatibilityScore: 70, now: NOW });
    // eslint-disable-next-line no-await-in-loop
    await sendMessage(store, { matchId: match.id, senderId: partnerId, text: 'hi ann', now: NOW, vsafeScreenMessageFn: screen });
  }
  assert.equal(getUnansweredConversations(store, 'ann').length, 3);
  assert.equal(isUserOverTurnLimit(store, 'ann'), true);
});

function createMatchLookup(store, matchId) {
  return store.matches.find((m) => m.id === matchId);
}
