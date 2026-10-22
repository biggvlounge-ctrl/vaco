// Vaco Assistant -- one per signed-in user, personalized to how they
// described themselves, with a real connection into VACON's own 14
// named executive agents for anything domain-specific.
//
// **Extracted from `vaco-shell/lib/personalAssistant.js` into its own
// app (15 Oct 2026), by direct decision.** It was built into vaco-shell
// first because that was the only confirmed consumer; this app is the
// second. Pulling it out means any app can now reach the same real
// assistant the same way vaco-shell does -- an HTTP call, not a
// `require()` across a directory boundary -- instead of the assistant
// staying stuck behind one dashboard. The logic itself is unchanged
// from the original, same decision, same mechanism.
//
// Builds directly on `lib/insight.js`'s own proven VACON routing/
// invoke mechanism rather than re-implementing it -- the two features
// share the same real routing call. What this module adds that
// Insight deliberately does not: a stored per-user profile, a real
// multi-turn conversation history, and a general-chat fallback for
// anything outside VACON's 14-agent roster, answered by THIS user's
// own personalized assistant rather than refused outright.
//
// **The decision, concretely**: route every message through VACON's
// real keyword router first. A real domain match (security, finance,
// legal, dating, travel, logistics, advertising, production, market
// research, music discovery/creator tools/distribution) is handed to
// the VACON specialist who actually owns it -- "connects to Vacon's AI
// system" is this, literally, not a metaphor. Anything general is
// answered directly by a real v4-proxy completion carrying this one
// user's own name/tone/lifestyle in its system prompt, which is the
// one real personalization mechanism: the same question gets a
// different system prompt for every user who asks it, grounded in what
// they actually told it about themselves, never a generic chatbot
// prompt shared by everyone.
//
// **Never fabricates a reply either way.** A real completion failure
// (no ANTHROPIC_API_KEY behind v4-proxy, v4-proxy or VACON unreachable)
// surfaces as a real error, same posture every other AI-backed route in
// this ecosystem already holds.

const { getInsightCard } = require('./insight');
const { getProfileSummary, getRecentActivity } = require('./explore');
const { connectorStatus, createGoal } = require('./assistantTasks');

const V4_PROXY_URL = process.env.V4_PROXY_URL || 'http://localhost:8787';
const V3_API_URL = process.env.V3_API_URL || 'http://localhost:8811';

// A real balance question gets a real, deterministic lookup against
// V3's own ledger -- never routed to VACON's finance specialist (Leslie),
// who has no actual account access and would otherwise either refuse
// or, worse, guess. This is the same "never fabricate" posture
// `sendMessage` already holds for completions, applied to the one
// class of question this app can answer exactly rather than
// generatively. Narrow on purpose: a false match costs nothing (the
// real number is still correct), a false *non*-match just falls
// through to the normal routing below.
const BALANCE_INTENT = /\b(my\s+)?(vcoin|balance|wallet)\b/i;

async function lookupBalance(userId) {
  const res = await fetch(`${V3_API_URL}/api/vcoin/balance/${encodeURIComponent(userId)}`);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `V3 balance lookup failed (${res.status})`);
  return body.balance;
}

