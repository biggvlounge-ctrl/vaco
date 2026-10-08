// VDP's real, thin client for V4's own agent proxy -- same posture as
// every other `-Client.js` module here: no vision/analysis logic lives
// in this file, the real call to Anthropic's Messages API happens on
// V4's own server (`POST /api/agent`), which is the only place that
// holds the real API key. This module only shapes the request and
// parses the response.
//
// Used by DEGVCHI's photo-to-outfit flow (`createCustomWearableFromPhoto`
// in `degvchi.js`): a player photographs a real outfit, this sends it
// to the real model for a real description, and the result becomes a
// new, unique closet item -- not a duplicate of an existing catalog
// item, which is what buying a wearable the ordinary way grants.

import { sessionHeaders } from './shieldAuth.js';

const V4_API_URL = import.meta.env?.VITE_V4_API_URL || 'http://localhost:8787';

const OUTFIT_SYSTEM_PROMPT = `You are a fashion cataloguer for a game's avatar marketplace. You are shown one photograph of a real outfit. Respond with STRICT JSON only, no prose before or after, matching exactly this shape:
{"name": "<a short, specific item name, under 40 characters>", "category": "<one of: clothing, cosmetics, accessories>", "dominantColor": "<a short color name>", "description": "<one sentence describing the outfit>"}
If the photo does not clearly show a wearable outfit, still return your best-effort JSON using "clothing" as the category and say so plainly in the description.`;

async function requestJson(path, options) {
  const res = await fetch(`${V4_API_URL}${path}`, options);
  if (!res.ok) {
    const text = await res.text();
    let message = `${path} failed (${res.status})`;
    try { message = JSON.parse(text).error || message; } catch { /* not JSON */ }
    throw new Error(message);
  }
  return res.json();
}

// Strict-JSON responses from a real model are usually clean, but a
// model is not a parser -- a stray code fence or a leading sentence
// is a real failure mode, not a hypothetical one, so this is
// defensive rather than a bare JSON.parse.
export function parseOutfitJson(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error('analyzeOutfitPhoto: the model did not return recognizable JSON');
  }
  const parsed = JSON.parse(match[0]);
  const { name, category, dominantColor, description } = parsed;
  if (typeof name !== 'string' || !name.trim()) {
    throw new Error('analyzeOutfitPhoto: the model response is missing a name');
  }
  if (!['clothing', 'cosmetics', 'accessories'].includes(category)) {
    throw new Error(`analyzeOutfitPhoto: the model returned an unrecognized category "${category}"`);
  }
  return {
    name: name.trim(),
    category,
    dominantColor: typeof dominantColor === 'string' ? dominantColor.trim() : '',
    description: typeof description === 'string' ? description.trim() : '',
  };
}

// `base64Image` is the photo's raw base64 data, no `data:` prefix.
// `mediaType` must be one of the real types V4's own
// `lib/agentContent.js` accepts (image/jpeg, image/png, image/gif,
// image/webp).
export async function analyzeOutfitPhoto(base64Image, mediaType) {
  if (typeof base64Image !== 'string' || !base64Image) {
    throw new Error('analyzeOutfitPhoto requires base64Image');
  }
  if (typeof mediaType !== 'string' || !mediaType) {
    throw new Error('analyzeOutfitPhoto requires mediaType');
  }

  const body = await requestJson('/api/agent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...sessionHeaders() },
    body: JSON.stringify({
      system: OUTFIT_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Image } },
            { type: 'text', text: 'Catalogue this one photographed outfit.' },
          ],
        },
      ],
    }),
  });

  return parseOutfitJson(body.text || '');
}

// Real conversation with a specific NPC, grounded in that NPC's own
// actual state (`npcs.js`'s real traits + its latest decision-log
// entry, rendered the same way `explainDecision` already renders it
// for the hover tooltip) rather than a generic chatbot persona — the
// same "real analysis, not a stand-in" posture `analyzeOutfitPhoto`
// above already takes with a photo.
//
// The model is asked to tag its own reply with ONE topic from a fixed
// list, which is how a conversation gets to move a trait/skill at
// all: the server (`vdp/server.cjs`'s `POST /api/players/:id/talk`)
// applies a small, bounded nudge keyed on that topic, never on
// free-text the model could use to claim an arbitrarily large effect.
const TALK_TOPICS = ['business', 'crafting', 'construction', 'communication', 'management', 'athletics', 'art', 'philosophical', 'religious', 'none'];

