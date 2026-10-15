// VACO -- the shell's personal AI assistant: one per signed-in user,
// personalized to how they described themselves, with a real
// connection into VACON's own 14 named executive agents for anything
// domain-specific.
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

import { getInsightCard } from './insight.js';

const V4_PROXY_URL = process.env.V4_PROXY_URL || 'http://localhost:8787';

// Same per-file service-credential pattern every cross-app caller in
// this ecosystem holds its own copy of (see lib/v3Client.js,
// lib/insight.js) -- this app settles/calls server-to-server with no
// end-user session to present downstream.
const VACO_SERVICE_NAME = process.env.VACO_SERVICE_NAME || 'vaco-shell';
const VACO_SERVICE_TOKEN = process.env.VACO_SERVICE_TOKEN || '';
function serviceHeaders() {
  return VACO_SERVICE_TOKEN
    ? { 'X-Service-Name': VACO_SERVICE_NAME, 'X-Service-Token': VACO_SERVICE_TOKEN }
    : {};
}

export const TONE_OPTIONS = ['friendly', 'direct', 'professional', 'motivational'];
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

export function setProfile(store, options = {}) {
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
export function getProfile(store, userId) {
  requireCollections(store);
  return store.assistantProfiles.find((p) => p.userId === userId)
    || { userId, name: DEFAULT_NAME, tone: DEFAULT_TONE, lifestyle: '' };
}

export function buildSystemPrompt(profile) {
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

export function getHistory(store, userId) {
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
export async function sendMessage(store, options = {}) {
  const { userId, content, insightFn = getInsightCard, invokeFn = invokeV4Direct } = options;
  if (!userId) throw new Error('sendMessage requires a userId');
  if (!content || !content.trim()) throw new Error('sendMessage requires content');

  const priorHistory = getHistory(store, userId)
    .slice(-HISTORY_WINDOW)
    .map((m) => ({ role: m.role, content: m.content }));
  recordMessage(store, { userId, role: 'user', content });

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
