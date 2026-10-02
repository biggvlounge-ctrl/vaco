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