function talkSystemPrompt(npc, npcExplainLine) {
  const traitSummary = Object.entries(npc.traits)
    .map(([name, value]) => `${name} ${value}`)
    .join(', ');
  return `You are ${npc.name}, a character in a small walkable-world game. Your personality traits (0-100 each): ${traitSummary}. ${npcExplainLine ? `Right now: ${npcExplainLine}` : "You haven't decided what to do next yet."}
Reply to the player in character, 1-2 sentences, consistent with your own traits above. Respond with STRICT JSON only, no prose before or after, matching exactly this shape:
{"reply": "<your in-character reply>", "topic": "<one of: ${TALK_TOPICS.join(', ')}>"}
Use "topic" to name the one real subject your reply is actually about -- "business"/"crafting"/"construction"/"communication"/"management"/"athletics"/"art" for a practical skill, "philosophical" or "religious" for a belief or worldview exchange, "none" for small talk with no real subject.`;
}

export function parseTalkJson(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error('talkToNpc: the model did not return recognizable JSON');
  }
  const parsed = JSON.parse(match[0]);
  const { reply, topic } = parsed;
  if (typeof reply !== 'string' || !reply.trim()) {
    throw new Error('talkToNpc: the model response is missing a reply');
  }
  if (!TALK_TOPICS.includes(topic)) {
    throw new Error(`talkToNpc: the model returned an unrecognized topic "${topic}"`);
  }
  return { reply: reply.trim(), topic };
}

// `npc` is a real NPC object from `npcs.js`'s own shape (as broadcast
// by the server's WebSocket layer). `latestDecisionEntry`/`explainFn`
// let the caller pass `latestDecision(npc)`/`explainDecision` from
// `npcs.js` without this module importing React-side state.
export async function talkToNpc(npc, playerMessage, { latestDecisionEntry = null, explainFn = null } = {}) {
  if (!npc) throw new Error('talkToNpc requires an npc');
  if (typeof playerMessage !== 'string' || !playerMessage.trim()) {
    throw new Error('talkToNpc requires a playerMessage');
  }
  const explainLine = explainFn ? explainFn(latestDecisionEntry) : '';

  const body = await requestJson('/api/agent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...sessionHeaders() },
    body: JSON.stringify({
      system: talkSystemPrompt(npc, explainLine),
      messages: [{ role: 'user', content: playerMessage.trim() }],
    }),
  });

  return parseTalkJson(body.text || '');
}

// "There's an AI that works with the users to show them things to
// get further in the game... we want this to be a little more
// natural and build natural" (8 Oct 2026, direct instruction). V4 --
// the same AI persona `GovernmentView.jsx` already presents as this
// world's government -- speaks directly to one real resident, using
// only the real facts `server.cjs`'s `GET /api/guide/facts/:id`
// assembled about them and the shared world (never a scripted,
// numbered quest list, the thing the instruction explicitly asked
// this NOT to feel like).
function guideSystemPrompt(facts) {
  return `You are V4, the AI that governs Meridian, a small futuristic colony everyone shares. You are given real, current facts about one resident and about the shared world right now. Based ONLY on these real facts, give this resident ONE natural, conversational suggestion for something they could do next in Meridian. Never invent a fact about them or the world that isn't given below. Speak like a government AI who genuinely knows this person's own situation -- not a quest log: no numbered steps, no "objective," just 1-3 natural sentences.

Real facts right now:
${facts}

Respond with STRICT JSON only, no prose before or after, matching exactly this shape:
{"suggestion": "<your natural, in-character suggestion, 1-3 sentences>"}`;
}

export function parseGuidanceJson(text) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new Error('suggestNextStep: the model did not return recognizable JSON');
  }
  const parsed = JSON.parse(match[0]);
  const { suggestion } = parsed;
  if (typeof suggestion !== 'string' || !suggestion.trim()) {
    throw new Error('suggestNextStep: the model response is missing a suggestion');
  }
  return { suggestion: suggestion.trim() };
}

// `facts` is a plain-text summary the caller builds from real data it
// already has (the shape `GET /api/guide/facts/:id` returns) -- this
// module stays decoupled from any one way of formatting it, the same
// posture `talkToNpc` already keeps toward `npcs.js`.
export async function suggestNextStep(facts) {
  if (typeof facts !== 'string' || !facts.trim()) {
    throw new Error('suggestNextStep requires a real facts summary');
  }

  const body = await requestJson('/api/agent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...sessionHeaders() },
    body: JSON.stringify({
      system: guideSystemPrompt(facts),
      messages: [{ role: 'user', content: 'What should I do next in Meridian?' }],
    }),
  });

  return parseGuidanceJson(body.text || '');
}