// The same real cross-app reads vaco-shell's own Explore tab pulls
// ("your VACO" -- VXLLAGE posts/subscribers, VOKEN referrals, VAGO
// entries, V3's own settlement log), answered through chat instead of
// only through a dashboard tile. Same reasoning as BALANCE_INTENT: no
// VACON specialist has real access to another app's data either, so
// this is checked before VACON routing, not handed to it. App names
// are distinctive enough brand terms that a false match costs nothing
// (the real number is still correct) and a false non-match just falls
// through to normal routing.
const EXPLORE_APPS = {
  vxllage: {
    pattern: /\bvxllage\b/i,
    describe: (p) => (p.vxllage.ok
      ? `On VXLLAGE you have ${p.vxllage.articleCount} posts and ${p.vxllage.subscriberCount} subscribers.`
      : `I couldn't check your real VXLLAGE data just now: ${p.vxllage.error}`),
  },
  voken: {
    pattern: /\bvoken\b/i,
    describe: (p) => (p.voken.ok
      ? `On VOKEN you have ${p.voken.referralCount} referrals.`
      : `I couldn't check your real VOKEN data just now: ${p.voken.error}`),
  },
  vago: {
    pattern: /\bvago\b/i,
    describe: (p) => (p.vago.ok
      ? `On VAGO you have ${p.vago.entryCount} fantasy entries.`
      : `I couldn't check your real VAGO data just now: ${p.vago.error}`),
  },
};
const ACTIVITY_INTENT = /\b(recent activity|my activity|my transactions|what (have i|i'?ve) been up to)\b/i;

// **The single most safety-critical check in this file.** A payment/
// booking/purchase-sounding request is intercepted here, BEFORE it
// can ever reach a general completion -- an LLM asked "did you pay my
// electric bill?" will happily say yes if nothing stops it first, and
// this ecosystem has no real connector that could have actually done
// it (see `assistantTasks.js`'s own header: no real bank/card/booking
// integration exists anywhere here). Checked in the same place and
// for the same reason `BALANCE_INTENT` already is: no VACON specialist
// has real access to pay a bill either, so this is answered directly,
// never routed.
const CONNECTOR_INTENTS = {
  'pay-bill': /\b(pay|paying)\s+(my\s+|the\s+)?[\w\s]{0,20}\bbills?\b/i,
  'book-appointment': /\b(book|schedule)\s+(me\s+)?(an?\s+)?appointment\b/i,
  'make-purchase': /\b(buy|purchase|order)\s+(me\s+)?(a|an|some)\b/i,
  'cancel-external-subscription': /\bcancel\s+(my\s+)?[\w\s]{0,20}\bsubscriptions?\b/i,
};

function describeActivity(activity) {
  if (!activity.ok) return `I couldn't check your real recent activity just now: ${activity.error}`;
  if (!activity.items.length) return "There's nothing in your real recent activity yet.";
  const lines = activity.items.slice(0, 5).map((item) => {
    const side = item.direction === 'in' ? `+${item.amount} from ${item.counterparty}` : `-${item.amount} to ${item.counterparty}`;
    return item.reason ? `${side} (${item.reason})` : side;
  });
  return `Your most recent real activity: ${lines.join('; ')}.`;
}

// Same per-file service-credential pattern every cross-app caller in
// this ecosystem holds its own copy of (see lib/insight.js) -- this
// app settles/calls server-to-server with no end-user session to
// present downstream.
const VACO_SERVICE_NAME = process.env.VACO_SERVICE_NAME || 'vaco-assistant';
const VACO_SERVICE_TOKEN = process.env.VACO_SERVICE_TOKEN || '';
function serviceHeaders() {
  return VACO_SERVICE_TOKEN
    ? { 'X-Service-Name': VACO_SERVICE_NAME, 'X-Service-Token': VACO_SERVICE_TOKEN }
    : {};
}

const TONE_OPTIONS = ['friendly', 'direct', 'professional', 'motivational'];
const DEFAULT_TONE = 'friendly';
const DEFAULT_NAME = 'Vaco';
// How much real conversation history rides along on the general
// (non-specialist) path. Flagged interpretive -- no source document
// sets this number; it is a real, deliberate bound on how much of a
// person's own words get sent back through on every message, not an
// attempt at a "correct" context window.
const HISTORY_WINDOW = 10;

function requireCollections(store) {
  if (!store.assistantProfiles) store.assistantProfiles = [];
  if (!store.assistantMessages) store.assistantMessages = [];
  if (!store.nextAssistantMessageId) store.nextAssistantMessageId = 1;
}

function setProfile(store, options = {}) {
  requireCollections(store);
  const {
    userId, name = DEFAULT_NAME, tone = DEFAULT_TONE, lifestyle = '', now = Date.now(),
  } = options;
  if (!userId) throw new Error('setProfile requires a userId');
  if (!name.trim()) throw new Error('setProfile: name cannot be empty');
  if (!TONE_OPTIONS.includes(tone)) {
    throw new Error(`setProfile: tone must be one of ${TONE_OPTIONS.join(', ')}`);
  }

  let profile = store.assistantProfiles.find((p) => p.userId === userId);
  if (!profile) {
    profile = { userId, createdAt: now };
    store.assistantProfiles.push(profile);
  }
  profile.name = name;
  profile.tone = tone;
  profile.lifestyle = lifestyle;
  profile.updatedAt = now;
  return profile;
}

// Always returns something real to build a prompt from -- a person who
// has never set anything up yet gets the honest, unpersonalized
// default rather than a 404, since asking a question is the more
// natural first action than visiting a settings screen first.
function getProfile(store, userId) {
  requireCollections(store);
  return store.assistantProfiles.find((p) => p.userId === userId)
    || { userId, name: DEFAULT_NAME, tone: DEFAULT_TONE, lifestyle: '' };
}

function buildSystemPrompt(profile) {
  const lifestyleLine = profile.lifestyle
    ? ` Here is what this person has told you about their life, interests, and preferences -- use it to make `
      + `your answers specific to them, never generic: "${profile.lifestyle}"`
    : '';
  return `You are ${profile.name}, this person's own personal AI assistant inside the VACO ecosystem. `
    + `Speak in a ${profile.tone} tone.${lifestyleLine} `
    + 'You can talk about anything. For anything that is really the job of one of VACO\'s own specialist '
    + 'systems (security, finance, legal, dating, travel, logistics, advertising, production, market '
    + 'research, or music discovery/creator tools/distribution), say plainly that you are handing it to the '
    + 'right system rather than guessing at an answer yourself.';
}

function recordMessage(store, options = {}) {
  requireCollections(store);
  const { userId, role, content, routedTo = null, now = Date.now() } = options;
  const message = {
    id: store.nextAssistantMessageId++, userId, role, content, routedTo, createdAt: now,
  };
  store.assistantMessages.push(message);
  return message;
}

function getHistory(store, userId) {
  requireCollections(store);
  return store.assistantMessages
    .filter((m) => m.userId === userId)
    .sort((a, b) => a.createdAt - b.createdAt);
}

async function invokeV4Direct(systemPrompt, messages) {
  const res = await fetch(`${V4_PROXY_URL}/api/agent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...serviceHeaders() },
    body: JSON.stringify({ system: systemPrompt, messages }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `invokeV4Direct failed (${res.status})`);
  return body;
}

// `insightFn`/`invokeFn` default to the real VACON-routing and
// real-V4 calls, injectable for tests -- same real pattern as
// `venvm/lib/scriptEngine.js`'s own `invokeFn` and every other
// completion-shaped call in this ecosystem. Nothing here fabricates a
// reply; a fake network layer is for a fast, deterministic test, not
// for pretending a completion happened.
async function sendMessage(store, options = {}) {
  const {
    userId, content, insightFn = getInsightCard, invokeFn = invokeV4Direct, balanceFn = lookupBalance,
    profileFn = getProfileSummary, activityFn = getRecentActivity,
  } = options;
  if (!userId) throw new Error('sendMessage requires a userId');
  if (!content || !content.trim()) throw new Error('sendMessage requires content');

  const priorHistory = getHistory(store, userId)
    .slice(-HISTORY_WINDOW)
    .map((m) => ({ role: m.role, content: m.content }));
  recordMessage(store, { userId, role: 'user', content });

  // Checked first, before anything else -- see CONNECTOR_INTENTS' own
  // comment on why this is the single most safety-critical check
  // here. A real goal is opened (so the person's own task list shows
  // it), and the reply states the real, honest connector status
  // rather than letting the message fall through to a completion that
  // could hallucinate "done."
  const connectorMatch = Object.entries(CONNECTOR_INTENTS).find(([, pattern]) => pattern.test(content));
  if (connectorMatch) {
    const [kind] = connectorMatch;
    const status = connectorStatus(kind);
    const goal = createGoal(store, { userId, kind, description: content });
    const reply = status.available
      ? `I've started on that: ${goal.description}`
      : `I can't actually do that yet -- ${status.reason} I've logged it as a task so you don't lose track of it.`;
    return recordMessage(store, { userId, role: 'assistant', content: reply, routedTo: 'connector' });
  }

  // Checked before VACON routing, not after: VACON's own keyword
  // router would send "what's my balance" to Leslie (finance) anyway,
  // and Leslie is a generic completion with no real account access --
  // she would either refuse or guess. A real number, looked up once,
  // beats either.
  if (BALANCE_INTENT.test(content)) {
    let balance;
    try {
      balance = await balanceFn(userId);
    } catch (err) {
      throw new Error(`I couldn't check your real balance just now: ${err.message}`);
    }
    return recordMessage(store, {
      userId, role: 'assistant', content: `You have ${balance} VCoin right now.`, routedTo: 'wallet',
    });
  }

  // Same real-data-over-routing posture as the balance check above,
  // for the rest of "your VACO": a mentioned app name gets a real
  // cross-app read instead of a generic completion that has no actual
  // access to VXLLAGE/VOKEN/VAGO. More than one app name in one
  // message gets every real answer it asked for, not just the first.
  const matchedApps = Object.entries(EXPLORE_APPS).filter(([, app]) => app.pattern.test(content));
  if (matchedApps.length > 0) {
    const profile = await profileFn(userId);
    const reply = matchedApps.map(([, app]) => app.describe(profile)).join(' ');
    return recordMessage(store, { userId, role: 'assistant', content: reply, routedTo: 'explore' });
  }

  if (ACTIVITY_INTENT.test(content)) {
    const activity = await activityFn(userId);
    return recordMessage(store, {
      userId, role: 'assistant', content: describeActivity(activity), routedTo: 'explore',
    });
  }

  // A VACON outage is treated the same as "no domain match" -- the
  // assistant's own core job (personalized chat) does not need VACON
  // to be up, only the specialist-relay half of it does.
  let card;
  try {
    card = await insightFn({ query: content, invoke: true });
  } catch {
    card = { matchedAgents: [], completion: null, completionError: null };
  }
  const matched = Array.isArray(card.matchedAgents) ? card.matchedAgents : [];

  let reply;
  let routedTo = null;
  if (matched.length > 0) {
    if (card.completion && card.completion.text) {
      reply = card.completion.text;
      routedTo = matched[0].agentId || matched[0].id;
    } else {
      // A real specialist was matched, but the completion itself
      // failed (no key behind v4-proxy, v4-proxy unreachable) -- the
      // same failure the general path would also hit, so surface it
      // honestly rather than silently falling back and hiding that
      // something is actually broken.
      throw new Error(card.completionError || 'a specialist was matched but produced no completion');
    }
  } else {
    const profile = getProfile(store, userId);
    const result = await invokeFn(
      buildSystemPrompt(profile),
      [...priorHistory, { role: 'user', content }],
    );
    reply = result.text;
  }

  return recordMessage(store, { userId, role: 'assistant', content: reply, routedTo });
}

module.exports = {
  TONE_OPTIONS, setProfile, getProfile, buildSystemPrompt, getHistory, sendMessage,
};
